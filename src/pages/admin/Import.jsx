/**
 * CSV Import Page
 * Three tabs:
 *   1. Players  — upload a CSV of players to add to the global roster
 *   2. Course   — upload a CSV of hole-by-hole course data
 *   3. Roster   — bulk-add existing players to an event with handicaps
 *
 * CSV formats are shown inline as downloadable templates.
 */

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import Card, { CardHeader } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import toast from 'react-hot-toast'

const TABS = ['Players', 'Course', 'Event Roster']

export default function Import() {
  const [activeTab, setActiveTab] = useState('Players')

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Import Data</h1>
        <p className="text-gray-500 text-sm mt-1">
          Upload CSV files to bulk-load players, courses, and event rosters.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-1">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab ? 'tab-active' : 'tab-inactive'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'Players'      && <ImportPlayers />}
      {activeTab === 'Course'       && <ImportCourse />}
      {activeTab === 'Event Roster' && <ImportRoster />}
    </div>
  )
}

// ─── Shared helpers ───────────────────────────────────────────────

function parseCSV(text) {
  const lines = text.trim().split('\n').filter(l => l.trim())
  if (lines.length < 2) return { headers: [], rows: [] }
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  const rows = lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']))
  })
  return { headers, rows }
}

function downloadTemplate(filename, content) {
  const blob = new Blob([content], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function FileDropZone({ onFile, accept = '.csv' }) {
  const [dragging, setDragging] = useState(false)

  function handleFile(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = e => onFile(e.target.result, file.name)
    reader.readAsText(file)
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
      className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
        dragging ? 'border-fairway-500 bg-fairway-50' : 'border-gray-300 bg-gray-50 hover:border-gray-400'
      }`}
    >
      <div className="text-3xl mb-2">📂</div>
      <p className="text-sm font-medium text-gray-700">Drag & drop your CSV here</p>
      <p className="text-xs text-gray-400 mt-1">or</p>
      <label className="mt-3 inline-block cursor-pointer">
        <span className="px-4 py-2 bg-fairway-700 text-white text-sm font-semibold rounded-lg hover:bg-fairway-800 transition-colors">
          Choose File
        </span>
        <input
          type="file"
          accept={accept}
          className="hidden"
          onChange={e => handleFile(e.target.files[0])}
        />
      </label>
    </div>
  )
}

function PreviewTable({ headers, rows, statusKey = '_status', messageKey = '_message' }) {
  if (!rows.length) return null
  const displayHeaders = headers.filter(h => h !== statusKey && h !== messageKey)

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-3 py-2 text-left font-semibold text-gray-500">Status</th>
            {displayHeaders.map(h => (
              <th key={h} className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, i) => {
            const status  = row[statusKey]
            const message = row[messageKey]
            return (
              <tr key={i} className={
                status === 'imported' ? 'bg-green-50' :
                status === 'matched'  ? 'bg-blue-50'  :
                status === 'error'    ? 'bg-red-50'   :
                status === 'skipped'  ? 'bg-yellow-50' : ''
              }>
                <td className="px-3 py-2 font-medium whitespace-nowrap">
                  {status === 'imported' && <span className="text-green-700">✓ Created</span>}
                  {status === 'matched'  && <span className="text-blue-700">↗ Matched existing</span>}
                  {status === 'error'    && <span className="text-red-600">✕ {message}</span>}
                  {status === 'skipped'  && <span className="text-yellow-700">⚠ {message}</span>}
                  {!status               && <span className="text-gray-400">—</span>}
                </td>
                {displayHeaders.map(h => (
                  <td key={h} className="px-3 py-2 text-gray-700 whitespace-nowrap">{row[h]}</td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Tab 1: Import Players ─────────────────────────────────────────
const PLAYERS_TEMPLATE = `first_name,last_name,email,handicap_index,course_handicap,flight,role
Tony,Alvarez,tony@example.com,5.2,6,A,player
Dave,Kowalski,dave@example.com,11.1,13,A,player
Bob,Nguyen,bob@example.com,15.3,,B,player
Sarah,Okonkwo,sarah@example.com,18.7,22,B,admin`

function ImportPlayers() {
  const { user } = useAuth()
  const [rows,      setRows]      = useState([])
  const [headers,   setHeaders]   = useState([])
  const [importing, setImporting] = useState(false)
  const [done,      setDone]      = useState(false)
  const [events,    setEvents]    = useState([])
  const [eventId,   setEventId]   = useState('')
  const [orgId,     setOrgId]     = useState(null)

  useEffect(() => {
    supabase
      .from('events')
      .select('id, event_number, event_date, status, league:leagues(name), course:courses(name, slope, rating, par)')
      .order('event_date', { ascending: false })
      .then(({ data }) => setEvents(data ?? []))
    async function fetchOrgId() {
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
      if (profile?.org_id) setOrgId(profile.org_id)
    }
    fetchOrgId()
  }, [user])

  function handleFile(text) {
    setDone(false)
    const { headers, rows } = parseCSV(text)
    setHeaders(headers)
    setRows(rows.map(r => ({ ...r, _status: null, _message: null })))
  }

  async function runImport() {
    setImporting(true)
    const updated = [...rows]

    // Load event course for course handicap calc if event selected
    let eventCourse = null
    if (eventId) {
      const ev = events.find(e => e.id === eventId)
      eventCourse = ev?.course ?? null
    }

    for (let i = 0; i < updated.length; i++) {
      const row     = updated[i]
      const first   = row['first_name']?.trim()
      const last    = row['last_name']?.trim()
      const email   = row['email']?.trim() || null
      const hi      = parseFloat(row['handicap_index'])
      const chRaw   = row['course_handicap']?.trim()
      const chManual = chRaw !== '' && chRaw != null ? parseInt(chRaw, 10) : null
      const flight  = row['flight']?.trim().toUpperCase() || null
      const role    = row['role']?.trim().toLowerCase() || 'player'

      if (!first || !last) {
        updated[i] = { ...row, _status: 'error', _message: 'Missing name' }
        continue
      }
      if (flight && flight !== 'A' && flight !== 'B') {
        updated[i] = { ...row, _status: 'error', _message: 'Flight must be A or B' }
        continue
      }

      // 1. Match by email
      let playerId   = null
      let wasMatched = false
      if (email) {
        const { data: byEmail } = await supabase
          .from('players').select('id').eq('email', email).maybeSingle()
        if (byEmail) { playerId = byEmail.id; wasMatched = true }
      }

      // 2. Match by first + last name (case-insensitive) if no email match
      if (!playerId) {
        const { data: byName } = await supabase
          .from('players')
          .select('id')
          .ilike('first_name', first)
          .ilike('last_name', last)
          .limit(1)
          .maybeSingle()
        if (byName) { playerId = byName.id; wasMatched = true }
      }

      // 3. Create new player only if no match found
      if (!playerId) {
        const payload = { first_name: first, last_name: last, intended_role: role, org_id: orgId }
        if (email) payload.email = email

        const { data: newP, error } = await supabase.from('players').insert(payload).select('id').single()
        if (error) {
          updated[i] = { ...row, _status: 'error', _message: error.message }
          setRows([...updated])
          continue
        }
        playerId = newP.id

        // Apply role to matching profile
        if (email && role !== 'player') {
          const { data: prof } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle()
          if (prof) await supabase.from('profiles').update({ role }).eq('id', prof.id)
        }
      }

      // Enroll in event if selected
      if (eventId && playerId) {
        const { data: alreadyOn } = await supabase
          .from('event_players').select('id').eq('event_id', eventId).eq('player_id', playerId).single()

        if (!alreadyOn) {
          // Use provided course_handicap if present; otherwise auto-calc from slope/rating/par
          let course_handicap = chManual
          if (course_handicap === null && eventCourse && !isNaN(hi)) {
            const { slope, rating, par } = eventCourse
            course_handicap = Math.round((hi * slope / 113) + (rating - par))
          }
          await supabase.from('event_players').insert({
            event_id:                eventId,
            player_id:               playerId,
            handicap_index:          isNaN(hi) ? null : hi,
            adjusted_handicap_index: isNaN(hi) ? null : hi,
            course_handicap,
            ...(flight ? { flight } : {}),
          })
        }
      }

      updated[i] = { ...row, _status: wasMatched ? 'matched' : 'imported', _message: null }
      setRows([...updated])
    }

    setImporting(false)
    setDone(true)
    const imported = updated.filter(r => r._status === 'imported').length
    const matched  = updated.filter(r => r._status === 'matched').length
    const skipped  = updated.filter(r => r._status === 'skipped').length
    const errors   = updated.filter(r => r._status === 'error').length
    toast.success(`Done — ${imported} created, ${matched} matched existing, ${skipped} skipped, ${errors} errors`)
  }

  const importedCount = rows.filter(r => r._status === 'imported').length
  const pendingCount  = rows.filter(r => !r._status).length

  return (
    <div className="space-y-5">
      {/* Template */}
      <Card>
        <CardHeader
          title="Step 1 — Download the template"
          subtitle="Fill it in with your players, then upload below"
          action={
            <Button
              size="sm" variant="secondary"
              onClick={() => downloadTemplate('players_template.csv', PLAYERS_TEMPLATE)}
            >
              ⬇ Template
            </Button>
          }
        />
        <div className="bg-gray-900 rounded-lg px-4 py-3 text-xs text-gray-300 font-mono overflow-x-auto">
          <div className="text-gray-500 mb-1"># players_template.csv</div>
          <div>first_name,last_name,email,handicap_index,course_handicap,flight,role</div>
          <div className="text-gray-500">Tony,Alvarez,tony@example.com,5.2,6,A,player</div>
          <div className="text-gray-500">Dave,Kowalski,dave@example.com,11.1,13,A,admin</div>
          <div className="text-gray-500">Bob,Nguyen,bob@example.com,15.3,,B,player</div>
        </div>
        <ul className="mt-3 text-xs text-gray-500 space-y-1 list-disc list-inside">
          <li><strong>first_name</strong> and <strong>last_name</strong> are required</li>
          <li><strong>email</strong> is optional — used for matching first, then falls back to first+last name match. No duplicate profiles are created either way.</li>
          <li><strong>handicap_index</strong> — USGA index (e.g. 14.2). Used to auto-calculate course handicap if <code>course_handicap</code> is not provided.</li>
          <li><strong>course_handicap</strong> — optional. If provided, used directly (e.g. after win deductions). If blank, auto-calculated from slope/rating/par.</li>
          <li><strong>flight</strong> — A or B. Only applied when enrolling in an event (optional).</li>
          <li><strong>role</strong> — <code>player</code> (default), <code>admin</code>, or <code>scorekeeper</code></li>
          <li>Players already in the system (matched by email or name) are reused — not duplicated. They are still enrolled in the selected event if one is chosen.</li>
        </ul>
      </Card>

      {/* Optional: enroll in event */}
      <Card>
        <CardHeader
          title="Step 2 — Enroll in an event (optional)"
          subtitle="If selected, players will also be added to this event with flight and course handicap."
        />
        <select
          value={eventId}
          onChange={e => setEventId(e.target.value)}
          className="input bg-white"
        >
          <option value="">Skip — add to roster only</option>
          {events.map(ev => (
            <option key={ev.id} value={ev.id}>
              {ev.league?.name} — Event #{ev.event_number} · {ev.course?.name} · {formatDate(ev.event_date)}
            </option>
          ))}
        </select>
      </Card>

      {/* Upload */}
      <Card>
        <CardHeader title="Step 3 — Upload your CSV" />
        <FileDropZone onFile={handleFile} />
      </Card>

      {/* Preview + import */}
      {rows.length > 0 && (
        <Card>
          <CardHeader
            title={`Step 4 — Review & Import (${rows.length} rows)`}
            action={
              !done && pendingCount > 0 && (
                <Button onClick={runImport} loading={importing}>
                  Import {pendingCount} Players
                </Button>
              )
            }
          />
          <PreviewTable headers={[...headers, '_status']} rows={rows} />
          {done && importedCount > 0 && (
            <p className="mt-3 text-sm text-fairway-700 font-medium">
              ✓ {importedCount} player{importedCount !== 1 ? 's' : ''} added to your roster
              {eventId ? ' and enrolled in the selected event' : ''}.
            </p>
          )}
        </Card>
      )}
    </div>
  )
}

// ─── Tab 2: Import Course ──────────────────────────────────────────
const COURSE_TEMPLATE = `course_name,tee,slope,rating,hole,par,yardage,stroke_index
Torrey Pines South,Back,144,74.6,1,4,452,3
Torrey Pines South,Back,144,74.6,2,4,388,9
Torrey Pines South,Back,144,74.6,3,3,196,15
Torrey Pines South,Back,144,74.6,4,4,490,7
Torrey Pines South,Back,144,74.6,5,4,486,1
Torrey Pines South,Back,144,74.6,6,3,148,17
Torrey Pines South,Back,144,74.6,7,4,442,11
Torrey Pines South,Back,144,74.6,8,5,566,5
Torrey Pines South,Back,144,74.6,9,5,515,13
Torrey Pines South,Back,144,74.6,10,4,415,6
Torrey Pines South,Back,144,74.6,11,4,395,14
Torrey Pines South,Back,144,74.6,12,3,178,18
Torrey Pines South,Back,144,74.6,13,5,558,2
Torrey Pines South,Back,144,74.6,14,4,371,10
Torrey Pines South,Back,144,74.6,15,3,173,16
Torrey Pines South,Back,144,74.6,16,4,370,12
Torrey Pines South,Back,144,74.6,17,5,510,4
Torrey Pines South,Back,144,74.6,18,4,450,8
Torrey Pines South,Middle,130,72.1,1,4,420,3
Torrey Pines South,Middle,130,72.1,2,4,365,9
Torrey Pines South,Middle,130,72.1,3,3,175,15
Torrey Pines South,Middle,130,72.1,4,4,460,7
Torrey Pines South,Middle,130,72.1,5,4,455,1
Torrey Pines South,Middle,130,72.1,6,3,130,17
Torrey Pines South,Middle,130,72.1,7,4,415,11
Torrey Pines South,Middle,130,72.1,8,5,540,5
Torrey Pines South,Middle,130,72.1,9,5,490,13
Torrey Pines South,Middle,130,72.1,10,4,390,6
Torrey Pines South,Middle,130,72.1,11,4,370,14
Torrey Pines South,Middle,130,72.1,12,3,160,18
Torrey Pines South,Middle,130,72.1,13,5,530,2
Torrey Pines South,Middle,130,72.1,14,4,350,10
Torrey Pines South,Middle,130,72.1,15,3,155,16
Torrey Pines South,Middle,130,72.1,16,4,345,12
Torrey Pines South,Middle,130,72.1,17,5,485,4
Torrey Pines South,Middle,130,72.1,18,4,425,8`

function ImportCourse() {
  const { user } = useAuth()
  const [rows,      setRows]      = useState([])
  const [headers,   setHeaders]   = useState([])
  const [importing, setImporting] = useState(false)
  const [done,      setDone]      = useState(false)
  const [preview,   setPreview]   = useState(null) // assembled course object
  const [orgId,     setOrgId]     = useState(null)

  useEffect(() => {
    async function fetchOrgId() {
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
      if (profile?.org_id) setOrgId(profile.org_id)
    }
    fetchOrgId()
  }, [user])

  function handleFile(text) {
    setDone(false)
    setPreview(null)
    const { headers, rows } = parseCSV(text)
    setHeaders(headers)
    setRows(rows)

    if (rows.length > 0 && rows.length % 18 === 0) {
      try {
        const assembled = assembleCourse(rows)
        setPreview(assembled)
      } catch (e) {
        toast.error(e.message)
      }
    }
  }

  function assembleCourse(rows) {
    if (rows.length === 0 || rows.length % 18 !== 0) {
      throw new Error(`Row count must be a multiple of 18 (got ${rows.length}). One tee = 18 rows.`)
    }

    const name = rows[0].course_name?.trim()
    if (!name) throw new Error('Missing course_name')

    // Group rows by tee name (or use a default 'Back' if no tee column)
    const teeGroups = {}
    const teeOrder  = []
    for (const row of rows) {
      const teeName = row['tee']?.trim() || 'Back'
      if (!teeGroups[teeName]) { teeGroups[teeName] = []; teeOrder.push(teeName) }
      teeGroups[teeName].push(row)
    }

    // Use first tee group for par/stroke_index (same for all tees)
    const firstTee = teeOrder[0]
    const base = [...teeGroups[firstTee]].sort((a, b) => parseInt(a.hole) - parseInt(b.hole))

    if (base.length !== 18) throw new Error(`Each tee must have exactly 18 rows (${firstTee} has ${base.length})`)

    const par_per_hole = base.map(r => parseInt(r.par))
    const stroke_index = base.map(r => parseInt(r.stroke_index))
    const hole_type    = par_per_hole.map(p => p === 3 ? 'par3' : p === 5 ? 'par5' : 'par4')
    const par          = par_per_hole.reduce((a, b) => a + b, 0)

    if (par_per_hole.some(isNaN)) throw new Error('Invalid par value in one or more holes')
    if (stroke_index.some(isNaN)) throw new Error('Invalid stroke_index in one or more holes')

    const siSet = new Set(stroke_index)
    if (siSet.size !== 18 || Math.min(...stroke_index) !== 1 || Math.max(...stroke_index) !== 18) {
      throw new Error('stroke_index must be unique values 1–18')
    }

    // Build tees array
    const tees = teeOrder.map(teeName => {
      const group  = [...teeGroups[teeName]].sort((a, b) => parseInt(a.hole) - parseInt(b.hole))
      const slope  = parseInt(group[0].slope)
      const rating = parseFloat(group[0].rating)
      if (isNaN(slope))  throw new Error(`Missing or invalid slope for tee "${teeName}"`)
      if (isNaN(rating)) throw new Error(`Missing or invalid rating for tee "${teeName}"`)
      const yardage = group.map(r => parseInt(r.yardage))
      if (yardage.some(isNaN)) throw new Error(`Invalid yardage for tee "${teeName}"`)
      return { name: teeName, color: '', slope, rating, yardage }
    })

    // Primary tee (index 0) used for backward-compat fields
    const primary = tees[0]

    return {
      name, par, par_per_hole, stroke_index, hole_type,
      slope:   primary.slope,
      rating:  primary.rating,
      yardage: primary.yardage,
      tees,
    }
  }

  async function runImport() {
    if (!preview) return
    setImporting(true)

    // Check for duplicate course name
    const { data: existing } = await supabase
      .from('courses').select('id').eq('name', preview.name).single()

    if (existing) {
      toast.error(`A course named "${preview.name}" already exists.`)
      setImporting(false)
      return
    }

    const { error } = await supabase.from('courses').insert({ ...preview, org_id: orgId })
    setImporting(false)

    if (error) {
      toast.error(error.message)
    } else {
      setDone(true)
      toast.success(`Course "${preview.name}" imported successfully`)
    }
  }

  return (
    <div className="space-y-5">
      {/* Template */}
      <Card>
        <CardHeader
          title="Step 1 — Download the template"
          subtitle="One row per hole per tee. For multiple tees, repeat all 18 holes for each tee set."
          action={
            <Button
              size="sm" variant="secondary"
              onClick={() => downloadTemplate('course_template.csv', COURSE_TEMPLATE)}
            >
              ⬇ Template
            </Button>
          }
        />
        <div className="bg-gray-900 rounded-lg px-4 py-3 text-xs text-gray-300 font-mono overflow-x-auto">
          <div className="text-gray-500 mb-1"># course_template.csv — 2 tees × 18 holes = 36 rows</div>
          <div>course_name,tee,slope,rating,hole,par,yardage,stroke_index</div>
          <div className="text-gray-500">Torrey Pines South,Back,144,74.6,1,4,452,3</div>
          <div className="text-gray-500">... (18 Back rows, then 18 Middle rows)</div>
          <div className="text-gray-500">Torrey Pines South,Middle,130,72.1,1,4,420,3</div>
          <div className="text-gray-500">...</div>
        </div>
        <ul className="mt-3 text-xs text-gray-500 space-y-1 list-disc list-inside">
          <li><strong>tee</strong> — tee name, e.g. Back, Middle, Forward. Repeat all 18 rows per tee.</li>
          <li><strong>slope</strong> and <strong>rating</strong> are per-tee (repeat the same value for all 18 rows of that tee)</li>
          <li><strong>hole</strong> — 1 through 18</li>
          <li><strong>par</strong> and <strong>stroke_index</strong> are course-level (same across all tees)</li>
          <li><strong>stroke_index</strong> — USGA handicap allocation, unique values 1–18 (1 = hardest hole)</li>
          <li>Single tee: just 18 rows. Three tees: 54 rows total.</li>
        </ul>
      </Card>

      {/* Upload */}
      <Card>
        <CardHeader title="Step 2 — Upload your CSV" />
        <FileDropZone onFile={handleFile} />
        {rows.length > 0 && rows.length % 18 !== 0 && (
          <p className="mt-3 text-sm text-red-600 font-medium">
            ✕ Found {rows.length} rows — must be a multiple of 18 (18 per tee).
          </p>
        )}
      </Card>

      {/* Preview */}
      {preview && !done && (
        <Card>
          <CardHeader
            title={`Step 3 — Review "${preview.name}"`}
            action={
              <Button onClick={runImport} loading={importing}>
                Import Course
              </Button>
            }
          />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1">Tees</div>
              <div className="font-bold text-gray-900">{preview.tees.length}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1">Total Par</div>
              <div className="font-bold text-gray-900">{preview.par}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 col-span-2">
              <div className="text-xs text-gray-400 mb-1">Tee Sets</div>
              <div className="font-bold text-gray-900 text-xs space-y-0.5">
                {preview.tees.map(t => (
                  <div key={t.name}>{t.name}: Slope {t.slope} / Rating {t.rating}</div>
                ))}
              </div>
            </div>
          </div>

          {/* Hole grid */}
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-xs text-center">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-2 py-2 text-left text-gray-500 font-semibold">Hole</th>
                  {preview.par_per_hole.map((_, i) => (
                    <th key={i} className="px-2 py-2 text-gray-500 font-semibold">{i + 1}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="px-2 py-2 text-left text-gray-500 font-medium">Par</td>
                  {preview.par_per_hole.map((p, i) => (
                    <td key={i} className="px-2 py-2 font-bold text-gray-800">{p}</td>
                  ))}
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-2 py-2 text-left text-gray-500 font-medium">{preview.tees[0]?.name} Yds</td>
                  {preview.tees[0]?.yardage.map((y, i) => (
                    <td key={i} className="px-2 py-2 text-gray-600">{y}</td>
                  ))}
                </tr>
                <tr>
                  <td className="px-2 py-2 text-left text-gray-500 font-medium">S.I.</td>
                  {preview.stroke_index.map((s, i) => (
                    <td key={i} className="px-2 py-2 text-gray-600">{s}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {done && (
        <div className="bg-fairway-50 border border-fairway-200 rounded-xl p-4 text-sm text-fairway-800 font-medium">
          ✓ Course imported. Go to <strong>Courses</strong> in the sidebar to verify, or create an event using this course.
        </div>
      )}
    </div>
  )
}

// ─── Tab 3: Import Event Roster ────────────────────────────────────
const ROSTER_TEMPLATE = `first_name,last_name,handicap_index,flight,course_handicap
Tony,Alvarez,5.2,A,6
Dave,Kowalski,11.1,A,13
Bob,Nguyen,15.3,B,18
Sarah,Okonkwo,18.7,B,22`

function ImportRoster() {
  const [events,    setEvents]    = useState([])
  const [eventId,   setEventId]   = useState('')
  const [rows,      setRows]      = useState([])
  const [headers,   setHeaders]   = useState([])
  const [importing, setImporting] = useState(false)
  const [done,      setDone]      = useState(false)

  useEffect(() => {
    supabase
      .from('events')
      .select('id, event_number, event_date, status, league:leagues(name), course:courses(name, slope, rating, par)')
      .order('event_date', { ascending: false })
      .then(({ data }) => setEvents(data ?? []))
  }, [])

  function handleFile(text) {
    setDone(false)
    const { headers, rows } = parseCSV(text)
    setHeaders(headers)
    setRows(rows.map(r => ({ ...r, _status: null, _message: null })))
  }

  async function runImport() {
    if (!eventId) { toast.error('Select an event first'); return }
    setImporting(true)
    const updated = [...rows]

    // Load event + course for auto course handicap calc fallback
    const ev = events.find(e => e.id === eventId)
    const eventCourse = ev?.course ?? null

    for (let i = 0; i < updated.length; i++) {
      const row    = updated[i]
      const first  = row['first_name']?.trim()
      const last   = row['last_name']?.trim()
      const hi     = row['handicap_index']?.trim() !== '' ? parseFloat(row['handicap_index']) : null
      const flight = row['flight']?.trim().toUpperCase() || null
      const chRaw  = row['course_handicap']?.trim()
      const chManual = chRaw !== '' && chRaw != null ? parseInt(chRaw, 10) : null

      if (!first || !last) {
        updated[i] = { ...row, _status: 'error', _message: 'Missing name' }
        continue
      }
      if (hi === null && chManual === null) {
        updated[i] = { ...row, _status: 'error', _message: 'Need handicap_index or course_handicap' }
        continue
      }
      if (flight && flight !== 'A' && flight !== 'B') {
        updated[i] = { ...row, _status: 'error', _message: 'Flight must be A or B' }
        continue
      }

      // Match player by name — avoid duplicates
      let playerId = null
      const { data: match } = await supabase
        .from('players')
        .select('id')
        .ilike('first_name', first)
        .ilike('last_name', last)
        .limit(1)
        .maybeSingle()

      if (match) {
        playerId = match.id
      } else {
        // New player — add to roster
        const { data: newP, error: pErr } = await supabase
          .from('players')
          .insert({ first_name: first, last_name: last })
          .select('id')
          .single()
        if (pErr) {
          updated[i] = { ...row, _status: 'error', _message: pErr.message }
          setRows([...updated])
          continue
        }
        playerId = newP.id
      }

      // Skip if already on this event
      const { data: alreadyOn } = await supabase
        .from('event_players')
        .select('id')
        .eq('event_id', eventId)
        .eq('player_id', playerId)
        .maybeSingle()

      if (alreadyOn) {
        updated[i] = { ...row, _status: 'skipped', _message: 'Already on roster' }
        setRows([...updated])
        continue
      }

      // Course handicap: use CSV value if provided, otherwise auto-calc from course
      let course_handicap = chManual
      if (course_handicap === null && hi !== null && eventCourse) {
        const { slope, rating, par } = eventCourse
        course_handicap = Math.round((hi * slope / 113) + (rating - par))
      }

      const { error: epErr } = await supabase.from('event_players').insert({
        event_id:                eventId,
        player_id:               playerId,
        handicap_index:          hi ?? null,
        adjusted_handicap_index: hi ?? null,
        course_handicap,
        ...(flight ? { flight } : {}),
      })

      if (epErr) {
        updated[i] = { ...row, _status: 'error', _message: `Roster error: ${epErr.message}` }
      } else {
        updated[i] = { ...row, _status: 'imported', _message: null }
      }

      setRows([...updated])
    }

    setImporting(false)
    setDone(true)
    const imported = updated.filter(r => r._status === 'imported').length
    const skipped  = updated.filter(r => r._status === 'skipped').length
    const errors   = updated.filter(r => r._status === 'error').length
    toast.success(`Done — ${imported} added, ${skipped} skipped, ${errors} errors`)
  }

  const pendingCount = rows.filter(r => !r._status).length

  return (
    <div className="space-y-5">
      {/* Template */}
      <Card>
        <CardHeader
          title="Step 1 — Download the template"
          subtitle="One row per player. Players not in the system will be created automatically."
          action={
            <Button
              size="sm" variant="secondary"
              onClick={() => downloadTemplate('roster_template.csv', ROSTER_TEMPLATE)}
            >
              ⬇ Template
            </Button>
          }
        />
        <div className="bg-gray-900 rounded-lg px-4 py-3 text-xs text-gray-300 font-mono overflow-x-auto">
          <div className="text-gray-500 mb-1"># roster_template.csv</div>
          <div>first_name,last_name,handicap_index,flight,course_handicap</div>
          <div className="text-gray-500">Tony,Alvarez,5.2,A,6</div>
          <div className="text-gray-500">Dave,Kowalski,11.1,A,13</div>
          <div className="text-gray-500">Bob,Nguyen,15.3,B,18</div>
        </div>
        <ul className="mt-3 text-xs text-gray-500 space-y-1 list-disc list-inside">
          <li><strong>first_name</strong> and <strong>last_name</strong> are required</li>
          <li><strong>handicap_index</strong> — USGA index (e.g. 14.2). Used to auto-calculate course handicap if <code>course_handicap</code> is not provided.</li>
          <li><strong>course_handicap</strong> — optional. If provided, used directly (e.g. after win deductions). If blank, auto-calculated from slope/rating/par.</li>
          <li><strong>flight</strong> — A or B (optional)</li>
          <li>Players matched by first + last name are reused — no duplicates created</li>
          <li>New players not found in the system are added to the roster automatically</li>
        </ul>
      </Card>

      {/* Select event */}
      <Card>
        <CardHeader title="Step 2 — Select the event" />
        {events.length === 0
          ? <p className="text-sm text-gray-400">No upcoming or active events found. Create an event first.</p>
          : (
          <select
            value={eventId}
            onChange={e => setEventId(e.target.value)}
            className="input bg-white"
          >
            <option value="">Select event…</option>
            {events.map(ev => (
              <option key={ev.id} value={ev.id}>
                {ev.league?.name} — Event #{ev.event_number} · {ev.course?.name} · {formatDate(ev.event_date)}
              </option>
            ))}
          </select>
        )}
      </Card>

      {/* Upload */}
      <Card>
        <CardHeader title="Step 3 — Upload your roster CSV" />
        <FileDropZone onFile={handleFile} />
      </Card>

      {/* Preview + import */}
      {rows.length > 0 && (
        <Card>
          <CardHeader
            title={`Step 4 — Review & Import (${rows.length} players)`}
            action={
              !done && pendingCount > 0 && (
                <Button onClick={runImport} loading={importing} disabled={!eventId}>
                  Add {pendingCount} to Event
                </Button>
              )
            }
          />
          {!eventId && (
            <p className="mb-3 text-sm text-orange-600">Select an event above before importing.</p>
          )}
          <PreviewTable headers={[...headers, '_status']} rows={rows} />
          {done && (
            <p className="mt-3 text-sm text-fairway-700 font-medium">
              ✓ Done. Review players in the event's Players &amp; Flights tab to verify handicaps and flights.
            </p>
          )}
        </Card>
      )}
    </div>
  )
}

function formatDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}
