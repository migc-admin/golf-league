import { useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '../ui/Button'
import { saveTicketPng, ticketPngFilename } from '../../lib/ticketPng'
import { TICKET_PNG_BACKGROUND } from './WagerTicket'

/**
 * Buttons under the ticket: Save ticket (PNG), Wager results, Place more bets, and a quiet
 * "Copy ticket link". `placeMore` is { to } (a link) or { onClick } (resets the bet form).
 */
export default function TicketActions({ captureRef, ticketId, ticketUrl, ready, eventId, placeMore }) {
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  async function save() {
    if (!captureRef.current) return
    setSaving(true)
    try {
      await saveTicketPng(captureRef.current, ticketPngFilename(ticketId), TICKET_PNG_BACKGROUND)
    } catch (err) {
      console.error('Ticket PNG failed:', err)
      alert('Could not save the ticket image: ' + (err?.message ?? err))
    } finally {
      setSaving(false)
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(ticketUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy your ticket link:', ticketUrl)
    }
  }

  return (
    <div className="mx-auto mt-4 w-full max-w-[420px] space-y-3">
      <Button size="lg" className="w-full" icon="download" onClick={save} loading={saving} disabled={!ready}>Save ticket</Button>
      <div className="grid grid-cols-2 gap-3">
        <Button size="lg" variant="secondary" as={Link} to={`/wager/${eventId}/results`}>Wager results</Button>
        {placeMore.to
          ? <Button size="lg" variant="secondary" as={Link} to={placeMore.to}>Place more bets</Button>
          : <Button size="lg" variant="secondary" onClick={placeMore.onClick}>Place more bets</Button>}
      </div>
      <Button size="lg" variant="ghost" className="w-full" onClick={copyLink}>{copied ? 'Link copied' : 'Copy ticket link'}</Button>
    </div>
  )
}
