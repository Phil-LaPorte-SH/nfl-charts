/** Horizontal bar with a rounded data-end and a square baseline end. */
export function barPath(x0, x1, y, h, r) {
  const dir = x1 >= x0 ? 1 : -1
  const len = Math.abs(x1 - x0)
  const rr = Math.min(r, len / 2, h / 2)
  if (len < 0.5) return ''
  if (dir === 1) {
    return `M${x0},${y}H${x1 - rr}Q${x1},${y} ${x1},${y + rr}V${y + h - rr}Q${x1},${y + h} ${x1 - rr},${y + h}H${x0}Z`
  }
  return `M${x0},${y}H${x1 + rr}Q${x1},${y} ${x1},${y + rr}V${y + h - rr}Q${x1},${y + h} ${x1 + rr},${y + h}H${x0}Z`
}

/** Vertical column with a rounded data-end (top for positive values). */
export function columnPath(x, w, y0, y1, r) {
  const up = y1 <= y0
  const len = Math.abs(y1 - y0)
  const rr = Math.min(r, len / 2, w / 2)
  if (len < 0.5) return ''
  if (up) return `M${x},${y0}V${y1 + rr}Q${x},${y1} ${x + rr},${y1}H${x + w - rr}Q${x + w},${y1} ${x + w},${y1 + rr}V${y0}Z`
  return `M${x},${y0}V${y1 - rr}Q${x},${y1} ${x + rr},${y1}H${x + w - rr}Q${x + w},${y1} ${x + w},${y1 - rr}V${y0}Z`
}
