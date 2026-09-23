const GREEN = '#1B4332'
const INK = '#1d1d1f'

function scoreColor(score) {
  if (typeof score === 'string' && score.startsWith('-')) return GREEN
  if (score === 'E') return '#6b7280'
  return '#b91c1c'
}

export default function LeaderboardPreview({ title, rows = [] }) {
  return (
    <div className="my-6 rounded-xl overflow-hidden" style={{ border: '1px solid #ebe9e4' }}>
      <div className="px-4 py-3" style={{ background: GREEN }}>
        <p className="text-xs font-bold uppercase tracking-widest text-white">{title}</p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: '#f5f3ee' }}>
            <th className="text-left px-4 py-2 font-bold" style={{ color: INK }}>Rank</th>
            <th className="text-left px-4 py-2 font-bold" style={{ color: INK }}>Player</th>
            <th className="text-left px-4 py-2 font-bold" style={{ color: INK }}>Thru</th>
            <th className="text-right px-4 py-2 font-bold" style={{ color: INK }}>Score</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.rank} style={{ borderTop: '1px solid #ebe9e4' }}>
              <td className="px-4 py-2 font-bold" style={{ color: INK }}>{r.rank}</td>
              <td className="px-4 py-2" style={{ color: INK }}>{r.name}</td>
              <td className="px-4 py-2" style={{ color: '#6b7280' }}>{r.thru}</td>
              <td className="px-4 py-2 text-right font-bold" style={{ color: scoreColor(r.score) }}>{r.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs px-4 py-2" style={{ color: '#9ca3af', background: '#f5f3ee' }}>
        Sample data for illustration — not a real event.
      </p>
    </div>
  )
}
