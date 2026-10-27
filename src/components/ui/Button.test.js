import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import Button, { ActionButton } from './Button'

const html = el => renderToStaticMarkup(el)

describe('ActionButton', () => {
  it('renders a real <button type="button"> that is at least 44px tall with 8px corners', () => {
    const out = html(h(ActionButton, null, 'Preview'))
    expect(out).toMatch(/^<button type="button"/)
    expect(out).toContain('min-h-[44px]')
    expect(out).toContain('rounded-sm')
    expect(out).toContain('Preview')
  })

  it('has exactly three variants, using only existing color tokens', () => {
    const primary = html(h(ActionButton, { variant: 'primary' }, 'Copy email'))
    const secondary = html(h(ActionButton, { variant: 'secondary' }, 'Preview'))
    const ghost = html(h(ActionButton, { variant: 'ghost' }, 'Clone event'))
    expect(primary).toContain('bg-fairway-700')
    expect(secondary).toContain('bg-white')
    expect(secondary).toContain('border-surface-highest')
    expect(ghost).toContain('text-ink-muted')
    // no arbitrary colors, no gray-*/hex values sneaking in
    for (const out of [primary, secondary, ghost]) {
      expect(out).not.toMatch(/#[0-9a-fA-F]{3,6}/)
      expect(out).not.toMatch(/\b(?:bg|text|border)-(?:gray|slate|zinc|amber|yellow|green)-/)
    }
  })

  it('icon-only buttons are square, hide the text, and carry the aria-label', () => {
    const out = html(h(ActionButton, { icon: 'download', iconOnly: true, label: 'Download scores CSV' }, 'Download'))
    expect(out).toContain('aria-label="Download scores CSV"')
    expect(out).toContain('w-11')
    expect(out).not.toContain('>Download<')
    expect(out).toContain('<svg')
  })

  it('can be disabled, and a loading button is disabled and busy', () => {
    expect(html(h(ActionButton, { disabled: true }, 'Download'))).toContain('disabled=""')
    const loading = html(h(ActionButton, { loading: true }, 'Download'))
    expect(loading).toContain('disabled=""')
    expect(loading).toContain('aria-busy="true"')
  })

  it('renders a real link when given href, with rel set for new-tab links', () => {
    const out = html(h(ActionButton, { href: '/event', target: '_blank', icon: 'external', iconAfter: true }, 'Event page'))
    expect(out).toMatch(/^<a href="\/event"/)
    expect(out).toContain('rel="noopener noreferrer"')
    expect(out.indexOf('Event page')).toBeLessThan(out.indexOf('<svg'))
  })

  it('passes handlers through unchanged', () => {
    const calls = []
    const el = ActionButton({ onClick: () => calls.push('clicked'), children: 'Go' })
    el.props.onClick()
    expect(calls).toEqual(['clicked'])
  })

  it('contains no emoji in its markup', () => {
    const out = html(h(ActionButton, { icon: 'download' }, 'Download'))
    expect(out).not.toMatch(/\p{Extended_Pictographic}/u)
  })
})

describe('Button (shared admin button)', () => {
  it('defaults to the primary variant at 44px; ActionButton defaults to secondary', () => {
    const b = html(h(Button, null, 'Save'))
    expect(b).toContain('bg-fairway-700')
    expect(b).toContain('min-h-[44px]')
    expect(html(h(ActionButton, null, 'Save'))).toContain('bg-white')
  })

  it('keeps the existing size prop: sm is a compact 36px, lg and xl are taller', () => {
    expect(html(h(Button, { size: 'sm' }, 'x'))).toContain('min-h-[36px]')
    expect(html(h(Button, { size: 'lg' }, 'x'))).toContain('min-h-[48px]')
    expect(html(h(Button, { size: 'xl' }, 'x'))).toContain('min-h-[56px]')
  })

  it('keeps a danger variant for destructive actions', () => {
    expect(html(h(Button, { variant: 'danger' }, 'Delete'))).toContain('bg-red-600')
  })

  it('a caller-supplied disabled prop does not drop the loading disable', () => {
    expect(html(h(Button, { loading: true, disabled: false }, 'x'))).toContain('disabled=""')
  })
})

describe('Button as a custom component', () => {
  it('renders the given component with button styling and passes props through', () => {
    const Link = ({ to, className, children }) => h('a', { href: to, className, 'data-link': 'yes' }, children)
    const out = html(h(Button, { as: Link, to: '/x', size: 'sm' }, '+ Event'))
    expect(out).toContain('data-link="yes"')
    expect(out).toContain('href="/x"')
    expect(out).toContain('bg-fairway-700')
    expect(out).toContain('+ Event')
  })
})
