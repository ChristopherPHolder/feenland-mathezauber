import { ParticleBurst } from './particles';

describe('ParticleBurst', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });
  afterEach(() => vi.restoreAllMocks());

  it('shows while particles fly, fades them and hides when they are gone', () => {
    const burst = new ParticleBurst({ capacity: 10 });
    expect(burst.visible).toBe(false);
    burst.burst({ x: 0, y: 1, z: 0 }, '#ff0000', 4, { life: 0.5 });
    expect(burst.visible).toBe(true);
    burst.update(0.1);
    const color = burst.geometry.getAttribute('color');
    expect(color.getX(0)).toBeCloseTo(1);
    expect(color.getY(0)).toBeCloseTo(0);
    expect(color.getW(0)).toBeGreaterThan(0);
    expect(color.getW(5)).toBe(0);
    for (let i = 0; i < 20; i++) burst.update(0.1);
    expect(burst.visible).toBe(false);
    burst.dispose();
  });

  it('draws every burst in one buffer without growing it', () => {
    const burst = new ParticleBurst({ capacity: 6 });
    burst.burst({ x: 0, y: 0, z: 0 }, 'white', 4);
    burst.burst({ x: 1, y: 0, z: 0 }, 'white', 4);
    expect(burst.pool.live).toBe(6);
    expect(burst.geometry.getAttribute('position').count).toBe(6);
    burst.stop();
    expect(burst.visible).toBe(false);
  });
});
