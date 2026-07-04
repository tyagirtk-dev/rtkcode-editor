// api.js - thin wrapper around the backend REST API.
const API_BASE = "/api";

async function apiRequest(path, options = {}) {
  const res = await fetch(API_BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const data = await res.json();
      detail = data.detail || detail;
    } catch (_) {
      /* response body wasn't JSON - keep statusText */
    }
    throw new Error(`${res.status}: ${detail}`);
  }

  const contentType = res.headers.get("content-type") || "";
  return contentType.includes("application/json") ? res.json() : res.text();
}

const Api = {
  getWorkspace: () => apiRequest("/workspace"),
  getTree: (path = "") => apiRequest(`/tree?path=${encodeURIComponent(path)}`),
  getFile: (path) => apiRequest(`/file?path=${encodeURIComponent(path)}`),
  saveFile: (path, content) =>
    apiRequest("/save", { method: "POST", body: JSON.stringify({ path, content }) }),
  newFile: (path) =>
    apiRequest("/new-file", { method: "POST", body: JSON.stringify({ path }) }),
  newFolder: (path) =>
    apiRequest("/new-folder", { method: "POST", body: JSON.stringify({ path }) }),
  deletePath: (path) =>
    apiRequest("/delete", { method: "POST", body: JSON.stringify({ path }) }),
  rename: (old_path, new_path) =>
    apiRequest("/rename", { method: "POST", body: JSON.stringify({ old_path, new_path }) }),
  search: (q, mode = "files") =>
    apiRequest(`/search?q=${encodeURIComponent(q)}&mode=${encodeURIComponent(mode)}`),
};
