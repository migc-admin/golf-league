import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { EventDetailsCard, ParticipantsCard, formatMoney } from './OverviewCards'

const html = el => renderToStaticMarkup(el)

describe('formatMoney', () => {
  it('always shows dollars and cents; non-numbers become a dash', () => {
    expect(formatMoney(42)).toBe('$42.00')
    expect(formatMoney('165')).toBe('$165.00')
    expect(formatMoney(0)).toBe('$0.00')
    expect(formatMoney(null)).toBe('$0.00') // Number(null) === 0
    expect(formatMoney(undefined)).toBe('—')
    expect(formatMoney('abc')).toBe('—')
  })
})

describe('EventDetailsCard', () => {
  const fields = [
    { label: 'Format', value: 'Net stroke play' },
    { label: 'Holes', value: '18 (full)' },
    { label: 'Entry fee', value: '$165.00', helper: 'Paid by each player' },
    { label: 'Tee interval', value: null },
  ]

  it('renders label above value in a 3-column grid that drops to 2 below 700px', () => {
    const out = html(h(EventDetailsCard, { fields }))
    expect(out).toContain('grid-cols-2')
    expect(out).toContain('min-[700px]:grid-cols-3')
    expect(out.indexOf('Format')).toBeLessThan(out.indexOf('Net stroke play'))
  })

  it('shows helper text and a dash for missing values', () => {
    const out = html(h(EventDetailsCard, { fields }))
    expect(out).toContain('Paid by each player')
    expect(out).toMatch(/Tee interval<\/dt><dd[^>]*>—<\/dd>/)
  })

  it('has the Edit button only when an edit handler is given, and no Delete', () => {
    expect(html(h(EventDetailsCard, { fields, onEdit: () => {} }))).toContain('>Edit<')
    const none = html(h(EventDetailsCard, { fields }))
    expect(none).not.toContain('>Edit<')
    expect(none).not.toContain('Delete')
  })

  it('keeps the existing anchor id', () => {
    expect(html(h(EventDetailsCard, { fields }))).toContain('id="event-details"')
  })
})

describe('ParticipantsCard', () => {
  const stats = [
    { label: 'Players', value: 1 },
    { label: 'Total pot', value: '$42.00', helper: '1 × $42.00 contribution' },
    { label: 'Flight A', value: 0 },
    { label: 'Flight B', value: 0 },
  ]

  it('renders 2×2 tiles with helper text and the View players button', () => {
    const out = html(h(ParticipantsCard, { stats, onViewPlayers: () => {} }))
    expect(out).toContain('grid-cols-2')
    expect(out).toContain('1 × $42.00 contribution')
    expect(out).toContain('>View players<')
    expect(out).toContain('id="players-summary"')
  })

  it('shows a zero value, not a dash', () => {
    const out = html(h(ParticipantsCard, { stats }))
    expect(out).toMatch(/Flight A<\/p><p[^>]*>0<\/p>/)
  })

  it('uses only existing color tokens and no emoji', () => {
    for (const out of [html(h(ParticipantsCard, { stats })), html(h(EventDetailsCard, { fields: [{ label: 'a', value: 'b' }] }))]) {
      expect(out).not.toMatch(/#[0-9a-fA-F]{3,6}/)
      expect(out).not.toMatch(/\b(?:bg|text|border)-(?:gray|slate|zinc|amber|yellow|green|red|blue)-/)
      expect(out).not.toMatch(/\p{Extended_Pictographic}/u)
    }
  })
})
