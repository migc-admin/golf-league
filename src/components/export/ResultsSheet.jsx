/**
 * ResultsSheet — the "Tournament results" PNG (1000px wide).
 * Presentational: everything comes from buildResultsView (lib/resultsView.js).
 */
import ExportHeader from '../ui/ExportHeader'
import StatTiles from '../ui/StatTiles'
import { ExportSheet, ExportCard, SmallHead, FlightHead, TieTag, MarginPill, ExportFooter } from './ExportParts'
import { money } from '../../lib/resultsView'

const rowCls = 'flex items-baseline gap-3 border-t border-surface-border py-[7px] text-[13px] first:border-t-0'

function ScoringColumn({ column }) {
  return (
    <div className="min-w-0">
      <FlightHead flight={column.flight} right={`${column.count} players`} />
      {column.blocks.map(b => (
        <div key={b.fmt} className="mt-3">
          <SmallHead className="mb-0.5 flex justify-between"><span>{b.label} · {b.scoreLabel}</span></SmallHead>
          {b.rows.length === 0 && <div className="py-1.5 text-[12px] text-ink-muted">No results yet</div>}
          {b.rows.map((r, i) => (
            <div key={i} className={rowCls}>
              <span className="w-7 shrink-0 text-[11px] font-semibold text-ink-muted">{r.place}</span>
              <span className="min-w-0 flex-1 font-bold">{r.name}{r.tie && <TieTag />}</span>
              <span className="w-10 text-right tabular-nums text-ink-muted">{r.score ?? ''}</span>
              <span className="w-[72px] text-right font-bold tabular-nums">{r.amount != null ? money(r.amount) : ''}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function SkinsCard({ skins }) {
  return (
    <ExportCard title="Skins" className="h-full">
      <div className={skins.perFlight ? 'grid grid-cols-2 gap-4' : ''}>
        {skins.columns.map((c, i) => (
          <div key={i} className="min-w-0">
            {skins.perFlight && <FlightHead flight={c.flight} right={c.perSkin != null ? `${money(c.perSkin).replace(/\.00$/, '')} / skin` : null} />}
            {!skins.perFlight && c.perSkin != null && <SmallHead className="mb-1">{money(c.perSkin).replace(/\.00$/, '')} / skin</SmallHead>}
            {c.empty && <div className="py-2 text-[12px] text-ink-muted">No skins won</div>}
            {c.rows.map((r, j) => (
              <div key={j} className={rowCls}>
                <span className="w-7 shrink-0 text-[11px] font-semibold text-ink-muted">×{r.count}</span>
                <span className="min-w-0 flex-1 font-bold">{r.name}</span>
                <span className="whitespace-nowrap font-bold tabular-nums">{r.amount != null ? money(r.amount).replace(/\.00$/, '') : ''}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </ExportCard>
  )
}

function CtpCard({ ctp }) {
  return (
    <ExportCard title="Closest to pin" right={ctp.prize != null ? `Full field · ${money(ctp.prize)} each` : 'Full field'}>
      <div className="grid grid-cols-2 gap-x-6">
        {ctp.rows.map(r => (
          <div key={r.hole} className={rowCls}>
            <span className="w-14 shrink-0 text-[11px] font-semibold text-ink-muted">Hole {r.hole}</span>
            <span className="min-w-0 flex-1 font-bold">{r.name}</span>
          </div>
        ))}
      </div>
    </ExportCard>
  )
}

function LongDriveAndPutts({ longDrive, lowPutts }) {
  return (
    <ExportCard>
      <div className={longDrive && lowPutts ? 'grid grid-cols-2 gap-6' : ''}>
        {longDrive && (
          <div className="min-w-0">
            <div className="flex items-baseline justify-between"><h2 className="text-[17px] font-bold">Long drive</h2>{longDrive.hole && <span className="text-[12px] text-ink-muted">Hole {longDrive.hole}</span>}</div>
            <div className="mt-2">
              {longDrive.rows.map((r, i) => (
                <div key={i} className={rowCls}>
                  <span className="w-5 shrink-0 text-[11px] font-semibold text-ink-muted">{r.label}</span>
                  <span className="min-w-0 flex-1 font-bold">{r.name}</span>
                  <span className="font-bold tabular-nums">{r.amount != null ? money(r.amount) : ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {lowPutts && (
          <div className="min-w-0">
            <div className="flex items-baseline justify-between"><h2 className="text-[17px] font-bold">Low putts</h2><span className="text-[12px] text-ink-muted">Full field</span></div>
            <div className="mt-2">
              {lowPutts.rows.map((r, i) => (
                <div key={i} className={rowCls}>
                  {r.flight && <span className="w-5 shrink-0 text-[11px] font-semibold text-ink-muted">{r.flight}</span>}
                  <span className="min-w-0 flex-1 font-bold">{r.name}{r.tie && <TieTag />}</span>
                  <span className="font-bold tabular-nums">{r.amount != null ? money(r.amount) : ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ExportCard>
  )
}

function ExtraCard({ extra }) {
  return (
    <ExportCard title={extra.title}>
      {extra.rows.map((r, i) => (
        <div key={i} className={rowCls}>
          <span className="w-28 shrink-0 text-[11px] font-semibold text-ink-muted">{r.label}</span>
          <span className="min-w-0 flex-1 font-bold">{r.name}{r.tie && <TieTag />}</span>
          <span className="font-bold tabular-nums">{r.amount != null ? money(r.amount) : ''}</span>
        </div>
      ))}
    </ExportCard>
  )
}

function matchLine(r) {
  if (r.kind === 'def') return <><b>{r.winner}</b> <span className="text-ink-muted">def. {r.loser}</span></>
  if (r.kind === 'halved') return <><b>{r.winner}</b> <span className="text-ink-muted">halved with {r.loser}</span></>
  return <><b>{r.winner}</b> <span className="text-ink-muted">vs {r.loser}</span></>
}

function MatchCard({ matchPlay }) {
  const half = Math.ceil(matchPlay.rows.length / 2)
  const cols = [matchPlay.rows.slice(0, half), matchPlay.rows.slice(half)].filter(c => c.length)
  return (
    <ExportCard title="Match play" right={matchPlay.teamScore}>
      <div className="grid grid-cols-2 gap-x-8">
        {cols.map((rows, i) => (
          <div key={i}>
            {rows.map(r => (
              <div key={r.id} className={rowCls}>
                <span className="w-7 shrink-0 text-[11px] font-semibold text-ink-muted">{r.id}</span>
                <span className="min-w-0 flex-1">{matchLine(r)}</span>
                <MarginPill>{r.margin}</MarginPill>
              </div>
            ))}
          </div>
        ))}
      </div>
    </ExportCard>
  )
}

export function resultsTiles(view) {
  const t = view.tiles
  const tiles = t.lowNet.map(l => ({
    label: l.flight ? `Low net · Flight ${l.flight}` : 'Low net',
    value: l.name,
    helper: l.net != null ? `Net ${l.net}${l.total ? ` · ${money(l.total)} total` : ''}` : null,
    tone: 'good',
  }))
  tiles.push({ label: 'Total pot', value: money(t.pot.value), helper: `${t.pot.paid} of ${t.pot.players} players paid` })
  if (t.match) tiles.push({ label: 'Match points', value: t.match.value, helper: t.match.helper })
  return tiles
}

export default function ResultsSheet({ view, leagueName, logoUrl }) {
  const tiles = resultsTiles(view)
  const sideRight = [view.ctp && 'ctp', (view.longDrive || view.lowPutts) && 'ld'].filter(Boolean)
  return (
    <ExportSheet>
      <ExportHeader
        leagueName={leagueName}
        logoUrl={logoUrl}
        title="Tournament results"
        pill="Final"
        meta={[view.eventName, view.courseName, view.dateShort].filter(Boolean).join(' · ')}
        right={[`${view.playerCount} players${view.hasFlights ? ` · ${view.flights.length} flights` : ''}`, 'Net scores · $ = payout']}
      />

      <StatTiles tiles={tiles} className={`mt-5 ${tiles.length === 3 ? '!grid-cols-3' : tiles.length === 2 ? '!grid-cols-2' : '!grid-cols-4'}`} />

      <div className="mt-5 space-y-4">
        {view.scoring && (
          <ExportCard title={view.scoring.title} right={view.scoring.scoreHeader}>
            <div className={view.scoring.columns.length > 1 ? 'grid grid-cols-2 gap-6' : ''}>
              {view.scoring.columns.map((c, i) => <ScoringColumn key={i} column={c} />)}
            </div>
          </ExportCard>
        )}

        {(view.skins || sideRight.length > 0) && (
          <div className={view.skins && sideRight.length > 0 ? 'grid grid-cols-2 items-start gap-4' : 'space-y-4'}>
            {view.skins && <SkinsCard skins={view.skins} />}
            {sideRight.length > 0 && (
              <div className="space-y-4">
                {view.ctp && <CtpCard ctp={view.ctp} />}
                {(view.longDrive || view.lowPutts) && <LongDriveAndPutts longDrive={view.longDrive} lowPutts={view.lowPutts} />}
              </div>
            )}
          </div>
        )}

        {view.extras.map(e => <ExtraCard key={e.title} extra={e} />)}
        {view.matchPlay && <MatchCard matchPlay={view.matchPlay} />}
        {view.teamMatch && (
          <ExportCard title={view.teamMatch.title} right={view.teamMatch.score}>
            {view.teamMatch.rows.map(r => (
              <div key={r.id} className={rowCls}>
                <span className="w-7 shrink-0 text-[11px] font-semibold text-ink-muted">{r.id}</span>
                <span className="min-w-0 flex-1 font-bold">{r.text}</span>
                <MarginPill>{r.margin}</MarginPill>
              </div>
            ))}
          </ExportCard>
        )}
      </div>

      <ExportFooter left={`Final results · ${view.dateShort}`} />
    </ExportSheet>
  )
}
