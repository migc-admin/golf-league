import { describe, it, expect } from 'vitest'
import { rosterToCsv, rosterFileName } from './rosterExport'

const ep = (first, last, extra = {}) => ({ player: { first_name: first, last_name: last }, ...extra })

describe('rosterToCsv', () => {
  it('uses the roster import columns, first name A to Z, blanks where nothing is set', () => {
    const csv = rosterToCsv([
      ep('Tom', 'Williams', { handicap_index: 15.3, flight: 'B', course_handicap: 18 }),
      ep('Ann', 'Lee', { handicap_index: 0, flight: null, course_handicap: null }),
    ])
    expect(csv).toBe('first_name,last_name,handicap_index,flight,course_handicap\nAnn,Lee,,,\nTom,Williams,15.3,B,18\n')
  })
  it('leaves the flight blank for guests and never writes commas inside a cell', () => {
    const csv = rosterToCsv([ep('Sam, Jr', 'Poe', { is_guest: true, flight: 'A', handicap_index: 9, course_handicap: 10.4 })])
    expect(csv.split('\n')[1]).toBe('Sam Jr,Poe,9,,10')
  })
})

describe('rosterFileName', () => {
  it('makes a safe file name', () => {
    expect(rosterFileName('Playoffs - Round 2')).toBe('roster-playoffs-round-2.csv')
    expect(rosterFileName('')).toBe('roster-event.csv')
  })
})
