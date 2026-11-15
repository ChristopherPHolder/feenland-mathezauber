import {
  CapsuleGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Material,
  Mesh,
  MeshStandardMaterial,
  MeshStandardMaterialParameters,
  Object3D,
  SphereGeometry,
  TorusGeometry,
} from 'three';

export const paint = (color: string, extra: MeshStandardMaterialParameters = {}) =>
  new MeshStandardMaterial({ color, roughness: 0.75, ...extra });

/** A sphere at a spot, squashed by `scale`. */
export function ball(
  material: Material,
  radius: number,
  x: number,
  y: number,
  z: number,
  scale: [number, number, number] = [1, 1, 1],
  detail = 20,
): Mesh {
  const mesh = new Mesh(new SphereGeometry(radius, detail, Math.round(detail * 0.75)), material);
  mesh.position.set(x, y, z);
  mesh.scale.set(...scale);
  mesh.castShadow = true;
  return mesh;
}

function limb(material: Material, radius: number, length: number): Mesh {
  const mesh = new Mesh(new CapsuleGeometry(radius, length, 6, 14), material);
  mesh.castShadow = true;
  return mesh;
}

/** Two shiny eyes with a white glint, looking a little toward the child. */
function eyes(parent: Object3D, spread: number, y: number, z: number, size: number) {
  const ink = paint('#1e140d', { roughness: 0.2 });
  const glint = paint('#ffffff', { roughness: 0.1, emissive: '#ffffff', emissiveIntensity: 0.4 });
  const made: Mesh[] = [];
  for (const side of [-1, 1]) {
    const eye = ball(ink, size, side * spread, y, z, [1, 1.15, 0.7], 16);
    eye.add(ball(glint, size * 0.32, size * 0.3, size * 0.35, size * 0.75, [1, 1, 1], 10));
    parent.add(eye);
    made.push(eye);
  }
  return made;
}

export interface BrunoPose {
  readonly calm: boolean;
  /** When Bruno last chopped, shrugged, cheered or started dancing; -10 for never. */
  readonly chopAt: number;
  readonly shrugAt: number;
  readonly cheerAt: number;
  readonly dancing: boolean;
  /** The oven timer is nearly out: Bruno wipes his brow. */
  readonly worried: boolean;
}

/**
 * Bruno, the bakery's bear: a round, soft brown bear with a pear-shaped body, short legs, a
 * rounded muzzle and round ears, wearing a white apron and a puffy chef's hat with flour on
 * his cheek. He kneads while he waits, chops when the child cuts, shrugs kindly at a slip,
 * wipes his brow when the timer runs low and does a flour-puff dance at the end.
 */
export class Bruno {
  readonly root = new Group();
  private readonly body = new Group();
  private readonly head = new Group();
  private readonly arms: Group[] = [];
  private readonly eyes: Mesh[];
  private blinkAt = 2;

