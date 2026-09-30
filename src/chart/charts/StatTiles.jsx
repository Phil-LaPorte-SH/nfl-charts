import { FONT_SANS } from '../fonts.js'
import { fitSize, wrap, font } from '../text.js'

export default function StatTiles({ box, spec, theme, u }) {
  const k = spec.kpis
  if (!k.length) return null
  const cols = k.length === 1 ? 1 : k.length === 3 && spec.aspect === 'landscape' ? 3 : 2
  const rowsN = Math.ceil(k.length / cols)
  const gap = 24 * u
  const tw = (box.w - gap * (cols - 1)) / cols
  const th = Math.min((box.h - gap * (rowsN - 1)) / rowsN, 520 * u)
  const oy = box.y + (box.h - (th * rowsN + gap * (rowsN - 1))) / 2
  return (
    <g>
      {k.map((t, i) => {
        const cx = box.x + (i % cols) * (tw + gap)
        const cy = oy + Math.floor(i / cols) * (th + gap)
        const pad = 36 * u
        const vs = fitSize(t.value, 800, FONT_SANS, tw - pad * 2, Math.min(200 * u, th * 0.42), 40 * u)
        const ls = Math.round(24 * u)
        const sub = t.sublabel ? wrap(t.sublabel, font(26 * u), tw - pad * 2, 2) : []
        return (
          <g key={i}>
            <rect x={cx} y={cy} width={tw} height={th} rx={20 * u} fill={theme.tile} />
            <text x={cx + pad} y={cy + pad} dy="0.8em" fontSize={ls} letterSpacing={2.5 * u} fontWeight={600} fill={theme.ink2}>
              {wrap(t.label.toUpperCase(), font(ls, 600), tw - pad * 2, 1)[0]}
            </text>
            <text x={cx + pad} y={cy + th / 2 + vs * 0.3} fontSize={vs} fontWeight={800} fill={theme.highlight || theme.accent}>{t.value}</text>
            {sub.map((s, j) => <text key={j} x={cx + pad} y={cy + th - pad - (sub.length - 1 - j) * 34 * u} fontSize={26 * u} fill={theme.ink2}>{s}</text>)}
          </g>
        )
      })}
    </g>
  )
}
