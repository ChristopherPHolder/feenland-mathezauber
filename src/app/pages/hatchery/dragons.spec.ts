import {
  chooseFavorite,
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
    // With the book complete, eggs bring back old friends.
    const again = hatch(warm(state, 50), first)!;
    expect(again.isNew).toBe(false);
    expect(again.state.hatched.length).toBe(DRAGONS.length);
    expect(again.state.hatches).toBe(13);
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
      const saved: Hatchery = {
        version: 1,
        egg: 'fern-starlight',
        warmth: 37,
        hatched,
        hatches: 19,
        favorite,
        answers: 1234,
      };
      const restored = parseHatchery(JSON.parse(JSON.stringify(saved)), first);
      expect(restored).toEqual(saved);
      const next = hatch(warm(restored, 13), first)!.state;
      expect(next.hatched).toEqual(hatched);
      expect(next.favorite).toBe(favorite);
      expect(next.hatches).toBe(20);
      expect(next.answers).toBe(1247);
      expect(parseHatchery(JSON.parse(JSON.stringify(next)), first)).toEqual(next);
    }
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
});
