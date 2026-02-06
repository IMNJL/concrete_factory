// Public runtime config for static hosting (GitHub Pages, etc.)
// This file is SAFE to commit (no secrets). It can be overwritten during CI build.
window.__APP_CONFIG__ = window.__APP_CONFIG__ || {
  // Example: "https://your-backend.example.com"
  // IMPORTANT:
  // - This must be the BACKEND base URL (where your Node server is deployed), not the GitHub Pages URL.
  // - Empty string means same-origin (works when you open the site via the Node server).
  apiBaseUrl: ''
};
