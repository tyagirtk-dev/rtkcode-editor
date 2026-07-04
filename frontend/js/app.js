// app.js - application bootstrap: wires explorer, tabs and editor together,
// and handles toolbar buttons, keyboard shortcuts, settings and search panels.
(async function main() {
  const openContentCache = new Map(); // path -> content, used only for the first open

  const editorContainer = document.getElementById("editor-container");
  try {
    await Editor.init(editorContainer);
  } catch (err) {
    Toast.show("Editor failed to load: " + err.message, "error");
    return;
  }
  Editor.setAutoSave(Settings.get("autoSave"));

  Tabs.init(
    (path) => {
      // onActivate
      const cached = openContentCache.get(path);
      Editor.openFile(path, cached ?? "");
      updateBreadcrumb(path);
    },
    (path) => {
      // onClose
      openContentCache.delete(path);
      Editor.closeModel(path);
      if (!Tabs.getActive()) updateBreadcrumb(null);
    }
  );

  async function openFile(path) {
    if (Tabs.has(path)) {
      Tabs.activate(path);
      return;
    }
    try {
      const data = await Api.getFile(path);
      openContentCache.set(path, data.content);
      Tabs.add(path);
      Tabs.activate(path);
    } catch (err) {
      Toast.show("Cannot open file: " + err.message, "error");
    }
  }

  Explorer.init(openFile);

  // --- Workspace info / title / initial file ---
  try {
    const ws = await Api.getWorkspace();
    document.getElementById("workspace-name").textContent = ws.name;
    document.title = `${ws.name} \u2014 Termux Code Editor`;
    if (ws.open_file) await openFile(ws.open_file);
  } catch (err) {
    Toast.show("Failed to load workspace: " + err.message, "error");
  }

  // --- Breadcrumb ---
  function updateBreadcrumb(path) {
    const el = document.getElementById("breadcrumb");
    el.innerHTML = "";
    if (!path) {
      el.textContent = "No file open";
      return;
    }
    const parts = path.split("/");
    parts.forEach((part, i) => {
      const span = document.createElement("span");
      span.className = "breadcrumb-part";
      span.textContent = part;
      el.appendChild(span);
      if (i < parts.length - 1) {
        const sep = document.createElement("span");
        sep.className = "breadcrumb-sep";
        sep.textContent = "\u203a";
        el.appendChild(sep);
      }
    });
  }

  // --- Toolbar buttons ---
  document.getElementById("btn-save").addEventListener("click", () => Editor.saveCurrent());
  document.getElementById("btn-find").addEventListener("click", () => Editor.find());
  document.getElementById("btn-replace").addEventListener("click", () => Editor.replace());
  document.getElementById("btn-goto-line").addEventListener("click", () => Editor.goToLine());

  document.getElementById("btn-toggle-sidebar").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("open");
  });

  // --- Settings panel ---
  const settingsPanel = document.getElementById("settings-panel");
  document.getElementById("btn-settings").addEventListener("click", () => {
    document.getElementById("search-panel").classList.remove("open");
    settingsPanel.classList.toggle("open");
  });

  const fontSizeInput = document.getElementById("setting-font-size");
  const minimapInput = document.getElementById("setting-minimap");
  const wordWrapInput = document.getElementById("setting-wordwrap");
  const autoSaveInput = document.getElementById("setting-autosave");

  fontSizeInput.value = Settings.get("fontSize");
  minimapInput.checked = Settings.get("minimap");
  wordWrapInput.checked = Settings.get("wordWrap");
  autoSaveInput.checked = Settings.get("autoSave");

  fontSizeInput.addEventListener("input", () => {
    const size = parseInt(fontSizeInput.value, 10) || 14;
    Settings.set("fontSize", size);
    Editor.applySettings();
  });
  minimapInput.addEventListener("change", () => {
    Settings.set("minimap", minimapInput.checked);
    Editor.applySettings();
  });
  wordWrapInput.addEventListener("change", () => {
    Settings.set("wordWrap", wordWrapInput.checked);
    Editor.applySettings();
  });
  autoSaveInput.addEventListener("change", () => {
    Settings.set("autoSave", autoSaveInput.checked);
    Editor.setAutoSave(autoSaveInput.checked);
  });

  // --- Search panel ---
  const searchPanel = document.getElementById("search-panel");
  document.getElementById("btn-search").addEventListener("click", () => {
    settingsPanel.classList.remove("open");
    searchPanel.classList.toggle("open");
    if (searchPanel.classList.contains("open")) document.getElementById("search-input").focus();
  });

  document.getElementById("search-input").addEventListener("keydown", async (e) => {
    if (e.key !== "Enter") return;
    const q = e.target.value.trim();
    if (!q) return;
    const mode = document.getElementById("search-mode").value;
    const resultsEl = document.getElementById("search-results");
    resultsEl.innerHTML = "<div class='search-loading'>Searching\u2026</div>";
    try {
      const { results } = await Api.search(q, mode);
      renderSearchResults(results, mode, resultsEl);
    } catch (err) {
      resultsEl.innerHTML = `<div class="search-error"></div>`;
      resultsEl.querySelector(".search-error").textContent = err.message;
    }
  });

  function renderSearchResults(results, mode, container) {
    container.innerHTML = "";
    if (!results.length) {
      container.innerHTML = "<div class='search-empty'>No results</div>";
      return;
    }
    results.forEach((r) => {
      const row = document.createElement("div");
      row.className = "search-result";
      if (mode === "text") {
        const pathLine = document.createElement("div");
        pathLine.className = "search-result-path";
        pathLine.textContent = `${r.path}:${r.line}`;
        const preview = document.createElement("div");
        preview.className = "search-result-preview";
        preview.textContent = r.preview;
        row.appendChild(pathLine);
        row.appendChild(preview);
        row.addEventListener("click", () => openFile(r.path));
      } else {
        row.textContent = r.path;
        row.addEventListener("click", () => {
          if (r.type === "file") openFile(r.path);
        });
      }
      container.appendChild(row);
    });
  }

  // --- Keyboard shortcuts ---
  window.addEventListener("keydown", (e) => {
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key.toLowerCase() === "s") {
      e.preventDefault();
      Editor.saveCurrent();
    }
  });

  // Warn before leaving with unsaved changes.
  window.addEventListener("beforeunload", (e) => {
    const anyDirty = Tabs.all().some((p) => Tabs.isDirty(p));
    if (anyDirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
})();
