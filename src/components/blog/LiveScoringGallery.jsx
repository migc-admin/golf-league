import { useState } from 'react'
import Modal from '../ui/Modal'

const SCREENS = [
  { key: 'entry', label: 'Score Entry', src: '/blog/live-scoring/score-entry.png', caption: 'Players tap their score hole-by-hole — no app download, no login.' },
  { key: 'scorecard', label: 'Full Scorecard', src: '/blog/live-scoring/scorecard.PNG', caption: 'Every hole, every player, gross and net — visible to the whole group in real time.' },
  { key: 'leaderboard', label: 'Live Leaderboard', src: '/blog/live-scoring/leaderboard.PNG', caption: 'Standings update automatically as scores come in from every group, split by flight.' },
]

export default function LiveScoringGallery() {
  const [open, setOpen] = useState(null)

  return (
    <div className="my-6">
      <div className="grid grid-cols-3 gap-3">
        {SCREENS.map(s => (
          <button
            key={s.key}
            onClick={() => setOpen(s.key)}
            className="text-left rounded-lg overflow-hidden transition-transform hover:scale-[1.02]"
            style={{ aspectRatio: '9 / 16', border: '1px solid #ebe9e4' }}
          >
            <img src={s.src} alt={s.label} className="w-full h-full object-cover object-top" />
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3 mt-2">
        {SCREENS.map(s => (
          <p key={s.key} className="text-xs font-semibold text-center" style={{ color: '#6b7280' }}>{s.label}</p>
        ))}
      </div>

      {SCREENS.map(s => (
        <Modal key={s.key} open={open === s.key} onClose={() => setOpen(null)} title={s.label} maxWidth="max-w-xs">
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #ebe9e4' }}>
            <img src={s.src} alt={s.label} className="w-full h-auto" />
          </div>
          <p className="text-sm mt-3" style={{ color: '#6b7280' }}>{s.caption}</p>
          <p className="text-xs mt-2" style={{ color: '#9ca3af' }}>Sample data for illustration — not a real event.</p>
        </Modal>
      ))}
    </div>
  )
}
