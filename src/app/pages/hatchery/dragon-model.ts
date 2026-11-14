import {
  CapsuleGeometry,
  ConeGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  OctahedronGeometry,
  Shape,
  SphereGeometry,
} from 'three';
import type { Dragon } from './dragons';

export const RAINBOW = ['#ff6f91', '#ffb347', '#ffe066', '#7ddf9b', '#7cc7ff', '#b79bff'];
const INK = '#2a2148';
const CHEEK = '#ff9fbf';

function paint(
  color: string,
  extra: Partial<ConstructorParameters<typeof MeshStandardMaterial>[0]> = {},
) {
  return new MeshStandardMaterial({ color, roughness: 0.55, metalness: 0, ...extra });
}

function ball(
  material: Material,
  radius: number,
  x: number,
  y: number,
  z: number,
  scale: [number, number, number] = [1, 1, 1],
  detail = 24,
): Mesh {
  const mesh = new Mesh(new SphereGeometry(radius, detail, Math.round(detail * 0.75)), material);
  mesh.position.set(x, y, z);
  mesh.scale.set(...scale);
  mesh.castShadow = true;
  return mesh;
}

function cone(material: Material, radius: number, height: number, segments = 12): Mesh {
  const mesh = new Mesh(new ConeGeometry(radius, height, segments), material);
  mesh.castShadow = true;
  return mesh;
}

function starShape(outer: number, inner: number): Shape {
  const shape = new Shape();
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 ? inner : outer;
    const angle = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i) shape.lineTo(x, y);
    else shape.moveTo(x, y);
  }
  shape.closePath();
  return shape;
}

function star(material: Material, size: number): Mesh {
  const mesh = new Mesh(
    new ExtrudeGeometry(starShape(size, size * 0.45), {
      depth: size * 0.35,
      bevelEnabled: true,
      bevelSize: size * 0.08,
      bevelThickness: size * 0.08,
      bevelSegments: 2,
    }).center(),
    material,
  );
  mesh.castShadow = true;
  return mesh;
}

/** A rounded bat wing: three scallops along the trailing edge. */
function wingShape(): Shape {
  const shape = new Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.1, 0.35, 0.45, 0.62, 0.78, 0.58);
  shape.quadraticCurveTo(0.7, 0.4, 0.74, 0.26);
  shape.quadraticCurveTo(0.58, 0.24, 0.52, 0.08);
  shape.quadraticCurveTo(0.36, 0.1, 0.28, -0.06);
  shape.quadraticCurveTo(0.14, 0.02, 0, 0);
  return shape;
}

/**
 * A chubby baby dragon built from soft shapes: big head, big eyes, a round belly, little
 * wings and a tail whose tip shows its element. `update` animates breathing, blinking,
 * wing flaps and a swaying tail; `cheer` makes it hop.
 */
export class DragonModel {
  readonly root = new Group();
  private readonly body = new Group();
  private readonly head = new Group();
  private readonly wings: Group[] = [];
  private readonly tail: Group[] = [];
  private readonly eyes: Object3D[] = [];
  private readonly flames: Mesh[] = [];
  private readonly sparkles: Mesh[] = [];
  private cheerAt = -10;
  private blinkAt = 1.5;
  private readonly phase = Math.random() * 10;

