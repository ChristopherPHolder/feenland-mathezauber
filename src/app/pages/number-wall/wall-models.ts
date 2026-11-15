import {
  BackSide,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PlaneGeometry,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { TextLabel } from '../../shared/three/labels';

/** Brick sizes in world units. Rows step up by `rise`; the bottom row sits on a plinth. */
export const BRICK = { w: 1.5, h: 0.95, d: 0.9, gap: 0.1, rise: 1.01, base: 0.28 } as const;
export const INK = '#172555';
export const PINK = '#c91860';

export function lambert(color: string, extra: Partial<MeshLambertMaterial> = {}) {
  return Object.assign(new MeshLambertMaterial({ color }), extra);
}

function mesh(geometry: BufferGeometry, material: Material, shadows = true): Mesh {
  const result = new Mesh(geometry, material);
  result.castShadow = shadows;
  result.receiveShadow = shadows;
  return result;
}

/** Centre of a brick, with row 0 the bottom row of `bottomCount` bricks. */
export function brickCentre(row: number, col: number, bottomCount: number): Vector3 {
  const count = bottomCount - row;
  return new Vector3(
    (col - (count - 1) / 2) * (BRICK.w + BRICK.gap),
    BRICK.base + BRICK.h / 2 + row * BRICK.rise,
    0,
  );
}

export function wallHalfWidth(bottomCount: number): number {
  return (bottomCount * BRICK.w + (bottomCount - 1) * BRICK.gap) / 2;
}

export type BrickLook = 'given' | 'filled' | 'golden' | 'open' | 'selected';

const LOOKS: Readonly<
  Record<BrickLook, { color: string; emissive: string; opacity: number; ink: string }>
> = {
  given: { color: '#f2dcaa', emissive: '#000000', opacity: 1, ink: INK },
  filled: { color: '#c9ecbb', emissive: '#000000', opacity: 1, ink: '#1f4d27' },
  golden: { color: '#ffd66b', emissive: '#a06a00', opacity: 1, ink: '#3d2a00' },
  open: { color: '#fff6fa', emissive: '#6e4f5a', opacity: 0.88, ink: PINK },
  selected: { color: '#ffd3e4', emissive: '#c91860', opacity: 1, ink: PINK },
};

let brickGeometry: BufferGeometry | undefined;
let faceGeometry: BufferGeometry | undefined;

/** A chunky clay brick with its number painted on the front. */
export class Brick {
  /** Sits at the brick's place in the wall. */
  readonly root = new Group();
  /** The block itself, moved inside `root` when it drops in, wobbles or tumbles. */
  readonly block = new Group();
  readonly material = new MeshLambertMaterial();
  private readonly faceMaterial = new MeshBasicMaterial({ transparent: true, depthWrite: false });
  private label?: TextLabel;
  private ink = '';
  look: BrickLook = 'given';

  constructor(
    readonly row: number,
    readonly col: number,
  ) {
    brickGeometry ??= new RoundedBoxGeometry(BRICK.w, BRICK.h, BRICK.d, 3, 0.13);
    faceGeometry ??= new PlaneGeometry(BRICK.w * 0.9, BRICK.h * 0.86);
    const body = mesh(brickGeometry, this.material);
    const face = new Mesh(faceGeometry, this.faceMaterial);
    face.position.z = BRICK.d / 2 + 0.006;
    face.renderOrder = 2;
    this.block.add(body, face);
    this.root.add(this.block);
  }

  setLook(look: BrickLook, text: string) {
    const spec = LOOKS[look];
    if (look !== this.look || !this.label) {
      this.look = look;
      this.material.color.set(spec.color);
      this.material.emissive.set(spec.emissive);
      const transparent = spec.opacity < 1;
      if (this.material.transparent !== transparent) this.material.needsUpdate = true;
      this.material.transparent = transparent;
      this.material.opacity = spec.opacity;
      this.material.depthWrite = !transparent;
    }
    if (spec.ink !== this.ink) {
      this.ink = spec.ink;
      this.label?.texture.dispose();
      this.label = new TextLabel(text, { ink: spec.ink, width: 256, height: 160 });
      this.faceMaterial.map = this.label.texture;
      this.faceMaterial.needsUpdate = true;
    } else this.label?.update(text);
  }

  /** Its resting colour blended toward `color` by `amount` (0..1): 0 restores it. */
  tint(color: Color, amount: number) {
    this.material.color.set(LOOKS[this.look].color).lerp(color, amount);
  }

  /** Its resting glow blended toward `color` by `amount` (0..1). */
  glowTo(color: Color, amount: number) {
    this.material.emissive.set(LOOKS[this.look].emissive).lerp(color, amount);
  }

  dispose() {
    this.label?.texture.dispose();
    this.material.dispose();
    this.faceMaterial.dispose();
  }
}

/** A vertical gradient painted on the inside of a big sphere. */
function skyDome(): Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const c = canvas.getContext('2d')!;
  const gradient = c.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, '#6fc0ee');
  gradient.addColorStop(0.42, '#a9dcf5');
  gradient.addColorStop(0.5, '#e8f6fc');
  gradient.addColorStop(1, '#e8f6fc');
  c.fillStyle = gradient;
  c.fillRect(0, 0, 4, 256);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return new Mesh(
    new SphereGeometry(90, 24, 12),
    new MeshBasicMaterial({ map: texture, side: BackSide, fog: false, depthWrite: false }),
  );
}

