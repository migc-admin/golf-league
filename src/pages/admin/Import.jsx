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
                status === 'error'    ? 'bg-red-50' :
                status === 'skipped'  ? 'bg-yellow-50' : ''
              }>
                <td className="px-3 py-2 font-medium whitespace-nowrap">
                  {status === 'imported' && <span className="text-green-700">✓ Imported</span>}
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
const PLAYERS_TEMPLATE = `first_name,last_name,email,handicap_index
Tony,Alvarez,tony@example.com,5.2
Dave,Kowalski,dave@example.com,11.1
Sarah,Okonkwo,sarah@example.com,18.7`

function ImportPlayers() {
  const [rows,      setRows]      = useState([])
  const [headers,   setHeaders]   = useState([])
  const [importing, setImporting] = useState(false)
  const [done,      setDone]      = useState(false)

  function handleFile(text) {
    setDone(false)
    const { headers, rows } = parseCSV(text)
    setHeaders(headers)
    setRows(rows.map(r => ({ ...r, _status: null, _message: null })))
  }

  async function runImport() {
    setImporting(true)
    const updated = [...rows]

    for (let i = 0; i < updated.length; i++) {
      const row = updated[i]
      const first = row['first_name']?.trim()
      const last  = row['last_name']?.trim()
      const email = row['email']?.trim() || null
      const hi    = parseFloat(row['handicap_index'])

      if (!first || !last) {
        updated[i] = { ...row, _status: 'error', _message: 'Missing name' }
        continue
      }

      // Check for duplicate email
      if (email) {
        const { data: existing } = await supabase
          .from('players').select('id').eq('email', email).single()
        if (existing) {
          updated[i] = { ...row, _status: 'skipped', _message: 'Email already exists' }
          continue
        }
      }

      const payload = { first_name: first, last_name: last }
      if (email) payload.email = email
      if (!isNaN(hi)) payload.handicap_index = hi  // stored in players for reference

      const { error } = await supabase.from('players').insert(payload)
      if (error) {
        updated[i] = { ...row, _status: 'error', _message: error.message }
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
    toast.success(`Done — ${imported} imported, ${skipped} skipped, ${errors} errors`)
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
          <div>first_name,last_name,email,handicap_index</div>
          <div className="text-gray-500">Tony,Alvarez,tony@example.com,5.2</div>
          <div className="text-gray-500">Dave,Kowalski,dave@example.com,11.1</div>
        </div>
        <ul className="mt-3 text-xs text-gray-500 space-y-1 list-disc list-inside">
          <li><strong>first_name</strong> and <strong>last_name</strong> are required</li>
          <li><strong>email</strong> is optional but used to prevent duplicates</li>
          <li><strong>handicap_index</strong> is optional here — you set it per event when adding to a roster</li>
          <li>Players already in the system (matching email) will be skipped</li>
        </ul>
      </Card>

      {/* Upload */}
      <Card>
        <CardHeader title="Step 2 — Upload your CSV" />
        <FileDropZone onFile={handleFile} />
      </Card>

      {/* Preview + import */}
      {rows.length > 0 && (
        <Card>
          <CardHeader
            title={`Step 3 — Review & Import (${rows.length} rows)`}
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
              ✓ {importedCount} player{importedCount !== 1 ? 's' : ''} added to your roster. You can now add them to events from the Players page.
            </p>
          )}
        </Card>
      )}
    </div>
  )
}

// ─── Tab 2: Import Course ──────────────────────────────────────────
const COURSE_TEMPLATE = `course_name,slope,rating,hole,par,yardage,stroke_index
Torrey Pines South,144,74.6,1,4,452,3
Torrey Pines South,144,74.6,2,4,388,9
Torrey Pines South,144,74.6,3,3,196,15
Torrey Pines South,144,74.6,4,4,490,7
Torrey Pines South,144,74.6,5,4,486,1
Torrey Pines South,144,74.6,6,3,148,17
Torrey Pines South,144,74.6,7,4,442,11
Torrey Pines South,144,74.6,8,5,566,5
Torrey Pines South,144,74.6,9,5,515,13
Torrey Pines South,144,74.6,10,4,415,6
Torrey Pines South,144,74.6,11,4,395,14
Torrey Pines South,144,74.6,12,3,178,18
Torrey Pines South,144,74.6,13,5,558,2
Torrey Pines South,144,74.6,14,4,371,10
Torrey Pines South,144,74.6,15,3,173,16
Torrey Pines South,144,74.6,16,4,370,12
Torrey Pines South,144,74.6,17,5,510,4
Torrey Pines South,144,74.6,18,4,450,8`

