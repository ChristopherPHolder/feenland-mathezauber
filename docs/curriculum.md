# Curriculum and level design

Feenland has 156 selectable levels across eleven games (plus the castle's twenty waves and six heats per race track). Every level practises one thing, takes about two to four minutes, and sits in a topic inside its game. Inside each game, levels are listed easiest first.

## How long a level should be

The research on session length for young children is thin. This is what it supports:

- **Short, frequent sessions beat long ones.** Practitioner guidance for primary maths points to about 10–15 minutes a day, split into calm, short sessions. Fluency programmes ask for about 10 minutes, at least three times a week. ([Brilliant parent guide](https://brilliant.org/practice/guides/how-long-should-a-child-practice-math/), [Math Fact Lab](https://mathfactlab.helpscoutdocs.com/article/49-suggested-amount-of-student-usage), [Mathnasium](https://www.mathnasium.com/math-centers/woodbridge/news/effective-daily-math-routine))
- **Spacing helps.** Distributed practice for maths facts is studied directly, for example massed versus short and long distributed practice ([Oklahoma State](https://openresearch.okstate.edu/entities/publication/f6a09b20-c244-4d7a-b05b-681bf3159d5d)), and the general finding is that spread-out practice helps.
- **Attention is the stopping cue.** The common rule of thumb is two to three minutes of attention per year of age, so 14–21 minutes for a seven-year-old. It is an estimate, not a measured result. Guidance also says to stop when answers become rushed or frustration rises.
- **One goal per chunk.** Microlearning guidance for children, mostly from education publishers, suggests 5–15 minute sessions with one clear objective each ([Twinkl](https://www.twinkl.com/news/buzzwords-in-education-2024-microlearning), [Night Zookeeper](https://www.nightzookeeper.com/blog/articles/what-is-microlearning)).

**What we built from this:** a level is a 2–4 minute chunk with one skill, so a 10–15 minute sitting is three to five levels, often across games. Finishing always counts, and stars reward care, not speed.

## Timing per game

These estimates assume a seven-year-old answering steadily, animations included.

| Game                 | One level is                                                     | Estimate                                              |
| -------------------- | ---------------------------------------------------------------- | ----------------------------------------------------- |
| Defend the Castle    | a battle of 10 questions (`STAGE_QUESTIONS`)                     | 10 × (8–15 s + spell) ≈ 2–3 min                       |
| The Hungry Crocodile | 15 snacks (plain numbers), 12 (one sum), 10 (two sums or tables) | 15 × 6 s ≈ 1.5–2.5 min; 10 × 15 s ≈ 2.5–3.5 min       |
| Magic walls          | 8 two-brick walls, 5–6 three-row walls, 4 four-row walls         | 8 × 15 s ≈ 2 min … 4 × 60 s ≈ 4 min                   |
| Unicorn Rainbow Race | one heat (six per track)                                         | 60–90 s per heat; two or three heats in a sitting     |
| The Treasure Lock    | 6 chests of 2–6 hops each, the big chest last                    | 6 × 20–30 s ≈ 2–3 min                                 |
| The Potion Cauldron  | 6 potions of 2–4 bottles, the big cauldron last                  | 6 × 20–40 s ≈ 2–4 min                                 |
| The Firework Show    | 12 fireworks and the grand finale, then the show                 | 12 × 8–12 s + finale and show ≈ 2–3 min               |
| The Star Catcher     | 10 stars (8 on sum levels) and a 3-star finale                   | 13 × 6–10 s ≈ 1.5–2.5 min; 11 × 15–20 s ≈ 2.5–3.5 min |
| The Mushroom Drums   | 3 verses of 7–10 drums plus a 4-drum solo, about 34 answers      | 34 × 2.5–3.5 s + demos and titles ≈ 2.5–3.5 min       |
| The Fairy Bakery     | 6 trays and the party cake (cut, two pieces, a total)            | 7 × 25–35 s ≈ 3–4 min; level 1 (no cut) ≈ 2 min       |
| The Mountain Gondola | 8–10 cabins (8 on two-digit levels), the big summit cabin last   | 10 × 12–15 s ≈ 2.5 min; 8 × 18–25 s ≈ 3 min       |

The race heats stay at 60–90 seconds because their pace is tuned by simulation (see the race balance notes). A track's six heats are its sub-levels.

Round lengths are data, not code paths: `snacks` on each crocodile stage, `walls` in each wall level's rules, and `STAGE_QUESTIONS` for the castle.

## Level map

Ids never change once shipped, because progress and bookmarks use them. New levels got new ids and were slotted into the list by difficulty. The number on a card is its position, not its id.

### Defend the Fairy Castle: 30 stages (`core/practice.ts`)

| Topic         | Stages, easiest first                                                                                       |
| ------------- | ----------------------------------------------------------------------------------------------------------- |
| Castle waves  | the twenty-wave making-ten campaign                                                                         |
| Tens and ones | 17 = 10 + □ (to 20) · 24 = □ + 4 (to 30) · 68 = 60 + □ (to 100)                                             |
| Adding        | make ten 7 + □ = 10 · to 10 · to 20 · across ten to 20 · across ten to 30 · to 100 · across ten to 100      |
| Taking away   | to 10 · to 20 · across ten 13 − □ = 6 · to 30 · find the starting number □ − 8 = 12 · to 100                |
| Times tables  | ×2 ×5 ×10 to 100 · tables to 30 · ×3 ×4 · ×6 ×7 ×8 ×9 · missing factor to 30 · missing factor to 100        |
| Sharing       | half of 14 · half of 48 · ÷2 ÷5 ÷10 (35 ÷ 5) · ÷3 ÷4 · ÷6 ÷7 ÷8 ÷9 · times and sharing (□ × 6 = 42, 42 ÷ 6) |
| Mixed magic   | mixed to 30 · mixed to 100                                                                                  |

Easy, medium and hard stay a separate, remembered choice. For the row-based table stages, easy keeps to ×2…×6 of each row and hard to ×5…×10, and both orders (4 × 7 and 7 × 4) appear. Sharing stages use the same rows and limits, so every division is exact and every half is of an even number.

German and French schools write division with a colon, so `localQuestion` (castle) and `raceSumText` (race) show `35 : 5` and the localized "half of" in those languages. Questions are generated in English form and translated only for display.

### The Hungry Crocodile: 17 levels (`pages/crocodile/comparison.ts`)

| Topic             | Levels, easiest first                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| Compare numbers   | to 10 · to 20 · to 100 · to 1000 (408 ○ 480)                                                           |
| Work it out first | sums to 10 · sums to 20 · differences to 10 · differences to 20 · two sums to 20                       |
| Up to 100         | the big number buffet (40 + 8 ○ 50) · two calculations to 100 (30 + 15 ○ 50 − 4)                       |
| Times tables      | ×2 ×5 ×10 against a number (5 × 3 ○ 12) · tables to 30 (4 × 5 ○ 3 × 7) · tables to 100 (6 × 7 ○ 8 × 5) |
| Sharing           | halves (½ of 16 ○ 7) · share by 2, 5 and 10 (30 ÷ 5 ○ 7) · times or sharing (4 × 3 ○ 24 ÷ 2)           |

On a halving side the screen shows a ½ tile, the word "of" in the child's language and a number; the Halves level adds the "forgot to halve" trap (½ of 16 ○ 10). Every division is a times-table fact backwards.

The seven original levels keep their hats; the new ones add rounds, not hats.

### Magic walls: 11 levels (`pages/number-wall/number-wall.ts`)

| Topic           | Levels, easiest first                                                                                       |
| --------------- | ----------------------------------------------------------------------------------------------------------- |
| Two-brick walls | tiny walls to 10 · the top brick to 20 · a bottom brick missing · walls of whole tens to 100                |
| Three rows      | build it up (only the bottom row given) · one brick missing · two missing · two missing with numbers to 100 |
| Four rows       | a tall tower (build it up) · three gaps to 50 · the giant wall to 100                                       |

Every wall is checked to have exactly one solution. Missing-brick patterns are `top`, `bottom`, `any`, `buildUp` and `mixed` (one bottom brick plus others).

### Unicorn Rainbow Race: 22 tracks (`pages/unicorn-race/race-questions.ts`)

| Cup (topic)              | Tracks, easiest first                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Meadow · up to 20        | make ten 6 + ? = 10 · adding to 10 · taking away within 10 · plus and minus to 20                                   |
| Sky · up to 100          | doubles · halves (half of 18) · across ten 8 + 5, 13 − 6 · plus and minus to 100 · two-digit, no carrying           |
| Starlight · times tables | ×2 ×5 ×10 · ×3 ×4 · share by 2, 5, 10 (35 ÷ 5) · missing factor · ×6 ×7 ×8 ×9                                       |
| Castle · missing numbers | missing numbers · hard tables to 30 · two-digit across a ten 37 + 25 · sharing to 100 (42 ÷ 6) · castle cup (mixed) |
| Rainbow · everything     | rainbow run · dream ride · grand prix                                                                               |

A cup's keepsake needs three of its tracks finished, so the keepsakes children already earned stay theirs now that cups have four or five tracks. Maths that is slower than the rest of its cup gets an `ease` on its track (sharing to 100 has 0.9 and a shorter length), so the rivals stay a fair race.

### The Treasure Lock: 9 levels (`pages/treasure-lock/lock-puzzles.ts`)

| Topic                | Levels, easiest first                                                                                                                                            |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hops to 20           | hops of five +5 +5 −1 → 9 · threes and twos +3 +3 +2 → 8                                                                                                         |
| Tens tricks          | tens and ones +10 +10 +1 → 21 · the nine trick +10 +10 −1 → 19 · hopping back 50 −10 −1 → 39                                                                     |
| Doubling and halving | doubling magic 1 +1 ×2 ×2 → 8 · halving back 40 ÷2 ÷2 → 10 · treasure master on a dial to 100 with thorns +10 ×2 ×2 −1 → 39 · double and halve 40 ×2 +10 ÷2 → 45 |

Every lock is checked by the solver in `lock-puzzles.ts`, which picks targets whose fewest hops fall in the level's `par` range, so a round never asks for more hops than its level allows. The ÷2 spell only works on an even number; on an odd one the button is greyed out with a line saying why, and the solver follows the same rule. Halving levels only pick locks where ÷2 is part of every fewest-hops way.

### The Potion Cauldron: 7 levels (`pages/potions/potion-puzzles.ts`)

| Topic                  | Levels, easiest first                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| Plus and minus         | plus or minus? 9 − 4 → 5 · three bottles 8 + 5 − 3 → 10 · friends of ten 7 + 3 + 20 → 30 |
| Times potions          | times potions 2 × 5 + 3 → 13 · four bottles 3 × 4 + 2 − 1 → 13                           |
| Sharing and all spells | sharing potions 12 ÷ 3 + 2 → 6 · potion master with all four spells 8 ÷ 2 × 3 + 1 → 13   |

A potion is built by mixing random bottles with random spells, so it always brews, and the solver in `potion-puzzles.ts` then checks it: the potion never equals one of its bottles, and a level's `needs` spells (− for three bottles, × for the times levels, ÷ for sharing, × or ÷ for the master) must be part of every recipe. The built recipe keeps to table facts (no ×1, nothing past 10 × 10, sharing only within the tables), though a child may brew a potion any way that works. A bottle never goes empty or below zero, never holds more than the level's limit, and only shares evenly; a bottle the chosen spell cannot pour in is greyed out with a line saying why.

### The Fairy Bakery: 12 levels (`pages/bakery/bakery-levels.ts`)

| Topic             | Levels, easiest first                                                                         |
| ----------------- | --------------------------------------------------------------------------------------------- |
| Friendly trays    | read the tray (×2, ×5, ×10, 2–5 rows, no cut) · turn it round 5 × 7 = 7 × 5                   |
| One more row      | ×3 = ×2 + a row 3 × 6 = 2 × 6 + 6 · ×6 = ×5 + a row 6 × 7 = 5 × 7 + 7                         |
| Doubling          | ×4 = double ×2 · ×8 = double ×4 (up to three cuts) · ×6 = double ×3                           |
| One row less      | ×9 = ×10 − a row 9 × 6 = 10 × 6 − 6, with one ×4 = ×5 − a row order                           |
| Big trays         | ×7 = ×5 + ×2 · your choice (×3, ×4, ×6–×9 up to 60)                                           |
| Baker’s challenge | area model, all facts to 100 · master baker (missed facts first, then the hardest; needs ★★★) |

The bakery is the "derive" step between the friendly facts and recall: the child cuts a tray along a gap into trays they know, names each piece from four choices, then types the total. Any cut along a gap is right; the level's trick only decides which gap glows and which cut earns the clever-trick bonus. Trays fade from cookies (1–6) to cookies with labelled sides and 5 × 5 blocks (7–10) to a bare area model (11–12, with a "Show the cookies" switch). From level 9 a baked tray can be cut another way for a bonus. A fact the child slipped on comes back two orders later in the same round and early in the next round of any bakery level whose range includes it (`BakeryScores.missed`). Help never shows a product: it names the rows' pattern, restates the child's own piece values, and then shows a recipe card with other numbers.

### The Firework Show: 12 levels (`pages/fireworks/firework-levels.ts`)

| Topic          | Levels, easiest first                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------- |
| First sparks   | dice sparks 1–6 · little groups 1–5 (lines, triangles, squares, small clusters)                         |
| Fives and tens | five and more 5 + 3 = 8 · ten-frames 1–10 · make ten (count the empty spaces, 0–9)                      |
| Two bursts     | two dice 4 + 3 = 7 · ten and more 10 + 4 = 14                                                           |
| Doubles        | mirror doubles to 10 + 10 · double and one more 6 + 7 · doubles both ways (one more, one less, doubles) |
| Grand show     | twenty-frames and rows of five, 11–20, with a shorter look · the grand show, every pattern mixed to 20  |

The game trains conceptual subitizing: seeing a number as groups instead of counting by ones. Patterns follow the arrangement order from Clements (1999): dice faces, then five- and ten-frames, two groups side by side, doubles as mirror images, near doubles and twenty-frames. Every pattern is rotated, mirrored and recoloured (and jittered a little from level 3), so no picture becomes memorised, and the same picture, answer or colour never comes twice in a row. Two-burst fireworks differ by place and spark shape (round and star), never by colour alone; a near double "one less" shows the missing spark as a hollow ring.

Only the look is timed, never the answer. Three remembered paces set how long a burst glows (Gentle glow 3 s with free peeks, Glow 2 s, Pop 1.5 s); within a round the look gets 0.2 s shorter after three first looks in a row and 0.3 s longer after a miss or a peek, kept inside the pace's range (2.5–4 s, 1.5–2.5 s, 1–2 s). Two-burst fireworks glow 0.4 s longer. Level 11 starts a little shorter and level 12 at the pace's shortest look, and level 12 needs three stars to master.

### The Star Catcher: 12 levels (`pages/star-catcher/star-levels.ts`)

| Topic           | Levels, easiest first                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Small bridges   | numbers to 10, every post numbered · find the middle (only 0, 5, 10 written) · bridge to 20, teens past the middle       |
| Bridges to 100  | tens with 50 as the middle · small numbers with every ten written · neighbours of a ten (59, 61) · only the ends written |
| Sums in the sky | sums and differences within 20 (8 + 5) · tens sums and 47 + 5 · estimate two-digit sums (38 + 25 is about 60)            |
| Big bridges     | bridge to 1000 with 500 as the middle · mystery bridge, the far end hidden, count steps of 10 or 100                     |

The generator spreads a round's numbers across the bridge, one from each equal slice, because feedback works by adding local reference points. Levels 5 and 11 put at least 30% of their stars in the squash zone (11–30 and 100–250), where children squeeze big numbers toward 0, and level 11 starts with three hundreds. Level 6 adds two pairs either side of a ten (59 then 61) against left-digit bias. No number repeats within a round until a small pool (1–9, the nine tens) runs out, and then never twice in a row. Stars avoid the last 3% at either end except on levels 1–2. Sum levels make sure every result stays on the bridge. The catch and golden windows are shares of the bridge (±10%/±3% on the small bridges down to ±7%/±2%), and from the third miss on a star the catch window widens by half its size each time, up to a quarter of the bridge each way, so a child is never stuck; the star is still only caught where its number belongs. From level 5 on, about one star in five is another item type: where did it land (pick the number of an unlabelled star), which is further (two numbers either side of a landmark), and on levels 6–7 a middle star.
### The Mountain Gondola: 12 levels (`pages/gondola/gondola-levels.ts`)

| Topic             | Levels, easiest first                                                                                             |
| ----------------- | ----------------------------------------------------------------------------------------------------------------- |
| Fill the cabin    | one empty seat 9 + 4 → 10 + 3 · two empty seats 8 + 5 · sevens and sixes 7 + 6 · either order 5 + 8 → 8 + 5        |
| Down the mountain | back to ten 13 − 5 → 10 − 2 · take from the ten 13 − 9 → 1 + 3                                                     |
| Bigger mountains  | bigger mountain up 47 + 6 → 50 + 3 · bigger mountain down 43 − 6 → 40 − 3 · tens and a bridge 38 + 25 → 40 + 23    |
| Clever tricks     | the express 34 + 9 → 44 − 1 · express both ways 63 − 9 → 53 + 1 · mountain master (mixed, numbers only)            |

Every cabin holds ten, in two rows of five. Every item crosses a ten (the generator filters for it), no item repeats in a round, and the last cabin is a big summit cabin from a harder pool that pays double. Single-digit levels (1–6) play 8 or 10 cabins with four answer buttons; levels 1 and 2 have only 8 different sums, so they play 8. Two-digit levels play 8 cabins with a number pad laid out in fives. The split must fill the cabin exactly (or, from level 6, take everything from a full ten; from level 10, send the express): a wrong split bounces a bunny off or jams the door, and after two slips Gusti shows a picture card with other numbers. Levels 1–6 show bunnies, 7–9 show full tens as "10" cabins, and 10–12 show numbers with a split diagram and a "Show the bunnies" button. Within a level, three quick first-try turns in a row bring a snow tarp over the cabins until the next miss. Level 10 asks for +9 and +8 rather than the issue's +11, because +11 only crosses a ten after a number ending in 9. Round stars come from first-try splits (three for 75%, two for half), and the master level needs three to be mastered.

## Adding a level

1. Give it a new id. Never reuse or renumber an existing one.
2. Put it in the game's list where its difficulty belongs, with a `group` (topic).
3. Size its round so it lasts about two to four minutes, using the table above.
4. Add its title and help in all four languages in `core/curriculum-messages.ts`.
5. If the game's route matches ids with a pattern (`app.routes.ts`), widen the pattern.

### The Mushroom Drums: 12 levels (`pages/drums/drum-patterns.ts`)

| Topic             | Levels, easiest first                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------ |
| Big steps         | tens 0, 10, 20 · fives 0, 5, 10 · twos 0, 2, 4                                             |
| Off the tens      | tens from any number 3, 13, 23 · odd twos 25, 27, 29, 31 · fives off the tens 3, 8, 13, 18 |
| Backwards         | tens back 97, 87, 77 · twos and fives back 40, 38, 36 · back over the tens 52, 51, 50, 49  |
| Times-table steps | threes 0, 3, 6, 9 · fours 0, 4, 8, 12                                                      |
| Drum master       | every step both ways past 100, 87, 97, 107 (needs three stars for mastery)                 |

A round has three verses and a drum solo. Verse 1 counts from an easy start and verse 2 from an awkward start or the other way; both open with Pom hopping two steps by himself so the child sees the pattern. Verse 3 is call and response: eight fresh starts, the band plays two numbers and the child plays the third, and every fourth call asks for the number before. A path stops early rather than leave the level's range (0 to 100 in tens has room for eight answers after the demo), so verses hold 7–10 questions. The four solo drums pay double and do not count for stars; three stars need 32 of 36 first tries (as a share of the verse questions), two need 24.

The answer buttons are the answer plus the mistakes children really make, most telling first: in German the digits swap (27 and 72, because "siebenundzwanzig" says the ones first); in French 71–79 and 91–99 drop to the ten before (77 becomes 67, "soixante-dix-sept"); at a ten crossing the old ten repeats (28 → 20, 31 → 39); then the next number instead of the next step, a ten skipped or repeated, and the wrong direction. After a first miss Pom names the step ("+10 each jump"), after a second a rule card shows the rule with other numbers (never a run holding the answer), and from the third miss one more wrong button greys out each time, always leaving two.
