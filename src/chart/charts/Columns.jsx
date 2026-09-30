import { scaleBand, scaleLinear } from 'd3-scale'
import { measure, font, truncate } from '../text.js'
import { seriesColor } from '../theme.js'
import { columnPath } from '../shapes.js'
import { formatterFor, hasHighlight, humanize } from './common.js'
import { legendLayout } from './Legend.jsx'

function prep(spec, rows, theme, teams) {
  const e = spec.encoding
  const labels = [...new Set(rows.map((r) => r[e.label]))]
  const keys = [...new Set(rows.map((r) => r[e.series]))]
  const hlSet = new Set([...(spec.highlight.teams || []), ...(spec.highlight.labels || [])].map(String))
  const anyHl = hasHighlight(spec)
  const colors = Object.fromEntries(keys.map((k, i) => [k, anyHl && !hlSet.has(String(k)) ? theme.bar : seriesColor(theme, k, i, teams)]))
  const get = (l, k) => rows.find((r) => r[e.label] === l && r[e.series] === k)?.[e.value] ?? 0
  return { e, labels, keys, colors, get, anyHl, hlSet }
}

function frame(box, u, theme, legendItems, yTicks, fmtV) {
  const legend = legendLayout(legendItems, { x: box.x, y: box.y, w: box.w }, u, theme)
  const tickFs = Math.round(20 * u)
  const leftW = Math.max(...yTicks.map((t) => measure(fmtV(t), font(tickFs)))) + 14 * u
  return { legend, tickFs, plot: { x: box.x + leftW, y: box.y + legend.h + 16 * u, w: box.w - leftW, h: box.h - legend.h - 16 * u - tickFs * 2.4 } }
}

export function GroupedBar({ box, spec, rows, theme, teams, u }) {
  const { e, labels, keys, colors, get, anyHl, hlSet } = prep(spec, rows, theme, teams)
  if (!labels.length) return null
  const fmtV = formatterFor(spec, e.value, rows)
  const vals = rows.map((r) => r[e.value]).filter((v) => typeof v === 'number')
  const y = scaleLinear().domain([Math.min(0, ...vals), Math.max(0, ...vals)]).nice(5)
  const { legend, tickFs, plot } = frame(box, u, theme, keys.map((k) => ({ label: String(k), color: colors[k], muted: anyHl && !hlSet.has(String(k)) })), y.ticks(5), fmtV)
  y.range([plot.y + plot.h, plot.y])
  const x0 = scaleBand().domain(labels).range([plot.x, plot.x + plot.w]).paddingInner(0.25).paddingOuter(0.1)
  const x1 = scaleBand().domain(keys).range([0, x0.bandwidth()]).paddingInner(0.08)
  const bw = Math.min(x1.bandwidth(), 56 * u)
  const labelEvery = labels.length * keys.length <= 16
  return (
    <g>
      {legend.el}
      {y.ticks(5).map((t) => (
        <g key={t}>
          <line x1={plot.x} x2={plot.x + plot.w} y1={y(t)} y2={y(t)} stroke={theme.grid} strokeWidth={1.2 * u} />
          <text x={plot.x - 10 * u} y={y(t)} dy="0.35em" textAnchor="end" fontSize={tickFs} fill={theme.ink2} style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtV(t)}</text>
        </g>
      ))}
      <line x1={plot.x} x2={plot.x + plot.w} y1={y(0)} y2={y(0)} stroke={theme.axis} strokeWidth={1.5 * u} />
      {labels.map((l) => (
        <g key={String(l)}>
          {keys.map((k) => {
            const v = get(l, k)
            const bx = x0(l) + x1(k) + (x1.bandwidth() - bw) / 2
            return (
              <g key={String(k)}>
                <path d={columnPath(bx, bw, y(0), y(v), 5 * u)} fill={colors[k]}><title>{`${l} · ${k}: ${fmtV(v)}`}</title></path>
                {labelEvery && <text x={bx + bw / 2} y={y(v) - 8 * u} textAnchor="middle" fontSize={17 * u} fontWeight={700} fill={theme.ink}>{fmtV(v)}</text>}
              </g>
            )
          })}
          <text x={x0(l) + x0.bandwidth() / 2} y={plot.y + plot.h + 10 * u} dy="0.8em" textAnchor="middle" fontSize={tickFs} fontWeight={600} fill={theme.ink}>{truncate(String(l), font(tickFs, 600), x0.bandwidth() + 10 * u)}</text>
        </g>
      ))}
    </g>
  )
}

