import { FONT_SANS } from './fonts.js'
import { inkOn } from './theme.js'

/** Team logo from a data URL; falls back to a colored disc with the abbreviation. */
export function Logo({ x, y, size, abbr, logos, teams, opacity = 1, title }) {
  const href = logos?.[abbr]
  const t = teams?.[abbr]
  if (href) {
    return (
      <image href={href} x={x - size / 2} y={y - size / 2} width={size} height={size} opacity={opacity} preserveAspectRatio="xMidYMid meet">
        {title && <title>{title}</title>}
      </image>
    )
  }
  const fill = t?.team_color || '#888888'
  return (
    <g opacity={opacity}>
      {title && <title>{title}</title>}
      <circle cx={x} cy={y} r={size / 2.2} fill={fill} />
      <text x={x} y={y} dy="0.35em" textAnchor="middle" fontFamily={FONT_SANS} fontWeight={800} fontSize={size * 0.3} fill={inkOn(fill)}>{abbr}</text>
    </g>
  )
}

/** Multi-line text from pre-wrapped lines. */
export function Lines({ x, y, lines, size, lineHeight = 1.3, anchor = 'start', ...rest }) {
  return (
    <text x={x} y={y} fontSize={size} textAnchor={anchor} {...rest}>
      {lines.map((l, i) => <tspan key={i} x={x} dy={i === 0 ? '0.8em' : `${lineHeight}em`}>{l}</tspan>)}
    </text>
  )
}

