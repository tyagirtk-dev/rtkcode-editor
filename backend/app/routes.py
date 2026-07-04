"""
API routes. Thin wrappers around file_service - keeps HTTP concerns
(status codes, request/response shapes) separate from filesystem logic.
"""
from fastapi import APIRouter, Query

from . import file_service
from .models import SaveFileRequest, NewFileRequest, NewFolderRequest, DeleteRequest, RenameRequest
from .config import WORKSPACE_ROOT, OPEN_FILE

router = APIRouter(prefix="/api")


@router.get("/workspace")
def get_workspace():
    """Info the frontend needs on startup: workspace name and which file (if any) to auto-open."""
    return {
        "name": WORKSPACE_ROOT.name or str(WORKSPACE_ROOT),
        "root": str(WORKSPACE_ROOT),
        "open_file": OPEN_FILE,
    }


@router.get("/tree")
def get_tree(path: str = ""):
    """Immediate children of a folder (lazy-loaded tree)."""
    return file_service.list_children(path)


@router.get("/file")
def get_file(path: str):
    return file_service.read_file(path)


@router.post("/save")
def save_file(body: SaveFileRequest):
    return file_service.write_file(body.path, body.content)


@router.post("/new-file")
def new_file(body: NewFileRequest):
    return file_service.create_file(body.path)


@router.post("/new-folder")
def new_folder(body: NewFolderRequest):
    return file_service.create_folder(body.path)


@router.post("/delete")
def delete(body: DeleteRequest):
    file_service.delete_path(body.path)
    return {"deleted": body.path}


@router.post("/rename")
def rename(body: RenameRequest):
    return file_service.rename_path(body.old_path, body.new_path)


@router.get("/search")
def search(q: str = Query(..., min_length=1), mode: str = Query("files", pattern="^(files|text)$")):
    if mode == "text":
        return {"mode": "text", "results": file_service.search_text(q)}
    return {"mode": "files", "results": file_service.search_names(q)}


@router.get("/health")
def health():
    return {"status": "ok"}