function cloud(): Group {
  const group = new Group();
  const white = lambert('#ffffff', { emissive: new Color('#cfdbe6') });
  const puffs: [number, number, number, number][] = [
    [0, 0, 0, 1.3],
    [1.3, -0.2, 0.1, 1],
    [-1.3, -0.25, 0, 0.95],
    [0.5, 0.55, -0.2, 0.9],
    [-0.6, 0.4, 0.1, 0.8],
  ];
  for (const [x, y, z, r] of puffs) {
    const puff = new Mesh(new SphereGeometry(r, 9, 7), white);
    puff.position.set(x, y, z);
    puff.scale.y = 0.75;
    group.add(puff);
  }
  return group;
}

function tree(scale: number): Group {
  const group = new Group();
  const trunk = mesh(new CylinderGeometry(0.12, 0.16, 0.7, 6), lambert('#8a5a35'));
  trunk.position.y = 0.35;
  const leaves = lambert('#4f9f4f', { flatShading: true });
  const low = mesh(new ConeGeometry(0.75, 1.3, 7), leaves);
  low.position.y = 1.2;
  const high = mesh(new ConeGeometry(0.55, 1, 7), leaves);
  high.position.y = 1.85;
  group.add(trunk, low, high);
  group.scale.setScalar(scale);
  return group;
}

/** The meadow, hills, trees, sun and clouds: everything that stays put between walls. */
export class Scenery {
  readonly group = new Group();
  readonly clouds: Group[] = [];
  readonly sky: Mesh<SphereGeometry, MeshBasicMaterial>;
  readonly sunGlow: Mesh<CircleGeometry, MeshBasicMaterial>;

  constructor() {
    this.sky = skyDome() as Mesh<SphereGeometry, MeshBasicMaterial>;
    this.group.add(this.sky);

    const meadow = mesh(new CircleGeometry(70, 40), lambert('#8fcf72'));
    meadow.rotation.x = -Math.PI / 2;
    meadow.castShadow = false;
    this.group.add(meadow);

    const hills: [number, number, number, number, string][] = [
      [-16, -26, 11, 4.2, '#7fc266'],
      [4, -32, 14, 5, '#86c96c'],
      [20, -24, 10, 3.6, '#79bb60'],
      [-6, -18, 6, 1.8, '#9bd47f'],
    ];
    for (const [x, z, r, h, color] of hills) {
      const hill = new Mesh(new SphereGeometry(1, 16, 8), lambert(color));
      hill.scale.set(r, h, r * 0.6);
      hill.position.set(x, 0, z);
      this.group.add(hill);
    }

    const sun = new Mesh(
      new CircleGeometry(2.4, 28),
      new MeshBasicMaterial({ color: '#fff3b0', fog: false }),
    );
    this.sunGlow = new Mesh(
      new CircleGeometry(4, 28),
      new MeshBasicMaterial({ color: '#ffd96a', fog: false, transparent: true, opacity: 0.45 }),
    );
    sun.position.set(14, 15, -50);
    this.sunGlow.position.set(14, 15, -50.1);
    this.group.add(sun, this.sunGlow);

    const trees: [number, number, number][] = [
      [-7.5, -5, 1.2],
      [-9.5, -2, 1],
      [-6.2, -9, 1.4],
      [9.8, -6, 1.1],
      [12, -12, 1.5],
      [-12, -10, 1.6],
    ];
    for (const [x, z, s] of trees) {
      const t = tree(s);
      t.position.set(x, 0, z);
      this.group.add(t);
    }

    const petals = ['#ff8fb8', '#ffd23f', '#ffffff', '#b99cff'].map((color) => lambert(color));
    const bloom = new SphereGeometry(0.09, 5, 4);
    for (let i = 0; i < 26; i++) {
      const flower = new Mesh(bloom, petals[i % petals.length]!);
      const angle = i * 2.4;
      const radius = 4 + ((i * 37) % 9);
      flower.position.set(Math.cos(angle) * radius, 0.06, 1 + Math.sin(angle) * radius * 0.5);
      if (Math.abs(flower.position.x) < 4.5 && flower.position.z < 3) continue;
      this.group.add(flower);
    }

    for (const [x, y, z, s] of [
      [-12, 10, -30, 1.4],
      [6, 13, -38, 1.8],
      [18, 9, -28, 1.2],
      [-2, 8, -24, 1],
    ] as const) {
      const c = cloud();
      c.position.set(x, y, z);
      c.scale.setScalar(s);
      this.clouds.push(c);
      this.group.add(c);
    }
  }
}

