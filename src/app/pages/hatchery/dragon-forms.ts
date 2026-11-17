import { Group } from 'three';
import type { DragonElement } from './dragons';
import {
  ball,
  buildCrest,
  buildFamilyFeatures,
  buildTail,
  buildTailTip,
  buildWing,
  capsule,
  cone,
  DragonPaints,
  DragonRig,
  eye,
  glow,
  paint,
  RAINBOW,
  star,
} from './dragon-parts';

/** Where a starlight dragon's glowing specks sit on a form. */
export type Spots = readonly [number, number, number][];

/** Family proportions are presentation only; saved dragon identities never change. */
const FORMS: Record<
  DragonElement,
  {
    width: number;
    height: number;
    head: number;
    headWidth: number;
    headHeight: number;
    wings: number;
  }
> = {
  fire: { width: 1.12, height: 0.94, head: 1.17, headWidth: 1.12, headHeight: 0.88, wings: 1.15 },
  water: { width: 0.8, height: 1.12, head: 1.28, headWidth: 0.88, headHeight: 1.06, wings: 0.95 },
  leaf: { width: 0.91, height: 1, head: 1.19, headWidth: 0.95, headHeight: 0.94, wings: 1 },
  star: { width: 0.77, height: 1.12, head: 1.28, headWidth: 0.89, headHeight: 1, wings: 1.05 },
  cloud: { width: 1.22, height: 0.82, head: 1.08, headWidth: 1.18, headHeight: 0.88, wings: 1.1 },
  rainbow: { width: 0.88, height: 1.06, head: 1.25, headWidth: 0.94, headHeight: 1.02, wings: 1.1 },
};

/**
 * The hatchling: big head, big eyes, a round belly, little wings and a tail whose tip shows
 * its family.
 */
export function buildBaby(rig: DragonRig, paints: DragonPaints): Spots {
  const { dragon, body, head } = rig;
  const { skin, belly, accent, ink, cheek } = paints;
  const form = FORMS[dragon.element];
  // Body: a pear-shaped tummy with a lighter belly patch and little stripes.
  body.add(ball(skin, 0.5, 0, 0.55, 0, [form.width, form.height, 0.95]));
  body.add(ball(belly, 0.36, 0, 0.5, 0.26, [form.width * 0.95, form.height, 0.62]));
  for (const y of [0.32, 0.48, 0.64]) {
    const stripe = ball(
      paint(dragon.body, { roughness: 0.6 }),
      0.05,
      0,
      y,
      0.48,
      [4.2 * form.width, 0.35, 0.6],
      12,
    );
    stripe.castShadow = false;
    body.add(stripe);
  }
  // Feet and arms.
  for (const side of [-1, 1]) {
    body.add(ball(skin, 0.15, side * 0.24, 0.1, 0.16, [1, 0.62, 1.3]));
    for (const toe of [-1, 0, 1])
      body.add(ball(belly, 0.035, side * 0.24 + toe * 0.06, 0.08, 0.34, [1, 0.8, 1], 8));
    const arm = capsule(skin, 0.07, 0.16);
    arm.position.set(side * 0.36 * form.width, 0.62, 0.24);
    arm.rotation.set(0.9, 0, side * -0.5);
    body.add(arm);
  }
  // Spikes down the back.
  [0.95, 0.75, 0.52, 0.3].forEach((y, index) => {
    const spike = cone(accent, 0.07 - index * 0.008, 0.16);
    spike.position.set(0, y, -0.42 - index * 0.03);
    spike.rotation.x = -0.9 - index * 0.15;
    body.add(spike);
  });
  // Wings: hinged at the shoulders so they can flap.
  for (const side of [-1, 1]) {
    const hinge = new Group();
    hinge.position.set(side * 0.22, 0.85, -0.28);
    buildWing(hinge, rig, paints, side);
    hinge.scale.setScalar(form.wings);
    rig.wings.push(hinge);
    body.add(hinge);
  }
  // Tail: a chain of shrinking balls, each hinged on the last so it can sway.
  const tailBase = new Group();
  tailBase.position.set(0, 0.28, -0.4);
  body.add(tailBase);
  let link: Group = tailBase;
  for (let i = 0; i < 6; i++) {
    const segment = new Group();
    if (i) segment.position.set(0, 0.06 + i * 0.012, -0.12);
    segment.rotation.x = -0.18;
    segment.add(ball(skin, 0.14 - i * 0.017, 0, 0, 0, [1, 1, 1.2], 14));
    link.add(segment);
    rig.tail.push(segment);
    link = segment;
  }
  const tip = new Group();
  tip.position.set(0, 0.06, -0.1);
  link.add(tip);
  buildTailTip(rig, paints, tip);

  // Head.
  head.position.set(0, form.head, 0.06);
  head.scale.set(form.headWidth, form.headHeight, 1);
  body.add(head);
  head.add(ball(skin, 0.44, 0, 0, 0, [1.1, 1, 1]));
  head.add(ball(belly, 0.28, 0, -0.13, 0.3, [1.05, 0.72, 0.85]));
  for (const side of [-1, 1]) {
    head.add(ball(ink, 0.025, side * 0.08, -0.06, 0.53, [1, 0.7, 1], 8));
    const look = eye(rig, paints, side);
    look.position.set(side * 0.18, 0.08, 0.33);
    head.add(look);
    head.add(ball(cheek, 0.07, side * 0.3, -0.1, 0.3, [1, 0.6, 0.4], 12));
    if (dragon.element === 'fire' || dragon.element === 'star') {
      const horn = cone(accent, 0.07, dragon.element === 'fire' ? 0.35 : 0.24);
      horn.position.set(side * 0.2, 0.42, -0.05);
      horn.rotation.set(-0.35, 0, side * -0.35);
      head.add(horn);
    }
    if (dragon.element !== 'water' && dragon.element !== 'cloud') {
      const ear = cone(skin, 0.08, 0.18);
      ear.position.set(side * 0.4, 0.22, -0.05);
      ear.rotation.set(0, 0, side * -1.1);
      head.add(ear);
    }
  }
  // A smile.
  const smile = capsule(ink, 0.012, 0.12);
  smile.position.set(0, -0.22, 0.47);
  smile.rotation.z = Math.PI / 2;
  head.add(smile);
  buildCrest(rig, paints, head);
  buildFamilyFeatures(rig, paints, head);
  if (dragon.element === 'cloud')
    for (const side of [-1, 1]) body.add(ball(belly, 0.2, side * 0.43, 0.38, 0.12));
  return [
    [0.3, 0.75, 0.28],
    [-0.34, 0.6, 0.3],
    [0.42, 0.45, -0.1],
    [-0.25, 0.9, -0.3],
    [0.18, 1.5, 0.25],
    [-0.3, 1.4, 0.22],
    [0.05, 0.25, -0.42],
  ];
}

