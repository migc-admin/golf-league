import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ExportRow from './ExportRow'
import { ActionButton } from './Button'

const html = el => renderToStaticMarkup(el)

describe('ExportRow', () => {
  it('shows title, format tag and one-line description', () => {
    const out = html(h(ExportRow, { title: 'Tee sheet', tag: 'PNG', description: 'Groups, tee times and holes' }))
    expect(out).toContain('Tee sheet')
    expect(out).toContain('>PNG<')
    expect(out).toContain('Groups, tee times and holes')
  })

  it('does not put "(PNG)" in the title and omits the tag when none is given', () => {
    const out = html(h(ExportRow, { title: 'Scorecards' }))
    expect(out).not.toContain('(PNG)')
    expect(out).not.toContain('uppercase')
  })

  it('renders right-aligned actions unchanged', () => {
    const out = html(h(ExportRow, { title: 'x', actions: [
      h(ActionButton, { key: 'a' }, 'Preview'),
      h(ActionButton, { key: 'b', icon: 'download' }, 'Download'),
    ] }))
    expect(out).toContain('sm:justify-end')
    expect(out).toContain('Preview')
    expect(out).toContain('Download')
  })

  it('has a 1px divider between rows, none above the first, and stacks on mobile', () => {
    const out = html(h(ExportRow, { title: 'x' }))
    expect(out).toContain('border-t')
    expect(out).toContain('first:border-t-0')
    expect(out).toContain('flex-col')
    expect(out).toContain('sm:flex-row')
  })

  it('uses only existing color tokens', () => {
    const out = html(h(ExportRow, { title: 'x', tag: 'CSV', description: 'y' }))
    expect(out).not.toMatch(/#[0-9a-fA-F]{3,6}/)
    expect(out).not.toMatch(/\b(?:bg|text|border)-(?:gray|slate|zinc|amber|yellow|green)-/)
  })
})