/** A heart shape, or one jagged half of it, for the heart that breaks when the troll bonks. */
export function heartGeometry(half: 'whole' | 'left' | 'right'): BufferGeometry {
  const shape = new Shape();
  const side = half === 'right' ? -1 : 1;
  if (half === 'whole') {
    shape.moveTo(0, -0.5);
    shape.bezierCurveTo(-0.6, -0.05, -0.55, 0.45, -0.27, 0.45);
    shape.bezierCurveTo(-0.1, 0.45, 0, 0.3, 0, 0.22);
    shape.bezierCurveTo(0, 0.3, 0.1, 0.45, 0.27, 0.45);
    shape.bezierCurveTo(0.55, 0.45, 0.6, -0.05, 0, -0.5);
  } else {
    shape.moveTo(0, -0.5);
    shape.bezierCurveTo(-0.6 * side, -0.05, -0.55 * side, 0.45, -0.27 * side, 0.45);
    shape.bezierCurveTo(-0.1 * side, 0.45, 0, 0.3, 0, 0.22);
    shape.lineTo(0.06 * side, 0.08);
    shape.lineTo(-0.05 * side, -0.08);
    shape.lineTo(0.05 * side, -0.25);
    shape.lineTo(0, -0.5);
  }
  return new ShapeGeometry(shape, 8);
}

/** A crack drawn on a transparent canvas, laid on a brick face after a bonk. */
export function crackTexture(seed: number): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 96;
  const c = canvas.getContext('2d')!;
  c.strokeStyle = '#5b4426';
  c.lineWidth = 5;
  c.lineJoin = 'round';
  c.beginPath();
  let x = 20 + ((seed * 53) % 80);
  let y = 4;
  c.moveTo(x, y);
  for (let i = 0; i < 5; i++) {
    x += (i % 2 ? 1 : -1) * (10 + (((seed + i) * 17) % 14));
    y += 18;
    c.lineTo(x, y);
    if (i === 2) {
      c.moveTo(x, y);
      c.lineTo(x + 22, y + 10);
      c.moveTo(x, y);
    }
  }
  c.stroke();
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** A flat ribbon following `curve` on the ground. */
function ribbon(curve: CatmullRomCurve3, width: number, steps: number): BufferGeometry {
  const positions: number[] = [];
  const index: number[] = [];
  const up = new Vector3(0, 1, 0);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const point = curve.getPointAt(t);
    const side = curve
      .getTangentAt(t)
      .cross(up)
      .normalize()
      .multiplyScalar(width / 2);
    positions.push(
      point.x - side.x,
      0.015,
      point.z - side.z,
      point.x + side.x,
      0.015,
      point.z + side.z,
    );
    if (i < steps) {
      const a = i * 2;
      index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute(
    'normal',
    new Float32BufferAttribute(
      positions.map((_, i) => (i % 3 === 1 ? 1 : 0)),
      3,
    ),
  );
  geometry.setIndex(index);
  return geometry;
}

/** A round castle tower with battlements and a pointy roof. */
function tower(height: number): Group {
  const group = new Group();
  const stone = lambert('#e9d8b2', { flatShading: true });
  const shade = lambert('#cdb88c', { flatShading: true });
  const body = mesh(new CylinderGeometry(0.72, 0.8, height, 10), stone);
  body.position.y = height / 2;
  const band = mesh(new CylinderGeometry(0.86, 0.86, 0.28, 10), shade);
  band.position.y = height + 0.1;
  group.add(body, band);
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const merlon = mesh(new BoxGeometry(0.26, 0.3, 0.2), stone);
    merlon.position.set(Math.cos(angle) * 0.76, height + 0.38, Math.sin(angle) * 0.76);
    merlon.rotation.y = -angle;
    group.add(merlon);
  }
  const roof = mesh(new ConeGeometry(0.95, 1.4, 10), lambert('#e0457b', { flatShading: true }));
  roof.position.y = height + 1.1;
  const window = mesh(new BoxGeometry(0.26, 0.42, 0.1), lambert('#3c3a5c'));
  window.position.set(0, height * 0.7, 0.76);
  const door = mesh(new BoxGeometry(0.5, 0.8, 0.1), lambert('#7a4f2c'));
  door.position.set(0, 0.4, 0.78);
  group.add(roof, window, door);
  return group;
}

