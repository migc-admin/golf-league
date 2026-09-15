// Opt-in side games are inherently opt-in (funded by Payout Config's $ per
// entrant), regardless of the legacy side_game_buy_ins.enabled flag. Shared
// between admin (EventDetail.jsx), the public event page (EventPage.jsx),
// and the public opt-in page (OptIn.jsx).

export const OPT_IN_GAME_KEYS = new Set(['super_ctp', 'super_skins', 'blind_partners'])

export const OPT_IN_GAME_LABELS = {
  super_skins:    'Super Skins',
  super_ctp:      'Super CTP',
  blind_partners: 'Blind Partners',
}

// $ per entrant, sourced from Payout Config — the single source of truth for
// opt-in games (see EventDetail.jsx's payoutAmountForKey).
export function optInAmount(event, key) {
  const config = event?.payout_config ?? {}
  if (key === 'super_skins') return config.super_skins ?? config.super_skins_a ?? config.super_skins_b ?? null
  // Super CTP's payout is keyed by its designated hole (and optionally flight),
  // e.g. super_ctp_3 or super_ctp_a_3 / super_ctp_b_3 — not a flat 'super_ctp' key.
  if (key === 'super_ctp') {
    const hole = event?.super_ctp_hole
    if (hole == null) return null
    return config[`super_ctp_${hole}`] ?? config[`super_ctp_a_${hole}`] ?? config[`super_ctp_b_${hole}`] ?? null
  }
  return config[key] ?? null
}
