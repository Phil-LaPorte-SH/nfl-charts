import { ordinal } from '../format.js'

// Reference posters rebuilt from live data. Each fixture is SQL plus a spec
// builder, so the gallery doubles as an end-to-end render test.
const col = (res, name) => res.columns.findIndex((c) => c.name === name)
const rowOf = (res, key, val) => res.rows.find((r) => r[col(res, key)] === val)

export const FIXTURES = [
  {
    id: 'drive-saving-flags',
    name: 'Drive-Saving Flags (ranked bars, team theme)',
    sql: `WITH flags AS (
  SELECT posteam_canon AS team, count(*) AS n
  FROM pbp_lite
  WHERE season >= 2018 AND penalty = 1 AND penalty_team = defteam
    AND first_down_penalty = 1 AND down IN (3, 4)
  GROUP BY 1
), gms AS (
  SELECT team, count(*) AS games FROM (
    SELECT DISTINCT game_id, posteam_canon AS team FROM pbp_lite WHERE season >= 2018 AND posteam IS NOT NULL
  ) GROUP BY 1
)
SELECT f.team, f.n, g.games, round(f.n * 17.0 / g.games, 1) AS per17,
       f.n || ' in ' || g.games AS total_games,
       rank() OVER (ORDER BY f.n * 17.0 / g.games DESC) AS nfl_rank
FROM flags f JOIN gms g USING (team)
ORDER BY per17 DESC`,
    build: (res) => {
      const kc = rowOf(res, 'team', 'KC')
      const avg = res.rows.reduce((s, r) => s + r[col(res, 'per17')], 0) / res.rows.length
      const rank = kc[col(res, 'nfl_rank')]
      return {
        type: 'ranked_bar', title: 'Drive-Saving Flags', title_accent: 'Flags',
        subtitle: 'Every defensive penalty that gave a failed 3rd or 4th down a new set of downs · 2018 to date (Mahomes era)',
        caption: '', aspect: 'portrait', theme: { mode: 'team', team: 'KC' }, result_id: 'q1',
        encoding: { label: null, value: 'per17', secondary: 'total_games', team: 'team', x: null, y: null, series: null, sort: 'desc' },
        highlight: { teams: ['KC'], labels: [] },
        kpis: [
          { label: 'Drawn by KC offense', value: String(kc[col(res, 'n')]), sublabel: `In ${kc[col(res, 'games')]} games` },
          { label: 'Per 17 games', value: kc[col(res, 'per17')].toFixed(1), sublabel: `League avg ${avg.toFixed(1)}` },
          { label: 'NFL rank', value: ordinal(rank), sublabel: `${ordinal(res.rows.length + 1 - rank)} fewest in the league` },
        ],
        reference_lines: [], quadrants: null,
        format: { value: 'dec1', secondary: null, x: null, y: null, value_suffix: null, value_title: 'Drawn by offense, per 17 games', secondary_title: 'Total / gms', x_title: null, y_title: null },
        columns: null,
        footnote: 'All accepted defensive penalties on 3rd or 4th down that awarded a first down. Includes playoffs.',
        source: 'nflverse play-by-play (github.com/nflverse)',
      }
    },
  },
  {
    id: 'sack-totals',
    name: 'Sack Totals 2020-25 (logo ruler)',
    sql: `SELECT team, sum(def_sacks)::INT AS sacks
FROM team_season
WHERE season BETWEEN 2020 AND 2025 AND season_type = 'REG'
GROUP BY team ORDER BY sacks DESC`,
    build: () => ({
      type: 'logo_strip', title: 'Sack Totals 2020-25', title_accent: null, subtitle: 'Combined regular seasons', caption: '',
      aspect: 'portrait', theme: { mode: 'light', team: null }, result_id: 'q1',
      encoding: { label: null, value: 'sacks', secondary: null, team: 'team', x: null, y: null, series: null, sort: 'desc' },
      highlight: { teams: [], labels: [] }, kpis: [], reference_lines: [], quadrants: null,
      format: { value: 'int', secondary: null, x: null, y: null, value_suffix: null, value_title: null, secondary_title: null, x_title: null, y_title: null },
      columns: null, footnote: null, source: 'nflverse team stats',
    }),
  },
  {
    id: 'rushing-efficiency',
    name: 'Rushing Efficiency (logo scatter, quadrants)',
    sql: `SELECT posteam_canon AS team, avg(epa) AS rush_epa, avg(success) AS success_rate, count(*) AS rushes
FROM pbp_lite
WHERE season = (SELECT max(season) FROM games WHERE result IS NOT NULL)
  AND season_type = 'REG' AND rush = 1 AND epa IS NOT NULL
GROUP BY 1`,
    build: () => ({
      type: 'logo_scatter', title: 'NFL Rushing Efficiency', title_accent: 'Efficiency',
      subtitle: 'Rush EPA per play vs. rushing success rate, this season to date', caption: '',
      aspect: 'landscape', theme: { mode: 'light', team: null }, result_id: 'q1',
      encoding: { label: null, value: null, secondary: null, team: 'team', x: 'rush_epa', y: 'success_rate', series: null, sort: 'none' },
      highlight: { teams: [], labels: [] }, kpis: [],
      reference_lines: [{ axis: 'x', value: null, stat: 'mean', label: 'League avg' }, { axis: 'y', value: null, stat: 'mean', label: 'League avg' }],
      quadrants: { top_right: 'Efficient + consistent', top_left: 'Consistent, lower value', bottom_right: 'Boom / bust', bottom_left: 'Struggling' },
      format: { value: null, secondary: null, x: 'signed2', y: 'pct', value_suffix: null, value_title: null, secondary_title: null, x_title: 'Rush EPA per play → more efficient', y_title: 'Rushing success rate → more consistent' },
      columns: null, footnote: 'League averages shown with dashed lines. Regular season.', source: 'nflverse play-by-play',
    }),
  },
  {
    id: 'qb-yards-line',
    name: 'QB passing yards by season (line, dark)',
    sql: `SELECT season, player_display_name AS qb, passing_yards
FROM player_season
WHERE season_type = 'REG' AND season BETWEEN 2018 AND 2025
  AND player_id IN ('00-0033873', '00-0034857', '00-0036442', '00-0034796')  -- ids, not names: two Lamar Jacksons
ORDER BY season`,
    build: () => ({
      type: 'line', title: 'The AFC Arms Race', title_accent: 'Arms', subtitle: 'Regular-season passing yards, 2018-2025', caption: '',
      aspect: 'landscape', theme: { mode: 'dark', team: null }, result_id: 'q1',
      encoding: { label: null, value: null, secondary: null, team: null, x: 'season', y: 'passing_yards', series: 'qb', sort: 'none' },
      highlight: { teams: [], labels: [] }, kpis: [], reference_lines: [], quadrants: null,
      format: { value: null, secondary: null, x: 'raw', y: 'int', value_suffix: null, value_title: null, secondary_title: null, x_title: null, y_title: 'Passing yards' },
      columns: null, footnote: 'Seasons with too few starts appear as dips.', source: 'nflverse player stats',
    }),
  },
  {
    id: 'kc-targets-donut',
    name: 'Target share (donut)',
    sql: `WITH t AS (
  SELECT player_display_name AS player, sum(targets) AS targets
  FROM player_week WHERE team = 'KC' AND season = 2025 AND season_type = 'REG'
  GROUP BY 1 HAVING sum(targets) > 0
), r AS (SELECT *, row_number() OVER (ORDER BY targets DESC) AS rk FROM t)
SELECT CASE WHEN rk <= 5 THEN player ELSE 'Everyone else' END AS player, sum(targets)::INT AS targets
FROM r GROUP BY 1 ORDER BY min(rk)`,
    build: () => ({
      type: 'donut', title: 'Who Gets the Ball?', title_accent: null, subtitle: 'Chiefs targets by player, 2025 regular season', caption: '',
      aspect: 'square', theme: { mode: 'team', team: 'KC' }, result_id: 'q1',
      encoding: { label: 'player', value: 'targets', secondary: null, team: null, x: null, y: null, series: null, sort: 'none' },
      highlight: { teams: [], labels: [] }, kpis: [], reference_lines: [], quadrants: null,
      format: { value: 'int', secondary: null, x: null, y: null, value_suffix: null, value_title: null, secondary_title: null, x_title: null, y_title: null },
      columns: null, footnote: null, source: 'nflverse player stats',
    }),
  },
  {
    id: 'afc-west-sacks',
    name: 'AFC West sacks by season (grouped columns)',
    sql: `SELECT season::VARCHAR AS season, team, sum(def_sacks)::INT AS sacks
FROM team_season WHERE team IN ('KC','DEN','LV','LAC') AND season BETWEEN 2022 AND 2025 AND season_type = 'REG'
GROUP BY 1, 2 ORDER BY 1, 2`,
    build: () => ({
      type: 'grouped_bar', title: 'AFC West Pass Rush', title_accent: null, subtitle: 'Team sacks per regular season', caption: '',
      aspect: 'landscape', theme: { mode: 'light', team: null }, result_id: 'q1',
      encoding: { label: 'season', value: 'sacks', secondary: null, team: null, x: null, y: null, series: 'team', sort: 'none' },
      highlight: { teams: [], labels: [] }, kpis: [], reference_lines: [], quadrants: null,
      format: { value: 'int', secondary: null, x: null, y: null, value_suffix: null, value_title: null, secondary_title: null, x_title: null, y_title: null },
      columns: null, footnote: null, source: 'nflverse team stats',
    }),
  },
  {
    id: 'qb-epa-table',
    name: 'Top QBs by EPA (table)',
    sql: `SELECT player_display_name AS player, team, attempts::INT AS att, passing_yards::INT AS yds, passing_tds::INT AS td,
       round(passing_epa, 1) AS pass_epa, round(passing_cpoe, 1) AS cpoe
FROM player_season WHERE season = 2025 AND season_type = 'REG' AND attempts >= 250
ORDER BY passing_epa DESC LIMIT 12`,
    build: () => ({
      type: 'table', title: 'The EPA Leaderboard', title_accent: 'EPA', subtitle: 'Quarterbacks, 2025 regular season (250+ attempts)', caption: '',
      aspect: 'portrait', theme: { mode: 'light', team: null }, result_id: 'q1',
      encoding: { label: 'player', value: 'pass_epa', secondary: null, team: 'team', x: null, y: null, series: null, sort: 'none' },
      highlight: { teams: ['KC'], labels: [] }, kpis: [], reference_lines: [], quadrants: null,
      format: { value: 'dec1', secondary: null, x: null, y: null, value_suffix: null, value_title: null, secondary_title: null, x_title: null, y_title: null },
      columns: null, footnote: 'Total expected points added on dropbacks.', source: 'nflverse player stats',
    }),
  },
  {
    id: 'mahomes-tiles',
    name: 'Stat tiles',
    sql: `SELECT passing_yards::INT AS yds, passing_tds::INT AS td, passing_interceptions::INT AS ints, round(completions * 100.0 / attempts, 1) AS pct
FROM player_season WHERE player_id = '00-0033873' AND season = 2025 AND season_type = 'REG'`,
    build: (res) => {
      const r = res.rows[0] || []
      return {
        type: 'stat_tiles', title: 'Mahomes in 2025', title_accent: 'Mahomes', subtitle: 'Regular season passing', caption: '',
        aspect: 'square', theme: { mode: 'team', team: 'KC' }, result_id: null,
        encoding: { label: null, value: null, secondary: null, team: null, x: null, y: null, series: null, sort: 'none' },
        highlight: { teams: [], labels: [] },
        kpis: [
          { label: 'Passing yards', value: (r[0] ?? 0).toLocaleString(), sublabel: null },
          { label: 'Touchdowns', value: String(r[1] ?? '—'), sublabel: null },
          { label: 'Interceptions', value: String(r[2] ?? '—'), sublabel: null },
          { label: 'Completion %', value: `${r[3] ?? '—'}%`, sublabel: null },
        ],
        reference_lines: [], quadrants: null,
        format: { value: null, secondary: null, x: null, y: null, value_suffix: null, value_title: null, secondary_title: null, x_title: null, y_title: null },
        columns: null, footnote: null, source: 'nflverse player stats',
      }
    },
  },
]
