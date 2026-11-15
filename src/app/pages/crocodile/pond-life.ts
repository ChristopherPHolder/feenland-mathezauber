import {
  CapsuleGeometry,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from 'three';

const INK = '#172555';
const toon = (color: string, extra: Partial<MeshStandardMaterial> = {}) =>
  new MeshStandardMaterial({ color, roughness: 0.62, metalness: 0, ...extra });

function part(
  geometry: Mesh['geometry'],
  material: Mesh['material'],
  [x, y, z]: readonly [number, number, number] = [0, 0, 0],
  [sx, sy, sz]: readonly [number, number, number] = [1, 1, 1],
): Mesh {
  const result = new Mesh(geometry, material);
  result.position.set(x, y, z);
  result.scale.set(sx, sy, sz);
  result.castShadow = true;
  return result;
}

/** A round lily pad of radius 1 with the little notch cut out, lying flat on the water. */
export function makeLilyPad(color = '#4ca25f', rim = '#2f7a44'): Group {
  const pad = new Group();
  const top = new Mesh(
    new CylinderGeometry(1, 1, 0.06, 28, 1, false, 0.35, Math.PI * 2 - 0.7),
    toon(color),
  );
  top.receiveShadow = true;
  const edge = new Mesh(
    new CylinderGeometry(1.02, 0.98, 0.05, 28, 1, false, 0.35, Math.PI * 2 - 0.7),
    toon(rim),
  );
  edge.position.y = -0.03;
  pad.add(edge, top);
  return pad;
}

/**
 * The golden snack's pad: polished gold that catches the sun, with a warm glow of its own and a
 * brighter rim, so it reads as treasure even from across the pond. Same size as a lily pad.
 */
export function makeGoldenPad(): Group {
  const pad = new Group();
  const top = new Mesh(
    new CylinderGeometry(1, 1, 0.07, 32, 1, false, 0.35, Math.PI * 2 - 0.7),
    toon('#ffc93c', {
      metalness: 0.45,
      roughness: 0.3,
      emissive: new Color('#b8740a'),
      emissiveIntensity: 0.55,
    }),
  );
  top.receiveShadow = true;
  const edge = new Mesh(
    new CylinderGeometry(1.05, 1, 0.06, 32, 1, false, 0.35, Math.PI * 2 - 0.7),
    toon('#e29a12', {
      metalness: 0.5,
      roughness: 0.35,
      emissive: new Color('#7a4a00'),
      emissiveIntensity: 0.4,
    }),
  );
  edge.position.y = -0.03;
  pad.add(edge, top);
  return pad;
}

/** A clump of reeds with a cattail or two, about 1.6 units tall. */
export function makeReeds(seed: number): Group {
  const clump = new Group();
  const leaf = toon('#3a8f55');
  const light = toon('#5fbf6f');
  const cattail = toon('#9a6a3c');
  const stem = new ConeGeometry(0.045, 1, 5);
  const head = new CapsuleGeometry(0.05, 0.18, 3, 8);
  for (let i = 0; i < 6; i++) {
    const angle = seed * 1.7 + i * 2.1;
    const height = 0.9 + ((seed * 13 + i * 7) % 7) / 10;
    const blade = part(
      stem,
      i % 2 ? leaf : light,
      [Math.sin(angle) * 0.16, height / 2, Math.cos(angle) * 0.12],
      [1, height, 1],
    );
    blade.rotation.z = Math.sin(angle) * 0.18;
    blade.rotation.x = Math.cos(angle) * 0.12;
    clump.add(blade);
    if (i % 3 === 0) {
      const tail = part(head, cattail, [
        blade.position.x * 1.6,
        height * 0.92,
        blade.position.z * 1.4,
      ]);
      tail.rotation.copy(blade.rotation);
      clump.add(tail);
    }
  }
  return clump;
}

/** A small round frog that sits on a lily pad and hops now and then. */
export class Frog {
  readonly root = new Group();
  private readonly body = new Group();
  private hopAt = 3;

  constructor() {
    const sphere = new SphereGeometry(1, 14, 10);
    const green = toon('#7cc85a');
    const white = toon('#ffffff', { roughness: 0.3 });
    const ink = toon(INK);
    this.body.add(part(sphere, green, [0, 0.16, 0], [0.24, 0.18, 0.22]));
    this.body.add(part(sphere, toon('#d9f2b4'), [0, 0.13, 0.08], [0.18, 0.12, 0.16]));
    for (const side of [-1, 1]) {
      this.body.add(part(sphere, green, [side * 0.12, 0.3, 0.06], [0.08, 0.08, 0.08]));
      this.body.add(part(sphere, white, [side * 0.12, 0.32, 0.1], [0.055, 0.055, 0.04]));
      this.body.add(part(sphere, ink, [side * 0.12, 0.32, 0.135], [0.028, 0.03, 0.02]));
      this.body.add(part(sphere, green, [side * 0.2, 0.05, 0.1], [0.08, 0.04, 0.12]));
    }
    this.root.add(this.body);
  }

  animate(t: number, calm: boolean) {
    if (calm) {
      this.body.position.y = 0;
      this.body.scale.set(1, 1, 1);
      return;
    }
    const age = t - this.hopAt;
    if (age > 0.9) this.hopAt = t + 4 + ((t * 3.7) % 3);
    const hop = age >= 0 && age <= 0.9 ? age / 0.9 : -1;
    // Crouch, leap, land: a little squash and stretch.
    this.body.position.y = hop < 0 ? 0 : Math.sin(Math.min(1, hop * 1.2) * Math.PI) * 0.45;
    const squash = hop < 0 ? 1 : hop < 0.15 ? 1 - hop * 1.6 : 1 + Math.sin(hop * Math.PI) * 0.15;
    this.body.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
    this.body.rotation.y = hop < 0 ? this.body.rotation.y : this.body.rotation.y + 0.02;
  }
}

/** A butterfly with two flapping wings; the world flies it around the pond. */
export class Butterfly {
  readonly root = new Group();
  private readonly wings: Mesh[] = [];

  constructor(color: string) {
    const shape = new Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(0.25, 0.3, 0.5, 0.15, 0.42, -0.02);
    shape.bezierCurveTo(0.45, -0.2, 0.2, -0.3, 0, -0.05);
    const geometry = new ShapeGeometry(shape, 8);
    const material = toon(color, { side: DoubleSide });
    for (const side of [-1, 1]) {
      const wing = new Mesh(geometry, material);
      wing.rotation.x = -Math.PI / 2;
      wing.scale.set(side, 1, 1);
      const hinge = new Group();
      hinge.add(wing);
      this.root.add(hinge);
      this.wings.push(wing);
    }
    this.root.add(
      part(new CapsuleGeometry(0.025, 0.16, 3, 6), toon(INK), [0, 0, 0], [1, 1, 1]).rotateX(
        Math.PI / 2,
      ),
    );
  }

  animate(t: number, calm: boolean) {
    const flap = calm ? 0.5 : Math.sin(t * 18) * 0.9;
    this.wings.forEach((wing, index) => (wing.parent!.rotation.z = (index ? -1 : 1) * flap));
  }
}

/** A little fish shape (orange by default) for swimming under the water. */
export function makeFish(color = '#f08a24', size = 1): Group {
  const fish = new Group();
  const skin = toon(color);
  fish.add(
    part(new SphereGeometry(1, 14, 10), skin, [0, 0, 0], [0.09 * size, 0.07 * size, 0.18 * size]),
  );
  const tail = part(new ConeGeometry(0.08 * size, 0.14 * size, 4), skin, [0, 0, -0.2 * size]);
  tail.rotation.x = -Math.PI / 2;
  tail.scale.set(0.3, 1, 1);
  fish.add(tail);
  return fish;
}

/** The big fish: the round's last and biggest snack, who leaps across the pond. */
export function makeBigFish(): Group {
  const fish = new Group();
  const blue = toon('#2b78c7', { roughness: 0.4 });
  const fin = toon('#1f5fa8');
  const sphere = new SphereGeometry(1, 18, 12);
  fish.add(part(sphere, blue, [0, 0, 0], [0.32, 0.4, 0.75]));
  fish.add(part(sphere, toon('#cfe6ff'), [0, -0.12, 0.08], [0.26, 0.26, 0.6]));
  const tail = part(new ConeGeometry(0.4, 0.5, 4), fin, [0, 0, -0.85]);
  tail.rotation.x = -Math.PI / 2;
  tail.scale.set(0.25, 1, 1.2);
  fish.add(tail);
  const dorsal = part(new ConeGeometry(0.22, 0.36, 4), fin, [0, 0.42, -0.05]);
  dorsal.scale.set(0.2, 1, 1.4);
  fish.add(dorsal);
  for (const side of [-1, 1]) {
    fish.add(
      part(
        sphere,
        toon('#ffffff', { roughness: 0.3 }),
        [side * 0.22, 0.12, 0.45],
        [0.09, 0.09, 0.09],
      ),
    );
    fish.add(part(sphere, toon(INK), [side * 0.28, 0.13, 0.48], [0.045, 0.05, 0.05]));
  }
  return fish;
}

/** The greedy heron, about 2 units from wing tip to wing tip, looking along +z. */
export class HeronModel {
  readonly root = new Group();
  /** Where its beak tip is, in the heron's own space: snatched tiles hang from here. */
  readonly beak = new Vector3(0, 0.5, 1.32);
  private readonly wings: Group[] = [];

  constructor() {
    const grey = toon('#8fa8c4');
    const dark = toon('#6f8bb0');
    const sphere = new SphereGeometry(1, 16, 12);
    this.root.add(part(sphere, grey, [0, 0, 0], [0.26, 0.24, 0.55]));
    const neck = new CatmullRomCurve3([
      new Vector3(0, 0.1, 0.4),
      new Vector3(0, 0.38, 0.5),
      new Vector3(0, 0.5, 0.78),
    ]);
    this.root.add(part(new TubeGeometry(neck, 12, 0.07, 6), grey));
    this.root.add(part(sphere, grey, [0, 0.52, 0.86], [0.13, 0.12, 0.15]));
    const beak = part(new ConeGeometry(0.05, 0.42, 6), toon('#f4b740'), [0, 0.5, 1.12]);
    beak.rotation.x = Math.PI / 2;
    this.root.add(beak);
    for (const side of [-1, 1])
      this.root.add(part(sphere, toon(INK), [side * 0.1, 0.56, 0.92], [0.03, 0.03, 0.03]));
    const crest = part(new ConeGeometry(0.03, 0.3, 4), dark, [0, 0.62, 0.7]);
    crest.rotation.x = -1.1;
    this.root.add(crest);
    const tail = part(new ConeGeometry(0.14, 0.4, 4), dark, [0, 0, -0.65]);
    tail.rotation.x = -Math.PI / 2;
    tail.scale.set(1, 1, 0.3);
    this.root.add(tail);
    const leg = new CylinderGeometry(0.02, 0.02, 0.7, 4);
    for (const side of [-1, 1]) {
      const shin = part(leg, toon('#d99a2b'), [side * 0.08, -0.12, -0.8]);
      shin.rotation.x = Math.PI / 2.3;
      this.root.add(shin);
    }
    const wingShape = new Shape();
    wingShape.moveTo(0, 0.3);
    wingShape.quadraticCurveTo(0.6, 0.45, 1.15, 0.05);
    wingShape.quadraticCurveTo(0.7, -0.05, 0.6, -0.3);
    wingShape.quadraticCurveTo(0.3, -0.15, 0, -0.3);
    const wingGeometry = new ShapeGeometry(wingShape, 10);
    const wingMaterial = toon('#6f8bb0', { side: DoubleSide });
    for (const side of [-1, 1]) {
      const hinge = new Group();
      hinge.position.set(side * 0.18, 0.1, 0.05);
      const wing = new Mesh(wingGeometry, wingMaterial);
      wing.castShadow = true;
      wing.rotation.x = -Math.PI / 2;
      wing.scale.set(side, 1, 1);
      hinge.add(wing);
      this.root.add(hinge);
      this.wings.push(hinge);
    }
  }

  /** `beat` from 0 (wings held out to glide) up to 1 (hard flapping). */
  animate(t: number, beat: number) {
    const angle = Math.sin(t * (6 + beat * 8)) * (0.15 + beat * 0.65);
    this.wings.forEach((hinge, index) => (hinge.rotation.z = (index ? -1 : 1) * angle));
  }
}
