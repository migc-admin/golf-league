/**
 * PhotosCard — one "Photos" card holding the cover photo and the event gallery side by side
 * (stacked on narrow screens).
 *
 *   Photos
 *   Cover photo                       Event gallery
 *   Banner on the public event page   Photos from the day, shown on the public page
 *   [ dashed uploader ]               [ gallery panel ]
 *
 * Presentational: the page passes the existing cover uploader as `cover` and the existing
 * gallery manager as `gallery`, so uploading and removing work exactly as before. The cover
 * keeps its old `cover-photo` anchor so the readiness "Upload" button still scrolls to it.
 * `galleryNote` is the line shown above the gallery controls (e.g. "Add photos after the round.").
 */

export default function PhotosCard({ id = 'event-photos', cover, gallery, galleryNote = null, className = '' }) {
  return (
    <section id={id} className={`rounded-sm border border-surface-border bg-white p-5 sm:p-6 ${className}`.trim()}>
      <h2 className="mb-4 text-lg font-bold text-ink">Photos</h2>
      <div className="grid gap-6 md:grid-cols-2">
        <div id="cover-photo">
          <h3 className="text-sm font-semibold text-ink">Cover photo</h3>
          <p className="mb-3 text-xs text-ink-muted">Banner on the public event page · 1200 × 800 JPG</p>
          {cover}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-ink">Event gallery</h3>
          <p className="mb-3 text-xs text-ink-muted">Photos from the day, shown on the public page</p>
          <div className="rounded-sm bg-surface-container p-4">
            {galleryNote && <p className="mb-3 text-sm text-ink">{galleryNote}</p>}
            {gallery}
          </div>
        </div>
      </div>
    </section>
  )
}
