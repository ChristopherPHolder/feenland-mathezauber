import { Group, Vector3 } from 'three';
import { describe, expect, it } from 'vite-plus/test';
import { HairChain } from './race-hair';

/** A tail on a pony facing -z: five lengths hanging from the dock. */
function tail() {
  const body = new Group();
  const rest = Array.from({ length: 5 }, () => new Vector3(0, -1, 0.3));
  const chain = new HairChain(body, new Vector3(0, 1.4, 0.8), rest, {
    length: 0.15,
    stiffness: [120, 40, 12, 6, 4],
    drag: 2,
  });
  body.updateMatrixWorld(true);
  return { body, chain };
}

/** Runs the pony at `speed` metres a second toward -z for `seconds`. */
function gallop(body: Group, chain: HairChain, speed: number, seconds: number, dt = 1 / 60) {
  for (let time = 0; time < seconds; time += dt) {
    body.position.z -= speed * dt;
    body.updateMatrixWorld(true);
    chain.step(dt);
  }
}

/** How far the tip trails behind the dock, in metres along +z. */
function trailing(chain: HairChain) {
  return chain.point(chain.segments).z - chain.point(0).z;
}

describe('HairChain', () => {
  it('droops under gravity when the pony stands still', () => {
    const { body, chain } = tail();
    gallop(body, chain, 0, 2);
    const tip = chain.point(chain.segments);
    expect(tip.y).toBeLessThan(chain.point(0).y - 0.6);
    // Hair keeps its length.
    expect(chain.point(1).distanceTo(chain.point(0))).toBeCloseTo(0.15, 3);
  });

  it('streams further back the faster the pony runs', () => {
    const walk = tail();
    gallop(walk.body, walk.chain, 1.5, 3);
    const run = tail();
    gallop(run.body, run.chain, 6.5, 3);
    expect(trailing(run.chain)).toBeGreaterThan(trailing(walk.chain) + 0.15);
  });

  it('whips back when the pony bursts forward and flops forward when it stops dead', () => {
    const { body, chain } = tail();
    gallop(body, chain, 3, 2);
    const cruising = trailing(chain);
    gallop(body, chain, 8, 0.15);
    expect(trailing(chain)).toBeGreaterThan(cruising);
    gallop(body, chain, 3, 2);
    gallop(body, chain, 0, 0.2);
    expect(trailing(chain)).toBeLessThan(cruising);
  });

  it('stays in one piece through long, juddery frames', () => {
    const { body, chain } = tail();
    gallop(body, chain, 6, 3, 0.1);
    for (let index = 1; index <= chain.segments; index++) {
      const point = chain.point(index);
      expect(Number.isFinite(point.x + point.y + point.z)).toBe(true);
      expect(point.distanceTo(chain.point(index - 1))).toBeCloseTo(0.15, 3);
    }
  });

  it('drops back into shape instead of swinging when the pony is moved somewhere new', () => {
    const { body, chain } = tail();
    gallop(body, chain, 0, 1);
    body.position.set(0, 0, -40);
    body.updateMatrixWorld(true);
    chain.step(1 / 60);
    expect(chain.point(chain.segments).z - body.position.z).toBeGreaterThan(0.8);
    expect(chain.point(chain.segments).z - body.position.z).toBeLessThan(1.5);
  });
});
