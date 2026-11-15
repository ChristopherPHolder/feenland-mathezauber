/**
 * Counts the stars a child has caught on this device, so the game keeps showing what to tap next
 * until the first few catches are done. Without device storage it counts for this visit.
 */
export const GUIDE_KEY = 'feenland.star-guided.v1';
/** Catches before the "tap here next" hop only comes back when the child waits. */
export const GUIDED_CATCHES = 3;
/** How long a child may wait before the hop comes back. */
export const IDLE_GUIDE = 6000;
let thisVisit = 0;

export function guidedCatches(): number {
  try {
    return Number(localStorage.getItem(GUIDE_KEY)) || 0;
  } catch {
    return thisVisit;
  }
}

export function countGuidedCatch(): number {
  const catches = guidedCatches() + 1;
  try {
    localStorage.setItem(GUIDE_KEY, String(catches));
  } catch {
    thisVisit = catches;
  }
  return catches;
}
