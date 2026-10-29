import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import WinnerField from './WinnerField'

const html = el => renderToStaticMarkup(el)
const players = [
  { player_id: 'p1', player: { first_name: 'Cal', last_name: 'Adams' }, flight: 'B' },
  { player_id: 'p2', player: { first_name: 'Amy', last_name: 'Baker' }, flight: 'A' },
]
const flight = props => html(h(WinnerField, { label: 'Flight A', players, value: '', onChange: () => {}, ...props }))
const hole = props => html(h(WinnerField, { label: 'Hole 3', par: 3, players, value: '', onChange: () => {}, ...props }))

describe('WinnerField', () => {
  it('has a real label tied to the dropdown (the flight pill, or "Hole n")', () => {
    expect(flight()).toMatch(/<label for="([^"]+)"[^>]*>Flight A<\/label>[\s\S]*<select id="\1"/)
    expect(hole()).toMatch(/<label for="([^"]+)"[^>]*>Hole 3<\/label>[\s\S]*<select id="\1"/)
  })

  it('a flight label is plain bold text above the dropdown, left-aligned, like a hole label (no pill)', () => {
    const out = flight()
    expect(out).not.toContain('rounded-full')
    expect(out).not.toContain('bg-[#E6EFE9]')
    expect(out).toMatch(/<label[^>]*text-sm font-semibold[^>]*>Flight A<\/label>/)
    expect(out.indexOf('Flight A')).toBeLessThan(out.indexOf('<select'))
    expect(flight()).not.toContain('Par ')
  })

  it('hole layout shows "Par 3" muted beside the label', () => {
    expect(hole()).toContain('Par 3')
    expect(hole({ par: undefined })).not.toContain('Par ')
  })

  it('first option is the empty "Select winner", then "No winner", then the players as First Last', () => {
    const out = flight()
    expect(out).toMatch(/<option value=""[^>]*>Select winner<\/option><option value="NO_WINNER">No winner<\/option><option value="p1">Cal Adams<\/option><option value="p2">Amy Baker<\/option>/)
    expect(out).not.toContain('(Flight')
  })

  it('is a 44px, full-width dropdown that uses the same input look as the other admin dropdowns, with a decorative chevron', () => {
    const out = flight()
    expect(out).toMatch(/<select[^>]*class="input h-11 w-full/)
    expect(out).not.toContain('rounded-[10px]')
    expect(out).not.toContain('border-[#D9D5C9]')
    expect(out).toMatch(/<svg[^>]*aria-hidden="true"/)
  })

  it('shows "Not entered" until a winner is chosen, then "Entered" (no special border, same as other dropdowns)', () => {
    expect(flight()).toContain('Not entered')
    const chosen = flight({ value: 'p2' })
    expect(chosen).toContain('Entered')
    expect(chosen).not.toContain('Not entered')
    expect(chosen).not.toContain('E3C77A')
    expect(flight({ value: 'NO_WINNER' })).toContain('Entered')
  })

  it('shows the saving, saved and error states under the dropdown', () => {
    expect(flight({ status: 'saving', value: 'p2' })).toContain('Saving…')
    expect(flight({ status: 'saved', value: 'p2' })).toContain('>Saved<')
    const err = flight({ status: 'error', error: 'Could not reach the server' })
    expect(err).toContain('role="alert"')
    expect(err).toContain('Could not reach the server')
  })

  it('a flight with nobody in it is disabled and says so', () => {
    const out = flight({ players: [], disabled: true, disabledNote: 'No players assigned to this flight' })
    expect(out).toMatch(/<select[^>]*disabled=""/)
    expect(out).toContain('No players assigned to this flight')
    expect(out).not.toContain('Not entered')
  })

  it('uses no emoji and no pool colors', () => {
    const out = flight({ value: 'p2' })
    expect(out).not.toMatch(/\p{Extended_Pictographic}/u)
    expect(out).not.toMatch(/#2E7D4F|#2B59A0|#6B46C1/)
  })
})
