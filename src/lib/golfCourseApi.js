/**
 * GolfCourseAPI client — https://api.golfcourseapi.com
 * Docs: openapi.yml
 *
 * Auth: Authorization: Key <api_key> header
 * The key is read from VITE_GOLF_COURSE_API_KEY (.env.local, gitignored).
 * This is an admin-only read-only integration so exposing it in the Vite
 * bundle is acceptable; rotate the key if it leaks.
 */

const BASE = 'https://api.golfcourseapi.com'
const KEY  = import.meta.env.VITE_GOLF_COURSE_API_KEY

async function apiFetch(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Key ${KEY}` },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `GolfCourseAPI error ${res.status}`)
  }
  return res.json()
}

/** Search by course or club name. Returns array of CourseSearch results. */
export async function searchCourses(query) {
  const data = await apiFetch(`/v1/search?search_query=${encodeURIComponent(query.trim())}`)
  return data.courses ?? []
}

/** Fetch full course detail by numeric id, including tee boxes + hole data. */
export async function fetchCourseById(id) {
  return apiFetch(`/v1/courses/${id}`)
}

/**
 * Map an API Course object → our internal tees + holes format.
 *
 * API structure:
 *   course.tees.male[]  / course.tees.female[]
 *     each TeeBox: { tee_name, slope_rating, course_rating, holes[18] }
 *     each hole:   { par, yardage, handicap }   (handicap = stroke index)
 *
 * We prefer male tees; fall back to female if none.
 * Returns: { name, tees: [{name,color,slope,rating}], holes: [{hole,par,stroke_index,yardages}] }
 */
export function mapApiCourseToForm(course) {
  const courseName = [course.club_name, course.course_name]
    .filter(Boolean)
    .join(' — ')

  const apiTees = (course.tees?.male?.length ? course.tees.male : course.tees?.female) ?? []

  // Filter to tees that have 18-hole data
  const validTees = apiTees.filter(t => t.holes?.length === 18)
  if (!validTees.length) return null

  const tees = validTees.map(t => ({
    name:   t.tee_name ?? 'Unknown',
    color:  inferTeeColor(t.tee_name),
    slope:  t.slope_rating ?? 113,
    rating: t.course_rating ?? 72.0,
  }))

  const holes = Array.from({ length: 18 }, (_, i) => ({
    hole:         i + 1,
    par:          validTees[0].holes[i].par,
    stroke_index: validTees[0].holes[i].handicap,
    yardages:     validTees.map(t => t.holes[i].yardage ?? 0),
  }))

  return { name: courseName, tees, holes }
}

const COLOR_MAP = {
  black:   'Black',
  blue:    'Blue',
  white:   'White',
  gold:    'Gold',
  red:     'Red',
  green:   'Green',
  silver:  'White',
  champion:'Black',
  tips:    'Black',
  forward: 'Red',
  senior:  'Gold',
}

function inferTeeColor(teeName) {
  if (!teeName) return 'White'
  const lower = teeName.toLowerCase()
  for (const [keyword, color] of Object.entries(COLOR_MAP)) {
    if (lower.includes(keyword)) return color
  }
  return 'White'
}
