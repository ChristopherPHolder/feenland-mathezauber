# An expanding world, with durable progress

Feenland grows through configuration. `core/catalog.ts` models World → Chapter → Level; each level references independent learning skill IDs and a challenge format. IDs are permanent, language-independent keys. Display strings come from `core/messages.ts`.

Prerequisites are a graph of level IDs, not one global sequence. `levelState` prioritizes unimplemented content as Coming Soon, then completed replay, then prerequisite checks. `nextLevel` traverses catalog order for the first implemented, unlocked, unmastered level. An empty result means caught up for now. The currently implemented level is a clearly labeled challenge preview; it awards no mastery.

Progress uses `feenland.progress`, a version-1 JSON object with deduplicated `mastered`, `chapters`, and `explored` ID lists. Exploring means entering a world's adventure preview or future detail route, not opening Home/map. Chapter awards are stored independently of current catalog completion. Never derive earned awards from a growing denominator. Preserve unknown IDs when loading; removed/reorganized content must not delete accomplishments. Rename IDs only with an explicit versioned migration and tests. Unsupported/corrupt saves load safely; future schema migrations must retain a recoverable original save before writing a new format. Browser storage failures keep exploration usable in memory and show a localized notice.

Language uses a separate `feenland.locale` key, first detecting the first supported browser preference, then English fallback. Supported locales are en/de/es/fr. Changing locale updates text and document language immediately without touching progress. Settings is the only language selector. This resolves the older Home-selector requirement in issue #1 in favor of #3/#8.

Home shows cumulative counts only, no whole-game percentage or fraction. Unknown previously earned IDs remain counted. Adding a level preserves old IDs, chapter awards and explored worlds; recommendation selects new available content without resetting accomplishments. Completed levels must remain replayable in the future level-selection screen.

Verification scenarios: new player has zero achievements and a start link; returning player retains counts on reload and locale switch; fully mastered catalog shows caught-up; adding a new level restores a recommendation without revoking chapter achievements; prerequisites distinguish locked from unpublished; corrupt saves and unavailable storage do not break navigation. Unit tests cover these foundation rules. No reward mutation is exposed in preview UI.

Current scope is issue #2's architecture, issue #3's Home, and shared parts of #1/#8/#9. The world map is an explicitly forthcoming preview, not the completed issue #4. Chapter detail, world detail, completion, scoring, actual gameplay, audio, theme controls and cloud sync are deferred. Unknown/removed game URLs redirect Home.
