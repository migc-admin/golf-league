import EventCard from './EventCard'
import Button from '../ui/Button'
import { mapEmbedUrl } from '../../lib/eventPageView'

/** Map (16:10), course name, address and a full-width Get directions button. The hero's Directions link jumps here. */
export default function GettingThereCard({ courseName, address, mapsUrl }) {
  const embed = mapEmbedUrl(address)
  return (
    <EventCard title="Getting there" id="getting-there" className="scroll-mt-20">
      {embed && (
        <div className="mb-4 aspect-[16/10] w-full overflow-hidden rounded-sm border border-surface-border bg-surface-container">
          <iframe
            title="Course location map"
            src={embed}
            className="block h-full w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      )}
      {courseName && <div className="text-[15px] font-bold text-ink">{courseName}</div>}
      {address && <div className="mt-0.5 text-sm text-ink-muted">{address}</div>}
      <Button href={mapsUrl} target="_blank" rel="noopener noreferrer" icon="external" iconAfter size="lg" className="mt-4 w-full">
        Get directions
      </Button>
    </EventCard>
  )
}
