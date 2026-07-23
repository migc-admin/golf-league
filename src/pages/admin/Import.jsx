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

const TABS = ['Players', 'Course', 'Event Roster', 'Past Results']

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
      {activeTab === 'Past Results' && <ImportPastResults />}
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

const MAX_FILE_BYTES = 3 * 1024 * 1024 // 3MB

function FileDropZone({ onFile, accept = '.csv' }) {
  const [dragging, setDragging] = useState(false)

  function handleFile(file) {
    if (!file) return
    if (file.size > MAX_FILE_BYTES) {
      alert(`File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum allowed size is 3 MB.`)
      return
    }
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
John,Smith,john@example.com,5.2,6,A,player
Mike,Johnson,mike@example.com,11.1,13,A,player
Tom,Williams,tom@example.com,15.3,,B,player
Chris,Davis,chris@example.com,18.7,22,B,admin`

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
          <div className="text-gray-500">John,Smith,john@example.com,5.2,6,A,player</div>
          <div className="text-gray-500">Mike,Johnson,mike@example.com,11.1,13,A,admin</div>
          <div className="text-gray-500">Tom,Williams,tom@example.com,15.3,,B,player</div>
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
John,Smith,5.2,A,6
Mike,Johnson,11.1,A,13
Tom,Williams,15.3,B,18
Chris,Davis,18.7,B,22`

function ImportRoster() {
  const [events,       setEvents]       = useState([])
  const [eventId,      setEventId]      = useState('')
  const [rows,         setRows]         = useState([])
  const [headers,      setHeaders]      = useState([])
  const [importing,    setImporting]    = useState(false)
  const [done,         setDone]         = useState(false)
  const [checking,     setChecking]     = useState(false)
  // conflicts: array of { rowIndex, csvName, exactMatch, fuzzyMatches, resolution: 'exact'|'new'|playerId }
  const [conflicts,    setConflicts]    = useState(null)

  useEffect(() => {
    supabase
      .from('events')
      .select('id, event_number, event_date, status, league:leagues(name), course:courses(name, slope, rating, par)')
      .order('event_date', { ascending: false })
      .then(({ data }) => setEvents(data ?? []))
  }, [])

  function handleFile(text) {
    setDone(false)
    setConflicts(null)
    const { headers, rows } = parseCSV(text)
    setHeaders(headers)
    setRows(rows.map(r => ({ ...r, _status: null, _message: null })))
  }

  async function checkDuplicates() {
    setChecking(true)
    const { data: allPlayers } = await supabase
      .from('players')
      .select('id, first_name, last_name')

    const detected = []

    for (let i = 0; i < rows.length; i++) {
      const row   = rows[i]
      const first = row['first_name']?.trim().toLowerCase()
      const last  = row['last_name']?.trim().toLowerCase()
      if (!first || !last) continue

      const exactMatch  = allPlayers?.find(p =>
        p.first_name.toLowerCase() === first && p.last_name.toLowerCase() === last
      ) ?? null

      // Fuzzy: same last name, first name starts with same letter (catches Mike/Michael)
      const fuzzyMatches = exactMatch ? [] : (allPlayers?.filter(p =>
        p.last_name.toLowerCase() === last &&
        p.first_name.toLowerCase() !== first &&
        p.first_name[0]?.toLowerCase() === first[0]
      ) ?? [])

      if (fuzzyMatches.length > 0) {
        detected.push({
          rowIndex:     i,
          csvName:      `${row['first_name']} ${row['last_name']}`,
          exactMatch:   null,
          fuzzyMatches,
          resolution:   'new', // default: create new
        })
      }
      // exact matches are fine — handled automatically
    }

    setConflicts(detected)
    setChecking(false)

    if (detected.length === 0) {
      toast.success('No conflicts found — ready to import.')
    }
  }

  function setResolution(rowIndex, value) {
    setConflicts(prev => prev.map(c => c.rowIndex === rowIndex ? { ...c, resolution: value } : c))
  }

  async function runImport() {
    if (!eventId) { toast.error('Select an event first'); return }
    setImporting(true)
    const updated = [...rows]

    const ev = events.find(e => e.id === eventId)
    const eventCourse = ev?.course ?? null

    // Build resolution map from conflicts
    const resolutionMap = {}
    if (conflicts) {
      for (const c of conflicts) {
        resolutionMap[c.rowIndex] = c.resolution
      }
    }

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

      let playerId   = null
      let wasMatched = false

      const resolution = resolutionMap[i]

      if (resolution && resolution !== 'new') {
        // User picked an existing player to link to
        playerId   = resolution
        wasMatched = true
      } else {
        // Exact name match
        const { data: match } = await supabase
          .from('players')
          .select('id')
          .ilike('first_name', first)
          .ilike('last_name', last)
          .limit(1)
          .maybeSingle()

        if (match) {
          playerId   = match.id
          wasMatched = true
        } else {
          // Create new player
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
      }

      // Skip if already on this event
      const { data: alreadyOn } = await supabase
        .from('event_players')
        .select('id')
        .eq('event_id', eventId)
        .eq('player_id', playerId)
        .maybeSingle()

      if (alreadyOn) {
        // Update handicap/flight instead of skipping
        await supabase.from('event_players').update({
          ...(hi !== null ? { handicap_index: hi, adjusted_handicap_index: hi } : {}),
          ...(chManual !== null ? { course_handicap: chManual } : {}),
          ...(flight ? { flight } : {}),
        }).eq('event_id', eventId).eq('player_id', playerId)
        updated[i] = { ...row, _status: 'matched', _message: null }
        setRows([...updated])
        continue
      }

      // Course handicap auto-calc
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
        updated[i] = { ...row, _status: wasMatched ? 'matched' : 'imported', _message: null }
      }

      setRows([...updated])
    }

    setImporting(false)
    setDone(true)
    const imported = updated.filter(r => r._status === 'imported').length
    const matched  = updated.filter(r => r._status === 'matched').length
    const errors   = updated.filter(r => r._status === 'error').length
    toast.success(`Done — ${imported} created, ${matched} matched/updated, ${errors} errors`)
  }

  const pendingCount = rows.filter(r => !r._status).length
  const hasConflicts = conflicts !== null && conflicts.length > 0

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
          <div className="text-gray-500">John,Smith,5.2,A,6</div>
          <div className="text-gray-500">Mike,Johnson,11.1,A,13</div>
          <div className="text-gray-500">Tom,Williams,15.3,B,18</div>
        </div>
        <ul className="mt-3 text-xs text-gray-500 space-y-1 list-disc list-inside">
          <li><strong>first_name</strong> and <strong>last_name</strong> are required</li>
          <li><strong>handicap_index</strong> — USGA index. Used to auto-calculate course handicap if not provided.</li>
          <li><strong>course_handicap</strong> — optional. If blank, auto-calculated from slope/rating/par.</li>
          <li><strong>flight</strong> — A or B (optional)</li>
          <li>Exact name matches are reused automatically. Fuzzy matches (e.g. Mike vs Michael) are flagged for review.</li>
          <li>Players already on the event will have their handicap and flight updated.</li>
        </ul>
      </Card>

      {/* Select event */}
      <Card>
        <CardHeader title="Step 2 — Select the event" />
        {events.length === 0
          ? <p className="text-sm text-gray-400">No events found. Create an event first.</p>
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

      {/* Conflict check */}
      {rows.length > 0 && conflicts === null && (
        <Card>
          <CardHeader
            title={`Step 4 — Check for duplicates (${rows.length} rows)`}
            subtitle="Scans your CSV against existing players to catch name variations before importing."
            action={
              <Button onClick={checkDuplicates} loading={checking}>
                Check for Duplicates
              </Button>
            }
          />
        </Card>
      )}

      {/* Resolve conflicts */}
      {hasConflicts && (
        <Card>
          <CardHeader
            title={`Step 5 — Resolve ${conflicts.length} possible duplicate${conflicts.length !== 1 ? 's' : ''}`}
            subtitle="These CSV names closely match existing players. Choose what to do with each."
          />
          <div className="space-y-3">
            {conflicts.map(c => (
              <div key={c.rowIndex} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">CSV: <span className="text-amber-700">{c.csvName}</span></p>
                    <p className="text-xs text-gray-500 mt-0.5">Similar name{c.fuzzyMatches.length !== 1 ? 's' : ''} found in roster</p>
                  </div>
                  <select
                    value={c.resolution}
                    onChange={e => setResolution(c.rowIndex, e.target.value)}
                    className="input bg-white text-sm"
                    style={{ minWidth: 220 }}
                  >
                    <option value="new">Create new player ({c.csvName})</option>
                    {c.fuzzyMatches.map(p => (
                      <option key={p.id} value={p.id}>
                        Link to existing: {p.first_name} {p.last_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* No conflicts found */}
      {conflicts !== null && conflicts.length === 0 && !done && (
        <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 font-medium">
          ✓ No duplicate conflicts found.
        </div>
      )}

      {/* Import */}
      {conflicts !== null && !done && (
        <Card>
          <CardHeader
            title={`Step ${hasConflicts ? 6 : 5} — Import (${rows.length} players)`}
            action={
              pendingCount > 0 && (
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
        </Card>
      )}

      {done && (
        <div className="bg-fairway-50 border border-fairway-200 rounded-xl p-4 text-sm text-fairway-800 font-medium">
          ✓ Done. Review players in the event's Players &amp; Flights tab to verify handicaps and flights.
        </div>
      )}
    </div>
  )
}

// ─── Tab 4: Import Past Results ───────────────────────────────────
const PAST_RESULTS_TEMPLATE = `event_name,event_date,course_name,tee,league_name,player_first,player_last,flight,course_handicap,gross_front,gross_back,putts
Event 1 - Sample Course,2024-04-15,Sample Golf Club,Yellow,,John,Smith,A,10,34,37,31
Event 1 - Sample Course,2024-04-15,Sample Golf Club,Yellow,,Mike,Johnson,A,15,36,38,32
Event 1 - Sample Course,2024-04-15,Sample Golf Club,Yellow,,Tom,Williams,A,7,34,42,29`

/**
 * Distribute a 9-hole total across 9 holes proportionally by par.
 * Returns array of 9 integers that sum to the total.
 */
function distributeByPar(total, pars) {
  const parSum = pars.reduce((a, b) => a + b, 0)
  const scores = pars.map(p => Math.floor(total * p / parSum))
  let remainder = total - scores.reduce((a, b) => a + b, 0)
  // Add remainder to highest-par holes first
  const indices = [...pars.map((p, i) => ({ p, i }))].sort((a, b) => b.p - a.p)
  for (const { i } of indices) {
    if (remainder <= 0) break
    scores[i]++
    remainder--
  }
  return scores
}

function ImportPastResults() {
  const { user } = useAuth()
  const [rows,      setRows]      = useState([])
  const [headers,   setHeaders]   = useState([])
  const [importing, setImporting] = useState(false)
  const [done,      setDone]      = useState(false)
  const [orgId,     setOrgId]     = useState(null)
  const [leagues,   setLeagues]   = useState([])
  const [leagueId,  setLeagueId]  = useState('')
  const [results,   setResults]   = useState([]) // per-event import results

  useEffect(() => {
    async function load() {
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
      if (profile?.org_id) {
        setOrgId(profile.org_id)
        const { data: lgs } = await supabase.from('leagues').select('id, name').eq('org_id', profile.org_id).order('name')
        setLeagues(lgs ?? [])
      }
    }
    load()
  }, [user])

  function handleFile(text) {
    setDone(false)
    setResults([])
    const { headers, rows } = parseCSV(text)
    setHeaders(headers)
    setRows(rows.map(r => ({ ...r, _status: null, _message: null })))
  }

  async function runImport() {
    if (!leagueId) { toast.error('Select a league first'); return }
    setImporting(true)
    try {

    // Group rows by event_name + event_date
    const eventGroups = {}
    for (const row of rows) {
      const key = `${row.event_name?.trim()}||${row.event_date?.trim()}`
      if (!eventGroups[key]) eventGroups[key] = []
      eventGroups[key].push(row)
    }

    const eventResults = []

    for (const [key, eventRows] of Object.entries(eventGroups)) {
      const firstRow   = eventRows[0]
      const eventName  = firstRow.event_name?.trim()
      const eventDate  = firstRow.event_date?.trim()
      const courseName = firstRow.course_name?.trim()
      const teeName    = firstRow.tee?.trim() || null

      if (!eventName || !eventDate || !courseName) {
        eventResults.push({ event: eventName || '(unnamed)', status: 'error', message: 'Missing event_name, event_date, or course_name' })
        continue
      }

      // Look up course
      const { data: course } = await supabase
        .from('courses')
        .select('id, slope, rating, par, par_per_hole, stroke_index, tees')
        .ilike('name', courseName)
        .limit(1)
        .maybeSingle()

      if (!course) {
        eventResults.push({ event: eventName, status: 'error', message: `Course "${courseName}" not found. Add it via Import → Course first.` })
        continue
      }

      // Resolve tee slope/rating
      let slope  = course.slope
      let rating = course.rating
      if (teeName && course.tees?.length) {
        const tee = course.tees.find(t => t.name?.toLowerCase() === teeName.toLowerCase())
        if (tee) { slope = tee.slope; rating = tee.rating }
      }

      const parPerHole   = course.par_per_hole   // array[18]
      const strokeIndex  = course.stroke_index    // array[18]
      const frontPars    = parPerHole?.slice(0, 9) ?? []
      const backPars     = parPerHole?.slice(9, 18) ?? []

      // Check if event already exists (match by league + date + course)
      const { data: existingEvent } = await supabase
        .from('events')
        .select('id')
        .eq('league_id', leagueId)
        .eq('event_date', eventDate)
        .eq('course_id', course.id)
        .maybeSingle()

      let eventId = existingEvent?.id

      if (!eventId) {
        // Get next event number for this league
        const { data: lastEvent } = await supabase
          .from('events')
          .select('event_number')
          .eq('league_id', leagueId)
          .order('event_number', { ascending: false })
          .limit(1)
          .maybeSingle()

        const eventNumber = (lastEvent?.event_number ?? 0) + 1

        const { data: newEvent, error: evErr } = await supabase
          .from('events')
          .insert({
            league_id:    leagueId,
            course_id:    course.id,
            event_date:   eventDate,
            event_number: eventNumber,
            status:       'complete',
          })
          .select('id')
          .single()

        if (evErr) {
          eventResults.push({ event: eventName, status: 'error', message: evErr.message })
          continue
        }
        eventId = newEvent.id
      }

      // Import each player row
      let playerOk = 0, playerErr = 0
      for (const row of eventRows) {
        const first  = row.player_first?.trim()
        const last   = row.player_last?.trim()
        const flight = row.flight?.trim().toUpperCase() || null
        const ch     = row.course_handicap?.trim() ? parseInt(row.course_handicap) : null
        const front  = parseInt(row.gross_front)
        const back   = parseInt(row.gross_back)
        const putts  = row.putts?.trim() ? parseInt(row.putts) : null

        if (!first || !last || isNaN(front) || isNaN(back)) {
          playerErr++
          continue
        }

        // Match or create player
        let playerId = null
        const { data: match } = await supabase
          .from('players').select('id')
          .ilike('first_name', first).ilike('last_name', last)
          .limit(1).maybeSingle()

        if (match) {
          playerId = match.id
        } else {
          const { data: newP, error: pErr } = await supabase
            .from('players')
            .insert({ first_name: first, last_name: last, org_id: orgId })
            .select('id').single()
          if (pErr) { playerErr++; continue }
          playerId = newP.id
        }

        // Upsert event_player (handicap_index is NOT NULL — use ch or 0 as fallback)
        const { data: ep, error: epErr } = await supabase
          .from('event_players')
          .upsert({
            event_id:                eventId,
            player_id:               playerId,
            handicap_index:          ch ?? 0,
            adjusted_handicap_index: ch ?? 0,
            course_handicap:         ch,
            flight,
          }, { onConflict: 'event_id,player_id' })
          .select('id').single()

        if (epErr) { playerErr++; continue }

        // Delete any existing scores for this player/event (re-import safe)
        await supabase.from('scores').delete()
          .eq('event_id', eventId).eq('player_id', playerId)

        // Distribute front/back totals across holes proportionally by par
        const frontScores = frontPars.length === 9 ? distributeByPar(front, frontPars) : Array(9).fill(Math.round(front / 9))
        const backScores  = backPars.length  === 9 ? distributeByPar(back, backPars)   : Array(9).fill(Math.round(back  / 9))
        const allScores   = [...frontScores, ...backScores]

        const scoreRows = allScores.map((gross, idx) => ({
          event_id:   eventId,
          player_id:  playerId,
          hole_number: idx + 1,
          gross_score: gross,
          putts:       idx === 0 && putts != null ? putts : null, // store total putts on h1 for now
        }))

        const { error: scErr } = await supabase.from('scores').insert(scoreRows)
        if (scErr) { playerErr++; continue }

        playerOk++
      }

      eventResults.push({
        event:   eventName,
        date:    eventDate,
        status:  playerErr === 0 ? 'imported' : playerOk > 0 ? 'partial' : 'error',
        message: `${playerOk} players imported${playerErr > 0 ? `, ${playerErr} errors` : ''}`,
        eventId,
      })
    }

    setResults(eventResults)
    setDone(true)
    const ok = eventResults.filter(r => r.status !== 'error').length
    toast.success(`Done — ${ok} of ${eventResults.length} event${eventResults.length !== 1 ? 's' : ''} imported`)
    } catch (err) {
      toast.error(err.message ?? 'Import failed — check console for details')
      console.error('[PastResults import]', err)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-5">

      {/* What this does */}
      <div className="rounded-xl px-5 py-4 text-sm" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
        <p className="font-semibold text-green-900 mb-1">Import historical tournament results</p>
        <p className="text-green-800 leading-relaxed">
          Use this to bring in past events managed outside Scorify. Provide front 9 and back 9 gross totals per player —
          hole-by-hole scores are not required. Imported events are marked complete and contribute to TGL standings and season stats.
        </p>
      </div>

      {/* Template */}
      <Card>
        <CardHeader
          title="Step 1 — Download the template"
          subtitle="One row per player per event. Multiple events can be in a single file."
          action={
            <Button size="sm" variant="secondary"
              onClick={() => downloadTemplate('past_results_template.csv', PAST_RESULTS_TEMPLATE)}>
              ⬇ Template
            </Button>
          }
        />
        <div className="bg-gray-900 rounded-lg px-4 py-3 text-xs text-gray-300 font-mono overflow-x-auto">
          <div className="text-gray-500 mb-1"># past_results_template.csv</div>
          <div>event_name,event_date,course_name,tee,league_name,player_first,player_last,flight,course_handicap,gross_front,gross_back,putts</div>
          <div className="text-gray-500">Event 1 - Sample Course,2024-04-15,Sample Golf Club,Yellow,,John,Smith,A,10,34,37,31</div>
          <div className="text-gray-500">Event 1 - Sample Course,2024-04-15,Sample Golf Club,Yellow,,Mike,Johnson,A,15,36,38,32</div>
        </div>
        <ul className="mt-3 text-xs text-gray-500 space-y-1 list-disc list-inside">
          <li><strong>event_name</strong> and <strong>event_date</strong> (YYYY-MM-DD) identify the event. Multiple players with the same event_name+date are grouped into one event.</li>
          <li><strong>course_name</strong> must match a course already in Scorify (use Import → Course to add it first).</li>
          <li><strong>tee</strong> — optional tee name (e.g. Yellow, White) for slope/rating lookup.</li>
          <li><strong>flight</strong> — A or B. Leave blank if no flights used.</li>
          <li><strong>course_handicap</strong> — the course handicap assigned for that tournament (not the USGA index). Used directly for net score calculation.</li>
          <li><strong>gross_front</strong> / <strong>gross_back</strong> — required. Scores are distributed proportionally across holes by par.</li>
          <li><strong>putts</strong> — optional round total. Stored for stats but not distributed per hole.</li>
          <li>Players not in your roster will be created automatically.</li>
        </ul>
      </Card>

      {/* League select */}
      <Card>
        <CardHeader title="Step 2 — Select the league" subtitle="Imported events will be added to this league." />
        {leagues.length === 0
          ? <p className="text-sm text-gray-400">No leagues found. Create a league first.</p>
          : (
            <select value={leagueId} onChange={e => setLeagueId(e.target.value)} className="input bg-white">
              <option value="">Select league…</option>
              {leagues.map(lg => <option key={lg.id} value={lg.id}>{lg.name}</option>)}
            </select>
          )}
      </Card>

      {/* Upload */}
      <Card>
        <CardHeader title="Step 3 — Upload your CSV" />
        <FileDropZone onFile={handleFile} />
        {rows.length > 0 && (
          <p className="mt-3 text-sm text-gray-500">{rows.length} player rows loaded.</p>
        )}
      </Card>

      {/* Preview */}
      {rows.length > 0 && !done && (
        <Card>
          <CardHeader
            title={`Step 4 — Review & Import`}
            subtitle={`${rows.length} player rows across ${new Set(rows.map(r => r.event_name?.trim() + r.event_date?.trim())).size} event(s)`}
            action={
              <Button onClick={runImport} loading={importing} disabled={!leagueId}>
                Import Results
              </Button>
            }
          />
          {!leagueId && (
            <p className="mb-3 text-sm text-orange-600">Select a league above before importing.</p>
          )}
          <PreviewTable headers={headers} rows={rows} />
        </Card>
      )}

      {/* Results summary */}
      {done && results.length > 0 && (
        <Card>
          <CardHeader title="Import complete" />
          <div className="divide-y divide-gray-100">
            {results.map((r, i) => (
              <div key={i} className="flex items-start justify-between gap-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{r.event}</p>
                  {r.date && <p className="text-xs text-gray-400">{formatDate(r.date)}</p>}
                </div>
                <div className="text-right shrink-0">
                  {r.status === 'imported' && <span className="text-xs font-medium text-green-700">✓ {r.message}</span>}
                  {r.status === 'partial'  && <span className="text-xs font-medium text-amber-600">⚠ {r.message}</span>}
                  {r.status === 'error'    && <span className="text-xs font-medium text-red-600">✕ {r.message}</span>}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-gray-400">
            Imported events appear in Admin → Leagues as completed events. Go to Team Play → lock each event to include in TGL standings.
          </p>
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
