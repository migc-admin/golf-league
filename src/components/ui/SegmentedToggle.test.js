import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import SegmentedToggle from './SegmentedToggle'

const options = [{ value: 'player', label: 'By player' }, { value: 'category', label: 'By category' }]
const out = value => renderToStaticMarkup(h(SegmentedToggle, { options, value, onChange: () => {}, label: 'Group results by' }))

describe('SegmentedToggle', () => {
  it('is a labelled group of real buttons with aria-pressed on the selected one', () => {
    const o = out('player')
    expect(o).toContain('role="group" aria-label="Group results by"')
    expect(o).toMatch(/aria-pressed="true"[^>]*>By player</)
    expect(o).toMatch(/aria-pressed="false"[^>]*>By category</)
  })
  it('the selected option is forest green with white text; buttons are 44px', () => {
    expect(out('player')).toContain('bg-fairway-700 text-white')
    expect(out('category')).toMatch(/bg-fairway-700 text-white[^>]*>By category/)
    expect(out('player')).toContain('min-h-[44px]')
  })
  it('calls onChange with the option value', () => {
    const calls = []
    const el = SegmentedToggle({ options, value: 'player', onChange: v => calls.push(v), label: 'x' })
    el.props.children[1].props.onClick()
    expect(calls).toEqual(['category'])
  })
})
