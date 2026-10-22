// Fills the blog post list inside public/llms.txt from src/lib/blogPosts.js, so a
// new post is listed for AI tools automatically. Runs before every build (see
// "prebuild" in package.json) and by hand with: node scripts/generate-llms.mjs
// Only the text between the blog-posts:start / blog-posts:end markers is replaced.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { BLOG_POSTS } from '../src/lib/blogPosts.js'

const SITE = 'https://www.scorifygolf.com'
const file = fileURLToPath(new URL('../public/llms.txt', import.meta.url))
const START = '<!-- blog-posts:start -->'
const END = '<!-- blog-posts:end -->'

const posts = [...BLOG_POSTS].sort((a, b) => new Date(b.date) - new Date(a.date))
const list = posts
  .map(p => `- [${p.title}](${SITE}/blog/${p.slug}): ${p.metaDescription ?? p.excerpt}`)
  .join('\n')

const text = readFileSync(file, 'utf8')
const i = text.indexOf(START), j = text.indexOf(END)
if (i === -1 || j === -1 || j < i) throw new Error('llms.txt is missing the blog-posts markers')
writeFileSync(file, `${text.slice(0, i + START.length)}\n${list}\n${text.slice(j)}`)
console.log(`llms.txt: ${posts.length} blog posts listed`)
