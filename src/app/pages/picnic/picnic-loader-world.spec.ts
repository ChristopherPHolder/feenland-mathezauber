import { describe, expect, it } from 'vite-plus/test';
import { FILL_SECONDS, slicePop } from './picnic-loader-world';

describe('picnic loader motion', () => {
  it('puts the pie together one slice after another', () => {
    const at = FILL_SECONDS * 0.2;
    expect(slicePop(at, 0)).toBe(1);
    expect(slicePop(at, 5)).toBe(0);
    expect(slicePop(FILL_SECONDS * 0.9, 5)).toBe(1);
  });

  it('starts over with an empty blanket', () => {
    expect(slicePop(FILL_SECONDS * 1.01, 0)).toBe(0);
  });
});
