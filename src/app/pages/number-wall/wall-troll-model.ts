import {
  BoxGeometry,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshLambertMaterial,
  Object3D,
  SphereGeometry,
} from 'three';

const SKIN = '#86a868';
const SKIN_DARK = '#6d8f52';
const NOSE = '#9fae6a';
const CLOTH = '#8a5a35';
const WOOD = '#7a4f2c';
const HAIR = '#4b3a2a';

function lambert(color: string): MeshLambertMaterial {
  return new MeshLambertMaterial({ color, flatShading: true });
}

function part(geometry: BufferGeometry, material: MeshLambertMaterial) {
  const mesh = new Mesh(geometry, material);
  mesh.castShadow = true;
  return mesh;
}

/** A pivot (shoulder, hip) with a limb hanging from it. */
function limb(length: number, radius: number, material: MeshLambertMaterial): Group {
  const pivot = new Group();
  const bone = part(new CylinderGeometry(radius, radius * 0.85, length, 7), material);
  bone.position.y = -length / 2;
  pivot.add(bone);
  return pivot;
}

/**
 * A low-poly troll: a big belly, a bulbous nose, tusks, a tuft of hair and a knobbly club.
 * The world poses him each frame; he keeps no clock of his own.
 */
export class Troll {
  readonly root = new Group();
  /** Everything above the feet: bobs and rolls as he lumbers. */
  readonly body = new Group();
  readonly head = new Group();
  readonly leftLeg: Group;
  readonly rightLeg: Group;
  readonly leftArm: Group;
  /** The arm with the club. */
  readonly clubArm: Group;
  /** Little stars that circle his head after a bonk. */
  readonly dizzy: Object3D[] = [];

