import { describe, it, expect } from 'vitest'
import { escapeHtml, markdownToHtml, textFingerprint } from './simpleMarkdown'
import { buildPreRoundEmail } from './eventEmails'

describe('markdownToHtml', () => {
  it('formats bold, italic and line breaks', () => {
    expect(markdownToHtml('**Drop** free.\nSee *marked* areas.')).toBe('<strong>Drop</strong> free.<br/>See <em>marked</em> areas.')
  })
  it('escapes HTML so nothing but strong/em/br can come out', () => {
    const out = markdownToHtml('<script>alert(1)</script> & "quotes" <img src=x onerror=1>')
    expect(out).not.toContain('<script')
    expect(out).not.toContain('<img')
    expect(out).toContain('&lt;script&gt;')
    expect(out).toContain('&amp;')
  })
  it('handles empty input', () => {
    expect(markdownToHtml('')).toBe('')
    expect(markdownToHtml(null)).toBe('')
    expect(escapeHtml(undefined)).toBe('')
  })
})

describe('textFingerprint', () => {
  it('is stable for the same text and ignores surrounding whitespace', () => {
    expect(textFingerprint('Cart path drops')).toBe(textFingerprint('  Cart path drops \n'))
  })
  it('changes when the rules are edited', () => {
    expect(textFingerprint('Cart path drops')).not.toBe(textFingerprint('Cart path drops, no relief'))
  })
})

describe('pre-round email local rules', () => {
  const base = { event: { name: 'Event', event_date: '2026-10-25', start_time: '09:50:00' }, eventPlayers: [], matchPairings: [], leagueName: 'League' }
  it('includes a Local Rules section when rules are set, formatted and escaped', () => {
    const { html } = buildPreRoundEmail({ ...base, event: { ...base.event, local_rules: '**Free drop** from cart paths.\n<b>x</b>' } })
    expect(html).toContain('Local Rules')
    expect(html).toContain('<strong>Free drop</strong> from cart paths.<br/>')
    expect(html).not.toContain('<b>x</b>')
  })
  it('omits the section when there are no local rules', () => {
    expect(buildPreRoundEmail(base).html).not.toContain('Local Rules')
    expect(buildPreRoundEmail({ ...base, event: { ...base.event, local_rules: '   ' } }).html).not.toContain('Local Rules')
  })
})
