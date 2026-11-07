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
import { MAX_SPEED, RacerId, racerIds, RacerState, TRACK_LENGTH } from './race';
/** Everything the scene needs to know per frame; the page owns the race, this only draws it. */
export interface WorldFrame {
  readonly racers: readonly RacerState[];
  readonly running: boolean;
  readonly stumbling: boolean;
  readonly rainbow: boolean;
  readonly finished: boolean;
}
/** World metres per track unit. */
const UNIT = 1.1;
const FINISH_Z = -TRACK_LENGTH * UNIT;
const LANE_WIDTH = 1.8;
/** Lane order across the track, left to right; Lumi runs second from the left. */
const LANE_X: Readonly<Record<RacerId, number>> = {
  cloud: -2.7,
  player: -0.9,
  mint: 0.9,
  peach: 2.7,
};
const LANE_COLOR: Readonly<Record<RacerId, string>> = {
  cloud: '#dfe9ff',
  player: '#ffd9e8',
  mint: '#d9f6e4',
  peach: '#ffebd1',
};
interface Look {
  coat: string;
  shade: string;
  mane: readonly [string, string, string];
  horn: boolean;
  wings: boolean;
  bow: boolean;
}
const LOOK: Readonly<Record<RacerId, Look>> = {
  player: {
    coat: '#fffdfd',
    shade: '#e7d8ee',
    mane: ['#ff8fb8', '#ffd36b', '#8fd3ff'],
    horn: true,
    wings: false,
    bow: false,
  },
  cloud: {
    coat: '#dccbff',
    shade: '#b9a3ef',
    mane: ['#fdf6ff', '#ead9ff', '#c9b1ff'],
    horn: false,
    wings: true,
    bow: false,
  },
  mint: {
    coat: '#cdf3dd',
    shade: '#9fd9b6',
    mane: ['#ff9ed1', '#ffc3e3', '#ff7bbd'],
    horn: true,
    wings: false,
    bow: false,
  },
  peach: {
    coat: '#ffd8bb',
    shade: '#f0b48e',
    mane: ['#fff0b8', '#ffe58a', '#ffd766'],
    horn: false,
    wings: false,
    bow: true,
  },
};
const RAINBOW = ['#ff6f91', '#ffb347', '#ffe066', '#7ddf9b', '#7cc7ff', '#b79bff'];
const INK = '#26224a';
/** A deterministic pseudo-random so the scenery is the same every race. */
function seeded(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}
function lambert(color: string): MeshLambertMaterial {
  return new MeshLambertMaterial({ color });
}
function box(w: number, h: number, d: number, material: MeshLambertMaterial): Mesh {
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
function makePony(id: RacerId): Pony {
  const look = LOOK[id];
  const coat = lambert(look.coat);
  const shade = lambert(look.shade);
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
  const eyeMaterial = lambert(INK);
  for (const side of [-1, 1]) {
    const eye = new Mesh(new SphereGeometry(0.045, 8, 6), eyeMaterial);
    eye.position.set(side * 0.17, 1.7, -0.86);
    body.add(eye);
    const ear = new Mesh(new ConeGeometry(0.07, 0.2, 6), coat);
    ear.position.set(side * 0.12, 1.9, -0.62);
    body.add(ear);
  }
  if (look.horn) {
    const horn = new Mesh(new ConeGeometry(0.06, 0.4, 8), lambert('#ffd54a'));
    horn.position.set(0, 1.98, -0.8);
    horn.rotation.x = -0.35;
    body.add(horn);
  }
  if (look.wings) {
    const wingMaterial = lambert('#fdf6ff');
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
  const maneMaterials = look.mane.map(lambert);
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
  const hoof = lambert(INK);
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
  private frame: WorldFrame = {
    racers: [],
    running: false,
    stumbling: false,
    rainbow: false,
    finished: false,
  };
  private readonly eye = new Vector3();
  private handle = 0;
  private last = 0;
  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly host: HTMLElement,
  ) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.scene.background = new Color('#e6e1ff');
    this.scene.fog = new Fog('#e6e1ff', 28, 95);
    this.camera = new PerspectiveCamera(58, 1, 0.1, 180);
    this.camera.position.set(0.4, 4.3, 8.5);
    this.buildWorld();
    this.ponies = racerIds.map(makePony);
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
    this.scene.add(new HemisphereLight('#ffffff', '#cfe8d4', 1.6));
    const sun = new DirectionalLight('#fff4e0', 2.2);
    sun.position.set(6, 12, 4);
    this.scene.add(sun);
    const length = TRACK_LENGTH * UNIT + 40;
    const meadow = new Mesh(new PlaneGeometry(140, length + 80), lambert('#cfeedd'));
    meadow.rotation.x = -Math.PI / 2;
    meadow.position.set(0, -0.02, FINISH_Z / 2 - 10);
    this.scene.add(meadow);
    for (const id of racerIds) {
      const lane = new Mesh(new PlaneGeometry(LANE_WIDTH, length), lambert(LANE_COLOR[id]));
      lane.rotation.x = -Math.PI / 2;
      lane.position.set(LANE_X[id], 0, FINISH_Z / 2 - 2);
      this.scene.add(lane);
    }
    const line = lambert('#ffffff');
    for (const x of [-1.8, 0, 1.8]) {
      const divider = box(0.06, 0.02, length, line);
      divider.position.set(x, 0.01, FINISH_Z / 2 - 2);
      this.scene.add(divider);
    }
    const curb = lambert('#ff9fc6');
    for (const x of [-3.7, 3.7]) {
      const edge = box(0.2, 0.12, length, curb);
      edge.position.set(x, 0.06, FINISH_Z / 2 - 2);
      this.scene.add(edge);
    }
    for (const z of [0, FINISH_Z]) {
      const stripe = box(7.4, 0.03, 0.5, line);
      stripe.position.set(0, 0.015, z);
      this.scene.add(stripe);
    }
    const checks = lambert(INK);
    for (let i = 0; i < 12; i++) {
      const square = box(0.6, 0.035, 0.25, checks);
      square.position.set(-3.4 + i * 0.62, 0.02, FINISH_Z + (i % 2 ? 0.12 : -0.12));
      this.scene.add(square);
    }
    RAINBOW.forEach((color, index) => {
      const arc = new Mesh(
        new TorusGeometry(5.6 - index * 0.32, 0.16, 8, 40, Math.PI),
        lambert(color),
      );
      arc.position.set(0, 0, FINISH_Z - 0.6);
      this.scene.add(arc);
    });
    this.scene.add(this.buildCastle());
    const random = seeded(7);
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
    const hillMaterial = lambert('#bfe3c6');
    for (let i = 0; i < 8; i++) {
      const hill = new Mesh(new SphereGeometry(10 + random() * 8, 14, 10), hillMaterial);
      const side = i % 2 ? 1 : -1;
      hill.scale.y = 0.3;
      hill.position.set(side * (20 + random() * 10), 0, 4 - random() * (length + 10));
      this.scene.add(hill);
    }
    const petals = ['#ff8fb8', '#ffd36b', '#ffffff', '#b79bff'].map(lambert);
    const stem = lambert('#8fd49c');
    for (let i = 0; i < 90; i++) {
      const flower = new Group();
      const stalk = new Mesh(new CylinderGeometry(0.03, 0.03, 0.3, 5), stem);
      stalk.position.y = 0.15;
      flower.add(stalk);
      const head = new Mesh(new SphereGeometry(0.14, 7, 6), petals[i % petals.length]);
      head.position.y = 0.32;
      flower.add(head);
      const side = i % 2 ? 1 : -1;
      flower.position.set(side * (4.4 + random() * 5), 0, 6 - random() * (length - 4));
      this.scene.add(flower);
    }
    const sun2 = new Mesh(
      new SphereGeometry(3.5, 16, 12),
      new MeshBasicMaterial({ color: '#ffe27a' }),
    );
    sun2.position.set(22, 24, FINISH_Z - 50);
    this.scene.add(sun2);
  }
  private buildCastle(): Group {
    const castle = new Group();
    const wall = lambert('#efe4ff');
    const roof = lambert('#ff8fb8');
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
    castle.position.set(0, 0, FINISH_Z - 14);
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
    const { racers, running, stumbling, rainbow, finished } = this.frame;
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
      pony.body.position.y = bob;
      pony.root.position.z = pony.shownZ;
      pony.tag.visible = !finished || state?.finishedAt === undefined;
      if (isPlayer) {
        playerZ = pony.shownZ;
        playerSpeed = velocity;
      }
    }
    this.trail.visible = rainbow && running;
    if (this.trail.visible) {
      const stretch = 0.6 + Math.min(1, playerSpeed / MAX_SPEED);
      this.trail.scale.z = stretch;
      this.trail.position.y = Math.sin(now * 6) * 0.05;
    }
    const lookZ = Math.max(FINISH_Z - 6, playerZ - 9);
    const camZ = Math.min(9, playerZ + 8.5);
    this.camera.position.lerp(this.eye.set(0.4, 4.3, camZ), Math.min(1, dt * 6));
    this.camera.lookAt(0, 0.9, lookZ);
  }
}
