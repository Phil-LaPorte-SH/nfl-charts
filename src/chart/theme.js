import { contrast, mix, luminance } from './color.js'

// Categorical order from the dataviz reference palette (validated for CVD on
// adjacent pairs); used when series are not teams.
export const SERIES_LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948']
export const SERIES_DARK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767']

const GOLD = '#FFB81C'

const LIGHT = {
  mode: 'light', bg: '#fcfcfb', ink: '#0b0b0b', ink2: '#52514e', muted: '#898781',
  grid: '#e1e0d9', axis: '#c3c2b7', tile: '#f0efec', bar: '#c9c7c0', barNoHighlight: '#2a78d6',
  accent: '#2a78d6', series: SERIES_LIGHT, band: '#f0efec',
}
const DARK = {
  mode: 'dark', bg: '#1a1a19', ink: '#ffffff', ink2: '#c3c2b7', muted: '#898781',
  grid: '#2c2c2a', axis: '#383835', tile: '#242423', bar: '#55544f', barNoHighlight: '#3987e5',
  accent: '#3987e5', series: SERIES_DARK, band: '#242423',
}

/** Pick the first candidate that clears `min` contrast against bg. */
function pickContrasting(bg, candidates, min = 3) {
  return candidates.find((c) => c && contrast(c, bg) >= min) || candidates[candidates.length - 1]
}

/**
 * Resolve the poster palette. `teams` is the team index (abbr -> row).
 * Colors are returned as plain values (not CSS variables) so an exported SVG
 * is self-contained.
 */
export function resolveTheme(spec, teams) {
  const mode = spec.theme?.mode || 'light'
  const hlTeam = spec.highlight?.teams?.[0]
  const hl = hlTeam && teams?.[hlTeam]

  if (mode === 'team') {
    const t = teams?.[spec.theme.team] || hl
    if (t?.team_color) {
      const bg = t.team_color
      const darkBg = luminance(bg) < 0.35
      const ink = darkBg ? '#ffffff' : '#0b0b0b'
      // A team's own secondary color is its brand pairing (Chiefs gold on red),
      // so accept 2:1 here; big bold text and bars still read clearly.
      const accent = pickContrasting(bg, [t.team_color2, GOLD, darkBg ? '#ffffff' : '#0b0b0b'], 2)
      return {
        mode, bg, ink,
        ink2: mix(ink, bg, 0.18), muted: mix(ink, bg, 0.35),
        grid: mix(ink, bg, 0.82), axis: mix(ink, bg, 0.6),
        tile: mix(bg, '#000000', darkBg ? 0.16 : 0.08), band: mix(bg, '#000000', darkBg ? 0.16 : 0.08),
        bar: mix(ink, bg, 0.1), barNoHighlight: mix(ink, bg, 0.1),
        accent, highlight: accent,
        // distinct lightness steps that all read on the team color
        series: [accent, ink, mix(ink, bg, 0.5), mix(bg, '#000000', 0.5), mix(ink, bg, 0.75), mix(bg, '#000000', 0.25)],
        team: t.team_abbr,
      }
    }
  }
  const base = mode === 'dark' ? DARK : LIGHT
  // In light/dark mode the highlighted team wears its own color when it reads.
  const highlight = hl ? pickContrasting(base.bg, [hl.team_color, hl.team_color2, base.accent], 3) : base.accent
  return { ...base, highlight }
}

/** Text color that reads on top of a fill. */
export const inkOn = (fill) => (luminance(fill) > 0.45 ? '#0b0b0b' : '#ffffff')

/** Series color for a series key: team colors for teams, palette otherwise. */
export function seriesColor(theme, key, index, teams) {
  const t = teams?.[key]
  if (t) return pickContrasting(theme.bg, [t.team_color, t.team_color2, theme.series[index % theme.series.length]], 2)
  return theme.series[index % theme.series.length]
}
