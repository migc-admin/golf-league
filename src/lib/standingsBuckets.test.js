import { describe, it, expect } from 'vitest'
import { bucketOfCategory, bucketOfKey, countsTowardStandings, standingsConfig, STANDINGS_TOGGLES, DEFAULT_STANDINGS_CONFIG } from './standingsBuckets'

describe('bucketOfCategory', () => {
  it.each([
    ['Skins (Full Field) (2 skins)', 'skins'],
    ['Skins — Flight A (1 skin)', 'skins'],
    ['Super Skins — Flight A (3 skins)', 'super_games'],
    ['Super Skins (Full Field) (1 skin)', 'super_games'],
    ['Super CTP — Hole 7, Flight A', 'super_games'],
    ['Closest to Pin — Hole 3 (Full Field)', 'ctp'],
    ['Long Drive (Full Field)', 'long_drive'],
    ['Long Drive — Flight B (Tied — split 2 ways)', 'long_drive'],
    ['Low Putts — Flight A', 'low_putts'],
    ['Blind Partners (Winning Pair — split 2 ways)', 'blind_partners'],
    ['Blind Partners — Flight A', 'blind_partners'],
    ['Nassau (Net) — Front 9', 'nassau'],
    ['18-Hole Net — Flight A, 1st', 'scoring'],
    ['Stableford Net — 2nd', 'scoring'],
  ])('%s -> %s', (label, bucket) => expect(bucketOfCategory(label)).toBe(bucket))
})

describe('bucketOfKey', () => {
  it.each([
    ['skins', 'skins'], ['skins_a', 'skins'], ['super_skins_b', 'super_games'], ['super_ctp_a_7', 'super_games'],
    ['ctp_7', 'ctp'], ['long_drive_a', 'long_drive'], ['low_putts', 'low_putts'],
    ['blind_partners_a', 'blind_partners'], ['nassau_net_f9', 'nassau'], ['18_net_a_1st', 'scoring'],
  ])('%s -> %s', (key, bucket) => expect(bucketOfKey(key)).toBe(bucket))
})

describe('countsTowardStandings', () => {
  it('uses the defaults when a league has not set anything', () => {
    expect(countsTowardStandings('scoring', {})).toBe(true)
    expect(countsTowardStandings('skins', undefined)).toBe(true)
    expect(countsTowardStandings('super_games', {})).toBe(false)
    expect(countsTowardStandings('blind_partners', {})).toBe(false)
    expect(countsTowardStandings('low_putts', {})).toBe(false)
  })
  it('follows the league switches', () => {
    expect(countsTowardStandings('skins', { include_skins: false })).toBe(false)
    expect(countsTowardStandings('blind_partners', { include_blind_partners: true })).toBe(true)
  })
  it('every toggle has a default and a unique bucket', () => {
    expect(STANDINGS_TOGGLES.every(t => t.key in DEFAULT_STANDINGS_CONFIG)).toBe(true)
    expect(new Set(STANDINGS_TOGGLES.map(t => t.bucket)).size).toBe(STANDINGS_TOGGLES.length)
    expect(standingsConfig({ include_skins: false }).include_nassau).toBe(true)
  })
})

import { countsForEvent, eventStandingsConfig, toggleOverride } from './standingsBuckets'

describe('per-event exceptions', () => {
  const league = { include_skins: false }
  it('follows the league unless the event overrides', () => {
    expect(countsForEvent('skins', league, {})).toBe(false)
    expect(countsForEvent('skins', league, { skins: true })).toBe(true)
    expect(countsForEvent('ctp', league, { ctp: false })).toBe(false)
    expect(countsForEvent('ctp', league, undefined)).toBe(true)
  })
  it('applies exceptions to the settings the standings use', () => {
    const cfg = eventStandingsConfig(league, { skins: true, blind_partners: true, bogus: true })
    expect(cfg.include_skins).toBe(true)
    expect(cfg.include_blind_partners).toBe(true)
    expect(cfg.include_ctp).toBe(true)
  })
  it('toggling away from the league stores an exception, toggling back removes it', () => {
    const on = toggleOverride({}, 'skins', league)
    expect(on).toEqual({ skins: true })
    expect(toggleOverride(on, 'skins', league)).toEqual({})
    expect(toggleOverride({}, 'ctp', league)).toEqual({ ctp: false })
  })
})
