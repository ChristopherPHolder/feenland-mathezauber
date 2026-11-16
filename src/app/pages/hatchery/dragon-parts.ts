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
  Shape,
  SphereGeometry,
} from 'three';
import type { Dragon, DragonElement } from './dragons';

/**
 * The soft shapes every dragon form is built from, and the parts the forms share: wings, eyes,
 * head features and tail tips in each family's style.
 */
export const RAINBOW = ['#ff6f91', '#ffb347', '#ffe066', '#7ddf9b', '#7cc7ff', '#b79bff'];
export const INK = '#2a2148';
const CHEEK = '#ff9fbf';

/** The groups a form fills in, so one `update` can animate every form alike. */
export interface DragonRig {
  readonly dragon: Dragon;
  /** Hops and breathes. */
  readonly body: Group;
  /** Tilts and nods. */
  readonly head: Group;
  /** Wing hinges, left then right. */
  readonly wings: Group[];
  /** Tail segments from the body out; each sways. */
  readonly tail: Group[];
  readonly eyes: Object3D[];
  /** Flames and glowing tips that flicker. */
  readonly flames: Mesh[];
  /** Wings beat forward and back (`y`, standing forms) or up and down (`z`, four-legged ones). */
  flap: 'y' | 'z';
}

export interface DragonPaints {
  readonly skin: MeshStandardMaterial;
  readonly belly: MeshStandardMaterial;
  readonly wing: MeshStandardMaterial;
  readonly accent: MeshStandardMaterial;
  readonly ink: MeshStandardMaterial;
  readonly white: MeshStandardMaterial;
  readonly cheek: MeshStandardMaterial;
}

export function paint(
  color: string,
  extra: Partial<ConstructorParameters<typeof MeshStandardMaterial>[0]> = {},
) {
  return new MeshStandardMaterial({ color, roughness: 0.55, metalness: 0, ...extra });
}

export function paints(dragon: Dragon): DragonPaints {
  return {
    skin: paint(
      dragon.body,
      dragon.starlight ? { emissive: dragon.body, emissiveIntensity: 0.12 } : {},
    ),
    belly: paint(dragon.belly),
    wing: paint(dragon.wing, { side: DoubleSide, roughness: 0.7 }),
    accent: paint(dragon.accent, { roughness: 0.4 }),
    ink: paint(INK, { roughness: 0.25 }),
    white: paint('#fffefc', { roughness: 0.2 }),
    cheek: paint(CHEEK, { roughness: 0.8, transparent: true, opacity: 0.75 }),
  };
}

