import { DOCUMENT } from '@angular/common';
import { computed, inject, Service, signal } from '@angular/core';
import { Fact, sameFact } from './bakery-levels';
import { boardIndex } from './bakery-frame';

const KEY = 'feenland.bakery.v1';
/** Missed facts kept for rehearsal, newest first. */
const MISSED_LIMIT = 12;

export interface BakeryRecord {
  readonly version: 1;
  /** Most points per level. */
  readonly best: Readonly<Record<string, number>>;
  /** The menu board: 100 squares, 0 empty, 1 baked, 2 baked with a trick. */
  readonly board: readonly number[];
  /** Facts the child missed, to bring back in a later round. */
  readonly missed: readonly Fact[];
  /** Bakery levels finished at least once: each puts a treat in the shop window. */
  readonly treats: readonly string[];
}

const empty = (): BakeryRecord => ({
  version: 1,
  best: {},
  board: Array.from({ length: 100 }, () => 0),
  missed: [],
  treats: [],
});

const isFact = (value: unknown): value is Fact =>
  !!value &&
  typeof value === 'object' &&
  [(value as Fact).rows, (value as Fact).cols].every(
    (n) => Number.isInteger(n) && n >= 1 && n <= 10,
  );

export function parseBakery(value: unknown): BakeryRecord {
  if (!value || typeof value !== 'object' || (value as { version?: unknown }).version !== 1)
    return empty();
  const raw = value as Partial<Record<keyof BakeryRecord, unknown>>;
  const best =
    raw.best && typeof raw.best === 'object' && !Array.isArray(raw.best)
      ? Object.fromEntries(
          Object.entries(raw.best).filter(
            ([id, score]) =>
              /^bakery-\d{1,2}$/.test(id) && Number.isInteger(score) && (score as number) >= 0,
          ),
        )
      : {};
  const board =
    Array.isArray(raw.board) && raw.board.length === 100
      ? raw.board.map((n) => (n === 1 || n === 2 ? n : 0))
      : empty().board;
  const missed = Array.isArray(raw.missed) ? raw.missed.filter(isFact).slice(0, MISSED_LIMIT) : [];
  const treats = Array.isArray(raw.treats)
    ? raw.treats.filter((id): id is string => typeof id === 'string' && /^bakery-\d{1,2}$/.test(id))
    : [];
  return { version: 1, best: best as Record<string, number>, board, missed, treats };
}

/**
 * What the bakery remembers between visits: best points, the menu board, the shop window and
 * the facts to rehearse. Saved on the device only.
 */
@Service()
export class BakeryScores {
  private readonly document = inject(DOCUMENT);
  private readonly state = signal<BakeryRecord>(this.restore());
  readonly best = computed(() => this.state().best);
  readonly board = computed(() => this.state().board);
  readonly missed = computed(() => this.state().missed);
  readonly treats = computed(() => this.state().treats.length);
  readonly baked = computed(() => this.state().board.filter((n) => n > 0).length);

  /**
   * Fills the menu board for a fact the child baked or named, with its turnaround (same
   * cookies). Returns how many squares were new.
   */
  bake(fact: Fact, star = false): number {
    let fresh = 0;
    const board = [...this.state().board];
    for (const [rows, cols] of [
      [fact.rows, fact.cols],
      [fact.cols, fact.rows],
    ]) {
      const index = boardIndex(rows, cols);
      if (index < 0 || index > 99) continue;
      if (!board[index]) fresh++;
      board[index] = Math.max(board[index], star ? 2 : 1);
    }
    this.update({ board });
    return fresh;
  }

  /** A fact the child slipped on comes back in the next round of any bakery level. */
  miss(fact: Fact) {
    const missed = [fact, ...this.state().missed.filter((item) => !sameFact(item, fact))];
    this.update({ missed: missed.slice(0, MISSED_LIMIT) });
  }

  /** Baked right first time again: it no longer needs rehearsing. */
  learn(fact: Fact) {
    if (!this.state().missed.some((item) => sameFact(item, fact))) return;
    this.update({ missed: this.state().missed.filter((item) => !sameFact(item, fact)) });
  }

  /** Records a finished round. Returns true for a new best and whether a treat was added. */
  finish(levelId: string, score: number): { best: boolean; treat: boolean } {
    const state = this.state();
    const best = (state.best[levelId] ?? 0) < score;
    const treat = !state.treats.includes(levelId);
    this.update({
      best: best ? { ...state.best, [levelId]: score } : state.best,
      treats: treat ? [...state.treats, levelId] : state.treats,
    });
    return { best, treat };
  }

  private update(change: Partial<BakeryRecord>) {
    this.state.update((state) => ({ ...state, ...change }));
    try {
      this.document.defaultView?.localStorage.setItem(KEY, JSON.stringify(this.state()));
    } catch {
      /* The bakery remembers this visit only. */
    }
  }

  private restore(): BakeryRecord {
    try {
      return parseBakery(
        JSON.parse(this.document.defaultView?.localStorage.getItem(KEY) ?? 'null'),
      );
    } catch {
      return empty();
    }
  }
}
