# The Stable: the horse a child races with

In the Unicorn Rainbow Race the child races with a horse they made themselves. The Stable is where they make it. Lumi, the white unicorn with the rainbow mane, is the horse everyone starts with, so a child who never opens the Stable still has a horse. The plan and its four PRs are in issue #270.

## What a horse is

`src/app/pages/unicorn-race/horse.ts` holds the model:

| Part      | Values                                                                                                                      |
| --------- | --------------------------------------------------------------------------------------------------------------------------- |
| `name`    | Up to 12 characters, tidied by `cleanName`. Empty means the default name in the child's language (Lumi).                    |
| `kind`    | `unicorn`, `pegasus`, `alicorn` (winged unicorn), `pony`                                                                    |
| `coat`    | 10 free coats, plus 3 sparkle specials (`pearl`, `golden`, `galaxy`). Each has a coat colour, a shade and a marking colour. |
| `mane`    | 8 free three-colour manes, plus 3 specials (`fire`, `aurora`, `glitter`)                                                    |
| `marking` | `none`, `star`, `blaze`, `socks`, `spots`                                                                                   |
| `horn`    | `gold`, `silver`, `rose`, `crystal`. It only shows with a horn, but is kept when the kind changes.                          |

`readHorse` reads a stored horse part by part, so a save from before a part existed keeps everything else.

## Where it is drawn

- **3D**: `race-pony.ts` builds every racer from a `Look`. The rivals are fixed; the player and the shadow come from the horse (`lookFor`). The shadow keeps its ghostly lilac but takes the horse's kind. Markings are geometry (a face stripe loft, white lower legs, spots set into the coat), and special coats change the material (metal, pearl iridescence, a scatter of stars).
- **2D**: `racer-art.ts` takes the same horse. Colours are CSS custom properties on the host, socks are per-instance SVG gradients and the markings are paths.
- **Name**: every race message uses `{name}`, and the wording avoids pronouns so any name fits.
- **Loading scene**: `race-loader-world.ts` reads the save through `saved-look.ts`, without the Angular store, so the horse already gallops while the race downloads.

## The Stable screen

`stable/horse-stable.ts` is a phase of the race page, not a route. It opens once on a child's first visit (`stableSeen` in the save) and again from their horse in the intro line-up.

- **One screen, no scrolling** at 390×844, 844×390, 820×1180 and 1180×820. The host is a size container: portrait stacks the stand, tabs, options and Done; anything wider than about 1.15:1 puts the stand on the left. Check every tab at all four sizes after a layout change.
- **Every change saves at once**, so leaving by the back arrow keeps the horse. Done only closes the Stable.
- **The stand** (`stable/stable-world.ts`) sways slowly, turns when dragged and hops on every change. Under calm motion it holds a three-quarter view and doesn't hop. Without WebGL the 2D horse shows.
- **Accessibility**: tabs follow the ARIA tabs pattern, options are real radio buttons with spoken names, the chosen option has a ring and a tick, and focus moves to the heading on open and back to the line-up horse on Done.

## Sparkle specials

Every race pays out sparkles (about 150 to 250). In the Stable they buy specials, which are kept for good. The prices are in `SPECIALS` in `horse.ts` (200 to 800, so two to four races each).

- Tapping a special the child doesn't own **tries it on**: the horse shows it and the save doesn't change. Done gives way to a buy bar, either "Buy for ✨500" or "500 more ✨ needed", plus ✕. Switching tabs or Done drops the try-on.
- The save keeps `owned` and `spent`. The balance is `sparkles - spent`, and the intro's sparkle total still counts everything ever earned. `setHorse` refuses a special the child doesn't own, and loading a save puts an unowned special back to Lumi's coat or mane.
- "Surprise me" picks only from free parts and owned specials.

## Adding a coat, mane or marking

1. Add it to `COATS`, `MANES` or `markings` in `horse.ts`. For a special, also add a price to `SPECIALS`.
2. Add its name to `stable/stable-messages.ts` in all four languages (`coatX`, `maneX`, `markingX`).
3. For a marking, draw it in `race-pony.ts` and `racer-art.ts`.
4. Check the swatch grid still fits on a sideways phone: coats are 7 per row and manes 6.