export function StackedBar({ box, spec, rows, theme, teams, u }) {
  const { e, labels, keys, colors, get, anyHl, hlSet } = prep(spec, rows, theme, teams)
  if (!labels.length) return null
  const fmtV = formatterFor(spec, e.value, rows)
  const totals = labels.map((l) => keys.reduce((s, k) => s + Math.max(0, get(l, k)), 0))
  const y = scaleLinear().domain([0, Math.max(...totals) || 1]).nice(5)
  const { legend, tickFs, plot } = frame(box, u, theme, keys.map((k) => ({ label: String(k), color: colors[k], muted: anyHl && !hlSet.has(String(k)) })), y.ticks(5), fmtV)
  y.range([plot.y + plot.h, plot.y])
  const x = scaleBand().domain(labels).range([plot.x, plot.x + plot.w]).paddingInner(0.3).paddingOuter(0.1)
  const bw = Math.min(x.bandwidth(), 90 * u)
  const gap = 2 * u
  return (
    <g>
      {legend.el}
      {y.ticks(5).map((t) => (
        <g key={t}>
          <line x1={plot.x} x2={plot.x + plot.w} y1={y(t)} y2={y(t)} stroke={theme.grid} strokeWidth={1.2 * u} />
          <text x={plot.x - 10 * u} y={y(t)} dy="0.35em" textAnchor="end" fontSize={tickFs} fill={theme.ink2} style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtV(t)}</text>
        </g>
      ))}
      {labels.map((l, li) => {
        let acc = 0
        const bx = x(l) + (x.bandwidth() - bw) / 2
        return (
          <g key={String(l)}>
            {keys.map((k, ki) => {
              const v = Math.max(0, get(l, k))
              const y0 = y(acc)
              acc += v
              const y1 = y(acc)
              const top = ki === keys.length - 1 || keys.slice(ki + 1).every((kk) => get(l, kk) <= 0)
              const h = Math.max(0, y0 - y1 - gap)
              if (h <= 0) return null
              return top
                ? <path key={String(k)} d={columnPath(bx, bw, y0, y0 - h, 5 * u)} fill={colors[k]}><title>{`${l} · ${k}: ${fmtV(v)}`}</title></path>
                : <rect key={String(k)} x={bx} y={y0 - h} width={bw} height={h} fill={colors[k]}><title>{`${l} · ${k}: ${fmtV(v)}`}</title></rect>
            })}
            <text x={bx + bw / 2} y={y(totals[li]) - 10 * u} textAnchor="middle" fontSize={18 * u} fontWeight={800} fill={theme.ink}>{fmtV(totals[li])}</text>
            <text x={x(l) + x.bandwidth() / 2} y={plot.y + plot.h + 10 * u} dy="0.8em" textAnchor="middle" fontSize={tickFs} fontWeight={600} fill={theme.ink}>{truncate(String(l), font(tickFs, 600), x.bandwidth() + 10 * u)}</text>
          </g>
        )
      })}
      <line x1={plot.x} x2={plot.x + plot.w} y1={y(0)} y2={y(0)} stroke={theme.axis} strokeWidth={1.5 * u} />
      <text x={box.x} y={box.y + box.h} fontSize={14 * u} fill={theme.muted}>{humanize(e.value)}</text>
    </g>
  )
}
