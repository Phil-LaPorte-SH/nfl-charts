import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { resolve, normalize, extname } from 'node:path'

const TYPES = { '.json': 'application/json', '.png': 'image/png', '.parquet': 'application/octet-stream' }

// Static file handler that mimics GitHub Pages' Range behaviour: HEAD ignores
// Range (200 + full length), GET with Range answers 206 with exactly the bytes
// asked for. (sirv answers `bytes=0-0` with the whole file, which makes
// DuckDB-WASM give up on range reads and download entire parquet files.)
function rangeStatic(dir) {
  return (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    if (process.env.DEBUG_DATA) console.log('[data]', req.method, req.url, req.headers.range || '-')
    const rel = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^([/\\])+/, '')
    if (rel.startsWith('..')) return next()
    const file = resolve(dir, rel)
    let st
    try { st = statSync(file) } catch { return next() }
    if (!st.isFile()) return next()
    const size = st.size
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Content-Type', TYPES[extname(file)] || 'application/octet-stream')
    res.setHeader('Last-Modified', st.mtime.toUTCString())
    res.setHeader('Cache-Control', 'max-age=600')
    const m = req.method === 'GET' && /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '')
    if (m && (m[1] || m[2])) {
      let start = m[1] === '' ? size - Number(m[2]) : Number(m[1])
      let end = m[1] === '' || m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1)
      if (start > end || start >= size) {
        res.statusCode = 416
        res.setHeader('Content-Range', `bytes */${size}`)
        return res.end()
      }
      res.statusCode = 206
      res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`)
      res.setHeader('Content-Length', String(end - start + 1))
      return createReadStream(file, { start, end }).pipe(res)
    }
    res.statusCode = 200
    res.setHeader('Content-Length', String(size))
    if (req.method === 'HEAD') return res.end()
    createReadStream(file).pipe(res)
  }
}

// Dev only: serve the nfl-charts-data build output at /data with Range support,
// without copying ~640 MB into public/ (which `vite build` would bundle).
function devData() {
  const dir = resolve(process.env.NFL_DATA_DIR || '../nfl-charts-data/site')
  return {
    name: 'nfl-dev-data',
    apply: 'serve',
    configureServer(server) {
      if (!existsSync(dir)) {
        server.config.logger.warn(`[nfl-dev-data] ${dir} not found; /data will 404. See README.`)
        return
      }
      server.middlewares.use('/data', rangeStatic(dir))
      server.config.logger.info(`[nfl-dev-data] serving ${dir} at /data`)
    },
  }
}

export default defineConfig({
  base: '/nfl-charts/',
  plugins: [react(), devData()],
  optimizeDeps: { exclude: ['@duckdb/duckdb-wasm'] },
  worker: { format: 'es' },
  server: {
    proxy: {
      '/remote-data': {
        target: 'https://phil-laporte-sh.github.io',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/remote-data/, '/nfl-charts-data'),
      },
    },
  },
  test: { environment: 'node', include: ['src/**/*.test.js'] },
})
