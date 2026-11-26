# Design language

An editorial desk with a small imagined phone for exploring the work. Warm paper,
ink, one terracotta accent. Motion is the loudest thing on the page, so it follows
rules: every effect must be able to finish the sentence "this animation
communicates ___".

The values below came from the existing stylesheet (colour, type) or were chosen
for the motion overhaul (motion). There was no prior motion system, so the
motion values are a first proposal: tune them here, in `:root` of `styles.css`.

## Tokens

### Colour (`:root`, dark values on `html[data-look=dark]`)

| Token | Light | Dark | Role |
|-------|-------|------|------|
| `--paper` | `#ebe5d9` | `#29251f` | Page background |
| `--ink` | `#312c26` | `#f0e8dc` | Primary text, primary button |
| `--muted` | `#716a60` | `#b9aea0` | Secondary text, dot field |
| `--accent` | `#bf6849` | `#de9473` | Links, eyebrows, cursor, highlights |
| `--line` | `#cfc5b6` | `#51473c` | Rules, tag borders, giant index outline |
| `--panel` / `--soft` | `#f6f0e5` / `#e3d8c7` | `#373028` / `#453b32` | Surfaces |

### Type

- Display: Space Grotesk 500, tight tracking (`-.055em` to `-.08em`).
- Body: DM Sans 400–700.

### Motion

| Token | Value | Use |
|-------|-------|-----|
| `--dur-micro` | 120ms | Colour and hover state changes |
| `--dur-small` | 200ms | Fades, focus, cursor states |
| `--dur-medium` | 320ms | Underlines, pill slides, count changes |
| `--dur-large` | 560ms | Panel items, sheet morphs, island |
| `--dur-hero` | 900ms | Headline letters, odometer, theme wipe |
| `--ease-out` | `cubic-bezier(.16,1,.3,1)` | Anything entering |
| `--ease-in` | `cubic-bezier(.7,0,.84,0)` | Anything leaving |
| `--ease-in-out` | `cubic-bezier(.65,0,.35,1)` | Repositioning, wipes |
| `--ease-spring` | `linear(...)` (stiffness 170, damping 14) | Playful overshoot: letters, icons, pill |
| `--ease-spring-stiff` | `linear(...)` (stiffness 260, damping 24) | Small overshoot for controls |
| `--stagger` | 40ms | Between sibling items |
| `--stagger-char` | 18ms | Between letters (capped so a title is done in ~0.5s) |

The springs are sampled into CSS `linear()` curves, so CSS and the Web Animations
API share them. Browsers without `linear()` fall back to a cubic-bezier overshoot.

## Two registers

- **Productive** (controls, feedback): `micro`–`medium`, ease-out or stiff spring.
  Buttons, links, filters, tags, copy feedback.
- **Expressive** (moments): `large`–`hero`, spring. The first-visit boot, panel
  reveals, app open/close, theme wipe, sheet illustrations.

## Inventory

| Effect | Where | Purpose |
|--------|-------|---------|
| App open morph: the sheet grows out of the tapped icon in its colour while the home screen recedes | Phone | Continuity: the app *is* the icon |
| App close morph: the sheet shrinks back into its icon; icons ripple outward from it | Phone | Continuity and orientation: where you came from |
| Direction-aware panel entrance (deeper slides in from the right) | Detail column | Orientation |
| Headline letters rise on a spring; eyebrow decodes from noise | Detail column | Earned delight on a content change |
| Giant outlined odometer showing the section number | Behind the panel | Orientation: which chapter you are in |
| Sliding filter pill + FLIP reflow of the project lists | Projects | Feedback and continuity |
| Cursor-following project preview card | Project list | Shows what a link leads to |
| Dynamic island live activity ("Email copied", "Dark mode", greeting) | Phone | Feedback |
| Confetti burst from the copy button; shake on failure | Contact | Feedback |
| Circular theme wipe from the toggle (View Transitions) | Whole page | Continuity: where the change started |
| Phone 3D tilt with glare and layer parallax, only near the phone | Phone | Delight; flat and sharp while reading |
| Dot field that parts around the cursor and ripples on clicks and navigation | Background | Delight and feedback |
| Cursor ring that labels links (open, view, visit, write) | Pointer | Tells you what a click will do |
| Magnetic buttons with a fill that spreads from the pointer | Buttons | Feedback |
| Jelly icon hover, tap ripple, light sweep | App icons | Feedback |
| Sheet illustrations act out the project (receipt prints, ring fills, terminal types, boxes drop, fan spins up) | Phone sheets | Delight that explains the project |
| First-visit boot: phone rises, screen powers on, icons cascade | Once per session | Expressive first impression |

## Rules

1. **State never waits for motion.** `app.js` changes the DOM synchronously and
   emits `portfolio:*` events; `motion.js` animates afterwards. Exit animations
   use visual-only ghosts (no ids, links or `data-open`), so they never collide
   with real elements.
2. **No infinite CSS or WAAPI animations.** Ambient motion (dot field, tilt,
   cursor) runs on one `requestAnimationFrame` ticker that pauses with the tab,
   and the dot field drops to ~20fps when idle.
3. **Composited properties first.** Transforms and opacity everywhere; the dot
   field is a single canvas. Blur is used only briefly on entrances.
4. **No horizontal overflow.** Transforms count toward scroll width, so slide-ins
   are clamped to the space available and `.phone-screen` uses `overflow: clip`.
5. **Reduced motion means none.** `prefers-reduced-motion: reduce` disables every
   animation and transition in CSS, and `motion.js` skips every effect.
6. **Accessibility is unchanged.** Split headlines keep a visually hidden copy for
   screen readers; every decorative node is `aria-hidden`; the native cursor stays.
7. **Theme has two attributes.** `data-theme` is the preference and changes at
   once; `data-look` is what CSS paints and may change inside a view transition.
