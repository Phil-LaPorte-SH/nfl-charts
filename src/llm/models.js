// Prices are USD per million tokens (Anthropic first-party API, Sept 2026).
export const MODELS = [
  { id: 'claude-opus-5-5', label: 'Opus 5.5', inPerM: 4, outPerM: 20, cacheReadPerM: 0.2, thinking: 'adaptive', effort: true, default: true },
  { id: 'claude-opus-5', label: 'Opus 5', inPerM: 5, outPerM: 25, cacheReadPerM: 0.5, thinking: 'adaptive', effort: true },
  { id: 'claude-sonnet-5', label: 'Sonnet 5', inPerM: 2, outPerM: 10, cacheReadPerM: 0.2, thinking: 'adaptive', effort: true },
  { id: 'claude-haiku-4-5', label: 'Haiku 4.5', inPerM: 1, outPerM: 5, cacheReadPerM: 0.1, thinking: 'budget', effort: false, budgetTokens: 4000 },
]
export const EFFORTS = ['low', 'medium', 'high']
export const DEFAULT_MODEL = MODELS.find((m) => m.default).id

export const modelById = (id) => MODELS.find((m) => m.id === id) || MODELS[0]

/**
 * Request parameters that differ by model. Opus 5.5 always thinks (effort
 * controls depth); Haiku 4.5 takes a thinking budget and rejects `effort`.
 * No temperature, no prefill, no forced tool_choice (Opus 5.5 rejects it).
 */
export function buildRequestParams(model, effort) {
  if (model.thinking === 'budget') {
    return { model: model.id, max_tokens: 16000, thinking: { type: 'enabled', budget_tokens: model.budgetTokens } }
  }
  return {
    model: model.id,
    max_tokens: 32000,
    thinking: { type: 'adaptive', display: 'summarized' },
    output_config: { effort: EFFORTS.includes(effort) ? effort : 'medium' },
  }
}
