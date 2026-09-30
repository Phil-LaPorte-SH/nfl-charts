import { useState, useCallback } from 'react'
import { DEFAULT_MODEL, modelById } from '../llm/models.js'

const KEY = 'nflviz.settings'
const DEFAULTS = { model: DEFAULT_MODEL, effort: 'medium', favoriteTeam: '', theme: 'system', engine: 'auto' }

function read() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') } } catch { return { ...DEFAULTS } }
}

export function useSettings() {
  const [s, setS] = useState(read)
  const update = useCallback((patch) => {
    setS((prev) => {
      const next = { ...prev, ...patch }
      try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [])
  return [{ ...s, modelCfg: modelById(s.model) }, update]
}

export function applyThemeAttr(theme) {
  const root = document.documentElement
  if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme)
  else root.removeAttribute('data-theme')
}
