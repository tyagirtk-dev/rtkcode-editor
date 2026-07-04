// toast.js - tiny transient notification banner in the bottom-right corner.
const Toast = (() => {
  const container = document.getElementById("toast-container");

  function show(message, type = "info") {
    const el = document.createElement("div");
    el.className = "toast toast-" + type;
    el.textContent = message;
    container.appendChild(el);

    requestAnimationFrame(() => el.classList.add("visible"));

    setTimeout(() => {
      el.classList.remove("visible");
      setTimeout(() => el.remove(), 300);
    }, 3000);
  }

  return { show };
})();
