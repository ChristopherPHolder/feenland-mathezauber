import { TestBed } from '@angular/core/testing';
import { CampaignStore, campaignStars, parseCampaign } from './campaign';
import { createWave, waveSize } from './waves';
import { advance, cast, freshBattle, resolveSpell, revealHint } from './battle';

describe('twenty-wave number magic', () => {
  it('offers exactly 20 solvable waves, four bosses, all number pairs, and staged help', () => {
    const pairs = new Set<number>();
    const bosses: number[] = [];
    for (let number = 1; number <= 20; number++) {
      const wave = createWave(number);
      if (wave.boss) bosses.push(number);
      for (const encounter of wave.encounters) {
        expect(wave.spells).toContain(10 - encounter.energy);
        expect(encounter.energy).toBeGreaterThanOrEqual(0);
        expect(encounter.energy).toBeLessThanOrEqual(10);
        pairs.add(encounter.energy);
      }
      expect(wave.spells).toEqual(
        number < 11 ? [1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      );
      expect(wave.assistance).toBe(
        number <= 4 ? 'guided' : number <= 12 ? 'assisted' : 'independent',
      );
      let state = freshBattle(number);
      for (let index = 0; index < waveSize(number); index++) {
        const correct = 10 - state.wave.encounters[state.encounter].energy;
        state = advance(resolveSpell(cast(state, correct)));
      }
      expect(state.phase).toBe('complete');
      expect(state.hearts).toBe(3);
    }
    expect(bosses).toEqual([5, 10, 15, 20]);
    expect(pairs.size).toBe(11);
    expect(() => createWave(21)).toThrow();
    expect(() => createWave(0)).toThrow();
    expect(createWave(1, () => 0).encounters.map((e) => e.energy)).toEqual([9, 8]);
    expect(createWave(2, () => 0).encounters.map((e) => e.energy)).not.toEqual(
      createWave(2, () => 0.99).encounters.map((e) => e.energy),
    );
  });
  it('keeps broken boss layers and helpful dots after damage; retry resets the boss', () => {
    let state = freshBattle(5);
    state = advance(resolveSpell(cast(state, 10 - state.wave.encounters[0].energy)));
    const energy = state.wave.encounters[1].energy;
    for (let index = 0; index < 3; index++)
      state = advance(resolveSpell(cast(state, energy === 9 ? 2 : 1)));
    expect(state.encounter).toBe(1);
    expect(state.hearts).toBe(2);
    expect(state.hintVisible).toBe(true);
    expect(state.independent).toHaveLength(1);
    for (let index = 0; index < 6; index++)
      state = advance(resolveSpell(cast(state, energy === 9 ? 2 : 1)));
    expect(state.phase).toBe('lost');
    const retry = freshBattle(5);
    expect(retry.encounter).toBe(0);
    expect(retry.independent).toEqual([]);
    expect(retry.hearts).toBe(3);
  });
  it('tracks independent first tries, requested help, mistakes and zero spells', () => {
    let state = freshBattle(11);
    expect(state.hintVisible).toBe(false);
    state = revealHint(state);
    expect(state.helpUsed).toBe(true);
    state = advance(resolveSpell(cast(state, 10 - state.wave.encounters[0].energy)));
    expect(state.independent).toEqual([false]);
    expect(state.hintVisible).toBe(false);
    const correct = 10 - state.wave.encounters[1].energy;
    state = advance(resolveSpell(cast(state, correct)));
    expect(state.independent).toEqual([false, true]);
    for (const spell of [NaN, 1.5, -1, 11]) expect(cast(state, spell)).toBe(state);
    const ten = {
      ...freshBattle(11),
      wave: { ...createWave(11), encounters: [{ energy: 10, appearance: 'monster-red' }] },
    };
    expect(resolveSpell(cast(ten, 0)).phase).toBe('transforming');
  });
});
describe('saved campaign', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });
  afterEach(() => TestBed.resetTestingModule());
  it('unlocks only sequential waves and restores completed boundaries', () => {
    const store = TestBed.inject(CampaignStore);
    store.complete({ wave: 2, independent: 2 });
    expect(store.unlocked()).toBe(1);
    store.complete({ wave: 1, independent: 0 });
    expect(store.unlocked()).toBe(2);
    const saved = localStorage.getItem('feenland.castle-campaign.v1');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    expect(TestBed.inject(CampaignStore).unlocked()).toBe(2);
    expect(saved).not.toBeNull();
  });
  it('rejects corrupt, future, gapped and invalid results without losing valid prefixes', () => {
    for (const value of [
      null,
      {},
      { version: 2, results: [] },
      { version: 1, results: [{ wave: 2, independent: 0 }] },
    ])
      expect(parseCampaign(value).results).toEqual([]);
    expect(
      parseCampaign({
        version: 1,
        results: [
          { wave: 1, independent: 0 },
          { wave: 2, independent: 99 },
        ],
      }).results,
    ).toHaveLength(1);
  });
  it('awards stars only after all 20 and keeps best results when replayed', () => {
    const store = TestBed.inject(CampaignStore);
    for (let wave = 1; wave <= 19; wave++) store.complete({ wave, independent: waveSize(wave) });
    expect(store.stars()).toBe(0);
    store.complete({ wave: 20, independent: 5 });
    expect(store.stars()).toBe(3);
    store.complete({ wave: 5, independent: 0 });
    expect(store.stars()).toBe(3);
    const fail = {
      version: 1 as const,
      results: store.state().results.map((r) => ({ ...r, independent: 0 })),
    };
    expect(campaignStars(fail)).toBe(1);
    expect(
      campaignStars({
        ...fail,
        results: fail.results.map((r) => ({
          ...r,
          independent: Math.ceil(waveSize(r.wave) * 0.75),
        })),
      }),
    ).toBe(2);
  });
  it('continues in memory when storage fails', () => {
    const store = TestBed.inject(CampaignStore);
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('Storage unavailable');
    };
    try {
      store.complete({ wave: 1, independent: 0 });
      expect(store.unlocked()).toBe(2);
      expect(store.saveFailed()).toBe(true);
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});
