---
name: "Fun Math — Luna’s enchanted garden"
description: "A gentle fairy-tale garden for counting, kindness, and collectible friendship."
colors:
  garden-lavender: "#eee5fa"
  plum-ink: "#493057"
  soft-plum: "#685075"
  play-surface: "#faf6ff"
  white: "#ffffff"
  raspberry: "#ae3264"
  raspberry-hover: "#902550"
  selected-plum: "#744591"
  answer-border: "#cdbadd"
  answer-hover: "#f2e7fa"
  control-surface: "#f9f4ff"
  mint-album: "#d5ebde"
  mint-ink: "#305d48"
  mint-focus: "#235f4d"
  sticker-cream: "#fff5cf"
  sticker-lilac: "#e6d8fa"
  canopy-lavender: "#b899d9"
  canopy-cream: "#fff8ee"
  berry-red: "#db3965"
  berry-leaf: "#35845c"
  berry-seed: "#fff2c6"
typography:
  display:
    fontFamily: "Fredoka, Trebuchet MS, sans-serif"
    fontSize: "clamp(38px, 4vw, 58px)"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Fredoka, Trebuchet MS, sans-serif"
    fontSize: "30px"
    fontWeight: 600
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Fredoka, Trebuchet MS, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Fredoka, Trebuchet MS, sans-serif"
    fontSize: "14px"
    fontWeight: 400
  answer:
    fontFamily: "Fredoka, Trebuchet MS, sans-serif"
    fontSize: "30px"
    fontWeight: 400
  equation:
    fontFamily: "Fredoka, Trebuchet MS, sans-serif"
    fontSize: "42px"
    fontWeight: 400
rounded:
  field: "8px"
  control: "14px"
  panel: "16px"
  read: "24px"
  circle: "50%"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.raspberry}"
    textColor: "{colors.white}"
    rounded: "{rounded.control}"
  button-primary-hover:
    backgroundColor: "{colors.raspberry-hover}"
  answer:
    backgroundColor: "{colors.white}"
    textColor: "#513464"
    rounded: "{rounded.control}"
    typography: "{typography.answer}"
  answer-selected:
    backgroundColor: "{colors.selected-plum}"
    textColor: "{colors.white}"
  button-read:
    backgroundColor: "{colors.control-surface}"
    textColor: "{colors.plum-ink}"
    rounded: "{rounded.read}"
    padding: "10px 16px"
  recipe-select:
    backgroundColor: "{colors.control-surface}"
    textColor: "#4e345f"
    rounded: "{rounded.field}"
    padding: "8px"
  album:
    backgroundColor: "{colors.mint-album}"
    textColor: "{colors.mint-ink}"
    rounded: "{rounded.panel}"
    padding: "14px 24px"
---
# Design System: Fun Math

## Overview

**Creative North Star: "The Enchanted Garden"**

The Enchanted Garden is a soft, playable fairy-tale world for seven-year-olds. Rounded lettering, a painted unicorn, scalloped fabric, berry counters, and a mint sticker album make arithmetic feel like helping a friend.

Keep controls visually clear within the illustrated world. Plum text anchors pale lavender surfaces; raspberry marks the main action. Small lifts and short celebrations acknowledge choices and success without introducing urgency.

**Key Characteristics:**
- Lavender surroundings with plum reading contrast.
- Rounded Fredoka lettering and generous number choices.
- Painted character art paired with crisp SVG counting tokens.
- Gentle, optional motion and visible keyboard focus.

## Colors

The palette balances lavender surroundings, plum legibility, raspberry action, and mint reward surfaces. Frontmatter values are normative; these roles describe their use.

### Primary
- **Raspberry:** the serve, continue, and replay buttons; its deeper hover signals interaction.
- **Selected Plum:** selected number answers, paired with white text.

### Secondary
- **Garden Lavender:** the page ground; **Canopy Lavender** alternates with **Canopy Cream** in scallops.
- **Mint Album:** the friendship collection surface; **Mint Ink** supplies its heading contrast.

### Tertiary
- **Berry Red, Berry Leaf, and Berry Seed:** the SVG counting token palette.
- **Sticker Cream and Sticker Lilac:** warm and cool reward circles; additional green and gold rewards remain illustration accents.

### Neutral
- **Plum Ink:** the main reading color. **Soft Plum:** supporting welcome copy.
- **Play Surface:** pale interior of the game. **White:** answer faces and speech bubbles.
- **Answer Border, Answer Hover, and Control Surface:** quiet distinction and interaction states.

