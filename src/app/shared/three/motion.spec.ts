import {
  BurstPool,
  EventCounter,
  FollowChain,
  Spring,
  Spring3,
  anticipate,
  bounce,
  easeOutBack,
  impactSquash,
  smooth,
  speedStretch,
  squashStretch,
} from './motion';

/** Runs a spring for `seconds` in frames of `dt`. */
function run(spring: Spring, seconds: number, dt = 1 / 60) {
  for (let t = 0; t < seconds; t += dt) spring.step(dt);
  return spring.value;
}

describe('3D motion helpers', () => {
  it('eases from 0 to 1', () => {
    for (const ease of [smooth, bounce, easeOutBack, anticipate]) {
      expect(ease(0)).toBeCloseTo(0);
      expect(ease(1)).toBeCloseTo(1);
    }
  });

  it('crouches the other way before an anticipated move', () => {
    expect(anticipate(0.2)).toBeLessThan(0);
    expect(anticipate(0.6)).toBeGreaterThan(0);
  });

  it('counts only new events and syncs on the first value', () => {
    const counter = new EventCounter();
    expect(counter.take(5)).toBe(0);
    expect(counter.take(5)).toBe(0);
    expect(counter.take(7)).toBe(2);
    expect(counter.take(0)).toBe(0);
  });
});

describe('Spring', () => {
  it('settles on its target', () => {
    for (const damping of [0.2, 0.5, 1, 2.5]) {
      const spring = new Spring(0, { frequency: 3, damping });
      spring.target = 4;
      expect(run(spring, 6)).toBeCloseTo(4, 3);
      expect(spring.settled).toBe(true);
    }
  });

  it('overshoots when bouncy and never when critically damped', () => {
    const bouncy = new Spring(0, { frequency: 3, damping: 0.3 });
    const firm = new Spring(0, { frequency: 3, damping: 1 });
    let bouncyPeak = 0;
    let firmPeak = 0;
    for (let i = 0; i < 120; i++) {
      bouncyPeak = Math.max(bouncyPeak, bouncy.step(1 / 60, 1));
      firmPeak = Math.max(firmPeak, firm.step(1 / 60, 1));
    }
    expect(bouncyPeak).toBeGreaterThan(1.2);
    expect(firmPeak).toBeLessThanOrEqual(1 + 1e-9);
  });

  it('ends up in the same place whatever the frame rate', () => {
    const smoothFrames = new Spring(0, { frequency: 2, damping: 0.4 });
    const choppy = new Spring(0, { frequency: 2, damping: 0.4 });
    smoothFrames.target = choppy.target = 1;
    run(smoothFrames, 0.5, 1 / 120);
    run(choppy, 0.5, 0.1);
    expect(choppy.value).toBeCloseTo(smoothFrames.value, 6);
    expect(choppy.velocity).toBeCloseTo(smoothFrames.velocity, 6);
  });

  it('stays stable through a long frame hitch', () => {
    const spring = new Spring(0, { frequency: 8, damping: 0.1 });
    spring.step(2, 1);
    expect(Number.isFinite(spring.value)).toBe(true);
    expect(Math.abs(spring.value - 1)).toBeLessThan(1);
  });

  it('wobbles after a kick and comes back', () => {
    const spring = new Spring(0);
    spring.kick(5);
    spring.step(0.05);
    expect(spring.value).toBeGreaterThan(0);
    expect(run(spring, 6)).toBeCloseTo(0, 3);
  });

  it('snaps without moving', () => {
    const spring = new Spring(0);
    spring.kick(3);
    spring.snap(2);
    expect(spring.step(1 / 60)).toBe(2);
    expect(spring.settled).toBe(true);
  });
});

