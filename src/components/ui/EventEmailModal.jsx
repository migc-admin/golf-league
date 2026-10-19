/**
 * EventEmailModal — builds a pre-round or post-round email, previews it, and
 * copies it to the clipboard as rich text so it can be pasted into Gmail.
 */
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import Modal from './Modal'
import Button from './Button'
import { supabase } from '../../lib/supabase'
import { buildPreRoundEmail, buildPostRoundEmail, copyRichHtml } from '../../lib/eventEmails'
import { computePlayerPayouts } from '../../lib/engines/payoutSummary'
import { computeMatchPoints } from '../../lib/engines/matchPoints'

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

export default function EventEmailModal({
  kind, event, eventPlayers, allScores, course, sideGames, leagueName, logoUrl, orgSlug, leagueSlug, onClose,
}) {
  const isPre = kind === 'pre'
  const formats = event?.formats ?? (event?.format ? [event.format] : [])
  const hasMatchPlay = formats.includes('match_points') || formats.includes('ryder_cup')

  const [note, setNote] = useState('')
  const [matchPairings, setMatchPairings] = useState([])

  useEffect(() => {
    if (!hasMatchPlay) return
    supabase
      .from('match_pairings')
      .select('*, playerA:players!player_a_id(first_name,last_name), playerB:players!player_b_id(first_name,last_name)')
      .eq('event_id', event.id)
      .order('match_number')
      .then(({ data }) => setMatchPairings(data ?? []))
  }, [event.id, hasMatchPlay])

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
    const payouts = computePlayerPayouts(event, eventPlayers, allScores, course, sideGames)
    const matchResults = hasMatchPlay && course
      ? computeMatchPoints(eventPlayers, allScores, course, matchPairings).pairings.filter(r => r.holesPlayed > 0)
      : []
    return buildPostRoundEmail({
      event, payouts, matchResults, leagueName, logoUrl, note,
      leaderboardUrl: `${base}/leaderboard?eid=${event.id}`,
    })
  }, [isPre, event, eventPlayers, allScores, course, sideGames, matchPairings, leagueName, logoUrl, orgSlug, leagueSlug, note, hasMatchPlay])

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

  return (
    <Modal open onClose={onClose} title={isPre ? 'Pre-Round Email' : 'Results Email'} maxWidth="max-w-2xl">
      <div className="p-5 space-y-4 overflow-y-auto">
        <div>
          <label className="label">Message to players (optional)</label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            className="input"
            placeholder={isPre ? 'e.g. Weather looks great — arrive 30 minutes before your tee time.' : 'e.g. Great round everyone — payouts go out this week.'}
          />
        </div>

        <div>
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Subject</div>
          <div className="text-sm text-gray-800 bg-gray-50 rounded-lg px-3 py-2">{subject}</div>
        </div>

        <div>
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Preview</div>
          {/* sandboxed: preview only, no scripts */}
          <iframe
            title="Email preview"
            sandbox=""
            srcDoc={`<!doctype html><html><body style="margin:0;background:#fff;">${html}</body></html>`}
            className="w-full rounded-lg border border-gray-200"
            style={{ height: 420 }}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={copyEmail}>Copy email</Button>
          <Button variant="secondary" onClick={copySubject}>Copy subject</Button>
          <Button variant="secondary" onClick={openGmail}>Open Gmail ↗</Button>
        </div>
        <p className="text-xs text-gray-400">
          Open Gmail, click into the message body, and paste (Cmd+V / Ctrl+V). Then add recipients and send.
        </p>
      </div>
    </Modal>
  )
}
