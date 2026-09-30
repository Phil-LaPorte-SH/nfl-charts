// Saved chats in IndexedDB (this browser only; localhost and the hosted site
// keep separate lists). Two stores: full chats, and light metadata for the
// history list so listing never loads result rows or images.
const DB = 'nfl-charts'
const VERSION = 1

let dbPromise = null
function db() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, VERSION)
      req.onupgradeneeded = () => {
        const d = req.result
        if (!d.objectStoreNames.contains('chats')) d.createObjectStore('chats', { keyPath: 'id' })
        if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'id' }).createIndex('updatedAt', 'updatedAt')
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    }).catch((e) => { dbPromise = null; throw e })
  }
  return dbPromise
}

function tx(stores, mode, fn) {
  return db().then((d) => new Promise((resolve, reject) => {
    const t = d.transaction(stores, mode)
    const out = fn(t)
    t.oncomplete = () => resolve(out?.result ?? out)
    t.onerror = () => reject(t.error)
    t.onabort = () => reject(t.error || new Error('transaction aborted'))
  }))
}

export const newChatId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

function metaOf(chat) {
  return {
    id: chat.id,
    title: chat.title,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
    questions: chat.exchanges.length,
    charts: chat.exchanges.reduce((n, x) => n + x.charts.length, 0),
    engine: chat.engine,
    model: chat.model,
    thumb: chat.exchanges.flatMap((x) => x.charts).at(-1)?.spec?.type || null,
  }
}

export function saveChat(chat) {
  return tx(['chats', 'meta'], 'readwrite', (t) => {
    t.objectStore('chats').put(chat)
    t.objectStore('meta').put(metaOf(chat))
  })
}

export function getChat(id) {
  return tx(['chats'], 'readonly', (t) => t.objectStore('chats').get(id))
}

export async function listChats() {
  const all = await tx(['meta'], 'readonly', (t) => t.objectStore('meta').getAll())
  return (all || []).sort((a, b) => b.updatedAt - a.updatedAt)
}

export function deleteChat(id) {
  return tx(['chats', 'meta'], 'readwrite', (t) => {
    t.objectStore('chats').delete(id)
    t.objectStore('meta').delete(id)
  })
}

// Images keep their data URL; the raw base64 copy is derived again on load.
export const stripImages = (images) => (images || []).map(({ base64: _b, ...rest }) => rest)
export const restoreImages = (images) => (images || []).map((im) => ({ ...im, base64: im.dataUrl.slice(im.dataUrl.indexOf(',') + 1) }))
