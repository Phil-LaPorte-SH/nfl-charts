import { useEffect, useState } from 'react'
import { runQuery } from '../db/query.js'
import { FIXTURES } from '../chart/fixtures/index.js'
import ChartView from './ChartView.jsx'

function Fixture({ f }) {
  const [state, setState] = useState({})
  useEffect(() => {
    let live = true
    runQuery(f.sql)
      .then((res) => live && setState({ res, spec: f.build(res) }))
      .catch((e) => live && setState({ error: String(e.message || e) }))
    return () => { live = false }
  }, [f])
  return (
    <div className="gallery-item" data-fixture={f.id} data-state={state.spec ? 'ready' : state.error ? 'error' : 'loading'}>
      <h3>{f.name}</h3>
      {state.error && <div className="error-box">{state.error}</div>}
      {state.spec && <ChartView spec={state.spec} result={state.res} compact />}
      {!state.spec && !state.error && <div className="poster-loading">Querying…</div>}
      <details><summary className="muted">SQL</summary><pre className="sql">{f.sql}</pre></details>
    </div>
  )
}

export default function GalleryPage() {
  return (
    <div className="gallery">
      <h1>Chart gallery</h1>
      <p className="muted">Every chart type rendered from live nflverse data. <a href="#/">Back to chat</a></p>
      <div className="gallery-grid">
        {FIXTURES.map((f) => <Fixture key={f.id} f={f} />)}
      </div>
    </div>
  )
}
