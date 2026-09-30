// Vite dev-server plugin: run questions through the local Claude Code CLI
// (`claude -p`), which uses whatever account `claude` is signed into (e.g. a
// Max plan) instead of an API key. Dev server only; never part of a build.
//
//   browser ──POST /__claude/ask──► bridge ──spawn──► claude -p (stream-json)
//                                                        │ MCP stdio
//   browser ◄──NDJSON stream────── bridge ◄──POST /__claude/tool── dev/nfl-mcp.mjs
//   browser ──POST /__claude/tool-result──► bridge ──► MCP reply ──► claude
import { spawn, execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { TOOLS } from '../src/llm/toolDefs.js'

const MCP_SCRIPT = resolve('dev/nfl-mcp.mjs')
const PROMPT_FILE = resolve('src/llm/prompt/system.md')
const WORKDIR = join(tmpdir(), 'nfl-charts-claude')
const ALLOWED = TOOLS.map((t) => `mcp__nfl__${t.name}`)
const TOOL_NOTE = `\n\n# Tool names in this environment\n\nThe tools are exposed through an MCP server, so they are named ${ALLOWED.map((n) => `\`${n}\``).join(', ')}. Everything above about \`execute_sql\`, \`find_player\`, \`describe_columns\` and \`render_chart\` applies to them. They are the only tools you have.`

const readBody = (req) => new Promise((res, rej) => {
  let b = ''
  req.on('data', (c) => { b += c })
  req.on('end', () => { try { res(b ? JSON.parse(b) : {}) } catch (e) { rej(e) } })
  req.on('error', rej)
})

function claudeStatus() {
  return new Promise((res) => {
    execFile('claude', ['auth', 'status'], { timeout: 15000 }, (err, stdout) => {
      if (err) return res({ available: false, reason: 'The `claude` CLI was not found or is not signed in.' })
      try {
        const s = JSON.parse(stdout)
        res({ available: !!s.loggedIn, email: s.email, plan: s.subscriptionType, authMethod: s.authMethod, reason: s.loggedIn ? null : 'Run `claude` and sign in first.' })
      } catch {
        res({ available: false, reason: 'Could not read `claude auth status`.' })
      }
    })
  })
}

export default function claudeBridge() {
  const sessions = new Map() // token -> { res (ndjson stream), pending: Map(callId -> resolve) }
  let status = null

  return {
    name: 'nfl-claude-bridge',
    apply: 'serve',
    configureServer(server) {
      mkdirSync(WORKDIR, { recursive: true })
      const port = () => server.config.server.port || 5173

      server.middlewares.use('/__claude/status', async (req, res) => {
        status = status && status.available ? status : await claudeStatus()
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify(status))
      })

      server.middlewares.use('/__claude/ask', async (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; return res.end() }
        let body
        try { body = await readBody(req) } catch { res.statusCode = 400; return res.end('bad json') }
        const token = randomUUID()
        const system = readFileSync(PROMPT_FILE, 'utf8').trim() + TOOL_NOTE
        const mcp = { mcpServers: { nfl: { type: 'stdio', command: process.execPath, args: [MCP_SCRIPT], env: { NFL_BRIDGE_URL: `http://localhost:${port()}`, NFL_BRIDGE_TOKEN: token } } } }
        const args = [
          '-p', '--output-format', 'stream-json', '--verbose', '--include-partial-messages',
          '--system-prompt', system,
          '--tools', '',
          '--mcp-config', JSON.stringify(mcp), '--strict-mcp-config',
          '--allowedTools', ...ALLOWED,
          '--permission-mode', 'dontAsk',
          '--setting-sources', '',
          '--disable-slash-commands',
          '--max-turns', '10',
        ]
        if (body.model) args.push('--model', body.model)
        if (body.effort) args.push('--effort', body.effort)
        if (body.sessionId) args.push('--resume', body.sessionId)

        res.setHeader('content-type', 'application/x-ndjson')
        res.setHeader('cache-control', 'no-cache')
        const write = (obj) => { if (!res.writableEnded) res.write(JSON.stringify(obj) + '\n') }
        const session = { write, pending: new Map() }
        sessions.set(token, session)

        const child = spawn('claude', args, { cwd: WORKDIR, env: { ...process.env, CLAUDE_CODE_ENTRYPOINT: 'nfl-charts-local' }, stdio: ['pipe', 'pipe', 'pipe'] })
        child.stdin.end(String(body.prompt || ''))
        let buf = ''
        child.stdout.on('data', (chunk) => {
          buf += chunk
          let i
          while ((i = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, i).trim()
            buf = buf.slice(i + 1)
            if (!line) continue
            try { write({ t: 'cc', d: JSON.parse(line) }) } catch { /* non-JSON noise */ }
          }
        })
        let stderr = ''
        child.stderr.on('data', (c) => { stderr += c })
        child.on('close', (code) => {
          for (const r of session.pending.values()) r({ content: 'Session ended.', is_error: true })
          sessions.delete(token)
          write({ t: 'exit', code, stderr: code ? stderr.slice(-2000) : '' })
          res.end()
        })
        res.on('close', () => { if (!res.writableFinished) child.kill('SIGTERM') })
      })

      // From the MCP server: a tool call to relay to the browser.
      server.middlewares.use('/__claude/tool', async (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; return res.end() }
        const s = sessions.get(req.headers['x-bridge-token'])
        if (!s) { res.statusCode = 404; return res.end('no such session') }
        const body = await readBody(req)
        const callId = randomUUID()
        const result = await new Promise((resolveCall) => {
          s.pending.set(callId, resolveCall)
          s.write({ t: 'tool', callId, name: body.name, input: body.input })
        })
        s.pending.delete(callId)
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify(result))
      })

      // From the browser: the result of a relayed tool call.
      server.middlewares.use('/__claude/tool-result', async (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; return res.end() }
        const body = await readBody(req)
        for (const s of sessions.values()) {
          const r = s.pending.get(body.callId)
          if (r) { r({ content: body.content, is_error: !!body.is_error }); break }
        }
        res.end('ok')
      })
    },
  }
}
