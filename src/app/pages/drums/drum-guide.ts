/**
 * Counts the drums a child has answered on this device, so the answer buttons keep showing where
 * to tap until the first few are done. Without device storage it counts for this visit.
 */
export const GUIDE_KEY = 'feenland.drums-guided.v1';
/** Answers before the "tap here" hop only comes back when the child waits. */
export const GUIDED_ANSWERS = 5;
/** Seconds a question may wait before the buttons hop again. */
export const GUIDE_IDLE_MS = 6000;
let thisVisit = 0;

export function guidedAnswers(): number {
  try {
    return Number(localStorage.getItem(GUIDE_KEY)) || 0;
  } catch {
    return thisVisit;
  }
}

export function countGuidedAnswer(): number {
  const answers = guidedAnswers() + 1;
  try {
    localStorage.setItem(GUIDE_KEY, String(answers));
  } catch {
    thisVisit = answers;
  }
  return answers;
}
