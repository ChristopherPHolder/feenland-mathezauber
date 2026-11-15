/**
 * Counts the potions a child has brewed on this device, so the controls keep showing what to tap
 * next until the first few potions are done. Without device storage it counts for this visit.
 */
export const GUIDE_KEY = 'feenland.potion-guided.v1';
/** Potions brewed before the "tap here next" bounce only comes back when the child waits. */
export const GUIDED_BREWS = 3;
let thisVisit = 0;

export function guidedBrews(): number {
  try {
    return Number(localStorage.getItem(GUIDE_KEY)) || 0;
  } catch {
    return thisVisit;
  }
}

export function countGuidedBrew(): number {
  const brews = guidedBrews() + 1;
  try {
    localStorage.setItem(GUIDE_KEY, String(brews));
  } catch {
    thisVisit = brews;
  }
  return brews;
}
