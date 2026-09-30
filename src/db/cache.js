// Cache Storage for whole-file ("buffer") datasets. GitHub Pages sends
// max-age=600 and browsers rarely reuse 206 responses, so the HTTP cache alone
// would re-download the stats tables on most visits.
const CACHE = 'nfl-data-v1'

async function openCache() {
  try {
    return await caches.open(CACHE)
  } catch {
    return null // private window, blocked storage, insecure context
  }
}

/** Fetch bytes for url, keyed by a content version so updates invalidate. */
export async function fetchCached(url, version) {
  const key = `${url}?v=${version}`
  const cache = await openCache()
  if (cache) {
    const hit = await cache.match(key).catch(() => null)
    if (hit) return new Uint8Array(await hit.arrayBuffer())
  }
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  const buf = await res.arrayBuffer()
  if (cache) {
    cache.put(key, new Response(buf.slice(0), { headers: { 'content-type': 'application/octet-stream' } })).catch(() => {})
    // drop older versions of this file
    cache.keys().then((keys) => {
      for (const k of keys) if (k.url.startsWith(url + '?v=') && k.url !== new URL(key, location.href).href) cache.delete(k)
    }).catch(() => {})
  }
  return new Uint8Array(buf)
}

export async function clearDataCache() {
  try { await caches.delete(CACHE) } catch { /* ignore */ }
}
