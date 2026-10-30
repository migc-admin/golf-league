import { describe, it, expect } from 'vitest'
import { stepAmount, snapAmount, isValidAmount, totalOf, amountOf } from './betAmount'

describe('bet amounts', () => {
  it('steps by $5 and never goes below $5', () => {
    expect(stepAmount('', 1)).toBe('5')
    expect(stepAmount('', -1)).toBe('5')
    expect(stepAmount('5', -1)).toBe('5')
    expect(stepAmount('5', 1)).toBe('10')
    expect(stepAmount('20', -1)).toBe('15')
    expect(stepAmount('12', 1)).toBe('15')
  })
  it('snaps typed values to a valid amount', () => {
    expect(snapAmount('')).toBe('5')
    expect(snapAmount('3')).toBe('5')
    expect(snapAmount('12')).toBe('10')
    expect(snapAmount('13')).toBe('15')
    expect(snapAmount('abc')).toBe('5')
  })
  it('validates $5 steps', () => {
    expect(isValidAmount('5')).toBe(true)
    expect(isValidAmount('25')).toBe(true)
    expect(isValidAmount('7')).toBe(false)
    expect(isValidAmount('2.5')).toBe(false)
    expect(isValidAmount('')).toBe(false)
  })
  it('totals picks live', () => {
    expect(totalOf([{ amount: '5' }, { amount: '10' }, { amount: '' }])).toBe(15)
    expect(amountOf('x')).toBe(0)
  })
})
