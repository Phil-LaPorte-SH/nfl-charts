export function fmtCell(v) {
  if (v === null || v === undefined) return '∅'
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(Math.abs(v) < 1 ? 3 : 2)
  if (Array.isArray(v)) return JSON.stringify(v)
  return String(v)
}
