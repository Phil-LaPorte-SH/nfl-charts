import { measure, font, truncate } from '../text.js'
import { fmt, guessFormat } from '../format.js'
import { Logo } from '../primitives.jsx'
import { isHighlighted, hasHighlight, humanize } from './common.js'

export default function TableChart({ box, spec, rows, result, theme, teams, logos, u }) {
  if (!result) return null
  const cols = (spec.columns?.length ? spec.columns : result.columns.map((c) => c.name)).slice(0, 8)
  const teamCol = spec.encoding.team
  const anyHl = hasHighlight(spec)
  const numeric = Object.fromEntries(cols.map((c) => [c, rows.some((r) => typeof r[c] === 'number')]))
  const fmts = Object.fromEntries(cols.map((c) => [c, guessFormat(rows.map((r) => r[c]))]))
  const cell = (c, v) => (numeric[c] ? fmt(v, c === spec.encoding.value && spec.format.value ? spec.format.value : fmts[c]) : v == null ? '—' : String(v))
  const headFs = Math.round(17 * u)
  const headH = headFs * 2.4
  const rowH = Math.max(30 * u, Math.min(56 * u, (box.h - headH) / Math.max(rows.length, 1)))
  const maxRows = Math.floor((box.h - headH) / rowH)
  const shown = rows.slice(0, maxRows)
  const fs = Math.min(24 * u, rowH * 0.48)
  const logoSize = rowH * 0.7
  const widths = cols.map((c) => Math.max(measure(humanize(c).toUpperCase(), font(headFs, 600)) + 10 * u,
    ...shown.map((r) => measure(cell(c, r[c]), font(fs, 600)) + (c === teamCol ? logoSize + 10 * u : 0))) + 28 * u)
  const total = widths.reduce((a, b) => a + b, 0)
  const scale = total > box.w ? box.w / total : 1
  const ws = widths.map((w) => (total < box.w ? w + (box.w - total) / cols.length : w * scale))
  const xs = ws.reduce((acc, w, i) => [...acc, acc[i] + w], [box.x])
  return (
    <g>
      {cols.map((c, i) => (
        <text key={c} x={numeric[c] ? xs[i] + ws[i] - 12 * u : xs[i] + 12 * u} y={box.y + headH / 2} dy="0.35em" textAnchor={numeric[c] ? 'end' : 'start'} fontSize={headFs} fontWeight={600} letterSpacing={1.5 * u} fill={theme.ink2}>
          {truncate(humanize(c).toUpperCase(), font(headFs, 600), ws[i] - 16 * u)}
        </text>
      ))}
      <line x1={box.x} x2={box.x + box.w} y1={box.y + headH} y2={box.y + headH} stroke={theme.axis} strokeWidth={1.5 * u} />
      {shown.map((r, ri) => {
        const y = box.y + headH + ri * rowH
        const hl = anyHl && isHighlighted(spec, r)
        return (
          <g key={ri}>
            {hl && <rect x={box.x} y={y + 1} width={box.w} height={rowH - 2} rx={8 * u} fill={theme.band} />}
            <line x1={box.x} x2={box.x + box.w} y1={y + rowH} y2={y + rowH} stroke={theme.grid} strokeWidth={1 * u} />
            {cols.map((c, i) => {
              const isTeam = c === teamCol && r[c]
              const tx = numeric[c] ? xs[i] + ws[i] - 12 * u : xs[i] + 12 * u + (isTeam ? logoSize + 8 * u : 0)
              return (
                <g key={c}>
                  {isTeam && <Logo x={xs[i] + 12 * u + logoSize / 2} y={y + rowH / 2} size={logoSize} abbr={r[c]} logos={logos} teams={teams} />}
                  <text x={tx} y={y + rowH / 2} dy="0.35em" textAnchor={numeric[c] ? 'end' : 'start'} fontSize={fs} fontWeight={hl || i === 0 ? 700 : 500}
                    fill={hl ? theme.highlight : theme.ink} style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {truncate(cell(c, r[c]), font(fs, 600), ws[i] - 20 * u - (isTeam ? logoSize : 0))}
                  </text>
                </g>
              )
            })}
          </g>
        )
      })}
      {rows.length > shown.length && (
        <text x={box.x + box.w} y={box.y + box.h} textAnchor="end" fontSize={16 * u} fill={theme.muted}>+{rows.length - shown.length} more rows</text>
      )}
    </g>
  )
}
