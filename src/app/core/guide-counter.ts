/**
 * Counts how often a child has finished a game's first steps on this device, so the game keeps
 * showing what to tap next until they have done it a few times. Without device storage it
 * counts for this visit only. One counter per game, by storage key.
 */
export class GuideCounter {
  private thisVisit = 0;

  constructor(
    private readonly key: string,
    /** How many times the guide shows by itself before it waits for an idle child. */
    readonly limit = 3,
  ) {}

  count(): number {
    try {
      return Number(localStorage.getItem(this.key)) || 0;
    } catch {
      return this.thisVisit;
    }
  }

  /** Still in the first few times: show the guide without waiting. */
  learning(): boolean {
    return this.count() < this.limit;
  }

  /** Counts one more; returns the new count. */
  add(): number {
    const count = this.count() + 1;
    try {
      localStorage.setItem(this.key, String(count));
    } catch {
      this.thisVisit = count;
    }
    return count;
  }
}

/** How long a child may wait before the next control hops again. */
export const IDLE_GUIDE = 6000;
