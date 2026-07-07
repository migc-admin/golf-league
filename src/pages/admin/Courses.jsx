import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import toast from 'react-hot-toast'
import Card, { CardHeader } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'

const DEFAULT_SI = [1,3,5,7,9,11,13,15,17,2,4,6,8,10,12,14,16,18]

const DEFAULT_TEES = [
  { name: 'Back',    color: 'Black', slope: 130, rating: 72.0 },
  { name: 'Middle',  color: 'White', slope: 120, rating: 70.0 },
  { name: 'Forward', color: 'Red',   slope: 110, rating: 68.0 },
]

const TEE_COLORS = ['Black', 'Blue', 'White', 'Gold', 'Red', 'Green']

function emptyHoles(numTees = 3) {
  return Array.from({ length: 18 }, (_, i) => ({
    hole:         i + 1,
    par:          4,
    stroke_index: DEFAULT_SI[i],
    yardages:     Array(numTees).fill(380),  // one yardage per tee
  }))
}

export default function Courses() {
  const { user } = useAuth()
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal,   setModal]   = useState(false)
  const [editing, setEditing] = useState(null)
  const [orgId,   setOrgId]   = useState(null)

  async function load() {
    const { data } = await supabase
      .from('courses')
      .select('id, name, slope, rating, par, tees, created_at')
      .order('name')
    setCourses(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    async function fetchOrgId() {
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
      if (profile?.org_id) setOrgId(profile.org_id)
    }
    fetchOrgId()
  }, [user])

  async function handleDelete(id) {
    if (!confirm('Delete this course?')) return
    const { error } = await supabase.from('courses').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Course deleted'); load() }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Courses</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage course details, tees, and hole data</p>
        </div>
        <Button onClick={() => { setEditing(null); setModal(true) }}>+ New Course</Button>
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[0,1,2].map(i => <div key={i} className="h-20 bg-gray-200 rounded-xl" />)}
        </div>
      ) : courses.length === 0 ? (
        <Card className="text-center py-12">
          <div className="text-4xl mb-3">🏌️</div>
          <p className="text-gray-500 font-medium">No courses yet</p>
          <Button className="mt-4" onClick={() => { setEditing(null); setModal(true) }}>Add Course</Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {courses.map(c => {
            const tees = c.tees ?? []
            return (
              <Card key={c.id} className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-gray-900">{c.name}</div>
                  <div className="text-sm text-gray-500">
                    Par {c.par}
                    {tees.length > 0
                      ? ` · ${tees.map(t => `${t.name} (${t.slope}/${t.rating})`).join(' · ')}`
                      : ` · Slope ${c.slope} · Rating ${c.rating}`
                    }
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => { setEditing(c); setModal(true) }}>Edit</Button>
                  <Button variant="danger"    size="sm" onClick={() => handleDelete(c.id)}>Delete</Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <CourseModal
        open={modal}
        onClose={() => setModal(false)}
        editing={editing}
        orgId={orgId}
        onSaved={() => { setModal(false); load() }}
      />
    </div>
  )
}

function CourseModal({ open, onClose, editing, orgId, onSaved }) {
  const [name,    setName]    = useState('')
  const [tees,    setTees]    = useState(DEFAULT_TEES)
  const [holes,   setHoles]   = useState(() => emptyHoles(3))
  const [saving,  setSaving]  = useState(false)
  const [activeTeeIdx, setActiveTeeIdx] = useState(0)  // which tee to preview yardage for

  useEffect(() => {
    if (!open) return
    if (editing) {
      supabase.from('courses').select('*').eq('id', editing.id).single()
        .then(({ data }) => {
          if (!data) return
          setName(data.name)

          // If course has tees data, use it. Otherwise migrate legacy slope/rating/yardage
          let teesData = data.tees ?? []
          let holesData

          if (teesData.length > 0) {
            // Build holes from tees yardages
            holesData = Array.from({ length: 18 }, (_, i) => ({
              hole:         i + 1,
              par:          data.par_per_hole[i],
              stroke_index: data.stroke_index[i],
              yardages:     teesData.map(t => t.yardage?.[i] ?? 380),
            }))
          } else {
            // Legacy: single tee — migrate to Back tee
            teesData = [{
              name:   'Back',
              color:  'Black',
              slope:  data.slope,
              rating: data.rating,
            }]
            holesData = Array.from({ length: 18 }, (_, i) => ({
              hole:         i + 1,
              par:          data.par_per_hole[i],
              stroke_index: data.stroke_index[i],
              yardages:     [data.yardage[i]],
            }))
          }

          setTees(teesData)
          setHoles(holesData)
          setActiveTeeIdx(0)
        })
    } else {
      setName('')
      setTees(DEFAULT_TEES.map(t => ({ ...t })))
      setHoles(emptyHoles(3))
      setActiveTeeIdx(0)
    }
  }, [editing, open])

  function updateHole(i, field, value) {
    setHoles(prev => {
      const next = [...prev]
      next[i] = { ...next[i], [field]: value }
      if (field === 'par') {
        const p = parseInt(value, 10)
        next[i].hole_type = p === 3 ? 'par3' : p === 5 ? 'par5' : 'par4'
      }
      return next
    })
  }

  function updateYardage(holeIdx, teeIdx, value) {
    setHoles(prev => {
      const next = [...prev]
      const yardages = [...next[holeIdx].yardages]
      yardages[teeIdx] = parseInt(value, 10) || 0
      next[holeIdx] = { ...next[holeIdx], yardages }
      return next
    })
  }

  function updateTee(i, field, value) {
    setTees(prev => {
      const next = [...prev]
      next[i] = { ...next[i], [field]: value }
      return next
    })
  }

  function addTee() {
    const newTee = { name: 'New Tee', color: 'White', slope: 113, rating: 72.0 }
    setTees(prev => [...prev, newTee])
    setHoles(prev => prev.map(h => ({
      ...h,
      yardages: [...h.yardages, 350],
    })))
    setActiveTeeIdx(tees.length)
  }

  function removeTee(i) {
    if (tees.length <= 1) { toast.error('Need at least one tee'); return }
    setTees(prev => prev.filter((_, idx) => idx !== i))
    setHoles(prev => prev.map(h => ({
      ...h,
      yardages: h.yardages.filter((_, idx) => idx !== i),
    })))
    if (activeTeeIdx >= i && activeTeeIdx > 0) setActiveTeeIdx(activeTeeIdx - 1)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)

    const totalPar = holes.reduce((a, h) => a + parseInt(h.par, 10), 0)

    // Build tees array with yardages
    const teesWithYardage = tees.map((t, tIdx) => ({
      name:    t.name,
      color:   t.color,
      slope:   parseInt(t.slope, 10),
      rating:  parseFloat(t.rating),
      yardage: holes.map(h => h.yardages[tIdx] ?? 0),
    }))

    // Primary tee = first tee (for backward compat)
    const primary = teesWithYardage[0]

    const payload = {
      name:         name.trim(),
      slope:        primary.slope,
      rating:       primary.rating,
      par:          totalPar,
      par_per_hole: holes.map(h => parseInt(h.par, 10)),
      hole_type:    holes.map(h => h.par == 3 ? 'par3' : h.par == 5 ? 'par5' : 'par4'),
      yardage:      primary.yardage,
      stroke_index: holes.map(h => parseInt(h.stroke_index, 10)),
      tees:         teesWithYardage,
    }

    const { error } = editing
      ? await supabase.from('courses').update(payload).eq('id', editing.id)
      : await supabase.from('courses').insert({ ...payload, org_id: orgId })

    setSaving(false)
    if (error) toast.error(error.message)
    else { toast.success(editing ? 'Course updated' : 'Course created'); onSaved() }
  }

  const totalPar     = holes.reduce((a, h) => a + parseInt(h.par, 10), 0)
  const activeTeeYds = holes.reduce((a, h) => a + (h.yardages[activeTeeIdx] || 0), 0)

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Course' : 'New Course'} maxWidth="max-w-5xl">
      <form onSubmit={handleSave} className="space-y-6">
        {/* Course name */}
        <Input
          label="Course Name"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Pine Valley GC"
          required
        />

        {/* Tee Sets */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Tee Sets</h3>
              <p className="text-xs text-gray-500 mt-0.5">Flight A typically plays Back tees; Flight B plays Middle or Forward</p>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={addTee}>+ Add Tee</Button>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            {tees.map((t, i) => (
              <div key={i} className={`border rounded-xl p-3 space-y-2 cursor-pointer transition-all ${activeTeeIdx === i ? 'border-fairway-500 bg-fairway-50' : 'border-gray-200 hover:border-gray-300'}`}
                onClick={() => setActiveTeeIdx(i)}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-600">Tee {i + 1}</span>
                  {tees.length > 1 && (
                    <button type="button" onClick={e => { e.stopPropagation(); removeTee(i) }} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-400">Name</label>
                    <input value={t.name} onChange={e => updateTee(i, 'name', e.target.value)}
                      className="input py-1 text-xs w-full" placeholder="Back" onClick={e => e.stopPropagation()} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Color</label>
                    <select value={t.color} onChange={e => updateTee(i, 'color', e.target.value)}
                      className="input py-1 text-xs w-full bg-white" onClick={e => e.stopPropagation()}>
                      {TEE_COLORS.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Slope</label>
                    <input type="number" value={t.slope} onChange={e => updateTee(i, 'slope', e.target.value)}
                      className="input py-1 text-xs w-full" min="55" max="155" onClick={e => e.stopPropagation()} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Rating</label>
                    <input type="number" step="0.1" value={t.rating} onChange={e => updateTee(i, 'rating', e.target.value)}
                      className="input py-1 text-xs w-full" min="60" max="80" onClick={e => e.stopPropagation()} />
                  </div>
                </div>
                {activeTeeIdx === i && (
                  <div className="text-xs text-fairway-600 font-medium text-center">Editing yardages ↓</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="flex gap-6 text-sm text-gray-600 bg-gray-50 rounded-lg px-4 py-2 flex-wrap">
          <span>Total Par: <strong>{totalPar}</strong></span>
          <span>{tees[activeTeeIdx]?.name ?? ''} Tee Yards: <strong>{activeTeeYds.toLocaleString()}</strong></span>
          <span>Par 3s: <strong>{holes.filter(h => h.par == 3).length}</strong></span>
          <span>Par 5s: <strong>{holes.filter(h => h.par == 5).length}</strong></span>
        </div>

        {/* Hole grid */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr className="text-left text-xs font-semibold text-gray-500 border-b">
                <th className="py-2 pr-2 w-8">#</th>
                <th className="py-2 px-2 w-16">Par</th>
                <th className="py-2 px-2 w-16">S.I.</th>
                {tees.map((t, i) => (
                  <th key={i} className={`py-2 px-2 text-center ${activeTeeIdx === i ? 'text-fairway-700 font-bold' : ''}`}>
                    {t.name} Yds
                    <div className={`text-xs font-normal mt-0.5 ${activeTeeIdx === i ? 'text-fairway-500' : 'text-gray-400'}`}>{t.color}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {holes.map((h, i) => (
                <tr key={i} className={i === 8 ? 'border-t-2 border-gray-300' : ''}>
                  <td className="py-1.5 pr-2 font-medium text-gray-500 text-xs">{h.hole}</td>
                  <td className="py-1.5 px-2">
                    <select value={h.par} onChange={e => updateHole(i, 'par', e.target.value)} className="input py-1 text-xs w-14">
                      <option value={3}>3</option>
                      <option value={4}>4</option>
                      <option value={5}>5</option>
                    </select>
                  </td>
                  <td className="py-1.5 px-2">
                    <input type="number" value={h.stroke_index} onChange={e => updateHole(i, 'stroke_index', e.target.value)}
                      className="input py-1 text-xs w-14" min="1" max="18" />
                  </td>
                  {h.yardages.map((yds, tIdx) => (
                    <td key={tIdx} className={`py-1.5 px-2 ${activeTeeIdx === tIdx ? 'bg-fairway-50' : ''}`}>
                      <input type="number" value={yds} onChange={e => updateYardage(i, tIdx, e.target.value)}
                        className="input py-1 text-xs w-20" min="50" max="700" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>{editing ? 'Save Changes' : 'Create Course'}</Button>
        </div>
      </form>
    </Modal>
  )
}
