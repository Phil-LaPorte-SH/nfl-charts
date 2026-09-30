import { getDb, getConn, duckdb } from './duckdb.js'
import { getManifest } from './manifest.js'
import { fetchCached } from './cache.js'
import { canonTeamMacroSql } from './teams.js'
import { dataUrl } from '../config.js'
import { VIEW_NAMES as SHARED_VIEW_NAMES } from './viewNames.js'

/*
 * Views the rest of the app (and the LLM) query. Each view is backed by one or
 * more manifest datasets and is created lazily the first time SQL names it.
 *
 *  pbp_lite      curated play-by-play, hive-partitioned by season (preferred)
 *  pbp           raw nflverse play-by-play, all 372 columns
 *  player_week   one row per player per game
 *  player_season one row per player per season per season_type (REG / POST)
 *  team_week     one row per team per game
 *  team_season   one row per team per season per season_type (REG / POST)
 *  teams         32 current franchises with colors and logo URLs
 *  players       player directory (gsis_id, names, position, draft, ...)
 *  games         schedule and results
 */
export const VIEWS = {
  pbp_lite: { datasets: ['pbp_lite'], build: pbpLiteSql },
  pbp: { datasets: ['pbp'], build: pbpSql },
  player_week: { datasets: ['player_week'], build: (m) => `SELECT * FROM ${readList(m, 'player_week')}` },
  player_season: {
    datasets: ['player_reg', 'player_post'],
    build: (m) => `SELECT * EXCLUDE (recent_team), recent_team AS team FROM ${readList(m, ['player_reg', 'player_post'])}`,
  },
  team_week: { datasets: ['team_week'], build: (m) => `SELECT * FROM ${readList(m, 'team_week')}` },
  team_season: {
    datasets: ['team_reg', 'team_post'],
    build: (m) => `SELECT * FROM ${readList(m, ['team_reg', 'team_post'])}`,
  },
  teams: {
    datasets: ['teams'],
    build: (m) => `SELECT team_abbr, team_name, team_nick, team_conf, team_division,
        team_color, team_color2, team_color3, team_color4,
        team_logo_espn, team_wordmark, team_logo_squared
      FROM ${readList(m, 'teams')}
      WHERE team_abbr NOT IN ('LAR', 'OAK', 'SD', 'STL')`,
  },
  players: { datasets: ['players'], build: (m) => `SELECT * FROM ${readList(m, 'players')}` },
  games: { datasets: ['games'], build: (m) => `SELECT * FROM ${readList(m, 'games')}` },
}

export const VIEW_NAMES = Object.keys(VIEWS)
if (VIEW_NAMES.join() !== SHARED_VIEW_NAMES.join()) console.warn('viewNames.js is out of sync with VIEWS')
const VIEW_RE = new RegExp(`\\b(${VIEW_NAMES.join('|')})\\b`, 'gi')

// Registered virtual file name inside DuckDB. Keeps the path (so hive
// partition segments like season=2022/ survive) under a stable prefix.
const fileName = (path) => `nfl/${path}`

const registered = new Map() // dataset -> Promise
const created = new Map() // view -> Promise

function filesOf(m, ds) {
  const d = m.datasets[ds]
  if (!d) throw new Error(`Dataset "${ds}" is not in manifest.json`)
  return d.files
}

function readList(m, dsOrList) {
  const list = Array.isArray(dsOrList) ? dsOrList : [dsOrList]
  const files = list.flatMap((ds) => filesOf(m, ds).map((f) => `'${fileName(f.path)}'`))
  const uniform = list.every((ds) => m.datasets[ds].schema_uniform) && list.length === 1
  return `read_parquet([${files.join(', ')}]${uniform ? '' : ', union_by_name = true'})`
}

function pbpLiteSql(m) {
  const files = filesOf(m, 'pbp_lite').map((f) => `'${fileName(f.path)}'`)
  return `SELECT * FROM read_parquet([${files.join(', ')}], hive_partitioning = true, hive_types = {'season': INTEGER})`
}

function pbpSql(m) {
  return `SELECT *,
      canon_team(posteam) AS posteam_canon, canon_team(defteam) AS defteam_canon
    FROM ${readList(m, 'pbp')}`
}

async function registerDataset(ds) {
  if (!registered.has(ds)) {
    registered.set(ds, (async () => {
      const [m, db] = await Promise.all([getManifest(), getDb()])
      const d = m.datasets[ds]
      if (!d) throw new Error(`Dataset "${ds}" is not in manifest.json`)
      await Promise.all(d.files.map(async (f) => {
        const url = dataUrl(f.path)
        if (d.load === 'buffer') {
          await db.registerFileBuffer(fileName(f.path), await fetchCached(url, f.v))
        } else {
          await db.registerFileURL(fileName(f.path), url, duckdb.DuckDBDataProtocol.HTTP, false)
        }
      }))
    })().catch((e) => { registered.delete(ds); throw e }))
  }
  return registered.get(ds)
}

let macroPromise = null
async function ensureMacros(conn) {
  if (!macroPromise) macroPromise = conn.query(canonTeamMacroSql())
  return macroPromise
}

export function ensureView(name) {
  const key = name.toLowerCase()
  const v = VIEWS[key]
  if (!v) return Promise.resolve()
  if (!created.has(key)) {
    created.set(key, (async () => {
      const [m, conn] = await Promise.all([getManifest(), getConn()])
      await ensureMacros(conn)
      await Promise.all(v.datasets.map(registerDataset))
      await conn.query(`CREATE OR REPLACE VIEW ${key} AS ${v.build(m)}`)
    })().catch((e) => { created.delete(key); throw e }))
  }
  return created.get(key)
}

/** Create every view the SQL mentions before it runs. */
export async function ensureViewsFor(sql) {
  const names = new Set((sql.match(VIEW_RE) || []).map((s) => s.toLowerCase()))
  await Promise.all([...names].map(ensureView))
}

/** Views that are cheap and needed by nearly every question. */
export async function warmUp() {
  await Promise.all(['teams', 'players', 'games'].map(ensureView))
  // Stats tables (~45 MB) load in the background after the core ones.
  Promise.all(['player_season', 'team_season', 'player_week', 'team_week'].map(ensureView)).catch(() => {})
}

/** Forget view state after a DuckDB reset. */
export function forgetViews() {
  registered.clear()
  created.clear()
  macroPromise = null
}
