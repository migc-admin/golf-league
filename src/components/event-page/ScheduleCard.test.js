import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ScheduleCard from './ScheduleCard'
import { scheduleEntries, time12 } from '../../lib/eventPageView'

const html = entries => renderToStaticMarkup(h(ScheduleCard, { entries }))

describe('time12', () => {
  it('formats times', () => {
    expect(time12('08:00:00')).toBe('8:00 AM')
    expect(time12('13:05')).toBe('1:05 PM')
    expect(time12('00:30')).toBe('12:30 AM')
    expect(time12(null)).toBe('')
  })
})

describe('ScheduleCard', () => {
  it('hides with no entries', () => {
    expect(html(null)).toBe('')
    expect(html([])).toBe('')
  })
  it('shows time, label and description for each entry', () => {
    const out = html(scheduleEntries({ schedule_items: [
      { time: '07:30', label: 'Check-in', description: 'Pro shop' },
      { time: '09:00', label: 'Shotgun start' },
    ] }, null))
    expect(out).toContain('7:30 AM')
    expect(out).toContain('Check-in')
    expect(out).toContain('Pro shop')
    expect(out).toContain('9:00 AM')
    expect(out).toContain('Schedule')
  })
  it('falls back to a single first tee time entry', () => {
    const out = html(scheduleEntries({}, '8:00 AM'))
    expect(out).toContain('First tee time')
    expect(out).toContain('8:00 AM')
  })
  it('draws the connecting line between entries only', () => {
    const two = html([{ time: '07:00', label: 'A' }, { time: '08:00', label: 'B' }])
    expect(two.match(/w-px/g)).toHaveLength(1)
    expect(html([{ time: '07:00', label: 'A' }])).not.toContain('w-px')
  })
})
