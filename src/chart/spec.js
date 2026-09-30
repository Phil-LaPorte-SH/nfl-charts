import { FORMATS } from './format.js'

/*
 * chart_spec: the contract between the model (render_chart tool) and the
 * renderer. Every property is required and optional ones are nullable, so the
 * schema works with strict tool use. Rows are NOT in the spec; `result_id`
 * points at a stored execute_sql result.
 */
export const CHART_TYPES = ['ranked_bar', 'logo_strip', 'logo_scatter', 'line', 'grouped_bar', 'stacked_bar', 'donut', 'table', 'stat_tiles']
export const ASPECTS = ['portrait', 'square', 'landscape', 'story']
const nstr = { type: ['string', 'null'] }
const fmtEnum = { type: ['string', 'null'], enum: [...FORMATS, null] }

export const CHART_SPEC_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['type', 'title', 'title_accent', 'subtitle', 'caption', 'aspect', 'theme', 'result_id', 'encoding',
    'highlight', 'kpis', 'reference_lines', 'quadrants', 'format', 'columns', 'footnote', 'source'],
  properties: {
    type: { type: 'string', enum: CHART_TYPES },
    title: { type: 'string', description: 'Short, punchy headline (2-5 words works best).' },
    title_accent: { ...nstr, description: 'A word or phrase inside title to set in the accent color, e.g. "Flags".' },
    subtitle: { ...nstr, description: 'What is measured, scope and date range, in one or two sentences.' },
    caption: { type: 'string', description: 'The plain-English answer to the question in 1-2 sentences, shown under the chart in the app (not on the poster).' },
    aspect: { type: 'string', enum: ASPECTS },
    theme: {
      type: 'object', additionalProperties: false, required: ['mode', 'team'],
      properties: {
        mode: { type: 'string', enum: ['team', 'light', 'dark'] },
        team: { ...nstr, description: 'Team abbreviation for mode=team (poster in that team\'s colors).' },
      },
    },
    result_id: { ...nstr, description: 'The result_id returned by execute_sql whose rows the chart plots. Null only for stat_tiles.' },
    encoding: {
      type: 'object', additionalProperties: false,
      required: ['label', 'value', 'secondary', 'team', 'x', 'y', 'series', 'sort'],
      properties: {
        label: { ...nstr, description: 'Category / row label column.' },
        value: { ...nstr, description: 'Primary numeric column.' },
        secondary: { ...nstr, description: 'ranked_bar right-hand context column (e.g. "77 in 157").' },
        team: { ...nstr, description: 'Column holding team abbreviations (enables logos and team colors).' },
        x: { ...nstr, description: 'x column (scatter, line).' },
        y: { ...nstr, description: 'y column (scatter, line).' },
        series: { ...nstr, description: 'Series column (line, grouped_bar, stacked_bar).' },
        sort: { type: 'string', enum: ['desc', 'asc', 'none'] },
      },
    },
    highlight: {
      type: 'object', additionalProperties: false, required: ['teams', 'labels'],
      properties: {
        teams: { type: 'array', items: { type: 'string' }, description: 'Team abbreviations to emphasize; others are muted.' },
        labels: { type: 'array', items: { type: 'string' }, description: 'Label values to emphasize when not using teams.' },
      },
    },
    kpis: {
      type: 'array',
      description: '0-4 headline tiles shown above the chart (required 1-4 for stat_tiles). Values are preformatted strings.',
      items: {
        type: 'object', additionalProperties: false, required: ['label', 'value', 'sublabel'],
        properties: { label: { type: 'string' }, value: { type: 'string' }, sublabel: nstr },
      },
    },
    reference_lines: {
      type: 'array',
      description: 'Dashed threshold lines. Use stat="mean" to have the renderer compute the average of the plotted data.',
      items: {
        type: 'object', additionalProperties: false, required: ['axis', 'value', 'stat', 'label'],
        properties: {
          axis: { type: 'string', enum: ['x', 'y', 'value'] },
          value: { type: ['number', 'null'] },
          stat: { type: ['string', 'null'], enum: ['mean', 'median', null] },
          label: nstr,
        },
      },
    },
    quadrants: {
      type: ['object', 'null'], additionalProperties: false,
      required: ['top_right', 'top_left', 'bottom_right', 'bottom_left'],
      description: 'logo_scatter only: labels for the four regions split by the reference lines.',
      properties: { top_right: nstr, top_left: nstr, bottom_right: nstr, bottom_left: nstr },
    },
    format: {
      type: 'object', additionalProperties: false,
      required: ['value', 'secondary', 'x', 'y', 'value_suffix', 'value_title', 'secondary_title', 'x_title', 'y_title'],
      properties: {
        value: fmtEnum, secondary: fmtEnum, x: fmtEnum, y: fmtEnum,
        value_suffix: { ...nstr, description: 'e.g. " yds"' },
        value_title: { ...nstr, description: 'Column header / axis title for the value, e.g. "Drawn by offense, per 17 games".' },
        secondary_title: { ...nstr, description: 'Header for the secondary column, e.g. "Total / games".' },
        x_title: { ...nstr, description: 'Axis title with a direction hint, e.g. "Rush EPA per play → more efficient".' },
        y_title: nstr,
      },
    },
    columns: { type: ['array', 'null'], items: { type: 'string' }, description: 'table only: columns to show, in order.' },
    footnote: { ...nstr, description: 'Methodology: filters, what counts, date cut-off.' },
    source: { type: 'string', description: 'e.g. "nflverse play-by-play"' },
  },
}

