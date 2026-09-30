import { useEffect, useState } from 'react'
import { listChats, deleteChat } from '../state/chatStore.js'

const TYPE_ICON = { ranked_bar: '▤', logo_strip: '⋮', logo_scatter: '⁘', line: '⟋', grouped_bar: '▥', stacked_bar: '▦', donut: '◔', table: '☰', stat_tiles: '▢' }

function when(ts) {
  const d = new Date(ts)
  const days = Math.floor((Date.now() - ts) / 86400000)
  if (days < 1 && new Date().getDate() === d.getDate()) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (days < 7) return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default function HistoryPanel({ currentId, onClose, onDeleted, refreshKey }) {
  const [chats, setChats] = useState(null)
  const [filter, setFilter] = useState('')
  const [error, setError] = useState(null)

  useEffect(() => {
    listChats().then(setChats).catch((e) => setError(String(e.message || e)))
  }, [refreshKey])

  const shown = (chats || []).filter((c) => !filter || c.title.toLowerCase().includes(filter.toLowerCase()))
  return (
    <div className="history-backdrop" onClick={onClose}>
      <aside className="history" onClick={(e) => e.stopPropagation()} aria-label="Saved chats">
        <div className="history-head">
          <h2>Saved chats</h2>
          <button className="btn btn-sm" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <a className="btn btn-primary history-new" href="#/" onClick={onClose}>+ New chat</a>
        <input className="history-search" placeholder="Search questions…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        {error && <div className="error-box">Saved chats are unavailable in this browser: {error}</div>}
        {chats && !chats.length && <p className="muted">Nothing saved yet. Chats save automatically after each answer.</p>}
        <ul>
          {shown.map((c) => (
            <li key={c.id} className={c.id === currentId ? 'current' : ''}>
              <a href={`#/chat/${c.id}`} onClick={onClose}>
                <span className="h-icon" aria-hidden="true">{TYPE_ICON[c.thumb] || '·'}</span>
                <span className="h-title">{c.title}</span>
                <span className="h-meta">{when(c.updatedAt)} · {c.questions} question{c.questions === 1 ? '' : 's'}{c.charts ? ` · ${c.charts} chart${c.charts === 1 ? '' : 's'}` : ''}</span>
              </a>
              <button className="h-del" title="Delete chat" aria-label={`Delete ${c.title}`} onClick={async () => {
                if (!confirm(`Delete "${c.title}"?`)) return
                await deleteChat(c.id)
                setChats((xs) => xs.filter((x) => x.id !== c.id))
                onDeleted?.(c.id)
              }}>🗑</button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  )
}
