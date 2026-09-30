// Small color utilities (sRGB hex).
export function hexToRgb(hex) {
  const h = String(hex || '').replace('#', '')
  const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0').slice(0, 6)
  return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16) || 0)
}
export const rgbToHex = (rgb) => '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')

export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

/** Mix a toward b by t (0..1). */
export function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b)
  return rgbToHex(A.map((v, i) => v + (B[i] - v) * t))
}
