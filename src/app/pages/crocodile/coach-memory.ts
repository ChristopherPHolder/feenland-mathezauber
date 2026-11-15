/** Remembers that a child has seen how to feed Kiki, so the first-round coach shows only once. */
export const COACH_KEY = 'feenland.crocodile-coached.v1';
/** Without device storage, the coach still shows only once per visit. */
let seenThisVisit = false;
export function hasCoached(): boolean {
  if (seenThisVisit) return true;
  try {
    return localStorage.getItem(COACH_KEY) === '1';
  } catch {
    return false;
  }
}
export function markCoached(): void {
  try {
    localStorage.setItem(COACH_KEY, '1');
  } catch {
    seenThisVisit = true;
  }
}