const EMPTY_ENCODING = { label: null, value: null, secondary: null, team: null, x: null, y: null, series: null, sort: 'none' }
const EMPTY_FORMAT = { value: null, secondary: null, x: null, y: null, value_suffix: null, value_title: null, secondary_title: null, x_title: null, y_title: null }

/** Fill defaults so a partial or hand-edited spec is always renderable. Idempotent. */
export function normalizeSpec(spec) {
  const s = spec || {}
  return {
    type: CHART_TYPES.includes(s.type) ? s.type : 'table',
    title: s.title || 'Untitled',
    title_accent: s.title_accent || null,
    subtitle: s.subtitle ?? null,
    caption: s.caption || '',
    aspect: ASPECTS.includes(s.aspect) ? s.aspect : 'portrait',
    theme: { mode: ['team', 'light', 'dark'].includes(s.theme?.mode) ? s.theme.mode : 'light', team: s.theme?.team || null },
    result_id: s.result_id ?? null,
    encoding: { ...EMPTY_ENCODING, ...(s.encoding || {}) },
    highlight: { teams: s.highlight?.teams || [], labels: s.highlight?.labels || [] },
    kpis: Array.isArray(s.kpis) ? s.kpis.slice(0, 4).map((k) => ({ label: k.label || '', value: String(k.value ?? ''), sublabel: k.sublabel ?? null })) : [],
    reference_lines: Array.isArray(s.reference_lines) ? s.reference_lines : [],
    quadrants: s.quadrants || null,
    format: { ...EMPTY_FORMAT, ...(s.format || {}) },
    columns: s.columns || null,
    footnote: s.footnote ?? null,
    source: s.source || 'nflverse',
  }
}

const REQUIRES = {
  ranked_bar: ['label|team', 'value'],
  logo_strip: ['team', 'value'],
  logo_scatter: ['team', 'x', 'y'],
  line: ['x', 'y'],
  grouped_bar: ['label', 'value', 'series'],
  stacked_bar: ['label', 'value', 'series'],
  donut: ['label|team', 'value'],
  table: [],
  stat_tiles: [],
}

