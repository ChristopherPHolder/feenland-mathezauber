import { DOCUMENT } from '@angular/common';
import { computed, inject, Service, signal } from '@angular/core';
import { FRIENDS, friendForStage, FriendKind } from './picnic-friends';

const KEY = 'feenland.picnic.v1';
const LEVEL_ID = /^picnic-\d{1,2}$/;

export interface PicnicRecord {
  readonly version: 1;
  /** Most points per level. */
  readonly best: Readonly<Record<string, number>>;
  /** Levels finished at least once: each brings a friend who stays on the blanket. */
  readonly finished: readonly string[];
  /** Shares made, ever. */
  readonly shares: number;
}

const empty = (): PicnicRecord => ({ version: 1, best: {}, finished: [], shares: 0 });

export function parsePicnic(value: unknown): PicnicRecord {
  if (!value || typeof value !== 'object' || (value as { version?: unknown }).version !== 1)
    return empty();
  const raw = value as Partial<Record<keyof PicnicRecord, unknown>>;
  const best =
    raw.best && typeof raw.best === 'object' && !Array.isArray(raw.best)
      ? Object.fromEntries(
          Object.entries(raw.best).filter(
            ([id, score]) => LEVEL_ID.test(id) && Number.isInteger(score) && (score as number) >= 0,
          ),
        )
      : {};
  const finished = Array.isArray(raw.finished)
    ? raw.finished.filter(
        (id, index, all): id is string =>
          typeof id === 'string' && LEVEL_ID.test(id) && all.indexOf(id) === index,
      )
    : [];
  const shares =
    Number.isInteger(raw.shares) && (raw.shares as number) >= 0 ? (raw.shares as number) : 0;
  return { version: 1, best: best as Record<string, number>, finished, shares };
}

/** The friend each finished level brought, in the order of the friends list. */
export function joinedFriends(finished: readonly string[]): FriendKind[] {
  const kinds = new Set(finished.map((id) => friendForStage(Number(id.slice(7)))));
  return FRIENDS.filter((kind) => kinds.has(kind));
}

/**
 * What the picnic remembers between visits: best points per level and the friends who joined.
 * Saved on the device only.
 */
@Service()
export class PicnicScores {
  private readonly document = inject(DOCUMENT);
  private readonly state = signal<PicnicRecord>(this.restore());
  readonly best = computed(() => this.state().best);
  readonly joined = computed(() => joinedFriends(this.state().finished));

  /** Counts one share made. */
  shared() {
    this.update({ shares: this.state().shares + 1 });
  }

  /** Records a finished round: a new best, and the friend the level brings the first time. */
  finish(levelId: string, score: number): { best: boolean; friend: FriendKind | null } {
    const state = this.state();
    const best = (state.best[levelId] ?? 0) < score;
    const fresh = !state.finished.includes(levelId);
    const before = new Set(this.joined());
    this.update({
      best: best ? { ...state.best, [levelId]: score } : state.best,
      finished: fresh ? [...state.finished, levelId] : state.finished,
    });
    const friend = this.joined().find((kind) => !before.has(kind)) ?? null;
    return { best, friend };
  }

  private update(change: Partial<PicnicRecord>) {
    this.state.update((state) => ({ ...state, ...change }));
    try {
      this.document.defaultView?.localStorage.setItem(KEY, JSON.stringify(this.state()));
    } catch {
      /* The picnic remembers this visit only. */
    }
  }

  private restore(): PicnicRecord {
    try {
      return parsePicnic(
        JSON.parse(this.document.defaultView?.localStorage.getItem(KEY) ?? 'null'),
      );
    } catch {
      return empty();
    }
  }
}