describe('Spring3', () => {
  it('moves each axis like a Spring and writes into a target object', () => {
    const vector = new Spring3({ x: 0, y: 0, z: 0 }, { frequency: 2, damping: 0.6 });
    const single = new Spring(0, { frequency: 2, damping: 0.6 });
    vector.aim(1, -2, 3);
    const out = { x: 0, y: 0, z: 0 };
    for (let i = 0; i < 20; i++) {
      vector.step(1 / 60, out);
      single.step(1 / 60, 1);
    }
    expect(out.x).toBeCloseTo(single.value, 9);
    expect(out.y).toBeCloseTo(-2 * single.value, 9);
    expect(out.z).toBeCloseTo(3 * single.value, 9);
  });

  it('snaps and kicks', () => {
    const vector = new Spring3();
    vector.snap(1, 2, 3);
    vector.kick(0, 4, 0);
    vector.step(0.05);
    expect(vector.value.x).toBeCloseTo(1);
    expect(vector.value.y).toBeGreaterThan(2);
  });
});

describe('FollowChain', () => {
  it('lets the tip lag behind a turn and then straightens', () => {
    const tail = new FollowChain(4, { frequency: 3, damping: 0.5 });
    tail.snap(0);
    const angles = tail.step(1 / 60, 1);
    // The first link has barely turned, so it bends back against the root.
    expect(angles[0]).toBeLessThan(0);
    for (let i = 0; i < 600; i++) tail.step(1 / 60, 1);
    for (const angle of tail.angles) expect(angle).toBeCloseTo(0, 3);
  });

  it('sweeps the motion down the chain, the tip moving last', () => {
    const tail = new FollowChain(3, { frequency: 3, damping: 0.6 });
    tail.snap(0);
    for (let i = 0; i < 6; i++) tail.step(1 / 60, 1);
    // Absolute angles: each link has turned less than the one before it.
    const a = tail.angles;
    const link0 = 1 + a[0]!;
    const link1 = link0 + a[1]!;
    const link2 = link1 + a[2]!;
    expect(link0).toBeGreaterThan(link1);
    expect(link1).toBeGreaterThan(link2);
  });
});

describe('squash and stretch', () => {
  it('keeps the volume', () => {
    for (const stretch of [0.6, 1, 1.4]) {
      const s = squashStretch(stretch);
      expect(s.x * s.y * s.z).toBeCloseTo(1);
      expect(s.y).toBeCloseTo(stretch);
    }
    expect(squashStretch(1.5, { x: 0, y: 0, z: 0 }, 'x').x).toBeCloseTo(1.5);
  });

  it('squashes on impact and is back at rest afterwards', () => {
    expect(impactSquash(1, 1, 0.3)).toBeCloseTo(0.7);
    expect(impactSquash(0.5, 1)).toBe(1);
    expect(impactSquash(2, 1, 0.3, 0.5)).toBe(1);
    expect(Math.abs(impactSquash(1.49, 1, 0.3, 0.5) - 1)).toBeLessThan(0.01);
  });

  it('stretches with speed up to a limit', () => {
    expect(speedStretch(0)).toBe(1);
    expect(speedStretch(-5)).toBeCloseTo(1.2);
    expect(speedStretch(100)).toBeCloseTo(1.3);
  });
});

describe('BurstPool', () => {
  it('flies particles out, pulls them down and lets them die', () => {
    const pool = new BurstPool(8);
    pool.emit(4, 0, 1, 0, { speed: 2, life: 1, spread: 0.5, random: () => 0.5 });
    expect(pool.live).toBe(4);
    pool.step(0.1);
    expect(pool.position[1]).toBeGreaterThan(1);
    expect(pool.remaining(0)).toBeLessThan(1);
    for (let i = 0; i < 40; i++) pool.step(0.05);
    expect(pool.live).toBe(0);
    expect(pool.remaining(0)).toBe(0);
  });

  it('reuses the oldest slots when full and never grows', () => {
    const pool = new BurstPool(5);
    expect(pool.emit(3, 0, 0, 0)).toBe(0);
    expect(pool.emit(3, 0, 0, 0)).toBe(3);
    expect(pool.live).toBe(5);
    expect(pool.position).toHaveLength(15);
    pool.clear();
    expect(pool.live).toBe(0);
  });

  it('keeps a fountain going upwards', () => {
    const pool = new BurstPool(50);
    let seed = 1;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    pool.emit(50, 0, 0, 0, { spread: 0.5, random });
    for (let i = 0; i < 50; i++) expect(pool.velocity[i * 3 + 1]).toBeGreaterThanOrEqual(0);
  });
});
