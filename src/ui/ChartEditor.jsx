import { CHART_TYPES, ASPECTS, compatibleTypes, adaptSpecToType } from '../chart/spec.js'
import { FORMATS } from '../chart/format.js'
import { CURRENT_TEAMS } from '../db/teams.js'

const TYPE_LABELS = {
  ranked_bar: 'Ranked bars', logo_strip: 'Logo ruler', logo_scatter: 'Logo scatter', line: 'Line',
  grouped_bar: 'Grouped columns', stacked_bar: 'Stacked columns', donut: 'Donut', table: 'Table', stat_tiles: 'Stat tiles',
}

/** Local, no-LLM edits to a chart spec. */
export default function ChartEditor({ spec, result, onChange }) {
  const allowed = compatibleTypes(spec, result)
  const set = (patch) => onChange({ ...spec, ...patch })
  const setIn = (key, patch) => onChange({ ...spec, [key]: { ...spec[key], ...patch } })
  const teamValues = result && spec.encoding.team
    ? [...new Set(result.rows.map((r) => r[result.columns.findIndex((c) => c.name === spec.encoding.team)]))].filter(Boolean).sort()
    : CURRENT_TEAMS

  return (
    <div className="chart-editor">
      <label className="wide">Title
        <input value={spec.title} onChange={(e) => set({ title: e.target.value })} />
      </label>
      <label>Accent word
        <input value={spec.title_accent || ''} onChange={(e) => set({ title_accent: e.target.value || null })} placeholder="e.g. Flags" />
      </label>
      <label className="wide">Subtitle
        <textarea rows={2} value={spec.subtitle || ''} onChange={(e) => set({ subtitle: e.target.value || null })} />
      </label>
      <label>Chart type
        <select value={spec.type} onChange={(e) => onChange(adaptSpecToType(spec, e.target.value, result))}>
          {CHART_TYPES.map((t) => <option key={t} value={t} disabled={!allowed.includes(t) && t !== spec.type}>{TYPE_LABELS[t]}</option>)}
        </select>
      </label>
      <label>Size
        <select value={spec.aspect} onChange={(e) => set({ aspect: e.target.value })}>
          {ASPECTS.map((a) => <option key={a} value={a}>{{ portrait: 'Portrait 4:5', square: 'Square 1:1', landscape: 'Landscape 16:9', story: 'Story 9:16' }[a]}</option>)}
        </select>
      </label>
      <label>Theme
        <select value={spec.theme.mode} onChange={(e) => setIn('theme', { mode: e.target.value, team: e.target.value === 'team' ? spec.theme.team || spec.highlight.teams[0] || 'KC' : spec.theme.team })}>
          <option value="light">Light</option><option value="dark">Dark</option><option value="team">Team colors</option>
        </select>
      </label>
      {spec.theme.mode === 'team' && (
        <label>Team colors
          <select value={spec.theme.team || ''} onChange={(e) => setIn('theme', { team: e.target.value })}>
            {CURRENT_TEAMS.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
      )}
      <label>Highlight
        <select value={spec.highlight.teams[0] || spec.highlight.labels[0] || ''} onChange={(e) => {
          const v = e.target.value
          const isTeam = CURRENT_TEAMS.includes(v)
          onChange({ ...spec, highlight: { teams: v && isTeam ? [v] : [], labels: v && !isTeam ? [v] : [] } })
        }}>
          <option value="">None</option>
          {teamValues.map((t) => <option key={String(t)} value={t}>{String(t)}</option>)}
        </select>
      </label>
      <label>Value format
        <select value={spec.format.value || ''} onChange={(e) => setIn('format', { value: e.target.value || null })}>
          <option value="">Auto</option>
          {FORMATS.map((f) => <option key={f}>{f}</option>)}
        </select>
      </label>
      <label>Sort
        <select value={spec.encoding.sort} onChange={(e) => setIn('encoding', { sort: e.target.value })}>
          <option value="desc">High → low</option><option value="asc">Low → high</option><option value="none">As queried</option>
        </select>
      </label>
      <label className="wide">Footnote
        <textarea rows={2} value={spec.footnote || ''} onChange={(e) => set({ footnote: e.target.value || null })} />
      </label>
      <label className="wide">Source
        <input value={spec.source} onChange={(e) => set({ source: e.target.value })} />
      </label>
      {spec.kpis.length > 0 && (
        <fieldset className="wide kpi-edit">
          <legend>Headline tiles</legend>
          {spec.kpis.map((k, i) => (
            <div key={i} className="kpi-row">
              <input value={k.label} onChange={(e) => set({ kpis: spec.kpis.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
              <input value={k.value} onChange={(e) => set({ kpis: spec.kpis.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} />
              <input value={k.sublabel || ''} placeholder="sub-label" onChange={(e) => set({ kpis: spec.kpis.map((x, j) => (j === i ? { ...x, sublabel: e.target.value || null } : x)) })} />
              <button className="btn btn-sm" onClick={() => set({ kpis: spec.kpis.filter((_, j) => j !== i) })}>✕</button>
            </div>
          ))}
        </fieldset>
      )}
    </div>
  )
}
