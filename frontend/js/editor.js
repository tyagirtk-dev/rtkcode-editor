// editor.js - Monaco Editor integration: model-per-file, language detection,
// find/replace/goto-line (Monaco's built-in commands), autosave, settings.
const Editor = (() => {
  let monacoEditor = null;
  let currentPath = null;
  const models = new Map(); // relative path -> monaco.editor.ITextModel
  let autoSaveEnabled = false;
  let autoSaveTimer = null;
  const AUTOSAVE_DELAY_MS = 1200;

  const LANGUAGE_MAP = {
    js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
    ts: "typescript", tsx: "typescript",
    py: "python", pyw: "python",
    c: "c", h: "c",
    cpp: "cpp", cc: "cpp", cxx: "cpp", hpp: "cpp", hh: "cpp",
    java: "java",
    json: "json",
    md: "markdown", markdown: "markdown",
    yml: "yaml", yaml: "yaml",
    xml: "xml",
    sh: "shell", bash: "shell", zsh: "shell",
    sql: "sql",
    html: "html", htm: "html",
    css: "css",
  };

  function detectLanguage(path) {
    const ext = path.split(".").pop().toLowerCase();
    return LANGUAGE_MAP[ext] || "plaintext";
  }

  function loadMonaco() {
    return new Promise((resolve, reject) => {
      if (typeof require === "undefined" || !require.config) {
        reject(new Error("Monaco loader not found. Did install.sh download the editor bundle?"));
        return;
      }
      require.config({ paths: { vs: "./vendor/monaco-editor/min/vs" } });
      require(["vs/editor/editor.main"], () => resolve(), (err) => reject(err));
    });
  }

  async function init(container) {
    await loadMonaco();

    monacoEditor = monaco.editor.create(container, {
      theme: "vs-dark",
      automaticLayout: true,
      fontSize: Settings.get("fontSize"),
      minimap: { enabled: Settings.get("minimap") },
      wordWrap: Settings.get("wordWrap") ? "on" : "off",
      renderLineHighlight: "all",
      scrollBeyondLastLine: false,
      tabSize: 2,
      cursorBlinking: "smooth",
    });

    monacoEditor.onDidChangeModelContent(() => {
      if (!currentPath) return;
      Tabs.setDirty(currentPath, true);
      updateStatusBar();
      if (autoSaveEnabled) {
        clearTimeout(autoSaveTimer);
        autoSaveTimer = setTimeout(() => saveCurrent(), AUTOSAVE_DELAY_MS);
      }
    });

    monacoEditor.onDidChangeCursorPosition(updateStatusBar);

    return monacoEditor;
  }

  function getOrCreateModel(path, content) {
    if (models.has(path)) return models.get(path);
    const language = detectLanguage(path);
    // A fake but unique URI per file path lets Monaco track separate models correctly.
    const uri = monaco.Uri.from({ scheme: "file", path: "/" + path });
    const model = monaco.editor.createModel(content, language, uri);
    models.set(path, model);
    return model;
  }

  function openFile(path, content) {
    const model = getOrCreateModel(path, content);
    monacoEditor.setModel(model);
    currentPath = path;
    updateStatusBar();
    monacoEditor.focus();
  }

  function getContent(path) {
    const model = models.get(path);
    return model ? model.getValue() : null;
  }

  function closeModel(path) {
    const model = models.get(path);
    if (model) {
      model.dispose();
      models.delete(path);
    }
    if (currentPath === path) currentPath = null;
  }

  async function saveCurrent() {
    if (!currentPath) return;
    const content = getContent(currentPath);
    if (content === null) return;
    try {
      await Api.saveFile(currentPath, content);
      Tabs.setDirty(currentPath, false);
      updateStatusBar();
      Toast.show("Saved " + currentPath);
    } catch (err) {
      Toast.show("Save failed: " + err.message, "error");
    }
  }

  function setAutoSave(enabled) {
    autoSaveEnabled = enabled;
    clearTimeout(autoSaveTimer);
  }

  function applySettings() {
    if (!monacoEditor) return;
    monacoEditor.updateOptions({
      fontSize: Settings.get("fontSize"),
      minimap: { enabled: Settings.get("minimap") },
      wordWrap: Settings.get("wordWrap") ? "on" : "off",
    });
  }

  function goToLine() {
    monacoEditor && monacoEditor.trigger("app", "editor.action.gotoLine");
  }

  function find() {
    monacoEditor && monacoEditor.trigger("app", "actions.find");
  }

  function replace() {
    monacoEditor && monacoEditor.trigger("app", "editor.action.startFindReplaceAction");
  }

  function updateStatusBar() {
    const posEl = document.getElementById("status-position");
    const langEl = document.getElementById("status-language");
    const dirtyEl = document.getElementById("status-dirty");
    if (!monacoEditor || !currentPath) {
      posEl.textContent = "Ln -, Col -";
      langEl.textContent = "plaintext";
      dirtyEl.textContent = "\u2014";
      return;
    }
    const pos = monacoEditor.getPosition();
    posEl.textContent = pos ? `Ln ${pos.lineNumber}, Col ${pos.column}` : "Ln -, Col -";
    langEl.textContent = detectLanguage(currentPath);
    dirtyEl.textContent = Tabs.isDirty(currentPath) ? "Unsaved" : "Saved";
  }

  function focus() {
    monacoEditor && monacoEditor.focus();
  }

  function getCurrentPath() {
    return currentPath;
  }

  return {
    init, openFile, getContent, closeModel, saveCurrent, setAutoSave,
    applySettings, goToLine, find, replace, updateStatusBar, focus,
    detectLanguage, getCurrentPath,
  };
})();
