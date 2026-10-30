import { describe, it, expect } from 'vitest'
import { cityOf, feeText, firstTeeTime, missingMessage } from './registerView'
import { time12 } from './eventPageView'

describe('registerView', () => {
  it('finds the city in a US address', () => {
    expect(cityOf('8640 Rush St, Rosemead, CA 91770')).toBe('Rosemead')
    expect(cityOf('Twin Oaks Golf Course, 1425 N Twin Oaks Valley Rd, San Marcos, CA')).toBe('San Marcos')
    expect(cityOf('Somewhere nice')).toBeNull()
    expect(cityOf(null)).toBeNull()
  })
  it('formats fees', () => {
    expect(feeText(160)).toBe('$160')
    expect(feeText('42.50')).toBe('$42.50')
    expect(feeText('x')).toBe('')
  })
  it('finds the first tee time', () => {
    expect(firstTeeTime([{ time: '08:40', label: 'Betting Window Closes' }, { time: '09:00', label: 'First Tee Time' }], time12)).toBe('9:00 AM')
    expect(firstTeeTime([{ time: '08:40', label: 'Check-in' }], time12)).toBeNull()
  })
  it('names the missing fields', () => {
    expect(missingMessage({ names: ['first name'] })).toBe('Please add your first name to finish registering.')
    expect(missingMessage({ names: ['first name', 'last name'] })).toBe('Please add your first name and last name to finish registering.')
    expect(missingMessage({ names: ['last name'], questions: ['Handicap'] })).toBe('Please add your last name and answer “Handicap” to finish registering.')
    expect(missingMessage({})).toBe('')
  })
})
