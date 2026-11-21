import { LUMI } from './horse';
import { RACE_SAVE_KEY, savedLook } from './saved-look';

describe('the saved look for the loading scene', () => {
  const storage = (value: string | null) => ({
    getItem: (key: string) => (key === RACE_SAVE_KEY ? value : null),
  });
  it('reads the horse and keepsake from the race save', () => {
    const save = JSON.stringify({
      version: 2,
      outfit: 'crown',
      horse: { name: 'Mo', kind: 'pegasus', coat: 'sky', mane: 'fire', marking: 'star' },
    });
    expect(savedLook(storage(save))).toEqual({
      horse: {
        name: 'Mo',
        kind: 'pegasus',
        coat: 'sky',
        mane: 'fire',
        marking: 'star',
        horn: 'gold',
      },
      outfit: 'crown',
    });
  });
  it('falls back to Lumi for a missing, broken or blocked save', () => {
    expect(savedLook(storage(null))).toEqual({ horse: LUMI, outfit: null });
    expect(savedLook(storage('{oops'))).toEqual({ horse: LUMI, outfit: null });
    expect(savedLook(undefined)).toEqual({ horse: LUMI, outfit: null });
    expect(
      savedLook({
        getItem: () => {
          throw new Error('blocked');
        },
      }),
    ).toEqual({ horse: LUMI, outfit: null });
  });
});
