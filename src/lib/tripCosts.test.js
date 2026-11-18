import { describe, it, expect } from 'vitest'
import { perPerson, quote, money, priceBasis, signupQuote, signupQuestions } from './tripCosts'

const trip = {
  planned_headcount: 10,
  cost_items: [
    { id: 'house', label: 'Rental house', kind: 'lodging', mode: 'split', amount: 3000 },
    { id: 'r1', label: 'PGA West', kind: 'golf', event_id: 'ev1', mode: 'per_person', amount: 185 },
    { id: 'r2', label: 'Desert Willow', kind: 'golf', event_id: 'ev2', mode: 'split', amount: 1000, split_count: 8 },
    { id: 'dinner', label: 'Friday dinner', kind: 'other', mode: 'per_person', amount: 0 },
  ],
}

describe('perPerson', () => {
  it('splits a shared total by the planned headcount', () => {
    expect(perPerson(trip.cost_items[0], 10)).toBe(300)
  })
  it("uses the item's own split count over the headcount", () => {
    expect(perPerson(trip.cost_items[2], 10)).toBe(125)
  })
  it('has no price for a split item with nobody to split between', () => {
    expect(perPerson({ mode: 'split', amount: 500 }, null)).toBeNull()
  })
  it('rounds to cents', () => {
    expect(perPerson({ mode: 'split', amount: 100 }, 3)).toBe(33.33)
  })
})

describe('quote', () => {
  it('charges a golfer for shared items plus only the rounds they picked', () => {
    const q = quote(trip, { golfing: true, roundIds: ['ev1'] })
    expect(q.lines.map(l => l.id)).toEqual(['house', 'r1', 'dinner'])
    expect(q.total).toBe(485)
  })
  it('charges a non-golfer no golf, even if rounds were ticked', () => {
    const q = quote(trip, { golfing: false, roundIds: ['ev1', 'ev2'] })
    expect(q.total).toBe(300)
    expect(q.lines.some(l => l.kind === 'golf')).toBe(false)
  })
  it('handles a trip with no costs', () => {
    expect(quote({}, {})).toEqual({ lines: [], total: 0 })
  })
})

describe('labels', () => {
  it('formats money and included items', () => {
    expect(money(300)).toBe('$300')
    expect(money(62.5)).toBe('$62.50')
    expect(money(0)).toBe('Included')
  })
  it('explains the split', () => {
    expect(priceBasis(trip.cost_items[0], 10)).toBe('$3,000 split 10 ways')
    expect(priceBasis(trip.cost_items[1], 10)).toBe('per person')
  })
})

describe('signupQuote', () => {
  const t = {
    ...trip,
    lodging: { type: 'rental' },
    custom_questions: [
      { label: 'Spa day?', type: 'yes_no', cost: 80 },
      { label: 'Arrival flight?', type: 'text' },
      { label: 'Shirt?', type: 'yes_no' },
    ],
  }
  it('charges no lodging share to someone not staying in the rental', () => {
    expect(quote(t, { golfing: false, staying: false }).total).toBe(0)
    expect(quote(t, { golfing: false, staying: true }).total).toBe(300)
  })
  it('prices a guest exactly like a person, and adds priced Yes answers once', () => {
    const q = signupQuote(t, {
      person: { golfing: true, roundIds: ['ev1'], staying: true },   // 300 + 185
      guest:  { golfing: false, roundIds: ['ev1'], staying: true },  // 300
      answers: { 0: 'yes', 1: 'AA 12', 2: 'yes' },                   // +80; text and unpriced add nothing
    })
    expect(q.people.map(p => p.total)).toEqual([485, 300])
    expect(q.extras).toEqual([{ label: 'Spa day?', price: 80 }])
    expect(q.total).toBe(865)
  })
  it('adds nothing for a No answer', () => {
    expect(signupQuote(t, { person: { golfing: false, staying: false }, answers: { 0: 'no' } }).total).toBe(0)
  })
  it('reads old questions as text questions', () => {
    expect(signupQuestions({ custom_questions: [{ label: 'Old', required: true }] })[0]).toMatchObject({ type: 'text', cost: null })
  })
})
