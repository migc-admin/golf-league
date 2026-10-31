/**
 * EventEmailModal — builds a pre-round or post-round email, previews it, and
 * copies it to the clipboard as rich text so it can be pasted into Gmail.
 */
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import SegmentedToggle from './SegmentedToggle'
import Button from './Button'
import { supabase } from '../../lib/supabase'
import { buildPreRoundEmail, buildPostRoundEmail, copyRichHtml, preRoundIncludes } from '../../lib/eventEmails'
import { buildResultsView, shortDateText } from '../../lib/resultsView'
import { teamPlayExportView } from '../../lib/teamPlayExport'

const NONE = []
const MIGC_ORG = import.meta.env.VITE_MIGC_ORG_ID
const PROD_ORIGIN = 'https://www.scorifygolf.com'

// Links in a pasted email must be public — never localhost.
function publicOrigin() {
  const { hostname, origin } = window.location
  return hostname === 'localhost' || hostname === '127.0.0.1' ? PROD_ORIGIN : origin
}

function htmlToPlainText(html) {
  return html
    .replace(/<(br|\/tr|\/div|\/p)\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n').trim()
}

// What the results email contains, for the "Included automatically" box.
function postRoundIncludes({ event, eventPlayers, allScores, course, sideGames, matchPairings, hasTeams, nextEvent }) {
  let view = null
  if (course) { try { view = buildResultsView({ event, eventPlayers, allScores, course, sideGames: sideGames ?? [], matchPairings }) } catch { view = null } }
  const items = [{ label: 'Low net and total pot', missing: !view }]
  if (view?.scoring) items.push({ label: 'Net stroke play by flight', missing: false })
  if (view?.skins) items.push({ label: 'Skins', missing: false })
  if (view?.ctp || view?.longDrive || view?.lowPutts) items.push({ label: 'Closest to pin, long drive, low putts', missing: false })
  if (view?.matchPlay) items.push({ label: 'Match play results', missing: false })
  if (hasTeams) items.push({ label: 'Team play standings', missing: false })
  items.push({ label: 'Next event', missing: !nextEvent, hint: 'none scheduled' })
  return items
}

export default function EventEmailModal({
  kind, event, eventPlayers, allScores, course, sideGames, leagueName, logoUrl, orgSlug, leagueSlug, onClose,
  tglTeams = NONE, tglMembers = NONE, tglSelections = NONE,
}) {
  const isPre = kind === 'pre'
  const formats = event?.formats ?? (event?.format ? [event.format] : [])
  const hasMatchPlay = formats.includes('match_points') || formats.includes('ryder_cup')

  const [note, setNote] = useState('')
  const [matchPairings, setMatchPairings] = useState([])
  const [nextEvent, setNextEvent] = useState(null)

  useEffect(() => {
    if (!hasMatchPlay) return
    supabase
      .from('match_pairings')
      .select('*, playerA:players!player_a_id(first_name,last_name), playerB:players!player_b_id(first_name,last_name)')
      .eq('event_id', event.id)
      .order('match_number')
      .then(({ data }) => setMatchPairings(data ?? []))
  }, [event.id, hasMatchPlay])

  // The league's next upcoming event, for the "Next up" line in the results email
  useEffect(() => {
    if (isPre || !event.league_id || !event.event_date) return
    let cancelled = false
    supabase
      .from('events')
      .select('id, name, slug, event_date')
      .eq('league_id', event.league_id)
      .eq('status', 'upcoming')
      .gt('event_date', event.event_date)
      .order('event_date')
      .limit(1)
      .then(({ data }) => { if (!cancelled) setNextEvent(data?.[0] ?? null) })
    return () => { cancelled = true }
  }, [isPre, event.league_id, event.event_date])

  const { subject, html } = useMemo(() => {
    const origin = publicOrigin()
    const base = `${origin}/${orgSlug}/${leagueSlug}/${event.slug}`
    if (isPre) {
      const isMIGC = event.league?.org_id === MIGC_ORG
      return buildPreRoundEmail({
        event, eventPlayers, matchPairings, leagueName, logoUrl, note,
        eventUrl: `${base}/event`,
        wagerUrl: isMIGC ? `${origin}/wager/${event.id}` : null,
      })
    }
    let view = null
    if (course) {
      try { view = buildResultsView({ event, eventPlayers, allScores, course, sideGames: sideGames ?? [], matchPairings }) } catch { view = null }
    }
    const teamRows = tglTeams.length > 0
      ? teamPlayExportView({ event, eventPlayers, allScores, course, tglTeams, tglMembers, tglSelections }).rows
      : []
    const leaderboardUrl = `${base}/leaderboard?eid=${event.id}`
    return buildPostRoundEmail({
      event, view, teamRows, leagueName, logoUrl, note,
      leaderboardUrl, payoutsUrl: leaderboardUrl,
      nextEvent: nextEvent ? {
        name: nextEvent.name, dateText: shortDateText(nextEvent.event_date),
        url: `${origin}/${orgSlug}/${leagueSlug}/${nextEvent.slug}/event`,
      } : null,
    })
  }, [isPre, event, eventPlayers, allScores, course, sideGames, matchPairings, leagueName, logoUrl, orgSlug, leagueSlug, note, nextEvent, tglTeams, tglMembers, tglSelections])

  async function copyEmail() {
    try {
      await copyRichHtml(html, htmlToPlainText(html))
      toast.success('Email copied — paste it into Gmail')
    } catch {
      toast.error('Could not copy. Select the preview text and copy manually.')
    }
  }

  async function copySubject() {
    try {
      await navigator.clipboard.writeText(subject)
      toast.success('Subject copied')
    } catch {
      toast.error('Could not copy subject')
    }
  }

  function openGmail() {
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(subject)}`, '_blank', 'noopener')
  }

  const includes = isPre ? preRoundIncludes(event, eventPlayers) : postRoundIncludes({ event, eventPlayers, allScores, course, sideGames, matchPairings, hasTeams: tglTeams.length > 0, nextEvent })
  const [device, setDevice] = useState('desktop')
  const eyebrow = `${event?.name ?? 'Event'} · ${isPre ? 'Step 1 · Before the round' : 'Step 3 · After the round'}`

  // Same keyboard and scroll behavior the shared Modal gives.
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-modal="true" aria-label={isPre ? 'Tournament details email' : 'Results email'}
        className="flex max-h-[90vh] w-full max-w-[1100px] flex-col overflow-hidden rounded-sm bg-white shadow-card">
        <div className="flex items-start justify-between gap-4 border-b border-surface-border px-5 py-4">
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold uppercase tracking-wide text-fairway-700">{eyebrow}</div>
            <h2 className="text-lg font-bold text-ink">{isPre ? 'Tournament details email' : 'Results email'}</h2>
          </div>
          <Button variant="ghost" size="sm" iconOnly label="Close" onClick={onClose}>×</Button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto min-[900px]:grid-cols-[380px_1fr] min-[900px]:overflow-hidden">
          {/* Controls */}
          <div className="flex flex-col gap-5 p-5 min-[900px]:overflow-y-auto">
            <div>
              <label htmlFor="email-subject" className="label">Subject</label>
              <div className="flex items-center gap-2">
                <input id="email-subject" readOnly value={subject} className="input min-w-0 flex-1" />
                <Button variant="secondary" size="md" iconOnly label="Copy subject" onClick={copySubject}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 012-2h9" />
                  </svg>
                </Button>
              </div>
            </div>

            <div>
              <label htmlFor="email-note" className="label">Message to players (optional)</label>
              <textarea
                id="email-note"
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={4}
                className="input"
                placeholder={isPre ? 'e.g. Weather looks great — arrive 30 minutes before your tee time.' : 'e.g. Great round everyone — payouts go out this week.'}
              />
              <p className="mt-1 text-xs text-ink-muted">Shows near the top of the email as a note from you.</p>
            </div>

            {includes && (
              <div className="rounded-sm border border-surface-border bg-surface-dim p-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Included automatically</div>
                <ul className="space-y-1.5 text-sm">
                  {includes.map(i => (
                    <li key={i.label} className={i.missing ? 'font-medium text-status-upcoming-text' : 'text-ink'}>
                      {i.label}{i.missing ? ` (${i.hint ?? 'not set yet'})` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-auto space-y-4">
              <div>
                <div className="mb-1.5 text-sm font-semibold text-ink">Send it in 3 steps</div>
                <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-muted">
                  <li>Copy the email</li>
                  <li>Open Gmail and paste into a new message</li>
                  <li>Add recipients and send</li>
                </ol>
              </div>
              <div className="space-y-2">
                <Button className="w-full" size="lg" onClick={copyEmail}>Copy email</Button>
                <Button className="w-full" size="lg" variant="secondary" onClick={openGmail}>Open Gmail ↗</Button>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="flex min-h-[420px] min-w-0 flex-col bg-surface-high min-[900px]:min-h-0">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Preview</div>
              <SegmentedToggle
                label="Preview width"
                value={device}
                onChange={setDevice}
                options={[{ value: 'desktop', label: 'Desktop' }, { value: 'phone', label: 'Phone' }]}
              />
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-5 pb-5">
              {/* sandboxed: preview only, no scripts. Renders the exact HTML Copy email copies. */}
              <iframe
                title="Email preview"
                sandbox=""
                srcDoc={`<!doctype html><html><body style="margin:0;background:#fff;">${html}</body></html>`}
                className="mx-auto block h-full min-h-[560px] rounded-sm border border-surface-highest bg-white"
                style={{ width: device === 'phone' ? 375 : 600, maxWidth: '100%' }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