export function ball(
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

export function cone(material: Material, radius: number, height: number, segments = 12): Mesh {
  const mesh = new Mesh(new ConeGeometry(radius, height, segments), material);
  mesh.castShadow = true;
  return mesh;
}

export function capsule(material: Material, radius: number, length: number): Mesh {
  const mesh = new Mesh(new CapsuleGeometry(radius, length, 6, 14), material);
  mesh.castShadow = true;
  return mesh;
}

export function starShape(outer: number, inner: number): Shape {
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

export function star(material: Material, size: number): Mesh {
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

export function glow(color: string, core: string, intensity = 0.5) {
  return paint(color, { emissive: core, emissiveIntensity: intensity });
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

/** Wings define the silhouette even when the dragons are viewed without colour. */
function elementalWing(element: DragonElement): Shape {
  if (element === 'fire') return wingShape();
  if (element === 'star') return starShape(0.48, 0.21);
  const shape = new Shape();
  shape.moveTo(0, 0);
  if (element === 'leaf') {
    shape.bezierCurveTo(0.05, 0.45, 0.5, 0.78, 0.88, 0.7);
    shape.bezierCurveTo(0.8, 0.16, 0.43, -0.16, 0, 0);
  } else {
    // A broad aquatic fin, with three pointed rays.
    shape.quadraticCurveTo(0.3, 0.3, 0.72, 0.4);
    shape.lineTo(0.57, 0.12);
    shape.lineTo(0.8, -0.02);
    shape.lineTo(0.51, -0.12);
    shape.lineTo(0.61, -0.36);
    shape.quadraticCurveTo(0.12, -0.23, 0, 0);
  }
  shape.closePath();
  return shape;
}

/** One wing in the family's style, hung on a hinge at the shoulder; `side` is -1 or 1. */
export function buildWing(hinge: Group, rig: DragonRig, paints: DragonPaints, side: number) {
  const { element } = rig.dragon;
  if (element === 'cloud') {
    // Cloud wings are fluffy puffs instead of skin.
    [
      [0.22, 0.12, 0.17],
      [0.42, 0.24, 0.14],
      [0.6, 0.38, 0.12],
      [0.36, 0.0, 0.13],
    ].forEach(([x, y, r]) => hinge.add(ball(paints.wing, r, side * x, y, -0.05)));
  } else if (element === 'rainbow') {
    RAINBOW.forEach((color, index) => {
      const feather = ball(
        paint(color),
        0.14,
        side * (0.27 + index * 0.085),
        0.12 + index * 0.045,
        0,
        [0.55, 2.6 - index * 0.2, 0.25],
      );
      feather.rotation.z = side * (-0.4 - index * 0.18);
      hinge.add(feather);
    });
  } else {
    const membrane = new Mesh(
      new ExtrudeGeometry(elementalWing(element), { depth: 0.03, bevelEnabled: false }),
      paints.wing,
    );
    membrane.scale.set(side * 0.9, 0.9, 1);
    if (element === 'star') membrane.position.set(side * 0.42, 0.2, 0);
    membrane.rotation.y = side * -0.5;
    membrane.castShadow = true;
    hinge.add(membrane);
    // Bat and leaf wings have a bone along the top edge; star wings and fins do not.
    if (element === 'fire' || element === 'leaf') {
      const bone = new Mesh(new CapsuleGeometry(0.025, 0.55, 4, 8), paints.skin);
      bone.position.set(side * 0.3, 0.24, 0.02);
      bone.rotation.z = side * -1.05;
      hinge.add(bone);
    }
  }
}

/** A big shiny eye with a highlight, as a group that can blink. */
export function eye(rig: DragonRig, paints: DragonPaints, side: number, size = 1): Group {
  const group = new Group();
  group.add(ball(paints.white, 0.13, 0, 0, 0, [1, 1.12, 0.7]));
  group.add(ball(paints.ink, 0.085, side * 0.012, -0.01, 0.07, [1, 1.12, 0.6]));
  group.add(ball(paints.white, 0.03, side * -0.02, 0.04, 0.13, [1, 1, 1], 8));
  group.scale.setScalar(size);
  rig.eyes.push(group);
  return group;
}

/** The family's crest on top of a baby-sized head (radius 0.44). */
export function buildCrest(rig: DragonRig, paints: DragonPaints, head: Group) {
  const { element } = rig.dragon;
  const { accent, belly } = paints;
  if (element === 'fire') {
    const flame = cone(glow('#ffb347', '#ff7a2f', 0.4), 0.07, 0.18);
    flame.position.set(0, 0.47, 0.08);
    head.add(flame);
    rig.flames.push(flame);
  } else if (element === 'water') {
    const fin = ball(accent, 0.13, 0, 0.4, -0.08, [0.15, 1, 1.1]);
    head.add(fin);
  } else if (element === 'leaf') {
    const sprout = ball(accent, 0.09, 0.05, 0.5, 0.02, [0.5, 1, 0.15]);
    sprout.rotation.z = -0.5;
    const sprout2 = ball(accent, 0.07, -0.05, 0.48, 0.02, [0.5, 1, 0.15]);
    sprout2.rotation.z = 0.6;
    head.add(sprout, sprout2);
  } else if (element === 'star') {
    const mark = star(glow('#ffd43f', '#ffc21a', 0.3), 0.07);
    mark.position.set(0, 0.26, 0.4);
    mark.rotation.x = -0.4;
    head.add(mark);
  } else if (element === 'cloud') {
    for (const [x, y, r] of [
      [0, 0.44, 0.1],
      [-0.1, 0.4, 0.08],
      [0.1, 0.4, 0.08],
    ])
      head.add(ball(belly, r, x, y, 0));
  } else {
    RAINBOW.forEach((color, index) => {
      const spike = cone(paint(color), 0.045, 0.14);
      const angle = ((index - 2.5) / 2.5) * 0.9;
      spike.position.set(Math.sin(angle) * 0.1, 0.44, -0.1 + Math.abs(angle) * -0.05 + 0.05);
      spike.rotation.set(-0.3, 0, -angle * 0.6);
      head.add(spike);
    });
  }
}

/** Gills, leaf ears, cloud tufts, star cheeks or a unicorn horn, on a baby-sized head. */
export function buildFamilyFeatures(rig: DragonRig, paints: DragonPaints, head: Group, horn = 1) {
  const { element } = rig.dragon;
  const { wing, belly, accent } = paints;
  for (const side of [-1, 1]) {
    if (element === 'water') {
      // Axolotl-like gills make the swimmer unmistakable from the front.
      for (let i = 0; i < 3; i++) {
        const gill = ball(
          wing,
          0.09,
          side * (0.46 + i * 0.045),
          0.18 - i * 0.18,
          0,
          [2.3, 0.55, 0.4],
        );
        gill.rotation.z = side * (0.55 - i * 0.5);
        head.add(gill);
      }
    } else if (element === 'leaf') {
      for (let i = 0; i < 3; i++) {
        const leaf = ball(
          i % 2 ? accent : wing,
          0.13,
          side * (0.32 + i * 0.045),
          -0.19 + i * 0.2,
          0.02,
          [0.65, 1.8, 0.25],
        );
        leaf.rotation.z = side * (-0.9 + i * 0.7);
        head.add(leaf);
      }
    } else if (element === 'cloud') {
      for (let i = 0; i < 4; i++) {
        head.add(ball(belly, 0.15, side * (0.12 + i * 0.095), 0.36 - i * 0.13, -0.02));
      }
    } else if (element === 'star') {
      const cheekStar = star(accent, 0.14);
      cheekStar.position.set(side * 0.42, 0.1, 0);
      head.add(cheekStar);
    }
  }
  if (element === 'rainbow') {
    // A single tall unicorn horn and a six-colour mane.
    const length = 0.43 * horn;
    const spike = cone(belly, 0.09, length);
    spike.position.set(0, 0.265 + length / 2, 0.13);
    head.add(spike);
    RAINBOW.forEach((color, index) => {
      head.add(ball(paint(color), 0.1, -0.28, 0.39 - index * 0.13, 0.04, [0.85, 1.15, 1]));
    });
  }
}

/** The tail tip that shows the family: a flame, a fin, a leaf, a star, a cloud or a tuft. */
export function buildTailTip(rig: DragonRig, paints: DragonPaints, tip: Group) {
  const { element } = rig.dragon;
  const { accent, belly } = paints;
  if (element === 'fire') {
    const outer = cone(glow('#ff7a2f', '#ff5a1f', 0.5), 0.11, 0.3);
    const inner = cone(glow('#ffe066', '#ffd43f', 0.7), 0.06, 0.2);
    outer.rotation.x = -0.6;
    inner.rotation.x = -0.6;
    outer.position.set(0, 0.08, -0.04);
    inner.position.set(0, 0.06, -0.01);
    rig.flames.push(outer, inner);
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
    const point = star(glow('#ffd43f', '#ffc21a', 0.35), 0.14);
    point.position.set(0, 0.1, -0.02);
    tip.add(point);
    rig.flames.push(point);
  } else if (element === 'cloud') {
    for (const [x, y, r] of [
      [0, 0.06, 0.1],
      [-0.08, 0.02, 0.07],
      [0.08, 0.02, 0.07],
    ])
      tip.add(ball(belly, r, x, y, -0.03));
  } else {
    RAINBOW.forEach((color, index) => {
      tip.add(
        ball(
          paint(color),
          0.05,
          (index - 2.5) * 0.045,
          0.06 + Math.sin((index / 5) * Math.PI) * 0.08,
          -0.03,
        ),
      );
    });
  }
}

/**
 * A swaying tail: a chain of shrinking balls, each hinged on the last, ending in the family's
 * tip. `step` is the offset from one segment to the next.
 */
export function buildTail(
  rig: DragonRig,
  paints: DragonPaints,
  base: Group,
  count: number,
  radius: number,
  step: [number, number, number],
  tipScale = 1,
) {
  let link: Object3D = base;
  for (let i = 0; i < count; i++) {
    const segment = new Group();
    if (i) segment.position.set(...step);
    segment.rotation.x = -0.18;
    segment.add(ball(paints.skin, radius * (1 - (i / count) * 0.75), 0, 0, 0, [1, 1, 1.2], 14));
    link.add(segment);
    rig.tail.push(segment);
    link = segment;
  }
  const tip = new Group();
  tip.position.set(0, step[1], step[2] * 0.8);
  tip.scale.setScalar(tipScale);
  link.add(tip);
  buildTailTip(rig, paints, tip);
}
