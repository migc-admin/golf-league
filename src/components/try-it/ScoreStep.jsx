// "Score" step: a working copy of the player scoring screen. Scores feed the
// live leaderboard and net skins, using the same stroke allocation as real
// rounds (see src/lib/scoringDemo.js).
import { useMemo, useState } from 'react'
import { DEMO_GROUP, DEMO_HOLES, DEMO_SKINS_POT, demoLeaderboard, demoSkins, strokesOn, formatToPar } from '../../lib/scoringDemo'
import { INK, MUTED, LINE, GREEN, WIN, FlightBadge, Panel, SAMPLE } from './shared'

export default function ScoreStep({ scores, setScores, onSubmit }) {
  const firstOpen = idx => DEMO_GROUP.findIndex(p => scores[p.id]?.[DEMO_HOLES[idx].number] == null)
  const [holeIdx, setHoleIdx] = useState(() => { const i = DEMO_HOLES.findIndex((_, k) => firstOpen(k) !== -1); return i === -1 ? 0 : i })
  const [active, setActive] = useState(() => { const f = firstOpen(holeIdx); return f === -1 ? null : f })
  const [done, setDone] = useState(false)

  const hole = DEMO_HOLES[holeIdx]
  const board = useMemo(() => demoLeaderboard(scores), [scores])
  const skins = useMemo(() => demoSkins(scores), [scores])
  const holeComplete = DEMO_GROUP.every(p => scores[p.id]?.[hole.number] != null)

  const nextOpen = (from, s) => {
    for (let k = 1; k <= DEMO_GROUP.length; k++) {
      const i = (from + k) % DEMO_GROUP.length
      if (s[DEMO_GROUP[i].id]?.[hole.number] == null) return i
    }
    return null
  }

  const enter = value => {
    if (active == null) return
    const p = DEMO_GROUP[active]
    const next = { ...scores, [p.id]: { ...(scores[p.id] ?? {}), [hole.number]: value } }
    setScores(next)
    setActive(nextOpen(active, next))
  }

  const clear = () => {
    const i = active ?? DEMO_GROUP.length - 1
    const p = DEMO_GROUP[i]
    const { [hole.number]: _removed, ...rest } = scores[p.id] ?? {}
    setScores({ ...scores, [p.id]: rest })
    setActive(i)
  }

  const fill = () => {
    const next = { ...scores }
    DEMO_GROUP.forEach((p, i) => { next[p.id] = { ...(next[p.id] ?? {}), [hole.number]: SAMPLE[hole.number][i] } })
    setScores(next)
    setActive(null)
  }

  const goTo = idx => {
    setHoleIdx(idx)
    const f = DEMO_GROUP.findIndex(p => scores[p.id]?.[DEMO_HOLES[idx].number] == null)
    setActive(f === -1 ? null : f)
  }

  const save = () => {
    if (holeIdx < DEMO_HOLES.length - 1) goTo(holeIdx + 1)
    else { setDone(true); setActive(null) }
  }

  const restart = () => { setScores({}); setHoleIdx(0); setActive(0); setDone(false) }

  return (
    <div className="grid lg:grid-cols-[minmax(0,400px)_1fr] gap-6 lg:gap-10 items-start">

      {/* ── Phone: scoring screen ─────────────────────────────── */}
      <div className="rounded-[28px] p-2 mx-auto w-full max-w-[400px]" style={{ background: '#0a1a12', boxShadow: '0 24px 60px rgba(0,0,0,0.35)' }}>
        <div className="rounded-[22px] overflow-hidden" style={{ background: '#fbfaf8' }}>
          {/* Header */}
          <div className="bg-white px-4 pt-4 pb-3" style={{ borderBottom: `1px solid ${LINE}` }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-bold" style={{ color: INK }}>Wednesday Night League</p>
                <p className="text-[11px]" style={{ color: MUTED }}>Group 2 · Sample data</p>
              </div>
              <div className="flex gap-1.5" aria-label={`Hole ${hole.number} of ${DEMO_HOLES.length}`}>
                {DEMO_HOLES.map((h, i) => {
                  const filled = DEMO_GROUP.every(p => scores[p.id]?.[h.number] != null)
                  return (
                    <button key={h.number} type="button" onClick={() => { setDone(false); goTo(i) }}
                      aria-label={`Go to hole ${h.number}`}
                      className="h-2.5 rounded-full transition-all"
                      style={{ width: i === holeIdx && !done ? 22 : 10, background: i === holeIdx && !done ? INK : filled ? GREEN : '#d6d4cf' }} />
                  )
                })}
              </div>
            </div>
            {!done && (
              <div className="flex items-end gap-5">
                <div className="pr-5" style={{ borderRight: `1px solid ${LINE}` }}>
                  <p className="text-3xl font-black leading-none" style={{ color: INK }}>{String(hole.number).padStart(2, '0')}</p>
                  <p className="text-[11px] mt-1" style={{ color: MUTED }}>HOLE</p>
                </div>
                {[['PAR', hole.par], ['YDS', hole.yards], ['S.I.', hole.si]].map(([k, v]) => (
                  <div key={k}>
                    <p className="text-lg font-bold leading-none" style={{ color: INK }}>{v}</p>
                    <p className="text-[11px] mt-1" style={{ color: MUTED }}>{k}</p>
                  </div>
                ))}
                {hole.contestShort && (
                  <span className="ml-auto self-center text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap" style={{ background: '#fdf6dd', color: '#8a6d0b' }}>⛳ {hole.contestShort}</span>
                )}
              </div>
            )}
          </div>

          {done ? (
            <div className="px-5 py-10 text-center">
              <p className="text-4xl mb-3" aria-hidden="true">🏁</p>
              <p className="text-lg font-bold mb-2" style={{ color: INK }}>Round submitted</p>
              <p className="text-sm mb-6" style={{ color: MUTED }}>
                In a real event, the leaderboard, skins, and payouts are already final. Nobody sits at a scoring table.
              </p>
              <div className="flex flex-col gap-2 items-center">
                <button type="button" onClick={onSubmit} className="text-sm font-bold px-5 py-2.5 rounded-full text-white" style={{ background: GREEN }}>
                  See the payouts →
                </button>
                <button type="button" onClick={restart} className="text-sm font-semibold underline" style={{ color: MUTED }}>
                  Start over
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Player cards */}
              <div className="p-3 space-y-2">
                {DEMO_GROUP.map((p, i) => {
                  const gross = scores[p.id]?.[hole.number]
                  const strokes = strokesOn(p, hole)
                  const netToPar = gross != null ? gross - strokes - hole.par : null
                  const isActive = active === i
                  const totalGross = DEMO_HOLES.reduce((s, h) => s + (scores[p.id]?.[h.number] ?? 0), 0)
                  const holesIn = DEMO_HOLES.filter(h => scores[p.id]?.[h.number] != null).length
                  return (
                    <button key={p.id} type="button" onClick={() => setActive(i)}
                      aria-label={`${p.name}, ${gross != null ? `score ${gross}` : 'no score yet'}. Tap to enter a score.`}
                      className="w-full flex items-center justify-between rounded-2xl bg-white px-3.5 py-2.5 text-left transition-shadow"
                      style={{ border: isActive ? `2px solid ${GREEN}` : `1px solid ${LINE}`, boxShadow: isActive ? '0 4px 14px rgba(27,67,50,0.15)' : 'none' }}>
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-sm" style={{ color: INK }}>{p.name}</span>
                          <FlightBadge flight={p.flight} />
                          {strokes > 0 && (
                            <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#eaf1ec', color: GREEN }}>
                              {'●'.repeat(Math.min(strokes, 3))} {strokes} stroke{strokes > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] mt-0.5" style={{ color: MUTED }}>
                          {holesIn ? `${holesIn} hole${holesIn > 1 ? 's' : ''} · Gross ${totalGross}` : 'No holes entered'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0">
                        {netToPar != null && (
                          <div className="text-right">
                            <p className="text-[10px] leading-none mb-0.5" style={{ color: MUTED }}>Net</p>
                            <p className="text-base font-black leading-none" style={{ color: netToPar < 0 ? WIN : INK }}>{formatToPar(netToPar)}</p>
                          </div>
                        )}
                        <span className="flex items-center justify-center text-2xl font-black bg-white"
                          style={{ width: 46, height: 46, borderRadius: 12, color: INK, border: gross != null ? '1px solid #d6d4cf' : `1.5px dashed ${isActive ? GREEN : '#d6d4cf'}` }}>
                          {gross ?? '–'}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Keypad */}
              <div className="px-3 pb-3">
                <p className="text-[11px] mb-2 px-1" style={{ color: MUTED }} aria-live="polite">
                  {active != null ? <>Tap a score for <strong style={{ color: INK }}>{DEMO_GROUP[active].name}</strong>. It moves to the next player.</> : 'Everyone has a score for this hole.'}
                  {' '}
                  {!holeComplete && <button type="button" onClick={fill} className="underline font-semibold" style={{ color: GREEN }}>Fill in for me</button>}
                </p>
                <div className="grid grid-cols-5 gap-1.5">
                  {[2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                    <button key={n} type="button" onClick={() => enter(n)} disabled={active == null}
                      className="h-11 rounded-xl text-base font-bold bg-white disabled:opacity-40 active:scale-95 transition-transform"
                      style={{ border: `1px solid ${LINE}`, color: INK }} aria-label={`Score ${n}`}>
                      {n}
                    </button>
                  ))}
                  <button type="button" onClick={clear} className="h-11 rounded-xl text-sm font-bold bg-white" style={{ border: `1px solid ${LINE}`, color: MUTED }} aria-label="Clear score">
                    ⌫
                  </button>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center gap-2 px-3 py-3 bg-white" style={{ borderTop: `1px solid ${LINE}` }}>
                <button type="button" onClick={() => goTo(Math.max(0, holeIdx - 1))} disabled={holeIdx === 0}
                  className="w-11 h-11 rounded-full text-lg disabled:opacity-30" style={{ background: '#f1efea', color: INK }} aria-label="Previous hole">←</button>
                <button type="button" onClick={save} disabled={!holeComplete}
                  className="flex-1 h-11 rounded-full text-sm font-bold text-white disabled:opacity-40" style={{ background: INK }}>
                  {holeIdx < DEMO_HOLES.length - 1 ? `Save Hole ${hole.number} · Next →` : 'Submit round'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Leaderboard + skins ─────────────────────────────────── */}
      <div className="space-y-5">
        <Panel title="Live leaderboard · Net" aside={
          <span className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: WIN }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: WIN }} /> LIVE
          </span>
        }>
          <table className="w-full text-sm" aria-live="polite">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide" style={{ color: MUTED }}>
                <th className="text-left font-semibold pl-5 py-2 w-12">Pos</th>
                <th className="text-left font-semibold py-2">Player</th>
                <th className="text-right font-semibold py-2 w-14">Thru</th>
                <th className="text-right font-semibold pr-5 py-2 w-16">Net</th>
              </tr>
            </thead>
            <tbody>
              {board.map(r => (
                <tr key={r.id} style={{ borderTop: `1px solid ${LINE}`, background: r.inGroup ? '#f4f8f5' : undefined }}>
                  <td className="pl-5 py-2.5 font-semibold" style={{ color: MUTED }}>{r.pos ? `${r.tied ? 'T' : ''}${r.pos}` : '–'}</td>
                  <td className="py-2.5">
                    <span className="font-semibold" style={{ color: INK }}>{r.name}</span>{' '}
                    <FlightBadge flight={r.flight} />
                    {r.inGroup && <span className="hidden sm:inline text-[11px] ml-1.5" style={{ color: MUTED }}>your group</span>}
                  </td>
                  <td className="text-right py-2.5" style={{ color: MUTED }}>{r.thru || '–'}</td>
                  <td className="text-right pr-5 py-2.5 font-black" style={{ color: r.netToPar != null && r.netToPar < 0 ? WIN : INK }}>{formatToPar(r.netToPar)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title={`Net skins · $${DEMO_SKINS_POT} pot`} aside={<p className="text-[11px]" style={{ color: MUTED }}>Ties carry over</p>}>
          <div className="px-5 py-4">
            <ul className="space-y-2 text-sm" aria-live="polite">
              {skins.holes.map(h => (
                <li key={h.hole} className="flex items-center justify-between gap-3">
                  <span style={{ color: MUTED }}>Hole {h.hole}</span>
                  {h.status === 'open' && <span style={{ color: '#9ca3af' }}>Waiting for scores</span>}
                  {h.status === 'carry' && <span className="font-semibold" style={{ color: '#8a6d0b' }}>Tied at net {h.low}, carries over</span>}
                  {h.status === 'won' && (
                    <span className="font-semibold text-right" style={{ color: INK }}>
                      {h.winner} · net {h.low}{h.skins > 1 ? ` · ${h.skins} skins` : ''}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${LINE}` }}>
              {skins.payouts.length > 0 ? (
                <>
                  <p className="text-[11px] font-bold uppercase tracking-wide mb-1.5" style={{ color: MUTED }}>
                    Payouts so far · ${skins.perSkin} per skin
                  </p>
                  {skins.payouts.map(w => (
                    <p key={w.name} className="flex justify-between text-sm">
                      <span style={{ color: INK }}>{w.name} <span style={{ color: MUTED }}>({w.skins} skin{w.skins > 1 ? 's' : ''})</span></span>
                      <span className="font-black" style={{ color: GREEN }}>${w.amount}</span>
                    </p>
                  ))}
                </>
              ) : (
                <p className="text-xs" style={{ color: MUTED }}>
                  {skins.carry
                    ? `${skins.carry} skin${skins.carry > 1 ? 's' : ''} carrying over. Payouts are calculated automatically as scores come in.`
                    : 'Skins are decided once every player has a score on the hole. Payouts are calculated automatically.'}
                </p>
              )}
            </div>
          </div>
        </Panel>
      </div>
    </div>
  )
}
