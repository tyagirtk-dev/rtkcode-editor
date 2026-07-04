"""
File system operations for the workspace.

All functions accept & return *workspace-relative* paths (strings with
forward slashes) so the API layer never leaks real filesystem paths to
the client, and so path safety checks happen in a single place
(security.resolve_safe_path).

Saves overwrite the real file directly (via os.replace after writing a
sibling temp file) - there are never any duplicate copies left behind.
"""
import os
import shutil
from pathlib import Path
from typing import List, Dict

from fastapi import HTTPException

from .config import (
    WORKSPACE_ROOT,
    IGNORED_DIR_NAMES,
    MAX_FILE_SIZE,
    MAX_SEARCH_FILE_SIZE,
    MAX_TEXT_SEARCH_RESULTS,
    MAX_NAME_SEARCH_RESULTS,
)
from .security import resolve_safe_path, to_relative


def _is_binary(path: Path, sniff_bytes: int = 2048) -> bool:
    """Cheap binary detector: look for a NUL byte in the first chunk of the file."""
    try:
        with open(path, "rb") as f:
            chunk = f.read(sniff_bytes)
        return b"\x00" in chunk
    except OSError:
        return True


def _entry_info(path: Path) -> Dict:
    stat = path.stat()
    is_dir = path.is_dir()
    return {
        "name": path.name,
        "path": to_relative(path),
        "type": "folder" if is_dir else "file",
        "size": None if is_dir else stat.st_size,
        "modified": int(stat.st_mtime),
    }


def list_children(relative_path: str = "") -> List[Dict]:
    """Immediate children of a folder - used for lazy tree loading."""
    folder = resolve_safe_path(relative_path)
    if not folder.exists():
        raise HTTPException(404, f"Folder not found: {relative_path}")
    if not folder.is_dir():
        raise HTTPException(400, f"Not a folder: {relative_path}")

    entries = []
    try:
        with os.scandir(folder) as it:
            for entry in it:
                if entry.is_dir() and entry.name in IGNORED_DIR_NAMES:
                    continue
                try:
                    entries.append(_entry_info(Path(entry.path)))
                except OSError:
                    # Broken symlink or permission race - skip rather than 500.
                    continue
    except PermissionError:
        raise HTTPException(403, f"Permission denied: {relative_path}")

    # Folders first, then files, both alphabetically (case-insensitive).
    entries.sort(key=lambda e: (e["type"] != "folder", e["name"].lower()))
    return entries


def read_file(relative_path: str) -> Dict:
    """Read a text file's contents. Raises if the file looks binary or is too large."""
    path = resolve_safe_path(relative_path)
    if not path.exists():
        raise HTTPException(404, f"File not found: {relative_path}")
    if path.is_dir():
        raise HTTPException(400, f"Path is a folder: {relative_path}")

    size = path.stat().st_size
    if size > MAX_FILE_SIZE:
        raise HTTPException(413, f"File too large to open ({size} bytes)")

    if _is_binary(path):
        raise HTTPException(415, "File appears to be binary and cannot be edited as text")

    try:
        with open(path, "r", encoding="utf-8", errors="strict") as f:
            content = f.read()
        encoding = "utf-8"
    except UnicodeDecodeError:
        # Fall back to a lossy decode rather than failing outright.
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
        encoding = "utf-8 (lossy fallback)"

    return {"path": relative_path, "content": content, "encoding": encoding, "size": size}


def write_file(relative_path: str, content: str) -> Dict:
    """
    Overwrite (or create) a file with new content.

    This IS the save operation: it writes straight into the real project
    file. A temp file in the same directory is used only to make the
    write atomic (no half-written file if interrupted) - it is renamed
    over the target and never left behind, so there is exactly one file
    on disk, never a copy.
    """
    path = resolve_safe_path(relative_path)
    if path.exists() and path.is_dir():
        raise HTTPException(400, f"Path is a folder: {relative_path}")

    path.parent.mkdir(parents=True, exist_ok=True)

    tmp_path = path.with_name(path.name + ".tmp-save")
    try:
        with open(tmp_path, "w", encoding="utf-8", newline="") as f:
            f.write(content)
        os.replace(tmp_path, path)
    finally:
        if tmp_path.exists():
            tmp_path.unlink(missing_ok=True)

    return {"path": relative_path, "size": path.stat().st_size}


def create_file(relative_path: str) -> Dict:
    path = resolve_safe_path(relative_path)
    if path.exists():
        raise HTTPException(409, f"Already exists: {relative_path}")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.touch()
    return _entry_info(path)


def create_folder(relative_path: str) -> Dict:
    path = resolve_safe_path(relative_path)
    if path.exists():
        raise HTTPException(409, f"Already exists: {relative_path}")
    path.mkdir(parents=True)
    return _entry_info(path)


def delete_path(relative_path: str) -> None:
    path = resolve_safe_path(relative_path)
    if not path.exists():
        raise HTTPException(404, f"Not found: {relative_path}")
    if path == WORKSPACE_ROOT.resolve():
        raise HTTPException(400, "Refusing to delete the workspace root")

    if path.is_dir():
        shutil.rmtree(path)
    else:
        path.unlink()


def rename_path(old_relative: str, new_relative: str) -> Dict:
    """Rename or move a file/folder. Moving is just a rename to a new relative path."""
    old_path = resolve_safe_path(old_relative)
    new_path = resolve_safe_path(new_relative)

    if not old_path.exists():
        raise HTTPException(404, f"Not found: {old_relative}")
    if new_path.exists():
        raise HTTPException(409, f"Target already exists: {new_relative}")

    new_path.parent.mkdir(parents=True, exist_ok=True)
    old_path.rename(new_path)
    return _entry_info(new_path)


def search_names(query: str) -> List[Dict]:
    """Search for files/folders whose name contains `query` (case-insensitive)."""
    query_lower = query.lower()
    results: List[Dict] = []

    for root, dirs, files in os.walk(WORKSPACE_ROOT):
        dirs[:] = [d for d in dirs if d not in IGNORED_DIR_NAMES]
        root_path = Path(root)

        for name in dirs + files:
            if query_lower in name.lower():
                try:
                    results.append(_entry_info(root_path / name))
                except OSError:
                    continue
                if len(results) >= MAX_NAME_SEARCH_RESULTS:
                    return results

    return results


def search_text(query: str, case_sensitive: bool = False) -> List[Dict]:
    """Search for `query` inside text files under the workspace. Skips binaries/big files."""
    if not query:
        return []

    results: List[Dict] = []
    needle = query if case_sensitive else query.lower()

    for root, dirs, files in os.walk(WORKSPACE_ROOT):
        dirs[:] = [d for d in dirs if d not in IGNORED_DIR_NAMES]
        root_path = Path(root)

        for name in files:
            file_path = root_path / name
            try:
                if file_path.stat().st_size > MAX_SEARCH_FILE_SIZE:
                    continue
            except OSError:
                continue

            if _is_binary(file_path):
                continue

            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    for line_no, line in enumerate(f, start=1):
                        haystack = line if case_sensitive else line.lower()
                        col = haystack.find(needle)
                        if col != -1:
                            results.append({
                                "path": to_relative(file_path),
                                "line": line_no,
                                "column": col + 1,
                                "preview": line.strip()[:200],
                            })
                            if len(results) >= MAX_TEXT_SEARCH_RESULTS:
                                return results
            except OSError:
                continue

    return results
