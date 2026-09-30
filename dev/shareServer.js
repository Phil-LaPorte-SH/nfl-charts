// Vite dev-server plugin: publish a chart to the nfl-charts-shares repo so it
// has a public URL (GitHub Pages) that unfurls on Reddit. Dev server only; uses
// the local git credentials. Each share = s/<id>/{chart.png,index.html}.
import { execFile } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { randomBytes } from 'node:crypto'

const DIR = resolve(process.env.NFL_SHARES_DIR || '../nfl-charts-shares')

const run = (cmd, args, cwd) => new Promise((res, rej) => {
  execFile(cmd, args, { cwd, timeout: 60000 }, (err, stdout, stderr) => (err ? rej(new Error((stderr || err.message).trim())) : res(stdout.trim())))
})

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const slug = (s) => String(s || 'chart').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'chart'

async function pagesBase() {
  const url = await run('git', ['remote', 'get-url', 'origin'], DIR)
  const m = url.match(/github\.com[:/]([^/]+)\/([^/.]+)(\.git)?$/)
  if (!m) throw new Error(`Can't derive a GitHub Pages URL from remote ${url}`)
  return `https://${m[1].toLowerCase()}.github.io/${m[2]}/`
}

const STYLE = `
:root{--bg:#f6f6f4;--surface:#fff;--ink:#16171a;--muted:#5d6068;--line:#dddcd7;--accent:#c8102e;color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#111214;--surface:#1a1b1e;--ink:#eeeef0;--muted:#a3a6ae;--line:#2e3035;--accent:#ff4d5e;color-scheme:dark}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:960px;margin:0 auto;padding:24px 16px 48px}a{color:var(--accent)}
img.chart{width:100%;height:auto;border-radius:10px;border:1px solid var(--line);display:block;background:var(--surface)}
h1{font-size:clamp(24px,4vw,34px);line-height:1.15;margin:0 0 8px}.muted{color:var(--muted)}
details{margin-top:16px;background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:10px 14px}
pre{white-space:pre-wrap;font:12.5px/1.5 ui-monospace,Menlo,monospace;margin:8px 0 0;overflow-x:auto}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px;margin-top:20px}
.card{display:block;text-decoration:none;color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:10px;overflow:hidden}
.card img{width:100%;aspect-ratio:4/5;object-fit:cover;object-position:top;display:block}.card div{padding:8px 10px;font-size:14px;font-weight:600}
.card small{display:block;font-weight:400;color:var(--muted)}`

function sharePage(s, base) {
  const url = `${base}s/${s.id}/`
  const img = `${url}chart.png`
  const desc = s.caption || s.subtitle || s.title
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(s.title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="NFL Charts">
<meta property="og:title" content="${esc(s.title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${img}">
<meta property="og:image:width" content="${s.width}">
<meta property="og:image:height" content="${s.height}">
<meta property="og:image:alt" content="${esc(s.title)}: ${esc(desc)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${img}">
<style>${STYLE}</style>
</head><body><main>
<h1>${esc(s.title)}</h1>
${s.subtitle ? `<p class="muted">${esc(s.subtitle)}</p>` : ''}
<a href="chart.png"><img class="chart" src="chart.png" width="${s.width}" height="${s.height}" alt="${esc(s.title)}: ${esc(desc)}"></a>
${s.caption ? `<p>${esc(s.caption)}</p>` : ''}
${s.footnote ? `<p class="muted">${esc(s.footnote)}</p>` : ''}
<p class="muted">Source: ${esc(s.source)}. Data from <a href="https://github.com/nflverse">nflverse</a> (CC BY 4.0).
Made with NFL Charts · ${esc(s.date)}</p>
${s.sql?.length ? `<details><summary>How this was calculated (SQL)</summary>${s.sql.map((q) => `<pre>${esc(q)}</pre>`).join('')}</details>` : ''}
</main></body></html>
`
}

function indexPage(list, base) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>NFL Charts: shared charts</title>
<meta property="og:title" content="NFL Charts: shared charts">
${list[0] ? `<meta property="og:image" content="${base}s/${list[0].id}/chart.png">` : ''}
<style>${STYLE}</style></head><body><main>
<h1>Shared charts</h1>
<p class="muted">Made with NFL Charts from <a href="https://github.com/nflverse">nflverse</a> data.</p>
<div class="grid">
${list.map((s) => `<a class="card" href="s/${s.id}/"><img src="s/${s.id}/chart.png" alt="" loading="lazy"><div>${esc(s.title)}<small>${esc(s.date)}</small></div></a>`).join('\n')}
</div></main></body></html>
`
}

async function status() {
  if (!existsSync(join(DIR, '.git'))) return { available: false, reason: `No shares repo at ${DIR}. Clone your shares repo there, or set NFL_SHARES_DIR.` }
  try {
    return { available: true, base: await pagesBase(), dir: DIR }
  } catch (e) {
    return { available: false, reason: e.message }
  }
}

export default function shareServer() {
  let queue = Promise.resolve()
  return {
    name: 'nfl-share-server',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__share/status', async (_req, res) => {
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify(await status()))
      })
      server.middlewares.use('/__share/publish', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; return res.end() }
        let body = ''
        req.on('data', (c) => { body += c })
        req.on('end', () => {
          const job = queue.then(async () => {
            const b = JSON.parse(body)
            const st = await status()
            if (!st.available) throw new Error(st.reason)
            const base = st.base
            const now = new Date()
            const id = `${now.toISOString().slice(0, 10)}-${slug(b.title)}-${randomBytes(2).toString('hex')}`
            const share = {
              id, title: b.title, subtitle: b.subtitle, caption: b.caption, footnote: b.footnote, source: b.source,
              sql: (b.sql || []).filter(Boolean).slice(0, 5), width: b.width, height: b.height, date: now.toISOString().slice(0, 10),
            }
            const folder = join(DIR, 's', id)
            mkdirSync(folder, { recursive: true })
            writeFileSync(join(folder, 'chart.png'), Buffer.from(b.png, 'base64'))
            writeFileSync(join(folder, 'index.html'), sharePage(share, base))
            const listPath = join(DIR, 'shares.json')
            const list = [share, ...JSON.parse(readFileSync(listPath, 'utf8') || '[]').filter((x) => x.id !== id)]
            writeFileSync(listPath, JSON.stringify(list, null, 1))
            writeFileSync(join(DIR, 'index.html'), indexPage(list, base))
            await run('git', ['add', '-A'], DIR)
            await run('git', ['commit', '-q', '-m', `Share: ${b.title}`], DIR)
            await run('git', ['push', '-q'], DIR)
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
