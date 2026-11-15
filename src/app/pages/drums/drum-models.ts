import {
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three';
import { TextLabel } from '../../shared/three/labels';

const UP = new Vector3(0, 1, 0);

// ---------------------------------------------------------------------------------------------
// Pom the hedgehog

/** Half-sizes of Pom's body: a little longer than wide, lower than wide. */
const BODY = { x: 0.46, y: 0.38, z: 0.6 };
const BODY_CENTRE = new Vector3(0, 0.44, -0.06);

/**
 * Where a direction from the body's centre meets its skin. The back half swells a little and
 * the front tapers, which gives a hedgehog's pear shape instead of an egg.
 */
function bodyPoint(direction: Vector3, target = new Vector3()) {
  const back = Math.max(0, -direction.z);
  const front = Math.max(0, direction.z);
  const widen = 1 + 0.16 * back - 0.12 * front;
  return target.set(
    direction.x * BODY.x * widen,
    direction.y * BODY.y * (1 + 0.1 * back),
    direction.z * BODY.z,
  );
}

export interface Pom {
  /** Stands on its feet at the origin, nose along +z. */
  readonly group: Group;
  /** Everything above the feet; scale it from the feet for squash and stretch. */
  readonly body: Group;
  readonly spines: InstancedMesh;
  /** The drumsticks for the finale, hidden until then. */
  readonly sticks: readonly Group[];
  /**
   * Makes a wave run through the spines from nose to tail; strength 0 lays them flat again.
   * `t` is the running clock in seconds.
   */
  ripple(strength: number, t: number): void;
}

/**
 * Pom: a round hedgehog with real hedgehog proportions. A pear-shaped body covered on the back
 * and sides with short spines that lie back toward the tail, a soft pale face and belly, a long
 * tapering snout with a shiny nose, small dark eyes, little round ears and four short legs.
 */
export function buildPom(): Pom {
  const group = new Group();
  const body = new Group();
  group.add(body);

  const skin = new MeshStandardMaterial({ color: '#7a5434', roughness: 0.9 });
  const fur = new MeshStandardMaterial({ color: '#e9d2ad', roughness: 0.95 });
  const dark = new MeshStandardMaterial({ color: '#4a3020', roughness: 0.8 });
  const gloss = new MeshStandardMaterial({ color: '#120c0a', roughness: 0.15, metalness: 0.1 });
  const shine = new MeshBasicMaterial({ color: '#ffffff' });

  // The body, bent from a sphere into the pear shape.
  const shape = new SphereGeometry(1, 36, 24);
  const position = shape.getAttribute('position');
  const direction = new Vector3();
  const point = new Vector3();
  for (let index = 0; index < position.count; index++) {
    direction.fromBufferAttribute(position, index).normalize();
    bodyPoint(direction, point);
    position.setXYZ(index, point.x, point.y, point.z);
  }
  shape.computeVertexNormals();
  const torso = new Mesh(shape, skin);
  torso.position.copy(BODY_CENTRE);
  body.add(torso);

  // The pale belly and face.
  const belly = new Mesh(new SphereGeometry(1, 24, 16), fur);
  belly.scale.set(0.36, 0.2, 0.46);
  belly.position.set(0, 0.28, 0.02);
  const face = new Mesh(new SphereGeometry(1, 24, 18), fur);
  face.scale.set(0.29, 0.27, 0.29);
  face.position.set(0, 0.42, 0.4);
  // The snout tapers to a point, slightly turned down, with a glossy nose on the end.
  const snout = new Mesh(new ConeGeometry(0.12, 0.34, 20), fur);
  snout.rotation.x = Math.PI / 2 + 0.12;
  snout.position.set(0, 0.37, 0.68);
  const nose = new Mesh(new SphereGeometry(0.052, 14, 10), gloss);
  nose.position.set(0, 0.35, 0.85);
  const mouth = new Mesh(new TorusGeometry(0.035, 0.007, 6, 12, Math.PI), dark);
  mouth.rotation.set(0, 0, Math.PI);
  mouth.position.set(0, 0.29, 0.71);
  body.add(belly, face, snout, nose, mouth);

  for (const side of [-1, 1]) {
    const eye = new Mesh(new SphereGeometry(0.054, 14, 10), gloss);
    eye.position.set(side * 0.15, 0.5, 0.6);
    const glint = new Mesh(new SphereGeometry(0.014, 8, 6), shine);
    glint.position.set(side * 0.012, 0.018, 0.036);
    eye.add(glint);
    const ear = new Mesh(new SphereGeometry(0.068, 14, 10), dark);
    ear.scale.set(1, 1, 0.55);
    ear.position.set(side * 0.22, 0.62, 0.38);
    ear.rotation.y = side * 0.5;
    body.add(eye, ear);
  }

  // Short legs with little feet, front and back.
  const legShape = new CylinderGeometry(0.055, 0.065, 0.16, 10);
  const footShape = new SphereGeometry(0.07, 12, 8);
  for (const side of [-1, 1])
    for (const end of [0.3, -0.32]) {
      const leg = new Mesh(legShape, dark);
      leg.position.set(side * 0.24, 0.1, end);
      const foot = new Mesh(footShape, dark);
      foot.scale.set(1, 0.5, 1.4);
      foot.position.set(side * 0.24, 0.035, end + 0.04);
      group.add(leg, foot);
    }

  // Spines: points spread evenly over the skin, kept on the back and sides only, each leaning
  // back toward the tail the way a calm hedgehog's do.
  const spineShape = new ConeGeometry(0.03, 0.22, 5);
  spineShape.translate(0, 0.11, 0);
  const bases: Vector3[] = [];
  const pointing: Quaternion[] = [];
  const order: number[] = [];
  const total = 560;
  for (let index = 0; index < total; index++) {
    const y = 1 - (2 * (index + 0.5)) / total;
    const ring = Math.sqrt(1 - y * y);
    const angle = index * Math.PI * (3 - Math.sqrt(5));
    const d = new Vector3(Math.cos(angle) * ring, y, Math.sin(angle) * ring);
    const belly = d.y < -0.05 && Math.abs(d.x) < 0.75;
    if (d.y < -0.32 || d.z > 0.38 || belly) continue;
    const base = bodyPoint(d).multiplyScalar(0.94).add(BODY_CENTRE);
    const lean = new Vector3(d.x, d.y, d.z).add(new Vector3(0, 0.15, -0.75)).normalize();
    bases.push(base);
    pointing.push(new Quaternion().setFromUnitVectors(UP, lean));
    order.push(d.z);
  }
  const spines = new InstancedMesh(
    spineShape,
    new MeshStandardMaterial({ color: '#ffffff', roughness: 0.7 }),
    bases.length,
  );
  const shades = ['#5b3b23', '#7a5534', '#a07a52', '#d8c09a', '#6a4529'].map((c) => new Color(c));
  const matrix = new Matrix4();
  const stretch = new Vector3(1, 1, 1);
  const place = (strength: number, t: number) => {
    bases.forEach((base, index) => {
      const wave = strength ? Math.max(0, Math.sin(t * 22 - order[index] * 6)) : 0;
      stretch.set(1 - wave * strength * 0.2, 1 + wave * strength * 0.45, 1);
      spines.setMatrixAt(index, matrix.compose(base, pointing[index], stretch));
    });
    spines.instanceMatrix.needsUpdate = true;
  };
  bases.forEach((_, index) => spines.setColorAt(index, shades[(index * 7) % shades.length]));
  place(0, 0);
  body.add(spines);

  // Two drumsticks held in the front paws for the finale.
  const stickShape = new CylinderGeometry(0.016, 0.02, 0.46, 8);
  stickShape.translate(0, 0.23, 0);
  const tipShape = new SphereGeometry(0.04, 10, 8);
  const wood = new MeshStandardMaterial({ color: '#e0b46a', roughness: 0.6 });
  const sticks: Group[] = [];
  for (const side of [-1, 1]) {
    const stick = new Group();
    const shaft = new Mesh(stickShape, wood);
    const tip = new Mesh(tipShape, wood);
    tip.position.y = 0.46;
    stick.add(shaft, tip);
    stick.position.set(side * 0.2, 0.16, 0.42);
    stick.rotation.set(0.9, 0, -side * 0.25);
    stick.visible = false;
    sticks.push(stick);
    group.add(stick);
  }

  let rippling = false;
  return {
    group,
    body,
    spines,
    sticks,
    ripple(strength: number, t: number) {
      if (!strength && !rippling) return;
      rippling = strength > 0;
      place(strength, t);
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Drum-mushrooms

/** How far above the top of the stem the drum skin sits. */
export const SKIN_Y = 0.46;
export const SKIN_RADIUS = 0.8;
export const CAP_RADIUS = 1.2;

export interface MushroomView {
  /** Stands at the stem's foot. */
  readonly group: Group;
  /** The cap and its drum skin, pivoting at the top of the stem: squish and pulse it. */
  readonly head: Group;
  readonly cap: MeshStandardMaterial;
  readonly label: TextLabel;
  /** Height of the drum skin above the ground: where Pom's feet go. */
  readonly top: number;
  /** The little star that marks a fresh start, when there is one. */
  readonly lantern: Mesh | null;
}

/**
 * Makes drum-mushrooms that share their shapes: a pale curved stem, a glowing cap with spots,
 * and a drum skin with a hoop on top carrying the mushroom's number. Each mushroom owns only
 * its cap material, its skin material and its number label; `release` frees those.
 */
export class MushroomKit {
  private readonly stem = new LatheGeometry(
    [
      [0.44, 0],
      [0.36, 0.2],
      [0.3, 0.5],
      [0.31, 0.8],
      [0.4, 1],
    ].map(([x, y]) => new Vector2(x, y)),
    24,
  );
  private readonly capShape = new LatheGeometry(
    [
      [0.32, 0],
      [CAP_RADIUS - 0.05, 0.02],
      [CAP_RADIUS, 0.13],
      [CAP_RADIUS - 0.08, 0.3],
      [0.95, 0.42],
      [SKIN_RADIUS + 0.02, SKIN_Y - 0.01],
      [0, SKIN_Y - 0.01],
    ].map(([x, y]) => new Vector2(x, y)),
    40,
  );
  private readonly gillShape = new CircleGeometry(CAP_RADIUS - 0.04, 40);
  private readonly skinShape = new CircleGeometry(SKIN_RADIUS, 40);
  private readonly hoopShape = new TorusGeometry(SKIN_RADIUS, 0.045, 8, 40);
  private readonly spotShape = new SphereGeometry(0.12, 10, 8);
  private readonly lanternShape = new OctahedronGeometry(0.15);
  private readonly stemMaterial = new MeshStandardMaterial({ color: '#efe3cf', roughness: 0.85 });
  private readonly gillMaterial = new MeshStandardMaterial({
    color: '#cdb9a6',
    roughness: 0.9,
    side: DoubleSide,
  });
  private readonly hoopMaterial = new MeshStandardMaterial({
    color: '#c99a4b',
    metalness: 0.4,
    roughness: 0.4,
  });
  private readonly spotMaterial = new MeshStandardMaterial({
    color: '#fff8ec',
    emissive: '#fff1d6',
    emissiveIntensity: 0.25,
  });
  private readonly lanternMaterial = new MeshStandardMaterial({
    color: '#fff3b0',
    emissive: '#ffd23f',
    emissiveIntensity: 1.2,
  });

  /** A mushroom with its stem `height` tall, leaning a little to `lean` (radians). */
  build(color: string, height: number, fresh: boolean, lean = 0): MushroomView {
    const group = new Group();
    const stem = new Mesh(this.stem, this.stemMaterial);
    stem.scale.set(1, height, 1);
    stem.rotation.z = lean;
    group.add(stem);

    const head = new Group();
    head.position.set(-Math.sin(lean) * height, height, 0);
    // Tipped a little toward the camera so the number on the skin reads.
    head.rotation.x = 0.2;
    group.add(head);

    const cap = new MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.55,
      roughness: 0.45,
    });
    const dome = new Mesh(this.capShape, cap);
    const gills = new Mesh(this.gillShape, this.gillMaterial);
    gills.rotation.x = Math.PI / 2;
    gills.position.y = 0.01;
    head.add(dome, gills);
    for (let index = 0; index < 6; index++) {
      const angle = (index / 6) * Math.PI * 2 + 0.4;
      const spot = new Mesh(this.spotShape, this.spotMaterial);
      spot.scale.set(1, 0.55, 0.35);
      spot.position.set(Math.cos(angle) * 1.12, 0.2, Math.sin(angle) * 1.12);
      spot.lookAt(Math.cos(angle) * 3, 0.2, Math.sin(angle) * 3);
      head.add(spot);
    }

    const label = new TextLabel('', {
      fill: '#fff3d6',
      border: '#c08a3e',
      ink: '#3a2160',
      width: 160,
      height: 160,
      radius: 0.5,
    });
    const skin = new Mesh(this.skinShape, new MeshBasicMaterial({ map: label.texture }));
    skin.rotation.x = -Math.PI / 2;
    skin.position.y = SKIN_Y;
    const hoop = new Mesh(this.hoopShape, this.hoopMaterial);
    hoop.rotation.x = -Math.PI / 2;
    hoop.position.y = SKIN_Y;
    head.add(skin, hoop);

    let lantern: Mesh | null = null;
    if (fresh) {
      lantern = new Mesh(this.lanternShape, this.lanternMaterial);
      lantern.position.set(CAP_RADIUS - 0.1, SKIN_Y + 0.55, -0.2);
      head.add(lantern);
    }
    return { group, head, cap, label, top: height + SKIN_Y, lantern };
  }

  /** Frees what belongs to this mushroom alone; the shared shapes stay. */
  release(view: MushroomView) {
    view.group.removeFromParent();
    view.cap.dispose();
    view.label.texture.dispose();
    view.head.traverse((object) => {
      if (object instanceof Mesh && object.material instanceof MeshBasicMaterial)
        object.material.dispose();
    });
  }

  dispose() {
    for (const geometry of [
      this.stem,
      this.capShape,
      this.gillShape,
      this.skinShape,
      this.hoopShape,
      this.spotShape,
      this.lanternShape,
    ])
      geometry.dispose();
    for (const material of [
      this.stemMaterial,
      this.gillMaterial,
      this.hoopMaterial,
      this.spotMaterial,
      this.lanternMaterial,
    ])
      material.dispose();
  }
}

// ---------------------------------------------------------------------------------------------
// The forest band

interface Musician {
  readonly group: Group;
  /** `playing` is whether its layer is in the song; `beat` is 1 on the beat, fading to 0. */
  update(t: number, playing: boolean, beat: number, calm: boolean): void;
}

export interface Band {
  /** About BAND_WIDTH wide, standing on its log, facing +z. */
  readonly group: Group;
  /** `layers` musicians play, in the order drums, bass, flute, bells, choir. */
  update(t: number, layers: number, beat: number, calm: boolean): void;
}

export const BAND_WIDTH = 4.2;
export const BAND_HEIGHT = 1.4;

const mat = (color: string, extra: Partial<{ emissive: string; e: number; r: number }> = {}) =>
  new MeshStandardMaterial({
    color,
    roughness: extra.r ?? 0.7,
    emissive: extra.emissive ?? '#000000',
    emissiveIntensity: extra.e ?? 1,
  });

function sphere(radius: number, material: MeshStandardMaterial, segments = 16) {
  return new Mesh(new SphereGeometry(radius, segments, Math.round(segments * 0.7)), material);
}

/** A shiny beetle at a little drum, sticks in two of its six legs. */
function beetle(): Musician {
  const group = new Group();
  const shell = mat('#1f6d6a', { r: 0.25 });
  const black = mat('#1b1a24');
  const body = sphere(0.24, shell);
  body.scale.set(1, 0.85, 1.2);
  body.position.y = 0.28;
  const seam = new Mesh(new BoxGeometry(0.012, 0.2, 0.5), black);
  seam.position.set(0, 0.46, 0);
  const head = sphere(0.12, black);
  head.position.set(0, 0.36, 0.26);
  group.add(body, seam, head);
  for (const side of [-1, 1]) {
    const antenna = new Mesh(new CylinderGeometry(0.008, 0.008, 0.22, 5), black);
    antenna.position.set(side * 0.06, 0.52, 0.3);
    antenna.rotation.set(0.5, 0, -side * 0.4);
    const eye = sphere(0.025, mat('#ffffff'), 8);
    eye.position.set(side * 0.06, 0.4, 0.36);
    group.add(antenna, eye);
    for (const z of [-0.12, 0.02]) {
      const leg = new Mesh(new CylinderGeometry(0.014, 0.014, 0.22, 5), black);
      leg.position.set(side * 0.24, 0.12, z);
      leg.rotation.z = side * 0.6;
      group.add(leg);
    }
  }
  const drum = new Mesh(new CylinderGeometry(0.2, 0.2, 0.2, 20), mat('#d94b4b'));
  drum.position.set(0, 0.1, 0.48);
  const top = new Mesh(new CylinderGeometry(0.19, 0.19, 0.01, 20), mat('#fff3dc'));
  top.position.set(0, 0.205, 0.48);
  group.add(drum, top);
  const sticks: Group[] = [];
  for (const side of [-1, 1]) {
    const stick = new Group();
    const shaft = new Mesh(new CylinderGeometry(0.01, 0.01, 0.26, 5), mat('#e0b46a'));
    shaft.position.y = 0.13;
    stick.add(shaft);
    stick.position.set(side * 0.1, 0.32, 0.3);
    sticks.push(stick);
    group.add(stick);
  }
  return {
    group,
    update(t, playing, beat, calm) {
      sticks.forEach((stick, index) => {
        const swing = playing && !calm ? Math.max(0, Math.sin(t * 16 + index * Math.PI)) : 0;
        stick.rotation.x = 0.9 + swing * 0.6 + (playing ? beat * 0.3 : -0.2);
      });
      body.position.y = 0.28 + (playing ? beat * 0.03 : 0);
    },
  };
}

/** A badger puffing a golden tuba. */
function badger(): Musician {
  const group = new Group();
  const grey = mat('#8b8a94');
  const black = mat('#25242c');
  const white = mat('#f4f1ea');
  const body = sphere(0.3, grey);
  body.scale.set(1, 0.95, 1.1);
  body.position.y = 0.32;
  const head = sphere(0.18, white);
  head.scale.set(0.95, 0.9, 1.15);
  head.position.set(0, 0.62, 0.12);
  group.add(body, head);
  for (const side of [-1, 1]) {
    const stripe = sphere(0.1, black);
    stripe.scale.set(0.45, 0.75, 1.5);
    stripe.position.set(side * 0.09, 0.66, 0.15);
    const ear = sphere(0.05, black, 10);
    ear.position.set(side * 0.13, 0.78, 0.04);
    const eye = sphere(0.022, mat('#0f0e12', { r: 0.2 }), 8);
    eye.position.set(side * 0.08, 0.66, 0.3);
    group.add(stripe, ear, eye);
  }
  const nose = sphere(0.035, black, 10);
  nose.position.set(0, 0.6, 0.33);
  group.add(nose);
  const brass = mat('#e7b53c', { r: 0.3, emissive: '#5a3c00', e: 0.4 });
  brass.metalness = 0.7;
  const tuba = new Group();
  const coil = new Mesh(new TorusGeometry(0.16, 0.05, 10, 24), brass);
  const bell = new Mesh(new ConeGeometry(0.17, 0.3, 20, 1, true), brass);
  bell.rotation.z = Math.PI;
  bell.position.set(0.12, 0.25, 0);
  tuba.add(coil, bell);
  tuba.position.set(0, 0.36, 0.3);
  group.add(tuba);
  return {
    group,
    update(t, playing, beat, calm) {
      tuba.position.y = 0.36 + (playing ? beat * 0.06 : -0.08);
      tuba.rotation.z = playing && !calm ? Math.sin(t * 3) * 0.08 : 0;
      head.rotation.x = playing ? 0 : 0.35;
    },
  };
}

/** A mouse with big round ears and a silver flute. */
function mouse(): Musician {
  const group = new Group();
  const fur = mat('#b49b86');
  const pink = mat('#f2a9b5');
  const body = sphere(0.2, fur);
  body.scale.set(0.95, 1.15, 1);
  body.position.y = 0.24;
  const head = sphere(0.14, fur);
  head.scale.set(1, 0.95, 1.2);
  head.position.set(0, 0.5, 0.06);
  group.add(body, head);
  for (const side of [-1, 1]) {
    const ear = sphere(0.1, fur);
    ear.scale.set(1, 1, 0.3);
    ear.position.set(side * 0.13, 0.64, 0);
    const inner = sphere(0.075, pink);
    inner.scale.set(1, 1, 0.2);
    inner.position.set(side * 0.13, 0.64, 0.025);
    const eye = sphere(0.02, mat('#120c0a', { r: 0.2 }), 8);
    eye.position.set(side * 0.06, 0.53, 0.2);
    group.add(ear, inner, eye);
  }
  const nose = sphere(0.025, pink, 8);
  nose.position.set(0, 0.48, 0.23);
  const tail = new Mesh(new TorusGeometry(0.16, 0.015, 6, 16, Math.PI * 1.2), pink);
  tail.position.set(0, 0.12, -0.24);
  tail.rotation.y = Math.PI / 2;
  const silver = mat('#dfe6ef', { r: 0.2 });
  silver.metalness = 0.8;
  const flute = new Mesh(new CylinderGeometry(0.018, 0.018, 0.5, 8), silver);
  flute.rotation.z = Math.PI / 2;
  flute.position.set(0.18, 0.45, 0.2);
  group.add(nose, tail, flute);
  return {
    group,
    update(t, playing, beat, calm) {
      const sway = playing && !calm ? Math.sin(t * 2.6) * 0.12 : 0;
      group.rotation.z = sway;
      flute.visible = playing;
      head.rotation.x = playing ? -0.1 - beat * 0.05 : 0.3;
    },
  };
}

/** Two glow-moths ringing little bells. */
function moths(): Musician {
  const group = new Group();
  const glow = mat('#fff6c8', { emissive: '#ffe58a', e: 0.9 });
  const wing = new MeshStandardMaterial({
    color: '#f9e7ff',
    emissive: '#c9a6ff',
    emissiveIntensity: 0.7,
    transparent: true,
    opacity: 0.9,
    side: DoubleSide,
  });
  const gold = mat('#ffcf33', { r: 0.3, emissive: '#7a5200', e: 0.6 });
  const flyers: { root: Group; wings: Mesh[]; home: Vector3 }[] = [];
  for (const side of [-1, 1]) {
    const root = new Group();
    const body = sphere(0.07, glow, 10);
    body.scale.set(1, 1, 2);
    root.add(body);
    const wings: Mesh[] = [];
    for (const w of [-1, 1]) {
      const pane = new Mesh(new CircleGeometry(0.16, 16), wing);
      pane.scale.set(1, 0.75, 1);
      pane.position.set(w * 0.14, 0.02, 0);
      pane.rotation.x = -Math.PI / 2;
      wings.push(pane);
      root.add(pane);
    }
    const bell = new Mesh(new ConeGeometry(0.06, 0.09, 12, 1, true), gold);
    bell.position.set(0, -0.12, 0.04);
    root.add(bell);
    const home = new Vector3(side * 0.18, 0.18, 0);
    root.position.copy(home);
    flyers.push({ root, wings, home });
    group.add(root);
  }
  return {
    group,
    update(t, playing, beat, calm) {
      flyers.forEach((flyer, index) => {
        const flap = playing ? (calm ? 0.5 : Math.sin(t * 24 + index) * 0.7) : 0.05;
        flyer.wings.forEach((pane, w) => (pane.rotation.y = (w ? -1 : 1) * flap));
        const hover = playing ? 0.45 + (calm ? 0 : Math.sin(t * 2 + index * 2) * 0.08) : 0;
        flyer.root.position.set(
          flyer.home.x + (playing && !calm ? Math.cos(t * 1.4 + index * 3) * 0.08 : 0),
          flyer.home.y + hover + beat * 0.03,
          flyer.home.z,
        );
      });
      glow.emissiveIntensity = playing ? 0.9 + beat * 0.6 : 0.15;
    },
  };
}

/** Three frogs singing, their throats swelling on the beat. */
function frogs(): Musician {
  const group = new Group();
  const green = mat('#4f9d4a');
  const pale = mat('#d9edb0');
  const singers: { throat: Mesh; mouth: Mesh; root: Group }[] = [];
  [-0.26, 0, 0.26].forEach((x, index) => {
    const root = new Group();
    const scale = index === 1 ? 1.1 : 0.9;
    const body = sphere(0.16, green);
    body.scale.set(1.1, 0.8, 1);
    body.position.y = 0.13;
    const throat = sphere(0.09, pale);
    throat.position.set(0, 0.1, 0.12);
    const mouth = new Mesh(new BoxGeometry(0.16, 0.012, 0.02), mat('#2a3d22'));
    mouth.position.set(0, 0.17, 0.155);
    root.add(body, throat, mouth);
    for (const side of [-1, 1]) {
      const eye = sphere(0.055, green, 10);
      eye.position.set(side * 0.08, 0.26, 0.06);
      const pupil = sphere(0.025, mat('#14100c', { r: 0.2 }), 8);
      pupil.position.set(0, 0.01, 0.045);
      eye.add(pupil);
      root.add(eye);
    }
    root.position.x = x;
    root.scale.setScalar(scale);
    singers.push({ throat, mouth, root });
    group.add(root);
  });
  return {
    group,
    update(t, playing, beat, calm) {
      singers.forEach((singer, index) => {
        const swell = playing ? 1 + (calm ? 0.2 : 0.25 + Math.sin(t * 4 + index) * 0.2) : 0.85;
        singer.throat.scale.setScalar(swell + beat * 0.2);
        singer.mouth.scale.y = playing ? 4 + beat * 3 : 1;
        singer.root.position.y = playing && !calm ? Math.abs(Math.sin(t * 2 + index)) * 0.03 : 0;
      });
    },
  };
}

/**
 * The forest band on a mossy log: a beetle drummer, a badger with a tuba, a mouse with a
 * flute, two glow-moths with bells and a frog choir. Each one sits sleepily until its layer
 * joins the song, then plays; a little lantern at its feet lights up so the change reads at a
 * glance.
 */
export function buildBand(): Band {
  const group = new Group();
  const bark = mat('#6b4a2f', { r: 0.95 });
  const log = new Mesh(new CylinderGeometry(0.28, 0.32, BAND_WIDTH, 18), bark);
  log.rotation.z = Math.PI / 2;
  log.position.y = 0.26;
  const moss = mat('#4e8a3c', { r: 1 });
  for (let index = 0; index < 5; index++) {
    const patch = sphere(0.3, moss, 12);
    patch.scale.set(1.4, 0.3, 0.8);
    patch.position.set(-1.7 + index * 0.85, 0.5, 0.02);
    group.add(patch);
  }
  for (const side of [-1, 1]) {
    const end = new Mesh(new CircleGeometry(0.3, 18), mat('#c69c6d'));
    end.position.set(side * (BAND_WIDTH / 2 + 0.001), 0.26, 0);
    end.rotation.y = side * (Math.PI / 2);
    group.add(end);
  }
  group.add(log);
  const players = [beetle(), badger(), mouse(), moths(), frogs()];
  const lanterns: MeshStandardMaterial[] = [];
  players.forEach((player, index) => {
    player.group.position.set(-1.68 + index * 0.84, 0.52, 0);
    const light = mat('#fff1c2', { emissive: '#ffcf5a', e: 0 });
    const lamp = sphere(0.05, light, 10);
    lamp.position.set(-1.68 + index * 0.84, 0.28, 0.32);
    lanterns.push(light);
    group.add(player.group, lamp);
  });
  return {
    group,
    update(t, layers, beat, calm) {
      players.forEach((player, index) => {
        const playing = index < layers;
        player.update(t, playing, playing ? beat : 0, calm);
        lanterns[index].emissiveIntensity = playing ? 1.4 + beat : 0.05;
      });
    },
  };
}

/** Disposes a geometry list; small helper for worlds holding shared shapes. */
export function disposeGeometries(geometries: readonly BufferGeometry[]) {
  for (const geometry of geometries) geometry.dispose();
}
