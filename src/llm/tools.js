import { runQuery, describeView, QueryError } from '../db/query.js'
import { VIEW_NAMES } from '../db/viewNames.js'
import { validateSpec, normalizeSpec } from '../chart/spec.js'
import { TOOLS } from './toolDefs.js'

export { TOOLS }

const MAX_STORED_ROWS = 500
const MAX_SENT_ROWS = 40
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
        return reply('ok: the chart and its caption are now on screen. End your turn now with no further text; do not restate the numbers.')
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
