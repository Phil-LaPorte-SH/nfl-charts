import { runQuery, describeView, QueryError } from '../db/query.js'
import { VIEW_NAMES } from '../db/datasets.js'
import { CHART_SPEC_SCHEMA, validateSpec, normalizeSpec } from '../chart/spec.js'

const MAX_STORED_ROWS = 500
const MAX_SENT_ROWS = 40

// Tool order is fixed: tools render first in the prompt, so any change here
// invalidates the prompt cache.
export const TOOLS = [
  {
    name: 'execute_sql',
    description: 'Run one read-only DuckDB SELECT (WITH allowed) against the NFL views and get the rows back. '
      + 'Returns a result_id you pass to render_chart, the column names/types, and up to 40 rows (the chart can use up to 500). '
      + 'Errors come back as text; fix the SQL and retry.',
    strict: true,
    eager_input_streaming: true,
    input_schema: {
      type: 'object', additionalProperties: false, required: ['query'],
      properties: { query: { type: 'string', description: 'A single DuckDB SELECT statement.' } },
    },
  },
  {
    name: 'find_player',
    description: 'Resolve a player name (full, partial, or misspelled) to gsis_id player ids. Always use this before filtering by a player, '
      + 'then filter on the id column (player_id in stats views, *_player_id in pbp), never on names: names repeat (there are two Lamar Jacksons).',
    strict: true,
    input_schema: {
      type: 'object', additionalProperties: false, required: ['name', 'position'],
      properties: {
        name: { type: 'string' },
        position: { type: ['string', 'null'], description: 'Optional position filter such as QB, RB, WR, TE, K, or a defensive position.' },
      },
    },
  },
  {
    name: 'describe_columns',
    description: 'List columns (name and type) of a view whose names match a regex. Use when you need a column that is not documented in the prompt.',
    strict: true,
    input_schema: {
      type: 'object', additionalProperties: false, required: ['table', 'pattern'],
      properties: {
        table: { type: 'string', enum: VIEW_NAMES },
        pattern: { type: 'string', description: 'Case-insensitive regex, e.g. "penalty|flag". Use ".*" for all.' },
      },
    },
  },
  {
    name: 'render_chart',
    description: 'Render the answer as a share-ready poster from a stored execute_sql result. Call it once, after the data is final. '
      + 'Returns "ok" or a list of problems to fix.',
    strict: true,
    input_schema: {
      type: 'object', additionalProperties: false, required: ['spec'],
      properties: { spec: CHART_SPEC_SCHEMA },
    },
  },
]

const esc = (s) => String(s).replace(/'/g, "''")

async function findPlayer({ name, position }, signal) {
  const n = esc(String(name || '').trim().toLowerCase())
  if (!n) return { error: 'name is required' }
  const pos = position ? `AND (position = '${esc(position.toUpperCase())}' OR position_group = '${esc(position.toUpperCase())}')` : ''
  const res = await runQuery(`
    WITH p AS (
      SELECT gsis_id, display_name, position, latest_team, rookie_season, last_season,
             greatest(jaro_winkler_similarity(lower(display_name), '${n}'),
                      jaro_winkler_similarity(lower(last_name), '${n}') - 0.05) AS sim
      FROM players WHERE gsis_id IS NOT NULL ${pos}
    ), s AS (
      SELECT player_id, min(season) AS first_season, max(season) AS last_stat_season,
             string_agg(DISTINCT team, ',' ORDER BY team) AS teams, count(DISTINCT season) AS seasons
      FROM player_season WHERE player_id IN (SELECT gsis_id FROM p WHERE sim > 0.8 OR lower(display_name) LIKE '%${n}%')
      GROUP BY 1
    )
    SELECT p.gsis_id, p.display_name, p.position, p.latest_team, s.first_season, s.last_stat_season, s.teams, round(p.sim, 3) AS match
    FROM p LEFT JOIN s ON s.player_id = p.gsis_id
    WHERE p.sim > 0.8 OR lower(p.display_name) LIKE '%${n}%'
    ORDER BY (s.seasons IS NOT NULL) DESC, p.sim DESC, s.seasons DESC NULLS LAST
    LIMIT 8`, { signal, maxRows: 8 })
  return { matches: res.rows.map((r) => Object.fromEntries(res.columns.map((c, i) => [c.name, r[i]]))) }
}

/**
 * Execute one tool_use block. Returns a tool_result content block.
 * ctx: { results: {id: result}, nextId(): string, onResult(id, result, sql), onChart(spec), signal }
 */
export async function executeTool(block, ctx) {
  const input = block.input && typeof block.input === 'object' ? block.input : {}
  const reply = (obj, isError = false) => ({
    type: 'tool_result', tool_use_id: block.id,
    content: typeof obj === 'string' ? obj : JSON.stringify(obj),
    ...(isError ? { is_error: true } : {}),
  })
  try {
    switch (block.name) {
      case 'execute_sql': {
        if (typeof input.query !== 'string' || !input.query.trim()) return reply('query must be a non-empty string', true)
        const res = await runQuery(input.query, { maxRows: MAX_STORED_ROWS, timeoutMs: 90_000, signal: ctx.signal })
        const id = ctx.nextId()
        const stored = { ...res, sql: input.query }
        ctx.results[id] = stored
        ctx.onResult?.(id, stored)
        return reply({
          result_id: id,
          row_count: res.rowCount,
          truncated: res.truncated,
          columns: res.columns.map((c) => `${c.name}:${c.type}`),
          rows: res.rows.slice(0, MAX_SENT_ROWS),
          ...(res.rowCount > MAX_SENT_ROWS ? { note: `showing first ${MAX_SENT_ROWS} of ${res.rowCount} rows` } : {}),
        })
      }
      case 'find_player':
        return reply(await findPlayer(input, ctx.signal))
      case 'describe_columns': {
        if (!VIEW_NAMES.includes(input.table)) return reply(`table must be one of ${VIEW_NAMES.join(', ')}`, true)
        let re
        try { re = new RegExp(input.pattern || '.*', 'i') } catch { return reply('invalid regex', true) }
        const cols = (await describeView(input.table)).filter((c) => re.test(c.name))
        return reply(cols.length ? cols.map((c) => `${c.name} ${c.type}`).join('\n') : 'no matching columns')
      }
      case 'render_chart': {
        const errs = validateSpec(input.spec, ctx.results)
        if (errs.length) return reply(`Fix these and call render_chart again:\n- ${errs.join('\n- ')}`, true)
        ctx.onChart?.(normalizeSpec(input.spec))
        return reply('ok: chart rendered and shown to the user.')
      }
      default:
        return reply(`unknown tool ${block.name}`, true)
    }
  } catch (e) {
    if (e?.name === 'AbortError') throw e
    const msg = e instanceof QueryError ? e.message : String(e?.message || e)
    return reply(`Error: ${msg}`, true)
  }
}