  constructor() {
    const skin = lambert(SKIN);
    const dark = lambert(SKIN_DARK);
    const cloth = lambert(CLOTH);
    const white = lambert('#fffbea');
    const black = lambert('#1d1a1a');

    this.leftLeg = limb(0.5, 0.17, dark);
    this.rightLeg = limb(0.5, 0.17, dark);
    for (const [leg, side] of [
      [this.leftLeg, -1],
      [this.rightLeg, 1],
    ] as const) {
      leg.position.set(side * 0.26, 0.62, 0);
      const foot = part(new SphereGeometry(0.2, 7, 5), dark);
      foot.scale.set(1, 0.55, 1.5);
      foot.position.set(0, -0.52, 0.08);
      leg.add(foot);
      this.root.add(leg);
    }

    this.body.position.y = 0;
    this.root.add(this.body);

    const belly = part(new SphereGeometry(0.62, 10, 8), skin);
    belly.scale.set(1.05, 1.1, 0.9);
    belly.position.y = 1.15;
    const tummy = part(new SphereGeometry(0.42, 9, 7), lambert('#a9c487'));
    tummy.scale.set(1, 1.1, 0.6);
    tummy.position.set(0, 1.05, 0.3);
    const loincloth = part(new CylinderGeometry(0.6, 0.66, 0.32, 9), cloth);
    loincloth.position.y = 0.72;
    const belt = part(new CylinderGeometry(0.63, 0.63, 0.08, 9), lambert('#5a3a20'));
    belt.position.y = 0.87;
    this.body.add(belly, tummy, loincloth, belt);

    // Head: sits forward on hunched shoulders.
    this.head.position.set(0, 1.92, 0.12);
    const skull = part(new SphereGeometry(0.4, 10, 8), skin);
    skull.scale.set(1.05, 0.95, 1);
    const nose = part(new SphereGeometry(0.17, 8, 6), lambert(NOSE));
    nose.scale.set(1, 0.95, 1.45);
    nose.position.set(0, -0.02, 0.43);
    const brow = part(new BoxGeometry(0.5, 0.09, 0.14), dark);
    brow.position.set(0, 0.13, 0.33);
    brow.rotation.x = -0.25;
    const jaw = part(new SphereGeometry(0.3, 8, 6), skin);
    jaw.scale.set(1.1, 0.6, 0.9);
    jaw.position.set(0, -0.22, 0.12);
    const mouth = part(new BoxGeometry(0.3, 0.04, 0.05), black);
    mouth.position.set(0, -0.2, 0.39);
    this.head.add(skull, nose, brow, jaw, mouth);
    for (const side of [-1, 1]) {
      const eye = part(new SphereGeometry(0.075, 7, 5), white);
      eye.position.set(side * 0.14, 0.05, 0.35);
      const pupil = part(new SphereGeometry(0.038, 6, 4), black);
      pupil.position.set(side * 0.14, 0.05, 0.41);
      const ear = part(new ConeGeometry(0.11, 0.34, 6), skin);
      ear.position.set(side * 0.43, 0.05, 0);
      ear.rotation.z = -side * 1.25;
      const tusk = part(new ConeGeometry(0.045, 0.16, 5), white);
      tusk.position.set(side * 0.13, -0.13, 0.38);
      this.head.add(eye, pupil, ear, tusk);
    }
    const hair = lambert(HAIR);
    for (let i = 0; i < 3; i++) {
      const tuft = part(new ConeGeometry(0.07, 0.26, 5), hair);
      tuft.position.set((i - 1) * 0.1, 0.42, -0.02);
      tuft.rotation.z = (1 - i) * 0.35;
      this.head.add(tuft);
    }
    this.body.add(this.head);

    this.leftArm = limb(0.75, 0.13, skin);
    this.leftArm.position.set(-0.68, 1.5, 0);
    this.leftArm.rotation.z = -0.25;
    this.clubArm = limb(0.75, 0.13, skin);
    this.clubArm.position.set(0.68, 1.5, 0);
    this.clubArm.rotation.z = 0.25;
    for (const arm of [this.leftArm, this.clubArm]) {
      const fist = part(new SphereGeometry(0.16, 7, 5), skin);
      fist.position.y = -0.8;
      arm.add(fist);
    }
    // The club: thin handle in the fist, fat knobbly end forward.
    const club = new Group();
    const wood = lambert(WOOD);
    const handle = part(new CylinderGeometry(0.17, 0.06, 1.05, 7), wood);
    handle.rotation.x = Math.PI / 2;
    handle.position.z = 0.5;
    club.add(handle);
    for (const [x, y, z] of [
      [0.12, 0.05, 0.85],
      [-0.1, 0.1, 0.72],
      [0.02, -0.12, 0.95],
    ] as const) {
      const knob = part(new SphereGeometry(0.07, 5, 4), wood);
      knob.position.set(x, y, z);
      club.add(knob);
    }
    club.position.y = -0.8;
    this.clubArm.add(club);
    this.body.add(this.leftArm, this.clubArm);

    const star = lambert('#ffd23f');
    star.emissive.set('#ffb300');
    for (let i = 0; i < 3; i++) {
      const spark = new Mesh(new SphereGeometry(0.07, 5, 4), star);
      spark.visible = false;
      this.head.add(spark);
      this.dizzy.push(spark);
    }
  }

  /** A lumbering step: `phase` advances with distance walked, `amount` fades it in and out. */
  walk(phase: number, amount: number) {
    const swing = Math.sin(phase) * 0.6 * amount;
    this.leftLeg.rotation.x = swing;
    this.rightLeg.rotation.x = -swing;
    this.leftArm.rotation.x = -swing * 0.8;
    this.clubArm.rotation.x = swing * 0.5 - 0.35 * amount;
    this.body.position.y = Math.abs(Math.sin(phase)) * 0.09 * amount;
    this.body.rotation.z = Math.sin(phase) * 0.09 * amount;
    this.body.rotation.x = 0.08 * amount;
    this.head.rotation.y = 0;
  }

  /** Stars circle his head while `on`. */
  daze(t: number, on: boolean) {
    this.dizzy.forEach((star, index) => {
      star.visible = on;
      const angle = t * 6 + (index * Math.PI * 2) / 3;
      star.position.set(Math.cos(angle) * 0.45, 0.5, Math.sin(angle) * 0.45);
    });
  }
}
