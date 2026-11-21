/**
 * Counts the recipe lines a child has cooked on this device, so the controls keep showing what
 * to tap next until the first few are done. Without device storage it counts for this visit.
 */
export const GUIDE_KEY = 'feenland.scales-guided.v1';
/** Lines cooked before the "tap here next" hop only comes back when the child waits. */
export const GUIDED_LINES = 3;
/** How long a child may wait before the next controls hop again. */
export const IDLE_GUIDE = 6000;
let thisVisit = 0;

export function guidedLines(): number {
  try {
    return Number(localStorage.getItem(GUIDE_KEY)) || 0;
  } catch {
    return thisVisit;
  }
}

export function countGuidedLine(): number {
  const lines = guidedLines() + 1;
  try {
    localStorage.setItem(GUIDE_KEY, String(lines));
  } catch {
    thisVisit = lines;
  }
  return lines;
}
