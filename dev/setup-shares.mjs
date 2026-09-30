#!/usr/bin/env node
// One-time setup for Cloudflare Pages shares (run from the nfl-charts folder):
//   npx wrangler login          # once, in your browser
//   node dev/setup-shares.mjs   # creates the project, migrates old shares, deploys
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { DIR, PUBLIC, PROJECT, wrangler, readConfig, writeConfig, readList, rebuildSite, commitLocal, deploy } from './shareSite.js'

const OLD = resolve(process.env.NFL_OLD_SHARES_DIR || '../nfl-charts-shares')

mkdirSync(PUBLIC, { recursive: true })
if (!existsSync(join(PUBLIC, 'index.html'))) writeFileSync(join(PUBLIC, 'index.html'), '<!doctype html><title>Shared charts</title>')
console.log(`share folder: ${DIR}`)

// 1. Cloudflare Pages project
const listText = await wrangler(['pages', 'project', 'list'])
if (!new RegExp(`\\b${PROJECT}\\b`).test(listText)) {
  console.log(`creating Cloudflare Pages project "${PROJECT}"…`)
  // wrangler looks for static files in its working directory when creating a project
  await wrangler(['pages', 'project', 'create', PROJECT, '--production-branch', 'main', '--force'], PUBLIC) // --force: classic Pages (pages.dev name), not the Workers delegation
}
const after = await wrangler(['pages', 'project', 'list'])
const line = after.split('\n').find((l) => new RegExp(`\\b${PROJECT}\\b`).test(l)) || ''
const domain = (line.match(/[a-z0-9-]+\.pages\.dev/) || [])[0]
if (!domain) throw new Error(`Could not find the pages.dev domain for ${PROJECT} in:\n${after}`)
const baseUrl = `https://${domain}/`
writeConfig({ ...(readConfig() || {}), project: PROJECT, baseUrl })
console.log(`site: ${baseUrl}`)

// 2. Migrate shares made on the old GitHub Pages repo
let list = readList()
if (existsSync(join(OLD, 'shares.json'))) {
  const old = JSON.parse(readFileSync(join(OLD, 'shares.json'), 'utf8'))
  for (const s of old) {
    if (list.some((x) => x.id === s.id)) continue
    const src = join(OLD, 's', s.id, 'chart.png')
    if (!existsSync(src)) continue
    mkdirSync(join(PUBLIC, 's', s.id), { recursive: true })
    copyFileSync(src, join(PUBLIC, 's', s.id, 'chart.png'))
    list.push(s)
    console.log(`migrated ${s.id}`)
  }
  list.sort((a, b) => (a.date < b.date ? 1 : -1))
}

// 3. Build and deploy
rebuildSite(list, baseUrl)
await commitLocal('Set up share site')
console.log('deploying…')
console.log((await deploy()).split('\n').slice(-3).join('\n'))
for (const s of list) console.log(`${baseUrl}s/${s.id}/`)
