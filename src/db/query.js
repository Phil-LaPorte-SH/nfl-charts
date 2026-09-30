import { getConn, resetDb } from './duckdb.js'
import { ensureViewsFor, forgetViews } from './datasets.js'
import { toPlain, typeLabel } from './arrow.js'

export class QueryError extends Error {}

const LEAD = /^\s*(select|with|describe|summarize|from)\b/i

/** Reject anything but a single read-only statement. */
export function checkReadOnly(sql) {
  const s = sql.trim().replace(/;\s*$/, '')
  if (!LEAD.test(s)) throw new QueryError('Only a single SELECT (optionally starting with WITH) is allowed.')
  // strip string literals and comments before looking for a second statement
  const bare = s.replace(/'(?:[^']|'')*'/g, "''").replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
  if (bare.includes(';')) throw new QueryError('Only one statement per query.')
  return s
}

let queue = Promise.resolve()

/**
 * Run a read-only query. Returns { columns: [{name,type}], rows: [[...]], rowCount, truncated, ms }.
 * Queries are serialized on the single connection.
 */
export function runQuery(sql, { maxRows = 5000, timeoutMs = 60000, signal } = {}) {
  const job = queue.then(() => runNow(sql, { maxRows, timeoutMs, signal }))
  queue = job.catch(() => {})
  return job
}

async function runNow(sql, { maxRows, timeoutMs, signal }) {
  const clean = checkReadOnly(sql)
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  const t0 = performance.now()
  await ensureViewsFor(clean)
  const conn = await getConn()

  let timedOut = false
  let aborted = false
  const cancel = async () => {
    const ok = await conn.cancelSent().catch(() => false)
    if (!ok) {
      // A query stuck in a synchronous range read may ignore cancel. Reset.
      await resetDb()
      forgetViews()
    }
  }
  const timer = setTimeout(() => { timedOut = true; cancel() }, timeoutMs)
  const onAbort = () => { aborted = true; cancel() }
  signal?.addEventListener('abort', onAbort, { once: true })

  try {
    const wrapped = /^\s*(describe|summarize)\b/i.test(clean) ? clean : `SELECT * FROM (${clean}\n) AS q LIMIT ${maxRows + 1}`
    const reader = await conn.send(wrapped, true)
    let columns = null
    const rows = []
    for await (const batch of reader) {
      if (!columns) columns = batch.schema.fields.map((f) => ({ name: f.name, type: typeLabel(f) }))
      const cols = batch.schema.fields.map((f) => batch.getChild(f.name))
      for (let i = 0; i < batch.numRows; i++) rows.push(cols.map((c) => toPlain(c.get(i))))
    }
    if (!columns) columns = reader.schema ? reader.schema.fields.map((f) => ({ name: f.name, type: typeLabel(f) })) : []
    const truncated = rows.length > maxRows
    if (truncated) rows.length = maxRows
    return { columns, rows, rowCount: rows.length, truncated, ms: Math.round(performance.now() - t0) }
  } catch (e) {
    if (aborted) throw new DOMException('Aborted', 'AbortError')
    if (timedOut) throw new QueryError(`Query timed out after ${timeoutMs / 1000}s. Aggregate more, or filter by season.`)
    throw new QueryError(String(e?.message || e).replace(/^Error:\s*/, ''))
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

/** Column names + types for a view (used by describe_columns). */
export async function describeView(view) {
  const r = await runQuery(`DESCRIBE SELECT * FROM ${view}`, { maxRows: 1000 })
  return r.rows.map((row) => ({ name: row[0], type: row[1] }))
}

/** rows (arrays) -> objects keyed by column name */
export function asObjects(result) {
  return result.rows.map((r) => Object.fromEntries(result.columns.map((c, i) => [c.name, r[i]])))
}
