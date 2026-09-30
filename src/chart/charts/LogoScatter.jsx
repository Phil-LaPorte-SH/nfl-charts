import { scaleLinear } from 'd3-scale'
import { extent } from 'd3-array'
import { Logo } from '../primitives.jsx'
import { measure, font, fitSize, truncate } from '../text.js'
import { isHighlighted, hasHighlight, refValues, humanize } from './common.js'
import { fmt, guessFormat } from '../format.js'
import { FONT_SANS } from '../fonts.js'

function Quad({ text, ax, ay, plot, theme, u, qFs }) {
  if (!text) return null
  const w = measure(text.toUpperCase(), font(qFs, 800)) + 28 * u
  const h = qFs * 2
  const qx = ax === 'left' ? plot.x + 14 * u : plot.x + plot.w - 14 * u - w
  const qy = ay === 'top' ? plot.y + 14 * u : plot.y + plot.h - 14 * u - h
  return (
    <g>
      <rect x={qx} y={qy} width={w} height={h} rx={6 * u} fill={theme.tile} stroke={theme.grid} strokeWidth={1.5 * u} />
      <text x={qx + w / 2} y={qy + h / 2} dy="0.35em" textAnchor="middle" fontSize={qFs} fontWeight={800} letterSpacing={1 * u} fill={theme.ink}>{text.toUpperCase()}</text>
    </g>
  )
}

