import { describe, it, expect } from 'vitest'
import { registrationState, feeLabel, dedupeSponsors, competitionGroups, scheduleEntries, eventTabs } from './eventPageView'

describe('registrationState', () => {
  const reg = '/register/a/b'
  it('is open for an upcoming event with spots', () => {
    expect(registrationState({ status: 'upcoming', regUrl: reg, spotsLeft: 3 }).canRegister).toBe(true)
    expect(registrationState({ status: 'upcoming', regUrl: reg, spotsLeft: null }).kind).toBe('open')
  })
  it('closes when full', () => {
    const s = registrationState({ status: 'upcoming', regUrl: reg, spotsLeft: 0 })
    expect(s).toMatchObject({ kind: 'closed', canRegister: false })
  })
  it('closes when the event is active or has no link', () => {
    expect(registrationState({ status: 'active', regUrl: reg, spotsLeft: 5 }).canRegister).toBe(false)
    expect(registrationState({ status: 'upcoming', regUrl: null, spotsLeft: 5 }).kind).toBe('closed')
  })
  it('complete never registers', () => {
    expect(registrationState({ status: 'complete', regUrl: reg, spotsLeft: 5 })).toMatchObject({ kind: 'complete', canRegister: false })
  })
})

describe('feeLabel', () => {
  it('formats a positive fee only', () => {
    expect(feeLabel(160)).toBe('$160')
    expect(feeLabel('45.00')).toBe('$45')
    expect(feeLabel(0)).toBe(null)
    expect(feeLabel(null)).toBe(null)
  })
})

describe('dedupeSponsors', () => {
  it('removes repeats by name and keeps the one with a logo', () => {
    const out = dedupeSponsors([
      { name: 'Scorify Golf', logo_url: null, url: '' },
      { name: 'scorify golf ', logo_url: 'x.png', url: '' },
      { name: 'Other', logo_url: null, url: '' },
    ])
    expect(out).toHaveLength(2)
    expect(out[0].logo_url).toBe('x.png')
  })
  it('removes repeats by url', () => {
    expect(dedupeSponsors([{ name: 'A', url: 'https://x.com/' }, { name: 'B', url: 'https://x.com' }])).toHaveLength(1)
  })
  it('handles empty input', () => {
    expect(dedupeSponsors(null)).toEqual([])
  })
})

describe('competitionGroups', () => {
  it('groups variants under one row and drops empty groups', () => {
    const g = competitionGroups({ formats: ['net_stroke', 'net_stroke_front9', 'net_stroke_back9'], side_game_options: [], custom_competitions: [] })
    expect(g).toHaveLength(1)
    expect(g[0].rows).toEqual([{ title: 'Net Stroke Play', variants: ['Overall', 'Front 9', 'Back 9'], sepEntry: false, detail: null }])
  })
  it('builds side games with flights and custom entries', () => {
    const g = competitionGroups({ formats: [], side_game_options: ['skins_a', 'skins_b', 'ctp'], custom_competitions: ['Hole in one'] })
    expect(g.map(x => x.title)).toEqual(['Side games', 'Other'])
    expect(g[0].rows[0]).toMatchObject({ title: 'Skins', variants: ['Flight A', 'Flight B'] })
    expect(g[0].rows[1].title).toBe('Closest to Pin')
  })
  it('adds the long drive hole and CTP holes only when set', () => {
    const set = competitionGroups({ side_game_options: ['long_drive', 'ctp'], long_drive_hole: 7, payout_config: { ctp_3: {}, ctp_12: {}, skins: {} } })
    expect(set[0].rows.find(r => r.title === 'Long Drive').detail).toBe('Hole 7')
    expect(set[0].rows.find(r => r.title === 'Closest to Pin').detail).toBe('Holes 3, 12')
    const unset = competitionGroups({ side_game_options: ['long_drive', 'ctp'] })
    expect(unset[0].rows.every(r => r.detail === null)).toBe(true)
    expect(competitionGroups({ side_game_options: ['ctp'], payout_config: { ctp_5: {} } })[0].rows[0].detail).toBe('Hole 5')
  })
  it('returns nothing when nothing is enabled', () => {
    expect(competitionGroups({})).toEqual([])
  })
})

describe('scheduleEntries', () => {
  it('uses organizer entries', () => {
    const e = scheduleEntries({ schedule_items: [{ time: '08:00', label: 'Check-in' }, { label: ' ' }] }, '9:00 AM')
    expect(e).toHaveLength(1)
    expect(e[0].label).toBe('Check-in')
  })
  it('falls back to first tee time', () => {
    expect(scheduleEntries({}, '9:00 AM')[0]).toMatchObject({ label: 'First tee time', timeLabel: '9:00 AM' })
  })
  it('is null with nothing', () => {
    expect(scheduleEntries({}, null)).toBe(null)
  })
})

describe('eventTabs', () => {
  it('adds Matchups only with pairings', () => {
    expect(eventTabs({ hasMatchups: true, canRegister: false }).tabs.map(t => t.key)).toEqual(['overview', 'matchups', 'pairings', 'photos'])
    expect(eventTabs({ hasMatchups: false, canRegister: false }).tabs.map(t => t.key)).toEqual(['overview', 'pairings', 'photos'])
  })
  it('shows the Register label only while open', () => {
    expect(eventTabs({ hasMatchups: false, canRegister: true, fee: '$160' }).registerLabel).toBe('Register · $160')
    expect(eventTabs({ hasMatchups: false, canRegister: false, fee: '$160' }).registerLabel).toBe(null)
  })
})
