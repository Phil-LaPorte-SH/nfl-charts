import { forwardRef, useMemo } from 'react'
import { ASPECT_SIZES } from './layout.js'
import { FONT_DISPLAY, FONT_SANS } from './fonts.js'
import { resolveTheme } from './theme.js'
import { wrap, fitSize, font, measure } from './text.js'
import { Lines } from './primitives.jsx'
import RankedBar from './charts/RankedBar.jsx'
import LogoStrip from './charts/LogoStrip.jsx'
import LogoScatter from './charts/LogoScatter.jsx'
import LineChart from './charts/LineChart.jsx'
import { GroupedBar, StackedBar } from './charts/Columns.jsx'
import Donut from './charts/Donut.jsx'
import TableChart from './charts/TableChart.jsx'
import StatTiles from './charts/StatTiles.jsx'

const CHARTS = {
  ranked_bar: RankedBar, logo_strip: LogoStrip, logo_scatter: LogoScatter, line: LineChart,
  grouped_bar: GroupedBar, stacked_bar: StackedBar, donut: Donut, table: TableChart, stat_tiles: StatTiles,
}

function toObjects(result) {
  if (!result) return []
  return result.rows.map((r) => Object.fromEntries(result.columns.map((c, i) => [c.name, r[i]])))
}

/**
 * A complete poster as one self-contained <svg>. Pure function of its props,
 * so edits re-render instantly and the same element is what gets exported.
 */
const Poster = forwardRef(function Poster({ spec, result, teams, logos, fontsReady }, ref) {
  const [W, H] = ASPECT_SIZES[spec.aspect] || ASPECT_SIZES.portrait
  const u = Math.min(W / 1080, H / 1080)
  const theme = useMemo(() => resolveTheme(spec, teams), [spec, teams])
  const rows = useMemo(() => toObjects(result), [result])

  // measurement depends on fonts being loaded
  const layout = useMemo(() => {
    const pad = Math.round(64 * u)
    const innerW = W - pad * 2
    let y = pad
    // title: one line if it fits at a readable size, else wrap to two
    const maxTitle = Math.round((spec.aspect === 'story' ? 128 : spec.aspect === 'landscape' ? 104 : 116) * u)
    let titleSize = fitSize(spec.title, 800, FONT_DISPLAY, innerW, maxTitle, Math.round(64 * u))
    let titleLines = [spec.title]
    if (measure(spec.title, `800 ${titleSize}px ${FONT_DISPLAY}`) > innerW) {
      titleSize = Math.round(76 * u)
      titleLines = wrap(spec.title, `800 ${titleSize}px ${FONT_DISPLAY}`, innerW, 2)
    }
    const titleY = y
    y += titleLines.length * titleSize * 0.98
    const subSize = Math.round(30 * u)
    const subLines = spec.subtitle ? wrap(spec.subtitle, font(subSize, 400, FONT_SANS), innerW, 3) : []
    const subY = y + Math.round(14 * u)
    if (subLines.length) y = subY + subLines.length * subSize * 1.3
    y += Math.round(36 * u)

    const showKpis = spec.type !== 'stat_tiles' && spec.kpis.length > 0
    const kpiH = Math.round(160 * u)
    const kpiY = y
    if (showKpis) y += kpiH + Math.round(36 * u)

    const footSize = Math.round(20 * u)
    const footLines = spec.footnote ? wrap(spec.footnote, font(footSize, 400, FONT_SANS), innerW, 3) : []
    const footH = Math.round(24 * u) + footLines.length * footSize * 1.4 + footSize * 1.5 + pad * 0.6
    const footY = H - footH
    const body = { x: pad, y, w: innerW, h: Math.max(80, footY - y - Math.round(28 * u)) }
    return { pad, innerW, titleSize, titleLines, titleY, subSize, subLines, subY, showKpis, kpiH, kpiY, footSize, footLines, footY, body }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec, W, H, u, fontsReady])

  const Chart = CHARTS[spec.type] || TableChart
  const L = layout

  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="poster" role="img" aria-label={spec.title} fontFamily={FONT_SANS} style={{ fontVariantNumeric: 'normal' }}>
      <rect width={W} height={H} fill={theme.bg} />
      <TitleText lines={L.titleLines} x={L.pad} y={L.titleY} size={L.titleSize} accent={spec.title_accent} ink={theme.ink} accentColor={theme.highlight || theme.accent} />
      {L.subLines.length > 0 && (
        <Lines x={L.pad} y={L.subY} lines={L.subLines} size={L.subSize} fill={theme.ink2} fontFamily={FONT_SANS} />
      )}
      {L.showKpis && <KpiRow kpis={spec.kpis} x={L.pad} y={L.kpiY} w={L.innerW} h={L.kpiH} theme={theme} u={u} />}
      <Chart box={L.body} spec={spec} rows={rows} result={result} theme={theme} teams={teams} logos={logos} u={u} />
      <line x1={L.pad} x2={W - L.pad} y1={L.footY} y2={L.footY} stroke={theme.grid} strokeWidth={Math.max(1, 1.5 * u)} />
      {L.footLines.length > 0 && (
        <Lines x={L.pad} y={L.footY + 20 * u} lines={L.footLines} size={L.footSize} lineHeight={1.4} fill={theme.ink2} />
      )}
      <text x={L.pad} y={L.footY + 20 * u + L.footLines.length * L.footSize * 1.4 + L.footSize * (L.footLines.length ? 0.6 : 0)} dy="0.8em" fontSize={L.footSize} fill={theme.ink2}>
        <tspan fontWeight={700} fill={theme.ink}>Source: </tspan>{spec.source}
      </text>
    </svg>
  )
})
export default Poster

