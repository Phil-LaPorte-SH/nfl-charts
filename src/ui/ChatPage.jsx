import { useEffect, useRef, useState, useCallback } from 'react'
import Header from './Header.jsx'
import ApiKeyModal from './ApiKeyModal.jsx'
import Exchange from './Exchange.jsx'
import { useSettings, applyThemeAttr } from '../state/settings.js'
import { getManifest } from '../db/manifest.js'
import { warmUp } from '../db/datasets.js'
import { getClient, getApiKey } from '../llm/client.js'
import { runAgent } from '../llm/agent.js'
import { contextBlock } from '../llm/prompt/system.js'
import { classifyError } from '../llm/errors.js'
import { addSpend, getSpend } from '../llm/cost.js'
import { getMockClient, mockEnabled } from '../llm/mockClient.js'

const EXAMPLES = [
  'Which teams draw the most defensive penalties that save a failed 3rd or 4th down? Mahomes era, highlight KC.',
  'Sack totals for every team, 2020-2025 regular seasons.',
  'Which offenses run the ball best this season? EPA per rush vs success rate.',
  'How has Josh Allen\'s passing EPA per game changed each season?',
  'Chiefs target share by player last season as a donut.',
  'Top 10 defenses by points allowed per game last season.',
]

/** Append a user turn, merging into a trailing user message (tool results) if present. */
function appendUser(history, blocks) {
  const last = history[history.length - 1]
  if (last?.role === 'user') {
    const prev = typeof last.content === 'string' ? [{ type: 'text', text: last.content }] : last.content
    history[history.length - 1] = { ...last, content: [...prev, ...blocks] }
  } else {
    history.push({ role: 'user', content: blocks })
  }
}

