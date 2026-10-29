import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import PotAndHolesCard from './PotAndHolesCard'
import AllocationBar from './AllocationBar'

const html = el => renderToStaticMarkup(el)
const noop = () => {}
const pot = props => html(h(PotAndHolesCard, {
  basis: 'per_player', onBasis: noop, fixedTotal: '', onFixedTotal: noop, attendancePot: 798, potContribution: 42, playerCount: 19,
  hasLongDrive: true, longDriveHole: 12, onLongDriveHole: noop,
  hasCtp: true, ctpHoles: [3, 8, 13, 16], onRemoveHole: noop, ctpInput: '', onCtpInput: noop, onAddHole: noop, canAddPar3s: true, onAddAllPar3s: noop,
  ...props,
}))

describe('PotAndHolesCard', () => {
  const out = pot()
  it('has the title and three side-by-side areas that stack on phones', () => {
    expect(out).toContain('Pot &amp; contest holes')
    expect(out).toContain('md:grid-cols-3')
    for (const a of ['Prize pool', 'Long drive hole', 'Closest to pin holes']) expect(out).toContain(a)
  })
  it('prize pool radios: by attendance with the math, and Fixed total', () => {
    expect(out).toContain('By attendance')
    expect(out).toContain('$798.00')
    expect(out).toContain('19 × $42.00')
    expect(out).toContain('Fixed total')
    expect(out).toMatch(/type="radio"[^>]*checked=""/)
    expect(out).not.toContain('Total pot $')
  })
  it('the fixed total input only appears in fixed mode', () => {
    const fixed = pot({ basis: 'fixed', fixedTotal: '500' })
    expect(fixed).toContain('Total pot $')
    expect(fixed).toContain('value="500"')
  })
  it('long drive hole has a labelled box and the "Highlighted on scorecards" helper', () => {
    expect(out).toContain('aria-label="Long drive hole number"')
    expect(out).toContain('value="12"')
    expect(out).toContain('Highlighted on scorecards.')
  })
  it('CTP holes are removable chips with named remove buttons, plus a hole box, Add and Add all par 3s', () => {
    for (const h of [3, 8, 13, 16]) expect(out).toContain(`aria-label="Remove hole ${h}"`)
    expect(out).toContain('aria-label="Closest to pin hole number"')
    expect(out).toContain('>Add<')
    expect(out).toContain('>Add all par 3s<')
  })
  it('hides the areas the event does not use', () => {
    const noCtp = pot({ hasCtp: false })
    expect(noCtp).not.toContain('Closest to pin holes')
    expect(noCtp).toContain('md:grid-cols-2')
    expect(pot({ hasCtp: false, hasLongDrive: false })).not.toContain('md:grid-cols')
  })
  it('only offers Add all par 3s when the course has par data', () => {
    expect(pot({ canAddPar3s: false })).not.toContain('Add all par 3s')
  })
  it('locked: everything read-only and the remove, Add and Add-all buttons are hidden', () => {
    const locked = pot({ locked: true })
    expect(locked).not.toContain('Remove hole')
    expect(locked).not.toContain('>Add<')
    expect(locked).not.toContain('Add all par 3s')
    expect(locked.match(/disabled=""/g).length).toBeGreaterThanOrEqual(3)
    for (const h of [3, 8, 13, 16]) expect(locked).toContain(`Hole ${h}`)
  })
  it('44px boxes, no emoji', () => {
    expect(out).toContain('h-11')
    expect(out).not.toMatch(/\p{Extended_Pictographic}/u)
  })
})

describe('AllocationBar', () => {
  const segments = { flightA: 360, flightB: 324, field: 114, other: 0 }
  const bar = props => html(h(AllocationBar, { allocated: 798, pot: 798, segments, onSave: noop, ...props }))

  it('says how much is allocated and that it is Balanced, with a check icon', () => {
    const out = bar()
    expect(out).toContain('$798.00 allocated of $798.00')
    expect(out).toContain('Balanced')
    expect(out).toContain('text-status-active-text')
    expect(out).toContain('<svg')
  })
  it('Over and Under show the gap in the gold tint', () => {
    const over = bar({ allocated: 800 })
    expect(over).toContain('Over by $2.00')
    expect(over).toContain('text-status-upcoming-text')
    expect(bar({ allocated: 700.5 })).toContain('Under by $97.50')
  })
  it('has a stacked bar labelled with the split, and a legend with Flight A, Flight B and Full field', () => {
    const out = bar()
    expect(out).toContain('role="img"')
    expect(out).toContain('Flight A $360.00, Flight B $324.00, Full field $114.00')
    for (const l of ['Flight A', 'Flight B', 'Full field']) expect(out).toContain(l)
    expect(out).toContain('bg-fairway-700')
    expect(out).toContain('bg-fairway-300')
    expect(out).toContain('bg-status-upcoming-text')
  })
  it('segments are sized against the larger of pot and allocation, so an overspend still fits', () => {
    const out = bar({ allocated: 1000, segments: { flightA: 1000, flightB: 0, field: 0, other: 0 } })
    expect(out).toContain('width:100%')
  })
  it('is sticky at the bottom and has the Save payout setup button', () => {
    const out = bar()
    expect(out).toContain('sticky bottom-0')
    expect(out).toContain('>Save payout setup<')
  })
  it('locked: no Save button, but the summary is still shown', () => {
    const out = bar({ locked: true })
    expect(out).not.toContain('Save payout setup')
    expect(out).toContain('allocated of')
  })
  it('uses no emoji', () => {
    expect(bar()).not.toMatch(/\p{Extended_Pictographic}/u)
  })
})
