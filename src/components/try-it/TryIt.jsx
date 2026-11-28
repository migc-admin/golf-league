// Homepage "Try it" section: a whole sample league night in five steps —
// build groups, print the round-day sheets, score, payouts, season standings.
// Scores and groups are shared across steps, so each step reflects the others.
// All math comes from src/lib/scoringDemo.js (same stroke allocation as real rounds).
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DEMO_GROUP, DEMO_HOLES, buildGroups, roundComplete } from '../../lib/scoringDemo'
import { GREEN, GOLD, INK, NeedsScores, Panel, SAMPLE } from './shared'
import GroupsStep from './GroupsStep'
import PrintStep from './PrintStep'
import ScoreStep from './ScoreStep'
import PayoutsStep from './PayoutsStep'
import StandingsStep from './StandingsStep'

const STEPS = [
  { key: 'groups',    label: 'Build groups' },
  { key: 'print',     label: 'Printouts' },
  { key: 'score',     label: 'Score' },
  { key: 'payouts',   label: 'Payouts' },
  { key: 'standings', label: 'Standings' },
]

const INTRO = {
  groups: 'Turn the sign-up list into foursomes with tee times in one click.',
  print: 'Tee sheet, cart signs, and contest signs are ready to print from the groups.',
  score: 'This is the scoring screen your players get. It runs in any phone\'s browser, with no app and no login.',
  payouts: 'When the last score is in, every prize is worked out. No calculator, no spreadsheet.',
  standings: 'Tonight\'s winnings roll straight into the season standings.',
}

export default function TryIt() {
  const [step, setStep] = useState('score')
  const [scores, setScores] = useState({})
  const [mode, setMode] = useState(null)
  const [groups, setGroups] = useState(null)

  const build = m => { setMode(m); setGroups(buildGroups(m)) }
  const shownGroups = groups ?? buildGroups('mixed')
  const complete = roundComplete(scores)

  const fillRound = () => {
    const next = { ...scores }
    DEMO_GROUP.forEach((p, i) => {
      next[p.id] = { ...(next[p.id] ?? {}) }
      for (const h of DEMO_HOLES) if (next[p.id][h.number] == null) next[p.id][h.number] = SAMPLE[h.number][i]
    })
    setScores(next)
  }

  const go = key => {
    setStep(key)
    document.getElementById('try-it')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <section id="try-it" className="py-20 md:py-24 scroll-mt-14" style={{ background: `linear-gradient(160deg, #0b2318, ${GREEN})` }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="max-w-2xl mb-8">
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: GOLD }}>Try it</p>
          <h2 className="text-3xl md:text-4xl font-bold text-white" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.01em' }}>
            Run a league night right here.
          </h2>
          <p className="mt-4 text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>
            Build the groups, print the sheets, score a few holes, and watch payouts and season standings settle themselves.
            Sample players, real Scorify math.
          </p>
        </div>

        {/* Steps */}
        <div role="tablist" aria-label="Demo steps" className="flex gap-2 overflow-x-auto pb-2 mb-6 -mx-4 px-4 sm:mx-0 sm:px-0">
          {STEPS.map((s, i) => {
            const on = s.key === step
            return (
              <button key={s.key} role="tab" type="button" aria-selected={on} aria-controls="try-it-panel" onClick={() => setStep(s.key)}
                className="shrink-0 flex min-h-[44px] items-center gap-2 rounded-full pl-2 pr-4 text-sm font-bold transition-colors"
                style={on ? { background: '#fff', color: INK } : { background: 'rgba(255,255,255,0.1)', color: '#fff' }}>
                <span className="flex items-center justify-center w-6 h-6 rounded-full text-xs"
                  style={on ? { background: GREEN, color: '#fff' } : { background: 'rgba(255,255,255,0.15)', color: '#fff' }}>{i + 1}</span>
                {s.label}
              </button>
            )
          })}
        </div>
        <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.75)' }} aria-live="polite">{INTRO[step]}</p>

        <div id="try-it-panel" role="tabpanel">
          {step === 'groups' && <GroupsStep groups={groups} mode={mode} onBuild={build} onNext={() => go('print')} />}
          {step === 'print' && <PrintStep groups={shownGroups} onNext={() => go('score')} />}
          {step === 'score' && <ScoreStep scores={scores} setScores={setScores} onSubmit={() => go('payouts')} />}
          {step === 'payouts' && (complete
            ? <PayoutsStep scores={scores} onNext={() => go('standings')} />
            : <Panel><NeedsScores onFill={fillRound} onGoScore={() => setStep('score')} /></Panel>)}
          {step === 'standings' && (complete
            ? <StandingsStep scores={scores} />
            : <Panel><NeedsScores onFill={fillRound} onGoScore={() => setStep('score')} /></Panel>)}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-10">
          <Link to="/login" className="text-center px-7 py-3 rounded-full font-bold text-sm transition-opacity hover:opacity-90" style={{ background: GOLD, color: '#1a1a1a' }}>
            Get started free
          </Link>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Sample players and scores. In a real round, every phone in the group sees updates live.
          </p>
        </div>
      </div>
    </section>
  )
}
