#!/usr/bin/env node
// Minimal MCP stdio server, spawned by `claude -p` for the local "Claude plan"
// mode. It exposes the app's four tools and forwards each call to the Vite dev
// server, which relays it to the browser. The browser runs the tool (DuckDB-WASM,
// chart validation) exactly as it does in API-key mode and posts the result back.
import { createInterface } from 'node:readline'
import { TOOLS } from '../src/llm/toolDefs.js'

const BRIDGE = process.env.NFL_BRIDGE_URL
const TOKEN = process.env.NFL_BRIDGE_TOKEN

const send = (msg) => process.stdout.write(JSON.stringify(msg) + '\n')
const reply = (id, result) => send({ jsonrpc: '2.0', id, result })
const fail = (id, code, message) => send({ jsonrpc: '2.0', id, error: { code, message } })

async function callTool(name, input) {
  const res = await fetch(`${BRIDGE}/__claude/tool`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-bridge-token': TOKEN },
    body: JSON.stringify({ name, input }),
  })
  if (!res.ok) return { content: `Bridge error ${res.status}: ${await res.text()}`, is_error: true }
  return res.json()
}

const rl = createInterface({ input: process.stdin })
rl.on('line', async (line) => {
  let msg
  try { msg = JSON.parse(line) } catch { return }
  const { id, method, params } = msg
  if (method === 'initialize') {
    return reply(id, {
      protocolVersion: params?.protocolVersion || '2025-06-18',
      capabilities: { tools: {} },
      serverInfo: { name: 'nfl', version: '1.0.0' },
    })
  }
  if (method === 'ping') return reply(id, {})
  if (method === 'tools/list') {
    return reply(id, { tools: TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.input_schema })) })
  }
  if (method === 'tools/call') {
    try {
      const out = await callTool(params.name, params.arguments || {})
      return reply(id, { content: [{ type: 'text', text: String(out.content) }], isError: !!out.is_error })
    } catch (e) {
      return reply(id, { content: [{ type: 'text', text: `Bridge unreachable: ${e.message}` }], isError: true })
    }
  }
  if (id !== undefined) fail(id, -32601, `Method not found: ${method}`)
})
