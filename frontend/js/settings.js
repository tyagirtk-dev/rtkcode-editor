// settings.js - persisted editor preferences (localStorage).
const Settings = (() => {
  const KEY = "termux-code-editor:settings";
  const defaults = { fontSize: 14, minimap: true, wordWrap: false, autoSave: false };

  function load() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || {};
    } catch (_) {
      return {};
    }
  }

  const state = { ...defaults, ...load() };

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (_) {
      // localStorage may be unavailable in some contexts - fail silently, settings just won't persist.
    }
  }

  function get(key) {
    return state[key];
  }

  function set(key, value) {
    state[key] = value;
    save();
  }

  return { get, set };
})();
