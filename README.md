# Termux Code Editor

A production-ready, VS Code–like browser-based code editor that runs entirely
inside Termux on Android. No cloud, no Docker, no VS Code dependency.

```
code .
```

...starts a local server and gives you a Monaco-powered IDE for the current
folder, right in your browser. Saves write directly to the real files on
disk — there are never any copies.

---

## Features

- **Real filesystem editing** - open a folder, edit files, save with `Ctrl+S`
  or Auto Save, and the actual file on disk is overwritten immediately.
- **Monaco Editor** (the engine behind VS Code) bundled locally - fully
  offline at runtime, syntax highlighting for HTML, CSS, JS, TS, Python, C,
  C++, Java, JSON, Markdown, YAML, XML, Shell, SQL, and more.
- **File explorer** - expand/collapse, new file/folder, rename, delete,
  refresh, right-click menu (desktop) / long-press menu (mobile), drag & drop.
- **Multiple tabs** with unsaved-change indicators.
- **Find / Replace / Go to line** via Monaco's native commands.
- **Search** - by file name or by text content across the whole workspace.
- **Auto Save** (debounced) or manual save.
- **Mobile-first responsive UI** - the sidebar becomes a slide-in drawer on
  small screens; a dark theme throughout.
- **Directory-traversal-safe API** - every path is validated server-side; the
  browser can never read or write outside the opened workspace.

---

## Requirements

- Termux (Android)
- `python3` (installed automatically by `install.sh` if missing)
- Internet access **only during installation**, to install pip packages and
  download the Monaco Editor bundle. No network is required at runtime.

---

> 🚀 **RTKCode Editor** brings a VS Code–like coding experience to Termux with a modern Monaco Editor interface running directly in your browser. No VNC, no desktop environment, and no complicated setup—just install, run `code .`, and start coding instantly.

## 🎬 Demo

**▶ [Watch RTKCode Demo](assets/rtkcode-demo.mp4)**

### ✨ Highlights

- ⚡ VS Code–style interface powered by Monaco Editor
- 📂 Open any project with `code .`
- 📝 Fast file editing with instant save
- 🌐 Runs locally in your browser
- 📱 Designed for Android + Termux
- 🔒 No cloud account required
- 🚫 No VNC or desktop environment needed
- 📦 One-command installation
- 📥 Automatically downloads and configures Monaco Editor
- 🐍 Automatically creates and manages a Python virtual environment
- 🔄 Safe reinstall and upgrade support
- 🛠 Lightweight, fast and open source
- ❤️ Built for the Termux community

---

## Installation

```bash
git clone https://github.com/tyagirtk-dev/rtkcode-editor.git
cd rtkcode-editor
bash install.sh
```

`install.sh` will:

1. Install required Termux packages automatically.
2. Create and configure a Python virtual environment.
3. Install all Python dependencies.
4. Copy the backend and frontend into `~/.termux-code-editor`.
5. Download and configure Monaco Editor automatically.
6. Install the global `code` command.
7. Verify the installation with built-in health checks.

--
## Usage

```bash
code .                     # open the current directory
code ~/projects/myapp      # open a specific folder
code app.py                # open a single file (workspace = its parent folder)
code templates/index.html  # same, with a relative path
```

Each invocation:

1. Resolves the given path to an absolute, workspace root.
2. Picks a free local port (starting at 8765).
3. Launches the FastAPI backend, restricted to that workspace root.
4. Prints the URL (`http://127.0.0.1:<port>/`) and opens it automatically via
   `termux-open-url` if available.
5. Runs until you press `Ctrl+C`.

You can run multiple `code` sessions at once (each on its own port) for
different projects.

---

## Project structure

```
termux-code-editor/
├── install.sh              One-command installer
├── uninstall.sh            Removes the install + the `code` command
├── requirements.txt        Python dependencies (FastAPI, Uvicorn)
├── README.md
├── bin/
│   └── code                 CLI launcher, installed to $PREFIX/bin/code
├── backend/
│   ├── main.py               FastAPI app entry point (python3 main.py)
│   └── app/
│       ├── config.py         Env-driven settings (workspace root, port, ...)
│       ├── security.py       Directory-traversal protection
│       ├── models.py         Pydantic request schemas
│       ├── file_service.py   All real file operations (read/write/etc.)
│       └── routes.py         REST endpoints, thin HTTP layer
└── frontend/
    ├── index.html
    ├── css/style.css         Dark theme, responsive layout
    ├── js/
    │   ├── settings.js       Persisted preferences (localStorage)
    │   ├── api.js             REST client
    │   ├── toast.js           Notifications
    │   ├── modal.js           Prompt/confirm dialogs
    │   ├── contextmenu.js     Right-click / long-press menu
    │   ├── tabs.js            Open-file tabs
    │   ├── editor.js          Monaco integration
    │   ├── explorer.js        File tree
    │   └── app.js             Bootstrap / wiring / shortcuts
    └── vendor/monaco-editor/  Downloaded by install.sh (not in source control)
```

---

## REST API

All endpoints are rooted at `/api` and take/return **workspace-relative**
paths (never absolute paths) - the backend resolves and validates them
against the workspace root on every request.

| Method | Path            | Body / Query                          | Description                          |
|--------|-----------------|----------------------------------------|---------------------------------------|
| GET    | `/api/workspace`| -                                       | Workspace name + auto-open file       |
| GET    | `/api/tree`     | `?path=`                               | Immediate children of a folder        |
| GET    | `/api/file`     | `?path=`                               | Read a file's content                 |
| POST   | `/api/save`     | `{path, content}`                      | Overwrite a file (the real save)      |
| POST   | `/api/new-file` | `{path}`                               | Create an empty file                  |
| POST   | `/api/new-folder`| `{path}`                              | Create a folder                       |
| POST   | `/api/delete`   | `{path}`                               | Delete a file or folder               |
| POST   | `/api/rename`   | `{old_path, new_path}`                 | Rename or move                        |
| GET    | `/api/search`   | `?q=&mode=files\|text`                 | Search file names or file contents    |
| GET    | `/api/health`   | -                                       | Liveness check                        |

---

## Security

- Every relative path from the browser is resolved via
  `security.resolve_safe_path()`, which rejects anything that resolves
  outside the workspace root (blocks `../../etc/passwd`-style traversal,
  absolute-path injection, and null-byte tricks).
- The workspace root itself cannot be deleted.
- The server binds to `127.0.0.1` only - it is not reachable from the
  network, only from the device itself.
- CORS is restricted to the exact origin the server is running on.

---

## Notes on saving

`POST /api/save` writes to a temporary sibling file and then does an atomic
`os.replace()` onto the target. This guarantees the real project file is
never left half-written if the app is killed mid-save, while still
resulting in exactly one file on disk - **no `.bak` files, no copies.**
