# An expanding world, with durable progress

Feenland grows through configuration. `core/catalog.ts` models World → Chapter → Level; each level references independent learning skill IDs and a challenge format. IDs are permanent, language-independent keys. Display strings come from `core/messages.ts`.

Prerequisites are a graph of level IDs, not one global sequence. `levelState` checks completed replay first, then prerequisites. `nextLevel` traverses catalog order for the first unlocked, unmastered level. An empty result means caught up for now. Every level in the catalog is a playable game; there is no placeholder content.

Progress uses `feenland.progress`, a version-1 JSON object with deduplicated `mastered`, `chapters`, and `explored` ID lists. Exploring means entering a world's detail route or one of its games, not opening Home/map. Chapter awards are stored independently of current catalog completion. Never derive earned awards from a growing denominator. Preserve unknown IDs when loading; removed/reorganized content must not delete accomplishments. Rename IDs only with an explicit versioned migration and tests. Unsupported/corrupt saves load safely; future schema migrations must retain a recoverable original save before writing a new format. Browser storage failures keep exploration usable in memory and show a localized notice.

Language uses a separate `feenland.locale` key, first detecting the first supported browser preference, then English fallback. Supported locales are en/de/es/fr. Changing locale updates text and document language immediately without touching progress. Settings is the only language selector. This resolves the older Home-selector requirement in issue #1 in favor of #3/#8.

Home shows cumulative counts only, no whole-game percentage or fraction. Unknown previously earned IDs remain counted. Adding a level preserves old IDs, chapter awards and explored worlds; recommendation selects new available content without resetting accomplishments. Completed levels must remain replayable in the future level-selection screen.

Verification scenarios: new player has zero achievements and a start link; returning player retains counts on reload and locale switch; fully mastered catalog shows caught-up; adding a new level restores a recommendation without revoking chapter achievements; prerequisites lock a level until its requirements are mastered; corrupt saves and unavailable storage do not break navigation. Unit tests cover these foundation rules. Navigation never mutates rewards.

Current scope delivers Home, worlds, chapter paths, level selection, supplied-result completion and language settings. Theme controls and cloud sync remain deferred. Unknown/removed game URLs redirect Home.

### World Map delivery

`WORLD_CATALOG` supplies the same configuration to recommendations, exploration, route guards and map destinations. Worlds own localized description keys and presentation metadata; adding a destination does not require changing the map template or routes. World state aggregates its levels: all mastered means Completed for the current catalog; any available or replayable level means Available; otherwise Locked. Completion is a current-content state, not a permanent award or a fixed ending. New published content can change the displayed state while all earned IDs remain intact.

World routes reject unknown and wholly locked destinations back to the map. Locked previews list unmet prerequisite level names without launching anything. Entering an accessible world records exploration.

### Challenge results and completion

`results.ts` validates explicit level results: completion, mastery and optional 0–3 earned stars remain distinct. Results for unknown or prerequisite-gated levels are rejected. Stars retain the best earned value; replay never revokes mastery or chapter awards. A chapter award is earned when all of the chapter's current levels are mastered. Adding content later never removes an existing award.

Games submit their results through the same validated service; no scores or stars are fabricated by navigation.

The completion route displays a session receipt created after recording a result. Reload restores the receipt only when matching completion progress exists; it never reapplies it. Navigating directly to a completion URL without a receipt redirects to Worlds without creating rewards. All state is device-local, not server-verified assessment data.

### Recoverable storage

Before replacing a corrupt, malformed or unsupported-version save, the progress writer preserves its exact original text under `feenland.progress.recovery`. If writing that recovery copy fails, it leaves the original save untouched, continues in memory and shows the localized save warning. Valid version-1 unknown earned IDs and optional completion/star fields are retained. Locale remains independent of progress.
