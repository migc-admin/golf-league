/**
 * Trip costs and trip registration, on the trip admin page.
 *
 *   Costs                                                            [Edit costs]
 *   Planned headcount 10
 *   Rental house          $3,000 split 10 ways                 $300 / person
 *   PGA West (Fri Apr 2)  per person                           $185 / golfer
 *   Friday dinner         per person                           Included
 *   Full trip, every round ............................................ $485
 *
 *   Registration  (open switch, link, settings, pending sign-ups, per-round counts)
 *
 * People sign up for the TRIP (trip_registrations). Confirming a sign-up adds a traveler;
 * round rosters are never changed — the admin still builds each round's players.
 */
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import SectionCard from '../ui/SectionCard'
import Button, { ActionButton } from '../ui/Button'
import Modal from '../ui/Modal'
import Input from '../ui/Input'
import RegistrationCard from '../ui/RegistrationCard'
import { COST_KINDS, costItems, perPerson, priceBasis, quote, money, newCostItem } from '../../lib/tripCosts'

function roundLabel(r) {
  const d = r.event_date ? new Date(`${r.event_date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : null
  return `${r.name || r.course?.name || `Round ${r.event_number}`}${d ? ` · ${d}` : ''}`
}

// ─── Costs ───────────────────────────────────────────────────────────────────

// Rounds in date order, for every list of rounds on this page.
const byDate = rounds => [...rounds].sort((a, b) => String(a.event_date ?? '').localeCompare(String(b.event_date ?? '')))

export function TripCostsCard({ trip, rounds: unsorted, onSaved }) {
  const [editing, setEditing] = useState(false)
  const rounds = byDate(unsorted)
  const golfOrder = Object.fromEntries(rounds.map((r, i) => [r.id, i]))
  // Lodging and other costs first, then each round by date.
  const items = [...costItems(trip)].sort((a, b) => (a.kind === 'golf') - (b.kind === 'golf') || (golfOrder[a.event_id] ?? 0) - (golfOrder[b.event_id] ?? 0))
  const roundIds = rounds.map(r => r.id)
  const full = quote(trip, { golfing: true, roundIds })
  const roundById = Object.fromEntries(rounds.map(r => [r.id, r]))

  return (
    <SectionCard
      title="Costs"
      subtitle={trip.planned_headcount ? `Planned headcount ${trip.planned_headcount}` : 'What each person pays, shown on the sign-up form'}
      headerAction={<ActionButton variant="ghost" onClick={() => setEditing(true)}>{items.length ? 'Edit costs' : '+ Add costs'}</ActionButton>}
    >
      {items.length === 0 ? (
        <p className="text-sm text-ink-muted">Add lodging, a price for each round and anything else included, so people see their total when they sign up.</p>
      ) : (
        <>
          <ul className="divide-y divide-surface-border">
            {items.map(it => {
              const price = perPerson(it, trip.planned_headcount)
              const title = it.kind === 'golf' ? (roundById[it.event_id] ? roundLabel(roundById[it.event_id]) : 'Round (removed)') : (it.label || COST_KINDS[it.kind])
              return (
                <li key={it.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2">
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">{title}</span>
                    <span className="block text-xs text-ink-muted">{COST_KINDS[it.kind]} · {priceBasis(it, trip.planned_headcount)}</span>
                  </span>
                  <span className="text-sm font-bold tabular-nums text-ink">
                    {price == null ? '—' : money(price)}{price ? <span className="font-medium text-ink-muted"> / {it.kind === 'golf' ? 'golfer' : 'person'}</span> : null}
                  </span>
                </li>
              )
            })}
          </ul>
          <div className="mt-2 flex items-baseline justify-between border-t border-surface-border pt-3">
            <span className="text-sm text-ink-muted">Full trip, every round</span>
            <span className="text-base font-extrabold tabular-nums text-ink">{full.total ? money(full.total) : '$0'}</span>
          </div>
        </>
      )}
      <TripCostsModal open={editing} onClose={() => setEditing(false)} trip={trip} rounds={rounds} onSaved={() => { setEditing(false); onSaved() }} />
    </SectionCard>
  )
}

function ModeFields({ item, onChange, headcount }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 sm:grid-cols-[150px_minmax(0,1fr)_110px]">
      <select className="input" value={item.mode} onChange={e => onChange({ mode: e.target.value })} aria-label="How it's charged">
        <option value="per_person">Per person</option>
        <option value="split">Shared total, split</option>
      </select>
      <input className="input" type="number" min="0" step="0.01" inputMode="decimal" value={item.amount ?? ''} placeholder={item.mode === 'split' ? 'Total $' : 'Price $'}
        onChange={e => onChange({ amount: e.target.value })} aria-label={item.mode === 'split' ? 'Total amount' : 'Price per person'} />
      {item.mode === 'split' && (
        <input className="input col-span-2 sm:col-span-1" type="number" min="1" step="1" inputMode="numeric" value={item.split_count ?? ''} placeholder={headcount ? `÷ ${headcount}` : '÷ people'}
          onChange={e => onChange({ split_count: e.target.value === '' ? null : e.target.value })} aria-label="Split between how many people" />
      )}
    </div>
  )
}

function TripCostsModal({ open, onClose, trip, rounds, onSaved }) {
  const [headcount, setHeadcount] = useState('')
  const [items,     setItems]     = useState([])
  const [golf,      setGolf]      = useState({}) // event_id -> item
  const [saving,    setSaving]    = useState(false)

  useEffect(() => {
    if (!open) return
    const all = costItems(trip)
    setHeadcount(trip.planned_headcount ?? '')
    setItems(all.filter(i => i.kind !== 'golf').map(i => ({ ...i })))
    const g = {}
    rounds.forEach(r => {
      const found = all.find(i => i.kind === 'golf' && i.event_id === r.id)
      g[r.id] = found ? { ...found } : newCostItem({ kind: 'golf', event_id: r.id })
    })
    setGolf(g)
  }, [open])

  const hc = parseInt(headcount, 10) || null
  const patch = (id, p) => setItems(prev => prev.map(i => (i.id === id ? { ...i, ...p } : i)))
  const patchGolf = (eid, p) => setGolf(prev => ({ ...prev, [eid]: { ...prev[eid], ...p } }))

  const clean = i => ({
    ...i,
    label: (i.label ?? '').trim(),
    amount: Math.round((parseFloat(i.amount) || 0) * 100) / 100,
    split_count: i.mode === 'split' && parseInt(i.split_count, 10) > 0 ? parseInt(i.split_count, 10) : null,
  })

  async function save(e) {
    e.preventDefault()
    const other = items.filter(i => (i.label ?? '').trim() || i.amount !== '').map(clean)
    // A round is priced only once something was entered for it.
    const golfItems = rounds.map(r => golf[r.id]).filter(i => i && i.amount !== '' && i.amount != null).map(clean)
    setSaving(true)
    const { error } = await supabase.from('trips').update({ planned_headcount: hc, cost_items: [...other, ...golfItems] }).eq('id', trip.id)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Costs saved')
    onSaved()
  }

  return (
    <Modal open={open} onClose={onClose} title="Trip costs" maxWidth="max-w-2xl">
      <form onSubmit={save} className="space-y-5">
        <div>
          <Input label="Planned headcount" type="number" min="1" step="1" value={headcount} onChange={e => setHeadcount(e.target.value)} className="max-w-[160px]" />
          <p className="mt-1 text-xs text-ink-muted">Shared totals are divided by this, so each person's price stays the same as people sign up. An item can use its own number instead.</p>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Golf, per round</p>
          {rounds.length === 0 && <p className="text-sm text-ink-muted">Add rounds to the trip to price them.</p>}
          {rounds.map(r => {
            const it = golf[r.id]
            if (!it) return null
            const price = it.amount !== '' ? perPerson(clean(it), hc) : null
            return (
              <div key={r.id} className="space-y-2 rounded-sm border border-surface-border bg-white p-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-semibold text-ink">{roundLabel(r)}</span>
                  <span className="text-xs font-semibold tabular-nums text-ink-muted">{price == null ? 'Not priced' : price === 0 ? 'Included' : `${money(price)} / golfer`}</span>
                </div>
                <ModeFields item={it} headcount={hc} onChange={p => patchGolf(r.id, p)} />
              </div>
            )
          })}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Lodging and everything else</p>
          {items.map(it => {
            const price = it.amount !== '' ? perPerson(clean(it), hc) : null
            return (
              <div key={it.id} className="space-y-2 rounded-sm border border-surface-border bg-white p-3">
                <div className="flex items-center gap-2">
                  <select className="input w-[120px] shrink-0" value={it.kind} onChange={e => patch(it.id, { kind: e.target.value })} aria-label="Type">
                    <option value="lodging">Lodging</option>
                    <option value="other">Other</option>
                  </select>
                  <input className="input min-w-0 flex-1" value={it.label} placeholder={it.kind === 'lodging' ? 'e.g. Rental house' : 'e.g. Friday dinner, carts, shuttle'}
                    onChange={e => patch(it.id, { label: e.target.value })} aria-label="Name" />
                  <Button type="button" variant="ghost" size="sm" iconOnly label="Remove" className="shrink-0 hover:!text-red-600" onClick={() => setItems(prev => prev.filter(i => i.id !== it.id))}>✕</Button>
                </div>
                <ModeFields item={it} headcount={hc} onChange={p => patch(it.id, p)} />
                <p className="text-xs text-ink-muted">{price == null ? 'Enter an amount. $0 shows as "Included".' : price === 0 ? 'Included' : `${money(price)} / person`}</p>
              </div>
            )
          })}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setItems(prev => [...prev, newCostItem({ kind: 'lodging', mode: 'split' })])}>+ Lodging</Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => setItems(prev => [...prev, newCostItem({ kind: 'other' })])}>+ Other cost</Button>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>Save costs</Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Registration ────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  pending:   'bg-status-upcoming-bg text-status-upcoming-text',
  confirmed: 'bg-status-active-bg text-status-active-text',
  cancelled: 'bg-red-100 text-red-600',
}
const byName = (a, b) => `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`)

export function TripRegistrationCard({ trip, rounds: unsorted, orgSlug, onTripSaved, onTravelersChanged }) {
  const rounds = byDate(unsorted)
  const [regs,      setRegs]      = useState([])
  const [loading,   setLoading]   = useState(true)
  const [toggling,  setToggling]  = useState(false)
  const [settings,  setSettings]  = useState(false)
  const [showDone,  setShowDone]  = useState(false)

  const url = orgSlug ? `${window.location.origin}/${orgSlug}/trip/${trip.slug}/register` : ''

  async function load() {
    const { data } = await supabase.from('trip_registrations').select('*').eq('trip_id', trip.id).order('created_at', { ascending: false })
    setRegs(data ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [trip.id])

  async function setOpen(next) {
    setToggling(true)
    const { error } = await supabase.from('trips').update({ registration_open: next }).eq('id', trip.id)
    setToggling(false)
    if (error) { toast.error(error.message); return }
    toast.success(next ? 'Registration open' : 'Registration turned off')
    onTripSaved()
  }

  async function setStatus(id, status) {
    const { error } = await supabase.from('trip_registrations').update({ status }).eq('id', id)
    if (error) { toast.error(error.message); return }
    load()
  }

  async function remove(id) {
    if (!window.confirm('Remove this sign-up? This cannot be undone.')) return
    const { error } = await supabase.from('trip_registrations').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Sign-up removed')
    load()
  }

  // Confirm: add them as a traveler. A golfer becomes (or matches) a player in the org's
  // player list — the one thing trips share with leagues; a non-golfer is a name-only guest.
  // Add one person as a traveler. A golfer becomes (or matches) a player in the org's player
  // list — the one thing trips share with leagues; a non-golfer is a name-only guest traveler.
  // Returns the traveler id, or null after showing an error.
  async function addTraveler({ first, last, email, phone, golfing }) {
    first = first.trim(); last = last.trim()
    if (!golfing) {
      const { data, error } = await supabase.from('trip_travelers').insert({ trip_id: trip.id, org_id: trip.org_id, guest_name: `${first} ${last}` }).select('id').single()
      if (error) { toast.error('Could not add the traveler: ' + error.message); return null }
      return data.id
    }
    let playerId = null
    if (email?.trim()) {
      const { data } = await supabase.from('players').select('id').eq('org_id', trip.org_id).ilike('email', email.trim()).limit(1)
      playerId = data?.[0]?.id ?? null
    }
    if (!playerId) {
      const { data } = await supabase.from('players').select('id').eq('org_id', trip.org_id).ilike('first_name', first).ilike('last_name', last).limit(1)
      playerId = data?.[0]?.id ?? null
    }
    if (!playerId) {
      const { data, error } = await supabase.from('players')
        .insert({ first_name: first, last_name: last, email: email?.trim() || null, phone: phone?.trim() || null, org_id: trip.org_id })
        .select('id').single()
      if (error) { toast.error('Could not add the player: ' + error.message); return null }
      playerId = data.id
    }
    const { data: existing } = await supabase.from('trip_travelers').select('id').eq('trip_id', trip.id).eq('player_id', playerId).maybeSingle()
    if (existing) return existing.id
    const { data, error } = await supabase.from('trip_travelers').insert({ trip_id: trip.id, org_id: trip.org_id, player_id: playerId }).select('id').single()
    if (error) { toast.error('Could not add the traveler: ' + error.message); return null }
    return data.id
  }

  // Confirm a sign-up: the registrant, and their guest when they brought one, become travelers.
  async function confirm(reg) {
    const travelerId = await addTraveler({ first: reg.first_name, last: reg.last_name, email: reg.email, phone: reg.phone, golfing: reg.golfing })
    if (!travelerId) return
    let guest = reg.guest
    if (guest && !guest.traveler_id) {
      const guestTraveler = await addTraveler({ first: guest.first_name, last: guest.last_name, golfing: !!guest.golfing })
      if (!guestTraveler) return
      guest = { ...guest, traveler_id: guestTraveler }
    }
    const { error } = await supabase.from('trip_registrations').update({ status: 'confirmed', traveler_id: travelerId, guest }).eq('id', reg.id)
    if (error) { toast.error(error.message); return }
    toast.success(`${reg.first_name} ${reg.last_name}${guest ? ` and ${guest.first_name} ${guest.last_name}` : ''} added to travelers`)
    load()
    onTravelersChanged()
  }

  const pending   = regs.filter(r => r.status === 'pending').sort(byName)
  const confirmed = regs.filter(r => r.status === 'confirmed').sort(byName)
  const cancelled = regs.filter(r => r.status === 'cancelled').sort(byName)
  const active    = regs.filter(r => r.status !== 'cancelled')
  // Every person signed up, guests included, for the per-round and rental counts.
  const everyone  = active.flatMap(r => [r, ...(r.guest ? [{ ...r.guest, isGuest: true }] : [])])
  const roundName = Object.fromEntries(rounds.map(r => [r.id, r.name || r.course?.name || `Round ${r.event_number}`]))
  const noPayment = !trip.venmo_handle && !trip.paypal_link && !trip.zelle_handle

  function Row({ reg }) {
    const picked = (reg.round_ids ?? []).map(id => roundName[id]).filter(Boolean)
    return (
      <div className="space-y-1.5 rounded-sm border border-surface-border bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[reg.status]}`}>{reg.status}</span>
          <span className="text-sm font-semibold text-ink">{reg.first_name} {reg.last_name}</span>
          <span className="text-xs text-ink-muted">{reg.golfing ? 'Golfing' : 'Not golfing'}</span>
          {reg.quoted_total != null && <span className="ml-auto text-sm font-bold tabular-nums text-ink">{money(reg.quoted_total)}</span>}
        </div>
        {reg.golfing && <p className="text-xs text-ink-muted">{picked.length ? `Rounds: ${picked.join(', ')}` : 'No rounds picked'}</p>}
        {reg.staying != null && <p className="text-xs text-ink-muted">{reg.staying ? 'Staying in the rental' : 'Not staying in the rental'}</p>}
        {reg.guest && (
          <p className="text-xs text-ink-muted">
            <span className="font-semibold text-ink">+ Guest: {reg.guest.first_name} {reg.guest.last_name}</span>
            {' · '}{reg.guest.golfing ? `Golfing${(reg.guest.round_ids ?? []).length ? ` (${(reg.guest.round_ids ?? []).map(id => roundName[id]).filter(Boolean).join(', ')})` : ', no rounds picked'}` : 'Not golfing'}
            {reg.guest.staying != null && ` · ${reg.guest.staying ? 'staying in the rental' : 'not staying in the rental'}`}
          </p>
        )}
        {(reg.email || reg.phone) && <p className="text-xs text-ink-muted">{[reg.email, reg.phone].filter(Boolean).join(' · ')}</p>}
        {(reg.answers ?? []).filter(a => a.answer).map((a, i) => <p key={i} className="text-xs text-ink-muted"><span className="font-semibold">{a.label}:</span> {a.answer}{a.cost ? ` (+${money(a.cost)})` : ''}</p>)}
        {reg.notes && <p className="text-xs italic text-ink-muted">"{reg.notes}"</p>}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {reg.status === 'pending' && (
            <>
              <Button size="sm" variant="secondary" onClick={() => confirm(reg)}>Confirm + add traveler</Button>
              <Button size="sm" variant="ghost" onClick={() => setStatus(reg.id, 'cancelled')}>Cancel</Button>
            </>
          )}
          {reg.status === 'cancelled' && <Button size="sm" variant="secondary" onClick={() => setStatus(reg.id, 'pending')}>Restore</Button>}
          <Button size="sm" variant="danger" onClick={() => remove(reg.id)}>Remove</Button>
        </div>
      </div>
    )
  }

  return (
    <>
      <RegistrationCard
        id="trip-registration"
        place="trip"
        url={url}
        onCopy={() => { navigator.clipboard.writeText(url); toast.success('Link copied!') }}
        open={!!trip.registration_open}
        onToggleOpen={setOpen}
        toggling={toggling}
        pendingCount={loading ? null : pending.length}
        headerAction={<ActionButton variant="ghost" onClick={() => setSettings(true)}>Settings</ActionButton>}
        notice={noPayment ? 'No payment links set, so people won\'t see a payment button after signing up. Add Venmo, Zelle or PayPal in Settings.' : null}
      >
        {pending.map(r => <Row key={r.id} reg={r} />)}
      </RegistrationCard>

      {!loading && active.length > 0 && (
        <SectionCard title="Who signed up for which round" subtitle="From sign-ups (pending and confirmed). Rosters aren't changed; add golfers to each round yourself.">
          <ul className="divide-y divide-surface-border">
            {rounds.map(r => {
              const n = everyone.filter(x => x.golfing && (x.round_ids ?? []).includes(r.id))
              return (
                <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-x-4 py-2">
                  <span className="text-sm font-semibold text-ink">{roundLabel(r)}</span>
                  <span className="text-sm text-ink-muted">{n.length} golfer{n.length === 1 ? '' : 's'}{n.length ? `: ${n.sort(byName).map(x => `${x.first_name} ${x.last_name}${x.isGuest ? ' (guest)' : ''}`).join(', ')}` : ''}</span>
                </li>
              )
            })}
            <li className="flex justify-between py-2 text-sm"><span className="text-ink-muted">Not golfing</span><span className="text-ink-muted">{everyone.filter(x => !x.golfing).length}</span></li>
            {everyone.some(x => x.staying != null) && (
              <li className="flex justify-between py-2 text-sm"><span className="text-ink-muted">Staying in the rental</span><span className="text-ink-muted">{everyone.filter(x => x.staying === true).length} of {everyone.length}</span></li>
            )}
          </ul>
          {(confirmed.length > 0 || cancelled.length > 0) && (
            <div className="mt-3 border-t border-surface-border pt-3">
              <button type="button" className="inline-flex min-h-[44px] items-center text-sm font-semibold text-fairway-700 hover:underline" onClick={() => setShowDone(v => !v)}>
                {showDone ? 'Hide' : 'Show'} confirmed ({confirmed.length}) and cancelled ({cancelled.length})
              </button>
              {showDone && <div className="mt-2 space-y-2">{[...confirmed, ...cancelled].map(r => <Row key={r.id} reg={r} />)}</div>}
            </div>
          )}
        </SectionCard>
      )}

      <TripRegistrationSettingsModal open={settings} onClose={() => setSettings(false)} trip={trip} onSaved={() => { setSettings(false); onTripSaved() }} />
    </>
  )
}

