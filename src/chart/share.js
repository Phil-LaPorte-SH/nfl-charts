import { svgToPngBlob } from './export.js'
import { bytesToBase64 } from './fonts.js'
import { ASPECT_SIZES } from './layout.js'

// Publishing goes through the local dev server (git push to the shares repo),
// so it only exists in dev builds.
let statusPromise = null
export function getShareStatus() {
  if (!import.meta.env.DEV) return Promise.resolve({ available: false })
  if (!statusPromise) {
    statusPromise = fetch('/__share/status').then((r) => (r.ok ? r.json() : { available: false })).catch(() => ({ available: false }))
  }
  return statusPromise
}

export async function publishShare({ svgEl, spec, result }) {
  const scale = spec.aspect === 'story' ? 1.5 : 2
  const blob = await svgToPngBlob(svgEl, scale)
  const png = bytesToBase64(new Uint8Array(await blob.arrayBuffer()))
  const [w, h] = ASPECT_SIZES[spec.aspect] || ASPECT_SIZES.portrait
  const res = await fetch('/__share/publish', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      title: spec.title, subtitle: spec.subtitle, caption: spec.caption, footnote: spec.footnote, source: spec.source,
      sql: result?.sql ? [result.sql] : [], png, width: Math.round(w * scale), height: Math.round(h * scale),
    }),
  })
  const out = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
  if (!res.ok || out.error) throw new Error(out.error || `HTTP ${res.status}`)
  return out
}

/** Resolve true once GitHub Pages serves the file (usually 30-90 s after push). */
export async function waitUntilLive(url, { signal, timeoutMs = 240000 } = {}) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    if (signal?.aborted) return false
    try {
      const r = await fetch(`${url}?t=${Date.now()}`, { method: 'HEAD', cache: 'no-store' })
      if (r.ok) return true
    } catch { /* not yet */ }
    await new Promise((r) => setTimeout(r, 5000))
  }
  return false
}
