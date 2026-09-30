import { fontFaceCss } from './fonts.js'

/** Serialize a poster <svg> to a standalone SVG string with fonts embedded. */
export async function svgToString(svgEl, scale = 1) {
  const clone = svgEl.cloneNode(true)
  const [w, h] = clone.getAttribute('viewBox').split(/\s+/).slice(2).map(Number)
  clone.setAttribute('width', String(Math.round(w * scale)))
  clone.setAttribute('height', String(Math.round(h * scale)))
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')
  clone.querySelectorAll('[data-export="exclude"]').forEach((n) => n.remove())
  clone.querySelectorAll('title').forEach((n) => n.remove())
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
  style.textContent = await fontFaceCss()
  clone.insertBefore(style, clone.firstChild)
  return { xml: new XMLSerializer().serializeToString(clone), width: Math.round(w * scale), height: Math.round(h * scale) }
}

/** Rasterize the poster to a PNG blob at the given scale. */
export async function svgToPngBlob(svgEl, scale = 2) {
  const { xml, width, height } = await svgToString(svgEl, scale)
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const img = new Image()
    img.decoding = 'sync'
    img.src = url
    await img.decode()
    // Let the embedded fonts settle before drawing (Safari needs a frame).
    await new Promise((r) => setTimeout(r, 50))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    canvas.getContext('2d').drawImage(img, 0, 0, width, height)
    return await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('PNG encode failed'))), 'image/png'))
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function slug(s) {
  return String(s || 'chart').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'chart'
}

export async function downloadPng(svgEl, title, scale = 2) {
  const blob = await svgToPngBlob(svgEl, scale)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${slug(title)}@${scale}x.png`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}

export async function downloadSvg(svgEl, title) {
  const { xml } = await svgToString(svgEl, 1)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }))
  a.download = `${slug(title)}.svg`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}

export async function copyPng(svgEl, scale = 2) {
  const blob = await svgToPngBlob(svgEl, scale)
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
}
