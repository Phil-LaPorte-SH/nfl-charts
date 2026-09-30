import { executeTool } from './tools.js'
import { imageBlocks } from './images.js'

// "Claude plan" mode: questions go to the local Vite dev server, which runs the
// Claude Code CLI (`claude -p`) signed in with the user's subscription. Tool
// calls come back to this page and run here, exactly as in API-key mode.
// Only exists in dev builds; the hosted site has no bridge.

let statusPromise = null
export function getBridgeStatus() {
  if (!import.meta.env.DEV) return Promise.resolve({ available: false })
  if (!statusPromise) {
    statusPromise = fetch('/__claude/status')
      .then((r) => (r.ok ? r.json() : { available: false }))
      .catch(() => ({ available: false }))
  }
  return statusPromise
}

export async function runViaClaudeCode({ prompt, images, sessionId, model, effort, ctx, signal, onEvent }) {
  const res = await fetch('/__claude/ask', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt, images: imageBlocks(images), sessionId, model: model.id, effort: model.effort ? effort : null }),
    signal,
  })
  if (!res.ok || !res.body) throw new Error(`Local Claude bridge: HTTP ${res.status}`)

  let newSession = sessionId || null
  let result = null
  let exit = null
  let charted = false
  const toolJobs = []
  const onChart = ctx.onChart
  const toolCtx = { ...ctx, signal, onChart: (spec) => { charted = true; onChart?.(spec) } }

  const handleTool = async ({ callId, name, input }) => {
    onEvent({ type: 'tool_start', id: callId, name })
    onEvent({ type: 'tool_running', id: callId, name, input })
    let out
    try {
      out = await executeTool({ id: callId, name, input }, toolCtx)
    } catch (e) {
      out = { type: 'tool_result', tool_use_id: callId, content: `Error: ${e?.message || e}`, is_error: true }
    }
    onEvent({ type: 'tool_done', id: callId, name, result: out })
    await fetch('/__claude/tool-result', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ callId, content: out.content, is_error: !!out.is_error }),
    }).catch(() => {})
  }

  const handleCC = (d) => {
    if (d.type === 'system' && d.subtype === 'init') newSession = d.session_id
    else if (d.type === 'stream_event') {
      const ev = d.event
      if (ev?.type === 'content_block_delta') {
        if (ev.delta?.type === 'text_delta') onEvent({ type: 'text', delta: ev.delta.text })
        else if (ev.delta?.type === 'thinking_delta') onEvent({ type: 'thinking', delta: ev.delta.thinking })
      } else if (ev?.type === 'message_start' && ev.message?.usage) {
        onEvent({ type: 'turn_start' })
      }
    } else if (d.type === 'result') result = d
  }

  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let i
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i)
      buf = buf.slice(i + 1)
      if (!line.trim()) continue
      let msg
      try { msg = JSON.parse(line) } catch { continue }
      if (msg.t === 'cc') handleCC(msg.d)
      else if (msg.t === 'tool') toolJobs.push(handleTool(msg))
      else if (msg.t === 'exit') exit = msg
    }
  }
  await Promise.all(toolJobs)

  if (result) {
    onEvent({ type: 'usage', usage: result.usage, cost: 0, billing: 'plan', turns: result.num_turns })
    if (result.is_error || result.subtype !== 'success') {
      const why = result.subtype === 'error_max_turns' ? 'Stopped after the tool budget.' : (result.result || result.subtype)
      return { kind: charted ? 'chart' : 'error', message: why, sessionId: newSession }
    }
    return { kind: charted ? 'chart' : 'answer', sessionId: newSession }
  }
  const err = exit?.stderr?.trim()
  throw new Error(err ? `Claude CLI failed: ${err.split('\n').slice(-3).join(' ')}` : 'Claude CLI ended without a result.')
}
