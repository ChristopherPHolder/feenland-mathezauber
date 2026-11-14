# Curriculum and level design

Feenland has 68 selectable levels across four games (plus the castle's twenty waves and six heats per race track). Every level practises one thing, takes about two to four minutes, and sits in a topic inside its game. Inside each game, levels are listed easiest first.

## How long a level should be

The research on session length for young children is thin. This is what it supports:

- **Short, frequent sessions beat long ones.** Practitioner guidance for primary maths points to about 10–15 minutes a day, split into calm, short sessions. Fluency programmes ask for about 10 minutes, at least three times a week. ([Brilliant parent guide](https://brilliant.org/practice/guides/how-long-should-a-child-practice-math/), [Math Fact Lab](https://mathfactlab.helpscoutdocs.com/article/49-suggested-amount-of-student-usage), [Mathnasium](https://www.mathnasium.com/math-centers/woodbridge/news/effective-daily-math-routine))
- **Spacing helps.** Distributed practice for maths facts is studied directly, for example massed versus short and long distributed practice ([Oklahoma State](https://openresearch.okstate.edu/entities/publication/f6a09b20-c244-4d7a-b05b-681bf3159d5d)), and the general finding is that spread-out practice helps.
- **Attention is the stopping cue.** The common rule of thumb is two to three minutes of attention per year of age, so 14–21 minutes for a seven-year-old. It is an estimate, not a measured result. Guidance also says to stop when answers become rushed or frustration rises.
- **One goal per chunk.** Microlearning guidance for children, mostly from education publishers, suggests 5–15 minute sessions with one clear objective each ([Twinkl](https://www.twinkl.com/news/buzzwords-in-education-2024-microlearning), [Night Zookeeper](https://www.nightzookeeper.com/blog/articles/what-is-microlearning)).

**What we built from this:** a level is a 2–4 minute chunk with one skill, so a 10–15 minute sitting is three to five levels, often across games. Finishing always counts, and stars reward care, not speed.

## Timing per game

These estimates assume a seven-year-old answering steadily, animations included.

| Game                 | One level is                                                     | Estimate                                          |
| -------------------- | ---------------------------------------------------------------- | ------------------------------------------------- |
| Defend the Castle    | a battle of 10 questions (`STAGE_QUESTIONS`)                     | 10 × (8–15 s + spell) ≈ 2–3 min                   |
| The Hungry Crocodile | 15 snacks (plain numbers), 12 (one sum), 10 (two sums or tables) | 15 × 6 s ≈ 1.5–2.5 min; 10 × 15 s ≈ 2.5–3.5 min   |
| Magic walls          | 8 two-brick walls, 5–6 three-row walls, 4 four-row walls         | 8 × 15 s ≈ 2 min … 4 × 60 s ≈ 4 min               |
| Unicorn Rainbow Race | one heat (six per track)                                         | 60–90 s per heat; two or three heats in a sitting |

The race heats stay at 60–90 seconds because their pace is tuned by simulation (see the race balance notes). A track's six heats are its sub-levels.

Round lengths are data, not code paths: `snacks` on each crocodile stage, `walls` in each wall level's rules, and `STAGE_QUESTIONS` for the castle.

## Level map

Ids never change once shipped, because progress and bookmarks use them. New levels got new ids and were slotted into the list by difficulty. The number on a card is its position, not its id.

### Defend the Fairy Castle: 24 stages (`core/practice.ts`)

| Topic         | Stages, easiest first                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------ |
| Castle waves  | the twenty-wave making-ten campaign                                                                    |
| Tens and ones | 17 = 10 + □ (to 20) · 24 = □ + 4 (to 30) · 68 = 60 + □ (to 100)                                        |
| Adding        | make ten 7 + □ = 10 · to 10 · to 20 · across ten to 20 · across ten to 30 · to 100 · across ten to 100 |
| Taking away   | to 10 · to 20 · across ten 13 − □ = 6 · to 30 · find the starting number □ − 8 = 12 · to 100           |
| Times tables  | ×2 ×5 ×10 to 100 · tables to 30 · ×3 ×4 · ×6 ×7 ×8 ×9 · missing factor to 30 · missing factor to 100   |
| Mixed magic   | mixed to 30 · mixed to 100                                                                             |

Easy, medium and hard stay a separate, remembered choice. For the row-based table stages, easy keeps to ×2…×6 of each row and hard to ×5…×10, and both orders (4 × 7 and 7 × 4) appear.

### The Hungry Crocodile: 14 levels (`pages/crocodile/comparison.ts`)

| Topic             | Levels, easiest first                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| Compare numbers   | to 10 · to 20 · to 100 · to 1000 (408 ○ 480)                                                           |
| Work it out first | sums to 10 · sums to 20 · differences to 10 · differences to 20 · two sums to 20                       |
| Up to 100         | the big number buffet (40 + 8 ○ 50) · two calculations to 100 (30 + 15 ○ 50 − 4)                       |
| Times tables      | ×2 ×5 ×10 against a number (5 × 3 ○ 12) · tables to 30 (4 × 5 ○ 3 × 7) · tables to 100 (6 × 7 ○ 8 × 5) |

The seven original levels keep their hats; the new ones add rounds, not hats.

### Magic walls: 11 levels (`pages/number-wall/number-wall.ts`)

| Topic           | Levels, easiest first                                                                                       |
| --------------- | ----------------------------------------------------------------------------------------------------------- |
| Two-brick walls | tiny walls to 10 · the top brick to 20 · a bottom brick missing · walls of whole tens to 100                |
| Three rows      | build it up (only the bottom row given) · one brick missing · two missing · two missing with numbers to 100 |
| Four rows       | a tall tower (build it up) · three gaps to 50 · the giant wall to 100                                       |

Every wall is checked to have exactly one solution. Missing-brick patterns are `top`, `bottom`, `any`, `buildUp` and `mixed` (one bottom brick plus others).

### Unicorn Rainbow Race: 19 tracks (`pages/unicorn-race/race-questions.ts`)

| Cup (topic)              | Tracks, easiest first                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| Meadow · up to 20        | make ten 6 + ? = 10 · adding to 10 · taking away within 10 · plus and minus to 20         |
| Sky · up to 100          | doubles · across ten 8 + 5, 13 − 6 · plus and minus to 100 · two-digit, no carrying       |
| Starlight · times tables | ×2 ×5 ×10 · ×3 ×4 · missing factor · ×6 ×7 ×8 ×9                                          |
| Castle · missing numbers | missing numbers · hard tables to 30 · two-digit across a ten 37 + 25 · castle cup (mixed) |
| Rainbow · everything     | rainbow run · dream ride · grand prix                                                     |

A cup's keepsake needs three of its tracks finished, so the keepsakes children already earned stay theirs now that cups have four tracks.

## Adding a level

1. Give it a new id. Never reuse or renumber an existing one.
2. Put it in the game's list where its difficulty belongs, with a `group` (topic).
3. Size its round so it lasts about two to four minutes, using the table above.
4. Add its title and help in all four languages in `core/curriculum-messages.ts`.
5. If the game's route matches ids with a pattern (`app.routes.ts`), widen the pattern.