  constructor() {
    const fur = paint('#a8703f', { roughness: 0.9 });
    const light = paint('#e3c39a', { roughness: 0.85 });
    const dark = paint('#6b4224', { roughness: 0.85 });
    const apron = paint('#fffdf5', { roughness: 0.6 });
    const nose = paint('#24160e', { roughness: 0.25 });
    const flour = paint('#ffffff', { roughness: 1, transparent: true, opacity: 0.85 });

    this.root.add(this.body);
    // Legs and feet, short and sturdy, with light paw pads.
    for (const side of [-1, 1]) {
      this.body.add(ball(fur, 0.28, side * 0.32, 0.22, 0.05, [1, 1.1, 1]));
      this.body.add(ball(light, 0.14, side * 0.34, 0.12, 0.3, [1, 0.8, 0.4], 12));
    }
    // A pear-shaped body with a lighter belly under the apron.
    this.body.add(ball(fur, 0.62, 0, 0.95, 0, [1, 1.12, 0.92], 28));
    this.body.add(ball(light, 0.42, 0, 0.88, 0.32, [1, 1.15, 0.6]));
    // The apron: a rounded bib over the belly with a pocket, and its neck strap.
    const bib = ball(apron, 0.5, 0, 0.85, 0.26, [1, 1.2, 0.62], 24);
    this.body.add(bib);
    this.body.add(ball(paint('#f2c9d6'), 0.13, 0, 0.66, 0.6, [1.4, 0.7, 0.4], 12));
    const strap = new Mesh(new TorusGeometry(0.3, 0.03, 8, 24, Math.PI), apron);
    strap.position.set(0, 1.4, 0.18);
    strap.rotation.x = -0.4;
    this.body.add(strap);

    // Arms hinge at the shoulders so they can knead, chop, shrug and wave.
    for (const side of [-1, 1]) {
      const shoulder = new Group();
      shoulder.position.set(side * 0.55, 1.32, 0.05);
      const arm = limb(fur, 0.15, 0.42);
      arm.position.y = -0.3;
      const paw = ball(light, 0.15, 0, -0.6, 0.02, [1, 0.9, 0.9], 12);
      shoulder.add(arm, paw);
      shoulder.rotation.z = side * 0.35;
      this.arms.push(shoulder);
      this.body.add(shoulder);
    }

    // The head: big and round, with round ears, a light muzzle and a shiny nose.
    this.head.position.set(0, 1.92, 0.02);
    this.body.add(this.head);
    this.head.add(ball(fur, 0.5, 0, 0, 0, [1.05, 0.96, 0.95], 28));
    for (const side of [-1, 1]) {
      const ear = ball(fur, 0.17, side * 0.38, 0.36, -0.02, [1, 1, 0.6], 14);
      ear.add(ball(dark, 0.1, 0, 0, 0.1, [1, 1, 0.5], 10));
      this.head.add(ear);
    }
    this.head.add(ball(light, 0.24, 0, -0.12, 0.38, [1.2, 0.85, 0.85]));
    this.head.add(ball(nose, 0.08, 0, -0.03, 0.58, [1.3, 0.9, 0.9], 12));
    const mouth = new Mesh(new TorusGeometry(0.07, 0.015, 6, 16, Math.PI), nose);
    mouth.position.set(0, -0.19, 0.57);
    mouth.rotation.z = Math.PI;
    this.head.add(mouth);
    this.eyes = eyes(this.head, 0.17, 0.08, 0.42, 0.065);
    // Rosy cheeks, one dusted with flour.
    for (const side of [-1, 1])
      this.head.add(
        ball(
          paint('#e98f80', { transparent: true, opacity: 0.6 }),
          0.08,
          side * 0.3,
          -0.1,
          0.36,
          [1, 0.7, 0.4],
          10,
        ),
      );
    this.head.add(ball(flour, 0.05, 0.36, -0.02, 0.36, [1.3, 0.8, 0.4], 8));

    // A puffy chef's hat: a band and a cloud of soft rounds on top.
    const hat = new Group();
    hat.position.set(0, 0.36, -0.02);
    const band = new Mesh(new CylinderGeometry(0.34, 0.36, 0.22, 24), apron);
    band.castShadow = true;
    hat.add(band);
    for (const [x, y, z, r] of [
      [0, 0.32, 0, 0.3],
      [-0.2, 0.24, 0.05, 0.22],
      [0.2, 0.24, 0.05, 0.22],
      [0, 0.22, -0.18, 0.22],
      [0, 0.24, 0.2, 0.2],
    ] as const)
      hat.add(ball(apron, r, x, y, z, [1, 0.9, 1], 16));
    hat.rotation.z = -0.08;
    this.head.add(hat);
  }

  update(t: number, pose: BrunoPose) {
    const idle = pose.calm ? 0 : 1;
    const chop = t - pose.chopAt;
    const shrug = t - pose.shrugAt;
    const cheer = t - pose.cheerAt;
    const [left, right] = this.arms;
    // Kneading: the paws press down in turn.
    let leftZ = -0.35 - Math.max(0, Math.sin(t * 3)) * 0.25 * idle;
    let rightZ = 0.35 + Math.max(0, Math.sin(t * 3 + Math.PI)) * 0.25 * idle;
    let leftX = -0.5;
    let rightX = -0.5;
    let hop = 0;
    let tilt = Math.sin(t * 0.8) * 0.05 * idle;
    let spin = 0;
    if (pose.worried && !pose.dancing) {
      // One paw up to the forehead, wiping.
      rightZ = 2.4 + Math.sin(t * 6) * 0.15 * idle;
      rightX = -0.6;
    }
    if (chop < 0.45) {
      const swing = Math.sin((chop / 0.45) * Math.PI);
      rightZ = 1.4 - swing * 1.3;
      rightX = -0.4 - swing * 0.8;
    }
    if (shrug < 1) {
      const up = Math.sin((shrug / 1) * Math.PI);
      leftZ = -0.35 - up * 0.9;
      rightZ = 0.35 + up * 0.9;
      leftX = rightX = -0.2;
      tilt = up * 0.22;
    }
    if (cheer < 1) {
      const up = Math.sin((cheer / 1) * Math.PI);
      hop = up * 0.25;
      leftZ = -0.35 - up * 2;
      rightZ = 0.35 + up * 2;
    }
    if (pose.dancing) {
      const beat = t * 4;
      hop = Math.abs(Math.sin(beat)) * 0.3;
      leftZ = -1.6 - Math.sin(beat) * 0.9;
      rightZ = 1.6 - Math.sin(beat) * 0.9;
      leftX = rightX = -0.3;
      tilt = Math.sin(beat) * 0.18;
      spin = pose.calm ? 0 : Math.sin(t * 1.3) * 0.6;
    }
    left.rotation.set(leftX, 0, leftZ);
    right.rotation.set(rightX, 0, rightZ);
    this.body.position.y = hop;
    this.body.rotation.y = spin;
    this.body.scale.set(1 + Math.sin(t * 2) * 0.012 * idle, 1 - Math.sin(t * 2) * 0.012 * idle, 1);
    this.head.rotation.z = tilt;
    if (t > this.blinkAt + 0.14) this.blinkAt = t + 2.6 + ((t * 7.1) % 2.4);
    const closed = t > this.blinkAt && t < this.blinkAt + 0.14;
    for (const eye of this.eyes) eye.scale.y = closed ? 0.12 : 1.15;
  }
}

