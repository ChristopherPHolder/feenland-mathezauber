import {
  bookComplete,
  canEvolve,
  chooseFavorite,
  chooseRaising,
  GRAND,
  evolve,
  growthNeeded,
  growthTarget,
  stageOf,
  DAY_DRAGONS,
  DRAGONS,
  freshHatchery,
  hatch,
  Hatchery,
  isReady,
  nextEgg,
  parseHatchery,
  starlightAwake,
  warm,
  warmthNeeded,
} from './dragons';

const first = () => 0;

describe('dragon hatchery', () => {
  it('needs a few games for the first egg and a little more for later ones', () => {
    expect([0, 1, 2, 3, 9].map(warmthNeeded)).toEqual([20, 30, 40, 50, 50]);
  });

  it('warms the egg with right answers and stops once it is ready', () => {
    let state = freshHatchery(first);
    for (let i = 0; i < 19; i++) state = warm(state);
    expect(isReady(state)).toBe(false);
    state = warm(state, 5);
    expect(isReady(state)).toBe(true);
    expect(state.warmth).toBe(20);
    expect(state.answers).toBe(24);
    expect(warm(state, -3)).toEqual(state);
  });

  it('only hatches a ready egg and starts the next one cold', () => {
    const cold = freshHatchery(first);
    expect(hatch(cold, first)).toBeUndefined();
    const result = hatch(warm(cold, 20), first)!;
    expect(result.dragon.id).toBe('ember');
    expect(result.isNew).toBe(true);
    expect(result.state.hatched).toEqual(['ember']);
    expect(result.state.favorite).toBe('ember');
    expect(result.state.warmth).toBe(0);
    expect(result.state.egg).not.toBe('ember');
    expect(warmthNeeded(result.state.hatches)).toBe(30);
  });

  it('finds every everyday dragon before waking the starlight ones', () => {
    let state: Hatchery = freshHatchery(() => 0.99);
    for (let i = 0; i < DAY_DRAGONS.length; i++) {
      expect(starlightAwake(state)).toBe(false);
      state = hatch(warm(state, 50), () => 0.5)!.state;
    }
    expect(new Set(state.hatched).size).toBe(6);
    expect(starlightAwake(state)).toBe(true);
    expect(state.egg).toMatch(/-starlight$/);
    for (let i = 0; i < 6; i++) state = hatch(warm(state, 50), () => 0.3)!.state;
    expect(state.hatched.length).toBe(DRAGONS.length);
    // With the book complete there are no more eggs: answers help the favourite grow up.
    expect(bookComplete(state)).toBe(true);
    expect(state.raising).toBe(state.favorite);
    const after = warm(state, 50);
    expect(isReady(after)).toBe(false);
    expect(hatch(after, first)).toBeUndefined();
    expect(after.warmth).toBe(0);
    expect(after.growth).toBe(growthNeeded(0));
  });

  it('never picks an egg outside the pool, even at the edge of the random range', () => {
    expect(nextEgg([], () => 0.9999999)).toBe('prism');
    expect(nextEgg([], () => 1)).toBe('prism');
  });

  it('only lets hatched dragons be the favourite', () => {
    const state = hatch(warm(freshHatchery(first), 20), first)!.state;
    expect(chooseFavorite(state, 'prism')).toBe(state);
    expect(chooseFavorite(state, 'ember').favorite).toBe('ember');
  });

  it('preserves every legacy dragon and all progress when restoring and hatching', () => {
    // Explicit historical IDs: deriving this fixture from DRAGONS would hide a rename.
    const hatched = [
      'ember',
      'splash',
      'fern',
      'twinkle',
      'puff',
      'prism',
      'ember-starlight',
      'splash-starlight',
      'fern-starlight',
      'twinkle-starlight',
      'puff-starlight',
      'prism-starlight',
    ];
    for (const favorite of hatched) {
      // A save from before dragons could grow.
      const saved = {
        version: 1,
        egg: 'fern-starlight',
        warmth: 37,
        hatched,
        hatches: 19,
        favorite,
        answers: 1234,
      };
      const restored = parseHatchery(JSON.parse(JSON.stringify(saved)), first);
      // Everything is kept; the complete book starts raising the favourite with the egg's warmth.
      expect(restored).toEqual({ ...saved, stages: {}, raising: favorite, growth: 30 });
      expect(canEvolve(restored)).toBe(true);
      const next = evolve(warm(restored, 13))!.state;
      expect(next.growth).toBe(0);
      expect(next.hatched).toEqual(hatched);
      expect(next.favorite).toBe(favorite);
      expect(next.hatches).toBe(19);
      expect(next.answers).toBe(1247);
      expect(stageOf(next, favorite)).toBe(1);
      expect(parseHatchery(JSON.parse(JSON.stringify(next)), first)).toEqual(next);
    }
  });

  it('keeps an unfinished book on eggs', () => {
    const state = parseHatchery(
      { version: 1, egg: 'puff', warmth: 3, hatched: ['ember'], hatches: 1, favorite: 'ember' },
      first,
    );
    expect(state.raising).toBeNull();
    expect(chooseRaising(state, 'ember')).toBe(state);
    expect(warm(state, 2).warmth).toBe(5);
    expect(warm(state, 2).growth).toBe(0);
  });

  it('recovers damaged or foreign saves safely', () => {
    expect(parseHatchery(null, first).hatched).toEqual([]);
    expect(parseHatchery({ version: 2, hatched: ['ember'] }, first).hatched).toEqual([]);
    const restored = parseHatchery(
      {
        version: 1,
        egg: 'dragonfly',
        warmth: 999,
        hatched: ['fern', 'fern', 'gremlin', 4],
        hatches: -2,
        favorite: 'prism',
        answers: 'lots',
      },
      first,
    );
    expect(restored.hatched).toEqual(['fern']);
    expect(restored.hatches).toBe(1);
    expect(restored.warmth).toBe(30);
    expect(restored.favorite).toBe('fern');
    expect(restored.answers).toBe(0);
    expect(restored.egg).toBe('ember');
  });

  describe('evolving', () => {
    const complete = (): Hatchery =>
      parseHatchery(
        {
          version: 1,
          egg: 'ember',
          warmth: 0,
          hatched: DRAGONS.map((dragon) => dragon.id),
          hatches: 12,
          favorite: 'fern',
          answers: 600,
          growth: 0,
        },
        first,
      );

    it('has three forms, the last one final', () => {
      expect(GRAND).toBe(2);
      expect([0, 1, 2].map(growthNeeded)).toEqual([30, 50, 0]);
    });

    it('evolves the dragon being raised once it has had enough answers', () => {
      let state = complete();
      expect(state.raising).toBe('fern');
      expect(growthTarget(state)).toBe(30);
      state = warm(state, 29);
      expect(canEvolve(state)).toBe(false);
      expect(evolve(state)).toBeUndefined();
      state = warm(state, 5);
      expect(state.growth).toBe(30);
      expect(state.answers).toBe(634);
      const result = evolve(state)!;
      expect(result.dragon.id).toBe('fern');
      expect(result.stage).toBe(1);
      expect(result.state.growth).toBe(0);
      expect(result.state.raising).toBe('fern');
      expect(growthTarget(result.state)).toBe(50);
    });

    it('hands over to the least evolved dragon once one reaches its final form', () => {
      let state = complete();
      for (let stage = 0; stage < GRAND; stage++)
        state = evolve(warm(state, growthNeeded(stage)))!.state;
      expect(stageOf(state, 'fern')).toBe(GRAND);
      expect(state.raising).toBe('ember');
      // A dragon in its final form cannot be picked again; any other can, keeping what fits.
      state = warm(state, 15);
      expect(chooseRaising(state, 'fern')).toBe(state);
      expect(chooseRaising(state, 'prism').raising).toBe('prism');
      expect(chooseRaising(state, 'prism').growth).toBe(15);
    });

    it('lets every dragon reach its final form, then just counts answers', () => {
      let state = complete();
      for (let i = 0; i < DRAGONS.length * GRAND; i++)
        state = evolve(warm(state, growthTarget(state)))!.state;
      expect(DRAGONS.every((dragon) => stageOf(state, dragon.id) === GRAND)).toBe(true);
      expect(state.raising).toBeNull();
      const after = warm(state, 7);
      expect(after.growth).toBe(0);
      expect(after.answers).toBe(state.answers + 7);
      expect(evolve(after)).toBeUndefined();
    });

    it('drops unknown or impossible forms from a damaged save', () => {
      const restored = parseHatchery(
        {
          version: 1,
          egg: 'ember',
          warmth: 0,
          hatched: DRAGONS.map((dragon) => dragon.id),
          hatches: 12,
          favorite: 'ember',
          stages: { ember: 9, fern: -1, gremlin: 2, puff: 'big', splash: 1 },
          raising: 'ember',
          growth: 500,
        },
        first,
      );
      expect(restored.stages).toEqual({ ember: GRAND, splash: 1 });
      // Ember is in its final form already, so the least evolved dragon is raised, up to what it needs.
      expect(restored.raising).toBe('fern');
      expect(restored.growth).toBe(30);
    });
  });
});
