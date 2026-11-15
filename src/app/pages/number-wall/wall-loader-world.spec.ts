import { dropHeight, dropStart, LOOP, popScale, wallFraming } from './wall-loader-world';

describe('wall loader timing', () => {
  it('has the first brick falling as the scene appears and resting soon after', () => {
    expect(dropStart(0)).toBeLessThan(0);
    expect(dropHeight(0, 0)).toBeGreaterThan(0);
    expect(dropHeight(0, 0.3)).toBe(0);
  });

  it('drops the bricks in order, bottom row first, each from above its place', () => {
    for (let i = 1; i < 6; i++) {
      expect(dropStart(i)).toBeGreaterThan(dropStart(i - 1));
      expect(dropHeight(i, dropStart(i))).toBe(1);
    }
  });

  it('stands the whole wall before it clears, and clears it before the next build', () => {
    const standing = dropStart(5) + 0.6;
    for (let i = 0; i < 6; i++) {
      expect(dropHeight(i, standing)).toBe(0);
      expect(popScale(i, standing)).toBe(1);
      expect(popScale(i, LOOP + dropStart(0))).toBe(0);
    }
  });
});

describe('wall loader framing', () => {
  const tan = Math.tan((19 * Math.PI) / 180);
  /** Screen row of a world height on the wall's plane, ignoring the gentle tilt. */
  const row = (y: number, width: number, height: number) => {
    const { distance, lookY } = wallFraming(width, height);
    return height / 2 - ((y - lookY) * height) / (2 * distance * tan);
  };

  for (const [width, height] of [
    [390, 844],
    [820, 1180],
    [1180, 820],
  ]) {
    it(`keeps the wall above the loading pill and on screen at ${width}x${height}`, () => {
      expect(row(-0.3, width, height)).toBeLessThanOrEqual(height / 2 + 56.5);
      expect(row(4.3, width, height)).toBeGreaterThanOrEqual(height * 0.08 - 0.5);
    });
  }
});
