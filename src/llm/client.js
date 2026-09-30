import Anthropic from '@anthropic-ai/sdk'

const KEY = 'nflviz.apiKey'

export function getApiKey() {
  try { return localStorage.getItem(KEY) || '' } catch { return '' }
}
export function setApiKey(k) {
  try {
    if (k) localStorage.setItem(KEY, k.trim())
    else localStorage.removeItem(KEY)
  } catch { /* ignore */ }
}

let cached = { key: null, client: null }
/** The key stays in this browser; requests go straight to api.anthropic.com. */
export function getClient(apiKey = getApiKey()) {
  if (!apiKey) return null
  if (cached.key !== apiKey) {
    cached = { key: apiKey, client: new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 2, timeout: 600_000 }) }
  }
  return cached.client
}

export { Anthropic }
