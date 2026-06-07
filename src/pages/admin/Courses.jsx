import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import Card, { CardHeader } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'

// Default USGA-style stroke index for a par-72 course (1=hardest)
const DEFAULT_SI = [1,3,5,7,9,11,13,15,17,2,4,6,8,10,12,14,16,18]

const emptyHoles = () =>
  Array.from({ length: 18 }, (_, i) => ({
    hole:         i + 1,
    par:          4,
    hole_type:    'par4',
    yardage:      380,
    stroke_index: DEFAULT_SI[i],
  }))

export default function Courses() {
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal,   setModal]   = useState(false)
  const [editing, setEditing] = useState(null)

  async function load() {
    const { data } = await supabase
      .from('courses')
      .select('id, name, slope, rating, par, created_at')
      .order('name')
    setCourses(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openCreate() { setEditing(null); setModal(true) }
  function openEdit(c)  { setEditing(c);    setModal(true) }

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
          <p className="text-sm text-gray-500 mt-0.5">Manage course details and hole data</p>
        </div>
        <Button onClick={openCreate}>+ New Course</Button>
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[0,1,2].map(i => <div key={i} className="h-20 bg-gray-200 rounded-xl" />)}
        </div>
      ) : courses.length === 0 ? (
        <Card className="text-center py-12">
          <div className="text-4xl mb-3">🏌️</div>
          <p className="text-gray-500 font-medium">No courses yet</p>
          <Button className="mt-4" onClick={openCreate}>Add Course</Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {courses.map(c => (
            <Card key={c.id} className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-gray-900">{c.name}</div>
                <div className="text-sm text-gray-500">
                  Slope {c.slope} · Rating {c.rating} · Par {c.par}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => openEdit(c)}>Edit</Button>
                <Button variant="danger"    size="sm" onClick={() => handleDelete(c.id)}>Delete</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <CourseModal
        open={modal}
        onClose={() => setModal(false)}
        editing={editing}
        onSaved={() => { setModal(false); load() }}
      />
    </div>
  )
}

function CourseModal({ open, onClose, editing, onSaved }) {
  const [name,   setName]   = useState('')
  const [slope,  setSlope]  = useState(113)
  const [rating, setRating] = useState(72.0)
  const [holes,  setHoles]  = useState(emptyHoles)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (editing) {
      // Load full course data including arrays
      supabase.from('courses').select('*').eq('id', editing.id).single()
        .then(({ data }) => {
          if (!data) return
          setName(data.name)
          setSlope(data.slope)
          setRating(data.rating)
          setHoles(Array.from({ length: 18 }, (_, i) => ({
            hole:         i + 1,
            par:          data.par_per_hole[i],
            hole_type:    data.hole_type[i],
            yardage:      data.yardage[i],
            stroke_index: data.stroke_index[i],
          })))
        })
    } else {
      setName('')
      setSlope(113)
      setRating(72.0)
      setHoles(emptyHoles())
    }
  }, [editing, open])

  function updateHole(i, field, value) {
    setHoles(prev => {
      const next = [...prev]
      next[i] = { ...next[i], [field]: value }
      // Keep hole_type in sync with par
      if (field === 'par') {
        const p = parseInt(value, 10)
        next[i].hole_type = p === 3 ? 'par3' : p === 5 ? 'par5' : 'par4'
      }
      return next
    })
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)

    const totalPar = holes.reduce((a, h) => a + parseInt(h.par, 10), 0)

    const payload = {
      name:         name.trim(),
      slope:        parseInt(slope, 10),
      rating:       parseFloat(rating),
      par:          totalPar,
      par_per_hole: holes.map(h => parseInt(h.par, 10)),
      hole_type:    holes.map(h => h.hole_type),
      yardage:      holes.map(h => parseInt(h.yardage, 10)),
      stroke_index: holes.map(h => parseInt(h.stroke_index, 10)),
    }

    const { error } = editing
      ? await supabase.from('courses').update(payload).eq('id', editing.id)
      : await supabase.from('courses').insert(payload)

    setSaving(false)
    if (error) toast.error(error.message)
    else { toast.success(editing ? 'Course updated' : 'Course created'); onSaved() }
  }

  const totalPar     = holes.reduce((a, h) => a + parseInt(h.par, 10), 0)
  const totalYardage = holes.reduce((a, h) => a + parseInt(h.yardage, 10), 0)

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Course' : 'New Course'} maxWidth="max-w-4xl">
      <form onSubmit={handleSave}>
        {/* Header info */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <Input
            label="Course Name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Pine Valley GC"
            required
            className="col-span-2"
          />
          <Input
            label="Slope"
            type="number"
            value={slope}
            onChange={e => setSlope(e.target.value)}
            min="55" max="155"
            required
          />
          <Input
            label="Rating"
            type="number"
            step="0.1"
            value={rating}
            onChange={e => setRating(e.target.value)}
            min="60" max="80"
            required
          />
        </div>

        {/* Summary bar */}
        <div className="flex gap-6 text-sm text-gray-600 mb-4 bg-gray-50 rounded-lg px-4 py-2">
          <span>Total Par: <strong>{totalPar}</strong></span>
          <span>Total Yards: <strong>{totalYardage.toLocaleString()}</strong></span>
          <span>Par 3s: <strong>{holes.filter(h => h.hole_type === 'par3').length}</strong></span>
          <span>Par 5s: <strong>{holes.filter(h => h.hole_type === 'par5').length}</strong></span>
        </div>

        {/* Hole grid */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-gray-500 border-b">
                <th className="py-2 pr-2 w-8">#</th>
                <th className="py-2 px-2">Par</th>
                <th className="py-2 px-2">Yardage</th>
                <th className="py-2 px-2">Stroke Index</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {holes.map((h, i) => (
                <tr key={i} className={i === 8 ? 'border-t-2 border-gray-300' : ''}>
                  <td className="py-1.5 pr-2 font-medium text-gray-500 text-xs">{h.hole}</td>
                  <td className="py-1.5 px-2">
                    <select
                      value={h.par}
                      onChange={e => updateHole(i, 'par', e.target.value)}
                      className="input py-1 text-xs w-16"
                    >
                      <option value={3}>3</option>
                      <option value={4}>4</option>
                      <option value={5}>5</option>
                    </select>
                  </td>
                  <td className="py-1.5 px-2">
                    <input
                      type="number"
                      value={h.yardage}
                      onChange={e => updateHole(i, 'yardage', e.target.value)}
                      className="input py-1 text-xs w-20"
                      min="50" max="700"
                    />
                  </td>
                  <td className="py-1.5 px-2">
                    <input
                      type="number"
                      value={h.stroke_index}
                      onChange={e => updateHole(i, 'stroke_index', e.target.value)}
                      className="input py-1 text-xs w-16"
                      min="1" max="18"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-gray-200">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>{editing ? 'Save Changes' : 'Create Course'}</Button>
        </div>
      </form>
    </Modal>
  )
}
