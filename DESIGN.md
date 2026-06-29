---
name: Augusta Modern
colors:
  surface: '#f9f9f7'
  surface-dim: '#dadad8'
  surface-bright: '#f9f9f7'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f4f2'
  surface-container: '#eeeeec'
  surface-container-high: '#e8e8e6'
  surface-container-highest: '#e2e3e1'
  on-surface: '#1a1c1b'
  on-surface-variant: '#414944'
  inverse-surface: '#2f3130'
  inverse-on-surface: '#f1f1ef'
  outline: '#717974'
  outline-variant: '#c0c8c3'
  surface-tint: '#3b6756'
  primary: '#00261a'
  on-primary: '#ffffff'
  primary-container: '#0f3d2e'
  on-primary-container: '#7ba894'
  inverse-primary: '#a2d1bb'
  secondary: '#775a19'
  on-secondary: '#ffffff'
  secondary-container: '#fed488'
  on-secondary-container: '#785a1a'
  tertiary: '#072600'
  on-tertiary: '#ffffff'
  tertiary-container: '#1c3d0e'
  on-tertiary-container: '#82a96e'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#beedd7'
  primary-fixed-dim: '#a2d1bb'
  on-primary-fixed: '#002116'
  on-primary-fixed-variant: '#234f3f'
  secondary-fixed: '#ffdea5'
  secondary-fixed-dim: '#e9c176'
  on-secondary-fixed: '#261900'
  on-secondary-fixed-variant: '#5d4201'
  tertiary-fixed: '#c5efad'
  tertiary-fixed-dim: '#a9d293'
  on-tertiary-fixed: '#062100'
  on-tertiary-fixed-variant: '#2d4f1e'
  background: '#f9f9f7'
  on-background: '#1a1c1b'
  surface-variant: '#e2e3e1'
typography:
  display-lg:
    fontFamily: Manrope
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Manrope
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.05em
  headline-lg-mobile:
    fontFamily: Manrope
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  container-max: 1280px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
---

## Brand & Style

This design system is built for an elite golf league experience, blending the heritage of the sport with a high-performance digital aesthetic. The personality is **exclusive, methodical, and premium**, targeting competitive players and organizers who value precision.

The visual style follows a **Modern Corporate** direction with **Minimalist** influences. It prioritizes clarity through generous white space and a structured information hierarchy. The interface avoids unnecessary clutter, utilizing subtle depth and high-end typography to establish an atmosphere of a private clubhouse. Every interaction should feel intentional and refined, evoking the quiet confidence of a well-manicured fairway.

## Colors

The palette is anchored by a deep **Forest Green**, providing a stable and authoritative foundation. This is complemented by **Muted Gold** accents, used sparingly for primary actions and status indicators to signal exclusivity and achievement.

- **Primary (Forest Green):** Used for navigation, primary headers, and core brand elements.
- **Secondary (Muted Gold):** Reserved for high-value interactions, gold-standard achievements, and decorative accents that require a premium touch.
- **Background (Soft Bone):** An off-white neutral base that reduces eye strain and provides a warmer, more sophisticated feel than pure white.
- **Status Tones:** Functional colors (success, warning, error) are desaturated to maintain the professional, understated aesthetic.

## Typography

The typography system uses a pairing of high-end sans-serifs to achieve a technical yet approachable look. **Manrope** is used for headlines to provide a balanced, geometric structure that feels modern and architectural. **Hanken Grotesk** is utilized for body text and labels for its exceptional legibility and sharp, contemporary details.

- **Scale:** High contrast between display titles and body copy to facilitate quick scanning of scorecards and league tables.
- **Rhythm:** Generous line-heights are maintained to ensure the interface feels airy and unhurried.
- **Labels:** Small caps or increased letter-spacing should be applied to labels to distinguish them from interactive text.

## Layout & Spacing

The layout philosophy follows a **Fixed Grid** system for desktop to maintain a premium "editorial" feel, transitioning to a flexible fluid model for mobile devices.

- **Grid:** A 12-column grid is used for desktop (1280px max-width) to align complex data sets like leaderboards and schedules. 
- **Rhythm:** An 8px linear scale governs all spacing.
- **Safe Areas:** Large internal paddings within cards (minimum 32px on desktop) are essential to prevent the data-heavy content from feeling crowded.
- **Mobile:** Elements stack vertically, with margins reduced to 16px. Touch targets for scorecard entry must be a minimum of 44px height.

## Elevation & Depth

Hierarchy is established through **Tonal Layering** and **Ambient Shadows**. Surfaces are kept flat, with depth used only to indicate interactivity or modal prominence.

- **Surfaces:** The primary background uses the neutral Bone color. Secondary containers (cards) use pure white to "lift" content.
- **Shadows:** Use extremely soft, high-diffusion shadows (e.g., `box-shadow: 0 4px 20px rgba(15, 61, 46, 0.05)`). The shadow color should be tinted with the Forest Green primary to ensure it feels integrated into the environment.
- **Outlines:** Use subtle 1px borders in a light grey-green (`#E1E5E0`) for structural definition without the weight of heavy shadows.

## Shapes

The shape language is **Rounded**, strike a balance between athletic energy and professional structure. 

- **Containers:** Cards and primary containers use a 1rem (16px) radius to soften the layout.
- **Interactive Elements:** Buttons and input fields use a 0.5rem (8px) radius.
- **Accents:** Circular shapes are reserved exclusively for player avatars and "hole" status indicators, mimicking the geometry of a golf ball.

## Components

### Buttons
- **Primary:** Forest Green background with White text. High-contrast, bold, and authoritative.
- **Secondary:** Transparent with a Forest Green 1px border.
- **Action:** Muted Gold background with Forest Green text, used for "Join" or "Win" actions.

### Cards
Cards are the primary vehicle for league information. They must feature a subtle top-border accent in Muted Gold for "Featured" or "Active" leagues. Interior padding should be generous (24px - 32px).

### Inputs & Selects
Inputs should use the Hanken Grotesk font with a subtle light-gray border. On focus, the border transitions to Forest Green with a soft glow.

### Data Tables (Leaderboards)
Tables must be clean and borderless. Use zebra-striping with a very faint green-tinted background for even rows. The "Position" column (e.g., 1st, 2nd) should use Manrope Semi-Bold.

### Chips & Badges
Small, pill-shaped indicators for status (e.g., "Active", "Complete", "Handicap"). Use low-saturation background tints with high-saturation text of the same hue.