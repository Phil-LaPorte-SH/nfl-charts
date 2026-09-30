// Historical / alternate abbreviations -> current franchise. Mirrors
// TEAM_ALIASES in nfl-charts-data/scripts/common.py. nflverse already uses
// current codes in pbp and stats, so this mainly guards other sources.
export const TEAM_ALIASES = {
  STL: 'LA', SL: 'LA', LAR: 'LA',
  SD: 'LAC',
  OAK: 'LV',
  JAC: 'JAX',
  WSH: 'WAS',
  ARZ: 'ARI', BLT: 'BAL', CLV: 'CLE', HST: 'HOU',
}

export const CURRENT_TEAMS = [
  'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE', 'DAL', 'DEN', 'DET',
  'GB', 'HOU', 'IND', 'JAX', 'KC', 'LA', 'LAC', 'LV', 'MIA', 'MIN', 'NE', 'NO',
  'NYG', 'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB', 'TEN', 'WAS',
]

export const canonTeam = (abbr) => (abbr && TEAM_ALIASES[abbr]) || abbr

export function canonTeamMacroSql() {
  const whens = Object.entries(TEAM_ALIASES).map(([k, v]) => `WHEN '${k}' THEN '${v}'`).join(' ')
  return `CREATE OR REPLACE MACRO canon_team(x) AS CASE x ${whens} ELSE x END`
}
