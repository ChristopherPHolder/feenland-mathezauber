# First delivery verification — 18 October 2026

- 11 unit/integration tests passed: first recommendation, content addition after caught-up, state distinctions, corrupt saves and preserved unknown IDs, locale detection/fallback, zero counts, preview navigation without rewards, all locale switches preserving progress, saved locale, returning/caught-up players and removed route fallback.
- Production Angular build passed with no budget warnings.
- Browser Home overflow checks passed for en/de/es/fr at 320, 375, 393, 768, 820, 1024, 1180, 1366, 1440 and 1920 CSS px. Heights were 740px on phones and 900px on wider views.
- AXE reported zero violations on Home, Settings, world preview and challenge preview in all four languages at 393×852, and on the open preview dialog.
- Native preview dialog closes with Escape and returns focus to its triggering button.
- Reduced-motion emulation results in zero-duration button transitions.
- Locale preference and explored-world progress survived browser page loads. Preview does not grant mastery or chapter awards.
- Desktop and phone screenshots visually inspected. Full world/chapter/completion flows and actual math gameplay remain future work.