/**
 * A head with a real muzzle, smaller eyes under a brow and horns swept back. The family's crest
 * and features from the baby head sit on it, scaled to fit.
 */
function grownHead(rig: DragonRig, paints: DragonPaints, size: number, hornLength: number) {
  const { head, dragon } = rig;
  const { skin, belly, accent, ink } = paints;
  head.add(ball(skin, 0.3, 0, 0, 0, [1.05, 0.92, 1.05]));
  // The muzzle: skin on top, the lighter jaw below, nostrils at the front.
  head.add(ball(skin, 0.2, 0, -0.05, 0.27, [0.95, 0.68, 1.25]));
  head.add(ball(belly, 0.17, 0, -0.14, 0.26, [0.95, 0.5, 1.2]));
  for (const side of [-1, 1]) {
    head.add(ball(ink, 0.022, side * 0.07, -0.01, 0.51, [1, 0.7, 1], 8));
    const look = eye(rig, paints, side, size);
    look.position.set(side * 0.15, 0.07, 0.22);
    look.rotation.y = side * 0.25;
    head.add(look);
    // A brow ridge makes the look braver than a baby's.
    const brow = capsule(accent, 0.025, 0.1);
    brow.position.set(side * 0.15, 0.2, 0.24);
    brow.rotation.set(0, 0, side * (Math.PI / 2 + 0.3));
    head.add(brow);
    if (dragon.element !== 'rainbow') {
      const horn = cone(accent, 0.06, hornLength);
      horn.position.set(side * 0.14, 0.22, -0.12);
      horn.rotation.set(-1.05, 0, side * -0.3);
      horn.translateY(hornLength / 2);
      head.add(horn);
    }
  }
  const smile = capsule(ink, 0.01, 0.12);
  smile.position.set(0, -0.15, 0.48);
  smile.rotation.z = Math.PI / 2;
  head.add(smile);
  const kit = new Group();
  kit.scale.setScalar(0.7);
  kit.position.set(0, 0.02, -0.04);
  head.add(kit);
  buildCrest(rig, paints, kit);
  buildFamilyFeatures(rig, paints, kit, 1.5);
}

