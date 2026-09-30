import { useState } from 'react'
import { runQuery } from '../db/query.js'
import { getManifest } from '../db/manifest.js'
import { DATA_BASE } from '../config.js'
import ResultTable from './ResultTable.jsx'

const MAHOMES = '00-0033873'

if (import.meta.env.DEV) import('../llm/tools.js').then(({ executeTool }) => { window.__nfl = { runQuery, executeTool } })
const CHECKS = [
  { name: 'player_week: Mahomes 2022 REG', want: '5250,41,648,435',
    sql: `SELECT sum(passing_yards)::INT, sum(passing_tds)::INT, sum(attempts)::INT, sum(completions)::INT FROM player_week WHERE player_id = '${MAHOMES}' AND season = 2022 AND season_type = 'REG'` },
  { name: 'player_season: Mahomes 2022 REG', want: '5250',
    sql: `SELECT passing_yards::INT FROM player_season WHERE player_id = '${MAHOMES}' AND season = 2022 AND season_type = 'REG'` },
  { name: 'pbp_lite: Mahomes 2022 REG', want: '5250',
    sql: `SELECT sum(passing_yards)::INT FROM pbp_lite WHERE season = 2022 AND season_type = 'REG' AND passer_player_id = '${MAHOMES}'` },
  { name: 'pbp (raw): Mahomes 2022 REG', want: '5250',
    sql: `SELECT sum(passing_yards)::INT FROM pbp WHERE season = 2022 AND season_type = 'REG' AND passer_player_id = '${MAHOMES}'` },
  { name: 'teams: 32 current franchises', want: '32', sql: `SELECT count(*)::INT FROM teams` },
  { name: 'canon_team macro', want: 'LA', sql: `SELECT canon_team('STL')` },
  { name: 'pbp_lite: plays across all seasons', want: null, sql: `SELECT count(*)::INT, min(season), max(season) FROM pbp_lite` },
]

export default function DebugPage() {
  const [results, setResults] = useState({})
  const [sql, setSql] = useState(`SELECT team, sum(def_sacks) AS sacks\nFROM team_season\nWHERE season BETWEEN 2020 AND 2025 AND season_type = 'REG'\nGROUP BY team ORDER BY sacks DESC`)
  const [adhoc, setAdhoc] = useState(null)
  const [manifest, setManifest] = useState(null)
  const [busy, setBusy] = useState(false)

  async function runChecks() {
    setBusy(true)
    getManifest().then(setManifest).catch((e) => setManifest({ error: String(e) }))
    for (const c of CHECKS) {
      setResults((r) => ({ ...r, [c.name]: { state: 'running' } }))
      try {
        const res = await runQuery(c.sql)
        const got = res.rows[0].join(',')
        setResults((r) => ({ ...r, [c.name]: { state: c.want == null || got === c.want ? 'pass' : 'fail', got, ms: res.ms } }))
      } catch (e) {
        setResults((r) => ({ ...r, [c.name]: { state: 'error', got: String(e.message || e) } }))
      }
    }
    setBusy(false)
  }

  async function runAdhoc() {
    setAdhoc({ running: true })
    try {
      setAdhoc({ result: await runQuery(sql) })
    } catch (e) {
      setAdhoc({ error: String(e.message || e) })
    }
  }

  return (
    <div className="debug">
      <h1>Data debug</h1>
      <p className="muted">Data base URL: <code>{DATA_BASE}</code>
        {manifest && !manifest.error && <> · manifest {manifest.generated_at} · seasons {manifest.seasons.min}–{manifest.seasons.max} · current {manifest.seasons.current} wk {manifest.seasons.last_completed_week}</>}
        {manifest?.error && <span className="error-box">{manifest.error}</span>}
      </p>
      <button className="btn btn-primary" onClick={runChecks} disabled={busy} id="run-checks">Run known-stat checks</button>
      <table className="checks" id="checks">
        <thead><tr><th>Check</th><th>Expected</th><th>Got</th><th>ms</th><th>Status</th></tr></thead>
        <tbody>
          {CHECKS.map((c) => {
            const r = results[c.name] || {}
            return (
              <tr key={c.name} data-state={r.state || 'idle'}>
                <td>{c.name}</td><td className="mono">{c.want ?? '—'}</td>
                <td className="mono">{r.got ?? ''}</td><td>{r.ms ?? ''}</td>
                <td><span className={`dot ${r.state === 'pass' ? 'ok' : r.state === 'running' ? 'warn' : r.state ? 'err' : ''}`} /> {r.state || ''}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <h2>Ad-hoc SQL</h2>
      <p className="muted">Views: pbp_lite, pbp, player_week, player_season, team_week, team_season, teams, players, games</p>
      <textarea value={sql} onChange={(e) => setSql(e.target.value)} onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') runAdhoc() }} />
      <p><button className="btn" onClick={runAdhoc}>Run (⌘↵)</button>
        {adhoc?.result && <span className="muted"> {adhoc.result.rowCount} rows · {adhoc.result.ms} ms{adhoc.result.truncated ? ' · truncated' : ''}</span>}</p>
      {adhoc?.error && <div className="error-box">{adhoc.error}</div>}
      {adhoc?.result && <ResultTable result={adhoc.result} />}
    </div>
  )
}
