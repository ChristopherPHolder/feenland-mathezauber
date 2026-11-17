import { DOCUMENT } from '@angular/common';
import { computed, inject, Service, signal } from '@angular/core';
import { LocaleService } from '../../core/locale';
import {
  bookComplete,
  canEvolve,
  chooseFavorite,
  chooseRaising,
  Dragon,
  dragonById,
  evolve,
  EvolveResult,
  growthTarget,
  hatch,
  Hatchery,
  HatchResult,
  isReady,
  parseHatchery,
  stageOf,
  warm,
  warmthNeeded,
} from './dragons';
import { HatcheryMessageKey, hatcheryText } from './hatchery-messages';

const KEY = 'feenland.hatchery';

/**
 * The egg the child carries through every game. Games call `warm()` on each right answer;
 * the hatchery page cracks it open. Once every dragon has hatched, the same answers help one
 * dragon at a time evolve into new forms. Saved on the device only.
 */
@Service()
export class HatcheryStore {
  private readonly document = inject(DOCUMENT);
  private readonly locale = inject(LocaleService);
  private readonly state = signal<Hatchery>(this.restore());
  readonly hatchery = this.state.asReadonly();
  readonly saveFailed = signal(false);
  /** Counts warm-ups this visit, so the egg chip can glow on each one. */
  readonly pulse = signal(0);
  /** Every dragon has hatched: answers now evolve dragons instead of warming eggs. */
  readonly growing = computed(() => bookComplete(this.state()));
  /** Right answers given towards the egg, or towards the next stage of the dragon being raised. */
  readonly progress = computed(() => (this.growing() ? this.state().growth : this.state().warmth));
  /** What `progress` counts up to; 0 once every dragon is grand. */
  readonly needed = computed(() =>
    this.growing() ? growthTarget(this.state()) : warmthNeeded(this.state().hatches),
  );
  /** Something waits in the hatchery: an egg to crack, or a dragon ready to evolve. */
  readonly ready = computed(() =>
    this.growing() ? canEvolve(this.state()) : isReady(this.state()),
  );
  readonly egg = computed(() => dragonById(this.state().egg)!);
  readonly favorite = computed(() => dragonById(this.state().favorite));
  readonly raising = computed(() => dragonById(this.state().raising));

  /** One right answer in any game. */
  warm(amount = 1) {
    this.state.update((state) => warm(state, amount));
    this.pulse.update((count) => count + 1);
    this.save();
  }

  hatch(): HatchResult | undefined {
    const result = hatch(this.state(), Math.random);
    if (!result) return undefined;
    this.state.set(result.state);
    this.save();
    return result;
  }

  /** The dragon being raised evolves into its next form. */
  evolve(): EvolveResult | undefined {
    const result = evolve(this.state());
    if (!result) return undefined;
    this.state.set(result.state);
    this.save();
    return result;
  }

  choose(id: string) {
    this.state.update((state) => chooseFavorite(state, id));
    this.save();
  }

  raise(id: string) {
    this.state.update((state) => chooseRaising(state, id));
    this.save();
  }

  stage(dragon: Dragon): number {
    return stageOf(this.state(), dragon.id);
  }

  /** A dragon's name in the current language: each form has its own, `stage` defaults to its current one. */
  name(dragon: Dragon, stage = this.stage(dragon)): string {
    const locale = this.locale.locale();
    const family = dragon.id.replace('-starlight', '');
    const base = hatcheryText(locale, `${family}${stage || ''}` as HatcheryMessageKey);
    return dragon.starlight ? hatcheryText(locale, 'starlightName', { name: base }) : base;
  }

  private save() {
    try {
      this.document.defaultView?.localStorage.setItem(KEY, JSON.stringify(this.state()));
      this.saveFailed.set(false);
    } catch {
      this.saveFailed.set(true);
    }
  }

  private restore(): Hatchery {
    let saved: unknown = null;
    try {
      saved = JSON.parse(this.document.defaultView?.localStorage.getItem(KEY) ?? 'null');
    } catch {
      /* A damaged save starts a fresh egg. */
    }
    return parseHatchery(saved, Math.random);
  }
}
