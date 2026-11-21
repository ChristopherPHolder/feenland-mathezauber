import { describe, expect, it } from 'vite-plus/test';
import { DROP_SECONDS, dropState, LOOP_SECONDS, loaderTilt } from './scales-loader-world';

describe('scales loader motion', () => {
  it('drops the weights onto the pan one after another', () => {
    expect(dropState(DROP_SECONDS * 0.5)).toEqual({ count: 0, fall: 0.5 });
    expect(dropState(DROP_SECONDS * 1.5).count).toBe(1);
    expect(dropState(DROP_SECONDS * 3.2)).toEqual({ count: 3, fall: 1 });
  });

  it('tips toward the pumpkin until all three weights are on, then sits level', () => {
    expect(loaderTilt(0)).toBeGreaterThan(loaderTilt(2));
    expect(loaderTilt(3)).toBe(0);
  });

  it('starts over with an empty pan', () => {
    expect(dropState(LOOP_SECONDS + 0.01).count).toBe(0);
  });
});
