/**
 * Counts the fireworks a child has answered on this device, so the controls keep showing what to tap
 * next until the first few fireworks are done. Without device storage it counts for this visit.
 */
export const GUIDE_KEY = 'feenland.firework-guided.v1';
/** Fireworks answered before the "tap here next" bounce only comes back when the child waits. */
export const GUIDED_FIREWORKS = 3;
let thisVisit = 0;

export function guidedFireworks(): number {
  try {
    return Number(localStorage.getItem(GUIDE_KEY)) || 0;
  } catch {
    return thisVisit;
  }
}

export function countGuidedFirework(): number {
  const count = guidedFireworks() + 1;
  try {
    localStorage.setItem(GUIDE_KEY, String(count));
  } catch {
    thisVisit = count;
  }
  return count;
}
