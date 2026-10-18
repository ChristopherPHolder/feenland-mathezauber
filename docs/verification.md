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

## World Detail (#5)

- 21 tests and production build pass, including chapter route handoff, forthcoming chapter deep-link rejection, earned award preservation and configuration growth.
- Chapter paths show configured titles, learning promises, state labels/icons and independent earned chapter awards. A forthcoming inverse-operation chapter previews future learning without launching it.
- Browser checks: en/de/es/fr at 320, 375, 393, 768, 820, 1024, 1180, 1366, 1440 and 1920px widths plus 852×393 and 568×320 landscape; no page overflow. AXE: zero violations at 393px and 1440px per locale, including native preview dialogs. Escape returns focus to the chapter trigger.
- The separate chapter destination initially provides the preview handoff; issue #6 adds its complete level path.

## Chapter Detail (#6)

- 24 tests and production build pass. Coverage includes recommended/locked/forthcoming levels, gated deep links, earned replay, newly configured levels, retained chapter awards and challenge-to-level anchored return links.
- The first chapter now contains an available addition preview, a subtraction preview gated on mastery of the addition level, and a forthcoming make-ten level. No real math completion is fabricated.
- All four locales pass the twelve-size viewport matrix used for #5. AXE reports zero violations at 393px and 1440px and on locked previews; Escape restores trigger focus. In-memory router scrolling restores previous positions and chapter/level anchors.
- Independent desktop/phone review: ship, no material findings.

## Completion (#7)

- 30 tests and production build pass. New cases distinguish completed/mastered/stars, preserve best rewards on replay, derive chapter awards from published mastery, reject invalid/locked/unpublished results, isolate persisted demo progress, handle Next and caught-up, restore receipts without re-awarding, and keep navigation usable when storage fails.
- Completion and demo entry clearly disclose sandbox progress. The production placeholder supplies no earned stars. Real result handling is exercised with explicit supplied practice results in integration tests; actual math gameplay remains out of scope.
- Completion passes all four locales across the twelve-size viewport matrix; phone/desktop AXE reports zero violations. Reduced motion uses the shared zero-transition rule.

- Real-browser Home → Map → World → Chapter → Preview → Complete → Next → caught-up → Chapter passes in en/de/es/fr. Reload retains the completion receipt and demo progress; real mastery and chapter awards remain empty. Explicit demo routes do not write real exploration progress.

## Settings (#8)

- Language, Audio, Accessibility and About now have explicit sections. Audio truthfully states that previews have no sound; accessibility explains keyboard/touch and system reduced-motion behavior. No unsupported switches or destructive controls are present.
- The shared gear passes the current route (including query/fragment) to Settings. Its back action preserves that context; direct visits and external/recursive return targets fall back to Home. Root-component and route tests cover this behavior.
- 33 tests pass; production build passes. Settings passes the twelve-size matrix in en/de/es/fr and AXE reports zero violations at phone/desktop widths for all four languages. Existing tests verify immediate switching, persistence and unchanged learning progress.

## Home (#3)

- Home now derives its recommended world label from the injected catalog rather than assuming Missing Number. A catalog replacement regression verifies the label updates with the destination.
- 34 tests and production build pass. Existing cases cover real zero counts, returning mastery, all-current-content caught-up, saved locale and invalid saves. All four locales pass the twelve-size portrait/landscape matrix and phone/desktop AXE with zero violations.
- Continue/Start intentionally names the challenge preview while actual gameplay is deferred by #1/#3. Its destination is the correct available challenge shell; Explore opens the implemented World Map and Settings stays in the shared gear.

## Shared design system (#9)

- Documented actual palette, type, spacing, radii, elevation, responsive compositions, fairy traits/pose guidance, dialog/focus contract and distinct content/earned/demo semantics in DESIGN.md. The schema-2 sidecar extends tokens with motion, breakpoints and representative implemented examples.
- Shared `ContentStatus` now supplies localized labels and SVG state icons across world, chapter, level and native preview surfaces. Existing buttons, icons, modal previews and keyed path patterns form the reusable foundation.
- 34 tests and production build pass. Fresh shared-state map/chapter checks pass the twelve-size/four-language matrix and phone/desktop/dialog AXE with zero violations. Static detector returns advisories only on the shared components/styles; documented incumbent type variations remain intentional.
- Independent reviewer inspected Home, Worlds, World Detail, Chapter Detail, Completion and Settings desktop/phone captures: ship. Documentation review verified tokens and required accurate Completed semantics, minimum button heights and current product scope; those corrections are applied.

## Final integration (#1)

- 37 tests pass across eight files; production build passes without budget warnings. Recovery tests preserve the exact corrupt/future save before replacement and refuse to overwrite the original when its backup fails. Valid unknown completion IDs and bounded earned stars survive parsing.
- The complete four-locale browser flow passes: Home → Worlds → World → Chapter → challenge preview → demo completion → Next → caught-up → Chapter. Reload retains receipts and sandbox progress; real learning mastery/chapter awards remain unchanged. Settings returns to the originating chapter.
- Tested the production build through local Cloudflare Wrangler on port 8787. Deep chapter links load correctly. Angular's service worker controls the page; with networking disabled, World Map → World → Chapter → both demo challenges/completions and completion reload work. Offline Home shows real counts `0, 0, 1` after exploration; demo mastery and chapter awards remain separate. German locale persists. Offline completion AXE reports zero violations, with no browser page errors.
- `viewport-fit=cover` and body safe-area padding cover standalone display insets; short portrait/landscape widths remain covered by the recorded matrix.
- GitHub Actions deployment runs for each preceding delivery commit completed successfully. Each ticket is closed only after its implementation commit is pushed.


## Practice progression (2026-10-18)

- Production build and all 39 Vitest tests pass, including exhaustive equation/range checks across nine stages and three difficulties. Original demo/navigation regressions use an explicit pre-practice catalog fixture.
- Headless Chromium checked nine selectable levels at desktop and 375px phone width; no horizontal overflow.
- Browser flow verified hard difficulty, quick pace, pause/resume, rejected wrong answers, an eight-question completion, saved practice receipt, and restored preferences. No browser runtime errors.
- Axe reported zero violations on the level selector and practice setup. These checks do not assert full manual WCAG coverage.
