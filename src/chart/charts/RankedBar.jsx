import { scaleLinear } from 'd3-scale'
import { measure, font, truncate } from '../text.js'
import { Logo } from '../primitives.jsx'
import { barPath } from '../shapes.js'
import { isHighlighted, hasHighlight, sortRows, formatterFor, refValues, humanize } from './common.js'

export default function RankedBar({ box, spec, rows: raw, theme, teams, logos, u }) {
  const e = spec.encoding
  const valueKey = e.value
  const rows = sortRows(raw, valueKey, e.sort === 'none' ? 'none' : e.sort || 'desc')
  const n = rows.length
  if (!n) return null
  const fmtV = formatterFor(spec, valueKey, rows)
  const fmtS = e.secondary ? formatterFor(spec, e.secondary, rows, 'secondary') : null
  const labelOf = (r) => (e.label ? r[e.label] : r[e.team])
  const anyHl = hasHighlight(spec)

  const headerH = Math.round(40 * u)
  const rowH = Math.min(72 * u, (box.h - headerH) / n)
  const fs = Math.max(13, Math.min(30 * u, rowH * 0.6))
  const smallFs = Math.max(11, Math.min(24 * u, rowH * 0.5))
  const barH = Math.min(26 * u, rowH * 0.52)
  const logoSize = e.team ? Math.min(rowH * 0.82, 46 * u) : 0

  const rankW = measure(String(n), font(smallFs, 700)) + 22 * u
  const labelFont = font(fs, 800)
  const maxLabelW = Math.min(box.w * 0.34, Math.max(...rows.map((r) => measure(labelOf(r), labelFont))))
  const labelX = box.x + rankW + (logoSize ? logoSize + 12 * u : 0)
  const secW = fmtS ? Math.max(...rows.map((r) => measure(fmtS(r[e.secondary]), font(smallFs, 400))), measure((spec.format.secondary_title || '').toUpperCase(), font(16 * u, 500))) + 8 * u : 0
  const valW = Math.max(...rows.map((r) => measure(fmtV(r[valueKey]), font(fs, 800)))) + 14 * u
  const barX0 = labelX + maxLabelW + 22 * u
  const barX1 = box.x + box.w - secW - (secW ? 28 * u : 0) - valW

  const vals = rows.map((r) => r[valueKey]).filter((v) => typeof v === 'number')
  const lo = Math.min(0, ...vals)
  const hi = Math.max(0, ...vals)
  const hasNeg = lo < 0
  const x = scaleLinear().domain([lo, hi || 1]).range([barX0 + (hasNeg ? valW : 0), barX1])
  const zero = x(0)
  const refs = refValues(spec, 'value', rows, valueKey)

  const headFs = Math.round(17 * u)
  const hy = box.y
  return (
    <g>
      <g fontSize={headFs} fill={theme.ink2} letterSpacing={2 * u} fontWeight={500}>
        <text x={box.x} y={hy} dy="0.8em">#</text>
        <text x={e.team ? box.x + rankW : labelX} y={hy} dy="0.8em">{(e.team && !e.label ? 'TEAM' : humanize(e.label)).toUpperCase()}</text>
        <text x={barX0} y={hy} dy="0.8em">{truncate((spec.format.value_title || humanize(valueKey)).toUpperCase(), font(headFs, 500), barX1 - barX0)}</text>
        {fmtS && <text x={box.x + box.w} y={hy} dy="0.8em" textAnchor="end">{(spec.format.secondary_title || humanize(e.secondary)).toUpperCase()}</text>}
      </g>
      <line x1={box.x} x2={box.x + box.w} y1={box.y + headerH - 6 * u} y2={box.y + headerH - 6 * u} stroke={theme.grid} strokeWidth={1.5 * u} />
      {rows.map((r, i) => {
        const cy = box.y + headerH + i * rowH + rowH / 2
        const hl = anyHl && isHighlighted(spec, r)
        const v = r[valueKey]
        const x1 = typeof v === 'number' ? x(v) : zero
        const barColor = hl ? theme.highlight : anyHl ? theme.bar : theme.barNoHighlight
        const textColor = hl ? theme.highlight : theme.ink
        const label = labelOf(r)
        const vText = fmtV(v)
        const vx = v >= 0 ? x1 + 10 * u : x1 - 10 * u
        return (
          <g key={i}>
            <title>{`${label}: ${vText}${fmtS ? ` (${fmtS(r[e.secondary])})` : ''}`}</title>
            {hl && <rect x={box.x - 12 * u} y={cy - rowH / 2 + 1} width={box.w + 24 * u} height={rowH - 2} rx={10 * u} fill={theme.band} />}
            <text x={box.x} y={cy} dy="0.35em" fontSize={smallFs} fontWeight={700} fill={hl ? textColor : theme.ink2}>{i + 1}</text>
            {e.team && <Logo x={box.x + rankW + logoSize / 2} y={cy} size={logoSize} abbr={r[e.team]} logos={logos} teams={teams} />}
            <text x={labelX} y={cy} dy="0.35em" fontSize={fs} fontWeight={800} fill={textColor}>{truncate(label, labelFont, maxLabelW)}</text>
            <path d={barPath(zero, x1, cy - barH / 2, barH, 5 * u)} fill={barColor} />
            <text x={vx} y={cy} dy="0.35em" fontSize={fs} fontWeight={800} fill={textColor} textAnchor={v >= 0 ? 'start' : 'end'}>{vText}</text>
            {fmtS && <text x={box.x + box.w} y={cy} dy="0.35em" fontSize={smallFs} fill={hl ? theme.ink : theme.ink2} textAnchor="end">{fmtS(r[e.secondary])}</text>}
          </g>
        )
      })}
      {hasNeg && <line x1={zero} x2={zero} y1={box.y + headerH} y2={box.y + headerH + n * rowH} stroke={theme.axis} strokeWidth={1.5 * u} />}
      {refs.map((ref, i) => {
        const rx = x(ref.value)
        return (
          <g key={i}>
            <line x1={rx} x2={rx} y1={box.y + headerH - 2 * u} y2={box.y + headerH + n * rowH} stroke={theme.ink2} strokeWidth={2 * u} strokeDasharray={`${8 * u} ${6 * u}`} opacity={0.8} />
            <text x={rx + 6 * u} y={box.y + headerH + n * rowH + 4 * u} dy="0.8em" fontSize={16 * u} fill={theme.ink2} fontWeight={600}>
              {(ref.label || 'Avg').toUpperCase()} {fmtV(ref.value)}
            </text>
          </g>
        )
      })}
    </g>
  )
}
