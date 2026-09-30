import { fmtCell } from './fmtCell.js'

export default function ResultTable({ result, maxRows = 200 }) {
  if (!result) return null
  return (
    <div className="result-table">
      <table>
        <thead>
          <tr>{result.columns.map((c) => <th key={c.name} title={c.type}>{c.name}</th>)}</tr>
        </thead>
        <tbody>
          {result.rows.slice(0, maxRows).map((r, i) => (
            <tr key={i}>{r.map((v, j) => <td key={j}>{fmtCell(v)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
