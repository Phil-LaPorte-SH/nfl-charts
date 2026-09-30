import { useMemo, useRef, useState } from 'react'
import Poster from '../chart/Poster.jsx'
import ChartEditor from './ChartEditor.jsx'
import { normalizeSpec } from '../chart/spec.js'
import { downloadPng, downloadSvg, copyPng } from '../chart/export.js'
import { EXPORT_MAX_SCALE } from '../chart/layout.js'
import { useChartAssets } from '../chart/useChartAssets.js'
import ResultTable from './ResultTable.jsx'

/**
 * A rendered poster with export actions and an inline editor. `spec` is the
 * model's (or fixture's) spec; edits are local and reported via onSpecChange.
 */
export default function ChartView({ spec: rawSpec, result, onSpecChange, compact = false }) {
  const { teams, logos, fontsReady, error } = useChartAssets()
  const [edited, setEdited] = useState(null)
  const [showEditor, setShowEditor] = useState(false)
  const [showData, setShowData] = useState(false)
  const [busy, setBusy] = useState('')
  const svgRef = useRef(null)
  const spec = useMemo(() => normalizeSpec(edited || rawSpec), [edited, rawSpec])

  const update = (next) => {
    setEdited(next)
    onSpecChange?.(next)
  }
  const act = async (label, fn) => {
    setBusy(label)
    try { await fn() } catch (e) { alert(`${label} failed: ${e.message || e}`) } finally { setBusy('') }
  }
  const maxScale = EXPORT_MAX_SCALE[spec.aspect] || 3

  if (error) return <div className="error-box">Could not load team data: {error}</div>
  return (
    <div className={`chart-view ${compact ? 'compact' : ''}`}>
      <div className={`poster-wrap aspect-${spec.aspect}`}>
        {teams && fontsReady
          ? <Poster ref={svgRef} spec={spec} result={result} teams={teams} logos={logos} fontsReady={fontsReady} />
          : <div className="poster-loading">Preparing chart…</div>}
      </div>
      <div className="chart-actions">
        <button className="btn btn-sm btn-primary" disabled={!!busy} onClick={() => act('PNG', () => downloadPng(svgRef.current, spec.title, 2))}>PNG 2×</button>
        <button className="btn btn-sm" disabled={!!busy} onClick={() => act('PNG', () => downloadPng(svgRef.current, spec.title, maxScale))}>PNG {maxScale}×</button>
        <button className="btn btn-sm" disabled={!!busy} onClick={() => act('Copy', () => copyPng(svgRef.current, 2))}>{busy === 'Copy' ? 'Copying…' : 'Copy image'}</button>
        <button className="btn btn-sm" disabled={!!busy} onClick={() => act('SVG', () => downloadSvg(svgRef.current, spec.title))}>SVG</button>
        <span className="spacer" />
        <button className={`btn btn-sm ${showEditor ? 'active' : ''}`} onClick={() => setShowEditor((v) => !v)}>Edit</button>
        {result && <button className={`btn btn-sm ${showData ? 'active' : ''}`} onClick={() => setShowData((v) => !v)}>Data</button>}
        {edited && <button className="btn btn-sm" onClick={() => update(null)} title="Discard edits">Reset</button>}
      </div>
      {showEditor && <ChartEditor spec={spec} result={result} teams={teams} onChange={update} />}
      {showData && result && <ResultTable result={result} />}
    </div>
  )
}
