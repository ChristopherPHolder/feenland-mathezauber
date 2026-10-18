# Fairy Tower Defense: Wave 1 playtest

This slice teaches **9 + 1 = 10**, then **8 + 2 = 10**. It is deliberately a playtest: no full-level completion, stars, mastery, or chapter awards are granted. Existing achievements stay untouched.

## Play locally

```sh
npm ci
npm start -- --host 127.0.0.1 --port 4300
```

Open <http://127.0.0.1:4300/adventure/defend-fairy-castle>, or navigate through Explore Worlds → Number Kingdom → Friends of Ten → Play Wave 1. To play on a phone on the same network, start with `--host 0.0.0.0` and use the computer's local network address instead of `127.0.0.1`.

Press Play to enable audio. Pause contains separate remembered controls for music, effects, speech, and language. Device voices vary; the game works with text when a matching voice is unavailable. Verify voice pronunciation and comfortable sound levels on the actual playtest device. Press 1–5 to cast using the keyboard; Escape pauses. Tab and Enter also operate the controls.

## Rules to check together

- Only the front monster has a number. Count empty spaces in the two-row ten-frame, then choose a spell. Thinking time is unlimited.
- Every wrong spell fizzles and moves the same monster closer. Every third wrong spell costs one heart and returns it to the start.
- Losing all three hearts gives a retry choice. Retry starts both encounters over with three hearts. Help remains available throughout.
- Correct spells show the equation and transform the monster. The next encounter appears automatically.
- After the second transformation, celebrate Wave 1 and choose replay or return to the chapter. Full battle rewards will come later.
- Refresh restarts the current wave; tutorial-seen state and sound preferences persist in the separate `feenland.playtest.*` storage namespace. No per-turn save or earned-progress writes occur.

## Observe your child

Let your child try first without explaining the interface. Avoid telling them the answer; asking “What do you notice?” is useful if they ask for help.

1. Do they understand that empty dots tell them which spell to choose?
2. Do they recognize which monster receives the spell and what its number means?
3. Do the spell and butterfly feel satisfying? Do they want to do the second encounter or replay?
4. Is approaching danger understandable and gentle enough? Can they recover after a mistake or loss?
5. Are speech, text, and spell buttons comfortable on the actual device?

Note confusion, smiles, requests for help, and whether they choose to replay. No analytics or tracking is installed. Use those observations before implementing Waves 2–3 or full-level rewards.

## Verification

```sh
npm run build
npm test -- --watch=false
npx tsc -p tsconfig.app.json --strict --noEmit
```

A repeatable real-browser check lives in `scripts/verify-fairy-playtest.cjs`. With the dev server running and Chrome installed:

```sh
npm install --prefix /tmp/feenland-browser-check playwright @axe-core/playwright
NODE_PATH=/tmp/feenland-browser-check/node_modules node scripts/verify-fairy-playtest.cjs
```

It checks loaded images, keyboard/modal behavior, success, pause during a cast, nine mistakes, retry, refresh, saved audio preferences, chapter navigation, preservation of existing achievements, and AXE/overflow across desktop (1366×1000), tablet (820×1180), phone (393×852), narrow phone (320×700), and short landscape (568×320). It also audits the pause dialog in all four languages, heart loss, setback, and completion. Captures go into ignored `.impeccable/review/`.

Unit tests cover damage thresholds, invalid/locked input, deterministic encounters, wave restoration, transition timers, cleanup, localization, speech selection/fallback, and rejection of playtest learning results. Automated checks do not establish audible voice quality or whether the game is fun; those need the child playtest.

## Artwork and implementation

The scene, fairy, two monsters, butterfly, and five-crystal strip are generated with the built-in image generator, saved as WebP in `public/images/fairy-defense/`. Exact prompts and provenance are in `provenance.json` and adjacent `.webp.json` sidecars. The fairy follows the existing home illustration; the storyboard supplies the game's visual direction. The strip is displayed with CSS transforms, retaining its transparent source without destructive cropping.

`battle.ts` owns pure turn rules. `FairyDefenseComponent` coordinates transitions, pause, and the playtest ending. `BattleScene`, `SpellBar`, and `GamePause` own their respective views. `GameAudio` is component-scoped and cleans up speech, timers, and Web Audio when the route is destroyed. `PlaytestStore` is separate from `ProgressService` and `CompletionService`.

The catalog's `playtest` flag prevents this unfinished slice from becoming the normal learning recommendation or accepting completion results. It remains available through its chapter and direct route. The existing preview adventures retain their behavior.
