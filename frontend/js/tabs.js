// tabs.js - open file tabs: unsaved indicator, switching, closing, rename/delete sync.
const Tabs = (() => {
  const tabsBar = document.getElementById("tabs-bar");
  const tabs = new Map(); // path -> { el, dirty }
  let activePath = null;
  let onActivate = () => {};
  let onClose = () => {};

  function init(activateCallback, closeCallback) {
    onActivate = activateCallback;
    onClose = closeCallback;
  }

  function has(path) {
    return tabs.has(path);
  }

  function add(path) {
    if (tabs.has(path)) return;

    const el = document.createElement("div");
    el.className = "tab";
    el.dataset.path = path;

    const label = document.createElement("span");
    label.className = "tab-label";
    label.textContent = path.split("/").pop();
    el.appendChild(label);

    const dirtyDot = document.createElement("span");
    dirtyDot.className = "tab-dirty";
    el.appendChild(dirtyDot);

    const closeBtn = document.createElement("span");
    closeBtn.className = "tab-close";
    closeBtn.textContent = "\u00d7";
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      close(el.dataset.path);
    });
    el.appendChild(closeBtn);

    el.addEventListener("click", () => activate(el.dataset.path));

    tabsBar.appendChild(el);
    tabs.set(path, { el, dirty: false });
  }

  function activate(path) {
    if (!tabs.has(path)) return;
    activePath = path;
    tabs.forEach((t, p) => t.el.classList.toggle("active", p === path));
    tabs.get(path).el.scrollIntoView({ inline: "nearest", block: "nearest" });
    onActivate(path);
  }

  function setDirty(path, dirty) {
    const t = tabs.get(path);
    if (!t) return;
    t.dirty = dirty;
    t.el.classList.toggle("dirty", dirty);
  }

  function isDirty(path) {
    const t = tabs.get(path);
    return t ? t.dirty : false;
  }

  async function close(path) {
    const t = tabs.get(path);
    if (!t) return;

    if (t.dirty) {
      const ok = await Modal.confirm("Unsaved changes", `"${path}" has unsaved changes. Close anyway?`);
      if (!ok) return;
    }

    t.el.remove();
    tabs.delete(path);
    onClose(path);

    if (activePath === path) {
      activePath = null;
      const remaining = Array.from(tabs.keys());
      if (remaining.length) activate(remaining[remaining.length - 1]);
    }
  }

  function handleRename(oldPath, newPath) {
    if (!tabs.has(oldPath)) return;
    const t = tabs.get(oldPath);
    tabs.delete(oldPath);
    t.el.dataset.path = newPath;
    t.el.querySelector(".tab-label").textContent = newPath.split("/").pop();
    tabs.set(newPath, t);
    if (activePath === oldPath) activePath = newPath;
  }

  function handleDelete(path) {
    // The file/folder is already gone from disk, so force-close without the
    // "unsaved changes" confirmation - there is nothing left to save.
    Array.from(tabs.keys())
      .filter((p) => p === path || p.startsWith(path + "/"))
      .forEach((p) => {
        const t = tabs.get(p);
        if (!t) return;
        t.el.remove();
        tabs.delete(p);
        onClose(p);
        if (activePath === p) {
          activePath = null;
          const remaining = Array.from(tabs.keys());
          if (remaining.length) activate(remaining[remaining.length - 1]);
        }
      });
  }

  function getActive() {
    return activePath;
  }

  function all() {
    return Array.from(tabs.keys());
  }

  return { init, add, has, activate, setDirty, isDirty, close, handleRename, handleDelete, getActive, all };
})();