export default function ChatPage() {
  const [settings, update] = useSettings()
  const [manifest, setManifest] = useState(null)
  const [dataError, setDataError] = useState(null)
  const [exchanges, setExchanges] = useState([])
  const [input, setInput] = useState('')
  const [running, setRunning] = useState(false)
  const [keyModal, setKeyModal] = useState(null) // null | { reason }
  const [spend, setSpend] = useState(getSpend)
  const [resultMap, setResultMap] = useState({})
  const history = useRef([])
  const results = useRef({})
  const counter = useRef(0)
  const abortRef = useRef(null)
  const bottomRef = useRef(null)
  const pendingRef = useRef('')

  useEffect(() => { applyThemeAttr(settings.theme) }, [settings.theme])
  useEffect(() => {
    getManifest().then((m) => { setManifest(m); warmUp().catch(() => {}) }).catch((e) => setDataError(String(e.message || e)))
  }, [])

  const patch = useCallback((idx, fn) => setExchanges((xs) => xs.map((x, i) => (i === idx ? fn(x) : x))), [])

  async function ask(question) {
    const q = question.trim()
    if (!q || running) return
    const client = mockEnabled() ? getMockClient() : getClient()
    if (!client) { pendingRef.current = q; setKeyModal({ reason: null }); return }
    setInput('')
    const idx = exchanges.length
    setExchanges((xs) => [...xs, { question: q, parts: [], charts: [], usage: [], cost: 0, status: 'running', model: settings.modelCfg.label }])
    setRunning(true)
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)

    const ctrl = new AbortController()
    abortRef.current = ctrl
    const first = history.current.length === 0
    const text = first ? `${contextBlock({ manifest, favoriteTeam: settings.favoriteTeam })}\n\n${q}` : q
    const lastChart = [...exchanges].reverse().find((x) => x.charts.length)?.charts.at(-1)
    const edited = lastChart?.edited ? `\n\n(The user edited the last chart; current spec: ${JSON.stringify(lastChart.spec)})` : ''
    const snapshot = [...history.current]
    appendUser(history.current, [{ type: 'text', text: text + edited }])

    const ctx = {
      results: results.current,
      nextId: () => `q${++counter.current}`,
      onResult: (id, res) => setResultMap((m) => ({ ...m, [id]: res })),
      onChart: (spec) => patch(idx, (x) => ({ ...x, charts: [...x.charts, { spec, edited: false }] })),
    }
    const onEvent = (ev) => {
      if (ev.type === 'text' || ev.type === 'thinking') {
        const kind = ev.type
        patch(idx, (x) => {
          const parts = [...x.parts]
          const last = parts[parts.length - 1]
          if (last?.kind === kind) parts[parts.length - 1] = { ...last, text: last.text + ev.delta }
          else parts.push({ kind, text: ev.delta })
          return { ...x, parts }
        })
      } else if (ev.type === 'tool_start') {
        patch(idx, (x) => ({ ...x, parts: [...x.parts, { kind: 'tool', id: ev.id, name: ev.name, input: null, status: 'writing' }] }))
      } else if (ev.type === 'tool_input') {
        patch(idx, (x) => {
          const parts = [...x.parts]
          for (let i = parts.length - 1; i >= 0; i--) if (parts[i].kind === 'tool' && parts[i].status === 'writing') { parts[i] = { ...parts[i], input: ev.snapshot }; break }
          return { ...x, parts }
        })
      } else if (ev.type === 'tool_running' || ev.type === 'tool_done') {
        patch(idx, (x) => ({
          ...x,
          parts: x.parts.map((p) => (p.kind === 'tool' && p.id === ev.id
            ? { ...p, input: ev.input ?? p.input, status: ev.type === 'tool_done' ? 'done' : 'running', output: ev.result ?? p.output }
            : p)),
        }))
      } else if (ev.type === 'usage') {
        if (!mockEnabled()) {
          const s = addSpend(ev.cost)
          if (s) setSpend(s)
        }
        patch(idx, (x) => ({ ...x, usage: [...x.usage, ev.usage], cost: x.cost + ev.cost }))
      }
    }

    try {
      const out = await runAgent({ client, model: settings.modelCfg, effort: settings.effort, history: history.current, ctx, signal: ctrl.signal, onEvent })
      patch(idx, (x) => ({ ...x, status: out.kind === 'refusal' ? 'error' : 'done', note: out.kind === 'refusal' ? out.message : out.kind === 'truncated' ? 'The response hit the output limit. Try a narrower question.' : out.kind === 'turn_cap' ? 'Stopped after the tool budget.' : null }))
    } catch (e) {
      const err = classifyError(e)
      // Keep history valid: drop anything this question appended if the API call failed mid-way.
      if (err.kind !== 'cancelled') history.current.splice(0, history.current.length, ...snapshot)
      else trimDangling(history.current)
      patch(idx, (x) => ({ ...x, status: err.kind === 'cancelled' ? 'cancelled' : 'error', note: err.message }))
      if (err.kind === 'auth') { pendingRef.current = q; setKeyModal({ reason: err.message }) }
    } finally {
      setRunning(false)
      abortRef.current = null
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }

  function newChat() {
    abortRef.current?.abort()
    history.current = []
    results.current = {}
    counter.current = 0
    setResultMap({})
    setExchanges([])
  }

  const onSpecEdit = (exIdx, chartIdx, spec) => {
    setExchanges((xs) => xs.map((x, i) => (i !== exIdx ? x : { ...x, charts: x.charts.map((c, j) => (j === chartIdx ? { spec: spec || c.spec, edited: !!spec } : c)) })))
  }

  return (
    <div className="app">
      <Header settings={settings} update={update} manifest={manifest} dataError={dataError} spend={spend}
        hasKey={!!getApiKey() || mockEnabled()} onKey={() => setKeyModal({ reason: null })} onNew={newChat} />
      <main className="chat">
        {exchanges.length === 0 && (
          <div className="empty">
            <h1>Ask the NFL a question.<br /><span className="muted">Get a chart you can post.</span></h1>
            <p className="muted">Every play since 1999 from nflverse, queried in your browser. {mockEnabled() && <b>(mock model: dev only)</b>}</p>
            <div className="examples">
              {EXAMPLES.map((e) => <button key={e} className="example" onClick={() => ask(e)}>{e}</button>)}
            </div>
            {dataError && <div className="error-box">Data failed to load: {dataError}</div>}
          </div>
        )}
        {exchanges.map((x, i) => (
          <Exchange key={i} x={x} results={resultMap} onSpecEdit={(ci, spec) => onSpecEdit(i, ci, spec)} onRetry={() => ask(x.question)} />
        ))}
        <div ref={bottomRef} />
      </main>
      <form className="composer" onSubmit={(e) => { e.preventDefault(); ask(input) }}>
        <textarea
          value={input}
          placeholder={exchanges.length ? 'Ask a follow-up, or say "make it a scatter", "highlight BUF", "dark theme"…' : 'e.g. Which teams convert the most 4th downs since 2020?'}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input) } }}
          rows={2}
        />
        {running
          ? <button type="button" className="btn" onClick={() => abortRef.current?.abort()}>Stop</button>
          : <button type="submit" className="btn btn-primary" disabled={!input.trim()}>Ask</button>}
      </form>
      {keyModal && (
        <ApiKeyModal reason={keyModal.reason} onClose={(saved) => {
          setKeyModal(null)
          if (saved && pendingRef.current) { const q = pendingRef.current; pendingRef.current = ''; setTimeout(() => ask(q), 0) }
        }} />
      )}
    </div>
  )
}

/** After a cancel, drop a trailing assistant turn whose tool calls never got results. */
function trimDangling(history) {
  const last = history[history.length - 1]
  if (last?.role === 'assistant' && Array.isArray(last.content) && last.content.some((b) => b.type === 'tool_use')) history.pop()
}
