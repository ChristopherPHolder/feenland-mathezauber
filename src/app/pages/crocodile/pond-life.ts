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
  type Texture,
} from 'three';
import { smooth } from '../../shared/three/motion';

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

/**
 * A round lily pad of radius 1 with the little notch cut out, lying flat on the water. `veins`
 * (see `padVeins`) draws the leaf's veins on top.
 */
export function makeLilyPad(color = '#4ca25f', rim = '#2f7a44', veins?: Texture): Group {
  const pad = new Group();
  const top = new Mesh(
    new CylinderGeometry(1, 1, 0.06, 28, 1, false, 0.35, Math.PI * 2 - 0.7),
    toon(color, veins ? { map: veins } : {}),
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

/**
 * A small round frog that sits on a lily pad. Between hops it puffs its throat out to croak; a
 * hop crouches first, leaps on an arc with its legs stretched out and lands with a squash.
 */
export class Frog {
  readonly root = new Group();
  private readonly body = new Group();
  private readonly throat: Mesh;
  private readonly legs: Mesh[] = [];
  private hopAt = 3;
  private croakAt = 1.5;
  private turn = 0;
  private hopping = false;

  constructor() {
    const sphere = new SphereGeometry(1, 14, 10);
    const green = toon('#7cc85a');
    const white = toon('#ffffff', { roughness: 0.3 });
    const ink = toon(INK);
    const belly = toon('#d9f2b4');
    this.body.add(part(sphere, green, [0, 0.16, 0], [0.24, 0.18, 0.22]));
    this.body.add(part(sphere, belly, [0, 0.13, 0.08], [0.18, 0.12, 0.16]));
    for (const side of [-1, 1]) {
      this.body.add(part(sphere, green, [side * 0.12, 0.3, 0.06], [0.08, 0.08, 0.08]));
      this.body.add(part(sphere, white, [side * 0.12, 0.32, 0.1], [0.055, 0.055, 0.04]));
      this.body.add(part(sphere, ink, [side * 0.12, 0.32, 0.135], [0.028, 0.03, 0.02]));
      // Folded back legs at the sides, which stretch out behind it in a leap.
      const leg = part(sphere, green, [side * 0.2, 0.05, -0.02], [0.08, 0.05, 0.14]);
      this.legs.push(leg);
      this.body.add(leg);
      this.body.add(part(sphere, green, [side * 0.1, 0.03, 0.16], [0.045, 0.03, 0.06]));
    }
    this.throat = part(sphere, toon('#f3ffd9'), [0, 0.09, 0.17], [0.09, 0.07, 0.06]);
    this.body.add(this.throat);
    this.root.add(this.body);
  }

  /** Moves the frog on; returns true on the frame it lands back on its pad. */
  animate(t: number, calm: boolean): boolean {
    if (calm) {
      this.body.position.y = 0;
      this.body.scale.set(1, 1, 1);
      this.body.rotation.x = 0;
      this.throat.scale.set(0.09, 0.07, 0.06);
      return false;
    }
    const age = t - this.hopAt;
    let landed = false;
    if (age > 0.9) {
      this.hopAt = t + 4 + ((t * 3.7) % 3);
      this.turn += (t * 1.3) % 1 > 0.5 ? 0.9 : -0.9;
    }
    const hop = age >= 0 && age <= 0.9 ? age / 0.9 : -1;
    if (hop >= 0.15 + 0.6) {
      if (this.hopping) landed = true;
      this.hopping = false;
    } else if (hop >= 0.15) this.hopping = true;
    // Crouch (0 to 0.15), leap (to 0.75), land and settle.
    const air = hop < 0.15 ? 0 : Math.min(1, (hop - 0.15) / 0.6);
    this.body.position.y = hop < 0 ? 0 : Math.sin(air * Math.PI) * 0.45;
    const squash =
      hop < 0
        ? 1
        : hop < 0.15
          ? 1 - smooth(hop / 0.15) * 0.25
          : hop < 0.75
            ? 1 + Math.sin(air * Math.PI) * 0.18
            : 1 - Math.sin(((hop - 0.75) / 0.25) * Math.PI) * 0.2;
    this.body.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
    // Nose up on the way up, down on the way down; it turns a little each hop.
    this.body.rotation.x = hop < 0.15 || hop > 0.75 ? 0 : -Math.cos(air * Math.PI) * 0.35;
    this.body.rotation.y += (this.turn - this.body.rotation.y) * (air > 0 ? 0.15 : 0);
    for (const leg of this.legs) {
      leg.scale.z = 0.14 * (1 + Math.sin(air * Math.PI) * 0.9);
      leg.position.z = -0.02 - Math.sin(air * Math.PI) * 0.12;
    }
    // A croak: the throat swells twice, then rests.
    const croak = t - this.croakAt;
    if (croak > 1.2) this.croakAt = t + 2.5 + ((t * 5.3) % 2.5);
    const swell =
      hop < 0 && croak >= 0 && croak <= 1.2
        ? Math.max(0, Math.sin((croak / 1.2) * Math.PI * 2)) ** 0.7
        : 0;
    const size = 1 + swell * 1.3;
    this.throat.scale.set(0.09 * size, 0.07 * size, 0.06 * (1 + swell * 0.8));
    return landed;
  }
}

/**
 * A dragonfly: long slim tail, big round eyes and four clear wings that buzz. It hovers in one
 * spot, then darts to the next on a quick eased arc, the way real ones do.
 */
export class Dragonfly {
  readonly root = new Group();
  private readonly wings: Group[] = [];
  private spots: readonly Vector3[] = [];
  private from = 0;
  private to = 0;
  private leaveAt = 1.5;
  private darts = 0;
  private readonly arc = 0.5;

  constructor() {
    const body = toon('#46c7d8', { roughness: 0.35, metalness: 0.15 });
    const eye = toon('#3a7be0', { roughness: 0.2 });
    const sphere = new SphereGeometry(1, 10, 8);
    this.root.add(part(sphere, body, [0, 0, 0.08], [0.06, 0.055, 0.09]));
    for (const side of [-1, 1])
      this.root.add(part(sphere, eye, [side * 0.045, 0.02, 0.17], [0.045, 0.045, 0.045]));
    const tail = part(new CapsuleGeometry(0.02, 0.42, 3, 6), body, [0, 0, -0.22]);
    tail.rotation.x = Math.PI / 2;
    this.root.add(tail);
    const shape = new Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(0.1, 0.05, 0.32, 0.06, 0.4, 0.0);
    shape.bezierCurveTo(0.32, -0.05, 0.1, -0.04, 0, 0);
    const geometry = new ShapeGeometry(shape, 6);
    const glass = toon('#f2fdff', {
      transparent: true,
      opacity: 0.72,
      side: DoubleSide,
      roughness: 0.1,
      depthWrite: false,
    });
    for (const z of [0.1, 0.03])
      for (const side of [-1, 1]) {
        const hinge = new Group();
        hinge.position.set(side * 0.03, 0.04, z);
        const wing = new Mesh(geometry, glass);
        wing.rotation.x = -Math.PI / 2;
        wing.scale.set(side, 1, 1);
        hinge.add(wing);
        this.root.add(hinge);
        this.wings.push(hinge);
      }
  }

  /** The spots it hovers over, in the world: high and low on one side, then the other. */
  setSpots(spots: readonly Vector3[]) {
    this.spots = spots;
    this.from = this.to = 0;
  }

  update(t: number, calm: boolean) {
    const spots = this.spots;
    if (!spots.length) return;
    if (calm) {
      this.root.position.copy(spots[0]!);
      this.root.rotation.set(0, 0.6, 0);
      for (const hinge of this.wings) hinge.rotation.z = 0;
      return;
    }
    const dart = 0.65;
    if (t > this.leaveAt + dart) {
      // It keeps to its own side of the pond, between a high and a low spot, and now and then
      // crosses over along the top edge, so it never zips across Kiki and the numbers.
      this.from = this.to;
      this.darts++;
      const high = this.from % 2 === 0;
      this.to = high && this.darts % 3 === 0 ? (this.from + 2) % spots.length : this.from ^ 1;
      this.leaveAt = t + 1.4 + ((t * 2.3) % 1.4);
    }
    const a = spots[this.from]!;
    const b = spots[this.to]!;
    const s = t < this.leaveAt ? 0 : smooth((t - this.leaveAt) / dart);
    const scale = this.root.scale.x;
    this.root.position.lerpVectors(a, b, s);
    // A low arc between spots, and a small hovering bob while it waits.
    this.root.position.y +=
      Math.sin(s * Math.PI) * this.arc * scale + Math.sin(t * 5.3) * 0.06 * scale;
    this.root.position.x += Math.sin(t * 2.1) * 0.05 * scale;
    if (a !== b) {
      const yaw = Math.atan2(b.x - a.x, b.z - a.z);
      this.root.rotation.y += (yaw - this.root.rotation.y) * 0.08;
    }
    // Nose down while it darts, level while it hovers.
    this.root.rotation.x = Math.sin(s * Math.PI) * 0.35;
    const buzz = Math.sin(t * 60);
    this.wings.forEach((hinge, index) => {
      hinge.rotation.z = (index % 2 ? -1 : 1) * (0.15 + buzz * 0.35 * (index < 2 ? 1 : -1));
    });
  }
}

/**
 * A butterfly: a big rounded forewing and a smaller hindwing on each side, with a pale spot,
 * a slim dark body and two clubbed antennae. Its wings beat above its back, like a real one's,
 * and never flip under it. The world flies it around the pond.
 */
export class Butterfly {
  readonly root = new Group();
  private readonly wings: Group[] = [];

  constructor(color: string) {
    const fore = new Shape();
    fore.moveTo(0, 0.02);
    fore.bezierCurveTo(0.12, 0.34, 0.5, 0.36, 0.52, 0.18);
    fore.bezierCurveTo(0.5, 0.04, 0.3, -0.02, 0, -0.02);
    const hind = new Shape();
    hind.moveTo(0, -0.01);
    hind.bezierCurveTo(0.26, -0.02, 0.42, -0.16, 0.32, -0.3);
    hind.bezierCurveTo(0.22, -0.4, 0.06, -0.26, 0, -0.1);
    const spot = new Shape();
    spot.absellipse(0.32, 0.17, 0.08, 0.06, 0, Math.PI * 2, false, 0);
    const material = toon(color, { side: DoubleSide });
    const hindMaterial = toon(new Color(color).offsetHSL(0, 0, -0.08).getStyle(), {
      side: DoubleSide,
    });
    const pale = toon('#fffaf0', { side: DoubleSide });
    const foreGeometry = new ShapeGeometry(fore, 10);
    const hindGeometry = new ShapeGeometry(hind, 10);
    const spotGeometry = new ShapeGeometry(spot, 8);
    for (const side of [-1, 1]) {
      const hinge = new Group();
      for (const [geometry, paint, lift] of [
        [foreGeometry, material, 0],
        [hindGeometry, hindMaterial, -0.002],
        [spotGeometry, pale, 0.004],
      ] as const) {
        const wing = new Mesh(geometry, paint);
        wing.rotation.x = -Math.PI / 2;
        wing.position.y = lift;
        wing.scale.set(side, 1, 1);
        hinge.add(wing);
      }
      this.root.add(hinge);
      this.wings.push(hinge);
    }
    const ink = toon(INK);
    this.root.add(part(new CapsuleGeometry(0.03, 0.26, 3, 6), ink).rotateX(Math.PI / 2));
    const feeler = new CylinderGeometry(0.006, 0.006, 0.22, 4);
    const club = new SphereGeometry(0.02, 6, 4);
    for (const side of [-1, 1]) {
      const antenna = part(feeler, ink, [side * 0.04, 0.05, 0.22]);
      antenna.rotation.set(1.0, 0, -side * 0.35);
      antenna.add(part(club, ink, [0, 0.11, 0]));
      this.root.add(antenna);
    }
  }

  animate(t: number, calm: boolean) {
    // Mostly up with a quick downstroke, between nearly flat and nearly closed.
    const beat = Math.sin(t * 16);
    const flap = calm ? 0.35 : 0.65 + 0.55 * Math.sign(beat) * Math.abs(beat) ** 0.6;
    this.wings.forEach((hinge, index) => (hinge.rotation.z = (index ? -1 : 1) * flap));
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
  private readonly tips: Group[] = [];
  private readonly shins: Mesh[] = [];

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
    // The legs trail behind in flight; they swing down when it reaches for a snack.
    for (const side of [-1, 1]) {
      const hip = new Group();
      hip.position.set(side * 0.08, -0.12, -0.45);
      const shin = part(leg, toon('#d99a2b'), [0, 0, -0.35]);
      shin.rotation.x = Math.PI / 2;
      hip.add(shin);
      hip.rotation.x = -0.27;
      this.root.add(hip);
      this.shins.push(shin);
    }
    // Each wing has an inner half at the shoulder and an outer half at the wrist; the outer half
    // trails the beat, so the tips whip through after the stroke like real feathers.
    const inner = new Shape();
    inner.moveTo(0, 0.3);
    inner.quadraticCurveTo(0.3, 0.38, 0.58, 0.32);
    inner.lineTo(0.58, -0.28);
    inner.quadraticCurveTo(0.3, -0.15, 0, -0.3);
    const outer = new Shape();
    outer.moveTo(0, 0.32);
    outer.quadraticCurveTo(0.35, 0.3, 0.62, 0.02);
    outer.quadraticCurveTo(0.28, -0.08, 0.12, -0.24);
    outer.lineTo(0, -0.28);
    const innerGeometry = new ShapeGeometry(inner, 8);
    const outerGeometry = new ShapeGeometry(outer, 8);
    const wingMaterial = toon('#6f8bb0', { side: DoubleSide });
    const tipMaterial = toon('#5a7399', { side: DoubleSide });
    for (const side of [-1, 1]) {
      const hinge = new Group();
      hinge.position.set(side * 0.18, 0.1, 0.05);
      const wing = new Mesh(innerGeometry, wingMaterial);
      wing.castShadow = true;
      wing.rotation.x = -Math.PI / 2;
      wing.scale.set(side, 1, 1);
      hinge.add(wing);
      const wrist = new Group();
      wrist.position.set(side * 0.57, 0, 0);
      const tip = new Mesh(outerGeometry, tipMaterial);
      tip.castShadow = true;
      tip.rotation.x = -Math.PI / 2;
      tip.scale.set(side, 1, 1);
      wrist.add(tip);
      hinge.add(wrist);
      this.root.add(hinge);
      this.wings.push(hinge);
      this.tips.push(wrist);
    }
  }

  /**
   * `beat` from 0 (wings held out to glide) up to 1 (hard flapping). `fold` from 0 to 1 sweeps
   * the wings back for a dive, and `reach` from 0 to 1 swings the legs down to grab.
   */
  animate(t: number, beat: number, fold = 0, reach = 0) {
    const speed = 6 + beat * 8;
    const size = (0.15 + beat * 0.65) * (1 - fold * 0.7);
    const phase = t * speed;
    const shoulder = Math.sin(phase) * size + fold * 0.35;
    const wrist = Math.sin(phase - 0.9) * size * 0.75 - fold * 0.5;
    this.wings.forEach((hinge, index) => {
      const side = index ? -1 : 1;
      hinge.rotation.z = side * shoulder;
      // Swept back toward the tail in a dive.
      hinge.rotation.y = side * fold * 0.7;
      this.tips[index]!.rotation.z = side * wrist;
    });
    for (const shin of this.shins) shin.parent!.rotation.x = -0.27 - reach * 0.9;
  }
}
