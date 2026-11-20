// "Build groups" step: the admin side. One click turns 8 sample players into
// two foursomes with tee times, the same way Scorify auto-assigns groups.
import { DEMO_ROSTER } from '../../lib/scoringDemo'
import { INK, MUTED, LINE, GREEN, FlightBadge, Panel } from './shared'

const MODES = [
  { key: 'flight', label: 'By flight', hint: 'A players together, B players together' },
  { key: 'mixed',  label: 'Mix A and B', hint: 'Two A and two B players per group' },
  { key: 'random', label: 'Random', hint: 'Shuffle the whole field' },
]

export default function GroupsStep({ groups, mode, onBuild, onNext }) {
  return (
    <div className="grid lg:grid-cols-[minmax(0,360px)_1fr] gap-6 lg:gap-10 items-start">
      <Panel title="Wednesday Night League · 8 players" aside={<span className="text-[11px]" style={{ color: MUTED }}>Sample data</span>}>
        <ul>
          {[...DEMO_ROSTER].sort((a, b) => a.ch - b.ch).map(p => (
            <li key={p.id} className="flex items-center justify-between px-5 py-2.5 text-sm" style={{ borderTop: `1px solid ${LINE}` }}>
              <span className="flex items-center gap-2">
                <span className="font-semibold" style={{ color: INK }}>{p.name}</span>
                <FlightBadge flight={p.flight} />
              </span>
              <span className="text-xs" style={{ color: MUTED }}>HCP {p.ch}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <div className="space-y-5">
        <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)' }}>
          <p className="text-sm font-bold text-white mb-1">Auto-assign groups</p>
          <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.7)' }}>Pick how to split the field. You can drag players between groups in the real app.</p>
          <div className="grid sm:grid-cols-3 gap-2">
            {MODES.map(m => (
              <button key={m.key} type="button" onClick={() => onBuild(m.key)}
                className="text-left rounded-xl px-4 py-3 transition-colors"
                style={mode === m.key ? { background: '#fff', color: INK } : { background: 'rgba(255,255,255,0.1)', color: '#fff' }}>
                <span className="block text-sm font-bold">{m.label}</span>
                <span className="block text-[11px] mt-0.5" style={{ color: mode === m.key ? MUTED : 'rgba(255,255,255,0.65)' }}>{m.hint}</span>
              </button>
            ))}
          </div>
        </div>

        {groups ? (
          <>
            <div className="grid sm:grid-cols-2 gap-4" aria-live="polite">
              {groups.map(g => (
                <Panel key={g.number} title={`Group ${g.number}`} aside={<span className="text-xs font-semibold" style={{ color: GREEN }}>{g.teeTime} · Hole {g.startHole}</span>}>
                  <ul>
                    {g.players.map(p => (
                      <li key={p.id} className="flex items-center justify-between px-5 py-2 text-sm" style={{ borderTop: `1px solid ${LINE}` }}>
                        <span className="flex items-center gap-2"><span style={{ color: INK }}>{p.name}</span><FlightBadge flight={p.flight} /></span>
                        <span className="text-xs" style={{ color: MUTED }}>{p.ch}</span>
                      </li>
                    ))}
                  </ul>
                </Panel>
              ))}
            </div>
            <button type="button" onClick={onNext} className="text-sm font-bold px-5 py-2.5 rounded-full bg-white" style={{ color: INK }}>
              Next: print the round-day sheets →
            </button>
          </>
        ) : (
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>Pick an option above to build the groups.</p>
        )}
      </div>
    </div>
  )
}