  constructor(readonly dragon: Dragon) {
    const skin = paint(
      dragon.body,
      dragon.starlight ? { emissive: dragon.body, emissiveIntensity: 0.12 } : {},
    );
    const belly = paint(dragon.belly);
    const wing = paint(dragon.wing, { side: DoubleSide, roughness: 0.7 });
    const accent = paint(dragon.accent, { roughness: 0.4 });
    const ink = paint(INK, { roughness: 0.25 });
    const white = paint('#fffefc', { roughness: 0.2 });
    const cheek = paint(CHEEK, { roughness: 0.8, transparent: true, opacity: 0.75 });

    this.root.add(this.body);
    // Body: a pear-shaped tummy with a lighter belly patch and little stripes.
    this.body.add(ball(skin, 0.5, 0, 0.55, 0, [1.05, 1.08, 0.95]));
    this.body.add(ball(belly, 0.36, 0, 0.5, 0.26, [1, 1.15, 0.62]));
    for (const y of [0.32, 0.48, 0.64]) {
      const stripe = ball(
        paint(dragon.body, { roughness: 0.6 }),
        0.05,
        0,
        y,
        0.48,
        [4.2, 0.35, 0.6],
        12,
      );
      stripe.castShadow = false;
      this.body.add(stripe);
    }
    // Feet and arms.
    for (const side of [-1, 1]) {
      const foot = ball(skin, 0.15, side * 0.24, 0.1, 0.16, [1, 0.62, 1.3]);
      this.body.add(foot);
      for (const toe of [-1, 0, 1]) {
        const claw = ball(belly, 0.035, side * 0.24 + toe * 0.06, 0.08, 0.34, [1, 0.8, 1], 8);
        this.body.add(claw);
      }
      const arm = new Mesh(new CapsuleGeometry(0.07, 0.16, 6, 12), skin);
      arm.position.set(side * 0.36, 0.62, 0.24);
      arm.rotation.set(0.9, 0, side * -0.5);
      arm.castShadow = true;
      this.body.add(arm);
    }
    // Spikes down the back.
    [0.95, 0.75, 0.52, 0.3].forEach((y, index) => {
      const spike = cone(accent, 0.07 - index * 0.008, 0.16);
      spike.position.set(0, y, -0.42 - index * 0.03);
      spike.rotation.x = -0.9 - index * 0.15;
      this.body.add(spike);
    });

    // Wings: hinged at the shoulders so they can flap.
    for (const side of [-1, 1]) {
      const hinge = new Group();
      hinge.position.set(side * 0.22, 0.85, -0.28);
      if (dragon.element === 'cloud') {
        // Cloud wings are fluffy puffs instead of skin.
        [
          [0.22, 0.12, 0.17],
          [0.42, 0.24, 0.14],
          [0.6, 0.38, 0.12],
          [0.36, 0.0, 0.13],
        ].forEach(([x, y, r]) => hinge.add(ball(wing, r, side * x, y, -0.05)));
      } else {
        const membrane = new Mesh(
          new ExtrudeGeometry(wingShape(), { depth: 0.03, bevelEnabled: false }),
          wing,
        );
        membrane.scale.set(side * 0.9, 0.9, 1);
        membrane.rotation.y = side * -0.5;
        membrane.castShadow = true;
        hinge.add(membrane);
        const bone = new Mesh(new CapsuleGeometry(0.025, 0.55, 4, 8), skin);
        bone.position.set(side * 0.3, 0.24, 0.02);
        bone.rotation.z = side * -1.05;
        hinge.add(bone);
      }
      this.wings.push(hinge);
      this.body.add(hinge);
    }

    // Tail: a chain of shrinking balls, each hinged on the last so it can sway.
    let link: Object3D = this.body;
    const tailBase = new Group();
    tailBase.position.set(0, 0.28, -0.4);
    this.body.add(tailBase);
    link = tailBase;
    for (let i = 0; i < 6; i++) {
      const segment = new Group();
      if (i) segment.position.set(0, 0.06 + i * 0.012, -0.12);
      segment.rotation.x = -0.18;
      segment.add(ball(skin, 0.14 - i * 0.017, 0, 0, 0, [1, 1, 1.2], 14));
      link.add(segment);
      this.tail.push(segment);
      link = segment;
    }
    const tip = new Group();
    tip.position.set(0, 0.06, -0.1);
    link.add(tip);
    this.buildTailTip(tip, accent, belly);

    // Head.
    this.head.position.set(0, 1.22, 0.06);
    this.body.add(this.head);
    this.head.add(ball(skin, 0.44, 0, 0, 0, [1.1, 1, 1]));
    this.head.add(ball(belly, 0.28, 0, -0.13, 0.3, [1.05, 0.72, 0.85]));
    for (const side of [-1, 1]) {
      this.head.add(ball(ink, 0.025, side * 0.08, -0.06, 0.53, [1, 0.7, 1], 8));
      const eye = new Group();
      eye.position.set(side * 0.18, 0.08, 0.33);
      eye.add(ball(white, 0.13, 0, 0, 0, [1, 1.12, 0.7]));
      eye.add(ball(ink, 0.085, side * 0.012, -0.01, 0.07, [1, 1.12, 0.6]));
      eye.add(ball(white, 0.03, side * -0.02, 0.04, 0.13, [1, 1, 1], 8));
      this.eyes.push(eye);
      this.head.add(eye);
      this.head.add(ball(cheek, 0.07, side * 0.3, -0.1, 0.3, [1, 0.6, 0.4], 12));
      const horn = cone(accent, 0.07, 0.24);
      horn.position.set(side * 0.2, 0.42, -0.05);
      horn.rotation.set(-0.35, 0, side * -0.35);
      this.head.add(horn);
      const ear = cone(skin, 0.08, 0.18);
      ear.position.set(side * 0.4, 0.22, -0.05);
      ear.rotation.set(0, 0, side * -1.1);
      this.head.add(ear);
    }
    // A smile.
    const smile = new Mesh(new CapsuleGeometry(0.012, 0.12, 4, 6), ink);
    smile.position.set(0, -0.22, 0.47);
    smile.rotation.z = Math.PI / 2;
    this.head.add(smile);
    this.buildCrest(accent, belly);

    if (dragon.starlight) {
      // Starlight dragons are sprinkled with tiny glowing stars.
      const glow = paint('#fff3b0', { emissive: '#ffe27a', emissiveIntensity: 0.9 });
      const spots: [number, number, number][] = [
        [0.3, 0.75, 0.28],
        [-0.34, 0.6, 0.3],
        [0.42, 0.45, -0.1],
        [-0.25, 0.9, -0.3],
        [0.18, 1.5, 0.25],
        [-0.3, 1.4, 0.22],
        [0.05, 0.25, -0.42],
      ];
      for (const [x, y, z] of spots) {
        const speck = new Mesh(new OctahedronGeometry(0.035), glow);
        speck.position.set(x, y, z);
        this.root.add(speck);
        this.sparkles.push(speck);
      }
    }
  }

