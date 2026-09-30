import { scaleLinear, scalePoint } from 'd3-scale'
import { extent } from 'd3-array'
import { line as d3line } from 'd3-shape'
import { measure, font } from '../text.js'
import { seriesColor } from '../theme.js'
import { fmt, guessFormat } from '../format.js'
import { hasHighlight, refValues, humanize } from './common.js'
import { legendLayout } from './Legend.jsx'

export default function LineChart({ box, spec, rows, theme, teams, u }) {
  const e = spec.encoding
  const data = rows.filter((r) => r[e.y] !== null && r[e.y] !== undefined && r[e.x] !== null)
  if (!data.length) return null
  const fy = (v) => fmt(v, spec.format.y || spec.format.value || guessFormat(data.map((r) => r[e.y])), spec.format.value_suffix || '')
  const numericX = data.every((r) => typeof r[e.x] === 'number')
  const fx = (v) => (numericX ? fmt(v, spec.format.x || (data.every((r) => Number.isInteger(r[e.x])) ? 'raw' : guessFormat(data.map((r) => r[e.x])))) : String(v))

  // group into series
  const keys = e.series ? [...new Set(data.map((r) => r[e.series]))] : ['__all']
  const hlSet = new Set([...(spec.highlight.teams || []), ...(spec.highlight.labels || [])].map(String))
  const anyHl = hasHighlight(spec)
  const series = keys.map((k, i) => {
    const pts = data.filter((r) => k === '__all' || r[e.series] === k)
    if (numericX) pts.sort((a, b) => a[e.x] - b[e.x])
    const hl = anyHl && hlSet.has(String(k))
    const color = anyHl && !hl ? theme.bar : seriesColor(theme, k, i, teams)
    return { key: k, label: k === '__all' ? humanize(e.y) : String(k), pts, color, hl }
  })

  const tickFs = Math.round(20 * u)
  const titleFs = Math.round(20 * u)
  const legend = series.length > 1
    ? legendLayout(series.map((s) => ({ label: s.label, color: s.color, muted: anyHl && !s.hl })), { x: box.x, y: box.y, w: box.w }, u, theme, 'line')
    : { el: null, h: 0 }

  const y = scaleLinear().domain(extent(data, (r) => r[e.y])).nice(6)
  const yTicks = y.ticks(6)
  const leftW = Math.max(...yTicks.map((t) => measure(fy(t), font(tickFs, 500)))) + 16 * u
  const endLabels = series.length <= 4
  const rightW = endLabels ? Math.max(...series.map((s) => measure(fy(s.pts.at(-1)?.[e.y]), font(22 * u, 800)))) + 24 * u : 16 * u
  const plot = { x: box.x + leftW, y: box.y + legend.h + (spec.format.y_title ? titleFs * 1.8 : 12 * u), w: box.w - leftW - rightW, h: 0 }
  plot.h = box.y + box.h - plot.y - tickFs * 2 - (spec.format.x_title ? titleFs * 1.8 : 0)
  y.range([plot.y + plot.h, plot.y])
  const xDomain = numericX ? extent(data, (r) => r[e.x]) : [...new Set(data.map((r) => r[e.x]))]
  const x = numericX ? scaleLinear().domain(xDomain).range([plot.x, plot.x + plot.w]) : scalePoint().domain(xDomain).range([plot.x, plot.x + plot.w]).padding(0.3)
  let xTicks = numericX ? x.ticks(Math.min(10, xDomain[1] - xDomain[0] + 1)).filter((t) => data.every((r) => !Number.isInteger(r[e.x])) || Number.isInteger(t)) : xDomain
  if (!numericX && xTicks.length > 12) xTicks = xTicks.filter((_, i) => i % Math.ceil(xTicks.length / 12) === 0)
  const path = d3line().x((r) => x(r[e.x])).y((r) => y(r[e.y]))
  const refs = refValues(spec, 'y', data, e.y)
  const drawOrder = [...series].sort((a, b) => a.hl - b.hl)

  // end labels: skip if any two collide
  const ends = series.map((s) => ({ s, y: y(s.pts.at(-1)?.[e.y]) })).sort((a, b) => a.y - b.y)
  const collide = ends.some((p, i) => i && p.y - ends[i - 1].y < 26 * u)

  return (
    <g>
      {legend.el}
      {spec.format.y_title && <text x={box.x} y={plot.y - titleFs * 1.2} fontSize={titleFs} fontWeight={700} fill={theme.ink2} letterSpacing={1 * u}>{spec.format.y_title.toUpperCase()}</text>}
      {yTicks.map((t) => (
        <g key={t}>
          <line x1={plot.x} x2={plot.x + plot.w} y1={y(t)} y2={y(t)} stroke={theme.grid} strokeWidth={1.2 * u} />
          <text x={plot.x - 10 * u} y={y(t)} dy="0.35em" textAnchor="end" fontSize={tickFs} fill={theme.ink2} style={{ fontVariantNumeric: 'tabular-nums' }}>{fy(t)}</text>
        </g>
      ))}
      <line x1={plot.x} x2={plot.x + plot.w} y1={plot.y + plot.h} y2={plot.y + plot.h} stroke={theme.axis} strokeWidth={1.5 * u} />
      {xTicks.map((t) => <text key={t} x={x(t)} y={plot.y + plot.h + 10 * u} dy="0.8em" textAnchor="middle" fontSize={tickFs} fill={theme.ink2} style={{ fontVariantNumeric: 'tabular-nums' }}>{fx(t)}</text>)}
      {spec.format.x_title && <text x={plot.x + plot.w / 2} y={box.y + box.h} textAnchor="middle" fontSize={titleFs} fontWeight={700} fill={theme.ink2} letterSpacing={1 * u}>{spec.format.x_title.toUpperCase()}</text>}
      {refs.map((r, i) => (
        <g key={i}>
          <line x1={plot.x} x2={plot.x + plot.w} y1={y(r.value)} y2={y(r.value)} stroke={theme.ink2} strokeWidth={2 * u} strokeDasharray={`${8 * u} ${6 * u}`} opacity={0.8} />
          <text x={plot.x + 8 * u} y={y(r.value) - 8 * u} fontSize={16 * u} fontWeight={700} fill={theme.ink2}>{(r.label || 'Avg').toUpperCase()} {fy(r.value)}</text>
        </g>
      ))}
      {drawOrder.map((s) => (
        <g key={String(s.key)}>
          <path d={path(s.pts)} fill="none" stroke={s.color} strokeWidth={(s.hl ? 6 : 4) * u} strokeLinejoin="round" strokeLinecap="round" />
          {s.pts.length <= 40 && s.pts.map((p, i) => (
            <circle key={i} cx={x(p[e.x])} cy={y(p[e.y])} r={(i === s.pts.length - 1 ? 7 : 4.5) * u} fill={s.color} stroke={theme.bg} strokeWidth={3 * u}>
              <title>{`${s.label} · ${fx(p[e.x])}: ${fy(p[e.y])}`}</title>
            </circle>
          ))}
          {endLabels && !collide && s.pts.length > 0 && (
            <text x={x(s.pts.at(-1)[e.x]) + 14 * u} y={y(s.pts.at(-1)[e.y])} dy="0.35em" fontSize={22 * u} fontWeight={800} fill={theme.ink}>{fy(s.pts.at(-1)[e.y])}</text>
          )}
        </g>
      ))}
    </g>
  )
}