const PENNANTS = ['#e0457b', '#ffd23f', '#4aa3ff', '#52b36b', '#b99cff'];

/**
 * The parts that depend on the wall's size: the plinth, two towers, the winding road the troll
 * walks, the bunting that collects a pennant per finished wall and the big flag for a world.
 */
export class Castle {
  readonly group = new Group();
  readonly road: CatmullRomCurve3;
  readonly pennants: Mesh[] = [];
  readonly flag = new Group();
  readonly towerTop: number;
  readonly towerX: number;
  readonly halfWidth: number;

  constructor(bottomCount: number, rowCount: number) {
    const half = wallHalfWidth(bottomCount);
    this.halfWidth = half;
    const wallTop = BRICK.base + rowCount * BRICK.rise;
    this.towerTop = Math.max(3.2, wallTop + 0.5);
    this.towerX = half + 1.95;

    const plinth = mesh(
      new BoxGeometry(half * 2 + 0.5, BRICK.base, BRICK.d + 0.4),
      lambert('#a99f92', { flatShading: true }),
    );
    plinth.position.y = BRICK.base / 2;
    this.group.add(plinth);
    for (const side of [-1, 1]) {
      const t = tower(this.towerTop);
      t.position.set(side * this.towerX, 0, -0.25);
      this.group.add(t);
    }

    this.road = new CatmullRomCurve3([
      new Vector3(7, 0, -24),
      new Vector3(8.5, 0, -15),
      new Vector3(4.8, 0, -9.5),
      new Vector3(half + 1.05, 0, -5),
      new Vector3(half + 0.75, 0, -2),
      new Vector3(half + 0.8, 0, 0.3),
    ]);
    const road = new Mesh(ribbon(this.road, 0.95, 90), lambert('#ead39b'));
    road.receiveShadow = true;
    this.group.add(road);

    // Bunting strung between the towers, behind the wall: one pennant per finished wall.
    const span = this.towerX * 2;
    const y = this.towerTop - 0.15;
    const string = new Mesh(new BoxGeometry(span, 0.03, 0.03), lambert('#7a5a3a'));
    string.position.set(0, y, -0.6);
    this.group.add(string);
    const pennantShape = new Shape();
    pennantShape.moveTo(-0.22, 0);
    pennantShape.lineTo(0.22, 0);
    pennantShape.lineTo(0, -0.5);
    pennantShape.closePath();
    const pennantGeometry = new ShapeGeometry(pennantShape);
    PENNANTS.forEach((color, index) => {
      const pennant = new Mesh(pennantGeometry, new MeshBasicMaterial({ color, side: DoubleSide }));
      pennant.position.set(((index + 0.5) / PENNANTS.length - 0.5) * span * 0.9, y, -0.6);
      pennant.visible = false;
      this.pennants.push(pennant);
      this.group.add(pennant);
    });

    // A flag on the left tower, raised once the whole world of walls stands.
    const pole = mesh(new CylinderGeometry(0.04, 0.04, 1.6, 6), lambert('#7a5a3a'));
    pole.position.y = 0.8;
    const cloth = new Mesh(
      new PlaneGeometry(0.9, 0.55, 6, 1),
      new MeshBasicMaterial({ color: '#ffd23f', side: DoubleSide }),
    );
    cloth.position.set(0.47, 1.3, 0);
    this.flag.add(pole, cloth);
    this.flag.position.set(-this.towerX, this.towerTop + 1.7, -0.25);
    this.flag.visible = false;
    this.group.add(this.flag);
  }
}