  private buildTailTip(tip: Group, accent: Material, belly: Material) {
    const { element } = this.dragon;
    if (element === 'fire') {
      const outer = cone(
        paint('#ff7a2f', { emissive: '#ff5a1f', emissiveIntensity: 0.5 }),
        0.11,
        0.3,
      );
      const inner = cone(
        paint('#ffe066', { emissive: '#ffd43f', emissiveIntensity: 0.7 }),
        0.06,
        0.2,
      );
      outer.rotation.x = -0.6;
      inner.rotation.x = -0.6;
      outer.position.set(0, 0.08, -0.04);
      inner.position.set(0, 0.06, -0.01);
      this.flames.push(outer, inner);
      tip.add(outer, inner);
    } else if (element === 'water') {
      const fin = ball(accent, 0.16, 0, 0.04, -0.04, [0.18, 1, 0.8]);
      fin.rotation.x = -0.6;
      tip.add(fin);
    } else if (element === 'leaf') {
      const leaf = ball(accent, 0.16, 0, 0.1, -0.04, [0.55, 1.25, 0.12]);
      leaf.rotation.x = -0.5;
      tip.add(leaf);
      const vein = ball(belly, 0.012, 0, 0.1, -0.02, [1, 12, 1], 6);
      vein.rotation.x = -0.5;
      tip.add(vein);
    } else if (element === 'star') {
      const point = star(paint('#ffd43f', { emissive: '#ffc21a', emissiveIntensity: 0.35 }), 0.14);
      point.position.set(0, 0.1, -0.02);
      tip.add(point);
      this.flames.push(point);
    } else if (element === 'cloud') {
      for (const [x, y, r] of [
        [0, 0.06, 0.1],
        [-0.08, 0.02, 0.07],
        [0.08, 0.02, 0.07],
      ])
        tip.add(ball(belly, r, x, y, -0.03));
    } else {
      RAINBOW.forEach((color, index) => {
        const tuft = ball(
          paint(color),
          0.05,
          (index - 2.5) * 0.045,
          0.06 + Math.sin((index / 5) * Math.PI) * 0.08,
          -0.03,
        );
        tip.add(tuft);
      });
    }
  }

