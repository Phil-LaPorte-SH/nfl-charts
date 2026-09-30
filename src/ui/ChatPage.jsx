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
import { getBridgeStatus, runViaClaudeCode } from '../llm/claudeCodeRunner.js'
import { fileToImage, imageBlocks, isImageFile, MAX_IMAGES } from '../llm/images.js'

const EXAMPLES = [
  'Which teams draw the most defensive penalties that save a failed 3rd or 4th down? Mahomes era, highlight KC.',
  'Sack totals for every team, 2020-2025 regular seasons.',
  'Which offenses run the ball best this season? EPA per rush vs success rate.',
  'How has Josh Allen\'s passing EPA per game changed each season?',
  'Chiefs target share by player last season as a donut.',
  'Top 10 defenses by points allowed per game last season.',
]

const IMAGE_ONLY_PROMPT = 'Read this image and recreate it with nflverse data. Tell me whether its numbers match.'

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
  const [attachments, setAttachments] = useState([])
  const [attachError, setAttachError] = useState(null)
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef(null)
  const [running, setRunning] = useState(false)
  const [keyModal, setKeyModal] = useState(null) // null | { reason }
  const [spend, setSpend] = useState(getSpend)
  const [resultMap, setResultMap] = useState({})
  const history = useRef([])
  const results = useRef({})
  const counter = useRef(0)
  const abortRef = useRef(null)
  const bottomRef = useRef(null)
  const pendingRef = useRef(null)
  const sessionRef = useRef(null)
  const [bridge, setBridge] = useState({ available: false })
  const engine = !mockEnabled() && bridge.available && settings.engine !== 'api' ? 'plan' : 'api'

  useEffect(() => { applyThemeAttr(settings.theme) }, [settings.theme])
  useEffect(() => { getBridgeStatus().then(setBridge) }, [])
  useEffect(() => {
    getManifest().then((m) => { setManifest(m); warmUp().catch(() => {}) }).catch((e) => setDataError(String(e.message || e)))
  }, [])

  const patch = useCallback((idx, fn) => setExchanges((xs) => xs.map((x, i) => (i === idx ? fn(x) : x))), [])

  async function addFiles(files) {
    const imgs = [...files].filter(isImageFile)
    if (!imgs.length) { setAttachError('Only images can be attached (PNG, JPEG, GIF, WebP).'); return }
    setAttachError(null)
    const room = MAX_IMAGES - attachments.length
    if (room <= 0) { setAttachError(`Up to ${MAX_IMAGES} images per question.`); return }
    for (const f of imgs.slice(0, room)) {
      try {
        const im = await fileToImage(f)
        setAttachments((a) => (a.length < MAX_IMAGES ? [...a, im] : a))
      } catch (e) {
        setAttachError(String(e.message || e))
      }
    }
    if (imgs.length > room) setAttachError(`Up to ${MAX_IMAGES} images per question; extra images were skipped.`)
  }

  async function ask(question, images = attachments) {
    const q = question.trim() || (images.length ? IMAGE_ONLY_PROMPT : '')
    if (!q || running) return
    const client = engine === 'plan' ? null : mockEnabled() ? getMockClient() : getClient()
    if (engine === 'api' && !client) { pendingRef.current = { q, images }; setKeyModal({ reason: null }); return }
    setInput('')
    setAttachments([])
    setAttachError(null)
    const idx = exchanges.length
    setExchanges((xs) => [...xs, { question: q, images, parts: [], charts: [], usage: [], cost: 0, status: 'running', model: settings.modelCfg.label, billing: engine === 'plan' ? 'plan' : 'api', turns: 0 }])
    setRunning(true)
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)

    const ctrl = new AbortController()
    abortRef.current = ctrl
    const first = engine === 'plan' ? !sessionRef.current : history.current.length === 0
    const text = first ? `${contextBlock({ manifest, favoriteTeam: settings.favoriteTeam })}\n\n${q}` : q
    const lastChart = [...exchanges].reverse().find((x) => x.charts.length)?.charts.at(-1)
    const edited = lastChart?.edited ? `\n\n(The user edited the last chart; current spec: ${JSON.stringify(lastChart.spec)})` : ''
    const snapshot = [...history.current]
    if (engine === 'api') appendUser(history.current, [...imageBlocks(images), { type: 'text', text: text + edited }])

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
      } else if (ev.type === 'usage' && ev.billing === 'plan') {
        patch(idx, (x) => ({ ...x, usage: [...x.usage, ev.usage], turns: x.turns + (ev.turns || 1) }))
      } else if (ev.type === 'usage') {
        if (!mockEnabled()) {
          const s = addSpend(ev.cost)
          if (s) setSpend(s)
        }
        patch(idx, (x) => ({ ...x, usage: [...x.usage, ev.usage], cost: x.cost + ev.cost, turns: x.turns + 1 }))
      }
    }

    try {
      if (engine === 'plan') {
        const out = await runViaClaudeCode({ prompt: text + edited, images, sessionId: sessionRef.current, model: settings.modelCfg, effort: settings.effort, ctx, signal: ctrl.signal, onEvent })
        sessionRef.current = out.sessionId
        patch(idx, (x) => ({ ...x, status: out.kind === 'error' ? 'error' : 'done', note: out.kind === 'error' ? out.message : null }))
      } else {
        const out = await runAgent({ client, model: settings.modelCfg, effort: settings.effort, history: history.current, ctx, signal: ctrl.signal, onEvent })
        patch(idx, (x) => ({ ...x, status: out.kind === 'refusal' ? 'error' : 'done', note: out.kind === 'refusal' ? out.message : out.kind === 'truncated' ? 'The response hit the output limit. Try a narrower question.' : out.kind === 'turn_cap' ? 'Stopped after the tool budget.' : null }))
      }
    } catch (e) {
      const err = classifyError(e)
      // Keep history valid: drop anything this question appended if the API call failed mid-way.
      if (err.kind !== 'cancelled') history.current.splice(0, history.current.length, ...snapshot)
      else trimDangling(history.current)
      patch(idx, (x) => ({ ...x, status: err.kind === 'cancelled' ? 'cancelled' : 'error', note: err.message }))
      if (err.kind === 'auth') { pendingRef.current = { q, images }; setKeyModal({ reason: err.message }) }
    } finally {
      setRunning(false)
      abortRef.current = null
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }

  function newChat() {
    abortRef.current?.abort()
    history.current = []
    sessionRef.current = null
    results.current = {}
    counter.current = 0
    setResultMap({})
    setExchanges([])
  }

  const onSpecEdit = (exIdx, chartIdx, spec) => {
    setExchanges((xs) => xs.map((x, i) => (i !== exIdx ? x : { ...x, charts: x.charts.map((c, j) => (j === chartIdx ? { spec: spec || c.spec, edited: !!spec } : c)) })))
  }

  return (
    <div
      className="app"
      onDragOver={(e) => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); setDragging(true) } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target || !e.relatedTarget) setDragging(false) }}
      onDrop={(e) => { if (e.dataTransfer.files?.length) { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) } }}
    >
      {dragging && <div className="drop-overlay" onDragLeave={() => setDragging(false)}><div>Drop an image to ask about it</div></div>}
      <Header settings={settings} update={update} manifest={manifest} dataError={dataError} spend={spend}
        hasKey={!!getApiKey() || mockEnabled()} onKey={() => setKeyModal({ reason: null })} onNew={newChat}
        bridge={bridge} engine={engine} />
      <main className="chat">
        {exchanges.length === 0 && (
          <div className="empty">
            <h1>Ask the NFL a question.<br /><span className="muted">Get a chart you can post.</span></h1>
            <p className="muted">Every play since 1999 from nflverse, queried in your browser. {mockEnabled() && <b>(mock model: dev only)</b>}
              {engine === 'plan' && <> Answers use your Claude {bridge.plan ? bridge.plan[0].toUpperCase() + bridge.plan.slice(1) : ''} plan through the local Claude Code CLI, with no API charges.</>}</p>
            <div className="examples">
              {EXAMPLES.map((e) => <button key={e} className="example" onClick={() => ask(e)}>{e}</button>)}
            </div>
            {dataError && <div className="error-box">Data failed to load: {dataError}</div>}
          </div>
        )}
        {exchanges.map((x, i) => (
          <Exchange key={i} x={x} results={resultMap} onSpecEdit={(ci, spec) => onSpecEdit(i, ci, spec)} onRetry={() => ask(x.question, x.images || [])} />
        ))}
        <div ref={bottomRef} />
      </main>
      <form className="composer" onSubmit={(e) => { e.preventDefault(); ask(input) }}>
        {(attachments.length > 0 || attachError) && (
          <div className="attachments">
            {attachments.map((a) => (
              <div key={a.id} className="thumb" title={`${a.name} · ${a.width}×${a.height}`}>
                <img src={a.dataUrl} alt={a.name} />
                <button type="button" aria-label="Remove image" onClick={() => setAttachments((xs) => xs.filter((x) => x.id !== a.id))}>✕</button>
              </div>
            ))}
            {attachError && <span className="attach-error">{attachError}</span>}
          </div>
        )}
        <div className="composer-row">
        <button type="button" className="btn attach-btn" title="Attach an image (or drop / paste one)" aria-label="Attach image" onClick={() => fileInput.current?.click()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
        </button>
        <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
        <textarea
          onPaste={(e) => { const files = [...(e.clipboardData?.files || [])].filter(isImageFile); if (files.length) { e.preventDefault(); addFiles(files) } }}
          value={input}
          placeholder={exchanges.length ? 'Ask a follow-up, or say "make it a scatter", "highlight BUF", "dark theme"…' : 'e.g. Which teams convert the most 4th downs since 2020? Or drop in a chart to check or recreate.'}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input) } }}
          rows={2}
        />
        {running
          ? <button type="button" className="btn" onClick={() => abortRef.current?.abort()}>Stop</button>
          : <button type="submit" className="btn btn-primary" disabled={!input.trim() && !attachments.length}>Ask</button>}
        </div>
      </form>
      {keyModal && (
        <ApiKeyModal reason={keyModal.reason} onClose={(saved) => {
          setKeyModal(null)
          if (saved && pendingRef.current) { const { q, images } = pendingRef.current; pendingRef.current = null; setTimeout(() => ask(q, images), 0) }
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
