import Anthropic from '@anthropic-ai/sdk'

/** Map SDK errors to something the UI can act on. Most specific first. */
export function classifyError(err) {
  if (err?.name === 'AbortError' || err instanceof Anthropic.APIUserAbortError) return { kind: 'cancelled', message: 'Stopped.' }
  if (err instanceof Anthropic.AuthenticationError) return { kind: 'auth', message: 'Your API key was rejected (401). Enter a valid key.' }
  if (err instanceof Anthropic.PermissionDeniedError) return { kind: 'auth', message: 'This key cannot use that model (403). Try another model or key.' }
  if (err instanceof Anthropic.RateLimitError) {
    const ra = Number(err.headers?.get?.('retry-after'))
    return { kind: 'rate', message: `Rate limited${ra ? `; retry in ${ra}s` : ''}.`, retryAfterMs: ra ? ra * 1000 : null }
  }
  if (err instanceof Anthropic.BadRequestError) return { kind: 'bad_request', message: err.message }
  if (err instanceof Anthropic.APIConnectionError) return { kind: 'network', message: 'Could not reach the Anthropic API. Check your connection.' }
  if (err instanceof Anthropic.APIError) return { kind: 'api', message: `API error ${err.status ?? ''}: ${err.message}` }
  return { kind: 'unknown', message: String(err?.message || err) }
}
