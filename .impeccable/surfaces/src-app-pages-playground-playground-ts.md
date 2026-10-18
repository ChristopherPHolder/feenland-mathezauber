---
version: 1
slug: "src-app-pages-playground-playground-ts"
primary_target: "src/app/pages/playground/playground.ts"
related_targets: ["src/app/pages/playground/playground.html","src/app/pages/playground/playground.css","src/app/app.routes.ts"]
---

# Playground and level selection
Mode: Experience entry. Audience: children practicing math. Route: /, lazily loaded. This is an ordinary extension of the existing Enchanted Garden world; DESIGN.md remains the visual authority.

## Direction contract
THESIS: Make the first choice welcoming and legible: choose a level or mini game, then start playing. Every level is available immediately, without completion gates or saved progress requirements.
OWN-WORLD: Preserve the lavender ground, plum reading contrast, rounded local Fredoka lettering, raspberry action cues, mint accents, berry wordmark, shared SVG motifs, and existing painted Luna artwork. Use the incumbent illustration rather than introducing a new visual identity.
STORY: Luna welcomes the child with “What shall we play today?” and reassurance that they may start anywhere, take their time, and retry. Three numbered rows communicate the activity, number range, visit size, and current game language before navigation.
FIRST VIEWPORT: A compact berry wordmark and quiet tagline precede a welcome with Luna alongside the heading, above the level list. The three full-row links form a vertical ordered list: Level 1 Little berry bites, Level 2 Big berry bites, Level 3 Number bridge. Desktop rows place the level number, description, and trailing play cue across one line; mobile keeps the rows stacked and places the play cue below the copy. The compact welcome still pairs text with a smaller Luna image on mobile.
FORM: Pale rounded rows give the existing world a clear selection surface. Level 1 uses the pale play surface, Level 2 a soft berry tint, and Level 3 mint. Numbers and explicit labels carry the progression; color is supplementary. No locks, progress bars, completion badges, or imposed sequence.
INTERACTION: Each entire row is one keyboard-accessible RouterLink. Level 1 opens /games/garden/little with initial little recipes (up to 10); Level 2 opens /games/garden/big with initial big recipes (up to 20); Level 3 opens the preserved German game at /games/number-bridge (up to 30). Garden visits contain five treats; the bridge advertises eight puzzles. Game-language labels make the existing English/German difference visible without implying a language selector.
ACCESSIBILITY: Focus the landing heading on entry. Keep semantic heading order, an ordered level list, descriptive link content, meaningful Luna alternative text, inherited visible keyboard focus, and reduced-motion handling. Preserve full-row targets and avoid a nested action inside each link.
FINISH: Review the implemented selection flow, direct game entry, and return paths with desktop and mobile checks and AXE scans. Record verification results in the task report; this brief does not substitute for test evidence. Preserve DESIGN.md and .impeccable/design.json as the existing system; their pre-existing sidecar drift is outside this surface change.