export default function LogoScatter({ box, spec, rows, theme, teams, logos, u }) {
  const e = spec.encoding
  const data = rows.filter((r) => typeof r[e.x] === 'number' && typeof r[e.y] === 'number')
  if (!data.length) return null
  const fx = (v) => fmt(v, spec.format.x || guessFormat(data.map((r) => r[e.x])))
  const fy = (v) => fmt(v, spec.format.y || guessFormat(data.map((r) => r[e.y])))
  const anyHl = hasHighlight(spec)
  const tickFs = Math.round(20 * u)
  const titleFs = Math.round(22 * u)

  const pad = (lo, hi) => { const d = (hi - lo) || Math.abs(hi) || 1; return [lo - d * 0.08, hi + d * 0.08] }
  const x = scaleLinear().domain(pad(...extent(data, (r) => r[e.x]))).nice()
  const y = scaleLinear().domain(pad(...extent(data, (r) => r[e.y]))).nice()
  const yTicks = y.ticks(6)
  const leftW = Math.max(...yTicks.map((t) => measure(fy(t), font(tickFs, 500)))) + 16 * u + titleFs * 1.8
  const plot = { x: box.x + leftW, y: box.y + 8 * u, w: box.w - leftW - 8 * u, h: box.h - tickFs * 2 - titleFs * 2 - 16 * u }
  x.range([plot.x, plot.x + plot.w])
  y.range([plot.y + plot.h, plot.y])
  const xTicks = x.ticks(7)

  // axis titles shrink to fit their axis (letter-spacing adds ~1u per char)
  const xTitle = (spec.format.x_title || humanize(e.x)).toUpperCase()
  const yTitle = (spec.format.y_title || humanize(e.y)).toUpperCase()
  const xTitleFs = fitSize(xTitle, 800, FONT_SANS, plot.w - xTitle.length * u, titleFs, 12)
  const yTitleFs = fitSize(yTitle, 800, FONT_SANS, plot.h - yTitle.length * u, titleFs, 12)
  const xr = refValues(spec, 'x', data, e.x)
  const yr = refValues(spec, 'y', data, e.y)
  const size = Math.max(36 * u, Math.min(70 * u, plot.w / 13))
  const q = spec.quadrants
  const qFs = Math.round(19 * u)

  const ordered = [...data].sort((a, b) => (anyHl ? isHighlighted(spec, a) - isHighlighted(spec, b) : 0))
  return (
    <g>
      <rect x={plot.x} y={plot.y} width={plot.w} height={plot.h} fill="none" stroke={theme.grid} strokeWidth={1.5 * u} />
      {xTicks.map((t) => <line key={`gx${t}`} x1={x(t)} x2={x(t)} y1={plot.y} y2={plot.y + plot.h} stroke={theme.grid} strokeWidth={1 * u} />)}
      {yTicks.map((t) => <line key={`gy${t}`} x1={plot.x} x2={plot.x + plot.w} y1={y(t)} y2={y(t)} stroke={theme.grid} strokeWidth={1 * u} />)}
      {xTicks.map((t) => <text key={`tx${t}`} x={x(t)} y={plot.y + plot.h + 10 * u} dy="0.8em" textAnchor="middle" fontSize={tickFs} fill={theme.ink2} style={{ fontVariantNumeric: 'tabular-nums' }}>{fx(t)}</text>)}
      {yTicks.map((t) => <text key={`ty${t}`} x={plot.x - 10 * u} y={y(t)} dy="0.35em" textAnchor="end" fontSize={tickFs} fill={theme.ink2} style={{ fontVariantNumeric: 'tabular-nums' }}>{fy(t)}</text>)}
      <text x={plot.x + plot.w / 2} y={box.y + box.h} textAnchor="middle" fontSize={xTitleFs} fontWeight={800} letterSpacing={1 * u} fill={theme.ink}>
        {truncate(xTitle, font(xTitleFs, 800), plot.w)}
      </text>
      <text transform={`translate(${box.x + titleFs * 0.9},${plot.y + plot.h / 2}) rotate(-90)`} textAnchor="middle" fontSize={yTitleFs} fontWeight={800} letterSpacing={1 * u} fill={theme.ink}>
        {truncate(yTitle, font(yTitleFs, 800), plot.h)}
      </text>
      {xr.map((r, i) => (
        <g key={`xr${i}`}>
          <line x1={x(r.value)} x2={x(r.value)} y1={plot.y} y2={plot.y + plot.h} stroke={theme.accent} strokeWidth={2 * u} strokeDasharray={`${8 * u} ${6 * u}`} opacity={0.85} />
          <text x={x(r.value) + 10 * u} y={plot.y + plot.h - 60 * u} fontSize={16 * u} fontWeight={700} fill={theme.ink2}>
            <tspan x={x(r.value) + 10 * u}>{(r.label || 'League avg').toUpperCase()}:</tspan>
            <tspan x={x(r.value) + 10 * u} dy="1.2em">{fx(r.value)}</tspan>
          </text>
        </g>
      ))}
      {yr.map((r, i) => (
        <g key={`yr${i}`}>
          <line x1={plot.x} x2={plot.x + plot.w} y1={y(r.value)} y2={y(r.value)} stroke={theme.accent} strokeWidth={2 * u} strokeDasharray={`${8 * u} ${6 * u}`} opacity={0.85} />
          <text x={plot.x + 14 * u} y={y(r.value) - 30 * u} fontSize={16 * u} fontWeight={700} fill={theme.ink2}>
            <tspan x={plot.x + 14 * u}>{(r.label || 'League avg').toUpperCase()}:</tspan>
            <tspan x={plot.x + 14 * u} dy="1.2em">{fy(r.value)}</tspan>
          </text>
        </g>
      ))}
      {ordered.map((r) => {
        const hl = anyHl && isHighlighted(spec, r)
        const s = hl ? size * 1.25 : size
        return <Logo key={r[e.team]} x={x(r[e.x])} y={y(r[e.y])} size={s} abbr={r[e.team]} logos={logos} teams={teams} opacity={anyHl && !hl ? 0.4 : 1} title={`${r[e.team]}: ${fx(r[e.x])}, ${fy(r[e.y])}`} />
      })}
      {q && (
        <>
          <Quad text={q.top_left} ax="left" ay="top" plot={plot} theme={theme} u={u} qFs={qFs} />
          <Quad text={q.top_right} ax="right" ay="top" plot={plot} theme={theme} u={u} qFs={qFs} />
          <Quad text={q.bottom_left} ax="left" ay="bottom" plot={plot} theme={theme} u={u} qFs={qFs} />
          <Quad text={q.bottom_right} ax="right" ay="bottom" plot={plot} theme={theme} u={u} qFs={qFs} />
        </>
      )}
    </g>
  )
}