/** A mane running down a neck or back: flames, fins, leaves, star points, puffs or rainbow locks. */
function mane(rig: DragonRig, paints: DragonPaints, parent: Group, points: Spots, size: number) {
  const { element } = rig.dragon;
  points.forEach(([x, y, z], index) => {
    if (element === 'fire') {
      const flame = cone(
        glow(index % 2 ? '#ffd166' : '#ff8a3c', '#ff6a1f', 0.55),
        0.07 * size,
        0.24 * size,
      );
      flame.position.set(x, y, z);
      flame.rotation.x = -0.7;
      rig.flames.push(flame);
      parent.add(flame);
    } else if (element === 'water') {
      const fin = ball(paints.wing, 0.12 * size, x, y, z, [0.15, 1.1, 1]);
      fin.rotation.x = -0.4;
      parent.add(fin);
    } else if (element === 'leaf') {
      const leaf = ball(
        index % 2 ? paints.accent : paints.wing,
        0.11 * size,
        x,
        y,
        z,
        [0.6, 1.6, 0.2],
      );
      leaf.rotation.x = -0.6;
      parent.add(leaf);
    } else if (element === 'star') {
      const point = star(glow('#ffd43f', '#ffc21a', 0.45), 0.07 * size);
      point.position.set(x, y + 0.03, z);
      rig.flames.push(point);
      parent.add(point);
    } else if (element === 'cloud') {
      parent.add(ball(paints.belly, 0.11 * size, x, y, z));
    } else {
      parent.add(ball(paint(RAINBOW[index % RAINBOW.length]), 0.08 * size, x, y, z, [1, 1.3, 1]));
    }
  });
}

/**
 * The young form: a lean dragon standing tall on strong legs, with a neck, a muzzle, horns,
 * bigger wings and a mane in its family's style down the back of the neck.
 */
export function buildYoung(rig: DragonRig, paints: DragonPaints): Spots {
  const { dragon, body, head } = rig;
  const { skin, belly, accent } = paints;
  const form = FORMS[dragon.element];
  const wide = 0.75 + form.width * 0.25;
  // A slimmer, taller body leaning a little forward.
  const torso = new Group();
  torso.rotation.x = 0.12;
  body.add(torso);
  torso.add(ball(skin, 0.4, 0, 0.66, 0, [wide * 0.92, 1.18, 0.88]));
  torso.add(ball(belly, 0.3, 0, 0.62, 0.17, [wide * 0.86, 1.15, 0.62]));
  for (const y of [0.42, 0.58, 0.74, 0.9]) {
    const plate = ball(paint(dragon.belly, { roughness: 0.4 }), 0.05, 0, y, 0.36, [
      3.4 * wide,
      0.3,
      0.5,
    ]);
    plate.castShadow = false;
    torso.add(plate);
  }
  // Strong legs, clawed feet and arms.
  for (const side of [-1, 1]) {
    body.add(ball(skin, 0.17, side * 0.22, 0.27, 0, [1, 1.25, 1.1]));
    body.add(ball(skin, 0.12, side * 0.24, 0.07, 0.12, [1, 0.55, 1.5]));
    for (const toe of [-1, 0, 1])
      body.add(ball(accent, 0.03, side * 0.24 + toe * 0.055, 0.05, 0.3, [1, 0.8, 1.4], 8));
    const arm = capsule(skin, 0.06, 0.2);
    arm.position.set(side * 0.3 * wide, 0.82, 0.2);
    arm.rotation.set(1.1, 0, side * -0.45);
    body.add(arm);
  }
  // A neck carries the head higher.
  const neck = capsule(skin, 0.15, 0.32);
  neck.position.set(0, 1.12, 0.05);
  neck.rotation.x = 0.25;
  body.add(neck);
  body.add(ball(belly, 0.12, 0, 1.08, 0.14, [1, 1.6, 0.7]));
  head.position.set(0, 1.44, 0.14);
  head.scale.setScalar(0.85 + form.headWidth * 0.15);
  body.add(head);
  grownHead(rig, paints, 0.72, 0.3);
  mane(
    rig,
    paints,
    body,
    [
      [0, 1.42, -0.18],
      [0, 1.26, -0.17],
      [0, 1.1, -0.15],
    ],
    1,
  );
  // Back spikes, taller than a baby's.
  [0.92, 0.74, 0.55, 0.36].forEach((y, index) => {
    const spike = cone(accent, 0.07 - index * 0.008, 0.22);
    spike.position.set(0, y, -0.36 - index * 0.02);
    spike.rotation.x = -1 - index * 0.12;
    body.add(spike);
  });
  // Wings a third bigger, set higher on the back.
  for (const side of [-1, 1]) {
    const hinge = new Group();
    hinge.position.set(side * 0.18, 1.0, -0.24);
    buildWing(hinge, rig, paints, side);
    hinge.scale.setScalar(form.wings * 1.35);
    rig.wings.push(hinge);
    body.add(hinge);
  }
  const tailBase = new Group();
  tailBase.position.set(0, 0.24, -0.34);
  body.add(tailBase);
  buildTail(rig, paints, tailBase, 8, 0.13, [0, 0.03, -0.13], 1.25);
  if (dragon.element === 'cloud') {
    // A cloud collar round the neck.
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      body.add(ball(belly, 0.11, Math.sin(angle) * 0.2, 0.98, Math.cos(angle) * 0.18 + 0.04));
    }
  }
  return [
    [0.26, 0.8, 0.28],
    [-0.28, 0.6, 0.3],
    [0.32, 0.45, -0.12],
    [-0.22, 0.95, -0.28],
    [0.15, 1.7, 0.1],
    [-0.25, 1.25, 0.12],
    [0.05, 0.3, -0.5],
  ];
}

