/** Dollar cost of one response's usage. Cache writes bill at 1.25x input. */
export function costFromUsage(u, model) {
  if (!u) return 0
  const inp = (u.input_tokens || 0) * model.inPerM
  const write = (u.cache_creation_input_tokens || 0) * model.inPerM * 1.25
  const read = (u.cache_read_input_tokens || 0) * model.cacheReadPerM
  const out = (u.output_tokens || 0) * model.outPerM
  return (inp + write + read + out) / 1e6
}

export function sumUsage(list) {
  const s = { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }
  for (const u of list) for (const k in s) s[k] += u?.[k] || 0
  return s
}

export const fmtUsd = (x) => (x < 0.01 ? `$${x.toFixed(4)}` : `$${x.toFixed(3)}`)

const SESSION_KEY = 'nflviz.spend'
export function addSpend(usd) {
  try {
    const cur = JSON.parse(localStorage.getItem(SESSION_KEY) || '{"total":0,"n":0}')
    cur.total += usd
    cur.n += 1
    localStorage.setItem(SESSION_KEY, JSON.stringify(cur))
    return cur
  } catch { return null }
}
export function getSpend() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || '{"total":0,"n":0}') } catch { return { total: 0, n: 0 } }
}
