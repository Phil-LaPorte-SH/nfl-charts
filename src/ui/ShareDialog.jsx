import { useEffect, useState } from 'react'
import { waitUntilLive } from '../chart/share.js'

function CopyRow({ label, value, hint }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="share-row">
      <div className="share-label">{label}{hint && <span className="faint"> · {hint}</span>}</div>
      <div className="share-field">
        <input readOnly value={value} onFocus={(e) => e.target.select()} />
        <button className="btn btn-sm" onClick={async () => { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500) }}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  )
}

export default function ShareDialog({ state, title, onClose }) {
  const [live, setLive] = useState(null) // null checking, true, false
  const out = state.result
  useEffect(() => {
    if (!out) return
    const ctrl = new AbortController()
    waitUntilLive(out.imageUrl, { signal: ctrl.signal }).then((ok) => setLive(ok))
    return () => ctrl.abort()
  }, [out])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal share-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="share-title">
        <h2 id="share-title">Share link</h2>
        {state.busy && <p className="working"><span className="spinner" /> Rendering and publishing to GitHub…</p>}
        {state.error && <div className="error-box">{state.error}</div>}
        {out && (
          <>
            <p className={live ? 'ok-text' : 'muted'}>
              {live === null && <><span className="spinner inline" /> Published. GitHub Pages needs about a minute before these links work; until then they show a 404. You can copy them now, but wait for the green “Live” before opening or posting.</>}
              {live === true && '● Live. The links work now.'}
              {live === false && 'Still not live after 4 minutes. The links should work shortly; check the repo’s Pages build if not.'}
            </p>
            <CopyRow label="Page link" hint="best for Reddit: link posts show the chart as a preview" value={out.pageUrl} />
            <CopyRow label="Direct image" hint="for image link posts and forums" value={out.imageUrl} />
            <CopyRow label="Markdown" hint="for a Reddit comment" value={`[${title}](${out.pageUrl})`} />
            <p className="faint small">In Reddit comments, links don't show the image inline. To show the image in a comment, use <b>Copy image</b> and paste it into the comment box, if the subreddit allows images.</p>
            <p className="small">
              {live ? <a href={out.pageUrl} target="_blank" rel="noreferrer">Open page</a> : <span className="faint">Open page (when live)</span>}
              {' · '}<a href={out.galleryUrl} target="_blank" rel="noreferrer">All shared charts</a>
            </p>
          </>
        )}
        <div className="modal-actions"><span className="spacer" /><button className="btn" onClick={onClose}>Close</button></div>
      </div>
    </div>
  )
}
