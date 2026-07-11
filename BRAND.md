# Scorify Golf — Brand Reference

## Colors

| Name              | Hex       | Usage                                      |
|-------------------|-----------|--------------------------------------------|
| Forest Green      | `#1B4332` | Primary brand color — buttons, headers, nav |
| Deep Forest       | `#0b2318` | Gradient start (dark backgrounds)          |
| Mid Forest        | `#1f5c3e` | Gradient end (dark backgrounds)            |
| Gold / Accent     | `#D4AF37` | Divider lines, highlights, accents         |
| Off-White / Sand  | `#fbfaf8` | Page background (light mode)               |
| Ink / Text        | `#1d1d1f` | Primary body text                          |

### Background Gradient (dark pages)
```
linear-gradient(150deg, #0b2318 0%, #1B4332 45%, #1f5c3e 100%)
```
Used on: Login, Register, Scorecard Join, Leaderboard header

---

## Typography

| Role         | Font                        | Notes                        |
|--------------|-----------------------------|------------------------------|
| Display / H1 | Playfair Display (serif)    | Used on public-facing headers |
| Body / UI    | System UI / Tailwind default| Inter or system-ui           |

---

## Logo
- File: `/public/logo.png`
- Displayed as: 80×80px circle, `rounded-full`, `object-cover`
- Used on: Register page, Scorecard Join, printed assets

---

## OG Image Spec (for social sharing)
- **Size:** 1200 × 630 px
- **Output:** `/public/og-image.png`

### Suggested layout (Canva / Figma):
- **Background:** gradient `#0b2318` → `#1B4332` (diagonal, top-left to bottom-right)
- **Logo:** centered top, ~120px wide, circular
- **Headline:** "Scorify Golf" in Playfair Display, white, ~72px
- **Subheadline:** "Golf League Management Software" in sans-serif, white/70%, ~32px
- **Gold accent bar:** thin horizontal line (~400px wide, 3px tall) between headline and sub
- **Bottom strip (optional):** `scorifygolf.com` in gold, small caps

### Canva quick-start:
1. New design → Custom size → 1200 × 630
2. Background: fill with `#1B4332`, add a dark overlay or use gradient tool with `#0b2318`
3. Upload your logo from `/public/logo.png`
4. Add text layers as described above
5. Export → PNG → save as `og-image.png` → drop into `/public/`

---

## UI Component Colors (quick reference)

| Element              | Color / Style                          |
|----------------------|----------------------------------------|
| Primary button bg    | `#1B4332`                              |
| Primary button text  | `#ffffff`                              |
| Venmo button         | `#008CFF`                              |
| PayPal button        | `#003087`                              |
| Success bg (light)   | `#d1fae5` (Tailwind green-100)         |
| Gold divider         | `#D4AF37`, 2px tall, 40px wide         |
| Card background      | `#ffffff`, `rounded-2xl`, `shadow-2xl` |
| Input focus ring     | `ring-green-600`                       |
