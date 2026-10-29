import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import TabList from './TabList'

const tabs = [{ value: 'results', label: 'Results' }, { value: 'setup', label: 'Setup' }]
const render = props => renderToStaticMarkup(h(TabList, { tabs, value: 'results', onChange: () => {}, label: 'Payout views', panelId: 'payout-panel', ...props }))

describe('TabList', () => {
  it('is a labelled tablist of role="tab" buttons with aria-selected on the current one', () => {
    const out = render()
    expect(out).toContain('role="tablist" aria-label="Payout views"')
    expect(out).toMatch(/role="tab" aria-selected="true"[^>]*>Results</)
    expect(out).toMatch(/role="tab" aria-selected="false"[^>]*>Setup</)
    expect(out).toContain('aria-controls="payout-panel"')
  })
  it('only the selected tab is in the tab order (roving tabindex)', () => {
    const out = render()
    expect(out).toMatch(/aria-selected="true"[^>]*tabindex="0"/)
    expect(out).toMatch(/aria-selected="false"[^>]*tabindex="-1"/)
  })
  it('shows a lock icon only on the tabs it is told are locked', () => {
    const out = render({ lockedTabs: ['setup'] })
    expect(out.match(/<svg/g)).toHaveLength(1)
    expect(out.indexOf('Setup')).toBeLessThan(out.indexOf('<svg'))
    expect(render()).not.toContain('<svg')
  })
  it('tabs are 44px tall and the current one is forest green', () => {
    const out = render()
    expect(out).toContain('min-h-[44px]')
    expect(out).toContain('border-fairway-700 text-fairway-700')
  })
  it('arrow keys move to the next and previous tab (wrapping), Home and End jump', () => {
    const calls = []
    const el = TabList({ tabs, value: 'results', onChange: v => calls.push(v), label: 'x', panelId: 'p' })
    const [results, setup] = el.props.children
    const press = (btn, key) => btn.props.onKeyDown({ key, preventDefault() {} })
    press(results, 'ArrowRight')
    press(setup, 'ArrowRight')
    press(results, 'ArrowLeft')
    press(setup, 'Home')
    press(results, 'End')
    expect(calls).toEqual(['setup', 'results', 'setup', 'results', 'setup'])
  })
  it('other keys do nothing', () => {
    const calls = []
    const el = TabList({ tabs, value: 'results', onChange: v => calls.push(v), label: 'x', panelId: 'p' })
    el.props.children[0].props.onKeyDown({ key: 'a', preventDefault() {} })
    expect(calls).toEqual([])
  })
})
