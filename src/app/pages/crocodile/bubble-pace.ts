export const BUBBLE_PACES = [
  { id: 'off', label: 'paceOff', seconds: 0, mathsSeconds: 0 },
  { id: 'relaxed', label: 'paceRelaxed', seconds: 30, mathsSeconds: 45 },
  { id: 'normal', label: 'paceNormal', seconds: 15, mathsSeconds: 25 },
  { id: 'fast', label: 'paceFast', seconds: 8, mathsSeconds: 15 },
] as const;
export type BubblePace = (typeof BUBBLE_PACES)[number]['id'];
export const BUBBLE_PACE_KEY = 'feenland.crocodile-bubble-pace.v1';
export function parseBubblePace(value: unknown): BubblePace {
  return BUBBLE_PACES.find((pace) => pace.id === value)?.id ?? 'off';
}
export function readBubblePace(): BubblePace {
  try {
    return parseBubblePace(localStorage.getItem(BUBBLE_PACE_KEY));
  } catch {
    return 'off';
  }
}
export function saveBubblePace(pace: BubblePace): void {
  try {
    localStorage.setItem(BUBBLE_PACE_KEY, pace);
  } catch {
    // Keep playing with the selected pace when device storage is unavailable.
  }
}
