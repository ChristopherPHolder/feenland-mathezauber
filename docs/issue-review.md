# Feenland issue review

Reviewed 18 October 2026 against the initial Fun Math implementation and open issues #1–#9 in [ChristopherPHolder/feenland-mathezauber](https://github.com/ChristopherPHolder/feenland-mathezauber/issues).

## Current baseline

The application has lazy routes for a three-game picker, two unicorn garden difficulties and the German number-bridge game. It includes local artwork/fonts and PWA configuration. Progress is held in component signals for the current session. There is no world/chapter catalog, prerequisite engine, durable progress, locale service, Settings route or shared completion route. Existing games are useful reusable learning content, but do not satisfy the navigation issues. No issue should be closed on the strength of this initial upload.

## Findings to resolve before implementation

1. **Language selection conflict:** #1 requests a selector on Home and in Settings; #3 and #8 explicitly put it in Settings only. Use the later screen-specific requirement: a Home gear opens Settings, where language selection lives. Update #1 accordingly.
2. **Product/design documentation drift:** `PRODUCT.md` names Fun Math, says language support is undecided, and describes temporary progress without gates. The issues establish Feenland Mathezauber, four launch languages, durable achievements and prerequisites. `DESIGN.md` specifies Luna the unicorn, while #9 calls for a consistent fairy mascot. Preserve these documents as accurate baseline descriptions until deliberately updating them for the new direction; implementers must not mistake them for the new target specification.
3. **Missing visual reference:** #3 refers to an approved illustrated mockup in another discussion, but does not embed or link it. Include that reference in the issue before claiming visual fidelity. Current repository art depicts a unicorn, not the required fairy.
4. **Screen numbering:** #6 is Screen 4, #7 is Screen 6 and #8 is Screen 7. Name the generic challenge placeholder as Screen 5 explicitly, or renumber the sequence consistently. The placeholder belongs within #1/#6; actual gameplay remains outside these issues.
5. **Parent scope:** #1 overlaps most screen issues. Treat it as the integration umbrella and shared navigation/data foundation, with #3–#8 supplying individual screens, rather than implementing the same screens twice.
6. **Durable chapter achievements:** record earned chapter achievements separately from derived current catalog completion. Adding a level must not remove a previously earned chapter award. Define whether “Worlds Explored” means first entry or first completed level and test that rule consistently.
7. **Completion trust:** mock completion data should be explicitly identified as demonstration data. Keep completed, mastered and earned rewards distinct; navigating directly to a completion URL must not create rewards. Gameplay scoring remains deferred.
8. **Verification scope:** consolidate responsive coverage into the union of the requested widths: 320, 375, 393, 768, 820, 1024, 1180, 1366, 1440 and 1920 CSS px, with representative portrait/landscape and short-height cases. Include keyboard/dialog focus, AXE, reduced motion, translated text expansion, reload persistence and production PWA navigation. Initial unit/build checks do not establish those UI acceptance criteria.

## Issue status and sequence

| Issue | Assessment and recommended delivery |
| --- | --- |
| [#2 Expanding world](https://github.com/ChristopherPHolder/feenland-mathezauber/issues/2) | First: document stable IDs, prerequisite graph, save schema/versioning, migration and durable achievement rules. Add catalog-growth scenarios. Current README does not establish these rules. |
| [#9 Design system and fairy](https://github.com/ChristopherPHolder/feenland-mathezauber/issues/9) | Start alongside #2. Existing tokens and shared icons offer a base, but fairy identity, catalog states, dialogs, localization and new screen patterns remain. Establish usable shared conventions before screen polish. |
| [#1 Navigation framework](https://github.com/ChristopherPHolder/feenland-mathezauber/issues/1) | Shared foundation plus final integration: typed content configuration, derived availability, persistence, recommendation selection, locale infrastructure and lazy routes. Existing lazy loading can be retained. Keep the issue open until the complete navigation flow passes. |
| [#3 Home](https://github.com/ChristopherPHolder/feenland-mathezauber/issues/3) | First screen: replace the current picker with Continue, Explore and cumulative achievements using the shared model. Verify new, returning and caught-up players. Use explicit destination placeholders while later screens are pending. |
| [#8 Settings](https://github.com/ChristopherPHolder/feenland-mathezauber/issues/8) | Implement early alongside Home so all four locales can be tested throughout subsequent screens. Persist locale independently of progress and expose only functioning audio controls. |
| [#4 World Map](https://github.com/ChristopherPHolder/feenland-mathezauber/issues/4) | After Home/shared model: configure six destinations with separate implemented, prerequisite-gated and forthcoming states; add accessible preview dialogs. |
| [#5 World Detail](https://github.com/ChristopherPHolder/feenland-mathezauber/issues/5) | After World Map: config-driven chapter path, empty/caught-up states, replay and back navigation. |
| [#6 Chapter Detail](https://github.com/ChristopherPHolder/feenland-mathezauber/issues/6) | After World Detail: config-driven levels and a generic challenge placeholder. Cover prerequisites, replay and stable IDs when content grows. |
| [#7 Completion](https://github.com/ChristopherPHolder/feenland-mathezauber/issues/7) | After level routing: consume explicit results, persist appropriate achievements, select the next available level and handle no-next-level. Verify the end-to-end flow under #1. |

## Baseline verification

- `npm test -- --watch=false`: 33 tests passed across four files.
- `npm run build`: passed; garden component CSS is 7.96 kB against a 4 kB warning budget. The build reports a warning, not an error.
- This review did not perform a browser accessibility audit or the full viewport/locale matrix.

This document records the review; it does not implement the backlog or change GitHub issue states.
