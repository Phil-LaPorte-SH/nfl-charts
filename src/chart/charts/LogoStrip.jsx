import { scaleLinear } from 'd3-scale'
import { Logo } from '../primitives.jsx'
import { measure, font } from '../text.js'
import { isHighlighted, hasHighlight, formatterFor, refValues, humanize } from './common.js'

/** Assign lanes so logos at nearby values don't overlap (greedy, by value). */
function laneLayout(items, pos, size) {
  const lanes = []
  const out = []
  for (const it of [...items].sort((a, b) => pos(a) - pos(b))) {
    const p = pos(it)
    let lane = lanes.findIndex((last) => p - last >= size)
    if (lane === -1) { lane = lanes.length; lanes.push(p) } else lanes[lane] = p
    out.push({ ...it, lane, p })
  }
  return { placed: out, laneCount: lanes.length }
}

/** A label on a backing pill so logos underneath can't obscure it. */
function Tag({ x, y, text, anchor, size, color, theme, u }) {
  const w = measure(text, font(size, 800)) + 16 * u
  const h = size * 1.5
  const left = anchor === 'end' ? x - w : x
  return (
    <g>
      <rect x={left} y={y - h / 2} width={w} height={h} rx={h / 2} fill={theme.bg} opacity={0.92} />
      <text x={left + w / 2} y={y} dy="0.35em" textAnchor="middle" fontSize={size} fontWeight={800} fill={color}>{text}</text>
    </g>
  )
}

export default function LogoStrip({ box, spec, rows, theme, teams, logos, u }) {
  const e = spec.encoding
  const vKey = e.value
  const data = rows.filter((r) => typeof r[vKey] === 'number')
  if (!data.length) return null
  const fmtV = formatterFor(spec, vKey, data)
  const anyHl = hasHighlight(spec)
  const vertical = spec.aspect !== 'landscape'
  const vals = data.map((r) => r[vKey])
  const scale = scaleLinear().domain([Math.min(...vals), Math.max(...vals)]).nice(8)
  const ticks = scale.ticks(8)
  const tickFs = Math.round(36 * u)
  const tickW = Math.max(...ticks.map((t) => measure(fmtV(t), font(tickFs, 800)))) + 20 * u
  const refs = refValues(spec, 'value', data, vKey)
  const titleFs = Math.round(18 * u)

  if (vertical) {
    const top = box.y + 30 * u
    const bottom = box.y + box.h - 30 * u
    scale.range([bottom, top])
    let size = 64 * u
    let layout = laneLayout(data, (r) => -scale(r[vKey]), size * 0.9)
    const axisX = box.x + tickW + 12 * u
    const avail = box.w - (axisX - box.x) - 40 * u
    while (layout.laneCount * size * 1.1 > avail && size > 28 * u) {
      size -= 4 * u
      layout = laneLayout(data, (r) => -scale(r[vKey]), size * 0.9)
    }
    const laneX = (lane) => axisX + 36 * u + size / 2 + lane * size * 1.1
    return (
      <g>
        {spec.format.value_title && <text x={box.x} y={box.y - 8 * u} fontSize={titleFs} letterSpacing={2 * u} fill={theme.ink2} fontWeight={500}>{spec.format.value_title.toUpperCase()}</text>}
        <line x1={axisX} x2={axisX} y1={top - 10 * u} y2={bottom + 10 * u} stroke={theme.axis} strokeWidth={3 * u} />
        {ticks.map((t) => (
          <g key={t}>
            <line x1={axisX - 12 * u} x2={axisX} y1={scale(t)} y2={scale(t)} stroke={theme.axis} strokeWidth={3 * u} />
            <text x={axisX - 20 * u} y={scale(t)} dy="0.35em" textAnchor="end" fontSize={tickFs} fontWeight={800} fill={theme.ink}>{fmtV(t)}</text>
          </g>
        ))}
        {refs.map((r, i) => (
          <line key={i} x1={axisX} x2={box.x + box.w} y1={scale(r.value)} y2={scale(r.value)} stroke={theme.ink2} strokeWidth={2 * u} strokeDasharray={`${8 * u} ${6 * u}`} opacity={0.7} />
        ))}
        {layout.placed.sort((a, b) => isHighlighted(spec, a) - isHighlighted(spec, b)).map((r) => {
          const hl = anyHl && isHighlighted(spec, r)
          const cx = laneX(r.lane)
          const cy = scale(r[vKey])
          return (
            <g key={r[e.team]}>
              <Logo x={cx} y={cy} size={size} abbr={r[e.team]} logos={logos} teams={teams} opacity={anyHl && !hl ? 0.35 : 1} title={`${r[e.team]}: ${fmtV(r[vKey])}`} />
            </g>
          )
        })}
        {refs.map((r, i) => <Tag key={`ref${i}`} x={box.x + box.w} y={scale(r.value)} anchor="end" text={`${(r.label || 'Avg').toUpperCase()} ${fmtV(r.value)}`} size={16 * u} color={theme.ink2} theme={theme} u={u} />)}
        {anyHl && layout.placed.filter((r) => isHighlighted(spec, r)).map((r) => (
          <Tag key={`hl${r[e.team]}`} x={laneX(r.lane) + size * 0.62} y={scale(r[vKey])} anchor="start" text={`${r[e.team]} ${fmtV(r[vKey])}`} size={24 * u} color={theme.highlight} theme={theme} u={u} />
        ))}
      </g>
    )
  }

  // horizontal (landscape): axis along the bottom, lanes stack upward
  const axisY = box.y + box.h - tickFs - 24 * u
  const left = box.x + 30 * u
  const right = box.x + box.w - 30 * u
  scale.range([left, right])
  let size = 64 * u
  let layout = laneLayout(data, (r) => scale(r[vKey]), size * 0.9)
  const avail = axisY - box.y - 30 * u
  while (layout.laneCount * size * 1.1 > avail && size > 28 * u) {
    size -= 4 * u
    layout = laneLayout(data, (r) => scale(r[vKey]), size * 0.9)
  }
  return (
    <g>
      <text x={box.x} y={box.y} dy="0.8em" fontSize={titleFs} letterSpacing={2 * u} fill={theme.ink2} fontWeight={500}>{(spec.format.value_title || humanize(vKey)).toUpperCase()}</text>
      <line x1={left - 10 * u} x2={right + 10 * u} y1={axisY} y2={axisY} stroke={theme.axis} strokeWidth={3 * u} />
      {ticks.map((t) => (
        <g key={t}>
          <line x1={scale(t)} x2={scale(t)} y1={axisY} y2={axisY + 12 * u} stroke={theme.axis} strokeWidth={3 * u} />
          <text x={scale(t)} y={axisY + 18 * u} dy="0.8em" textAnchor="middle" fontSize={tickFs * 0.8} fontWeight={800} fill={theme.ink}>{fmtV(t)}</text>
        </g>
      ))}
      {refs.map((r, i) => (
        <line key={i} x1={scale(r.value)} x2={scale(r.value)} y1={box.y + 30 * u} y2={axisY} stroke={theme.ink2} strokeWidth={2 * u} strokeDasharray={`${8 * u} ${6 * u}`} opacity={0.7} />
      ))}
      {layout.placed.map((r) => {
        const hl = anyHl && isHighlighted(spec, r)
        return <Logo key={r[e.team]} x={scale(r[vKey])} y={axisY - 30 * u - size / 2 - r.lane * size * 1.1} size={size} abbr={r[e.team]} logos={logos} teams={teams} opacity={anyHl && !hl ? 0.35 : 1} title={`${r[e.team]}: ${fmtV(r[vKey])}`} />
      })}
    </g>
  )
}
