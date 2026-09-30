// Static share site: files, templates, and Cloudflare Pages deploys.
// Layout of the local shares folder (default ../gridiron-charts, never pushed anywhere):
//   public/            what gets deployed: index.html, _headers, s/<id>/{index.html,chart.png}
//   shares.json        list of shares (source of truth for rebuilding pages)
//   share-config.json  { project, baseUrl }
import { execFile } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

export const DIR = resolve(process.env.NFL_SHARES_DIR || '../gridiron-charts')
export const PUBLIC = join(DIR, 'public')
export const PROJECT = process.env.NFL_SHARES_PROJECT || 'gridiron-charts'
const AUTHOR = ['-c', 'user.name=NFL Charts', '-c', 'user.email=charts@gridiron-charts.invalid']

export const run = (cmd, args, cwd, timeout = 180000) => new Promise((res, rej) => {
  execFile(cmd, args, { cwd, timeout, maxBuffer: 16 << 20, env: { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' } }, (err, stdout, stderr) =>
    (err ? rej(new Error(`${cmd} ${args[0]} ${args[1] || ''}: ${(stderr || err.message).trim().split('\n').slice(-6).join(' ')}`)) : res(stdout.trim())))
})
export const wrangler = (args, cwd = DIR) => run('npx', ['--yes', 'wrangler@4', ...args], cwd)

export function readConfig() {
  try { return JSON.parse(readFileSync(join(DIR, 'share-config.json'), 'utf8')) } catch { return null }
}
export function writeConfig(c) { writeFileSync(join(DIR, 'share-config.json'), JSON.stringify(c, null, 1)) }
export function readList() {
  try { return JSON.parse(readFileSync(join(DIR, 'shares.json'), 'utf8')) } catch { return [] }
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

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


/** Rewrite every page from shares.json (the base URL is baked into preview tags). */
export function rebuildSite(list, base) {
  mkdirSync(PUBLIC, { recursive: true })
  for (const s of list) {
    const folder = join(PUBLIC, 's', s.id)
    mkdirSync(folder, { recursive: true })
    writeFileSync(join(folder, 'index.html'), sharePage(s, base))
  }
  writeFileSync(join(PUBLIC, 'index.html'), indexPage(list, base))
  // Without a 404.html, Cloudflare Pages serves index.html for unknown paths
  // (single-page-app mode), so removed shares would still return 200.
  writeFileSync(join(PUBLIC, '404.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Not found</title><style>${STYLE}</style></head><body><main><h1>Chart not found</h1><p class="muted">It may have been removed. <a href="${base}">See all shared charts</a>.</p></main></body></html>`)
  // CORS so the app can check a share is live; short cache on pages so edits show up.
  writeFileSync(join(PUBLIC, '_headers'), `/*\n  Access-Control-Allow-Origin: *\n/*.html\n  Cache-Control: public, max-age=300\n/\n  Cache-Control: public, max-age=300\n`)
  writeFileSync(join(DIR, 'shares.json'), JSON.stringify(list, null, 1))
}

export async function commitLocal(message) {
  if (!existsSync(join(DIR, '.git'))) await run('git', ['init', '-q', '-b', 'main'], DIR)
  await run('git', ['add', '-A'], DIR)
  await run('git', [...AUTHOR, 'commit', '-q', '--allow-empty', '-m', message], DIR)
}

export async function deploy() {
  const out = await wrangler(['pages', 'deploy', PUBLIC, '--project-name', PROJECT, '--branch', 'main', '--commit-dirty=true', '--commit-message', 'share'])
  return out
}
