import * as duckdb from '@duckdb/duckdb-wasm'
import wasmUrl from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url'
import workerUrl from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url'

// One DuckDB instance and one connection for the session. GitHub Pages cannot
// send COOP/COEP headers, so the threaded "coi" bundle is off the table; "eh"
// (wasm exception handling) is supported by every current browser.
let dbPromise = null
let connPromise = null

export function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const worker = new Worker(workerUrl)
      const db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING), worker)
      await db.instantiate(wasmUrl)
      await db.open({
        query: { castBigIntToDouble: true, castDecimalToDouble: true },
        // Read parquet by byte range. Full reads stay allowed as a fallback for
        // servers without Range support, but must never be forced.
        filesystem: { reliableHeadRequests: false, allowFullHTTPReads: true, forceFullHTTPReads: false },
      })
      return db
    })()
  }
  return dbPromise
}

export function getConn() {
  if (!connPromise) {
    connPromise = (async () => {
      const db = await getDb()
      const conn = await db.connect()
      await conn.query(`SET enable_object_cache = true`)
      return conn
    })()
  }
  return connPromise
}

/** Tear everything down (used when a query refuses to cancel). */
export async function resetDb() {
  const db = dbPromise && (await dbPromise.catch(() => null))
  dbPromise = null
  connPromise = null
  if (db) await db.terminate().catch(() => {})
}

export { duckdb }
