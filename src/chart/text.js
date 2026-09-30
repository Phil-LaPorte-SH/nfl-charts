// Text measurement for SVG layout (SVG has no auto-wrap).
let ctx = null
function context() {
  if (!ctx) ctx = document.createElement('canvas').getContext('2d')
  return ctx
}

export function measure(text, font) {
  const c = context()
  c.font = font
  return c.measureText(String(text ?? '')).width
}

export const font = (size, weight = 400, family = "'Inter Variable', system-ui, sans-serif") => `${weight} ${size}px ${family}`

/** Greedy word wrap into lines no wider than maxWidth. */
export function wrap(text, fontStr, maxWidth, maxLines = 99) {
  const words = String(text ?? '').split(/\s+/).filter(Boolean)
  const lines = []
  let cur = ''
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w
    if (measure(next, fontStr) <= maxWidth || !cur) cur = next
    else {
      lines.push(cur)
      cur = w
    }
  }
  if (cur) lines.push(cur)
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines)
    let last = kept[maxLines - 1]
    while (last && measure(last + '…', fontStr) > maxWidth) last = last.split(' ').slice(0, -1).join(' ')
    kept[maxLines - 1] = (last || '') + '…'
    return kept
  }
  return lines
}

/** Largest font size (<= max) at which text fits in width on one line. */
export function fitSize(text, weight, family, maxWidth, max, min = 12) {
  let s = max
  while (s > min && measure(text, `${weight} ${s}px ${family}`) > maxWidth) s -= 2
  return s
}

/** Truncate a single line to width with an ellipsis. */
export function truncate(text, fontStr, maxWidth) {
  let t = String(text ?? '')
  if (measure(t, fontStr) <= maxWidth) return t
  while (t.length > 1 && measure(t + '…', fontStr) > maxWidth) t = t.slice(0, -1)
  return t + '…'
}
