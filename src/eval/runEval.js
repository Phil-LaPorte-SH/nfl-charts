import { runAgent } from '../llm/agent.js'
import { contextBlock } from '../llm/prompt/system.js'

const allCells = (trace) => Object.values(trace.results).flatMap((r) => r.rows.flat())
const approx = (a, b, tol) => typeof a === 'number' && Math.abs(a - b) <= tol

function gradeCheck(c, trace) {
  const cells = allCells(trace)
  const caption = trace.charts.map((s) => `${s.caption} ${s.kpis.map((k) => k.value).join(' ')}`).join(' ') + ' ' + trace.text
  const sql = trace.sqls.join('\n')
  switch (c.kind) {
    case 'number': {
      const tol = c.tol ?? 0.01
      const hit = cells.some((v) => approx(v, c.value, tol) || (c.pct && approx(v * 100, c.value, tol)))
        || new RegExp(`\\b${String(c.value).replace('.', '\\.')}\\b`).test(caption.replace(/,/g, ''))
      return hit || `expected ${c.value} in results or caption`
    }
    case 'text': {
      const needle = c.value.toLowerCase()
      return cells.some((v) => typeof v === 'string' && v.toLowerCase().includes(needle)) || caption.toLowerCase().includes(needle) || `expected "${c.value}"`
    }
    case 'chart_type':
      return trace.charts.some((s) => c.value.includes(s.type)) || `expected chart ${c.value.join('/')}, got ${trace.charts.map((s) => s.type).join(',') || 'none'}`
    case 'no_view':
      return !new RegExp(`\\b${c.value}\\b(?!_)`, 'i').test(sql) || `should not query ${c.value}`
    case 'sql_regex':
      return new RegExp(c.value, 'i').test(sql) || `SQL should match /${c.value}/`
    case 'min_rows': {
      const last = trace.charts.at(-1)
      const rows = last?.result_id ? trace.results[last.result_id]?.rowCount : Math.max(0, ...Object.values(trace.results).map((r) => r.rowCount))
      return (rows ?? 0) >= c.value || `expected ≥${c.value} rows, got ${rows ?? 0}`
    }
    default:
      return `unknown check ${c.kind}`
  }
}

export async function runCase({ c, client, model, effort, manifest, signal }) {
  const trace = { results: {}, sqls: [], charts: [], text: '', usage: [], cost: 0, turns: 0, ms: 0, error: null }
  const t0 = performance.now()
  let n = 0
  const history = [{ role: 'user', content: [{ type: 'text', text: `${contextBlock({ manifest })}\n\n${c.question}` }] }]
  const ctx = {
    results: trace.results,
    nextId: () => `q${++n}`,
    onChart: (spec) => trace.charts.push(spec),
  }
  try {
    await runAgent({
      client, model, effort, history, ctx, signal,
      onEvent: (ev) => {
        if (ev.type === 'text') trace.text += ev.delta
        if (ev.type === 'tool_running' && ev.name === 'execute_sql') trace.sqls.push(ev.input?.query || '')
        if (ev.type === 'usage') { trace.usage.push(ev.usage); trace.cost += ev.cost; trace.turns++ }
      },
    })
  } catch (e) {
    if (e?.name === 'AbortError') throw e
    trace.error = String(e?.message || e)
  }
  trace.ms = Math.round(performance.now() - t0)
  const failures = trace.error ? [trace.error] : c.checks.map((ch) => gradeCheck(ch, trace)).filter((r) => r !== true)
  return { id: c.id, pass: failures.length === 0, failures, trace }
}
