import { pie, arc } from 'd3-shape'
import { seriesColor } from '../theme.js'
import { measure, font, truncate } from '../text.js'
import { formatterFor, isHighlighted, hasHighlight } from './common.js'
import { Logo } from '../primitives.jsx'

export default function Donut({ box, spec, rows, theme, teams, logos, u }) {
  const e = spec.encoding
  const labelKey = e.label || e.team
  const data = rows.filter((r) => typeof r[e.value] === 'number' && r[e.value] > 0)
  if (!data.length) return null
  const fmtV = formatterFor(spec, e.value, data)
  const total = data.reduce((s, r) => s + r[e.value], 0)
  const anyHl = hasHighlight(spec)
  const wide = box.w / box.h > 1.2
  const r = Math.min(wide ? box.w * 0.25 : box.w * 0.36, wide ? box.h * 0.46 : box.h * 0.3)
  const cx = wide ? box.x + r + 20 * u : box.x + box.w / 2
  const cy = wide ? box.y + box.h / 2 : box.y + r + 10 * u
  const arcs = pie().sort(null).value((d) => d[e.value]).padAngle(0.012)(data)
  const a = arc().innerRadius(r * 0.62).outerRadius(r).cornerRadius(3 * u)
  const colors = data.map((d, i) => (anyHl && !isHighlighted(spec, d) ? theme.bar : seriesColor(theme, d[e.team || labelKey], i, teams)))
  const hl = anyHl ? data.find((d) => isHighlighted(spec, d)) : null
  const centerVal = hl ? `${Math.round((hl[e.value] / total) * 100)}%` : fmtV(total)
  const centerLbl = hl ? String(hl[labelKey]) : 'Total'

  const fs = Math.round(24 * u)
  const lx = wide ? cx + r + 60 * u : box.x
  const ly = wide ? cy - (data.length * fs * 2) / 2 : cy + r + 40 * u
  const lw = wide ? box.x + box.w - lx : box.w
  return (
    <g>
      <g transform={`translate(${cx},${cy})`}>
        {arcs.map((p, i) => <path key={i} d={a(p)} fill={colors[i]}><title>{`${data[i][labelKey]}: ${fmtV(data[i][e.value])} (${Math.round((data[i][e.value] / total) * 100)}%)`}</title></path>)}
        <text textAnchor="middle" dy="0.1em" fontSize={Math.min(r * 0.42, 96 * u)} fontWeight={800} fill={theme.ink}>{centerVal}</text>
        <text textAnchor="middle" y={r * 0.25} fontSize={22 * u} fill={theme.ink2}>{truncate(centerLbl, font(22 * u), r * 1.1)}</text>
      </g>
      {data.map((d, i) => {
        const yy = ly + i * fs * 2
        const pct = `${Math.round((d[e.value] / total) * 100)}%`
        const label = String(d[labelKey])
        const valText = `${fmtV(d[e.value])} · ${pct}`
        const off = e.team ? fs * 1.6 : fs * 0.9
        return (
          <g key={i} opacity={anyHl && !isHighlighted(spec, d) ? 0.7 : 1}>
            <rect x={lx} y={yy - fs * 0.45} width={fs * 0.7} height={fs * 0.7} rx={4 * u} fill={colors[i]} />
            {e.team && <Logo x={lx + fs * 1.5} y={yy - fs * 0.1} size={fs * 1.3} abbr={d[e.team]} logos={logos} teams={teams} />}
            <text x={lx + fs * 0.7 + 10 * u + off} y={yy} dy="0.25em" fontSize={fs} fontWeight={700} fill={theme.ink}>{truncate(label, font(fs, 700), lw - measure(valText, font(fs)) - 80 * u)}</text>
            <text x={lx + lw} y={yy} dy="0.25em" textAnchor="end" fontSize={fs} fill={theme.ink2} style={{ fontVariantNumeric: 'tabular-nums' }}>{valText}</text>
          </g>
        )
      })}
    </g>
  )
}
