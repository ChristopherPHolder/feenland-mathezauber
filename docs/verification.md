# First delivery verification — 18 October 2026

- 11 unit/integration tests passed: first recommendation, content addition after caught-up, state distinctions, corrupt saves and preserved unknown IDs, locale detection/fallback, zero counts, preview navigation without rewards, all locale switches preserving progress, saved locale, returning/caught-up players and removed route fallback.
- Production Angular build passed with no budget warnings.
- Browser Home overflow checks passed for en/de/es/fr at 320, 375, 393, 768, 820, 1024, 1180, 1366, 1440 and 1920 CSS px. Heights were 740px on phones and 900px on wider views.
- AXE reported zero violations on Home, Settings, world preview and challenge preview in all four languages at 393×852, and on the open preview dialog.
- Native preview dialog closes with Escape and returns focus to its triggering button.
- Reduced-motion emulation results in zero-duration button transitions.
- Locale preference and explored-world progress survived browser page loads. Preview does not grant mastery or chapter awards.
- Desktop and phone screenshots visually inspected. Full world/chapter/completion flows and actual math gameplay remain future work.

## World Map (#4) — 18 October 2026

- 18 tests pass across three files. New coverage exercises derived world states, missing prerequisites, replay after catalog growth, configuration-only destination additions, guarded deep links, restored mastery and world-entry exploration without reward mutation.
- Production build passes without budget warnings.
- The map has six destinations with configuration-owned learning previews, colors and mathematical emblems. Available/completed worlds open `/worlds/:id`; the minimal landing links to the explicitly labeled challenge preview. Full chapter paths remain #5.
- In en/de/es/fr, no horizontal overflow at 320×740, 393×852, 768×1024, 820×1180, 1180×820, 1366×768, 1440×900, 1920×1080, 852×393 and 568×320.
- Real Chrome AXE checks report zero violations on the map, Coming Soon dialog and world landing at 393×852 in all four locales. Native dialog opening focuses its close button; Escape dismisses it and restores trigger focus. Keyboard focus remains within the modal controls.
- World entry persists exploration without mastery or chapter rewards; reload retains it. Reduced-motion emulation yields `0s` button transition duration. No browser page errors occurred during these flows.
- Locked state and prerequisite explanations use a synthetic catalog in integration tests; production currently has one available preview world and five unpublished worlds. No fictional gates or achievements are added to the live catalog.
- Static design detection flags Angular `ngSrc` images as missing `src`; browser verification confirms the existing fairy artwork loads. The build uses Angular's optimized-image directive.
