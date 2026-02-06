// Public runtime config for static hosting (GitHub Pages, etc.)
// This file is SAFE to commit (no secrets). It can be overwritten during CI build.
(() => {
  const host = (window && window.location && window.location.hostname) ? String(window.location.hostname) : ''

  // Default behavior:
  // - Local dev (localhost): same-origin (empty base)
  // - Render backend serving the site: same-origin (empty base)
  // - GitHub Pages: use deployed backend URL
  const defaultApiBaseUrl = (() => {
    const h = host.toLowerCase()
    if (h === 'localhost' || h === '127.0.0.1') return ''
    if (h.endsWith('onrender.com')) return ''
    if (h.endsWith('github.io')) return 'https://concrete-factory.onrender.com'
    return ''
  })()

  const existing = (window && window.__APP_CONFIG__ && typeof window.__APP_CONFIG__ === 'object') ? window.__APP_CONFIG__ : {}
  const existingApiBaseUrl = (existing && typeof existing.apiBaseUrl === 'string')
    ? String(existing.apiBaseUrl).trim().replace(/\/+$/, '')
    : ''

  window.__APP_CONFIG__ = {
    ...existing,
    // Example: "https://your-backend.example.com"
    // IMPORTANT:
    // - This must be the BACKEND base URL (where your Node server is deployed), not the GitHub Pages URL.
    // - Empty string means same-origin.
    apiBaseUrl: existingApiBaseUrl || defaultApiBaseUrl
  }
})()