function ImportCourse() {
  const [rows,      setRows]      = useState([])
  const [headers,   setHeaders]   = useState([])
  const [importing, setImporting] = useState(false)
  const [done,      setDone]      = useState(false)
  const [preview,   setPreview]   = useState(null) // assembled course object

  function handleFile(text) {
    setDone(false)
    setPreview(null)
    const { headers, rows } = parseCSV(text)
    setHeaders(headers)
    setRows(rows)

    // Assemble preview
    if (rows.length === 18) {
      try {
        const assembled = assembleCourse(rows)
        setPreview(assembled)
      } catch (e) {
        toast.error(e.message)
      }
    }
  }

  function assembleCourse(rows) {
    if (rows.length !== 18) throw new Error('CSV must have exactly 18 hole rows')
    const sorted = [...rows].sort((a, b) => parseInt(a.hole) - parseInt(b.hole))

    const name   = sorted[0].course_name?.trim()
    const slope  = parseInt(sorted[0].slope)
    const rating = parseFloat(sorted[0].rating)
    if (!name)        throw new Error('Missing course_name')
    if (isNaN(slope)) throw new Error('Missing or invalid slope')
    if (isNaN(rating)) throw new Error('Missing or invalid rating')

    const par_per_hole  = sorted.map(r => parseInt(r.par))
    const yardage       = sorted.map(r => parseInt(r.yardage))
    const stroke_index  = sorted.map(r => parseInt(r.stroke_index))
    const hole_type     = par_per_hole.map(p => p === 3 ? 'par3' : p === 5 ? 'par5' : 'par4')
    const par           = par_per_hole.reduce((a, b) => a + b, 0)

    if (par_per_hole.some(isNaN))   throw new Error('Invalid par value in one or more holes')
    if (yardage.some(isNaN))        throw new Error('Invalid yardage in one or more holes')
    if (stroke_index.some(isNaN))   throw new Error('Invalid stroke_index in one or more holes')

    // Validate stroke_index is 1-18 with no duplicates
    const siSet = new Set(stroke_index)
    if (siSet.size !== 18 || Math.min(...stroke_index) !== 1 || Math.max(...stroke_index) !== 18) {
      throw new Error('stroke_index must be unique values 1–18')
    }

    return { name, slope, rating, par, par_per_hole, yardage, stroke_index, hole_type }
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

    const { error } = await supabase.from('courses').insert(preview)
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
          subtitle="One row per hole (18 rows required). course_name, slope, and rating repeat on every row."
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
          <div className="text-gray-500 mb-1"># course_template.csv</div>
          <div>course_name,slope,rating,hole,par,yardage,stroke_index</div>
          <div className="text-gray-500">Torrey Pines South,144,74.6,1,4,452,3</div>
          <div className="text-gray-500">Torrey Pines South,144,74.6,2,4,388,9</div>
          <div className="text-gray-500">... (18 rows total)</div>
        </div>
        <ul className="mt-3 text-xs text-gray-500 space-y-1 list-disc list-inside">
          <li><strong>slope</strong> — from the scorecard (e.g. 128)</li>
          <li><strong>rating</strong> — course rating e.g. 71.4</li>
          <li><strong>hole</strong> — 1 through 18</li>
          <li><strong>par</strong> — 3, 4, or 5</li>
          <li><strong>stroke_index</strong> — USGA handicap allocation, unique values 1–18 (1 = hardest hole)</li>
        </ul>
      </Card>

      {/* Upload */}
      <Card>
        <CardHeader title="Step 2 — Upload your CSV" />
        <FileDropZone onFile={handleFile} />
        {rows.length > 0 && rows.length !== 18 && (
          <p className="mt-3 text-sm text-red-600 font-medium">
            ✕ Found {rows.length} rows — need exactly 18 (one per hole).
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
          <div className="grid grid-cols-3 gap-4 text-sm mb-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1">Slope / Rating</div>
              <div className="font-bold text-gray-900">{preview.slope} / {preview.rating}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1">Total Par</div>
              <div className="font-bold text-gray-900">{preview.par}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1">Par 3 / 4 / 5</div>
              <div className="font-bold text-gray-900">
                {preview.par_per_hole.filter(p => p === 3).length} /&nbsp;
                {preview.par_per_hole.filter(p => p === 4).length} /&nbsp;
                {preview.par_per_hole.filter(p => p === 5).length}
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
                  <td className="px-2 py-2 text-left text-gray-500 font-medium">Yards</td>
                  {preview.yardage.map((y, i) => (
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
const ROSTER_TEMPLATE = `first_name,last_name,handicap_index,tournament_wins
Tony,Alvarez,5.2,0
Dave,Kowalski,11.1,1
Bob,Nguyen,15.3,0`

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
      .select('id, event_number, event_date, status, league:leagues(name), course:courses(name)')
      .neq('status', 'complete')
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

    // Load event course for course handicap calc
    const { data: ev } = await supabase
      .from('events')
      .select('course:courses(slope, rating, par)')
      .eq('id', eventId)
      .single()

    for (let i = 0; i < updated.length; i++) {
      const row   = updated[i]
      const first = row['first_name']?.trim()
      const last  = row['last_name']?.trim()
      const hi    = parseFloat(row['handicap_index'])
      const wins  = parseInt(row['tournament_wins'] ?? '0', 10) || 0

      if (!first || !last) {
        updated[i] = { ...row, _status: 'error', _message: 'Missing name' }
        continue
      }
      if (isNaN(hi)) {
        updated[i] = { ...row, _status: 'error', _message: 'Invalid handicap' }
        continue
      }

      // Find or create player
      let playerId = null
      const { data: match } = await supabase
        .from('players')
        .select('id')
        .ilike('first_name', first)
        .ilike('last_name', last)
        .limit(1)
        .single()

      if (match) {
        playerId = match.id
      } else {
        // Create the player
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

      // Check if already on event
      const { data: existing } = await supabase
        .from('event_players')
        .select('id')
        .eq('event_id', eventId)
        .eq('player_id', playerId)
        .single()

      if (existing) {
        updated[i] = { ...row, _status: 'skipped', _message: 'Already on roster' }
        setRows([...updated])
        continue
      }

      // Compute course handicap
      let course_handicap = null
      if (ev?.course) {
        const { slope, rating, par } = ev.course
        course_handicap = Math.round((hi * slope / 113) + (rating - par))
      }

      const { error } = await supabase.from('event_players').insert({
        event_id:              eventId,
        player_id:             playerId,
        handicap_index:        hi,
        adjusted_handicap_index: hi,
        course_handicap,
        tournament_wins_prior: wins,
      })

      if (error) {
        updated[i] = { ...row, _status: 'error', _message: error.message }
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
          <div>first_name,last_name,handicap_index,tournament_wins</div>
          <div className="text-gray-500">Tony,Alvarez,5.2,0</div>
          <div className="text-gray-500">Dave,Kowalski,11.1,1</div>
        </div>
        <ul className="mt-3 text-xs text-gray-500 space-y-1 list-disc list-inside">
          <li><strong>handicap_index</strong> — current USGA handicap index (e.g. 14.2)</li>
          <li><strong>tournament_wins</strong> — wins <em>this season</em> for handicap reduction (0, 1, or 2+)</li>
          <li>If a player matches by first + last name they are reused, not duplicated</li>
          <li>Course handicap is computed automatically from the event's course</li>
          <li>Run <strong>Flight Assignment</strong> in the event after import to assign flights</li>
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
              ✓ Done. Go to the event and run <strong>Flight Assignment</strong> to sort players into flights.
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