  private buildCrest(accent: Material, belly: Material) {
    const { element } = this.dragon;
    if (element === 'fire') {
      const flame = cone(
        paint('#ffb347', { emissive: '#ff7a2f', emissiveIntensity: 0.4 }),
        0.07,
        0.18,
      );
      flame.position.set(0, 0.47, 0.08);
      this.head.add(flame);
      this.flames.push(flame);
    } else if (element === 'water') {
      const fin = ball(accent, 0.13, 0, 0.4, -0.08, [0.15, 1, 1.1]);
      this.head.add(fin);
    } else if (element === 'leaf') {
      const sprout = ball(accent, 0.09, 0.05, 0.5, 0.02, [0.5, 1, 0.15]);
      sprout.rotation.z = -0.5;
      const sprout2 = ball(accent, 0.07, -0.05, 0.48, 0.02, [0.5, 1, 0.15]);
      sprout2.rotation.z = 0.6;
      this.head.add(sprout, sprout2);
    } else if (element === 'star') {
      const mark = star(paint('#ffd43f', { emissive: '#ffc21a', emissiveIntensity: 0.3 }), 0.07);
      mark.position.set(0, 0.26, 0.4);
      mark.rotation.x = -0.4;
      this.head.add(mark);
    } else if (element === 'cloud') {
      for (const [x, y, r] of [
        [0, 0.44, 0.1],
        [-0.1, 0.4, 0.08],
        [0.1, 0.4, 0.08],
      ])
        this.head.add(ball(belly, r, x, y, 0));
    } else {
      RAINBOW.forEach((color, index) => {
        const spike = cone(paint(color), 0.045, 0.14);
        const angle = ((index - 2.5) / 2.5) * 0.9;
        spike.position.set(Math.sin(angle) * 0.1, 0.44, -0.1 + Math.abs(angle) * -0.05 + 0.05);
        spike.rotation.set(-0.3, 0, -angle * 0.6);
        this.head.add(spike);
      });
    }
  }

  /** A happy hop with a flap, for a hatch or a cheer. */
  cheer(now: number) {
    this.cheerAt = now;
  }

  update(now: number, blink = true) {
    const t = now + this.phase;
    const since = now - this.cheerAt;
    const hop = since < 0.9 ? Math.sin((since / 0.9) * Math.PI) * 0.35 : 0;
    const flapSpeed = since < 1.2 ? 16 : 3.2;
    this.body.position.y = hop;
    this.body.scale.set(1 + Math.sin(t * 2) * 0.012, 1 - Math.sin(t * 2) * 0.012, 1);
    for (const [index, hinge] of this.wings.entries()) {
      const side = index ? 1 : -1;
      hinge.rotation.y = side * (0.25 + Math.sin(t * flapSpeed) * (since < 1.2 ? 0.55 : 0.18));
      hinge.rotation.z = side * -0.1;
    }
    this.tail.forEach((segment, index) => {
      segment.rotation.y = Math.sin(t * 2.2 - index * 0.5) * 0.14;
    });
    this.head.rotation.z = Math.sin(t * 0.9) * 0.06;
    this.head.rotation.x = Math.sin(t * 0.7) * 0.04 - (since < 0.9 ? 0.15 : 0);
    // Blink every few seconds.
    if (t > this.blinkAt + 0.14) this.blinkAt = t + 2.5 + ((t * 7.3) % 2.5);
    const closed = blink && t > this.blinkAt && t < this.blinkAt + 0.14;
    for (const eye of this.eyes) eye.scale.y = closed ? 0.12 : 1;
    for (const [index, flame] of this.flames.entries())
      flame.scale.setScalar(1 + Math.sin(t * 9 + index) * 0.12);
    for (const [index, speck] of this.sparkles.entries()) {
      speck.rotation.y = t * 2 + index;
      speck.scale.setScalar(0.7 + Math.abs(Math.sin(t * 2.5 + index)) * 0.6);
    }
  }
}
