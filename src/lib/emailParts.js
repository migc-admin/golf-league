/**
 * Building blocks shared by the pre-round and results emails. Gmail-friendly HTML: table layout and
 * inline styles only (no classes, flex or grid), Arial/Helvetica, nothing wider than the outer shell.
 */
export const GREEN = '#1B4332'
export const GOLD  = '#C9A84C'
export const FONT  = 'Arial, Helvetica, sans-serif'
export const LINE   = '#e5e7eb'
export const MUTED  = '#6b7280'
export const INK    = '#1d1d1f'
export const TINT_G = '#eaf1ec'
export const TINT_N = '#f4f3f0'
export const TINT_Y = '#f4f1e4'

export function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export function longDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}

export function shortDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function labelHtml(text, color = GREEN) {
  return `<div style="font-family:${FONT};font-size:11px;font-weight:bold;letter-spacing:1.4px;text-transform:uppercase;color:${color};">${esc(text)}</div>`
}

/** A labelled section with a thin grey rule above it. */
export function section(label, inner) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;">
      <tr><td style="border-top:1px solid ${LINE};padding-top:16px;">
        ${labelHtml(label)}
        <div style="height:10px;line-height:10px;font-size:0;">&nbsp;</div>
        ${inner}
      </td></tr>
    </table>`
}

export function pill(label, href, filled) {
  const style = filled
    ? `background:${GREEN};color:#ffffff;border:1px solid ${GREEN};`
    : `background:#ffffff;color:${GREEN};border:1px solid ${GREEN};`
  return `<a href="${esc(href)}" style="display:inline-block;${style}font-family:${FONT};font-size:15px;font-weight:bold;text-decoration:none;padding:13px 24px;border-radius:8px;">${esc(label)}</a>`
}

/** Centered header: logo (only with a public URL), league, optional status pill, title, gold bar, lines. */
export function headerBlock({ leagueName, logoUrl, statusPill, title, lines = [] }) {
  const logo = logoUrl && /^https?:\/\//.test(logoUrl)
    ? `<img src="${esc(logoUrl)}" width="64" height="64" alt="${esc(leagueName)} logo" style="display:block;margin:0 auto 12px;width:64px;height:64px;border-radius:32px;border:0;">`
    : ''
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center" style="font-family:${FONT};text-align:center;">
        ${logo}
        ${leagueName ? `<div style="font-size:12px;font-weight:bold;letter-spacing:1.6px;text-transform:uppercase;color:${GREEN};">${esc(leagueName)}</div>` : ''}
        ${statusPill ? `<div style="margin-top:8px;"><span style="display:inline-block;background:${TINT_G};color:${GREEN};font-size:12px;font-weight:bold;padding:3px 11px;border-radius:12px;">${esc(statusPill)}</span></div>` : ''}
        <div style="font-size:26px;line-height:32px;font-weight:bold;color:${INK};margin-top:6px;">${esc(title)}</div>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:12px auto;"><tr><td width="44" height="3" bgcolor="${GOLD}" style="width:44px;height:3px;line-height:3px;font-size:0;background:${GOLD};">&nbsp;</td></tr></table>
        ${lines.filter(Boolean).map((l, i) => `<div style="font-size:${i === 0 ? 15 : 14}px;line-height:22px;color:${MUTED};">${l}</div>`).join('')}
      </td></tr>
    </table>`
}

/** Centered row of pill buttons: [{ label, href, filled }] (entries without a link are skipped). */
export function buttonsBlock(buttons) {
  const real = buttons.filter(b => b.href)
  if (real.length === 0) return ''
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:22px auto 0;">
      <tr>${real.map(b => `<td style="padding:0 5px 8px;">${pill(b.label, b.href, b.filled)}</td>`).join('')}</tr>
    </table>`
}

/** Gold-tinted "From the organizer" box; empty when there is no text. Line breaks are kept. */
export function noteBlock(note) {
  if (!note?.trim()) return ''
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
      <tr><td style="background:${TINT_Y};border-left:3px solid ${GOLD};padding:14px 16px;border-radius:0 8px 8px 0;">
        <div style="font-family:${FONT};font-size:11px;font-weight:bold;letter-spacing:1.4px;text-transform:uppercase;color:#8a6d1a;margin-bottom:6px;">From the organizer</div>
        <div style="font-family:${FONT};font-size:15px;line-height:23px;color:${INK};">${esc(note.trim()).replace(/\r?\n/g, '<br>')}</div>
      </td></tr>
    </table>`
}

/** Outer shell: neutral background, white bordered card. `outer`/`card` are pixel widths that may shrink. */
export function shell(inner, { outer = 600, card = 560 } = {}) {
  return `<div style="background:#f4f3f0;padding:20px 0;font-family:${FONT};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f3f0">
    <tr><td align="center" style="padding:0 12px;">
      <table role="presentation" width="${outer}" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:${outer}px;">
        <tr><td align="center">
          <table role="presentation" width="${card}" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:100%;max-width:${card}px;background:#ffffff;border:1px solid ${LINE};border-radius:12px;">
            <tr><td style="padding:32px 24px 28px;font-family:${FONT};">
              ${inner}
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</div>`
}

export function footerBlock(lines) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
      <tr><td align="center" style="border-top:1px solid ${LINE};padding-top:16px;font-family:${FONT};font-size:12px;line-height:20px;color:${MUTED};text-align:center;">
        ${lines.filter(Boolean).map(l => `<div>${l}</div>`).join('')}
      </td></tr>
    </table>`
}
