import interUrl from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url'
import barlow600 from '@fontsource/barlow-condensed/files/barlow-condensed-latin-600-normal.woff2?url'
import barlow700 from '@fontsource/barlow-condensed/files/barlow-condensed-latin-700-normal.woff2?url'
import barlow800 from '@fontsource/barlow-condensed/files/barlow-condensed-latin-800-normal.woff2?url'

export const FONT_SANS = "'Inter Variable', Inter, system-ui, sans-serif"
export const FONT_DISPLAY = "'Barlow Condensed', 'Inter Variable', sans-serif"

const FACES = [
  { family: 'Inter Variable', weight: '100 900', url: interUrl },
  { family: 'Barlow Condensed', weight: '600', url: barlow600 },
  { family: 'Barlow Condensed', weight: '700', url: barlow700 },
  { family: 'Barlow Condensed', weight: '800', url: barlow800 },
]

let ready = null
/** Resolve once the poster fonts are usable for canvas measurement. */
export function ensureFonts() {
  if (!ready) {
    ready = Promise.all([
      document.fonts.load(`400 20px 'Inter Variable'`),
      document.fonts.load(`700 20px 'Inter Variable'`),
      document.fonts.load(`800 20px 'Inter Variable'`),
      document.fonts.load(`800 20px 'Barlow Condensed'`),
      document.fonts.load(`700 20px 'Barlow Condensed'`),
      document.fonts.load(`600 20px 'Barlow Condensed'`),
    ]).then(() => document.fonts.ready).catch(() => {})
  }
  return ready
}

let faceCss = null
/** @font-face rules with the fonts inlined as data URLs, for exported SVGs. */
export function fontFaceCss() {
  if (!faceCss) {
    faceCss = Promise.all(FACES.map(async (f) => {
      const buf = await (await fetch(f.url)).arrayBuffer()
      const b64 = bytesToBase64(new Uint8Array(buf))
      return `@font-face{font-family:'${f.family}';font-weight:${f.weight};font-style:normal;src:url(data:font/woff2;base64,${b64}) format('woff2');}`
    })).then((rules) => rules.join('\n'))
  }
  return faceCss
}

export function bytesToBase64(bytes) {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
  return btoa(s)
}
