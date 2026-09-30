import { TOOLS, executeTool } from './tools.js'
import { SYSTEM_PROMPT } from './prompt/system.js'
import { buildRequestParams } from './models.js'
import { costFromUsage } from './cost.js'

const SYSTEM = [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }]

/**
 * Run one user question to completion.
 *
 * history: the append-only API message list for this conversation. The new
 *   user message must already be the last entry. Assistant turns are pushed
 *   with their full content (thinking + tool_use blocks, unmodified), which
 *   Opus 5.5 needs to keep its reasoning across turns.
 * ctx: tool context (results map, nextId, onResult, onChart).
 * onEvent: UI callback.
 */
export async function runAgent({ client, model, effort, history, ctx, signal, onEvent, maxTurns = 8 }) {
  const params = buildRequestParams(model, effort)
  let charted = false
  ctx.onChart = ((orig) => (spec) => { charted = true; orig?.(spec) })(ctx.onChart)

  for (let turn = 0; turn <= maxTurns; turn++) {
    const lastTurn = turn === maxTurns
    if (lastTurn) {
      history.push({ role: 'user', content: 'You have used the tool budget for this question. Answer now with what you have in two or three sentences; do not call tools.' })
    }
    onEvent({ type: 'turn_start', turn })
    const stream = client.messages.stream({
      ...params,
      system: SYSTEM,
      tools: TOOLS,
      ...(lastTurn ? { tool_choice: { type: 'none' } } : {}),
      cache_control: { type: 'ephemeral' },
      messages: history,
    }, { signal })

    stream.on('text', (delta) => onEvent({ type: 'text', delta }))
    stream.on('thinking', (delta) => onEvent({ type: 'thinking', delta }))
    stream.on('streamEvent', (ev) => {
      if (ev.type === 'content_block_start' && ev.content_block.type === 'tool_use') {
        onEvent({ type: 'tool_start', id: ev.content_block.id, name: ev.content_block.name })
      }
    })
    stream.on('inputJson', (_partial, snapshot) => onEvent({ type: 'tool_input', snapshot }))

    const msg = await stream.finalMessage()
    history.push({ role: 'assistant', content: msg.content })
    onEvent({ type: 'usage', usage: msg.usage, cost: costFromUsage(msg.usage, model) })

    if (msg.stop_reason === 'refusal') {
      return { kind: 'refusal', message: msg.stop_details?.explanation || 'The model declined this request.' }
    }
    const toolUses = msg.content.filter((b) => b.type === 'tool_use')
    if (msg.stop_reason === 'max_tokens') {
      // A tool call cut off mid-arguments cannot be trusted; don't run it.
      if (toolUses.length) history.push({ role: 'user', content: toolUses.map((t) => ({ type: 'tool_result', tool_use_id: t.id, content: 'Output was cut off (max_tokens); nothing was run.', is_error: true })) })
      return { kind: 'truncated' }
    }
    if (!toolUses.length) return { kind: charted ? 'chart' : 'answer' }

    // Run sequentially (one DuckDB connection); return ALL results in one user message.
    const results = []
    for (const tu of toolUses) {
      onEvent({ type: 'tool_running', id: tu.id, name: tu.name, input: tu.input })
      const res = await executeTool(tu, { ...ctx, signal })
      results.push(res)
      onEvent({ type: 'tool_done', id: tu.id, name: tu.name, result: res })
    }
    history.push({ role: 'user', content: results })
    // render_chart succeeded: one more short turn lets the model stop cleanly,
    // but the answer is already on screen, so end here to save a round trip.
    if (charted && toolUses.some((t) => t.name === 'render_chart') && !results.some((r) => r.is_error && toolUses.find((t) => t.id === r.tool_use_id)?.name === 'render_chart')) {
      return { kind: 'chart' }
    }
  }
  return { kind: 'turn_cap' }
}
