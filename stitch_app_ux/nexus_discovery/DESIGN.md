---
name: Nexus Discovery
colors:
  surface: '#fcf9f8'
  surface-dim: '#dcd9d9'
  surface-bright: '#fcf9f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f2'
  surface-container: '#f0eded'
  surface-container-high: '#eae7e7'
  surface-container-highest: '#e5e2e1'
  on-surface: '#1c1b1b'
  on-surface-variant: '#514535'
  inverse-surface: '#313030'
  inverse-on-surface: '#f3f0ef'
  outline: '#837563'
  outline-variant: '#d5c4af'
  surface-tint: '#805600'
  primary: '#805600'
  on-primary: '#ffffff'
  primary-container: '#e8a736'
  on-primary-container: '#5f3f00'
  inverse-primary: '#feba48'
  secondary: '#455f85'
  on-secondary: '#ffffff'
  secondary-container: '#b8d3ff'
  on-secondary-container: '#415b80'
  tertiary: '#695c50'
  on-tertiary: '#ffffff'
  tertiary-container: '#c0b0a1'
  on-tertiary-container: '#4f4337'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffddaf'
  primary-fixed-dim: '#feba48'
  on-primary-fixed: '#281800'
  on-primary-fixed-variant: '#614000'
  secondary-fixed: '#d4e3ff'
  secondary-fixed-dim: '#adc8f3'
  on-secondary-fixed: '#001c3a'
  on-secondary-fixed-variant: '#2d486c'
  tertiary-fixed: '#f1dfcf'
  tertiary-fixed-dim: '#d5c4b4'
  on-tertiary-fixed: '#231a10'
  on-tertiary-fixed-variant: '#504539'
  background: '#fcf9f8'
  on-background: '#1c1b1b'
  surface-variant: '#e5e2e1'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 30px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 26px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
  label-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 18px
  caption-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  caption-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

The design system powers an intimate, high-signal community discovery platform blending asynchronous forum threads, real-world events, and synchronous voice/chat hangouts. It targets urban explorers, niche creators, and active community organizers who want social software to feel human, curated, and tactile rather than sterile or algorithmically hyperactive.

The aesthetic fuses **Tactile Warmth** and **Contemporary Editorial Modernism**. By anchoring the digital interface in earthy, sunlit, and parchment-derived tones, the UI distances itself from utilitarian dark-mode clients and stark utilitarian feeds. Interface surfaces emulate structured paper stock, stacked event flyers, and warm physical badges, while remaining crisp and fluid for native iOS interaction patterns (393x852 pt canvas). Interactions evoke warmth, local belonging, and effortless discovery.

## Colors

The chromatic palette centers on sunlit amber tones balanced by cool slate highlights and warm editorial neutrals.

- **Primary Accent (`#E8A736` - Goldenrod):** High-energy visual anchor for primary actions, active channel badges, live room indicators, and upvotes.
- **Secondary Accent (`#6E88B0` - Blue Mirage):** Used for calendar/event dates, spatial maps, Discord-like voice status pills, and hyperlinked metadata.
- **Tertiary Surface (`#F2E0D0` - Amber Smoke):** Warms elevated containers, segmented controls, channel cards, and interactive hover/press states.
- **Background (`#FAEFD9` - Parchment):** The foundation canvas, providing an organic, non-glare paper field across all screens.
- **Surface Highlight (`#FFFFFF` - Pure White):** Used selectively for modal sheets, elevated input fields, and isolated card overlays to drive depth against the Parchment base.
- **Text Primary (`#1A1A1A`):** High-contrast charcoal for titles, author names, and primary body content (exceeds WCAG AAA on `#FAEFD9` and `#FFFFFF`).
- **Text Secondary (`#6B6B6B`):** Muted stone gray for relative timestamps, member counts, and supporting metadata.
- **System Feedback:** `#3DA86B` (Success / RSVP Confirmed / Active Voice Session) and `#D94F4F` (Critical / Leave Room / Errors).
- **Dividers & Structural Rules (`#E5D5C3`):** Low-contrast boundaries that organize content without breaking the tactile continuity of the surface.

## Typography

The design system employs **Inter** exclusively across headlines, body copy, and UI functional labels to maintain high optical clarity across rapid mobile skimming and dense conversational feeds.

- **Headings (Bold 20–28px):** Tight letter tracking (-0.01em to -0.02em) grounds community banners, thread titles, and modal headers with an authoritative, editorial cadence.
- **Body Text (Regular 15–16px):** Generous line height (1.45–1.5x) preserves comfortable reading in long-form community discussions, event descriptions, and live chat logs.
- **Buttons & Control Labels (SemiBold 15–16px):** Distinct structural weight ensures call-to-action visibility against vibrant and neutral card surfaces.
- **Captions & Meta (Regular 12–13px):** Used for member tallies, post metadata, timestamps, and subtle system notes, set in `#6B6B6B`.

## Layout & Spacing

The layout operates on a strict **8-point grid**, tailored specifically for the native iPhone 15 Pro resolution (393 × 852 pt canvas).

