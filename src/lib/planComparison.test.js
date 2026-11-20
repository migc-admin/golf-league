import { describe, it, expect } from 'vitest'
import { FEATURE_MIN_TIER, hasFeature } from './features'
import { PLANS } from './plans'
import { PLAN_DETAILS, COMPARE_SECTIONS, TIERS } from './planComparison'

const rows = COMPARE_SECTIONS.flatMap(s => s.rows)

describe('plan comparison', () => {
  it('has a row for every gated feature in features.js', () => {
    const covered = new Set(rows.map(r => r.feature).filter(Boolean))
    for (const key of Object.keys(FEATURE_MIN_TIER)) expect(covered.has(key), key).toBe(true)
  })

  it('marks gated rows exactly as the app enforces them', () => {
    for (const r of rows.filter(r => r.feature)) {
      expect(r.values).toEqual(TIERS.map(t => hasFeature(t, r.feature)))
    }
  })

  it('has one value per tier in every row', () => {
    for (const r of rows) expect(r.values, r.label).toHaveLength(TIERS.length)
  })

  it('builds a detailed card for each subscription plan', () => {
    expect(PLAN_DETAILS.map(d => d.plan.name)).toEqual(PLANS.map(p => p.name))
    for (const d of PLAN_DETAILS) expect(d.items.length).toBeGreaterThanOrEqual(4)
  })
})