function TitleText({ lines, x, y, size, accent, ink, accentColor }) {
  return (
    <text x={x} y={y} fontFamily={FONT_DISPLAY} fontWeight={800} fontSize={size} fill={ink} letterSpacing={-0.5}>
      {lines.map((line, i) => {
        const idx = accent ? line.toLowerCase().indexOf(accent.toLowerCase()) : -1
        const dy = i === 0 ? '0.82em' : '0.98em'
        if (idx < 0) return <tspan key={i} x={x} dy={dy}>{line}</tspan>
        return (
          <tspan key={i} x={x} dy={dy}>
            {line.slice(0, idx)}<tspan fill={accentColor}>{line.slice(idx, idx + accent.length)}</tspan>{line.slice(idx + accent.length)}
          </tspan>
        )
      })}
    </text>
  )
}

function KpiRow({ kpis, x, y, w, h, theme, u }) {
  const gap = Math.round(20 * u)
  const n = kpis.length
  const tw = (w - gap * (n - 1)) / n
  const pad = Math.round(26 * u)
  return (
    <g>
      {kpis.map((k, i) => {
        const tx = x + i * (tw + gap)
        const labelSize = Math.round(19 * u)
        const valueSize = fitSize(k.value, 800, FONT_SANS, tw - pad * 2, Math.round(68 * u), Math.round(30 * u))
        const sub = k.sublabel ? wrap(k.sublabel, font(Math.round(22 * u)), tw - pad * 2, 1)[0] : null
        return (
          <g key={i}>
            <rect x={tx} y={y} width={tw} height={h} rx={16 * u} fill={theme.tile} />
            <text x={tx + pad} y={y + pad} dy="0.8em" fontSize={labelSize} letterSpacing={2 * u} fill={theme.ink2} fontWeight={500}>
              {wrap(k.label.toUpperCase(), font(labelSize, 500), tw - pad * 2, 1)[0]}
            </text>
            <text x={tx + pad} y={y + pad + labelSize * 1.5} dy="0.8em" fontSize={valueSize} fontWeight={800} fill={theme.highlight || theme.accent}>{k.value}</text>
            {sub && <text x={tx + pad} y={y + h - pad} fontSize={Math.round(22 * u)} fill={theme.ink2}>{sub}</text>}
          </g>
        )
      })}
    </g>
  )
}
