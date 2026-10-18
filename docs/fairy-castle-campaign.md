# Fairy Tower Defense: twenty-wave castle adventure

Play through twenty turn-based waves focused on making ten. The castle has three hearts. Every third incorrect spell against the current monster costs a heart and returns that monster to its starting position; thinking time never causes damage. Losing all hearts restarts only the current wave, after the child chooses to retry. Each completed wave restores all hearts.

## Progression

| Waves | Encounters | Learning support |
| --- | --- | --- |
| 1–4 | Two to four monsters using energies 5–9 | Ten-frame always visible; the first visit explains counting empty spaces |
| 5 | Three-layer shield boss | Counting help on request or automatically after a mistake |
| 6–9 | Four varied monsters per wave | Spells 1–5, optional counting help |
| 10 | Four-layer shield boss | Reinforce the first five number pairs |
| 11–12 | Four monsters per wave | Introduce spells 0–10, including zero; optional counting help |
| 13–14 | Four monsters per wave | Shorter independent prompts; help remains available |
| 15 | Four-layer shield boss | Mixed pairs across the complete range |
| 16–19 | Four monsters per wave | Independent practice of every number pair |
| 20 | Five-layer shield boss | Final mixed challenge and castle celebration |

Wave 1 stays 9 then 8. Other waves reshuffle their configured numbers on every start or retry. Only the active monster shows its number. A boss transforms only after its last shield breaks. Broken layers stay broken after heart loss, but losing all hearts resets the entire boss wave.

There are 76 successful spells in a complete campaign. This is intended for multiple sittings; no timer or speed scoring is used.

## Saving and replay

Completing a wave immediately saves its result locally and unlocks the next wave. Return later to start that next unfinished wave with three hearts. Leaving mid-wave restarts that wave, preserving earlier completed waves. The wave path lists all twenty waves; completed waves remain available to replay and future waves remain locked. Pause includes a wave-path option.

Campaign saves use `feenland.castle-campaign.v1`. Audio and tutorial preferences retain the original `feenland.playtest.*` keys for compatibility. The original two-monster playtest checkpoint does not count as completed campaign content. Corrupt/future saves are ignored safely; valid contiguous prefixes are retained. When storage is unavailable, play continues in memory with a visible save warning.

## Stars and mastery

Full-level completion is awarded only after all twenty waves. The first four teaching waves never count against stars. The remaining 64 encounters, including individual boss shields, measure independent first-attempt answers without counting help.

- One star: finish all twenty waves.
- Two stars: at least two thirds of assessed encounters independently correct (43 of 64).
- Three stars: all 64 assessed encounters independently correct.

Requested help and automatic help after mistakes are both tracked. Retries reset the current wave's attempt results. Saved campaign results keep the best independent score for each completed wave, so children can improve by replaying a specific wave. Existing earned stars and mastery never decrease. Two or three stars mark the level mastered; one star records completion and encourages practice. The final screen uses the existing completion flow with Castle saved, localized encouragement, and replay/chapter actions. Demo preview completions cannot enter this real campaign or grant real progress.

## Play locally

```sh
npm ci
npm start -- --host 127.0.0.1 --port 4301
```

Open <http://127.0.0.1:4301/adventure/defend-fairy-castle>, or choose Number Kingdom → Friends of Ten → Defend the castle. To test a phone on the same network, use `--host 0.0.0.0` and your computer's local network address.

The visible play surface centers the equation and optional ten-frame beneath the battlefield, with an icon-only help control when counting support is hidden. Pause sits beside the hearts; the game title, live instructions and spell-group legend remain available to assistive technology without visible text rows. Audio starts after Play. Pause contains full explanatory text, speech replay, the unavailable-voice notice, and separate remembered music, effects, voice, and language controls. Explicitly requested explanation or replay speech can run while the battle remains paused. English, German, Spanish, and French have matching instructions and optional device voices. If no matching voice is available, the equation, counting support and text in Pause keep the game playable. Keyboard users can Tab to every spell and press Enter; single digits are shortcuts for spells 0–9, while spell 10 remains available through normal keyboard navigation.

Active gameplay fits one tablet screen in portrait and landscape. A height-aware `100dvh` flex layout accounts for safe areas, reserves space for the equation, counting support and spells, and lets the battlefield and characters resize within the remaining height. Pause and menus can still scroll as needed for explanatory text and accessibility.

## Verify

```sh
npm run build
npm test -- --watch=false
npm install --prefix /tmp/feenland-browser-check playwright @axe-core/playwright
NODE_PATH=/tmp/feenland-browser-check/node_modules node scripts/verify-fairy-campaign.cjs
```

The Chrome script uses a controlled browser clock to play all twenty waves. It checks boss damage, full boss retry, broken-layer persistence, wave-boundary saving and resume, zero and ten spells, completion/mastery, replay, image loading, and all four languages. It audits AXE and overflow at 1366×1000, 820×1180, 393×852 and 320×700 for representative waves 1, 5, 11 and 20, plus setback, completion, wave selection and language states. Captures are ignored under `.impeccable/review/campaign/`. Set `FAIRY_BASE_URL` to test another local port.

The focused tablet-fit check runs separately with the dev server and browser dependencies above:

```sh
NODE_PATH=/tmp/feenland-browser-check/node_modules node scripts/verify-fairy-tablet.cjs
```

It checks active waves 1, 11 and 20 with counting dots visible at 768×1024, 1024×768, 820×1180, 1180×820, 600×960, 960×600, 1024×600 and 1024×550. It asserts page scroll height within the viewport (with a 1px rounding tolerance), the spell bar’s bottom within the screen, no horizontal overflow, battlefield height of at least 170px and zero AXE violations. Captures go under `.impeccable/review/tablet-fit/`. This fit check applies to active play, not scrolling Pause or menu text.

Unit tests cover all wave definitions, solvability, staged help, shuffling, damage, locked input, hint independence, shield retries, save validation, progression, star thresholds, speech fallback and compatibility with existing navigation/results.

The established fairy, forest, butterfly and crystals are retained. Two additional regular monsters and a crowned boss extend the illustrated asset set. Assets and exact generation prompts are in `public/images/fairy-defense/` and its provenance/sidecar files; they were produced with the built-in image generator.

For the child test, observe whether the wave path and Continue action are clear, whether counting support fades comfortably, whether zero makes sense, whether boss shields are understandable, and whether they want to return for another wave. Device voice quality and enjoyment require human testing; no analytics or tracking is added.
