// Static blog content — no CMS/DB, matches the pattern used by FAQ.jsx and
// Roadmap.jsx (hardcoded content array, edited directly in code). Add new
// posts by appending an entry here; Blog.jsx and BlogPost.jsx pick them up
// automatically.
//
// content blocks: { type: 'p', text } | { type: 'h2', text } | { type: 'ul', items: string[] }

export const BLOG_POSTS = [
  {
    slug: 'how-to-run-a-fair-skins-game',
    title: 'How to Run a Fair Skins Game',
    excerpt: 'Skins games are one of the easiest ways to add stakes to a casual round — but only if the rules are set before the first tee shot. Here\'s how to avoid the most common disputes.',
    date: '2026-08-11',
    category: 'Side Games',
    content: [
      { type: 'p', text: 'A skins game is simple in theory: whoever has the lowest score on a hole wins that hole\'s "skin." If two or more players tie for low score, the skin carries over to the next hole, growing the pot. In practice, most disputes come from ambiguity that was never resolved before the round started — not from the format itself.' },
      { type: 'h2', text: 'Decide gross or net before you tee off' },
      { type: 'p', text: 'Playing skins on gross score rewards your lowest-handicap players and can shut out higher handicappers from ever winning a hole. Playing net (applying handicap strokes on a hole-by-hole basis) levels the field, but requires everyone to know their course handicap and stroke allocation ahead of time. Most weekly leagues use net skins for exactly this reason — it keeps the game competitive for the whole field, not just the scratch players.' },
      { type: 'h2', text: 'Decide how ties and carryovers work' },
      { type: 'p', text: 'The most common format is "ties carry" — if two players tie for low score on a hole, no one wins it, and the value rolls into the next hole. Some groups instead split the skin between tied players rather than carrying it. Either is fine, but pick one before the round; switching mid-round after a controversial tie is where most arguments start.' },
      { type: 'h2', text: 'Set the buy-in and payout structure in advance' },
      { type: 'p', text: 'Common structures: a flat per-player buy-in with the full pot split among skin winners, or a fixed dollar value per skin with any leftover carryover skins paid out at the 18th hole. If you\'re running a larger group split into flights, decide whether skins are computed within each flight separately or across the full field — this changes the competitive dynamic significantly.' },
      { type: 'h2', text: 'Track it digitally to kill disputes before they start' },
      { type: 'p', text: 'The single biggest source of skins-game disputes is a handwritten scorecard with an ambiguous number, discovered after everyone has already left the course. Digital, hole-by-hole scoring — where every player\'s score is entered and visible in real time — removes the ambiguity entirely and settles the skins table automatically the moment the last group finishes.' },
    ],
  },
  {
    slug: 'flights-vs-full-field',
    title: 'Flights vs. Full Field: Choosing the Right Format for Your League',
    excerpt: 'Splitting your league into flights can make competition fairer — or it can just add complexity for no benefit. Here\'s how to know which format actually fits your group.',
    date: '2026-08-28',
    category: 'League Setup',
    content: [
      { type: 'p', text: 'One of the first decisions a new league admin faces is whether to run the whole field as one competition or split players into flights by handicap. Both are valid — the right choice depends on the size and skill spread of your group.' },
      { type: 'h2', text: 'When a full field makes sense' },
      { type: 'p', text: 'If your league is small (under roughly 16-20 players) or has a fairly tight handicap spread, a single full-field leaderboard is usually simpler and more fun — everyone is chasing the same standings, and net scoring already handles most of the fairness concerns. Extra flights on a small group can leave you with a "flight" of two or three players, which feels more like an arbitrary label than real competition.' },
      { type: 'h2', text: 'When flights make sense' },
      { type: 'p', text: 'Once your league grows past that range, or if you have a wide handicap spread (say, players ranging from scratch to 30+), flights keep the competition meaningful. A typical setup is two or three flights (A/B/C) based on handicap index, each with its own leaderboard, payouts, and season standings. This way a higher-handicap player is competing against others at a similar skill level rather than chasing scores they realistically can\'t catch.' },
      { type: 'h2', text: 'Re-evaluate flight cutoffs each season' },
      { type: 'p', text: 'Handicaps move. A player who started the season in Flight B might legitimately belong in Flight A by mid-season. Most leagues set flight cutoffs once per season (at signup) rather than recalculating mid-season, which keeps standings stable — but it\'s worth revisiting the cutoff handicaps each new season rather than reusing last year\'s numbers by default.' },
      { type: 'h2', text: 'Don\'t forget side games when you flight the field' },
      { type: 'p', text: 'If you\'re running flights, decide whether side games — skins, closest-to-the-pin, long drive — are scored within each flight or across the whole field. Flighted skins games in particular tend to feel fairer to higher-handicap players, since they\'re not just feeding skins to the lowest-handicap flight every week.' },
    ],
  },
  {
    slug: 'golf-handicaps-for-league-play',
    title: "A Beginner's Guide to Golf Handicaps for League Play",
    excerpt: 'If you\'re setting up a league and handicaps feel confusing, you\'re not alone. Here\'s a plain-English breakdown of what actually matters for weekly league play.',
    date: '2026-09-15',
    category: 'Scoring & Handicaps',
    content: [
      { type: 'p', text: 'Handicaps exist to let players of different skill levels compete fairly against each other. For casual league play, you don\'t need to understand every detail of the USGA/WHS calculation — you just need to know a few practical things.' },
      { type: 'h2', text: 'Handicap Index vs. Course Handicap' },
      { type: 'p', text: 'A player\'s Handicap Index is a portable number that follows them between courses — it reflects their general skill level. Their Course Handicap is that index converted for the specific course and tees being played that day, based on the course\'s slope and rating. In league play, what actually determines strokes given on the scorecard is the Course Handicap, not the raw Handicap Index — so the same player will have a different Course Handicap at a harder course than an easier one.' },
      { type: 'h2', text: 'Where the strokes actually go' },
      { type: 'p', text: 'Course Handicap strokes are distributed across holes according to that course\'s stroke index (sometimes called the handicap rating) for each hole — printed on the scorecard, typically 1 through 18 in order of difficulty. A player with a Course Handicap of 9 gets one extra stroke on the nine hardest-rated holes. This is what makes net scoring possible on a hole-by-hole basis, which matters for side games like net skins.' },
      { type: 'h2', text: 'GHIN numbers and posting scores' },
      { type: 'p', text: 'Players who maintain an official Handicap Index typically do so through their state or regional golf association using a GHIN number, and are expected to post eligible scores after each round so their index stays current. Casual leagues that don\'t require an official GHIN can still run a simplified in-house handicap — usually an average of recent net-of-par scores — which is easier to manage but won\'t be portable outside the league.' },
      { type: 'h2', text: 'Keep it current, not perfect' },
      { type: 'p', text: 'The most common mistake in league play isn\'t using the wrong handicap formula — it\'s letting handicaps go stale for an entire season. A player who improves significantly over a summer but keeps their early-season handicap will have an unfair edge in net competitions. Whatever system you use, revisit and update handicaps periodically rather than setting them once and forgetting them.' },
    ],
  },
  {
    slug: 'scorify-vs-golf-league-tracker',
    title: 'Scorify Golf vs. Golf League Tracker: Which One Fits Your League?',
    excerpt: 'Both platforms handle handicaps, live scoring, and standings for independent leagues. Here\'s how they actually differ, and which type of league director each one is built for.',
    date: '2026-09-22',
    category: 'Comparisons',
    content: [
      { type: 'p', text: 'If you\'re running an independent golf league and have outgrown spreadsheets and group texts, Golf League Tracker and Scorify Golf are two of the platforms you\'ll likely come across. Both automate handicaps, live scoring, and standings. The real difference between them isn\'t features on a checklist — it\'s how much setup and configuration you\'re willing to do before you can run a round.' },
      { type: 'h2', text: 'At a glance' },
      { type: 'table', headers: ['', 'Scorify Golf', 'Golf League Tracker'], rows: [
        { label: 'Starting price', a: 'Free (1 league, up to 16 players)', b: '$119/season per league after a 4-round trial' },
        { label: 'Setup style', a: 'Opinionated defaults, live same day', b: '250+ configuration settings' },
        { label: 'Mobile scoring', a: 'No login, no app download', b: 'Mobile-capable, account-based' },
        { label: 'Side games', a: 'Auto gross & net skins, Closest to the Pin', b: 'Skins contests, sub-request tracking' },
        { label: 'Team season format', a: 'Team Play — points across a full season', b: 'Not a standard offering' },
        { label: 'Best fit', a: 'Weekly / monthly / seasonal leagues', b: 'Simulator & disc golf leagues, complex formats' },
      ] },
      { type: 'p', text: 'Prices and features above reflect each provider\'s public site as of this post\'s publish date and are subject to change — always confirm current details directly with each provider before deciding.' },
      { type: 'h2', text: 'Setup and configuration' },
      { type: 'p', text: 'Golf League Tracker has been around a long time and has grown to support an enormous range of formats — it publishes more than 250 configuration settings, covering everything from simulator leagues to disc golf. That flexibility is real, but it comes with a learning curve: a new admin has to work through a lot of screens before their first event is ready to go. Scorify Golf takes the opposite approach — it\'s opinionated by design, with sensible defaults for the formats a typical weekly or seasonal league actually uses (stroke play, net skins, match play, Team Play), so a league director can build their tee sheet and go live the same day.' },
      { type: 'h2', text: 'Live scoring experience' },
      { type: 'p', text: 'Both platforms support mobile score entry so players aren\'t handing a paper card to one overworked scorer at the end of the round. Scorify is built mobile-first from the ground up — players scan a QR code or follow a link and start entering scores hole-by-hole with no app download and no login required, and the leaderboard updates in real time as groups finish holes. Tap any screen below to see it full-size.' },
      { type: 'liveScoring' },
      { type: 'h2', text: 'Live leaderboard, example' },
      { type: 'p', text: 'Here\'s what a live leaderboard looks like mid-round, using sample data — no real players or scores.' },
      { type: 'leaderboard', title: 'Wednesday Night League — Live Leaderboard (Sample Data)', rows: [
        { rank: 1, name: 'J. Alvarez', thru: 14, score: '-3' },
        { rank: 2, name: 'M. Chen', thru: 15, score: '-2' },
        { rank: 3, name: 'S. Patel', thru: 13, score: '-1' },
        { rank: 4, name: 'D. Nguyen', thru: 16, score: 'E' },
        { rank: 5, name: 'R. Foster', thru: 12, score: '+1' },
      ] },
      { type: 'h2', text: 'Side games and team formats' },
      { type: 'p', text: 'Golf League Tracker covers the standard stroke play, match play, Stableford, and best-ball formats you\'d expect from a mature platform, plus skins contests and sub-request tracking. Scorify adds a few things purpose-built for the "regular weekly group" use case: automatic gross and net skins, printable cart signs and Closest to the Pin signs for round day, and Team Play — a season-long team points format for leagues that split players into teams and track standings across a full season — something that isn\'t a standard part of most league platforms.' },
      { type: 'p', text: 'Round-day print assets are built in and ready before the first tee time — examples below use sample data.' },
      { type: 'printAssets' },
      { type: 'h2', text: 'Pricing and getting started' },
      { type: 'p', text: 'Golf League Tracker\'s free trial covers your first 4 rounds (League Manager) or 10 scores per player (Handicap Manager); after that, League Manager pricing starts at $119 per league for a season (up to 30 rounds), with volume discounts down to $89/league for 10+ leagues, plus optional add-ons like the Image/Document Gallery and Premium E-mail at $20/season each. Scorify Golf\'s Starter plan is free indefinitely for one league up to 16 players — no credit card required — and Pro (unlimited players, up to 2 leagues, flights, skins, Closest to the Pin, and CSV export) runs $29/month or $199/year. Either way, organizers collect player dues through their own Venmo or PayPal link rather than routing payments through the platform, so neither service takes a cut of buy-ins.' },
      { type: 'h2', text: 'Which one should you use?' },
      { type: 'p', text: 'If you\'re running a simulator league, a disc golf league, or a format unusual enough that you need deep configurability and don\'t mind the setup time, Golf League Tracker\'s flexibility and long track record are real advantages. If you\'re an independent director running a standard weekly, monthly, or seasonal golf league — and you\'d rather be playing than configuring settings — Scorify is built specifically for that: fast setup, mobile-first scoring, and season-long Team Play standings without a 200-option config screen standing between you and your first tee time.' },
    ],
  },
]

export function getBlogPost(slug) {
  return BLOG_POSTS.find(p => p.slug === slug)
}