function TripRegistrationSettingsModal({ open, onClose, trip, onSaved }) {
  const [spots,     setSpots]     = useState('')
  const [venmo,     setVenmo]     = useState('')
  const [paypal,    setPaypal]    = useState('')
  const [zelle,     setZelle]     = useState('')
  const [questions, setQuestions] = useState([])
  const [askGuest,  setAskGuest]  = useState(false)
  const [saving,    setSaving]    = useState(false)

  useEffect(() => {
    if (!open) return
    setAskGuest(!!trip.ask_guest)
    setSpots(trip.registration_spots ?? '')
    setVenmo(trip.venmo_handle ?? '')
    setPaypal(trip.paypal_link ?? '')
    setZelle(trip.zelle_handle ?? '')
    const q = Array.isArray(trip.custom_questions) ? trip.custom_questions : []
    setQuestions(q.length ? q.map(x => ({ type: 'text', cost: '', ...x, cost: x.cost ?? '' })) : [{ label: '', required: false, type: 'text', cost: '' }])
  }, [open])

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('trips').update({
      registration_spots: parseInt(spots, 10) > 0 ? parseInt(spots, 10) : null,
      venmo_handle:       venmo.trim().replace(/^@/, '') || null,
      paypal_link:        paypal.trim() || null,
      zelle_handle:       zelle.trim() || null,
      ask_guest:          askGuest,
      custom_questions:   questions.filter(q => q.label.trim()).map(q => ({
        label: q.label.trim(),
        required: !!q.required,
        type: q.type === 'yes_no' ? 'yes_no' : 'text',
        // A cost is only for a Yes/No question, added to the total once on Yes.
        cost: q.type === 'yes_no' && parseFloat(q.cost) > 0 ? Math.round(parseFloat(q.cost) * 100) / 100 : null,
      })),
    }).eq('id', trip.id)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Registration settings saved')
    onSaved()
  }

  return (
    <Modal open={open} onClose={onClose} title="Registration settings" maxWidth="max-w-xl">
      <form onSubmit={save} className="space-y-5">
        <div>
          <Input label="Spots" type="number" min="1" step="1" value={spots} onChange={e => setSpots(e.target.value)} className="max-w-[160px]" placeholder="No limit" />
          <p className="mt-1 text-xs text-ink-muted">Sign-ups close on the trip page once this many travelers are confirmed. Leave blank for no limit.</p>
        </div>

        <div className="space-y-3 rounded-sm bg-surface-container px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Payment links (optional)</p>
          <Input label="Venmo handle" value={venmo} onChange={e => setVenmo(e.target.value)} placeholder="@yourhandle" />
          <Input label="Zelle (phone or email)" value={zelle} onChange={e => setZelle(e.target.value)} placeholder="555-555-5555 or name@email.com" />
          <Input label="PayPal.me link" value={paypal} onChange={e => setPaypal(e.target.value)} placeholder="https://paypal.me/yourhandle" />
          <p className="text-xs text-ink-muted">After signing up, people get buttons to pay their quoted total.</p>
        </div>

        <div className="space-y-2 rounded-sm bg-surface-container px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Sign-up questions</p>
          <p className="text-xs text-ink-muted">
            Always asked: Golfing? and which rounds (each with its price){trip.lodging?.type === 'rental' ? ', and "Are you staying in the rental property?" (the lodging share is charged only on Yes)' : ''}.
          </p>
          <label className="flex min-h-[44px] cursor-pointer items-start gap-2 rounded-sm border border-surface-border bg-white px-3 py-2.5">
            <input type="checkbox" checked={askGuest} onChange={e => setAskGuest(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-fairway-700" />
            <span>
              <span className="block text-sm font-semibold text-ink">Ask "Are you bringing a guest?"</span>
              <span className="block text-xs text-ink-muted">On Yes, the guest gets their own name, golf rounds{trip.lodging?.type === 'rental' ? ' and rental stay' : ''}, priced just like a person.</span>
            </span>
          </label>
          {questions.map((q, i) => {
            const set = p => setQuestions(prev => prev.map((x, j) => (j === i ? { ...x, ...p } : x)))
            return (
              <div key={i} className="space-y-2 rounded-sm border border-surface-border bg-white p-3">
                <div className="flex items-center gap-2">
                  <input type="text" value={q.label} className="input min-w-0 flex-1" placeholder={q.type === 'yes_no' ? 'e.g. Joining the Saturday spa day?' : 'e.g. Arrival flight? Dietary needs?'}
                    onChange={e => set({ label: e.target.value })} aria-label="Question" />
                  <Button type="button" variant="ghost" size="sm" iconOnly label="Remove" className="shrink-0 hover:!text-red-600" onClick={() => setQuestions(prev => prev.filter((_, j) => j !== i))}>✕</Button>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <select className="input w-[150px]" value={q.type ?? 'text'} onChange={e => set({ type: e.target.value })} aria-label="Answer type">
                    <option value="text">Text answer</option>
                    <option value="yes_no">Yes / No</option>
                  </select>
                  {q.type === 'yes_no' && (
                    <label className="flex items-center gap-1.5 text-sm text-ink-muted">
                      Cost if Yes $
                      <input type="number" min="0" step="0.01" inputMode="decimal" value={q.cost ?? ''} placeholder="none" className="input w-[100px]"
                        onChange={e => set({ cost: e.target.value })} />
                    </label>
                  )}
                  <label className="flex cursor-pointer items-center gap-1 text-xs text-ink-muted">
                    <input type="checkbox" checked={!!q.required} className="accent-fairway-600" onChange={e => set({ required: e.target.checked })} />
                    Required
                  </label>
                </div>
              </div>
            )
          })}
          <Button type="button" variant="secondary" size="sm" onClick={() => setQuestions(prev => [...prev, { label: '', required: false, type: 'text', cost: '' }])}>+ Add question</Button>
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>Save</Button>
        </div>
      </form>
    </Modal>
  )
}
