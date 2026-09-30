import { MODELS, EFFORTS } from '../llm/models.js'
import { CURRENT_TEAMS } from '../db/teams.js'
import { fmtUsd } from '../llm/cost.js'

export default function Header({ settings, update, manifest, dataError, spend, hasKey, onKey, onNew, bridge, engine }) {
  const s = manifest?.seasons
  return (
    <header className="app-header">
      <div className="brand">
        <span className="brand-mark">🏈</span>
        <span className="brand-name">NFL Charts</span>
      </div>
      <span className="pill" title={manifest ? `Data refreshed ${manifest.generated_at}` : dataError || ''}>
        <span className={`dot ${manifest ? 'ok' : dataError ? 'err' : 'warn'}`} />
        {manifest ? `${s.min}–${s.max} · thru ${s.current} Wk ${s.last_completed_week}` : dataError ? 'Data unavailable' : 'Loading data…'}
      </span>
      <span className="spacer" />
      {bridge?.available && (
        <label className="hdr-field" title={engine === 'plan' ? `Using the local Claude Code CLI signed in as ${bridge.email}` : 'Using your Anthropic API key'}>
          <select value={engine} onChange={(e) => update({ engine: e.target.value === 'plan' ? 'auto' : 'api' })}>
            <option value="plan">Claude {bridge.plan ? bridge.plan[0].toUpperCase() + bridge.plan.slice(1) : ''} plan (local)</option>
            <option value="api">API key</option>
          </select>
        </label>
      )}
      <label className="hdr-field" title="Model">
        <select value={settings.model} onChange={(e) => update({ model: e.target.value })}>
          {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      </label>
      {settings.modelCfg.effort && (
        <label className="hdr-field" title="Effort: how hard the model thinks. Higher is slower and costs more.">
          <select value={settings.effort} onChange={(e) => update({ effort: e.target.value })}>
            {EFFORTS.map((x) => <option key={x} value={x}>{x} effort</option>)}
          </select>
        </label>
      )}
      <label className="hdr-field" title="Your team (used for highlights)">
        <select value={settings.favoriteTeam} onChange={(e) => update({ favoriteTeam: e.target.value })}>
          <option value="">My team…</option>
          {CURRENT_TEAMS.map((t) => <option key={t}>{t}</option>)}
        </select>
      </label>
      <label className="hdr-field" title="App theme">
        <select value={settings.theme} onChange={(e) => update({ theme: e.target.value })}>
          <option value="system">Auto</option><option value="light">Light</option><option value="dark">Dark</option>
        </select>
      </label>
      {engine !== 'plan' && <span className="pill" title={`${spend.n} requests from this browser`}>API spend {fmtUsd(spend.total)}</span>}
      {engine !== 'plan' && <button className={`btn btn-sm ${hasKey ? '' : 'btn-primary'}`} onClick={onKey}>{hasKey ? 'API key ✓' : 'Add API key'}</button>}
      <button className="btn btn-sm" onClick={onNew} title="Start a new conversation">New</button>
      <a className="btn btn-sm" href="#/dev/gallery" title="Chart gallery">Gallery</a>
    </header>
  )
}
