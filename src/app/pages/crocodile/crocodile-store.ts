import { DOCUMENT } from '@angular/common';
import { computed, inject, Service, signal } from '@angular/core';
import { ponds } from './compare';
export interface CrocodileSave {
  readonly version: 1;
  /** Best stars per pond number. */
  readonly stars: Readonly<Record<number, number>>;
  readonly bestStreak: number;
}
const empty: CrocodileSave = { version: 1, stars: {}, bestStreak: 0 };
export function parseCrocodileSave(value: unknown): CrocodileSave {
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1)
    return empty;
  const record = value as Record<string, unknown>;
  const rawStars = record['stars'];
  const stars: Record<number, number> = {};
  if (rawStars && typeof rawStars === 'object' && !Array.isArray(rawStars))
    for (const [key, score] of Object.entries(rawStars)) {
      const pond = Number(key);
      if (
        ponds.some((entry) => entry.number === pond) &&
        typeof score === 'number' &&
        Number.isInteger(score) &&
        score >= 0 &&
        score <= 3
      )
        stars[pond] = score;
    }
  const streak = record['bestStreak'];
  return {
    version: 1,
    stars,
    bestStreak: typeof streak === 'number' && Number.isInteger(streak) && streak >= 0 ? streak : 0,
  };
}
/** Pond stars live apart from earned learning progress, like the castle campaign. */
@Service()
export class CrocodileStore {
  private readonly document = inject(DOCUMENT);
  readonly saveFailed = signal(false);
  readonly state = signal<CrocodileSave>(this.restore());
  /** Every pond up to the first one without a star is open. */
  readonly unlocked = computed(() => {
    let open = 1;
    for (const pond of ponds)
      if (pond.number === open && (this.state().stars[pond.number] ?? 0) >= 1) open++;
    return Math.min(open, ponds.length);
  });
  readonly mastered = computed(() =>
    ponds.every((pond) => (this.state().stars[pond.number] ?? 0) >= 2),
  );
  isOpen(pond: number) {
    return pond <= this.unlocked();
  }
  starsOf(pond: number) {
    return this.state().stars[pond] ?? 0;
  }
  record(pond: number, stars: number, streak: number) {
    if (!ponds.some((entry) => entry.number === pond) || !this.isOpen(pond)) return;
    this.state.update((state) => ({
      version: 1,
      stars: { ...state.stars, [pond]: Math.max(state.stars[pond] ?? 0, stars) },
      bestStreak: Math.max(state.bestStreak, streak),
    }));
    try {
      this.document.defaultView?.localStorage.setItem(
        'feenland.crocodile.v1',
        JSON.stringify(this.state()),
      );
      this.saveFailed.set(false);
    } catch {
      this.saveFailed.set(true);
    }
  }
  private restore(): CrocodileSave {
    try {
      return parseCrocodileSave(
        JSON.parse(
          this.document.defaultView?.localStorage.getItem('feenland.crocodile.v1') ?? 'null',
        ),
      );
    } catch {
      return empty;
    }
  }
}
