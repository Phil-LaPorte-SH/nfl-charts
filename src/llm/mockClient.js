// Dev-only scripted stand-in for the Anthropic client, so the agent loop and
// UI can be exercised without an API key. Enable with localStorage
// 'nflviz.mock' = '1' (dev builds only). It mimics client.messages.stream().
export const mockEnabled = () => {
  if (!import.meta.env.DEV) return false
  try { return localStorage.getItem('nflviz.mock') === '1' } catch { return false }
}

const SCRIPT = [
  () => ({
    text: 'Pulling every team\'s regular-season sacks for 2020-2025.',
    tool: { name: 'execute_sql', input: { query: "SELECT team, sum(def_sacks)::INT AS sacks\nFROM team_season\nWHERE season BETWEEN 2020 AND 2025 AND season_type = 'REG'\nGROUP BY team ORDER BY sacks DESC" } },
  }),
  (last) => ({
    tool: {
      name: 'render_chart',
      input: {
        spec: {
          type: 'logo_strip', title: 'Sack Totals 2020-25', title_accent: null, subtitle: 'Combined regular seasons',
          caption: 'Pittsburgh and Denver lead the league in sacks since 2020; Carolina and Jacksonville trail.',
          aspect: 'portrait', theme: { mode: 'light', team: null }, result_id: last.result_id,
          encoding: { label: null, value: 'sacks', secondary: null, team: 'team', x: null, y: null, series: null, sort: 'desc' },
          highlight: { teams: ['KC'], labels: [] }, kpis: [], reference_lines: [], quadrants: null,
          format: { value: 'int', secondary: null, x: null, y: null, value_suffix: null, value_title: null, secondary_title: null, x_title: null, y_title: null },
          columns: null, footnote: 'Regular season only. Half sacks included.', source: 'nflverse team stats',
        },
      },
    },
  }),
]

let n = 0
function makeStream(params, opts) {
  const handlers = {}
  const on = (ev, fn) => { (handlers[ev] ||= []).push(fn); return api }
  const emit = (ev, ...a) => (handlers[ev] || []).forEach((f) => f(...a))
  const lastUser = params.messages[params.messages.length - 1]
  const lastResult = Array.isArray(lastUser.content) ? lastUser.content.find((b) => b.type === 'tool_result') : null
  let parsed = {}
  try { parsed = lastResult ? JSON.parse(lastResult.content) : {} } catch { /* not json */ }
  // A new question (text block) restarts the script, even when merged after tool results.
  const hasQuestion = Array.isArray(lastUser.content) ? lastUser.content.some((b) => b.type === 'text') : true
  const step = lastResult && !hasQuestion ? 1 : 0
  const s = SCRIPT[step](parsed)
  const finalMessage = async () => {
    const wait = (ms) => new Promise((r, j) => {
      const t = setTimeout(r, ms)
      opts?.signal?.addEventListener('abort', () => { clearTimeout(t); j(Object.assign(new Error('aborted'), { name: 'AbortError' })) }, { once: true })
    })
    const content = []
    await wait(300)
    content.push({ type: 'thinking', thinking: 'Team sacks are in team_season; sum REG seasons 2020-2025.', signature: 'mock' })
    emit('thinking', 'Team sacks are in team_season; sum REG seasons 2020-2025.')
    if (s.text) {
      for (const w of s.text.split(' ')) { await wait(25); emit('text', w + ' ') }
      content.push({ type: 'text', text: s.text })
    }
    const id = `toolu_mock_${++n}`
    emit('streamEvent', { type: 'content_block_start', content_block: { type: 'tool_use', id, name: s.tool.name } })
    await wait(200)
    emit('inputJson', '', s.tool.input)
    content.push({ type: 'tool_use', id, name: s.tool.name, input: s.tool.input })
    await wait(100)
    return { id: `msg_mock_${n}`, role: 'assistant', content, stop_reason: 'tool_use', usage: { input_tokens: 420, cache_creation_input_tokens: step ? 0 : 6100, cache_read_input_tokens: step ? 6100 : 0, output_tokens: 380 } }
  }
  const api = { on, finalMessage }
  return api
}

let client = null
export function getMockClient() {
  if (!client) client = { messages: { stream: (params, opts) => makeStream(params, opts) } }
  return client
}
