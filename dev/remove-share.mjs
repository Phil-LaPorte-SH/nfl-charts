#!/usr/bin/env node
// Remove a published share and redeploy:  node dev/remove-share.mjs <share-id> [more ids]
// Ids are the folder names in the share URL, e.g. 2026-09-30-drive-saving-flags-5143.
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { PUBLIC, readConfig, readList, rebuildSite, commitLocal, deploy } from './shareSite.js'

const ids = process.argv.slice(2)
if (!ids.length) { console.error('usage: node dev/remove-share.mjs <share-id> …'); process.exit(1) }
const list = readList()
const keep = list.filter((s) => !ids.includes(s.id))
const missing = ids.filter((id) => !list.some((s) => s.id === id))
if (missing.length) console.warn(`not found: ${missing.join(', ')}`)
for (const id of ids) rmSync(join(PUBLIC, 's', id), { recursive: true, force: true })
rebuildSite(keep, readConfig().baseUrl)
await commitLocal(`Remove: ${ids.join(', ')}`)
await deploy()
console.log(`removed ${list.length - keep.length}; ${keep.length} shares remain`)
