import { VIEW_NAMES } from '../db/viewNames.js'
import { CHART_SPEC_SCHEMA } from '../chart/spec.js'

// Tool order is fixed: tools render first in the prompt, so any change here
// invalidates the prompt cache.
export const TOOLS = [
  {
    name: 'execute_sql',
    description: 'Run one read-only DuckDB SELECT (WITH allowed) against the NFL views and get the rows back. '
      + 'Returns a result_id you pass to render_chart, the column names/types, and up to 40 rows (the chart can use up to 500). '
      + 'Errors come back as text; fix the SQL and retry.',
    strict: true,
    eager_input_streaming: true,
    input_schema: {
      type: 'object', additionalProperties: false, required: ['query'],
      properties: { query: { type: 'string', description: 'A single DuckDB SELECT statement.' } },
    },
  },
  {
    name: 'find_player',
    description: 'Resolve a player name (full, partial, or misspelled) to gsis_id player ids. Always use this before filtering by a player, '
      + 'then filter on the id column (player_id in stats views, *_player_id in pbp), never on names: names repeat (there are two Lamar Jacksons).',
    strict: true,
    input_schema: {
      type: 'object', additionalProperties: false, required: ['name', 'position'],
      properties: {
        name: { type: 'string' },
        position: { type: ['string', 'null'], description: 'Optional position filter such as QB, RB, WR, TE, K, or a defensive position.' },
      },
    },
  },
  {
    name: 'describe_columns',
    description: 'List columns (name and type) of a view whose names match a regex. Use when you need a column that is not documented in the prompt.',
    strict: true,
    input_schema: {
      type: 'object', additionalProperties: false, required: ['table', 'pattern'],
      properties: {
        table: { type: 'string', enum: VIEW_NAMES },
        pattern: { type: 'string', description: 'Case-insensitive regex, e.g. "penalty|flag". Use ".*" for all.' },
      },
    },
  },
  {
    name: 'render_chart',
    description: 'Render the answer as a share-ready poster from a stored execute_sql result. Call it once, after the data is final. '
      + 'Returns "ok" or a list of problems to fix.',
    strict: true,
    input_schema: {
      type: 'object', additionalProperties: false, required: ['spec'],
      properties: { spec: CHART_SPEC_SCHEMA },
    },
  },
]
