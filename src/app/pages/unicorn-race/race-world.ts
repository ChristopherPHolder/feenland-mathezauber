import {
  BoxGeometry,
  CanvasTexture,
  CapsuleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';
import { MAX_SPEED, RacerId, RacerState } from './race';
import type { RaceCup } from './race-questions';
import type { Outfit } from './race-store';
/** Everything the scene needs to know per frame; the page owns the race, this only draws it. */
export interface WorldFrame {
  readonly racers: readonly RacerState[];
  readonly running: boolean;
  readonly stumbling: boolean;
  readonly rainbow: boolean;
  readonly finished: boolean;
  /** Finished in first place: the castle lets off fireworks. */
  readonly won: boolean;
}
/** What a world is built for: which cup's scenery, how long the track is, who lines up. */
export interface Course {
  readonly cup: RaceCup;
  readonly length: number;
  readonly racers: readonly RacerId[];
  /** What Lumi wears, earned by completing a cup. */
  readonly outfit: Outfit | null;
}
/** World metres per track unit. */
const UNIT = 1.1;
const LANE_WIDTH = 1.8;
/** Lane order across the track, left to right; Lumi runs second from the left. */
const LANE_X: Readonly<Record<RacerId, number>> = {
  cloud: -2.7,
  player: -0.9,
  mint: 0.9,
  peach: 2.7,
  storm: 0.9,
  shadow: 0.9,
};
interface Look {
  coat: string;
  shade: string;
  mane: readonly [string, string, string];
  horn: boolean;
  wings: boolean;
  bow: boolean;
  crown: boolean;
  /** Below 1 the pony is see-through, like a shadow. */
  opacity: number;
}
const LOOK: Readonly<Record<RacerId, Look>> = {
  player: {
    coat: '#fffdfd',
    shade: '#e7d8ee',
    mane: ['#ff8fb8', '#ffd36b', '#8fd3ff'],
    horn: true,
    wings: false,
    bow: false,
    crown: false,
    opacity: 1,
  },
  cloud: {
    coat: '#dccbff',
    shade: '#b9a3ef',
    mane: ['#fdf6ff', '#ead9ff', '#c9b1ff'],
    horn: false,
    wings: true,
    bow: false,
    crown: false,
    opacity: 1,
  },
  mint: {
    coat: '#cdf3dd',
    shade: '#9fd9b6',
    mane: ['#ff9ed1', '#ffc3e3', '#ff7bbd'],
    horn: true,
    wings: false,
    bow: false,
    crown: false,
    opacity: 1,
  },
  peach: {
    coat: '#ffd8bb',
    shade: '#f0b48e',
    mane: ['#fff0b8', '#ffe58a', '#ffd766'],
    horn: false,
    wings: false,
    bow: true,
    crown: false,
    opacity: 1,
  },
  storm: {
    coat: '#8f98c4',
    shade: '#6b739e',
    mane: ['#4b3a70', '#6d4a9a', '#3a2f5c'],
    horn: false,
    wings: true,
    bow: false,
    crown: true,
    opacity: 1,
  },
  shadow: {
    coat: '#c9b8ff',
    shade: '#b09cf2',
    mane: ['#e2d6ff', '#d2c2ff', '#efe8ff'],
    horn: true,
    wings: false,
    bow: false,
    crown: false,
    opacity: 0.5,
  },
};
const RAINBOW = ['#ff6f91', '#ffb347', '#ffe066', '#7ddf9b', '#7cc7ff', '#b79bff'];
const INK = '#26224a';
/** Each cup has its own scenery: a meadow, a path above the clouds, a starry night, a sunset. */
interface Theme {
  readonly sky: string;
  readonly fog: readonly [number, number];
  readonly ground: string;
  readonly hills: string;
  readonly lane: Readonly<Record<RacerId, string>>;
  readonly curb: string;
  readonly castleWall: string;
  readonly castleRoof: string;
  readonly hemisphere: readonly [string, string, number];
  readonly sun: readonly [string, number];
  readonly orb: { readonly color: string; readonly moon: boolean };
  readonly decor: 'flowers' | 'clouds' | 'stars' | 'lanterns' | 'rainbows';
}
const THEME: Readonly<Record<RaceCup, Theme>> = {
  meadow: {
    sky: '#e6e1ff',
    fog: [28, 95],
    ground: '#cfeedd',
    hills: '#bfe3c6',
    lane: {
      cloud: '#dfe9ff',
      player: '#ffd9e8',
      mint: '#d9f6e4',
      peach: '#ffebd1',
      storm: '#dfe9ff',
      shadow: '#eee6ff',
    },
    curb: '#ff9fc6',
    castleWall: '#efe4ff',
    castleRoof: '#ff8fb8',
    hemisphere: ['#ffffff', '#cfe8d4', 1.6],
    sun: ['#fff4e0', 2.2],
    orb: { color: '#ffe27a', moon: false },
    decor: 'flowers',
  },
  sky: {
    sky: '#cfe6ff',
    fog: [26, 90],
    ground: '#f4f7ff',
    hills: '#ffffff',
    lane: {
      cloud: '#dbe8ff',
      player: '#ffe0ef',
      mint: '#dcf7ff',
      peach: '#fff1d6',
      storm: '#dbe8ff',
      shadow: '#ece6ff',
    },
    curb: '#8fc9ff',
    castleWall: '#ffffff',
    castleRoof: '#7cc7ff',
    hemisphere: ['#ffffff', '#dbe8ff', 1.7],
    sun: ['#ffffff', 2.0],
    orb: { color: '#ffe27a', moon: false },
    decor: 'clouds',
  },
  star: {
    sky: '#2a2458',
    fog: [30, 100],
    ground: '#443a7d',
    hills: '#362d6b',
    lane: {
      cloud: '#8f84c9',
      player: '#c48fc9',
      mint: '#84bfae',
      peach: '#c9a784',
      storm: '#8f84c9',
      shadow: '#a596d8',
    },
    curb: '#ffd36b',
    castleWall: '#cfc4ff',
    castleRoof: '#ff8fb8',
    hemisphere: ['#a9a1ff', '#2a2458', 1.1],
    sun: ['#d9d4ff', 1.3],
    orb: { color: '#fff4c2', moon: true },
    decor: 'stars',
  },
  castle: {
    sky: '#ffd4b8',
    fog: [26, 95],
    ground: '#ffe3cf',
    hills: '#f2bba5',
    lane: {
      cloud: '#ffd9d0',
      player: '#ffe6bf',
      mint: '#ffd0e6',
      peach: '#fff0cc',
      storm: '#ffd9d0',
      shadow: '#ffe2d8',
    },
    curb: '#ff8fb8',
    castleWall: '#fff1e0',
    castleRoof: '#c0558f',
    hemisphere: ['#fff0d6', '#f7bfa6', 1.5],
    sun: ['#ffb36b', 2.4],
    orb: { color: '#ff9a4d', moon: false },
    decor: 'lanterns',
  },
  rainbow: {
    sky: '#ffe3f1',
    fog: [30, 100],
    ground: '#fff3f8',
    hills: '#ffd1e6',
    lane: {
      cloud: '#e4ddff',
      player: '#ffe0ef',
      mint: '#dcf7ea',
      peach: '#fff2d1',
      storm: '#e4ddff',
      shadow: '#efe6ff',
    },
    curb: '#ffd36b',
    castleWall: '#fff8ff',
    castleRoof: '#b79bff',
    hemisphere: ['#ffffff', '#ffd9ea', 1.7],
    sun: ['#fff4e0', 2.2],
    orb: { color: '#ffe27a', moon: false },
    decor: 'rainbows',
  },
};
/** A deterministic pseudo-random so the scenery is the same every race. */
function seeded(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}
function lambert(color: string, opacity = 1): MeshLambertMaterial {
  return opacity < 1
    ? new MeshLambertMaterial({ color, transparent: true, opacity })
    : new MeshLambertMaterial({ color });
}
function box(w: number, h: number, d: number, material: Material): Mesh {
  return new Mesh(new BoxGeometry(w, h, d), material);
}
interface Pony {
  readonly id: RacerId;
  readonly root: Group;
  readonly body: Group;
  readonly legs: readonly Object3D[];
  readonly tag: Sprite;
  shownZ: number;
  phase: number;
  tilt: number;
}
/** One low-poly pony built from capsules and boxes, facing down the track (-z). */
function makePony(id: RacerId, outfit: Outfit | null = null): Pony {
  const look = LOOK[id];
  const coat = lambert(look.coat, look.opacity);
  const shade = lambert(look.shade, look.opacity);
  const root = new Group();
  const body = new Group();
  root.add(body);
  const torso = new Mesh(new CapsuleGeometry(0.34, 0.8, 4, 12), coat);
  torso.rotation.x = Math.PI / 2;
  torso.position.set(0, 0.95, 0);
  body.add(torso);
  const neck = new Mesh(new CylinderGeometry(0.17, 0.22, 0.6, 10), coat);
  neck.position.set(0, 1.3, -0.5);
  neck.rotation.x = 0.55;
  body.add(neck);
  const head = new Mesh(new CapsuleGeometry(0.2, 0.3, 4, 10), coat);
  head.rotation.x = Math.PI / 2 - 0.25;
  head.position.set(0, 1.62, -0.78);
  body.add(head);
  const muzzle = new Mesh(new SphereGeometry(0.15, 10, 8), shade);
  muzzle.position.set(0, 1.55, -1.05);
  body.add(muzzle);
  const eyeMaterial = lambert(INK, look.opacity);
  for (const side of [-1, 1]) {
    const eye = new Mesh(new SphereGeometry(0.045, 8, 6), eyeMaterial);
    eye.position.set(side * 0.17, 1.7, -0.86);
    body.add(eye);
    const ear = new Mesh(new ConeGeometry(0.07, 0.2, 6), coat);
    ear.position.set(side * 0.12, 1.9, -0.62);
    body.add(ear);
  }
  if (look.horn) {
    const horn = new Mesh(new ConeGeometry(0.06, 0.4, 8), lambert('#ffd54a', look.opacity));
    horn.position.set(0, 1.98, -0.8);
    horn.rotation.x = -0.35;
    body.add(horn);
  }
  if (look.wings) {
    const wingMaterial = lambert(id === 'storm' ? '#b6bde0' : '#fdf6ff');
    for (const side of [-1, 1]) {
      const wing = box(0.55, 0.05, 0.45, wingMaterial);
      wing.position.set(side * 0.5, 1.25, 0.05);
      wing.rotation.z = side * -0.5;
      body.add(wing);
    }
  }
  if (look.bow) {
    const bowMaterial = lambert('#ff6fa6');
    for (const side of [-1, 1]) {
      const loop = new Mesh(new SphereGeometry(0.08, 8, 6), bowMaterial);
      loop.position.set(side * 0.1, 1.95, -0.55);
      body.add(loop);
    }
  }
  if (look.crown) {
    const gold = lambert('#ffd54a');
    const ring = new Mesh(new TorusGeometry(0.16, 0.04, 6, 12), gold);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 2.0, -0.62);
    body.add(ring);
    for (const angle of [0, 2, 4]) {
      const point = new Mesh(new ConeGeometry(0.04, 0.14, 4), gold);
      point.position.set(Math.sin(angle) * 0.14, 2.08, -0.62 + Math.cos(angle) * 0.14);
      body.add(point);
    }
    const key = new Mesh(new TorusGeometry(0.09, 0.03, 6, 10), gold);
    key.position.set(0.42, 1.0, 0.2);
    body.add(key);
    const shaft = box(0.05, 0.28, 0.05, gold);
    shaft.position.set(0.42, 0.78, 0.2);
    body.add(shaft);
  }
  if (outfit) dress(body, outfit);
  const maneMaterials = look.mane.map((color) => lambert(color, look.opacity));
  const manePoints: readonly [number, number][] = [
    [1.92, -0.72],
    [1.78, -0.55],
    [1.6, -0.38],
    [1.42, -0.22],
  ];
  manePoints.forEach(([y, z], index) => {
    const tuft = new Mesh(new SphereGeometry(0.13, 8, 6), maneMaterials[index % 3]);
    tuft.position.set(0, y, z);
    body.add(tuft);
  });
  const tail = new Mesh(new ConeGeometry(0.14, 0.6, 8), maneMaterials[0]);
  tail.position.set(0, 1.0, 0.72);
  tail.rotation.x = -Math.PI / 2 + 0.5;
  body.add(tail);
  const legs: Object3D[] = [];
  const hoof = lambert(INK, look.opacity);
  for (const [x, z] of [
    [-0.2, -0.32],
    [0.2, -0.32],
    [-0.2, 0.32],
    [0.2, 0.32],
  ]) {
    const pivot = new Group();
    pivot.position.set(x, 0.72, z);
    const leg = box(0.15, 0.6, 0.15, coat);
    leg.position.y = -0.3;
    pivot.add(leg);
    const shoe = box(0.17, 0.08, 0.17, hoof);
    shoe.position.y = -0.6;
    pivot.add(shoe);
    body.add(pivot);
    legs.push(pivot);
  }
  const tag = makeTag('');
  tag.position.set(0, 2.55, -0.2);
  root.add(tag);
  root.position.x = LANE_X[id];
  return { id, root, body, legs, tag, shownZ: 0, phase: 0, tilt: 0 };
}
/** The keepsake from a finished cup, worn on top of Lumi's usual look. */
function dress(body: Group, outfit: Outfit) {
  switch (outfit) {
    case 'wreath': {
      const petals = ['#ff8fb8', '#ffd36b', '#ffffff', '#b79bff'].map((c) => lambert(c));
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const flower = new Mesh(new SphereGeometry(0.07, 7, 6), petals[i % 4]);
        flower.position.set(Math.sin(angle) * 0.2, 1.93, -0.72 + Math.cos(angle) * 0.2);
        body.add(flower);
      }
      return;
    }
    case 'wings': {
      const feather = lambert('#ffffff');
      for (const side of [-1, 1]) {
        const wing = box(0.7, 0.05, 0.5, feather);
        wing.position.set(side * 0.55, 1.3, 0.05);
        wing.rotation.z = side * -0.6;
        body.add(wing);
        const tip = box(0.4, 0.04, 0.3, feather);
        tip.position.set(side * 0.95, 1.55, 0.05);
        tip.rotation.z = side * -0.9;
        body.add(tip);
      }
      return;
    }
    case 'tiara': {
      const silver = lambert('#e8e4ff');
      const band = new Mesh(new TorusGeometry(0.17, 0.03, 6, 12, Math.PI), silver);
      band.rotation.set(Math.PI / 2, 0, 0);
      band.position.set(0, 1.98, -0.68);
      body.add(band);
      const star = new MeshBasicMaterial({ color: '#fff4c2' });
      for (const [x, y] of [
        [0, 2.14],
        [-0.12, 2.08],
        [0.12, 2.08],
      ]) {
        const point = new Mesh(new SphereGeometry(0.05, 6, 5), star);
        point.position.set(x, y, -0.62);
        body.add(point);
      }
      return;
    }
    case 'crown': {
      const gold = lambert('#ffd54a');
      const ring = new Mesh(new TorusGeometry(0.17, 0.045, 6, 12), gold);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, 2.0, -0.64);
      body.add(ring);
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2;
        const point = new Mesh(new ConeGeometry(0.045, 0.16, 4), gold);
        point.position.set(Math.sin(angle) * 0.15, 2.09, -0.64 + Math.cos(angle) * 0.15);
        body.add(point);
      }
      const gem = new Mesh(new SphereGeometry(0.05, 6, 5), lambert('#ff6f91'));
      gem.position.set(0, 2.02, -0.82);
      body.add(gem);
      return;
    }
    case 'cape': {
      RAINBOW.forEach((color, index) => {
        const stripe = box(0.12, 0.03, 0.9, lambert(color));
        stripe.position.set(-0.3 + index * 0.12, 1.32, 0.25);
        stripe.rotation.x = -0.25;
        body.add(stripe);
      });
      return;
    }
  }
}
/** A floating name pill drawn onto a small canvas. */
function makeTag(name: string): Sprite {
  const sprite = new Sprite(new SpriteMaterial({ depthTest: false, transparent: true }));
  sprite.scale.set(1.5, 0.5, 1);
  sprite.renderOrder = 10;
  paintTag(sprite, name);
  return sprite;
}
function paintTag(sprite: Sprite, name: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 192;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (!context) return;
  context.fillStyle = 'rgba(255, 255, 255, 0.92)';
  context.beginPath();
  context.roundRect(4, 6, 184, 52, 26);
  context.fill();
  context.fillStyle = INK;
  context.font = '600 30px system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(name, 96, 34);
  const previous = sprite.material.map;
  sprite.material.map = new CanvasTexture(canvas);
  sprite.material.needsUpdate = true;
  previous?.dispose();
}
export class RaceWorld {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera: PerspectiveCamera;
  private readonly ponies: readonly Pony[];
  private readonly trail: Group;
  private readonly observer: ResizeObserver;
  private readonly theme: Theme;
  private readonly finishZ: number;
  private readonly twinkles: Mesh[] = [];
  private readonly fireworks: { group: Group; born: number }[] = [];
  private readonly sparkMaterials = RAINBOW.map((color) => new MeshBasicMaterial({ color }));
  private nextFirework = 0;
  private frame: WorldFrame = {
    racers: [],
    running: false,
    stumbling: false,
    rainbow: false,
    finished: false,
    won: false,
  };
  private readonly eye = new Vector3();
  private handle = 0;
  private last = 0;
  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly host: HTMLElement,
    private readonly course: Course,
  ) {
    this.theme = THEME[course.cup];
    this.finishZ = -course.length * UNIT;
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.scene.background = new Color(this.theme.sky);
    this.scene.fog = new Fog(this.theme.sky, ...this.theme.fog);
    this.camera = new PerspectiveCamera(58, 1, 0.1, 180);
    this.camera.position.set(0.4, 4.3, 8.5);
    this.buildWorld();
    this.ponies = course.racers.map((id) => makePony(id, id === 'player' ? course.outfit : null));
    for (const pony of this.ponies) this.scene.add(pony.root);
    this.trail = this.buildTrail();
    this.ponies.find((pony) => pony.id === 'player')!.root.add(this.trail);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.resize();
    this.handle = requestAnimationFrame((time) => this.loop(time));
  }
  setFrame(frame: WorldFrame) {
    this.frame = frame;
  }
  setNames(names: Readonly<Record<RacerId, string>>) {
    for (const pony of this.ponies) paintTag(pony.tag, names[pony.id]);
  }
  dispose() {
    cancelAnimationFrame(this.handle);
    this.observer.disconnect();
    this.scene.traverse((object) => {
      if (object instanceof Mesh || object instanceof Sprite) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          if ('map' in material && material.map) material.map.dispose();
          material.dispose();
        }
      }
    });
    this.renderer.dispose();
  }
  private resize() {
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
  private buildWorld() {
    const theme = this.theme;
    const finishZ = this.finishZ;
    this.scene.add(new HemisphereLight(...theme.hemisphere));
    const sun = new DirectionalLight(...theme.sun);
    sun.position.set(6, 12, 4);
    this.scene.add(sun);
    const length = this.course.length * UNIT + 40;
    const meadow = new Mesh(new PlaneGeometry(140, length + 80), lambert(theme.ground));
    meadow.rotation.x = -Math.PI / 2;
    meadow.position.set(0, -0.02, finishZ / 2 - 10);
    this.scene.add(meadow);
    for (const id of this.course.racers) {
      const lane = new Mesh(new PlaneGeometry(LANE_WIDTH, length), lambert(theme.lane[id]));
      lane.rotation.x = -Math.PI / 2;
      lane.position.set(LANE_X[id], 0, finishZ / 2 - 2);
      this.scene.add(lane);
    }
    const twoLanes = this.course.racers.length === 2;
    const line = lambert('#ffffff');
    for (const x of twoLanes ? [0] : [-1.8, 0, 1.8]) {
      const divider = box(0.06, 0.02, length, line);
      divider.position.set(x, 0.01, finishZ / 2 - 2);
      this.scene.add(divider);
    }
    const curb = lambert(theme.curb);
    const edge = twoLanes ? 1.9 : 3.7;
    for (const x of [-edge, edge]) {
      const rail = box(0.2, 0.12, length, curb);
      rail.position.set(x, 0.06, finishZ / 2 - 2);
      this.scene.add(rail);
    }
    const width = twoLanes ? 3.8 : 7.4;
    for (const z of [0, finishZ]) {
      const stripe = box(width, 0.03, 0.5, line);
      stripe.position.set(0, 0.015, z);
      this.scene.add(stripe);
    }
    const checks = lambert(INK);
    const squares = twoLanes ? 6 : 12;
    for (let i = 0; i < squares; i++) {
      const square = box(0.6, 0.035, 0.25, checks);
      square.position.set(-width / 2 + 0.3 + i * 0.62, 0.02, finishZ + (i % 2 ? 0.12 : -0.12));
      this.scene.add(square);
    }
    // Distance marks every quarter so the track reads as long.
    const mark = lambert(theme.curb);
    for (const fraction of [0.25, 0.5, 0.75]) {
      for (const x of [-edge - 0.4, edge + 0.4]) {
        const post = box(0.16, 0.9, 0.16, mark);
        post.position.set(x, 0.45, finishZ * fraction);
        this.scene.add(post);
        const bunting = new Mesh(new ConeGeometry(0.18, 0.35, 4), lambert('#ffffff'));
        bunting.position.set(x, 1.05, finishZ * fraction);
        this.scene.add(bunting);
      }
    }
    RAINBOW.forEach((color, index) => {
      const arc = new Mesh(
        new TorusGeometry(5.6 - index * 0.32, 0.16, 8, 40, Math.PI),
        lambert(color),
      );
      arc.position.set(0, 0, finishZ - 0.6);
      this.scene.add(arc);
    });
    this.scene.add(this.buildCastle());
    const random = seeded(7 + this.course.length);
    const cloudMaterial = lambert('#ffffff');
    for (let i = 0; i < 14; i++) {
      const cloud = new Group();
      for (let puff = 0; puff < 3; puff++) {
        const ball = new Mesh(new SphereGeometry(1.1 + random() * 0.6, 10, 8), cloudMaterial);
        ball.position.set(puff * 1.3 - 1.3, random() * 0.4, 0);
        cloud.add(ball);
      }
      const side = i % 2 ? 1 : -1;
      cloud.position.set(
        side * (8 + random() * 14),
        7 + random() * 5,
        6 - random() * (length - 10),
      );
      this.scene.add(cloud);
    }
    const hillMaterial = lambert(theme.hills);
    for (let i = 0; i < 10; i++) {
      const hill = new Mesh(new SphereGeometry(10 + random() * 8, 14, 10), hillMaterial);
      const side = i % 2 ? 1 : -1;
      hill.scale.y = theme.decor === 'clouds' ? 0.45 : 0.3;
      hill.position.set(side * (20 + random() * 10), 0, 4 - random() * (length + 10));
      this.scene.add(hill);
    }
    this.buildDecor(random, length);
    const orb = new Mesh(
      new SphereGeometry(theme.orb.moon ? 2.8 : 3.5, 16, 12),
      new MeshBasicMaterial({ color: theme.orb.color }),
    );
    orb.position.set(theme.orb.moon ? -18 : 22, 24, finishZ - 50);
    this.scene.add(orb);
  }
  /** Trackside life per cup: flowers, cloud puffs, floating stars or glowing lanterns. */
  private buildDecor(random: () => number, length: number) {
    const count = Math.round(length / 3);
    const sideX = () => (random() < 0.5 ? -1 : 1) * (4.4 + random() * 5);
    const alongZ = () => 6 - random() * (length - 4);
    switch (this.theme.decor) {
      case 'flowers': {
        const petals = ['#ff8fb8', '#ffd36b', '#ffffff', '#b79bff'].map((c) => lambert(c));
        const stem = lambert('#8fd49c');
        for (let i = 0; i < count; i++) {
          const flower = new Group();
          const stalk = new Mesh(new CylinderGeometry(0.03, 0.03, 0.3, 5), stem);
          stalk.position.y = 0.15;
          flower.add(stalk);
          const head = new Mesh(new SphereGeometry(0.14, 7, 6), petals[i % petals.length]);
          head.position.y = 0.32;
          flower.add(head);
          flower.position.set(sideX(), 0, alongZ());
          this.scene.add(flower);
        }
        return;
      }
      case 'clouds': {
        const puff = lambert('#ffffff');
        for (let i = 0; i < count / 2; i++) {
          const tuft = new Mesh(new SphereGeometry(0.5 + random() * 0.7, 8, 6), puff);
          tuft.scale.y = 0.5;
          tuft.position.set(sideX(), 0.1, alongZ());
          this.scene.add(tuft);
        }
        return;
      }
      case 'stars': {
        const glow = new MeshBasicMaterial({ color: '#fff4c2' });
        for (let i = 0; i < count; i++) {
          const star = new Mesh(new SphereGeometry(0.08 + random() * 0.1, 6, 5), glow);
          star.position.set(
            (random() < 0.5 ? -1 : 1) * (3 + random() * 30),
            1 + random() * 18,
            alongZ(),
          );
          this.scene.add(star);
          this.twinkles.push(star);
        }
        const lamp = new MeshBasicMaterial({ color: '#ffd36b' });
        for (let i = 0; i < count / 4; i++) {
          const bulb = new Mesh(new SphereGeometry(0.18, 8, 6), lamp);
          bulb.position.set(sideX(), 0.6 + random() * 0.6, alongZ());
          this.scene.add(bulb);
        }
        return;
      }
      case 'rainbows': {
        const petals = ['#ff8fb8', '#ffd36b', '#ffffff', '#b79bff'].map((c) => lambert(c));
        for (let i = 0; i < count / 2; i++) {
          const head = new Mesh(new SphereGeometry(0.16, 7, 6), petals[i % 4]);
          head.position.set(sideX(), 0.2, alongZ());
          this.scene.add(head);
        }
        for (let i = 0; i < Math.max(3, Math.round(length / 60)); i++) {
          const z = -8 - (i * (length - 30)) / Math.max(1, Math.round(length / 60));
          RAINBOW.forEach((color, index) => {
            const arc = new Mesh(
              new TorusGeometry(9 - index * 0.35, 0.18, 8, 36, Math.PI),
              lambert(color),
            );
            arc.position.set(0, 0, z);
            this.scene.add(arc);
          });
        }
        return;
      }
      case 'lanterns': {
        const pole = lambert('#8c5a3c');
        const glow = new MeshBasicMaterial({ color: '#ffb347' });
        for (let i = 0; i < count / 3; i++) {
          const lantern = new Group();
          const post = new Mesh(new CylinderGeometry(0.05, 0.06, 1.6, 6), pole);
          post.position.y = 0.8;
          lantern.add(post);
          const light = new Mesh(new SphereGeometry(0.22, 8, 6), glow);
          light.position.y = 1.7;
          lantern.add(light);
          lantern.position.set(sideX(), 0, alongZ());
          this.scene.add(lantern);
        }
        const bannerColors = ['#ff8fb8', '#ffd36b', '#b79bff'].map((c) => lambert(c));
        for (let i = 0; i < count / 4; i++) {
          const flag = box(0.5, 0.3, 0.04, bannerColors[i % 3]);
          flag.position.set(sideX(), 1.3 + random() * 0.5, alongZ());
          this.scene.add(flag);
        }
        return;
      }
    }
  }
  private buildCastle(): Group {
    const castle = new Group();
    const wall = lambert(this.theme.castleWall);
    const roof = lambert(this.theme.castleRoof);
    const keep = box(5, 6, 3.5, wall);
    keep.position.y = 3;
    castle.add(keep);
    const keepRoof = new Mesh(new ConeGeometry(3.4, 2.6, 4), roof);
    keepRoof.position.y = 7.3;
    keepRoof.rotation.y = Math.PI / 4;
    castle.add(keepRoof);
    for (const x of [-4.2, 4.2]) {
      const tower = new Mesh(new CylinderGeometry(1.3, 1.3, 7, 12), wall);
      tower.position.set(x, 3.5, 0.5);
      castle.add(tower);
      const cap = new Mesh(new ConeGeometry(1.6, 2.4, 12), roof);
      cap.position.set(x, 8.2, 0.5);
      castle.add(cap);
      const pole = new Mesh(new CylinderGeometry(0.04, 0.04, 1.4, 5), lambert('#ffd54a'));
      pole.position.set(x, 10, 0.5);
      castle.add(pole);
      const flag = box(0.7, 0.4, 0.04, lambert('#ff6fa6'));
      flag.position.set(x + 0.35, 10.4, 0.5);
      castle.add(flag);
    }
    if (this.theme.decor !== 'flowers' && this.theme.decor !== 'clouds') {
      const window = new MeshBasicMaterial({ color: '#ffe27a' });
      for (const [x, y] of [
        [-1.4, 3.2],
        [1.4, 3.2],
        [0, 4.8],
      ]) {
        const pane = box(0.6, 0.8, 0.1, window);
        pane.position.set(x, y, 1.78);
        castle.add(pane);
      }
    }
    const gate = new Mesh(
      new CylinderGeometry(1, 1, 0.4, 12, 1, false, 0, Math.PI),
      lambert('#b98cd9'),
    );
    gate.rotation.set(Math.PI / 2, 0, 0);
    gate.position.set(0, 1, 1.75);
    castle.add(gate);
    const door = box(2, 1.2, 0.3, lambert('#b98cd9'));
    door.position.set(0, 0.6, 1.75);
    castle.add(door);
    castle.position.set(0, 0, this.finishZ - 14);
    return castle;
  }
  /** Six colored ribbons that stream behind Lumi on a rainbow streak. */
  private buildTrail(): Group {
    const trail = new Group();
    RAINBOW.forEach((color, index) => {
      const ribbon = new Mesh(
        new BoxGeometry(0.1, 0.05, 2.6),
        new MeshBasicMaterial({ color, transparent: true, opacity: 0.85 }),
      );
      ribbon.position.set(-0.3 + index * 0.12, 1.1 - index * 0.04, 2);
      trail.add(ribbon);
    });
    trail.visible = false;
    return trail;
  }
  private loop(time: number) {
    this.handle = requestAnimationFrame((next) => this.loop(next));
    const dt = this.last ? Math.min(0.1, (time - this.last) / 1000) : 0.016;
    this.last = time;
    this.animate(dt, time / 1000);
    this.renderer.render(this.scene, this.camera);
  }
  private animate(dt: number, now: number) {
    const { racers, running, stumbling, rainbow, finished, won } = this.frame;
    let playerZ = 0;
    let playerSpeed = 0;
    for (const pony of this.ponies) {
      const state = racers.find((racer) => racer.id === pony.id);
      const targetZ = -(state?.position ?? 0) * UNIT;
      const previous = pony.shownZ;
      pony.shownZ += (targetZ - pony.shownZ) * Math.min(1, dt * 7);
      const velocity = dt > 0 ? (previous - pony.shownZ) / dt / UNIT : 0;
      const moving = running && state?.finishedAt === undefined && velocity > 0.05;
      const stride = moving ? velocity : 0;
      pony.phase += stride * dt * 2.4;
      const swing = Math.sin(pony.phase) * Math.min(0.7, 0.25 + stride * 0.08);
      pony.legs[0].rotation.x = swing;
      pony.legs[3].rotation.x = swing;
      pony.legs[1].rotation.x = -swing;
      pony.legs[2].rotation.x = -swing;
      const bob = moving
        ? Math.abs(Math.sin(pony.phase)) * Math.min(0.1, 0.02 + stride * 0.012)
        : 0;
      const isPlayer = pony.id === 'player';
      const tilt = isPlayer && stumbling ? 0.45 : -Math.min(0.12, stride * 0.02);
      pony.tilt += (tilt - pony.tilt) * Math.min(1, dt * 10);
      pony.body.rotation.x = pony.tilt;
      pony.body.rotation.z = isPlayer && stumbling ? Math.sin(now * 40) * 0.08 : 0;
      pony.body.position.y = pony.id === 'shadow' ? 0.15 + Math.sin(now * 3) * 0.05 : bob;
      pony.root.position.z = pony.shownZ;
      pony.tag.visible = !finished || state?.finishedAt === undefined;
      if (isPlayer) {
        playerZ = pony.shownZ;
        playerSpeed = velocity;
      }
    }
    for (let i = 0; i < this.twinkles.length; i++) {
      const scale = 0.8 + 0.4 * Math.abs(Math.sin(now * 2 + i));
      this.twinkles[i].scale.setScalar(scale);
    }
    this.trail.visible = rainbow && running;
    if (this.trail.visible) {
      const stretch = 0.6 + Math.min(1, playerSpeed / MAX_SPEED);
      this.trail.scale.z = stretch;
      this.trail.position.y = Math.sin(now * 6) * 0.05;
    }
    if (finished && won) this.celebrate(now, dt);
    const lookZ = Math.max(this.finishZ - 6, playerZ - 9);
    const camZ = Math.min(9, playerZ + 8.5);
    this.camera.position.lerp(this.eye.set(0.4, 4.3, camZ), Math.min(1, dt * 6));
    this.camera.lookAt(0, 0.9, lookZ);
    // A gallop widens the view a touch, so speed is felt and not just seen.
    const fov = 58 + Math.min(10, Math.max(0, playerSpeed) * 1.3);
    if (Math.abs(fov - this.camera.fov) > 0.05) {
      this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 3);
      this.camera.updateProjectionMatrix();
    }
  }
  /** Bursts of coloured sparks over the castle while the winner is on the line. */
  private celebrate(now: number, dt: number) {
    if (now >= this.nextFirework) {
      this.nextFirework = now + 0.45;
      const group = new Group();
      const material = this.sparkMaterials[Math.floor(Math.random() * this.sparkMaterials.length)];
      for (let i = 0; i < 14; i++) {
        const spark = new Mesh(new SphereGeometry(0.12, 5, 4), material);
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        spark.userData['dir'] = new Vector3(
          Math.sin(phi) * Math.cos(theta),
          Math.cos(phi),
          Math.sin(phi) * Math.sin(theta),
        );
        group.add(spark);
      }
      group.position.set((Math.random() - 0.5) * 12, 8 + Math.random() * 4, this.finishZ - 12);
      this.scene.add(group);
      this.fireworks.push({ group, born: now });
    }
    for (const firework of [...this.fireworks]) {
      const age = now - firework.born;
      if (age > 1.2) {
        this.scene.remove(firework.group);
        for (const spark of firework.group.children) (spark as Mesh).geometry.dispose();
        this.fireworks.splice(this.fireworks.indexOf(firework), 1);
        continue;
      }
      for (const spark of firework.group.children) {
        const dir = spark.userData['dir'] as Vector3;
        spark.position.addScaledVector(dir, dt * 4);
        spark.position.y -= dt * age * 1.5;
        spark.scale.setScalar(Math.max(0.1, 1 - age / 1.2));
      }
    }
  }
}
