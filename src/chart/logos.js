import { dataUrl } from '../config.js'

// Team logos as data URLs. An SVG rendered through <img> (the PNG export path)
// never fetches external resources, and cross-origin images taint the canvas,
// so logos must be inlined.
const mem = new Map()
const CACHE = 'nfl-logos-v1'

async function blobToDataUrl(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result)
    r.onerror = rej
    r.readAsDataURL(blob)
  })
}

async function load(abbr) {
  const url = dataUrl(`logos/${abbr}.png`)
  let cache = null
  try { cache = await caches.open(CACHE) } catch { /* storage unavailable */ }
  let res = cache && (await cache.match(url).catch(() => null))
  if (!res) {
    res = await fetch(url)
    if (!res.ok) throw new Error(`logo ${abbr}: HTTP ${res.status}`)
    if (cache) cache.put(url, res.clone()).catch(() => {})
  }
  return blobToDataUrl(await res.blob())
}

export function getLogo(abbr) {
  if (!abbr) return Promise.resolve(null)
  if (!mem.has(abbr)) mem.set(abbr, load(abbr).catch(() => null))
  return mem.get(abbr)
}

/** Resolve {abbr: dataUrl|null} for a list of teams. */
export async function preloadLogos(abbrs) {
  const uniq = [...new Set(abbrs.filter(Boolean))]
  const urls = await Promise.all(uniq.map(getLogo))
  return Object.fromEntries(uniq.map((a, i) => [a, urls[i]]))
}