- **Screen Canvas & Safe Areas:** The top status bar occupies the native 54pt safe area, while the bottom home indicator reserves 34pt. Content never collides with these dynamic overlays.
- **Margins & Gutters:** Global screen margin is set to `16px` (`margin`), maximizing the horizontal content area while framing cards cleanly. Interior card grids and feed splits maintain a `16px` (`gutter`) clearance.
- **Spacing Scale:**
  - `space-xs` (4px): Micro-spacing between icons and metric labels (e.g., upvote counters, online status pips).
  - `space-sm` (8px): Gaps between chips, metadata tags, and compact input rows.
  - `space-md` (16px): Standard internal padding for cards, input containers, and vertical list separation.
  - `space-lg` (24px): Separation between unrelated logical sections (e.g., between "Upcoming Meetups" and "Live Hangouts").
  - `space-xl` (32px): Major vertical transitions and bottom drawer paddings.
- **Touch Ergonomics:** Every interactive component strictly enforces an unconditional minimum hit target of `44 × 44 pt`.

## Elevation & Depth

Visual depth is achieved through **Tonal Layering** paired with gentle **Ambient Diffusion**, rejecting harsh drop shadows in favor of a soft physical stack:

- **Level 0 (Base Canvas):** Parchment (`#FAEFD9`). Flat canvas ground for scrollable content feeds.
- **Level 1 (Card & Content Surface):** Amber Smoke (`#F2E0D0`) or White (`#FFFFFF`). Defined with an ambient drop shadow of `0 2px 8px rgba(0, 0, 0, 0.06)` and an optional 1px hairline border in `#E5D5C3` to anchor edges against the Parchment base.
- **Level 2 (Floating Controls & Navigation):** Floating Action Buttons (FAB), pinned voice channels, and bottom navigation bars. Employs `0 4px 16px rgba(0, 0, 0, 0.08)` to emphasize physical separation and immediate touch response.
- **Level 3 (Overlays & Sheets):** Action sheets, event RSVP confirmations, and thread replies sliding from the bottom. These sit on a dimming scrim (`rgba(26, 26, 26, 0.35)`) and feature an ambient elevation shadow of `0 -4px 24px rgba(0, 0, 0, 0.10)`.

## Shapes

The design system maintains a tactile, geometry-driven aesthetic that shifts purposefully according to component hierarchy:

- **Cards & Content Blocks:** Standardized at `12px` to `16px` corner radius. This balances container rigidity with hand-friendly softness.
- **Primary & Secondary Buttons:** Shaped at a prominent `24px` radius, producing friendly, pill-like interactive touchpoints.
- **Avatars, Badges, & Chips:** Full circular radii (`999px`) for individual profile pictures, activity status counters, thread taxonomy pills, and presence bubbles.

## Components

### Buttons
- **Primary:** Filled in Goldenrod (`#E8A736`) with `#1A1A1A` SemiBold typography. Height 48pt (min width 120pt), border-radius 24px. Active state transitions to a 10% black overlay.
- **Secondary / Action:** Blue Mirage (`#6E88B0`) text over a White (`#FFFFFF`) or Amber Smoke (`#F2E0D0`) fill with a 1px `#E5D5C3` border. Height 48pt, border-radius 24px.
- **Ghost / Tertiary:** Transparent background, `#1A1A1A` text with an underline or icon accessory. Minimum touch target maintained at 44x44pt.

### Cards
- **Discovery Card (Community / Thread):** Amber Smoke (`#F2E0D0`) or Pure White (`#FFFFFF`) background, 14–16px border-radius, `0 2px 8px rgba(0,0,0,0.06)` shadow. Internal padding: 16px. Outlined with a 1px `#E5D5C3` border.
- **Event Card (Meetup Hybrid):** Features a distinct left-hand date badge block (White background, Blue Mirage `#6E88B0` month header, bold `#1A1A1A` day number) separated from the event summary by an `#E5D5C3` vertical divider.

### Chips & Badges
- **Category & Filter Chips:** Height 32pt, pill-shaped (999px radius), 12px horizontal padding. Unselected: `#F2E0D0` fill with `#1A1A1A` text. Selected: `#E8A736` fill with `#1A1A1A` SemiBold text.
- **Presence Badge:** Pill-shaped (999px radius), 4px vertical by 8px horizontal padding. Live voice indicator features a pulsing `#3DA86B` dot and 12px Inter SemiBold text.

### Input Fields
- **Search & Text Input:** Height 48pt, 12px border-radius. Fill `#FFFFFF`, border 1px solid `#E5D5C3`. Text color `#1A1A1A`, placeholder `#6B6B6B`. Focus state transitions the border to `#E8A736` with an inner glow.

### Lists & Chat Rows
- **List Items:** Separated by a 1px solid `#E5D5C3` hairline divider indented 64pt from the left edge (aligning with text content past the 40pt avatar).
- **Feed Item Interaction:** Upvote/downvote vertical pill on the left of thread cards: 32pt wide, 72pt high, 16px radius, neutral `#F2E0D0` fill. Goldenrod `#E8A736` triggers when upvoted.

### Checkboxes & Radio Controls
- **Form Controls:** 22pt dimensions, 44pt touch area. Unchecked: `#E5D5C3` 1.5px border, Parchment background. Checked: Goldenrod `#E8A736` fill with white checkmark glyph.