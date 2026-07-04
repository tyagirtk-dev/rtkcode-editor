"""
Configuration for the Termux Code Editor backend.

Every setting here is read once at process startup from environment
variables that are set by the `code` CLI launcher (see bin/code).
"""
import os
import sys
from pathlib import Path

# The folder that is exposed to the editor. Every file operation is
# restricted to this folder (see security.py for the actual enforcement).
_raw_root = os.environ.get("WORKSPACE_ROOT")
if not _raw_root:
    print("ERROR: WORKSPACE_ROOT environment variable is not set.", file=sys.stderr)
    sys.exit(1)

WORKSPACE_ROOT = Path(_raw_root).resolve()

if not WORKSPACE_ROOT.exists() or not WORKSPACE_ROOT.is_dir():
    print(f"ERROR: workspace root does not exist or is not a directory: {WORKSPACE_ROOT}", file=sys.stderr)
    sys.exit(1)

# Optional file (relative to WORKSPACE_ROOT) that the frontend should
# open automatically once it loads. Set when the user ran `code somefile.py`.
OPEN_FILE = os.environ.get("OPEN_FILE", "") or None

HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", "8765"))

# Directories skipped when building the file tree / running text search,
# purely for performance. They can still be reached directly if a path
# inside them is requested explicitly through the API.
IGNORED_DIR_NAMES = {
    ".git", "node_modules", "__pycache__", ".venv", "venv",
    ".mypy_cache", "dist", "build", ".idea", ".gradle",
}

# Files larger than this are skipped by the "search inside files" feature,
# to keep full-text search responsive on large workspaces.
MAX_SEARCH_FILE_SIZE = 2 * 1024 * 1024  # 2 MB

# Absolute ceiling on a single file read/write. Prevents accidentally
# loading something huge (e.g. a mis-clicked video file) into memory.
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB

MAX_TEXT_SEARCH_RESULTS = 500
MAX_NAME_SEARCH_RESULTS = 200

FRONTEND_DIR = Path(__file__).resolve().parent.parent.parent / "frontend"
