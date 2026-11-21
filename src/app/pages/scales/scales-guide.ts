import { guideCounter } from '../../core/guide-counter';

/**
 * Counts the recipe lines a child has cooked on this device, so the controls keep showing what
 * to tap next until the first few are done.
 */
export const guide = guideCounter('feenland.scales-guided.v1');
/** Lines cooked before the "tap here next" hop only comes back when the child waits. */
export const GUIDED_LINES = 3;
/** How long a child may wait before the next controls hop again. */
export const IDLE_GUIDE = 6000;
