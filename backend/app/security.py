"""
Path safety helpers.

Every path that comes from the browser is a *relative* path (relative to
WORKSPACE_ROOT). This module is the single place where relative paths are
turned into real filesystem paths, and is responsible for rejecting any
path that would escape the workspace (directory traversal protection).
"""
from pathlib import Path
from fastapi import HTTPException

from .config import WORKSPACE_ROOT

_ROOT_RESOLVED = WORKSPACE_ROOT.resolve()


class PathSecurityError(HTTPException):
    def __init__(self, detail: str = "Access outside the workspace is not allowed"):
        super().__init__(status_code=403, detail=detail)


def resolve_safe_path(relative_path: str) -> Path:
    """
    Convert a relative path (as sent by the frontend) into an absolute path
    guaranteed to live inside WORKSPACE_ROOT.

    Rejects:
      - absolute paths supplied by the client (they are stripped, not honoured)
      - '..' traversal that would climb out of the workspace
      - any resolved path that does not sit under WORKSPACE_ROOT
    """
    if relative_path is None:
        relative_path = ""

    # Normalise separators and strip leading slashes so the client can never
    # supply an absolute path that bypasses the workspace join below.
    cleaned = relative_path.replace("\\", "/").strip()
    while cleaned.startswith("/"):
        cleaned = cleaned[1:]

    if "\x00" in cleaned:
        raise PathSecurityError("Invalid path")

    candidate = (WORKSPACE_ROOT / cleaned).resolve()

    try:
        candidate.relative_to(_ROOT_RESOLVED)
    except ValueError:
        raise PathSecurityError(f"Path escapes workspace: {relative_path}")

    return candidate


def to_relative(path: Path) -> str:
    """Convert an absolute path back into a workspace-relative string (for API responses)."""
    return str(path.resolve().relative_to(_ROOT_RESOLVED)).replace("\\", "/")
