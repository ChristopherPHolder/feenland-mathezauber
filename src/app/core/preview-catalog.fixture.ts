import { worlds as currentWorlds } from './catalog';
/** Original preview catalog for regression tests of demo receipts and catalog expansion. */
export const worlds = currentWorlds.map((world) => ({
  ...world,
  chapters: world.chapters.filter(
    (chapter) => chapter.id !== 'math-to-30' && chapter.id !== 'compare-crocodile',
  ),
}));
