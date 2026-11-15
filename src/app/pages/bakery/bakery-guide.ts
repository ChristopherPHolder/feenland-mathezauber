/**
 * Counts the trays a child has baked on this device, so the controls keep showing what to tap
 * next until the first few trays are done. Without device storage it counts for this visit.
 */
export const GUIDE_KEY = 'feenland.bakery-guided.v1';
/** Trays baked before the "tap here next" hop only comes back when the child waits. */
export const GUIDED_BAKES = 3;
/** How long a child may wait before the next control hops again. */
export const IDLE_GUIDE = 6000;
let thisVisit = 0;

export function guidedBakes(): number {
  try {
    return Number(localStorage.getItem(GUIDE_KEY)) || 0;
  } catch {
    return thisVisit;
  }
}

export function countGuidedBake(): number {
  const bakes = guidedBakes() + 1;
  try {
    localStorage.setItem(GUIDE_KEY, String(bakes));
  } catch {
    thisVisit = bakes;
  }
  return bakes;
}
