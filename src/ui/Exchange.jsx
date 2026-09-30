import { useState } from 'react'
import ToolCard from './ToolCard.jsx'
import ChartView from './ChartView.jsx'
import { sumUsage, fmtUsd } from '../llm/cost.js'

export default function Exchange({ x, results, onSpecEdit, onRetry }) {
  const [showThinking, setShowThinking] = useState(false)
  const u = sumUsage(x.usage)
  // Text after a successful chart just restates the caption; hide it.
  const chartAt = x.parts.findIndex((p) => p.kind === 'tool' && p.name === 'render_chart' && p.status === 'done' && !p.output?.is_error)
  const cacheMiss = x.usage.length > 1 && x.usage.slice(1).every((v) => !v?.cache_read_input_tokens)
  return (
    <section className="exchange">
      <div className="q">
        {x.images?.length > 0 && (
          <div className="q-images">
            {x.images.map((im) => <a key={im.id} href={im.dataUrl} target="_blank" rel="noreferrer"><img src={im.dataUrl} alt={im.name} /></a>)}
          </div>
        )}
        {x.question}
      </div>
      <div className="a">
        {x.parts.map((p, i) => {
          if (p.kind === 'text') return p.text.trim() && (chartAt < 0 || i < chartAt) ? <p key={i} className="a-text">{p.text}</p> : null
          if (p.kind === 'thinking') {
            if (!p.text.trim()) return null
            return (
              <div key={i} className="thinking">
                <button className="linklike" onClick={() => setShowThinking((v) => !v)}>{showThinking ? '▾' : '▸'} Reasoning</button>
                {showThinking && <p>{p.text}</p>}
              </div>
            )
          }
          if (p.kind === 'tool' && p.name !== 'render_chart') return <ToolCard key={i} part={p} results={results} />
          if (p.kind === 'tool' && p.name === 'render_chart' && p.output?.is_error) return <ToolCard key={i} part={p} results={results} />
          return null
        })}
        {x.status === 'running' && <div className="working"><span className="spinner" /> Working…</div>}
        {x.charts.map((c, ci) => (
          <div key={ci} className="chart-block">
            {c.spec.caption && <p className="caption">{c.spec.caption}</p>}
            <ChartView spec={c.spec} result={c.spec.result_id ? results[c.spec.result_id] : null} onSpecChange={(spec) => onSpecEdit(ci, spec)} />
          </div>
        ))}
        {x.note && (
          <div className={x.status === 'error' ? 'error-box' : 'note'}>
            {x.note} {x.status !== 'running' && <button className="btn btn-sm" onClick={onRetry}>Retry</button>}
          </div>
        )}
        {x.usage.length > 0 && (
          <div className="cost-line" title={`input ${u.input_tokens} · cache write ${u.cache_creation_input_tokens} · cache read ${u.cache_read_input_tokens} · output ${u.output_tokens}`}>
            {x.model} · {x.turns} turn{x.turns === 1 ? '' : 's'} · {(u.input_tokens + u.cache_creation_input_tokens + u.cache_read_input_tokens).toLocaleString()} in / {u.output_tokens.toLocaleString()} out
            {u.cache_read_input_tokens > 0 && ` · ${Math.round((u.cache_read_input_tokens / (u.input_tokens + u.cache_creation_input_tokens + u.cache_read_input_tokens)) * 100)}% cached`}
            {cacheMiss && x.billing !== 'plan' && <span className="warn-text"> · cache miss</span>} · <b>{x.billing === 'plan' ? 'Claude plan, no API charge' : fmtUsd(x.cost)}</b>
          </div>
        )}
      </div>
    </section>
  )
}