**The Clear Action Rule.** Reserve the solid raspberry treatment for the next action in the play sequence.

## Typography

Fredoka is served locally in regular (400) and semibold (600), with Trebuchet MS and sans-serif fallbacks. Rounded letterforms carry both friendliness and readable arithmetic.

The display role names the garden; the headline role introduces the current task. Body and label roles support short instructions. Answer numerals are large, while the equation uses tabular numerals to keep changing values stable. The compact sticker labels are supplementary identification, not a model for essential reading text.

On narrow screens, the garden heading settles at 34px, task headings at 27px, answer numerals at 28px, and the equation at 36px. The final celebration heading uses 36px.

## Layout

The top bar has a 1256px maximum width; the main content has a 1120px maximum width, including 24px side padding. A two-column play area pairs a character with the active puzzle, using equal columns, a 35px gap, and 52px horizontal padding. The sticker shelf sits above the scalloped canopy.

At 760px and below, the play area becomes one column with 20px horizontal padding. Luna and her speech bubble form a compact horizontal greeting above the puzzle. The five reward slots remain in one row and reduce from 48px to 32px; their names hide while accessible labels remain. Four answer choices remain in an equal-width row. At 1400px and above, header height and vertical play-space padding expand.

Spacing uses a small repeated rhythm of 8, 12, 16, and 24px, with larger values reserved for the scene container. Preserve room around the four choices and the adjacent serve action.

## Elevation & Depth

Pale tonal layers, overlapping scallops, illustrated texture, and gently rotated speech and sticker shapes supply most depth. Shadows are diffuse, low-opacity accents rather than heavy structural borders.

The primary action uses a small raspberry-tinted shadow; speech bubbles use a softer plum shadow; earned stickers use a small green-tinted shadow. Exact shadows and animation values are recorded in the sidecar.

**The Gentle Motion Rule.** Use short response motion for choices and rewards, and remove animations and transitions when reduced motion is requested.

## Shapes

Controls are rounded rectangles; panels and speech bubbles are softly rounded; reward slots are circles. The canopy repeats deep rounded scallops. Counting bowls widen below a shallow top edge, with a colored lower border. The unfilled equation slot uses a dashed border; choosing an answer changes it to a filled, solid-bordered surface.

## Components

### Buttons

Primary actions span the puzzle width, use the raspberry treatment, white lettering, a rounded control shape, and a minimum 53px height. Hover darkens the fill. Disabled actions use muted pale plum with no shadow. The read-aloud utility is a pale, outlined pill with an inline speaker SVG and a minimum 44px height. Counting help is an underlined text button; its mobile target grows to 44px.

### Answer choices

Four large white number buttons have lavender outlines and a minimum 65px height, reducing to 59px on mobile. Hover lifts the button slightly; a selected answer turns solid plum with white numerals. Selection is represented by aria-pressed. After serving correctly, choices disable and focus moves to the next action.

### Inputs / Fields

Recipe size uses a native select: pale control surface, thin plum border, compact padding, and a minimum 44px height. It has a visible text label. Interactive elements inherit a green focus outline with a 4px offset.

### Navigation

The berry wordmark links home. The quieter footer offers the preserved number-bridge route. Links use the surrounding plum tone; footer links retain an underline. Mobile stacks footer content vertically.

### Cards / Containers

The play surface sits beneath its canopy with rounded lower corners. Speech bubbles are white, lightly shadowed, and gently tilted. These are scene materials rather than a catalogue of interchangeable game cards.

### Friendship album

A mint shelf holds five circular slots with dashed outlines. Earned slots become colored stickers bearing heart, flower, leaf, gem, and star SVG motifs. Alternating rotations and a brief pop make a collected reward feel tangible. Accessible labels communicate the reward state independently of the small visible names.

### Berry counters

Use the shared SVG berry for counting groups. Optional count labels overlay berries; subtraction adds a diagonal strike and lower opacity to removed berries. Keep these marks distinct from the answer controls.

## Do's and Don'ts

### Do:
- **Do** use plum text on pale garden surfaces and white text on the raspberry primary action.
- **Do** pair decorative artwork with clear labels and meaningful accessible names.
- **Do** keep answer states visible through shape, border, and text as well as color.
- **Do** honor reduced motion and preserve visible keyboard focus.

### Don't:
- **Don’t** replace the local Fredoka face with a system display font.
- **Don’t** use decorative glyph characters in place of the existing SVG motif vocabulary.
- **Don’t** introduce timers or punitive visual feedback into the garden.