export type AnimalKind = 'fox' | 'rabbit' | 'hedgehog' | 'squirrel';

const COATS: Record<AnimalKind, { fur: string; light: string; dark: string }> = {
  fox: { fur: '#e5793b', light: '#fff4e6', dark: '#3a2418' },
  rabbit: { fur: '#e9e2da', light: '#fffaf6', dark: '#b9a99c' },
  hedgehog: { fur: '#c9a57e', light: '#f1dcc0', dark: '#5b4031' },
  squirrel: { fur: '#c0622d', light: '#f4dcc0', dark: '#7a3a17' },
};

/**
 * A woodland customer at the counter: a fox, a rabbit, a hedgehog or a squirrel, each built
 * from soft shapes with its own ears, tail and colours. It pops up, bobs while it waits, and
 * waves when it gets its box.
 */
export class Animal {
  readonly root = new Group();
  private readonly body = new Group();
  private readonly head = new Group();
  private readonly arms: Group[] = [];
  private readonly eyes: Mesh[];
  private blinkAt = 1.3;
  private readonly phase = Math.random() * 6;

  constructor(readonly kind: AnimalKind) {
    const coat = COATS[kind];
    const fur = paint(coat.fur, { roughness: 0.9 });
    const light = paint(coat.light, { roughness: 0.85 });
    const dark = paint(coat.dark, { roughness: 0.85 });
    const nose = paint('#24160e', { roughness: 0.25 });
    this.root.add(this.body);
    this.body.add(ball(fur, 0.42, 0, 0.5, 0, [1, 1.1, 0.9], 24));
    this.body.add(ball(light, 0.28, 0, 0.46, 0.22, [1, 1.2, 0.6]));
    for (const side of [-1, 1]) {
      const shoulder = new Group();
      shoulder.position.set(side * 0.36, 0.72, 0.04);
      const arm = limb(fur, 0.08, 0.26);
      arm.position.y = -0.18;
      shoulder.add(arm);
      shoulder.rotation.z = side * 0.3;
      this.arms.push(shoulder);
      this.body.add(shoulder);
    }
    this.head.position.set(0, 1.12, 0.02);
    this.body.add(this.head);
    this.head.add(ball(fur, 0.36, 0, 0, 0, [1.05, 0.95, 0.95], 24));
    this.eyes = eyes(this.head, 0.13, 0.05, 0.3, 0.05);
    this.head.add(
      ball(
        paint('#f29a8f', { transparent: true, opacity: 0.55 }),
        0.06,
        -0.22,
        -0.08,
        0.27,
        [1, 0.7, 0.4],
        10,
      ),
      ball(
        paint('#f29a8f', { transparent: true, opacity: 0.55 }),
        0.06,
        0.22,
        -0.08,
        0.27,
        [1, 0.7, 0.4],
        10,
      ),
    );

    if (kind === 'fox') {
      this.head.add(ball(light, 0.18, 0, -0.1, 0.28, [1, 0.75, 1.1]));
      this.head.add(ball(nose, 0.05, 0, -0.06, 0.48, [1.2, 1, 1], 10));
      for (const side of [-1, 1]) {
        const ear = new Mesh(new ConeGeometry(0.12, 0.3, 14), fur);
        ear.position.set(side * 0.22, 0.34, 0);
        ear.rotation.z = -side * 0.3;
        const tip = new Mesh(new ConeGeometry(0.06, 0.12, 10), dark);
        tip.position.y = 0.1;
        ear.add(tip);
        this.head.add(ear);
      }
      const tail = ball(fur, 0.2, 0.42, 0.42, -0.2, [1, 2, 1], 16);
      tail.rotation.z = -0.8;
      tail.add(ball(light, 0.12, 0, 0.18, 0, [1, 0.6, 1], 12));
      this.body.add(tail);
    } else if (kind === 'rabbit') {
      this.head.add(ball(light, 0.15, 0, -0.1, 0.26, [1.2, 0.8, 0.8]));
      this.head.add(ball(paint('#e8879b'), 0.045, 0, -0.04, 0.39, [1.2, 0.9, 1], 10));
      for (const side of [-1, 1]) {
        const ear = limb(fur, 0.08, 0.42);
        ear.position.set(side * 0.13, 0.52, -0.02);
        ear.rotation.z = -side * 0.14;
        ear.scale.z = 0.6;
        const inner = limb(paint('#f2b8c6'), 0.045, 0.34);
        inner.position.z = 0.04;
        ear.add(inner);
        this.head.add(ear);
      }
      this.body.add(ball(light, 0.12, 0, 0.3, -0.38, [1, 1, 1], 12));
    } else if (kind === 'hedgehog') {
      this.head.add(ball(light, 0.17, 0, -0.08, 0.26, [0.9, 0.8, 1.3]));
      this.head.add(ball(nose, 0.05, 0, -0.06, 0.48, [1, 1, 1], 10));
      for (const side of [-1, 1])
        this.head.add(ball(dark, 0.07, side * 0.24, 0.24, 0.05, [1, 1, 0.6], 10));
      // A cloak of soft spines over the back of the head and body.
      const spines = paint(coat.dark, { roughness: 0.9 });
      const spine = new ConeGeometry(0.06, 0.24, 8);
      for (let ring = 0; ring < 4; ring++)
        for (let index = 0; index < 9; index++) {
          const angle = -1.3 + (index / 8) * 2.6;
          const tilt = 0.2 + ring * 0.38;
          const mesh = new Mesh(spine, spines);
          const r = 0.4;
          mesh.position.set(
            Math.sin(angle) * r * Math.cos(tilt - 0.6),
            1.2 - ring * 0.22,
            -Math.cos(angle) * r * 0.8 - 0.05,
          );
          mesh.lookAt(mesh.position.x * 3, mesh.position.y + 0.3, mesh.position.z * 3);
          mesh.rotateX(Math.PI / 2);
          this.body.add(mesh);
        }
    } else {
      this.head.add(ball(light, 0.16, 0, -0.1, 0.26, [1.1, 0.8, 0.9]));
      this.head.add(ball(nose, 0.045, 0, -0.04, 0.42, [1.2, 1, 1], 10));
      for (const side of [-1, 1]) {
        const ear = new Mesh(new ConeGeometry(0.09, 0.22, 12), fur);
        ear.position.set(side * 0.2, 0.34, 0);
        ear.rotation.z = -side * 0.15;
        const tuft = new Mesh(new ConeGeometry(0.04, 0.1, 8), dark);
        tuft.position.y = 0.14;
        ear.add(tuft);
        this.head.add(ear);
      }
      // A big bushy tail curling up behind.
      const tail = new Group();
      tail.position.set(0.2, 0.3, -0.35);
      tail.add(ball(fur, 0.22, 0.1, 0.25, 0, [0.9, 1.4, 0.8], 16));
      tail.add(ball(fur, 0.26, 0.18, 0.75, -0.05, [1, 1.1, 0.8], 16));
      tail.add(ball(light, 0.14, 0.05, 0.95, 0.05, [1, 0.8, 0.8], 12));
      this.body.add(tail);
    }
  }

  /** `cheerAt` makes it hop and wave with its box; `poppedAt` is when it arrived. */
  update(t: number, calm: boolean, cheerAt: number) {
    const idle = calm ? 0 : 1;
    const tt = t + this.phase;
    const cheer = t - cheerAt;
    const wave = cheer < 1.6 ? Math.sin(cheer * 14) * 0.5 : 0;
    const hop = cheer < 0.8 ? Math.sin((cheer / 0.8) * Math.PI) * 0.25 : 0;
    this.body.position.y = hop + Math.sin(tt * 2.2) * 0.02 * idle;
    this.head.rotation.z = Math.sin(tt * 1.1) * 0.08 * idle;
    this.arms[0].rotation.z = -0.3;
    this.arms[1].rotation.z = cheer < 1.6 ? 2.5 + wave : 0.3;
    if (tt > this.blinkAt + 0.14) this.blinkAt = tt + 2.2 + ((tt * 5.3) % 2.5);
    const closed = tt > this.blinkAt && tt < this.blinkAt + 0.14;
    for (const eye of this.eyes) eye.scale.y = closed ? 0.12 : 1.15;
  }
}
