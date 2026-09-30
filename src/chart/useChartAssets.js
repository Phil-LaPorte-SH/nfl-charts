import { useEffect, useState } from 'react'
import { runQuery, asObjects } from '../db/query.js'
import { preloadLogos } from './logos.js'
import { ensureFonts } from './fonts.js'
import { CURRENT_TEAMS } from '../db/teams.js'

let teamsPromise = null
export function loadTeams() {
  if (!teamsPromise) {
    teamsPromise = runQuery('SELECT * FROM teams')
      .then((r) => Object.fromEntries(asObjects(r).map((t) => [t.team_abbr, t])))
      .catch((e) => { teamsPromise = null; throw e })
  }
  return teamsPromise
}

let logosPromise = null
export function loadLogos() {
  if (!logosPromise) logosPromise = preloadLogos(CURRENT_TEAMS)
  return logosPromise
}

/** Teams index, logos (data URLs) and font readiness for posters. */
export function useChartAssets() {
  const [state, setState] = useState({ teams: null, logos: null, fontsReady: false, error: null })
  useEffect(() => {
    let live = true
    ensureFonts().then(() => live && setState((s) => ({ ...s, fontsReady: true })))
    loadTeams().then((teams) => live && setState((s) => ({ ...s, teams }))).catch((e) => live && setState((s) => ({ ...s, error: String(e.message || e) })))
    loadLogos().then((logos) => live && setState((s) => ({ ...s, logos })))
    return () => { live = false }
  }, [])
  return state
}
