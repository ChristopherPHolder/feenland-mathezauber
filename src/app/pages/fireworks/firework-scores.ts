import { DOCUMENT } from '@angular/common';
import { inject, Service, signal } from '@angular/core';
import { FireworkPace, parsePace } from './firework-levels';
import { BOOK_SHAPES, BookShape } from './firework-shapes';

const KEY = 'feenland.firework-show.v1';

export interface FireworkSave {
  /** Most points won per level. */
  readonly best: Readonly<Record<string, number>>;
  /** Shapes in the firework book, in the order they were found. */
  readonly book: readonly BookShape[];
  readonly pace: FireworkPace;
}

const EMPTY: FireworkSave = { best: {}, book: [], pace: 'gentle' };

export function parseFireworkSave(value: unknown): FireworkSave {
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1)
    return EMPTY;
  const raw = value as { best?: unknown; book?: unknown; pace?: unknown };
  const best =
    raw.best && typeof raw.best === 'object' && !Array.isArray(raw.best)
      ? Object.fromEntries(
          Object.entries(raw.best).filter(
            ([id, score]) =>
              /^fireworks-([1-9]|1[0-2])$/.test(id) &&
              typeof score === 'number' &&
              Number.isInteger(score) &&
              score >= 0,
          ),
        )
      : {};
  const book = Array.isArray(raw.book)
    ? [...new Set(raw.book.filter((shape): shape is BookShape => BOOK_SHAPES.includes(shape)))]
    : [];
  return { best, book, pace: parsePace(raw.pace) };
}

/** Best points per level, the shapes in the firework book and the remembered look pace. */
@Service()
export class FireworkScores {
  private readonly document = inject(DOCUMENT);
  private readonly state = signal<FireworkSave>(this.restore());
  readonly best = () => this.state().best;
  readonly book = () => this.state().book;
  readonly pace = () => this.state().pace;

  /** Returns true when `score` beats the stored best for `levelId`. */
  record(levelId: string, score: number): boolean {
    if ((this.best()[levelId] ?? 0) >= score) return false;
    this.save({ ...this.state(), best: { ...this.best(), [levelId]: score } });
    return true;
  }

  /** Adds a shape to the book. Returns true when it is new. */
  collect(shape: BookShape): boolean {
    if (this.book().includes(shape)) return false;
    this.save({ ...this.state(), book: [...this.book(), shape] });
    return true;
  }

  choosePace(pace: FireworkPace) {
    if (pace !== this.pace()) this.save({ ...this.state(), pace });
  }

  private save(next: FireworkSave) {
    this.state.set(next);
    try {
      this.document.defaultView?.localStorage.setItem(KEY, JSON.stringify({ version: 1, ...next }));
    } catch {
      /* It stays for this visit. */
    }
  }

  private restore(): FireworkSave {
    try {
      return parseFireworkSave(
        JSON.parse(this.document.defaultView?.localStorage.getItem(KEY) ?? 'null'),
      );
    } catch {
      return EMPTY;
    }
  }
}
