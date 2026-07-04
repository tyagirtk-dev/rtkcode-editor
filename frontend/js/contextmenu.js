// contextmenu.js - a single reusable context menu, positioned at the
// click point (desktop right-click) or long-press point (mobile).
const ContextMenu = (() => {
  const el = document.getElementById("context-menu");

  function hide() {
    el.classList.remove("visible");
    el.innerHTML = "";
  }

  function show(x, y, items) {
    el.innerHTML = "";
    items.forEach((item) => {
      if (item.separator) {
        const sep = document.createElement("div");
        sep.className = "context-menu-separator";
        el.appendChild(sep);
        return;
      }
      const row = document.createElement("div");
      row.className = "context-menu-item" + (item.danger ? " danger" : "");
      row.textContent = item.label;
      row.addEventListener("click", () => {
        hide();
        item.onClick();
      });
      el.appendChild(row);
    });

    // Render off-screen first so we can measure it, then clamp inside viewport.
    el.style.left = "-9999px";
    el.style.top = "-9999px";
    el.classList.add("visible");

    const rect = el.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width - 4;
    const maxY = window.innerHeight - rect.height - 4;
    el.style.left = Math.max(4, Math.min(x, maxX)) + "px";
    el.style.top = Math.max(4, Math.min(y, maxY)) + "px";
  }

  document.addEventListener("click", (e) => {
    if (!el.contains(e.target)) hide();
  });
  document.addEventListener("scroll", hide, true);

  return { show, hide };
})();
