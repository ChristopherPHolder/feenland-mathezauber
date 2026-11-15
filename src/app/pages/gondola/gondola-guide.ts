/**
 * Counts the cabins a child has delivered on this device, so the controls keep showing what to tap
 * next until the first few cabins are done. Without device storage it counts for this visit.
 */
export const GUIDE_KEY = 'feenland.gondola-guided.v1';
/** Cabins delivered before the "tap here next" bounce only comes back when the child waits. */
export const GUIDED_CABINS = 3;
let thisVisit = 0;

export function guidedCabins(): number {
  try {
    return Number(localStorage.getItem(GUIDE_KEY)) || 0;
  } catch {
    return thisVisit;
  }
}

export function countGuidedCabin(): number {
  const count = guidedCabins() + 1;
  try {
    localStorage.setItem(GUIDE_KEY, String(count));
  } catch {
    thisVisit = count;
  }
  return count;
}
