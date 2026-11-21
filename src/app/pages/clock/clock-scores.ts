import { DOCUMENT } from '@angular/common';
import { computed, inject, Service, signal } from '@angular/core';
import { EVENT_IDS, EventId } from './clock-levels';

const KEY = 'feenland.clock-tower.v1';
const LEVEL_ID = /^clock-\d{1,2}$/;
const FRIEND_IDS: readonly string[] = [...EVENT_IDS, 'midnight'];
/** Everyone who can live on the balcony: one friend per event and Pip's night owl. */
export const TOTAL_FRIENDS = FRIEND_IDS.length;

export interface ClockSave {
  /** Most points won per level. */
  readonly best: Readonly<Record<string, number>>;
  /** Creatures woken at least once, in the order they came to the balcony. */
  readonly friends: readonly EventId[];
}

export function parseClockSave(value: unknown): ClockSave {
  const empty: ClockSave = { best: {}, friends: [] };
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1)
    return empty;
  const raw = value as { best?: unknown; friends?: unknown };
  const best =
    raw.best && typeof raw.best === 'object' && !Array.isArray(raw.best)
      ? (Object.fromEntries(
          Object.entries(raw.best).filter(
            ([id, score]) =>
              LEVEL_ID.test(id) &&
              typeof score === 'number' &&
              Number.isInteger(score) &&
              score >= 0,
          ),
        ) as Record<string, number>)
      : {};
  const friends = Array.isArray(raw.friends)
    ? [
        ...new Set(
          raw.friends.filter(
            (id): id is EventId => typeof id === 'string' && FRIEND_IDS.includes(id),
          ),
        ),
      ]
    : [];
  return { best, friends };
}

/** Best points per clock level and the friends living on the tower balcony. */
@Service()
export class ClockScores {
  private readonly document = inject(DOCUMENT);
  private readonly save = signal<ClockSave>(this.restore());
  readonly best = computed(() => this.save().best);
  readonly friends = computed(() => this.save().friends);

  /** Wakes a friend for good. Returns true when it is new on the balcony. */
  befriend(id: EventId): boolean {
    const save = this.save();
    if (save.friends.includes(id)) return false;
    this.write({ ...save, friends: [...save.friends, id] });
    return true;
  }

  /** Records a finished round; returns whether the score is a new best. */
  record(levelId: string, score: number): boolean {
    const save = this.save();
    if ((save.best[levelId] ?? 0) >= score) return false;
    this.write({ ...save, best: { ...save.best, [levelId]: score } });
    return true;
  }

  private write(save: ClockSave) {
    this.save.set(save);
    try {
      this.document.defaultView?.localStorage.setItem(KEY, JSON.stringify({ version: 1, ...save }));
    } catch {
      /* The balcony stays for this visit. */
    }
  }

  private restore(): ClockSave {
    try {
      return parseClockSave(
        JSON.parse(this.document.defaultView?.localStorage.getItem(KEY) ?? 'null'),
      );
    } catch {
      return { best: {}, friends: [] };
    }
  }
}
