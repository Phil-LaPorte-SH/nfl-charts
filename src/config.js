// Where the parquet mirror lives. Resolved to an absolute URL because DuckDB
// fetches from inside a Web Worker, where relative URLs resolve differently.
const override = (() => {
  try { return localStorage.getItem('nfl.dataBase') } catch { return null }
})()

export const DATA_BASE = new URL(
  (override || import.meta.env.VITE_DATA_BASE_URL || '/data').replace(/\/$/, '') + '/',
  window.location.href,
).href

export const dataUrl = (path) => new URL(path, DATA_BASE).href