/**
 * The final form: a proud four-legged dragon with a long neck, great wings, a long tail and
 * its family's mark at its fullest: a flame mane, a sail fin, antlers, star points, a cloud
 * mane or rainbow locks. It stands turned a little, head towards the child.
 */
export function buildGrand(rig: DragonRig, paints: DragonPaints): Spots {
  rig.flap = 'z';
  const { dragon, body, head } = rig;
  const { skin, belly, accent } = paints;
  const form = FORMS[dragon.element];
  const wide = 0.8 + form.width * 0.2;
  const pose = new Group();
  pose.rotation.y = 1.0;
  pose.position.z = -0.05;
  body.add(pose);
  // A long body, a deep chest and a paler underside.
  pose.add(ball(skin, 0.4, 0, 0.74, -0.05, [wide, 0.9, 1.6]));
  pose.add(ball(belly, 0.33, 0, 0.64, 0, [wide * 0.85, 0.7, 1.45]));
  pose.add(ball(skin, 0.3, 0, 0.86, 0.42, [wide * 0.95, 1.05, 0.9]));
  pose.add(ball(belly, 0.22, 0, 0.82, 0.6, [wide * 0.9, 1.1, 0.5]));
  // Four legs with clawed paws.
  for (const side of [-1, 1]) {
    for (const z of [0.4, -0.45]) {
      pose.add(ball(skin, 0.16, side * 0.24 * wide, 0.52, z, [1, 1.35, 1.15]));
      const shin = capsule(skin, 0.085, 0.26);
      shin.position.set(side * 0.25 * wide, 0.24, z + 0.03);
      pose.add(shin);
      pose.add(ball(skin, 0.11, side * 0.25 * wide, 0.06, z + 0.09, [1, 0.55, 1.4]));
      for (const toe of [-1, 0, 1])
        pose.add(
          ball(accent, 0.026, side * 0.25 * wide + toe * 0.05, 0.04, z + 0.23, [1, 0.8, 1.4], 8),
        );
      if (dragon.element === 'cloud')
        pose.add(ball(belly, 0.13, side * 0.25 * wide, 0.16, z + 0.02, [1.2, 0.7, 1.2]));
    }
  }
  // A long neck rising from the chest, pale down the throat.
  const neckPoints: Spots = [
    [0, 1.02, 0.52],
    [0, 1.2, 0.6],
    [0, 1.38, 0.66],
    [0, 1.54, 0.7],
  ];
  for (let i = 1; i < neckPoints.length; i++) {
    const [, y0, z0] = neckPoints[i - 1];
    const [, y1, z1] = neckPoints[i];
    const length = Math.hypot(y1 - y0, z1 - z0);
    const tilt = Math.atan2(z1 - z0, y1 - y0);
    const part = capsule(skin, 0.18 - i * 0.012, length);
    part.position.set(0, (y0 + y1) / 2, (z0 + z1) / 2);
    part.rotation.x = tilt;
    pose.add(part);
  }
  // A smooth pale throat down the front of the neck.
  const throat = capsule(belly, 0.11, 0.42);
  throat.position.set(0, 1.26, 0.74);
  throat.rotation.x = 0.4;
  pose.add(throat);
  head.position.set(0, 1.74, 0.78);
  // The head turns back to look at the child.
  head.rotation.y = -0.85;
  head.scale.setScalar(0.92 + form.headWidth * 0.12);
  pose.add(head);
  grownHead(rig, paints, 0.62, 0.44);
  for (const side of [-1, 1]) {
    // A second, smaller pair of horns.
    const horn = cone(accent, 0.04, 0.2);
    horn.position.set(side * 0.24, 0.08, -0.12);
    horn.rotation.set(-1.2, 0, side * -0.9);
    head.add(horn);
  }
  mane(
    rig,
    paints,
    pose,
    [
      [0, 1.66, 0.56],
      [0, 1.5, 0.5],
      [0, 1.32, 0.43],
      [0, 1.14, 0.34],
      [0, 1.05, 0.12],
      [0, 1.04, -0.12],
      [0, 0.98, -0.36],
      [0, 0.9, -0.58],
    ],
    1.2,
  );
  if (dragon.element === 'water') {
    // A tall sail fin along the back, and whiskers.
    const sail = ball(paints.wing, 0.5, 0, 1.0, -0.15, [0.06, 0.45, 1.2]);
    pose.add(sail);
    for (const side of [-1, 1]) {
      const whisker = capsule(accent, 0.012, 0.3);
      whisker.position.set(side * 0.16, -0.08, 0.38);
      whisker.rotation.set(0.3, 0, side * 1.1);
      head.add(whisker);
    }
  } else if (dragon.element === 'leaf') {
    // Antlers like young branches, with leaves.
    for (const side of [-1, 1]) {
      const branch = new Group();
      branch.position.set(side * 0.12, 0.25, -0.05);
      branch.rotation.set(-0.4, 0, side * -0.45);
      head.add(branch);
      const stem = capsule(paint('#8a6a3f', { roughness: 0.8 }), 0.025, 0.36);
      stem.position.y = 0.18;
      branch.add(stem);
      for (const [y, x] of [
        [0.38, 0],
        [0.24, side * 0.1],
        [0.14, side * -0.08],
      ]) {
        const leaf = ball(paints.wing, 0.07, x, y, 0, [0.6, 1.5, 0.25]);
        leaf.rotation.z = x ? -x * 6 : 0;
        branch.add(leaf);
      }
    }
    for (const [x, z, color] of [
      [0.12, 0.05, '#ff8cbf'],
      [-0.14, -0.25, '#ffd43f'],
      [0.1, -0.5, '#fffefc'],
    ] as const)
      pose.add(ball(paint(color), 0.05, x, 1.06, z));
  } else if (dragon.element === 'fire') {
    // Embers glow in the chest.
    pose.add(ball(glow('#ffb347', '#ff7a2f', 0.8), 0.1, 0, 0.9, 0.7, [1, 1, 0.4]));
  } else if (dragon.element === 'star') {
    const moon = star(glow('#fff3b0', '#ffe27a', 0.6), 0.09);
    moon.position.set(0, 0.3, 0.26);
    head.add(moon);
  }
  // Great wings from the shoulders, beating up and down.
  for (const side of [-1, 1]) {
    const shoulder = new Group();
    shoulder.position.set(side * 0.2, 1.08, 0.12);
    // Raised over the back, so both wings show from the side.
    shoulder.rotation.set(-0.35, side * 0.25, side * 0.85);
    pose.add(shoulder);
    const hinge = new Group();
    shoulder.add(hinge);
    const wing = new Group();
    wing.rotation.y = side * 0.5;
    wing.scale.setScalar(form.wings * 1.75);
    buildWing(wing, rig, paints, side);
    hinge.add(wing);
    rig.wings.push(hinge);
  }
  const tailBase = new Group();
  tailBase.position.set(0, 0.62, -0.62);
  pose.add(tailBase);
  buildTail(rig, paints, tailBase, 9, 0.16, [0, -0.01, -0.15], 1.5);
  return [
    [0.3, 0.95, 0.2],
    [-0.3, 0.8, -0.1],
    [0.28, 0.7, -0.4],
    [-0.2, 1.1, 0.5],
    [0.15, 1.9, 0.6],
    [-0.25, 1.45, 0.62],
    [0.1, 0.7, -1.1],
  ];
}
