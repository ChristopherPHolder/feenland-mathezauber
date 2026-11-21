import { guideCounter } from '../../core/guide-counter';

/** Times rung on this device: the controls show what to tap next for the first few. */
export const clockGuide = guideCounter('feenland.clock-guided.v1');
/** Times rung before the "tap here next" bounce only comes back when the child waits. */
export const GUIDED_TIMES = 3;
