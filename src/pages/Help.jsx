/**
 * Help — Admin guide at /help
 * Step-by-step tutorials for setting up leagues, events, players, scoring, and Team Play.
 * Collapsed by default, expandable sections.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Footer from '../components/ui/Footer'

const GREEN = '#1B4332'
const GOLD  = '#D4AF37'
const INK   = '#1d1d1f'

const SECTIONS = [
  {
    category: 'Quick Start — Setting Up Your League',
    intro: 'New to Scorify Golf? Follow these steps in order to get your league up and running.',
    items: [
      {
        q: 'Step 1 — Create your organization',
        a: `When you first sign up, you'll be prompted to name your organization. This is the umbrella name that all your leagues and events will appear under (e.g. "Mulligan's Island Golf Club").

Your organization name appears on public leaderboards, standings pages, and printable scorecards. You can update it later in Admin → Settings.`,
      },
      {
        q: 'Step 2 — Create your first league',
        a: `Go to Admin → Leagues and click "New League."

Fill in:
• League Name — e.g. "Tuesday Night Stroke Play"
• Description (optional) — displayed on public pages
• Season start / end dates

Each league operates independently with its own events, players, standings, and Team Play setup. If you run multiple formats (e.g. stroke play + match play), create a separate league for each.`,
      },
      {
        q: 'Step 3 — Add your course',
        a: `Go to Admin → Courses and click "Add Course."

You'll need:
• Course name
• Number of holes (9 or 18)
• Par per hole
• Stroke index (handicap difficulty ranking) per hole
• Tee options — name, slope rating, course rating

Accurate slope and rating are required for course handicap calculations. These are printed on the course scorecard. You can add multiple tees (e.g. White, Blue, Red) to the same course.

Once a course is saved, it's available for all events in your organization.`,
      },
      {
        q: 'Step 4 — Add players to your roster',
        a: `Go to Admin → Players and click "Add Player."

Each player needs:
• First name and last name
• Handicap Index (optional but recommended for net scoring)
• Email address (optional — used for online registration)
• GHIN number (optional)

Players are shared across all leagues in your organization. You add them to specific events individually, not to the league directly.`,
      },
      {
        q: 'Step 5 — Create an event',
        a: `Go to Admin → Leagues → [Your League] and click "New Event."

Fill in:
• Event name (e.g. "Round 1 — Coronado Golf Club")
• Event date
• Course
• Format — stroke play, Stableford, match points, or low putts
• Shotgun start toggle (if applicable)
• Flights — toggle on if splitting into Flight A / Flight B

After creating the event, go to the Players tab to add players to the event roster.`,
      },
      {
        q: 'Step 6 — Add players to the event',
        a: `From the event's Players & Flights tab, click "+ Add Player to Event."

Select players from your roster. If a player isn't in your roster yet, add them first via Admin → Players.

If your event uses flights, assign each player to Flight A or Flight B. Players without a flight assigned will not appear on the leaderboard or count toward TGL points.

You can also set each player's tee assignment and override their handicap index for this specific event.`,
      },
      {
        q: 'Step 7 — Set up groups (optional)',
        a: `Go to the Groups tab within the event.

Assign players to groups (typically 2–4 players per group). If using a shotgun start, assign each group a starting hole.

Groups are used for:
• Digital scorecard access — players in the same group share a scorecard
• Printable cart signs and tee sheets
• QR code and group code entry

Ungrouped players will not be able to access a digital scorecard.`,
      },
      {
        q: 'Step 8 — Share the scoring link',
        a: `From the event Overview tab, find the Scoring Access section.

Each group has a unique QR code and a short group code. On the day of the round:
• Print scorecards or cart signs (from the Overview tab) to distribute QR codes
• Players scan the QR code or enter the group code at scorifygolf.com/join/[eventId]
• No account or app download required

Scores are entered hole by hole and sync to the live leaderboard automatically.`,
      },
      {
        q: 'Step 9 — Enter or review scores',
        a: `Scores can be entered by players via their digital scorecard, or by the admin directly in the event.

To edit scores as an admin: from the Overview tab, click "Edit Scores." Select a player from the sidebar and enter their hole-by-hole gross scores and putts.

The leaderboard updates automatically as scores are saved.`,
      },
      {
        q: 'Step 10 — Configure payouts and close the event',
        a: `Go to the Payout tab to configure prize amounts for:
• Overall finishers (gross and net)
• Flight A and Flight B finishers
• Skins
• Closest to the Pin (CTP)
• Long Drive
• Low Putts

Once all scores are entered and payouts are set, the Payout Summary shows the final breakdown per player.

When the event is complete, update the event status to "Complete" in the Overview tab. Completed events roll up to season standings automatically.`,
      },
    ],
  },
  {
    category: 'Managing Players',
    items: [
      {
        q: 'Adding players to your roster',
        a: `Go to Admin → Players → "Add Player."

Players are added once to your organization roster and can then be added to any event. You do not need to re-enter player information for each event.

Required: First name, last name.
Optional: Email, handicap index, GHIN number.`,
      },
      {
        q: 'Editing a player\'s handicap',
        a: `From Admin → Players, find the player and click "Edit."

The Handicap Index field stores the player's USGA/WHS index. Scorify converts this to a Course Handicap automatically for each event using:

Course Handicap = Handicap Index × (Slope ÷ 113) + (Course Rating − Par)

You can also override the course handicap for a specific event from the Players & Flights tab within that event — useful if a player is playing off a different index that day.`,
      },
      {
        q: 'Guests vs. rostered players',
        a: `When adding a player to an event, you can mark them as a "Guest." Guest players:
• Appear on the scorecard and leaderboard
• Do not count toward TGL points
• Are excluded from season standings and payout calculations by default

Use guests for one-off participants who are not part of your regular league roster.`,
      },
      {
        q: 'Online registration (Club plan)',
        a: `Each event has a public registration link you can share with players. Go to the event Overview tab to find the registration URL.

Players fill out their name, email, and any notes, then submit. You'll see their registration in the Players tab → Registrations section, with status Pending.

To confirm a registration and add them to the event roster, click "Confirm + Add to Roster." This creates the player in your system (if they don't exist) and adds them to the event.

Payment is collected outside Scorify (e.g. Venmo or PayPal). Once you confirm payment, manually update the registration status to Confirmed.`,
      },
    ],
  },
  {
    category: 'Managing Courses',
    items: [
      {
        q: 'Adding a new course',
        a: `Go to Admin → Courses → "Add Course."

You'll need the scorecard in front of you. Enter:
• Course name and location
• For each tee: tee name (e.g. "White"), slope rating, course rating
• Par for each hole (1–18)
• Stroke index for each hole (1–18, where 1 = hardest hole)

Slope and course rating are printed on every scorecard. These are required for accurate course handicap calculation.

Once saved, the course is available for all events in your organization.`,
      },
      {
        q: 'Adding multiple tees to a course',
        a: `After creating a course, you can add additional tee options (e.g. Blue, White, Red, Gold) from the course edit page.

Each tee has its own slope and rating. When you assign a tee to a flight in an event, Scorify uses that tee's slope/rating to calculate course handicaps for players in that flight.

This is useful when Flight A plays from the back tees and Flight B plays from the forward tees.`,
      },
      {
        q: 'Editing course or hole data',
        a: `Go to Admin → Courses and find your course. Click "Edit" to update course-level info (name, location).

To edit hole-by-hole data (par, stroke index), click "Edit Holes" for the relevant tee.

Be careful updating stroke index on a course with prior events — it will affect handicap strokes on old scorecards. If the course has made layout changes, it's better to add a new tee rather than editing the existing one.`,
      },
    ],
  },
  {
    category: 'Scoring & Leaderboards',
    items: [
      {
        q: 'How digital scoring works',
        a: `Players access their scorecard by scanning a QR code or entering a group code at scorifygolf.com/join/[eventId]. No account is required.

Once in, they see their group's scorecard with all players listed. Scores are entered hole by hole — gross score and putts (if tracking putts).

Scores sync to the admin view and leaderboard in real time. The admin can also see and edit all scores from the event's Overview tab → "Edit Scores."`,
      },
      {
        q: 'Gross vs. net scoring',
        a: `Gross score — raw stroke total, no adjustments.

Net score — gross minus course handicap. Scorify calculates each player's course handicap automatically from their handicap index, the course's slope rating, course rating, and par.

Leaderboards show both gross and net standings. Payouts and TGL points are based on net scoring.`,
      },
      {
        q: 'Flights — what they do and when to use them',
        a: `Flights split your field into two groups — typically Flight A (lower handicaps) and Flight B (higher handicaps) — so players compete against others at a similar skill level.

When flights are enabled:
• Leaderboards are split into Flight A and Flight B
• Payouts can be configured separately per flight
• TGL points are scored within each flight independently

To enable flights: toggle "Use Flights" when creating or editing the event. Then assign each player to Flight A or Flight B in the Players & Flights tab.

Players without a flight assigned are excluded from leaderboard rankings. Always check that all players have a flight set before the round.`,
      },
      {
        q: 'Skins',
        a: `Skins are a hole-by-hole side game. The player with the lowest net score on a hole wins that hole's skin outright. Ties carry the skin to the next hole.

To set up skins: go to the Payout tab → Side Games → enable Skins. Set the entry amount per player. Scorify calculates skins automatically from net scores once all scores are entered.

Skins results appear in the Payout Summary.`,
      },
      {
        q: 'Closest to the Pin (CTP) and Long Drive',
        a: `CTP and Long Drive are manual side games. Scorify does not auto-detect these — winners are recorded manually by the admin.

To set up: go to Payout tab → Side Games → enable CTP and/or Long Drive. Designate which holes apply.

Print the CTP/Long Drive cards from the Event Overview to track results on the course. After the round, enter the winner in the Payout tab.`,
      },
      {
        q: 'Exporting scores',
        a: `From the event Overview tab, click "Export" to download a CSV of all scores.

The export includes each player's gross and net score per hole, total gross, total net, total putts, flight, and course handicap.

Score export is available on Pro and Club plans.`,
      },
    ],
  },
  {
    category: 'Team Play (TGL)',
    items: [
      {
        q: 'What is Team Play and how is it set up?',
        a: `Team Play (called TGL in Scorify) lets players compete as standing teams across a season — similar to a Ryder Cup format.

Setup steps:
1. Go to Admin → Leagues → [Your League] → Team Play tab
2. Click "New Team" and name each team (e.g. "19th Hole Cartel," "Just the Tips")
3. Assign players to teams using the team roster section
4. Each team typically has a color for visual identification

Teams persist across all events in the league. You don't need to recreate them each round.`,
      },
      {
        q: 'Selecting players for each event',
        a: `Before each round, the admin selects which players from each team are "active" for that event — typically 2 players per team.

Go to the event's Team Play tab and select the active players for each team. Only these players' TGL points will count toward the team's event score.

This allows flexibility: if a team member misses a round, you simply don't select them and choose a different team member instead.`,
      },
      {
        q: 'How TGL points are calculated',
        a: `Points are based on net score finish position within each flight:

Points = Flight size − finishing position + 1

So in a 16-player flight:
• 1st place = 16 pts
• 2nd place = 15 pts
• Last place = 1 pt

Ties split the combined points for the tied positions equally. For example, a 4-way tie for 3rd in a 16-player flight splits positions 3, 4, 5, 6:
(14 + 13 + 12 + 11) ÷ 4 = 12.5 pts each

Flight A and Flight B are scored independently. A 1st place finish in Flight B earns the same points as 1st in Flight A if both flights are the same size.

Each team's event score = sum of their 2 selected players' individual points.`,
      },
      {
        q: 'Locking TGL results for an event',
        a: `Once all scores are entered and you're satisfied with the results, lock the event in the Team Play tab. Locking freezes the TGL point calculations for that event so they appear in the season standings.

Unlocked events are excluded from season standings. Always lock events after the round is complete.`,
      },
      {
        q: 'Renaming Team Play for your league',
        a: `The "Team Play" label can be customized to match your league's format.

Go to Admin → Leagues → [Your League] → Settings and update the Team Play label to anything you prefer — "Ryder Cup," "TGL," "League Cup," "Match Play," etc.

This label appears throughout the admin, leaderboards, and standings pages.`,
      },
      {
        q: 'Season standings',
        a: `TGL season standings accumulate team points across all locked events.

Go to the public Standings page for your league (shareable with players) and toggle to the TGL view. Each event's results are shown in a collapsible row — click any event to see which players were selected and how many points they contributed.

The team with the most cumulative points at the end of the season wins.`,
      },
    ],
  },
  {
    category: 'Print Assets',
    items: [
      {
        q: 'Tee Sheet',
        a: `The Tee Sheet is a printable list of all groups with their players, tee times, and starting holes (for shotgun events).

Generate it from the event Overview tab → Print Assets → "Tee Sheet."

Best practice: post the tee sheet at the pro shop or send it to players the morning of the event.`,
      },
      {
        q: 'Cart Signs',
        a: `Cart Signs generate one sign per group, showing the group's players, tee time, and starting hole.

Generate them from the event Overview tab → Print Assets → "Cart Signs."

Print and place one in each golf cart before the round. Includes a QR code for scorecard access.`,
      },
      {
        q: 'CTP / Long Drive Cards',
        a: `Printable cards for tracking Closest to the Pin and Long Drive results on the course.

Generate from the event Overview tab → Print Assets → "CTP / Long Drive."

Place one card at each designated CTP or Long Drive hole. The on-course marker or a designated player records the winner.`,
      },
      {
        q: 'Scorecards',
        a: `Printable scorecards can be exported for each group, pre-filled with player names, course details, hole pars, stroke indexes, and a QR code for digital score entry.

Generate from the event Overview tab → "Export Scorecards."`,
      },
    ],
  },
  {
    category: 'Settings & Account',
    items: [
      {
        q: 'Updating your organization name or branding',
        a: `Go to Admin → Settings to update your organization name.

On the Club plan, custom branding options are available including logo upload. Your logo appears on public leaderboards, standings pages, and printable scorecards.`,
      },
      {
        q: 'Changing your subscription plan',
        a: `Go to Admin → Settings → Plan & Billing to view your current plan and upgrade or downgrade.

Upgrades take effect immediately. Downgrades take effect at the end of the current billing period.

If you need to cancel, go to Settings and cancel before the next billing date. Your data is retained and accessible for reactivation.`,
      },
      {
        q: 'Adding additional admins (Club plan)',
        a: `The Club plan supports up to 3 admin users per organization.

To add an admin: the new admin must first create a Scorify Golf account. Then go to Admin → Settings and add them by email address. They will have full admin access to all leagues and events in your organization.`,
      },
      {
        q: 'Questions or feature requests',
        a: `Email us at admin@scorifygolf.com. We respond within 2 business days.

We actively build based on league admin feedback — if there's a format or feature your league needs, let us know.`,
      },
    ],
  },
]

function HelpItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-4 py-5 text-left"
      >
        <span className="text-sm font-semibold text-gray-900">{q}</span>
        <span
          className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-transform"
          style={{ background: open ? GREEN : '#f3f4f6', transform: open ? 'rotate(45deg)' : 'none' }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M5 1v8M1 5h8" stroke={open ? '#fff' : '#6b7280'} strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </span>
      </button>
      {open && (
        <div className="text-sm text-gray-600 leading-relaxed pb-5 space-y-2">
          {a.split('\n\n').map((block, i) => (
            <p key={i} style={{ whiteSpace: 'pre-line' }}>{block}</p>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Help() {
  return (
    <>
      <Helmet>
        <title>Help & Setup Guide — Scorify Golf</title>
        <meta name="description" content="Step-by-step guide to setting up your golf league, events, players, scoring, Team Play, and more in Scorify Golf." />
        <meta property="og:title" content="Help & Setup Guide — Scorify Golf" />
        <link rel="canonical" href="https://scorifygolf.com/help" />
      </Helmet>

      <div className="min-h-screen flex flex-col" style={{ background: '#fbfaf8', color: INK }}>

        {/* Header */}
        <header className="sticky top-0 z-50 bg-white" style={{ borderBottom: '1px solid #ebe9e4' }}>
          <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
            <Link to="/home" className="flex items-center gap-2.5">
              <img src="/logo.png" alt="Scorify Golf" className="w-8 h-8 object-contain" />
              <span className="font-bold text-base" style={{ letterSpacing: '-0.02em', color: INK }}>Scorify Golf</span>
            </Link>
            <div className="flex items-center gap-3">
              <Link to="/faq" className="text-sm font-medium" style={{ color: '#6b7280' }}>FAQ</Link>
              <Link
                to="/login"
                className="text-sm font-bold px-4 py-1.5 rounded-full text-white transition-opacity hover:opacity-90"
                style={{ background: GREEN }}
              >
                Get started
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1">

          {/* Hero */}
          <section className="py-16 text-center px-6" style={{ background: `linear-gradient(150deg, #0b2318 0%, ${GREEN} 55%, #1f5c3e 100%)` }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: GOLD }}>Documentation</p>
            <h1 className="text-3xl md:text-5xl font-bold text-white mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
              Help & Setup Guide
            </h1>
            <p className="text-base max-w-xl mx-auto" style={{ color: 'rgba(255,255,255,0.65)' }}>
              Everything you need to set up your league, run events, score rounds, and manage Team Play.
            </p>
            <div className="mx-auto mt-5" style={{ width: 48, height: 2, background: GOLD }} />
          </section>

          {/* Jump links */}
          <section className="py-8 px-6 border-b" style={{ borderColor: '#ebe9e4' }}>
            <div className="max-w-3xl mx-auto">
              <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: '#9ca3af' }}>Jump to section</p>
              <div className="flex flex-wrap gap-2">
                {SECTIONS.map(s => (
                  <a
                    key={s.category}
                    href={`#${s.category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                    className="text-xs font-medium px-3 py-1.5 rounded-full border transition-colors hover:border-green-700 hover:text-green-800"
                    style={{ borderColor: '#ebe9e4', color: '#4b5563' }}
                  >
                    {s.category}
                  </a>
                ))}
              </div>
            </div>
          </section>

          {/* Sections */}
          <section className="py-16 px-6">
            <div className="max-w-3xl mx-auto space-y-12">
              {SECTIONS.map(section => (
                <div key={section.category} id={section.category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}>
                  <h2 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: GREEN }}>
                    {section.category}
                  </h2>
                  {section.intro && (
                    <p className="text-sm text-gray-500 mb-4">{section.intro}</p>
                  )}
                  <div className="bg-white rounded-2xl px-6 shadow-sm" style={{ border: '1px solid #ebe9e4' }}>
                    {section.items.map(item => (
                      <HelpItem key={item.q} q={item.q} a={item.a} />
                    ))}
                  </div>
                </div>
              ))}

              {/* Contact */}
              <div className="text-center py-8">
                <p className="text-base font-semibold text-gray-900 mb-2">Still need help?</p>
                <p className="text-sm text-gray-500 mb-6">Email us and we'll get back to you within 2 business days.</p>
                <a
                  href="mailto:admin@scorifygolf.com"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm text-white transition-opacity hover:opacity-90"
                  style={{ background: GREEN }}
                >
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  admin@scorifygolf.com
                </a>
              </div>
            </div>
          </section>

        </main>

        <Footer />
      </div>
    </>
  )
}
