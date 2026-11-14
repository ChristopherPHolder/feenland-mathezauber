import { DOCUMENT } from '@angular/common';
import { computed, inject, Service, signal } from '@angular/core';
import { LocaleService } from '../../core/locale';
import {
  chooseFavorite,
  Dragon,
  dragonById,
  hatch,
  Hatchery,
  HatchResult,
  isReady,
  parseHatchery,
  warm,
  warmthNeeded,
} from './dragons';
import { HatcheryMessageKey, hatcheryText } from './hatchery-messages';

const KEY = 'feenland.hatchery';

/**
 * The egg the child carries through every game. Games call `warm()` on each right answer;
 * the hatchery page cracks it open. Saved on the device only.
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
  readonly needed = computed(() => warmthNeeded(this.state().hatches));
  readonly ready = computed(() => isReady(this.state()));
  readonly egg = computed(() => dragonById(this.state().egg)!);
  readonly favorite = computed(() => dragonById(this.state().favorite));

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

  choose(id: string) {
    this.state.update((state) => chooseFavorite(state, id));
    this.save();
  }

  /** A dragon's name in the current language. */
  name(dragon: Dragon): string {
    const locale = this.locale.locale();
    const base = hatcheryText(locale, dragon.id.replace('-starlight', '') as HatcheryMessageKey);
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
