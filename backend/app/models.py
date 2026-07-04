"""Request body schemas for the write-operation endpoints."""
from pydantic import BaseModel


class SaveFileRequest(BaseModel):
    path: str
    content: str


class NewFileRequest(BaseModel):
    path: str


class NewFolderRequest(BaseModel):
    path: str


class DeleteRequest(BaseModel):
    path: str


class RenameRequest(BaseModel):
    old_path: str
    new_path: str
