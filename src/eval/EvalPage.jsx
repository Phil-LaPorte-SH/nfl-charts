import { useEffect, useRef, useState } from 'react'
import CASES from './cases.json'
import { runCase } from './runEval.js'
import { useSettings } from '../state/settings.js'
import { getClient } from '../llm/client.js'
import { getManifest } from '../db/manifest.js'
import { TOOLS } from '../llm/tools.js'
import { SYSTEM_PROMPT } from '../llm/prompt/system.js'
import { fmtUsd } from '../llm/cost.js'
import { MODELS, EFFORTS } from '../llm/models.js'
import { classifyError } from '../llm/errors.js'
import { getMockClient, mockEnabled } from '../llm/mockClient.js'

const STORE = 'nflviz.evalLast'

async function sha(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].slice(0, 6).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export default function EvalPage() {
  const [settings, update] = useSettings()
  const [rows, setRows] = useState({})
  const [running, setRunning] = useState(false)
  const [open, setOpen] = useState(null)
  const [promptInfo, setPromptInfo] = useState({ hash: '', tokens: null })
  const [last, setLast] = useState(() => { try { return JSON.parse(localStorage.getItem(STORE) || 'null') } catch { return null } })
  const abort = useRef(null)

  useEffect(() => { sha(SYSTEM_PROMPT + JSON.stringify(TOOLS)).then((hash) => setPromptInfo((p) => ({ ...p, hash }))) }, [])

  async function countTokens() {
    const client = getClient()
    if (!client) return alert('Add an API key on the main page first.')
    try {
      const r = await client.messages.countTokens({ model: settings.model, system: SYSTEM_PROMPT, tools: TOOLS, messages: [{ role: 'user', content: 'x' }] })
      setPromptInfo((p) => ({ ...p, tokens: r.input_tokens }))
    } catch (e) { alert(classifyError(e).message) }
  }

  async function run(ids) {
    const client = mockEnabled() ? getMockClient() : getClient()
    if (!client) return alert('Add an API key on the main page first.')
    const manifest = await getManifest()
    const ctrl = new AbortController()
    abort.current = ctrl
    setRunning(true)
    const todo = CASES.filter((c) => ids.includes(c.id))
    setRows((r) => ({ ...r, ...Object.fromEntries(todo.map((c) => [c.id, { status: 'queued' }])) }))
    const out = {}
    let i = 0
    const worker = async () => {
      while (i < todo.length && !ctrl.signal.aborted) {
        const c = todo[i++]
        setRows((r) => ({ ...r, [c.id]: { status: 'running' } }))
        try {
          const res = await runCase({ c, client, model: settings.modelCfg, effort: settings.effort, manifest, signal: ctrl.signal })
          out[c.id] = res
          setRows((r) => ({ ...r, [c.id]: { status: res.pass ? 'pass' : 'fail', ...res } }))
        } catch {
          setRows((r) => ({ ...r, [c.id]: { status: 'cancelled' } }))
        }
      }
    }
    await Promise.all([worker(), worker()])
    setRunning(false)
    const summary = {
      at: new Date().toISOString(), model: settings.model, effort: settings.effort, prompt: promptInfo.hash,
      passed: Object.values(out).filter((r) => r.pass).length, total: Object.keys(out).length,
      cost: Object.values(out).reduce((s, r) => s + r.trace.cost, 0),
    }
    if (summary.total === CASES.length) {
      setLast(summary)
      try { localStorage.setItem(STORE, JSON.stringify(summary)) } catch { /* ignore */ }
    }
  }

  const done = Object.values(rows).filter((r) => r.trace)
  const totalCost = done.reduce((s, r) => s + r.trace.cost, 0)
  const avgCost = last ? last.cost / last.total : 0.08
  return (
    <div className="debug">
      <h1>Prompt eval</h1>
      <p className="muted"><a href="#/">Back to chat</a> · {CASES.length} cases with answers computed from the mirrored nflverse data. Each case costs real API money.</p>
      <p>
        <select value={settings.model} onChange={(e) => update({ model: e.target.value })}>{MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select>{' '}
        {settings.modelCfg.effort && <select value={settings.effort} onChange={(e) => update({ effort: e.target.value })}>{EFFORTS.map((x) => <option key={x}>{x}</option>)}</select>}{' '}
        <button className="btn btn-primary" disabled={running} onClick={() => run(CASES.map((c) => c.id))}>Run all (≈{fmtUsd(avgCost * CASES.length)})</button>{' '}
        {running && <button className="btn" onClick={() => abort.current?.abort()}>Stop</button>}{' '}
        <button className="btn" onClick={countTokens}>Count prompt tokens</button>
      </p>
      <p className="muted mono">
        prompt {promptInfo.hash}{promptInfo.tokens ? ` · ${promptInfo.tokens.toLocaleString()} tokens (system + tools)` : ''}
        {last && ` · last full run: ${last.passed}/${last.total} on ${last.model}/${last.effort} (prompt ${last.prompt}) · ${fmtUsd(last.cost)}`}
        {done.length > 0 && ` · this run ${done.filter((r) => r.pass).length}/${done.length} · ${fmtUsd(totalCost)}`}
      </p>
      <table className="checks">
        <thead><tr><th>Case</th><th>Question</th><th>Status</th><th>Turns</th><th>Cost</th><th>s</th><th /></tr></thead>
        <tbody>
          {CASES.map((c) => {
            const r = rows[c.id] || {}
            return [
              <tr key={c.id} data-state={r.status || 'idle'}>
                <td className="mono">{c.id}</td>
                <td>{c.question}</td>
                <td><span className={`dot ${r.status === 'pass' ? 'ok' : r.status === 'fail' ? 'err' : r.status ? 'warn' : ''}`} /> {r.status || ''}{r.failures?.length ? <div className="faint">{r.failures.join('; ')}</div> : null}</td>
                <td>{r.trace?.turns ?? ''}</td>
                <td>{r.trace ? fmtUsd(r.trace.cost) : ''}</td>
                <td>{r.trace ? (r.trace.ms / 1000).toFixed(1) : ''}</td>
                <td>
                  <button className="btn btn-sm" disabled={running} onClick={() => run([c.id])}>Run</button>{' '}
                  {r.trace && <button className="btn btn-sm" onClick={() => setOpen(open === c.id ? null : c.id)}>Trace</button>}
                </td>
              </tr>,
              open === c.id && r.trace && (
                <tr key={c.id + '-t'}><td colSpan={7}>
                  {r.trace.sqls.map((s, i) => <pre key={i} className="sql">{s}</pre>)}
                  {r.trace.charts.map((s, i) => <div key={i} className="muted">chart: {s.type} · {s.title} · {s.caption}</div>)}
                  {r.trace.text && <p className="muted">{r.trace.text}</p>}
                </td></tr>
              ),
            ]
          })}
        </tbody>
      </table>
    </div>
  )
}
