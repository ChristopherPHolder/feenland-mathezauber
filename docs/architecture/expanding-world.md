# An expanding world, with durable progress

Feenland grows through configuration. `core/catalog.ts` models World → Chapter → Level; each level references independent learning skill IDs and a challenge format. IDs are permanent, language-independent keys. Display strings come from `core/messages.ts`.

There are no prerequisites: every level is open from the first visit. `levelState` is `open` or `completed`. `nextLevel` traverses catalog order for the first unplayed level, else the first unmastered one; an empty result means caught up for now. Every level in the catalog is a playable game; there is no placeholder content. A chapter is one game and carries an emblem; Home and the games hub render straight from the catalog (see [navigation](../navigation.md)).

Progress uses `feenland.progress`, a version-1 JSON object with deduplicated `mastered`, `chapters`, and `explored` ID lists. Exploring means entering a world's detail route or one of its games, not opening Home/map. Chapter awards are stored independently of current catalog completion. Never derive earned awards from a growing denominator. Preserve unknown IDs when loading; removed/reorganized content must not delete accomplishments. Rename IDs only with an explicit versioned migration and tests. Unsupported/corrupt saves load safely; future schema migrations must retain a recoverable original save before writing a new format. Browser storage failures keep exploration usable in memory and show a localized notice.

Language uses a separate `feenland.locale` key, first detecting the first supported browser preference, then English fallback. Supported locales are en/de/es/fr. Changing locale updates text and document language immediately without touching progress. Settings is the only language selector. This resolves the older Home-selector requirement in issue #1 in favor of #3/#8.

Home shows cumulative counts only, no whole-game percentage or fraction. Unknown previously earned IDs remain counted. Adding a level preserves old IDs, chapter awards and explored worlds; recommendation selects new content without resetting accomplishments. Completed levels stay replayable from the hub like every other level.

Verification scenarios: new player has zero achievements and a start link; returning player retains counts on reload and locale switch; fully mastered catalog shows caught-up; adding a new level restores a recommendation without revoking chapter achievements; every level opens directly for a new player; corrupt saves and unavailable storage do not break navigation. Unit tests cover these foundation rules. Navigation never mutates rewards.

Current scope delivers Home, the games hub, the games, supplied-result completion and language settings. Theme controls and cloud sync remain deferred. Unknown/removed game URLs redirect Home; the retired `/worlds/...` routes redirect into the hub.

### Games hub

`WORLD_CATALOG` supplies the same configuration to recommendations, Home cards and hub sections. Worlds own colours and emblems that theme the sections of the games they contain; adding a chapter adds a section and a Home card without changing a template or a route. Entering a game records exploration of its world.

### Challenge results and completion

`results.ts` validates explicit level results: completion, mastery and optional 0–3 earned stars remain distinct. Results for unknown or playtest levels are rejected. Stars retain the best earned value; replay never revokes mastery or chapter awards. A chapter award is earned when all of the chapter's current levels are mastered. Adding content later never removes an existing award.

Games submit their results through the same validated service; no scores or stars are fabricated by navigation.

The completion route displays a session receipt created after recording a result. Reload restores the receipt only when matching completion progress exists; it never reapplies it. Navigating directly to a completion URL without a receipt redirects to the games hub without creating rewards. All state is device-local, not server-verified assessment data.

### Recoverable storage

Before replacing a corrupt, malformed or unsupported-version save, the progress writer preserves its exact original text under `feenland.progress.recovery`. If writing that recovery copy fails, it leaves the original save untouched, continues in memory and shows the localized save warning. Valid version-1 unknown earned IDs and optional completion/star fields are retained. Locale remains independent of progress.
