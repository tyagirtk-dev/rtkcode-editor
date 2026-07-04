"""
Entry point for the Termux Code Editor backend.

Run directly:  python3 main.py

Environment variables (set by the `code` CLI launcher, see bin/code):
  WORKSPACE_ROOT  - absolute path to the folder being edited (required)
  OPEN_FILE       - relative path of a file to auto-open on load (optional)
  HOST            - bind address (default 127.0.0.1)
  PORT            - bind port (default 8765)
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import HOST, PORT, FRONTEND_DIR
from app.routes import router

app = FastAPI(title="Termux Code Editor", docs_url=None, redoc_url=None)

# Only the local device ever talks to this server, but keep CORS explicit and narrow.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[f"http://127.0.0.1:{PORT}", f"http://localhost:{PORT}"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes must be registered before the catch-all static file mount below,
# otherwise StaticFiles would swallow requests to /api/*.
app.include_router(router)

# Serve the frontend (index.html, css, js, and the bundled Monaco editor).
app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=HOST, port=PORT, log_level="warning")
