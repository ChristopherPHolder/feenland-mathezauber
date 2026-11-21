/**
 * Counts a game's finished turns on this device, so its controls keep showing what to tap
 * next until the first few turns are done. Without device storage it counts for this visit.
 * Each game passes its own storage key.
 */
export interface GuideCounter {
  /** Turns finished so far. */
  count(): number;
  /** Adds one finished turn and returns the new count. */
  add(): number;
}

export function guideCounter(key: string): GuideCounter {
  let thisVisit = 0;
  const count = () => {
    try {
      return Number(localStorage.getItem(key)) || 0;
    } catch {
      return thisVisit;
    }
  };
  return {
    count,
    add() {
      const next = count() + 1;
      try {
        localStorage.setItem(key, String(next));
      } catch {
        thisVisit = next;
      }
      return next;
    },
  };
}
