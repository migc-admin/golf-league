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
    date: '2026-09-15',
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
    date: '2026-09-15',
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
]

export function getBlogPost(slug) {
  return BLOG_POSTS.find(p => p.slug === slug)
}
