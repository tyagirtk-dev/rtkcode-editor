// modal.js - small promise-based modal for text input / confirmation.
// Used instead of native prompt()/confirm() because those are unreliable
// inside some Android WebViews and don't fit the app's dark theme.
const Modal = (() => {
  const overlay = document.getElementById("modal-overlay");
  const titleEl = document.getElementById("modal-title");
  const messageEl = document.getElementById("modal-message");
  const inputEl = document.getElementById("modal-input");
  const confirmBtn = document.getElementById("modal-confirm");
  const cancelBtn = document.getElementById("modal-cancel");

  let resolver = null;
  let isPromptMode = true;

  function close(result) {
    overlay.classList.remove("visible");
    if (resolver) resolver(result);
    resolver = null;
  }

  confirmBtn.addEventListener("click", () => close(isPromptMode ? inputEl.value : true));
  cancelBtn.addEventListener("click", () => close(null));
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close(null);
  });
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") close(inputEl.value);
    if (e.key === "Escape") close(null);
  });

  function prompt(title, defaultValue = "", message = "") {
    isPromptMode = true;
    titleEl.textContent = title;
    messageEl.textContent = message;
    messageEl.style.display = message ? "block" : "none";
    inputEl.style.display = "block";
    inputEl.value = defaultValue;
    confirmBtn.textContent = "OK";
    overlay.classList.add("visible");
    setTimeout(() => {
      inputEl.focus();
      inputEl.select();
    }, 30);
    return new Promise((resolve) => {
      resolver = resolve;
    });
  }

  function confirmDialog(title, message = "") {
    isPromptMode = false;
    titleEl.textContent = title;
    messageEl.textContent = message;
    messageEl.style.display = message ? "block" : "none";
    inputEl.style.display = "none";
    confirmBtn.textContent = "Confirm";
    overlay.classList.add("visible");
    return new Promise((resolve) => {
      resolver = resolve;
    });
  }

  return { prompt, confirm: confirmDialog };
})();
