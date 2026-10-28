import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import RegistrationCard from './RegistrationCard'

const html = el => renderToStaticMarkup(el)
const url = 'https://www.scorifygolf.com/register/mulligans-island/playoffs-round-2'

describe('RegistrationCard', () => {
  it('shows title, subtitle, a labelled read-only link and a Copy link button with an icon', () => {
    const out = html(h(RegistrationCard, { url }))
    expect(out).toContain('>Registration<')
    expect(out).toContain('Share this link so players can sign up and pay.')
    expect(out).toContain('Registration link')
    expect(out).toContain(`value="${url}"`)
    expect(out.toLowerCase()).toContain('readonly')
    expect(out).toContain('>Copy link<')
    expect(out).toContain('<svg')
    expect(out).toMatch(/<label for="([^"]+)"[^>]*>Registration link<\/label><div[^>]*><input id="\1"/)
  })

  it('has no separate Pending card: pending is a footer row, "None" when empty', () => {
    const out = html(h(RegistrationCard, { url, pendingCount: 0, children: h('p', null, 'should not render') }))
    expect(out).toContain('Pending payments')
    expect(out).toContain('Registered but payment not yet confirmed')
    expect(out).toContain('>None<')
    expect(out).not.toContain('should not render')
  })

  it('lists pending registrations (children) and a count when there are some', () => {
    const out = html(h(RegistrationCard, { url, pendingCount: 2, children: h('p', null, 'Jane Doe') }))
    expect(out).toContain('2 pending')
    expect(out).toContain('Jane Doe')
    expect(out).not.toContain('>None<')
  })

  it('keeps the sidebar anchor id and uses only existing tokens', () => {
    const out = html(h(RegistrationCard, { url }))
    expect(out).toContain('id="registration"')
    expect(out).not.toMatch(/#[0-9a-fA-F]{3,6}/)
    expect(out).not.toMatch(/\p{Extended_Pictographic}/u)
  })

  it('shows an optional notice under the link and a loading state for the pending count', () => {
    const out = html(h(RegistrationCard, { url, pendingCount: null, notice: 'No payment links set' }))
    expect(out).toContain('No payment links set')
    expect(out).toContain('Loading…')
    expect(out).not.toContain('>None<')
    expect(html(h(RegistrationCard, { url }))).not.toContain('text-xs text-status-upcoming-text')
  })

  it('does not contain localhost unless the page passes it', () => {
    expect(html(h(RegistrationCard, { url }))).not.toContain('localhost')
  })
})
