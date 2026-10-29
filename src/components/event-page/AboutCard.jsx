import DOMPurify from 'dompurify'
import { markdownToHtml } from '../../lib/simpleMarkdown'
import EventCard from './EventCard'

// The organizer's text is free-form. It is shown exactly as typed: same escaping and the same
// bold / italic / line-break handling the page has always used, nothing parsed, reordered or cut.
export function aboutHtml(text) {
  return DOMPurify.sanitize(markdownToHtml(text), { ALLOWED_TAGS: ['strong', 'em', 'br'], ALLOWED_ATTR: [] })
}

export default function AboutCard({ text }) {
  if (!text?.trim()) return null
  return (
    <EventCard title="About this event">
      <div
        className="max-w-[68ch] break-words text-base leading-[1.65] text-ink"
        dangerouslySetInnerHTML={{ __html: aboutHtml(text) }}
      />
    </EventCard>
  )
}
