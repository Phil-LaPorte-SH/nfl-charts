// Arrow values -> plain JSON-safe JS values.
export function toPlain(v) {
  if (v === null || v === undefined) return null
  if (typeof v === 'bigint') return Number(v)
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'object') {
    if (typeof v.toArray === 'function') return Array.from(v.toArray(), toPlain)
    if (typeof v.toJSON === 'function') return v.toJSON()
    return String(v)
  }
  return v
}

/** Convert an Arrow schema field type to a short label. */
export function typeLabel(field) {
  return String(field.type).replace(/<.*>/, '')
}
