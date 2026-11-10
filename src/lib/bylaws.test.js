import { describe, it, expect } from 'vitest'
import { parseBylaws, inlineParts, isHeading, groupSections } from './bylaws'

describe('isHeading', () => {
  it('spots title-like lines', () => {
    expect(isHeading('ARTICLE II – HANDICAPS')).toBe(true)
    expect(isHeading('Section 4. Pace of play')).toBe(true)
    expect(isHeading('Rule 7')).toBe(true)
    expect(isHeading('Membership dues:')).toBe(true)
  })
  it('leaves ordinary lines alone', () => {
    expect(isHeading('1. Players must post scores within 24 hours.')).toBe(false)
    expect(isHeading('Dues are $50 per season, due by the first event.')).toBe(false)
    expect(isHeading('GHIN')).toBe(true)
    expect(isHeading('OK')).toBe(false)
  })
})

describe('parseBylaws', () => {
  it('groups headings, paragraphs and bullet lists, keeping line breaks', () => {
    const blocks = parseBylaws('ARTICLE I – MEMBERSHIP\nOpen to all.\nDues apply.\n\n- Must hold a GHIN\n- Must be 21+\nAfter list\n\n\n')
    expect(blocks.map(b => b.type)).toEqual(['heading', 'para', 'list', 'para'])
    expect(blocks[0].text).toBe('ARTICLE I – MEMBERSHIP')
    expect(blocks[1].lines).toEqual(['Open to all.', 'Dues apply.'])
    expect(blocks[2].items).toEqual(['Must hold a GHIN', 'Must be 21+'])
  })
  it('gives headings unique ids and drops a trailing colon', () => {
    const blocks = parseBylaws('Dues:\nx\nPace of play:\ny')
    const heads = blocks.filter(b => b.type === 'heading')
    expect(heads.map(h => h.text)).toEqual(['Dues', 'Pace of play'])
    expect(new Set(heads.map(h => h.id)).size).toBe(2)
  })
  it('handles empty text and Windows line endings', () => {
    expect(parseBylaws('')).toEqual([])
    expect(parseBylaws(null)).toEqual([])
    expect(parseBylaws('a\r\nb')[0].lines).toEqual(['a', 'b'])
  })
})

describe('inlineParts', () => {
  it('splits bold and links, leaving markup-looking text as plain text', () => {
    expect(inlineParts('See **Rule 3** at https://usga.org/rules. <b>x</b>')).toEqual([
      { type: 'text', value: 'See ' },
      { type: 'bold', value: 'Rule 3' },
      { type: 'text', value: ' at ' },
      { type: 'link', value: 'https://usga.org/rules' },
      { type: 'text', value: '. <b>x</b>' },
    ])
  })
  it('does not treat javascript: as a link', () => {
    expect(inlineParts('javascript:alert(1)')).toEqual([{ type: 'text', value: 'javascript:alert(1)' }])
  })
})

describe('groupSections', () => {
  it('collapses by article and keeps other headings inside', () => {
    const { intro, sections } = groupSections(parseBylaws('Preamble text\n\nARTICLE I – DUES\nSection 1. Amount\n$50\n\nARTICLE II – PLAY\nBe quick'))
    expect(intro.map(b => b.type)).toEqual(['para'])
    expect(sections.map(s => s.title)).toEqual(['ARTICLE I – DUES', 'ARTICLE II – PLAY'])
    expect(sections[0].blocks.map(b => b.type)).toEqual(['heading', 'para'])
  })
  it('uses every heading when there are no articles', () => {
    const { sections } = groupSections(parseBylaws('Dues:\n$50\nPace of play:\nBe quick'))
    expect(sections.map(s => s.title)).toEqual(['Dues', 'Pace of play'])
  })
})
