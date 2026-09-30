import { useState } from 'react'
import { getApiKey, setApiKey } from '../llm/client.js'

export default function ApiKeyModal({ reason, onClose }) {
  const [key, setKey] = useState(getApiKey())
  const save = () => { setApiKey(key); onClose(true) }
  return (
    <div className="modal-backdrop" onClick={() => onClose(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="key-title">
        <h2 id="key-title">Anthropic API key</h2>
        {reason && <p className="error-box">{reason}</p>}
        <p className="muted">
          Questions are answered by Claude, called directly from this browser with your key. The key is stored only in this
          browser's local storage and is sent only to api.anthropic.com. Create one at{' '}
          <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">console.anthropic.com</a>.
          Consider a key with a monthly spend limit.
        </p>
        <input type="password" autoFocus placeholder="sk-ant-…" value={key} onChange={(e) => setKey(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
        <div className="modal-actions">
          {getApiKey() && <button className="btn" onClick={() => { setApiKey(''); setKey(''); onClose(true) }}>Remove key</button>}
          <span className="spacer" />
          <button className="btn" onClick={() => onClose(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={!key.trim()}>Save</button>
        </div>
      </div>
    </div>
  )
}
