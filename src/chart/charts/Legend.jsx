import { measure, font } from '../text.js'

/** One-row (wrapping) legend: colored key beside ink text. Returns { el, h }. */
export function legendLayout(items, box, u, theme, kind = 'swatch') {
  const fs = Math.round(20 * u)
  const gap = 28 * u
  const key = 22 * u
  let x = box.x
  let y = box.y
  const placed = []
  for (const it of items) {
    const w = key + 8 * u + measure(it.label, font(fs, 600))
    if (x + w > box.x + box.w && x > box.x) { x = box.x; y += fs * 1.6 }
    placed.push({ ...it, x, y })
    x += w + gap
  }
  const h = items.length ? y - box.y + fs * 1.6 : 0
  const el = (
    <g>
      {placed.map((p, i) => (
        <g key={i} opacity={p.muted ? 0.55 : 1}>
          {kind === 'line'
            ? <line x1={p.x} x2={p.x + key} y1={p.y + fs * 0.55} y2={p.y + fs * 0.55} stroke={p.color} strokeWidth={4 * u} strokeLinecap="round" />
            : <rect x={p.x} y={p.y + fs * 0.1} width={key * 0.8} height={key * 0.8} rx={4 * u} fill={p.color} />}
          <text x={p.x + key + 8 * u} y={p.y} dy="0.85em" fontSize={fs} fontWeight={600} fill={theme.ink}>{p.label}</text>
        </g>
      ))}
    </g>
  )
  return { el, h }
}
