// Vite dev-server plugin: publish a chart as a static page + PNG on Cloudflare
// Pages (https://<project>.pages.dev/s/<id>/), which unfurls on Reddit. Nothing
// is pushed to GitHub, so shares aren't tied to a personal account. Dev only.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { DIR, PUBLIC, PROJECT, readConfig, readList, rebuildSite, commitLocal, deploy } from './shareSite.js'

const slug = (s) => String(s || 'chart').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'chart'

function status() {
  const cfg = readConfig()
  if (!existsSync(DIR) || !cfg?.baseUrl) {
    return { available: false, reason: `Share site not set up (${DIR}). Run: node dev/setup-shares.mjs` }
  }
  return { available: true, base: cfg.baseUrl, project: cfg.project || PROJECT }
}

export default function shareServer() {
  let queue = Promise.resolve()
  return {
    name: 'nfl-share-server',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__share/status', (_req, res) => {
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify(status()))
      })
      server.middlewares.use('/__share/publish', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; return res.end() }
        let body = ''
        req.on('data', (c) => { body += c })
        req.on('end', () => {
          const job = queue.then(async () => {
            const b = JSON.parse(body)
            const st = status()
            if (!st.available) throw new Error(st.reason)
            const base = st.base
            const now = new Date()
            const id = `${now.toISOString().slice(0, 10)}-${slug(b.title)}-${randomBytes(2).toString('hex')}`
            const share = {
              id, title: b.title, subtitle: b.subtitle, caption: b.caption, footnote: b.footnote, source: b.source,
              sql: (b.sql || []).filter(Boolean).slice(0, 5), width: b.width, height: b.height, date: now.toISOString().slice(0, 10),
            }
            const folder = join(PUBLIC, 's', id)
            mkdirSync(folder, { recursive: true })
            writeFileSync(join(folder, 'chart.png'), Buffer.from(b.png, 'base64'))
            rebuildSite([share, ...readList().filter((x) => x.id !== id)], base)
            await commitLocal(`Share: ${b.title}`)
            await deploy()
            return { id, pageUrl: `${base}s/${id}/`, imageUrl: `${base}s/${id}/chart.png`, galleryUrl: base }
          })
          queue = job.catch(() => {})
          job.then((out) => {
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify(out))
          }).catch((e) => {
            res.statusCode = 500
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ error: e.message }))
          })
        })
      })
    },
  }
}
