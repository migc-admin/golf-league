---
name: Quiet Editorial
colors:
  surface: '#fbfaf8'
  surface-dim: '#f4f3f0'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fbfaf8'
  surface-container: '#f4f3f0'
  surface-container-high: '#eceae5'
  surface-container-highest: '#e3e1dc'
  on-surface: '#1d1d1f'
  on-surface-variant: '#86868b'
  inverse-surface: '#1d1d1f'
  inverse-on-surface: '#fbfaf8'
  outline: '#a8a8a4'
  outline-variant: '#ebe9e4'
  primary: '#1B4332'
  on-primary: '#ffffff'
  primary-container: '#eaf1ec'
  on-primary-container: '#1B4332'
  secondary: '#1d1d1f'
  on-secondary: '#ffffff'
  secondary-container: '#eceae5'
  on-secondary-container: '#1d1d1f'
  warning: '#8a6d1a'
  warning-container: '#f4f1e4'
  error: '#ba1a1a'
  error-container: '#ffdad6'
  background: '#fbfaf8'
  on-background: '#1d1d1f'
typography:
  display-lg:
    fontFamily: 'Schibsted Grotesk'
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: 'Schibsted Grotesk'
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 30px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: 'Schibsted Grotesk'
    fontSize: 19px
    fontWeight: '700'
    lineHeight: 26px
    letterSpacing: -0.015em
  body-lg:
    fontFamily: 'Schibsted Grotesk'
    fontSize: 15.5px
    fontWeight: '500'
    lineHeight: 22px
  body-md:
    fontFamily: 'Schibsted Grotesk'
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  label-md:
    fontFamily: 'Schibsted Grotesk'
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  numeral-display:
    fontFamily: 'Schibsted Grotesk'
    fontSize: 56px
    fontWeight: '700'
    lineHeight: 1
    letterSpacing: -0.04em
rounded:
  sm: 0.5rem
  DEFAULT: 0.875rem
  md: 1rem
  lg: 1.25rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  container-max: 1120px
  gutter: 24px
  margin-mobile: 22px
  margin-desktop: 40px
---

## Brand & Style

"Quiet Editorial" is a calm, restrained design language for an elite golf league platform, opening from an internal admin tool into a product real leagues and groups will use. The personality is **calm, precise, effortless** — inspired by Apple, Titleist, Nike, BMW: generous whitespace, one confident accent color, and typography that does the work instead of decoration. No gold, no gradients-as-decoration, no busy iconography. Every screen should feel like it belongs to a single, deliberate system.

This replaces the previous "Augusta Modern" system (deep forest green + muted gold, Manrope/Hanken Grotesk, heavy card borders). Keep the sport's heritage in tone and copy, not in ornament.

## Colors

One neutral surface family (warm off-white "Bone", not pure white) and **one accent** — deep Forest Green (`#1B4332`) — used sparingly for the single primary action per screen, live/active indicators, and score-under-par numerals. Everything else is ink (`#1d1d1f`) on Bone. No secondary gold/brass accent — status uses two muted tints only: a green tint for "active" and a warm tan tint for "upcoming"/attention. Never introduce a third hue.

- **Primary (Forest Green `#1B4332`):** the one primary button per screen, "live" dot, score-under-par color, active nav state.
- **Ink (`#1d1d1f`):** all headline and body text, the one dark/inverse surface (buttons on light backgrounds sometimes flip to ink instead of green — see Components).
- **Bone (`#fbfaf8` / `#f4f3f0`):** background and card surfaces. Cards are barely differentiated from background — separation comes from a 1px hairline (`#ebe9e4`), not shadows or borders-as-accent.
- **Status tints:** Active = `#eaf1ec` bg / `#1B4332` text. Upcoming = `#f4f1e4` bg / `#8a6d1a` text. Never saturate these further.

## Typography

**Schibsted Grotesk** for everything — headlines, body, labels, numerals. One family, weight and size carry the hierarchy (this is the biggest structural change from the old two-family Manrope/Hanken Grotesk pairing). Numerals (hole number, scores) get their own oversized treatment: `font-variant-numeric: tabular-nums`, tight negative letter-spacing, using the same family at max weight.

- **Scale:** Big jump from label (12px) to display (36px+) so scorecards and standings scan instantly.
- **Rhythm:** Generous line-height on body text; tight, confident line-height on display numerals.
- **Labels:** 12px, 600 weight, 0.02em tracking — sparingly capitalized, never full small-caps blocks.

## Layout & Spacing

- **Grid:** 1120px max-width container on desktop (narrower than the old 1280px — editorial, not dashboard-dense).
- **Rhythm:** 8px base scale.
- **Cards:** 20–24px radius (up from 8–16px) — softer, calmer geometry. Interior padding 22–24px minimum.
- **Mobile margins:** 22px (not 16px) — more breathing room is core to this direction.
- **Touch targets:** scorecard number inputs and nav buttons minimum 48×48px, always circular or 14px-radius squares.

## Elevation & Depth

Almost flat. Depth comes from **hairline borders** (`1px solid #ebe9e4`) first; shadow is reserved for genuinely floating elements — a sign-in card over a gradient background, a modal. When used, shadows are large-radius and very soft: `0 6px 24px rgba(0,0,0,.05)` for resting cards, `0 20px 60px rgba(0,0,0,.35)` only for a card floating over a dark/gradient hero. No colored/tinted shadows, no top-border accent stripes on cards (that was the old gold-accent pattern — drop it entirely).

## Shapes

Rounder than before: **pill shapes** (`border-radius: 999px`) for every button and status chip; **20–24px radius** for cards; **14px radius** for the fixed-size scorecard number input squares. Circles reserved for avatars and the live-status dot.

## Components

### Buttons
- **Primary:** Ink (`#1d1d1f`) or Forest Green pill, white text, no border, no active-state scale/shadow tricks — a simple background change on press is enough.
- **Secondary:** Bone-container pill (`#eceae5`) background, ink text, no border.
- One primary action per screen max — everything else is secondary.

### Cards
Bone or white surface, 1px hairline border, 20–24px radius, soft shadow only if floating. No top-accent stripe. Status shown as a pill chip in the card's top-right, not a border color.

### Inputs (scorecard number entry)
54×54px, white fill, 1.5px hairline border (`#d6d4cf`), 14px radius, 24px bold numeral centered. Empty state: dashed border, centered middle-dot placeholder, muted color — never a gray box.

### Data Tables (Leaderboards)
Fully borderless except a single hairline between rows. Faint green-tinted zebra striping (`rgba(27,67,50,.025)`) on alternating rows only — much lighter than before. Position numbers bold, no colored badge. Score-under-par numerals colored Forest Green; over-par stays ink (not red) — reserve red only for true errors/conflicts.

### Chips & Badges
Pill-shaped, two tints only (Active / Upcoming per Colors above). No third accent color, no icon inside the chip.

### Progress / Hole Navigator
A row of 6px dots (not numbered circles) — filled ink/green for completed and current, hairline-outline for current, pale for remaining. Replaces the old scrollable numbered-circle hole tracker; simpler and calmer at a glance.
