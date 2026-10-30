/** Save a rendered ticket as a PNG (same html-to-image approach as the other wager exports). */
export async function saveTicketPng(el, filename, background) {
  const { toPng } = await import('html-to-image')
  const imgs = [...el.querySelectorAll('img')]
  await Promise.all(imgs.map(i => (i.decode ? i.decode().catch(() => {}) : Promise.resolve())))
  if (document.fonts?.ready) await document.fonts.ready
  await new Promise(r => setTimeout(r, 80))
  const dataUrl = await toPng(el, { pixelRatio: 2, cacheBust: true, backgroundColor: background })
  const link = document.createElement('a')
  link.download = filename
  link.href = dataUrl
  link.click()
}

export const ticketPngFilename = ticketId => `wager-ticket-${String(ticketId).toLowerCase()}.png`
