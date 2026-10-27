/**
 * WagerShareCard — the shareable image of the wager board (PNG export).
 *
 * Rendered off-screen by WagerAdmin and captured with html-to-image. Fixed 900px width,
 * inline styles only (so the capture matches exactly). Shows the pool totals, the
 * WIN / PLACE / match results with payouts once scores exist, and the live odds while
 * the event is still being played.
 */

export const WAGER_CARD_WIDTH = 900

const FONT  = "'Manrope', sans-serif"
const GREEN = '#1B4332'
const GOLD  = '#C9A84C'
const money = n => `$${Number(n).toFixed(2)}`

function Section({ title, subtitle, children }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #ebe9e4', overflow: 'hidden' }}>
      <div style={{ background: GREEN, padding: '12px 20px', display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ color: GOLD, fontWeight: 700, fontSize: 16 }}>{title}</span>
        {subtitle && <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>{subtitle}</span>}
      </div>
      {children}
    </div>
  )
}

function BettorTable({ bettors, color, border, playerName }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
      <thead>
        <tr style={{ borderBottom: `1px solid ${border}` }}>
          {[['Bettor', 'left'], ['Picked', 'left'], ['Stake', 'right'], ['Payout', 'right']].map(([h, a]) => (
            <th key={h} style={{ textAlign: a, padding: '5px 0', color, fontWeight: 700 }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {bettors.map((b, i) => (
          <tr key={i} style={{ borderBottom: `1px solid ${border}` }}>
            <td style={{ padding: '7px 0', fontWeight: 700, color: '#111' }}>{b.name}</td>
            <td style={{ padding: '7px 0', color: '#374151' }}>{playerName(b.pid)}</td>
            <td style={{ padding: '7px 0', textAlign: 'right', color: '#6b7280' }}>{money(b.bet)}</td>
            <td style={{ padding: '7px 0', textAlign: 'right', fontWeight: 900, color }}>{money(b.payout)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Panel({ bg, border, children }) {
  return <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: '14px 16px' }}>{children}</div>
}

const Muted = ({ children, style }) => <div style={{ fontSize: 13, color: '#6b7280', ...style }}>{children}</div>

export default function WagerShareCard({ event, eventDate, settlement, playerName, showResults, hasScores, activeCount }) {
  const { winPool, placePool, totalPot, winTotals, placeTotals, allPickedIds, winResults, placeResults, matchCards, matchPoolTotal } = settlement
  const complete = event.status === 'complete'
  const resultsReady = showResults && hasScores && (winResults || placeResults)

  return (
    <div style={{ width: WAGER_CARD_WIDTH, background: '#fbfaf8', padding: 24, fontFamily: FONT, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Title */}
      <div style={{ textAlign: 'center', padding: '4px 0 2px' }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#86868b' }}>
          {event.league?.name ?? ''}
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#1d1d1f', letterSpacing: '-0.02em', marginTop: 2 }}>
          {event.name ?? `Event #${event.event_number}`} · Wagers
        </div>
        <div style={{ fontSize: 14, color: '#86868b', marginTop: 2 }}>
          {[event.course?.name, eventDate].filter(Boolean).join(' · ')}
        </div>
      </div>

      {/* Pool summary */}
      <Section title="Pool Summary" subtitle={`${activeCount} active bet${activeCount !== 1 ? 's' : ''}`}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${matchPoolTotal > 0 ? 4 : 3}, 1fr)`, padding: '16px 20px', gap: 8 }}>
          {[
            ['WIN Pool', money(winPool), '#16a34a'],
            ['PLACE Pool', money(placePool), '#1d4ed8'],
            ...(matchPoolTotal > 0 ? [['Match Pool', money(matchPoolTotal), '#7c3aed']] : []),
            ['Total Pot', money(totalPot + matchPoolTotal), GREEN],
          ].map(([label, val, color]) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#9ca3af', fontWeight: 700, marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 24, fontWeight: 900, color }}>{val}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Results */}
      {resultsReady && (
        <Section title="Wager Results" subtitle={complete ? 'Final · Low net score' : 'Live · Updates as scores are entered'}>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {winResults && (winResults.matched ? (
              <Panel bg="#f0fdf4" border="#bbf7d0">
                <div style={{ fontSize: 13, fontWeight: 700, color: '#16a34a', marginBottom: 8 }}>WIN Pool · 1st place net {winResults.net}</div>
                <BettorTable bettors={winResults.bettors} color="#16a34a" border="#bbf7d0" playerName={playerName} />
              </Panel>
            ) : (
              <Panel bg="#f9fafb" border="#e5e7eb">
                <div style={{ fontSize: 13, fontWeight: 700, color: '#9ca3af', marginBottom: 4 }}>WIN Pool · 1st place net {winResults.net}</div>
                <Muted>Winner: <strong>{winResults.topPlayers.map(id => playerName(id)).join(', ')}</strong> — no WIN bets on {winResults.topPlayers.length === 1 ? 'this player' : 'these players'}.</Muted>
                <Muted style={{ marginTop: 4, color: '#9ca3af' }}>{money(winPool)} rolls to the club.</Muted>
              </Panel>
            ))}

            {placeResults && (!placeResults.matched ? (
              <Panel bg="#f9fafb" border="#e5e7eb">
                <div style={{ fontSize: 13, fontWeight: 700, color: '#9ca3af', marginBottom: 4 }}>PLACE Pool · No matched bets</div>
                <Muted>1st/2nd: <strong>{placeResults.topPlayers.map(id => playerName(id)).join(', ')}</strong> — no PLACE bets on these players.</Muted>
                <Muted style={{ marginTop: 4, color: '#9ca3af' }}>{money(placePool)} rolls to the club.</Muted>
              </Panel>
            ) : (
              <Panel bg="#eff6ff" border="#bfdbfe">
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1d4ed8', marginBottom: 2 }}>
                  PLACE Pool · {placeResults.twoWayTie ? `Tied for 1st — net ${placeResults.net}` : `1st net ${placeResults.net} · 2nd net ${placeResults.net2}`}
                </div>
                <div style={{ fontSize: 12, color: '#1d4ed8', marginBottom: 8 }}>Pool split 50/50 between 1st-place and 2nd-place bettors · Each bettor gets stake back + proportional share of profit</div>
                {[['1st place', placeResults.g1], ['2nd place', placeResults.g2]].map(([label, g]) => g.players.length > 0 && (
                  g.hasMatch ? (
                    <div key={label}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: '8px 0 4px' }}>{label} — {g.players.map(id => playerName(id)).join(' / ')}</div>
                      <BettorTable bettors={g.bettors} color="#1d4ed8" border="#bfdbfe" playerName={playerName} />
                    </div>
                  ) : (
                    <Muted key={label} style={{ margin: '8px 0', color: '#9ca3af' }}>
                      {label} ({g.players.map(id => playerName(id)).join(', ')}) — no PLACE bets · half pool rolls to club.
                    </Muted>
                  )
                ))}
              </Panel>
            ))}
          </div>
        </Section>
      )}

      {/* Match play wagers */}
      {matchCards.length > 0 && (
        <Section title="Match Play Wagers" subtitle="Pool per match · halved = stakes refunded">
          {matchCards.map(({ match, sideAmt, pool, result, settlement: s }, i) => (
            <div key={match.id} style={{ padding: '14px 20px', borderTop: i === 0 ? 'none' : '1px solid #f3f4f6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#111' }}>
                  Match {match.match_number}: {playerName(match.player_a_id)} vs {playerName(match.player_b_id)}
                </span>
                <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 700 }}>Pool {money(pool)}</span>
              </div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6 }}>
                {result ? `${result.matchStatus}${result.winner ? ' · Final' : ''}` : 'Match not scored yet'}
              </div>
              {s?.type === 'paid' && (
                <Panel bg="#f5f3ff" border="#ddd6fe">
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#7c3aed', marginBottom: 6 }}>Winner: {playerName(s.winnerPid)}</div>
                  <BettorTable bettors={s.bettors} color="#7c3aed" border="#ddd6fe" playerName={playerName} />
                </Panel>
              )}
              {s?.type === 'refund' && (
                <Panel bg="#f9fafb" border="#e5e7eb">
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#6b7280', marginBottom: s.bettors.length ? 6 : 0 }}>Match halved — all stakes refunded</div>
                  {s.bettors.length > 0 && <BettorTable bettors={s.bettors} color="#6b7280" border="#e5e7eb" playerName={playerName} />}
                </Panel>
              )}
              {s?.type === 'club' && (
                <Panel bg="#f9fafb" border="#e5e7eb">
                  <Muted>Winner: <strong>{playerName(s.winnerPid)}</strong> — no bets on the winner. {money(pool)} rolls to the club.</Muted>
                </Panel>
              )}
              {!s && [match.player_a_id, match.player_b_id].map(pid => {
                const amt = sideAmt[pid] ?? 0
                return (
                  <div key={pid} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '2px 0' }}>
                    <span style={{ fontWeight: 600, color: '#374151' }}>{playerName(pid)}</span>
                    <span>{amt > 0
                      ? <><span style={{ fontWeight: 700, color: '#7c3aed' }}>{money(amt)}</span> <span style={{ color: '#9ca3af', fontSize: 12 }}>{(pool / amt).toFixed(2)}x</span></>
                      : <span style={{ color: '#d1d5db' }}>—</span>}</span>
                  </div>
                )
              })}
            </div>
          ))}
        </Section>
      )}

      {/* Live odds — only while betting/play is still going */}
      {!complete && allPickedIds.length > 0 && (
        <Section title="Live Odds">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f0f4f2' }}>
                {[['Player', 'left', '#6b7280'], ['WIN Amt', 'center', '#16a34a'], ['WIN Odds', 'center', '#16a34a'], ['PLACE Amt', 'center', '#1d4ed8'], ['PLACE Odds', 'center', '#1d4ed8']].map(([h, a, c]) => (
                  <th key={h} style={{ padding: '8px 20px', textAlign: a, color: c, fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allPickedIds.map((pid, i) => {
                const wAmt = winTotals[pid] ?? 0
                const pAmt = placeTotals[pid] ?? 0
                return (
                  <tr key={pid} style={{ borderTop: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding: '8px 20px', fontWeight: 700, color: '#111' }}>{playerName(pid)}</td>
                    <td style={{ padding: '8px 20px', textAlign: 'center', color: '#16a34a', fontWeight: 600 }}>{wAmt > 0 ? money(wAmt) : '—'}</td>
                    <td style={{ padding: '8px 20px', textAlign: 'center', color: '#6b7280' }}>{wAmt > 0 && winPool > 0 ? (winPool / wAmt).toFixed(2) + 'x' : '—'}</td>
                    <td style={{ padding: '8px 20px', textAlign: 'center', color: '#1d4ed8', fontWeight: 600 }}>{pAmt > 0 ? money(pAmt) : '—'}</td>
                    <td style={{ padding: '8px 20px', textAlign: 'center', color: '#6b7280' }}>{pAmt > 0 && placePool > 0 ? (placePool / pAmt).toFixed(2) + 'x' : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Section>
      )}

      <div style={{ textAlign: 'center', fontSize: 11, color: '#a8a8a4', paddingTop: 2 }}>Scorify Golf</div>
    </div>
  )
}
