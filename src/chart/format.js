import { format as d3format } from 'd3-format'

export const FORMATS = ['int', 'dec1', 'dec2', 'dec3', 'pct', 'pct1', 'signed1', 'signed2', 'signed3', 'ordinal', 'compact', 'raw']

const fmts = {
  int: d3format(',.0f'),
  dec1: d3format(',.1f'),
  dec2: d3format(',.2f'),
  dec3: d3format('.3f'),
  pct: (v) => d3format('.0%')(v),
  pct1: (v) => d3format('.1%')(v),
  signed1: d3format('+.1f'),
  signed2: d3format('+.2f'),
  signed3: d3format('+.3f'),
  compact: d3format('~s'),
  ordinal: (v) => ordinal(Math.round(v)),
}

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

/** Format a value; percentages accept 0-1 fractions or 0-100 numbers. */
export function fmt(v, kind = 'raw', suffix = '') {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v !== 'number') return String(v) + (suffix || '')
  let x = v
  if ((kind === 'pct' || kind === 'pct1') && Math.abs(v) > 1.5) x = v / 100
  const f = fmts[kind]
  if (x === 0 && kind.startsWith('signed')) return fmts[kind.replace('signed', 'dec')](0) + (suffix || '')
  const out = f ? f(x).replace('−', '-') : (Number.isInteger(v) ? String(v) : d3format(',.2~f')(v))
  return out + (suffix || '')
}

/** Pick a sensible default format for a column of numbers. */
export function guessFormat(values) {
  const nums = values.filter((v) => typeof v === 'number')
  if (!nums.length) return 'raw'
  if (nums.every(Number.isInteger)) return 'int'
  const max = Math.max(...nums.map(Math.abs))
  if (max <= 1 && nums.some((v) => v < 0)) return 'signed3'
  if (max <= 1) return 'dec3'
  if (max < 10) return 'dec2'
  return 'dec1'
}
