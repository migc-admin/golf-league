// The blog's author, in one place: the /author page, every post's byline, and the
// Person markup (JSON-LD) all read from here, so they always match.
//
// sameAs: only profiles Kevin actually runs (personal LinkedIn, X, ...). Add them here
// when ready; they flow into the Person markup on every post and the author page.
// photo: a path under /public, once there is a headshot to use.
import { BLOG_POSTS } from './blogPosts'

export const SITE = 'https://www.scorifygolf.com'

export const AUTHOR = {
  slug: 'kevin-vargas',
  name: 'Kevin Vargas',
  jobTitle: 'Founder, Scorify Golf',
  short: 'Built Scorify Golf to run his own golf league\'s live scoring and season standings, then opened it up to other independent league directors.',
  bio: [
    'Kevin Vargas is the founder of Scorify Golf and helps run a monthly golf league in San Diego with two other admins. The league has 40 players on the roster, a waitlist of golfers who want in, and 28 to 32 players teeing it up at each event.',
    'The league plays two flights, keeps season-long standings and a team competition, and finishes the year with match play playoffs. For years Kevin was the one at the scoring table after every round, typing paper scorecards into a spreadsheet while everyone else waited for results.',
    'Scorify Golf grew out of that job. Kevin built it to run his own league\'s live scoring, side game payouts, and season standings, then opened it up to other independent league directors.',
  ],
  sameAs: [],
  photo: null,
}

export const AUTHOR_PATH = `/author/${AUTHOR.slug}`
export const AUTHOR_URL = `${SITE}${AUTHOR_PATH}`

/** Person node for JSON-LD, shared by the author page and every post. */
export function authorPerson() {
  return {
    '@type': 'Person',
    '@id': `${AUTHOR_URL}#person`,
    name: AUTHOR.name,
    url: AUTHOR_URL,
    jobTitle: AUTHOR.jobTitle,
    description: AUTHOR.short,
    worksFor: { '@id': `${SITE}/#organization` },
    ...(AUTHOR.photo ? { image: `${SITE}${AUTHOR.photo}` } : {}),
    ...(AUTHOR.sameAs.length ? { sameAs: AUTHOR.sameAs } : {}),
  }
}

/** Every post, newest first (all posts are Kevin's). */
export function authorPosts() {
  return [...BLOG_POSTS].sort((a, b) => new Date(b.date) - new Date(a.date))
}