/** Returns a list of human-readable problems (empty = valid). */
export function validateSpec(raw, results) {
  const s = normalizeSpec(raw)
  const errs = []
  if (s.type === 'stat_tiles') {
    if (!s.kpis.length) errs.push('stat_tiles needs 1-4 kpis.')
    return errs
  }
  if (!s.result_id) return ['result_id is required (use the result_id returned by execute_sql).']
  const res = results?.[s.result_id]
  if (!res) return [`Unknown result_id "${s.result_id}". Valid ids: ${Object.keys(results || {}).join(', ') || 'none yet'}.`]
  const cols = new Set(res.columns.map((c) => c.name))
  for (const req of REQUIRES[s.type]) {
    const options = req.split('|')
    if (!options.some((k) => s.encoding[k])) errs.push(`${s.type} needs encoding.${options.join(' or encoding.')}.`)
  }
  for (const [k, v] of Object.entries(s.encoding)) {
    if (k !== 'sort' && v && !cols.has(v)) errs.push(`encoding.${k} = "${v}" is not a column of ${s.result_id}. Columns: ${[...cols].join(', ')}.`)
  }
  for (const c of s.columns || []) if (!cols.has(c)) errs.push(`columns: "${c}" is not a column of ${s.result_id}.`)
  const n = res.rows.length
  const distinct = (col) => new Set(res.rows.map((r) => r[res.columns.findIndex((c) => c.name === col)])).size
  if (n === 0) errs.push('The result has no rows; nothing to chart.')
  if (s.type === 'ranked_bar' && n > 40) errs.push(`ranked_bar shows at most 40 rows; the result has ${n}. Filter or LIMIT.`)
  if (s.type === 'logo_strip' && n > 40) errs.push(`logo_strip shows at most 40 teams; the result has ${n}.`)
  if (s.type === 'donut' && n > 6) errs.push(`donut supports at most 6 slices; the result has ${n}. Use ranked_bar, or fold small slices into "Other" in SQL.`)
  if (['line', 'grouped_bar', 'stacked_bar'].includes(s.type) && s.encoding.series && cols.has(s.encoding.series) && distinct(s.encoding.series) > 8) {
    errs.push(`${s.type} supports at most 8 series; ${s.encoding.series} has ${distinct(s.encoding.series)}.`)
  }
  if (s.type === 'logo_scatter' && s.quadrants && !s.reference_lines.some((l) => l.axis === 'x') ) errs.push('quadrants need an x reference line (add {axis:"x", stat:"mean"}).')
  if (s.type === 'logo_scatter' && s.quadrants && !s.reference_lines.some((l) => l.axis === 'y')) errs.push('quadrants need a y reference line (add {axis:"y", stat:"mean"}).')
  return errs
}

/** Chart types this spec's data can be switched to without re-querying. */
export function compatibleTypes(raw, result) {
  const s = normalizeSpec(raw)
  if (!result) return ['stat_tiles']
  const cols = result.columns.map((c) => c.name)
  const numeric = result.columns.filter((c, i) => result.rows.some((r) => typeof r[i] === 'number')).map((c) => c.name)
  const e = s.encoding
  const hasTeam = !!(e.team && cols.includes(e.team))
  const value = e.value || e.y
  const n = result.rows.length
  const out = ['table']
  if ((e.label || hasTeam) && value && n <= 40) out.push('ranked_bar')
  if (hasTeam && value && n <= 40) out.push('logo_strip')
  if (hasTeam && numeric.length >= 2) out.push('logo_scatter')
  if (e.x && e.y) out.push('line')
  if (e.label && value && e.series) out.push('grouped_bar', 'stacked_bar')
  if ((e.label || hasTeam) && value && n <= 6) out.push('donut')
  if (s.kpis.length) out.push('stat_tiles')
  return CHART_TYPES.filter((t) => out.includes(t))
}

/** When switching type in the editor, fill encodings the new type needs. */
export function adaptSpecToType(raw, type, result) {
  const s = normalizeSpec(raw)
  const e = { ...s.encoding }
  const numeric = result ? result.columns.filter((c, i) => result.rows.some((r) => typeof r[i] === 'number')).map((c) => c.name) : []
  if (['ranked_bar', 'logo_strip', 'donut'].includes(type)) {
    e.value = e.value || e.y || numeric[0] || null
    if (e.sort === 'none') e.sort = 'desc'
  }
  if (type === 'logo_scatter') {
    e.x = e.x || numeric.find((c) => c !== e.value) || null
    e.y = e.y || e.value || numeric[0] || null
  }
  if (type === 'line') {
    e.x = e.x || e.label || null
    e.y = e.y || e.value || null
  }
  return { ...s, type, encoding: e }
}
