---
name: Feenland Mathezauber
description: A welcoming fairyland of growing math adventures.
colors:
  ink: '#172555'
  ground: '#edf7fb'
  cream: '#fffdf5'
  primary: '#c91860'
  muted: '#4c6079'
  focus: '#1746ab'
  success-ground: '#dfefe3'
  warm-ground: '#fff1cb'
typography:
  body:
    fontFamily: Fredoka, Trebuchet MS, sans-serif
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.6
  display:
    fontFamily: Fredoka, Trebuchet MS, sans-serif
    fontSize: clamp(30px, 4vw, 48px)
    fontWeight: 600
    lineHeight: 1.15
rounded:
  surface: 16px
  panel: 24px
  button: 30px
spacing:
  small: 8px
  medium: 16px
  large: 24px
  section: 40px
components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '#ffffff'
    rounded: '{rounded.button}'
    padding: 15px 24px
  button-secondary:
    backgroundColor: '#ffffff'
    textColor: '{colors.ink}'
    rounded: '{rounded.button}'
    padding: 15px 24px
  content-status:
    textColor: '{colors.ink}'
---

# Feenland Mathezauber design

## Overview

A calm, welcoming fairyland for children's growing number discoveries. Preserve the approved illustrated Home direction: red-haired fairy, green leaf dress, translucent wings, golden star wand, friendly rounded Fredoka lettering, blue text, cream/pastel surfaces and pink next actions.

The visual reference is [the existing fairyland illustration](public/images/feenland.webp). Reuse it across Home, map, world, chapter, completion and Settings. New poses must preserve hair color and shape, leaf outfit, wing construction, wand and proportions. Helpful pointing, a welcoming wave and a gentle celebration are suitable future variants; avoid changing the character between screens. Never use expression or motion alone to communicate success or a gate.

## Colors

CSS tokens live on `:root` in `src/styles.css`; the frontmatter records their values. Ink is the default foreground, muted blue is supporting copy, pale blue is the page, cream is a grouping surface. Pink is the primary next action. Pale green supports earned/caught-up messages; warm yellow supports the current recommendation and the explicit demo notice. Focus uses a 3px blue outline with a 5px offset.

World-specific colors and mathematical emblems belong to catalog configuration: Missing Number uses warm yellow, Number Magic green, Power of Ten blue, Subtraction mauve, Big Numbers peach, Math Master lavender. All keep ink text; colors supplement names, icons and labels. Test actual foreground/background pairs at WCAG AA: 4.5:1 body and 3:1 large text.

## Typography

Use local Fredoka 400/600. Display headings use 30–48px with 1.15 line height; section headings 26–30px; item titles 23–26px; ordinary copy 16px/1.6; state labels 14px/1.4. Home retains its established larger wordmark composition. Keep body measures around 65–75 characters and instructions shorter. Allow wrapping, including long German and French strings; no fixed text heights or truncation of instructions.

## Layout

Phone screens use a vertical path and full-width actions. Tablet screens use two-column choices and split intros where legible. Desktop screens constrain content to 1180–1320px and use wider chapter/level arrangements rather than enlarging phone controls. Home remains a split hero with a horizontal achievement group on wide screens; Settings places preferences beside explanatory sections.

Use 8/16/24/40px spacing tokens, typically 20px phone page gutters and 40px wider gutters. Surfaces use 24–28px inner padding. No fixed whole-screen heights. Short landscape views reduce illustration height; system safe-area insets pad the body. Navigation restores scroll positions and chapter/level anchors.

The actual validation matrix is recorded in [verification](docs/verification.md): 320, 375, 393, 768, 820, 1024, 1180, 1366, 1440 and 1920px widths, plus 852×393 and 568×320 landscape, with all four languages. Test overflow, keyboard focus and text growth on changed screens.

## Elevation & Depth

Destination and path surfaces are flat. Existing primary actions use a soft offset shadow (`0 6px 16px #b722511c`); secondary actions use `0 4px 15px #214d5a0a`. Native modal previews use a dark translucent backdrop, never nested modal panels. Keep illustration readable and avoid extra floating decoration around learning choices.

## Shapes

Use 16px destination/path surfaces, 24px panels/dialogs, and 30px action pills. Smaller controls remain at least 44×44px; primary actions are at least 56px tall. The fairyland hero may keep its existing organic top corners. Number emblems are subject content, not replacements for the SVG icon system.

## Components

Buttons use shared `.button`, `.primary` and `.secondary` styles. Links navigate; buttons open dialogs, choose a language or submit a demo result. Keep the primary next step prominent; secondary actions return or explore alternatives. Hover raises buttons by 2px; keyboard focus is visible. No hover/drag-only behavior.

`ContentStatus` provides a localized label and SVG icon for the same four states on worlds, chapters, levels and preview dialogs:

| State       | Meaning                                                  | Icon | Interaction                                                    |
| ----------- | -------------------------------------------------------- | ---- | -------------------------------------------------------------- |
| Coming Soon | No implemented activity                                  | Star | Learning preview; never launches unfinished content            |
| Locked      | Implemented but no accessible entry level                | Lock | Names a sufficient prerequisite path                           |
| Available   | An open or replayable entry exists                       | Book | Opens the next navigation screen                               |
| Completed   | Level completed; world/chapter published levels mastered | Cup  | Still opens for replay; future content may reopen availability |

Available content need not be actual mathematical gameplay: current challenges are explicitly labeled previews. Shared `ContentPreview` handles chapter/level dialogs; map previews additionally preserve alternative entry groups. Native `showModal()` contains keyboard interaction; opening focuses Close, Escape dismisses, and closing restores the trigger. Dialogs have a named title, description and scrollable content bounded by the viewport. Do not disable locked/forthcoming preview controls.

World/chapter/level paths render keyed content configuration, with icons and text before action links. A current Completed state is distinct from a permanently earned chapter award. Earned markers use saved IDs; Home uses semantic `dl`/`dt`/`dd` cumulative counts. Never invent stars or use a whole-game fraction/percentage. Completion displays supplied results and only awarded stars; demo results and chapter awards are explicitly labeled and stored separately.

The shared header has Home, Worlds and an unobtrusive Settings gear. Back links retain chapter/level anchors; Settings retains a validated local return destination. Language buttons use native language names and `aria-pressed`, and update the document language immediately. No unsupported audio switches or destructive actions are shown.

## Do's and Don'ts

Use English, German, Spanish and French message keys for every player-facing string, including previews, prerequisites, result feedback and statuses. Keep content IDs independent of language. Respect the system reduced-motion preference: all authored transitions/animations become zero-duration. Current completion uses restrained static celebration rather than mandatory animation.

Use the same fairy and authored SVG icons; keep actions touch-friendly and focusable. Preserve earned IDs as content grows. Do not imply a permanent world ending, fabricate learning rewards, hide unfinished states behind disabled buttons, or rely on color alone.
