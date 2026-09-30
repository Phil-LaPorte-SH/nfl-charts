# NFL Charts

Ask a question about the NFL in plain English and get a share-ready infographic back.

**Live:** https://phil-laporte-sh.github.io/nfl-charts/

Everything runs in the browser. [DuckDB-WASM](https://duckdb.org/docs/api/wasm/overview) queries
[nflverse](https://github.com/nflverse) parquet files (every play since 1999) over HTTP range requests, and Claude writes
the SQL and designs the chart through tool calls made directly from the page with your own Anthropic API key.
There is no server.

## How it works

```
question ──► Claude (your key, from the browser)
               │  find_player      → player ids (names repeat: two Lamar Jacksons)
               │  execute_sql      → DuckDB-WASM ──range reads──► nfl-charts-data (GitHub Pages)
               │  describe_columns → schema lookup
               ▼  render_chart     → JSON chart spec
             SVG poster (team colors, logos) ──► PNG / SVG / clipboard
```

- **Data:** [`nfl-charts-data`](https://github.com/Phil-LaPorte-SH/nfl-charts-data) mirrors nflverse to GitHub Pages on a
  schedule, because nflverse's release downloads send no CORS headers. It also builds `pbp_lite`, a 168-column slice of
  play-by-play that most queries use. A typical all-seasons play-by-play question reads 1-8 MB, not the 540 MB of files.
- **Views:** `pbp_lite`, `pbp`, `player_week`, `player_season`, `team_week`, `team_season`, `games`, `teams`, `players`.
- **Model:** Claude Opus 5.5 by default (switchable to Opus 5, Sonnet 5, Haiku 4.5), with an 8-turn tool budget,
  prompt caching, and per-question cost shown under each answer.
- **Charts:** ranked bars with headline tiles, logo rulers, logo scatter plots with quadrants, lines, grouped and
  stacked columns, donuts, tables, and stat tiles; portrait, square, landscape or story sizes; team, light or dark
  themes. Every chart can be edited (title, type, highlight, theme, size) without another model call.

## Cost

You pay Anthropic for your own questions. With the default model a question typically costs $0.05-0.15
(3-5 tool turns, system prompt cached). Sonnet 5 is roughly half that. The header shows what this browser has spent.
Set a monthly limit on the key in the Anthropic console.

## Pages

| Route | What |
|---|---|
| `#/` | Chat |
| `#/dev/gallery` | Every chart type rendered from live data (no API key needed) |
| `#/dev/eval` | Prompt regression suite with answers computed from the data |
| `#/debug` | Known-stat checks and an ad-hoc SQL box |

## Develop

```bash
npm install
scripts/fetch-dev-data.sh 2023-2026   # builds ../nfl-charts-data/site (omit the range for all seasons, ~640 MB)
npm run dev                           # http://localhost:5173/nfl-charts/
```

The dev server serves `../nfl-charts-data/site` at `/data` (override with `NFL_DATA_DIR`). To use the live mirror
instead: `VITE_DATA_BASE_URL=/remote-data npm run dev`. In dev builds, `localStorage.setItem('nflviz.mock', '1')`
swaps in a scripted model so the UI can be exercised without a key.

`npm test` runs the chart-spec unit tests; `npm run lint` runs oxlint.

## Credits

Data from [nflverse](https://github.com/nflverse), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
nflverse is a community project and is not affiliated with the NFL. Team logos are loaded from ESPN via nflverse and
are trademarks of their teams. Natural-language approach inspired by
[allenwalker3/playcall](https://github.com/allenwalker3/playcall).
