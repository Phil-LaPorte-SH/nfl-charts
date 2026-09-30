import { useState } from 'react'
import ResultTable from './ResultTable.jsx'

const LABELS = { execute_sql: 'Query', find_player: 'Find player', describe_columns: 'Look up columns', render_chart: 'Render chart' }

function parseContent(c) {
  try { return JSON.parse(c) } catch { return null }
}

export default function ToolCard({ part, results }) {
  const [open, setOpen] = useState(false)
  const { name, input, status, output } = part
  const isErr = output?.is_error
  const parsed = output && !isErr ? parseContent(output.content) : null
  const result = parsed?.result_id ? results[parsed.result_id] : null
  let summary = ''
  if (name === 'execute_sql' && parsed) summary = `${parsed.row_count} row${parsed.row_count === 1 ? '' : 's'} · ${parsed.result_id}${result?.ms != null ? ` · ${result.ms} ms` : ''}`
  if (name === 'find_player' && parsed) summary = parsed.matches?.length ? parsed.matches.slice(0, 2).map((m) => `${m.display_name} (${m.position}, ${m.gsis_id})`).join(', ') : 'no match'
  if (name === 'find_player' && !parsed && input?.name) summary = input.name
  if (name === 'describe_columns' && input) summary = `${input.table} ~ /${input.pattern}/`
  if (name === 'render_chart') summary = isErr ? 'spec needs fixes' : status === 'done' ? input?.spec?.type || 'ok' : ''
  const dot = status === 'done' ? (isErr ? 'err' : 'ok') : 'warn'

  return (
    <div className={`tool-card ${isErr ? 'is-error' : ''}`}>
      <button className="tool-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className={`dot ${dot}`} />
        <span className="tool-name">{LABELS[name] || name}</span>
        <span className="tool-summary">{status !== 'done' ? (status === 'running' ? 'running…' : 'writing…') : summary}</span>
        <span className="chev">{open ? '▾' : '▸'}</span>
      </button>
      {name === 'execute_sql' && input?.query && (open || status !== 'done') && <pre className="sql">{input.query}</pre>}
      {open && name !== 'execute_sql' && input && <pre className="sql">{JSON.stringify(input, null, 2).slice(0, 4000)}</pre>}
      {open && isErr && <div className="error-box">{String(output.content)}</div>}
      {open && result && <ResultTable result={result} maxRows={100} />}
      {open && name === 'find_player' && parsed?.matches && (
        <table className="mini">
          <tbody>{parsed.matches.map((m) => <tr key={m.gsis_id}><td>{m.display_name}</td><td>{m.position}</td><td className="mono">{m.gsis_id}</td><td>{m.teams}</td><td>{m.first_season}–{m.last_stat_season}</td></tr>)}</tbody>
        </table>
      )}
    </div>
  )
}
