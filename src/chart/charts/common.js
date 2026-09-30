import { fmt, guessFormat } from '../format.js'
import { mean, median } from 'd3-array'

export const isHighlighted = (spec, row) => {
  const e = spec.encoding
  const teams = spec.highlight.teams || []
  const labels = spec.highlight.labels || []
  return (e.team && teams.includes(row[e.team])) || (e.label && labels.map(String).includes(String(row[e.label])))
    || (e.series && (teams.includes(row[e.series]) || labels.map(String).includes(String(row[e.series]))))
}

export const hasHighlight = (spec) => (spec.highlight.teams?.length || 0) + (spec.highlight.labels?.length || 0) > 0

export function sortRows(rows, key, dir) {
  if (!key || dir === 'none') return rows
  const s = [...rows].sort((a, b) => (a[key] ?? -Infinity) - (b[key] ?? -Infinity))
  return dir === 'desc' ? s.reverse() : s
}

export function formatterFor(spec, key, rows, which = 'value') {
  const kind = spec.format[which] || guessFormat(rows.map((r) => r[key]))
  const suffix = which === 'value' ? spec.format.value_suffix || '' : ''
  return (v) => fmt(v, kind, suffix)
}

/** Resolve reference lines for an axis to concrete values. */
export function refValues(spec, axis, rows, key) {
  return spec.reference_lines
    .filter((l) => l.axis === axis || (axis === 'value' && l.axis === 'x' && spec.type === 'ranked_bar'))
    .map((l) => {
      const vals = rows.map((r) => r[key]).filter((v) => typeof v === 'number')
      const v = l.stat === 'mean' ? mean(vals) : l.stat === 'median' ? median(vals) : l.value
      return v == null || Number.isNaN(v) ? null : { value: v, label: l.label }
    })
    .filter(Boolean)
}

export const humanize = (s) => String(s || '').replace(/_/g, ' ')
