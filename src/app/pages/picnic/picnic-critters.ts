import {
  CapsuleGeometry,
  ConeGeometry,
  Group,
  Material,
  Mesh,
  MeshStandardMaterial,
  MeshStandardMaterialParameters,
  Object3D,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import { FRIEND_LOOKS, FriendKind } from './picnic-friends';

export const paint = (color: string, extra: MeshStandardMaterialParameters = {}) =>
  new MeshStandardMaterial({ color, roughness: 0.8, ...extra });

/** A sphere at a spot, squashed by `scale`. */
export function ball(
  material: Material,
  radius: number,
  x: number,
  y: number,
  z: number,
  scale: [number, number, number] = [1, 1, 1],
  detail = 18,
): Mesh {
  const mesh = new Mesh(new SphereGeometry(radius, detail, Math.round(detail * 0.75)), material);
  mesh.position.set(x, y, z);
  mesh.scale.set(...scale);
  mesh.castShadow = true;
  return mesh;
}

function limb(material: Material, radius: number, length: number): Mesh {
  const mesh = new Mesh(new CapsuleGeometry(radius, length, 6, 12), material);
  mesh.castShadow = true;
  return mesh;
}

function eyes(parent: Object3D, spread: number, y: number, z: number, size: number) {
  const ink = paint('#1e140d', { roughness: 0.2 });
  const glint = paint('#ffffff', { roughness: 0.1, emissive: '#ffffff', emissiveIntensity: 0.4 });
  const made: Mesh[] = [];
  for (const side of [-1, 1]) {
    const eye = ball(ink, size, side * spread, y, z, [1, 1.15, 0.7], 14);
    eye.add(ball(glint, size * 0.32, size * 0.3, size * 0.35, size * 0.75, [1, 1, 1], 8));
    parent.add(eye);
    made.push(eye);
  }
  return made;
}

/** How a friend feels about the share in front of it. */
export interface CritterMood {
  readonly calm: boolean;
  /** When it last munched, frowned or started a happy dance; -10 for never. */
  readonly munchAt: number;
  readonly frownAt: number;
  readonly dancing: boolean;
}

/**
 * A picnic friend sitting on the blanket, built from soft shapes in its own colours: ears that
 * fit the animal (long for the bunny, round for the mouse and bear, pointy for the fox, cat and
 * squirrel), a snout or beak, and a few extras (spines, wool, stripes, a bushy tail). It bobs
 * while it waits, munches happily at a fair share, tilts its head at an unfair one and hops at
 * the end.
 */
export class Critter {
  readonly root = new Group();
  private readonly body = new Group();
  private readonly head = new Group();
  private readonly arms: Group[] = [];
  private readonly eyes: Mesh[];
  private blinkAt: number;
  private readonly phase: number;

  constructor(
    readonly kind: FriendKind,
    seed = 0,
  ) {
    const look = FRIEND_LOOKS[kind];
    this.phase = seed * 1.7;
    this.blinkAt = 1 + seed * 0.6;
    const fur = paint(look.fur, { roughness: 0.9 });
    const light = paint(look.light, { roughness: 0.85 });
    const dark = paint(look.dark, { roughness: 0.85 });
    const nose = paint('#24160e', { roughness: 0.25 });
    this.root.add(this.body);
    // Sitting: a round body with a lighter tummy and two feet poking forward.
    this.body.add(ball(fur, 0.4, 0, 0.4, 0, [1, 1, 0.92], 22));
    this.body.add(ball(light, 0.27, 0, 0.38, 0.2, [1, 1.15, 0.6]));
    for (const side of [-1, 1]) {
      this.body.add(
        ball(kind === 'duck' ? dark : fur, 0.13, side * 0.2, 0.08, 0.28, [1, 0.6, 1.4], 10),
      );
      const shoulder = new Group();
      shoulder.position.set(side * 0.34, 0.56, 0.06);
      const arm = limb(kind === 'duck' || kind === 'owl' ? fur : fur, 0.075, 0.22);
      arm.position.y = -0.16;
      shoulder.add(arm);
      shoulder.rotation.z = side * 0.35;
      shoulder.rotation.x = -0.5;
      this.arms.push(shoulder);
      this.body.add(shoulder);
    }
    this.head.position.set(0, 0.98, 0.02);
    this.body.add(this.head);
    this.head.add(ball(fur, 0.34, 0, 0, 0, [1.05, 0.95, 0.95], 22));
    // Cheeks.
    const blush = paint('#f29a8f', { transparent: true, opacity: 0.55 });
    for (const side of [-1, 1])
      this.head.add(ball(blush, 0.055, side * 0.21, -0.08, 0.26, [1, 0.7, 0.4], 8));

    // Eyes: on top for the frog, big rings for the owl.
    if (kind === 'frog') {
      for (const side of [-1, 1])
        this.head.add(ball(fur, 0.13, side * 0.15, 0.25, 0.08, [1, 1, 1], 14));
      this.eyes = eyes(this.head, 0.15, 0.28, 0.17, 0.06);
    } else if (kind === 'owl') {
      for (const side of [-1, 1])
        this.head.add(ball(paint('#fff6e0'), 0.12, side * 0.13, 0.04, 0.24, [1, 1, 0.4], 14));
      this.eyes = eyes(this.head, 0.13, 0.04, 0.3, 0.055);
    } else {
      this.eyes = eyes(this.head, 0.12, 0.05, 0.29, 0.048);
    }

    // Snout.
    if (look.snout === 'beak') {
      const beak = new Mesh(new ConeGeometry(0.08, 0.2, 10), dark);
      beak.rotation.x = Math.PI / 2;
      beak.position.set(0, -0.08, 0.38);
      if (kind === 'duck') beak.scale.set(1.6, 1, 0.6);
      this.head.add(beak);
    } else if (look.snout === 'wide') {
      const mouth = new Mesh(new TorusGeometry(0.14, 0.02, 6, 18, Math.PI), paint('#2f3a2a'));
      mouth.position.set(0, -0.06, 0.29);
      mouth.rotation.z = Math.PI;
      this.head.add(mouth);
    } else {
      const snout = look.snout === 'nose' ? 0.16 : 0.12;
      this.head.add(
        ball(light, snout, 0, -0.1, 0.25, [1.1, 0.8, look.snout === 'nose' ? 1.2 : 0.9]),
      );
      this.head.add(
        ball(
          look.snout === 'button' && (kind === 'bunny' || kind === 'mouse')
            ? paint('#e8879b')
            : nose,
          0.04,
          0,
          -0.05,
          0.4,
          [1.2, 0.9, 1],
          8,
        ),
      );
    }

    // Ears.
    switch (look.ears) {
      case 'long':
        for (const side of [-1, 1]) {
          const ear = limb(kind === 'lamb' ? dark : fur, 0.07, kind === 'lamb' ? 0.14 : 0.38);
          if (kind === 'lamb') {
            ear.position.set(side * 0.33, 0.06, 0);
            ear.rotation.z = side * 1.3;
          } else {
            ear.position.set(side * 0.12, 0.46, -0.02);
            ear.rotation.z = -side * 0.14;
            const inner = limb(paint('#f2b8c6'), 0.04, 0.3);
            inner.position.z = 0.035;
            ear.add(inner);
          }
          ear.scale.z = 0.6;
          this.head.add(ear);
        }
        break;
      case 'round':
        for (const side of [-1, 1]) {
          const ear = ball(
            fur,
            kind === 'mouse' ? 0.17 : 0.12,
            side * 0.28,
            0.27,
            -0.02,
            [1, 1, 0.5],
            14,
          );
          ear.add(ball(dark, kind === 'mouse' ? 0.11 : 0.07, 0, 0, 0.08, [1, 1, 0.4], 10));
          this.head.add(ear);
        }
        break;
      case 'pointy':
        for (const side of [-1, 1]) {
          const ear = new Mesh(new ConeGeometry(0.1, 0.26, 12), fur);
          ear.position.set(side * 0.2, 0.3, 0);
          ear.rotation.z = -side * 0.3;
          ear.castShadow = true;
          const tip = new Mesh(new ConeGeometry(0.05, 0.1, 8), dark);
          tip.position.y = 0.09;
          ear.add(tip);
          this.head.add(ear);
        }
        break;
      case 'tufts':
        for (const side of [-1, 1]) {
          const tuft = new Mesh(new ConeGeometry(0.07, 0.2, 8), fur);
          tuft.position.set(side * 0.2, 0.32, -0.02);
          tuft.rotation.z = -side * 0.5;
          this.head.add(tuft);
        }
        break;
      case 'tiny':
        for (const side of [-1, 1])
          this.head.add(ball(dark, 0.06, side * 0.22, 0.24, 0.02, [1, 1, 0.6], 8));
        break;
    }

    // Extras.
    if (kind === 'hedgehog') {
      const spine = new ConeGeometry(0.05, 0.22, 7);
      const spines = paint(look.dark, { roughness: 0.9 });
      for (let ring = 0; ring < 4; ring++)
        for (let index = 0; index < 9; index++) {
          const angle = -1.4 + (index / 8) * 2.8;
          const mesh = new Mesh(spine, spines);
          const r = 0.38;
          mesh.position.set(
            Math.sin(angle) * r * 0.95,
            1.08 - ring * 0.2,
            -Math.cos(angle) * r * 0.8 - 0.06,
          );
          mesh.lookAt(mesh.position.x * 3, mesh.position.y + 0.25, mesh.position.z * 3);
          mesh.rotateX(Math.PI / 2);
          this.body.add(mesh);
        }
    } else if (kind === 'lamb') {
      const wool = paint('#fffdf8', { roughness: 1 });
      for (const [x, y, z] of [
        [0, 0.3, 0],
        [-0.14, 0.26, 0.04],
        [0.14, 0.26, 0.04],
        [-0.22, 0.12, -0.04],
        [0.22, 0.12, -0.04],
      ] as const)
        this.head.add(ball(wool, 0.11, x, y, z, [1, 0.9, 1], 10));
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        this.body.add(
          ball(
            wool,
            0.16,
            Math.sin(a) * 0.32,
            0.5 + Math.cos(a) * 0.18,
            Math.cos(a) * 0.12 - 0.05,
            [1, 1, 1],
            10,
          ),
        );
      }
    } else if (kind === 'badger') {
      const stripe = paint(look.light);
      this.head.add(ball(stripe, 0.09, 0, 0.12, 0.25, [0.8, 2.4, 0.8], 12));
      for (const side of [-1, 1])
        this.head.add(ball(paint(look.dark), 0.08, side * 0.13, 0.04, 0.27, [0.9, 1.8, 0.6], 10));
    } else if (kind === 'fox' || kind === 'squirrel' || kind === 'cat') {
      const tail = new Group();
      tail.position.set(0.28, 0.22, -0.3);
      if (kind === 'squirrel') {
        tail.add(ball(fur, 0.2, 0.05, 0.25, 0, [0.9, 1.4, 0.8], 14));
        tail.add(ball(fur, 0.24, 0.12, 0.7, -0.05, [1, 1.1, 0.8], 14));
      } else {
        const piece = ball(fur, 0.12, 0.1, 0.2, 0, [1, 2.4, 1], 12);
        piece.rotation.z = -0.7;
        tail.add(piece);
        if (kind === 'fox') tail.add(ball(light, 0.08, 0.3, 0.42, 0, [1, 1, 1], 10));
      }
      this.body.add(tail);
    } else if (kind === 'duck' || kind === 'owl') {
      for (const side of [-1, 1]) {
        const wing = ball(
          kind === 'owl' ? dark : fur,
          0.16,
          side * 0.36,
          0.42,
          -0.02,
          [0.4, 1, 0.9],
          12,
        );
        wing.material = kind === 'owl' ? paint('#7a5a3c') : fur;
        this.body.add(wing);
      }
    } else if (kind === 'bunny') {
      this.body.add(ball(light, 0.1, 0, 0.18, -0.38, [1, 1, 1], 10));
    }
  }

  update(t: number, mood: CritterMood) {
    const idle = mood.calm ? 0 : 1;
    const tt = t + this.phase;
    const munch = t - mood.munchAt;
    const frown = t - mood.frownAt;
    let hop = 0;
    let tilt = Math.sin(tt * 1.1) * 0.06 * idle;
    let nod = 0;
    let leftZ = -0.35;
    let rightZ = 0.35;
    if (munch >= 0 && munch < 1.8) {
      nod = Math.max(0, Math.sin(munch * 14)) * 0.18;
      leftZ = -1.1;
      rightZ = 1.1;
      hop = munch < 0.5 ? Math.sin((munch / 0.5) * Math.PI) * 0.15 : 0;
    }
    if (frown >= 0 && frown < 1.4) {
      tilt = Math.sin((frown / 1.4) * Math.PI) * 0.35;
      leftZ = -0.6;
      rightZ = 0.2;
    }
    if (mood.dancing) {
      const beat = tt * 5;
      hop = Math.abs(Math.sin(beat)) * 0.22;
      leftZ = -2 - Math.sin(beat) * 0.5;
      rightZ = 2 - Math.sin(beat) * 0.5;
      tilt = Math.sin(beat) * 0.15;
    }
    this.body.position.y = hop + Math.sin(tt * 2.1) * 0.015 * idle;
    this.head.rotation.set(nod, 0, tilt);
    this.arms[0].rotation.z = leftZ;
    this.arms[1].rotation.z = rightZ;
    if (tt > this.blinkAt + 0.14) this.blinkAt = tt + 2.4 + ((tt * 5.3) % 2.5);
    const closed = tt > this.blinkAt && tt < this.blinkAt + 0.14;
    for (const eye of this.eyes) eye.scale.y = closed ? 0.12 : 1.15;
  }
}
