import { describe, it, expect } from 'vitest'
import { normalizeSpec, validateSpec, compatibleTypes, CHART_SPEC_SCHEMA } from './spec.js'
import { fmt, ordinal } from './format.js'

const results = {
  q1: {
    columns: [{ name: 'team' }, { name: 'n' }, { name: 'per17' }, { name: 'label' }],
    rows: Array.from({ length: 32 }, (_, i) => [`T${i}`, 100 - i, 12 - i / 5, `${100 - i} in 150`]),
  },
  q2: { columns: [{ name: 'slice' }, { name: 'v' }], rows: Array.from({ length: 8 }, (_, i) => [`s${i}`, i]) },
}
const base = { type: 'ranked_bar', title: 't', result_id: 'q1', encoding: { team: 'team', value: 'per17', secondary: 'label', sort: 'desc' } }

describe('spec', () => {
  it('schema lists every property as required (strict tool use)', () => {
    expect(new Set(CHART_SPEC_SCHEMA.required)).toEqual(new Set(Object.keys(CHART_SPEC_SCHEMA.properties)))
  })
  it('normalizeSpec is idempotent', () => {
    const a = normalizeSpec(base)
    expect(normalizeSpec(a)).toEqual(a)
  })
  it('accepts a valid ranked_bar', () => {
    expect(validateSpec(base, results)).toEqual([])
  })
  it('rejects unknown result ids and columns', () => {
    expect(validateSpec({ ...base, result_id: 'nope' }, results)[0]).toMatch(/Unknown result_id/)
    expect(validateSpec({ ...base, encoding: { ...base.encoding, value: 'zzz' } }, results)[0]).toMatch(/not a column/)
  })
  it('rejects a donut with more than 6 slices', () => {
    const errs = validateSpec({ type: 'donut', result_id: 'q2', encoding: { label: 'slice', value: 'v' } }, results)
    expect(errs.join()).toMatch(/at most 6 slices/)
  })
  it('requires encodings per type', () => {
    expect(validateSpec({ type: 'logo_scatter', result_id: 'q1', encoding: { team: 'team', x: 'n' } }, results).join()).toMatch(/encoding.y/)
  })
  it('stat_tiles needs kpis but no result', () => {
    expect(validateSpec({ type: 'stat_tiles' }, results).join()).toMatch(/kpis/)
    expect(validateSpec({ type: 'stat_tiles', kpis: [{ label: 'a', value: '1' }] }, results)).toEqual([])
  })
  it('compatibleTypes offers logo charts only with a team column', () => {
    expect(compatibleTypes(base, results.q1)).toContain('logo_strip')
    expect(compatibleTypes({ ...base, encoding: { label: 'label', value: 'n' } }, results.q1)).not.toContain('logo_strip')
  })
})

describe('format', () => {
  it('formats', () => {
    expect(ordinal(29)).toBe('29th'); expect(ordinal(21)).toBe('21st'); expect(ordinal(12)).toBe('12th')
    expect(fmt(0.4512, 'pct1')).toBe('45.1%'); expect(fmt(45.12, 'pct1')).toBe('45.1%')
    expect(fmt(-0.1, 'signed2')).toBe('-0.10'); expect(fmt(5250, 'int')).toBe('5,250')
  })
})

describe('format edge cases', () => {
  it('does not comma years and unsigns zero', () => {
    expect(fmt(2018, 'raw')).toBe('2018')
    expect(fmt(0, 'signed2')).toBe('0.00')
  })
})
