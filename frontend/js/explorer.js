// explorer.js - file tree: lazy loading, expand/collapse, context menu,
// new/rename/delete, long-press support for mobile, drag & drop for desktop.
const Explorer = (() => {
  const treeEl = document.getElementById("explorer-tree");
  let onOpenFile = () => {};

  function init(openFileCallback) {
    onOpenFile = openFileCallback;
    refresh();

    document.getElementById("btn-new-file").addEventListener("click", () => createEntry("file", ""));
    document.getElementById("btn-new-folder").addEventListener("click", () => createEntry("folder", ""));
    document.getElementById("btn-refresh").addEventListener("click", refresh);
    document.getElementById("btn-collapse-all").addEventListener("click", collapseAll);
  }

  async function refresh() {
    treeEl.innerHTML = "";
    const rootUl = document.createElement("ul");
    rootUl.className = "tree-root";
    rootUl.dataset.path = "";
    treeEl.appendChild(rootUl);
    await loadChildren(rootUl, "");
  }

  function collapseAll() {
    treeEl.querySelectorAll("li.folder.expanded").forEach((li) => li.classList.remove("expanded"));
  }

  async function loadChildren(ul, path) {
    ul.innerHTML = "";
    let entries;
    try {
      entries = await Api.getTree(path);
    } catch (err) {
      Toast.show("Failed to load folder: " + err.message, "error");
      return;
    }
    entries.forEach((entry) => ul.appendChild(renderEntry(entry)));
  }

  function renderEntry(entry) {
    const li = document.createElement("li");
    li.className = entry.type === "folder" ? "folder" : "file";
    li.dataset.path = entry.path;
    li.dataset.type = entry.type;

    const row = document.createElement("div");
    row.className = "tree-row";
    row.draggable = true;

    const icon = document.createElement("span");
    icon.className = "tree-icon " + iconClassFor(entry);
    row.appendChild(icon);

    const label = document.createElement("span");
    label.className = "tree-label";
    label.textContent = entry.name;
    row.appendChild(label);

    li.appendChild(row);

    if (entry.type === "folder") {
      const childrenUl = document.createElement("ul");
      childrenUl.className = "tree-children";
      li.appendChild(childrenUl);

      row.addEventListener("click", async () => {
        const expanded = li.classList.contains("expanded");
        li.classList.toggle("expanded", !expanded);
        if (!expanded && !li.dataset.loaded) {
          li.dataset.loaded = "1";
          await loadChildren(childrenUl, entry.path);
        }
      });
    } else {
      row.addEventListener("click", () => {
        onOpenFile(entry.path);
        // Close the mobile drawer once a file is picked, for a native-app feel.
        if (window.innerWidth <= 768) {
          document.getElementById("sidebar").classList.remove("open");
        }
      });
    }

    attachContextMenu(row, entry);
    attachDragAndDrop(row, entry);
    return li;
  }

  function iconClassFor(entry) {
    if (entry.type === "folder") return "icon-folder";
    const ext = entry.name.includes(".") ? entry.name.split(".").pop().toLowerCase() : "";
    const map = {
      js: "icon-js", jsx: "icon-js", mjs: "icon-js", cjs: "icon-js",
      ts: "icon-ts", tsx: "icon-ts",
      py: "icon-py",
      html: "icon-html", htm: "icon-html",
      css: "icon-css",
      json: "icon-json",
      md: "icon-md", markdown: "icon-md",
      java: "icon-java",
      c: "icon-c", h: "icon-c",
      cpp: "icon-cpp", cc: "icon-cpp", cxx: "icon-cpp", hpp: "icon-cpp",
      yml: "icon-yaml", yaml: "icon-yaml",
      xml: "icon-xml",
      sh: "icon-sh", bash: "icon-sh",
      sql: "icon-sql",
    };
    return map[ext] || "icon-file";
  }

  function attachContextMenu(row, entry) {
    row.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      showMenu(e.clientX, e.clientY, entry);
    });

    // Long-press for touch devices (right-click doesn't exist there).
    let pressTimer = null;
    let moved = false;
    row.addEventListener("touchstart", (e) => {
      moved = false;
      const touch = e.touches[0];
      pressTimer = setTimeout(() => {
        if (!moved) showMenu(touch.clientX, touch.clientY, entry);
      }, 500);
    });
    row.addEventListener("touchmove", () => {
      moved = true;
      clearTimeout(pressTimer);
    });
    row.addEventListener("touchend", () => clearTimeout(pressTimer));
  }

  function showMenu(x, y, entry) {
    const items = [];
    if (entry.type === "folder") {
      items.push({ label: "New File", onClick: () => createEntry("file", entry.path) });
      items.push({ label: "New Folder", onClick: () => createEntry("folder", entry.path) });
      items.push({ separator: true });
    }
    items.push({ label: "Rename", onClick: () => renameEntry(entry) });
    items.push({ label: "Delete", danger: true, onClick: () => deleteEntry(entry) });
    ContextMenu.show(x, y, items);
  }

  async function createEntry(type, parentPath) {
    const name = await Modal.prompt(
      type === "file" ? "New File" : "New Folder",
      "",
      parentPath ? `Inside: /${parentPath}` : "Inside: / (workspace root)"
    );
    if (!name) return;
    const fullPath = parentPath ? `${parentPath}/${name}` : name;
    try {
      if (type === "file") {
        await Api.newFile(fullPath);
      } else {
        await Api.newFolder(fullPath);
      }
      await refresh();
      if (type === "file") onOpenFile(fullPath);
      Toast.show(`Created ${fullPath}`);
    } catch (err) {
      Toast.show("Error: " + err.message, "error");
    }
  }

  async function renameEntry(entry) {
    const newName = await Modal.prompt("Rename", entry.name);
    if (!newName || newName === entry.name) return;
    const parts = entry.path.split("/");
    parts[parts.length - 1] = newName;
    const newPath = parts.join("/");
    try {
      await Api.rename(entry.path, newPath);
      await refresh();
      Tabs.handleRename(entry.path, newPath);
      Toast.show(`Renamed to ${newName}`);
    } catch (err) {
      Toast.show("Error: " + err.message, "error");
    }
  }

  async function deleteEntry(entry) {
    const ok = await Modal.confirm("Delete", `Delete "${entry.path}"? This cannot be undone.`);
    if (!ok) return;
    try {
      await Api.deletePath(entry.path);
      await refresh();
      Tabs.handleDelete(entry.path);
      Toast.show(`Deleted ${entry.path}`);
    } catch (err) {
      Toast.show("Error: " + err.message, "error");
    }
  }

  function attachDragAndDrop(row, entry) {
    row.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", entry.path);
    });

    if (entry.type === "folder") {
      row.addEventListener("dragover", (e) => {
        e.preventDefault();
        row.style.background = "var(--bg-active)";
      });
      row.addEventListener("dragleave", () => {
        row.style.background = "";
      });
      row.addEventListener("drop", async (e) => {
        e.preventDefault();
        row.style.background = "";
        const sourcePath = e.dataTransfer.getData("text/plain");
        if (!sourcePath || sourcePath === entry.path) return;
        if (entry.path.startsWith(sourcePath + "/")) {
          Toast.show("Cannot move a folder into itself", "error");
          return;
        }
        const name = sourcePath.split("/").pop();
        const destPath = entry.path ? `${entry.path}/${name}` : name;
        try {
          await Api.rename(sourcePath, destPath);
          await refresh();
          Tabs.handleRename(sourcePath, destPath);
        } catch (err) {
          Toast.show("Move failed: " + err.message, "error");
        }
      });
    }
  }

  return { init, refresh };
})();
