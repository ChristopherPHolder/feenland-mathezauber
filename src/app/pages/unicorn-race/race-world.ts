import {
  BoxGeometry,
  CanvasTexture,
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
import type { RaceCup, Sky } from './race-questions';
import type { Outfit } from './race-store';
import { Pony, RAINBOW } from './race-pony';
/** Everything the scene needs to know per frame; the page owns the race, this only draws it. */
export interface WorldFrame {
  readonly racers: readonly RacerState[];
  readonly running: boolean;
  readonly stumbling: boolean;
  readonly rainbow: boolean;
  readonly finished: boolean;
  /** Finished in first place: the castle lets off fireworks. */
  readonly won: boolean;
  /** Counts right answers; each new one bursts sparkles around Lumi. */
  readonly pulse: number;
  /** Counts stumbles; each new one kicks up dust. */
  readonly stumbles: number;
}
/** What a world is built for: which cup's scenery, how long the track is, who lines up. */
export interface Course {
  readonly cup: RaceCup;
  readonly length: number;
  readonly racers: readonly RacerId[];
  /** What Lumi wears, earned by completing a cup. */
  readonly outfit: Outfit | null;
  /** Later heats run at dusk and at night. */
  readonly sky: Sky;
}
/** How far the sky, ground and light are pulled toward night per heat. */
const DUSK: Readonly<Record<Sky, number>> = { day: 0, dusk: 0.35, night: 0.62 };
const NIGHT = new Color('#2a2458');
function shade(hex: string, amount: number): Color {
  return new Color(hex).lerp(NIGHT, amount);
}
/** World metres per track unit. */
const UNIT = 1.1;
const SUN_OFFSET = new Vector3(5, 12, 5);
/** Rivals further than this from Lumi no longer pull the camera round. */
const PACK_REACH = 12;
/** The camera circles a point a little left of the middle lanes, nearer Lumi's lane. */
const CAMERA_X = -0.3;
/** Tangent of half the vertical field of view: from a 46 to a 68 degree lens. */
const LENS_MIN = 0.424;
const LENS_MAX = 0.675;
function smooth(value: number): number {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}
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
/** A pony on the track, with its name tag and where the scene is showing it. */
interface Runner {
  readonly id: RacerId;
  readonly pony: Pony;
  readonly tag: Sprite;
  shownZ: number;
}
/** A floating name pill drawn onto a small canvas. */
function makeTag(name: string): Sprite {
  const sprite = new Sprite(new SpriteMaterial({ depthTest: false, transparent: true }));
  sprite.scale.set(1.26, 0.42, 1);
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
  private readonly runners: readonly Runner[];
  private readonly sun = new DirectionalLight();
  private readonly trail: Group;
  private readonly observer: ResizeObserver;
  private readonly theme: Theme;
  private readonly finishZ: number;
  private readonly twinkles: Mesh[] = [];
  private readonly bursts: { group: Group; born: number; life: number; speed: number }[] = [];
  private readonly sparkMaterials = RAINBOW.map((color) => new MeshBasicMaterial({ color }));
  private readonly goldMaterial = new MeshBasicMaterial({ color: '#ffe27a' });
  private readonly dustMaterial = new MeshBasicMaterial({
    color: '#f3eadf',
    transparent: true,
    opacity: 0.85,
  });
  private readonly speedLines: Mesh[] = [];
  private readonly dizzy: Mesh[] = [];
  private nextFirework = 0;
  private seenPulse = 0;
  private seenStumbles = 0;
  /** The first frame only syncs the counters, so a rebuilt world does not replay old answers. */
  private synced = false;
  private lineUntil = 0;
  private shakeUntil = 0;
  private readonly dusk: number;
  private frame: WorldFrame = {
    racers: [],
    running: false,
    stumbling: false,
    rainbow: false,
    finished: false,
    won: false,
    pulse: 0,
    stumbles: 0,
  };
  /** The camera's place round Lumi, eased toward where frameShot wants it. */
  private orbit = 0;
  private reach = 6;
  private height = 3;
  private lookZ = -5;
  private framed = false;
  /** The field of view that fits the lanes into this scene, and how far to step back if it cannot. */
  private fov = 58;
  private stepBack = 1;
  private handle = 0;
  private last = 0;
  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly host: HTMLElement,
    private readonly course: Course,
  ) {
    this.theme = THEME[course.cup];
    this.dusk = course.cup === 'star' ? 0 : DUSK[course.sky];
    this.finishZ = -course.length * UNIT;
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    const sky = shade(this.theme.sky, this.dusk);
    this.scene.background = sky;
    this.scene.fog = new Fog(sky, ...this.theme.fog);
    this.camera = new PerspectiveCamera(58, 1, 0.1, 180);
    this.buildWorld();
    this.runners = course.racers.map((id) => {
      const pony = new Pony(id, id === 'player' ? course.outfit : null);
      pony.root.position.x = LANE_X[id];
      const tag = makeTag('');
      tag.position.set(0, 2.7, -0.5);
      pony.root.add(tag);
      this.scene.add(pony.root);
      return { id, pony, tag, shownZ: 0 };
    });
    this.trail = this.buildTrail();
    const lumi = this.runners.find((runner) => runner.id === 'player')!.pony;
    lumi.root.add(this.trail);
    for (const side of [-1, 1])
      for (const row of [0, 1]) {
        // Streaks that start behind the tail, so they never cut across the pony from the side.
        const line = new Mesh(
          new BoxGeometry(0.05, 0.05, 1.6).translate(0, 0, 0.8),
          new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8 }),
        );
        line.position.set(side * (0.55 + row * 0.25), 0.8 + row * 0.5, 1.5);
        line.visible = false;
        lumi.root.add(line);
        this.speedLines.push(line);
      }
    for (let i = 0; i < 3; i++) {
      const star = new Mesh(new SphereGeometry(0.07, 6, 5), this.goldMaterial);
      star.visible = false;
      lumi.root.add(star);
      this.dizzy.push(star);
    }
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.resize();
    this.handle = requestAnimationFrame((time) => this.loop(time));
  }
  setFrame(frame: WorldFrame) {
    this.frame = frame;
  }
  setNames(names: Readonly<Record<RacerId, string>>) {
    for (const runner of this.runners) paintTag(runner.tag, names[runner.id]);
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
    const aspect = width / height;
    this.camera.aspect = aspect;
    // Fit every lane across the picture at Lumi's distance: widen the lens on a narrow scene,
    // and step back once it is as wide as looks natural.
    const lanes = this.course.racers.length === 2 ? 2.7 : 4.2;
    const wanted = lanes / 6.4 / aspect;
    const lens = Math.max(LENS_MIN, Math.min(LENS_MAX, wanted));
    this.stepBack = Math.max(1, wanted / lens);
    this.fov = (Math.atan(lens) * 360) / Math.PI;
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();
  }
  private buildWorld() {
    const theme = this.theme;
    const finishZ = this.finishZ;
    const dim = 1 - this.dusk * 0.45;
    this.scene.add(
      new HemisphereLight(theme.hemisphere[0], theme.hemisphere[1], theme.hemisphere[2] * dim),
    );
    // The sun follows Lumi so the ponies near her always cast a crisp shadow on the lanes.
    const sun = this.sun;
    sun.color.set(theme.sun[0]);
    sun.intensity = theme.sun[1] * dim;
    sun.position.copy(SUN_OFFSET);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -9;
    sun.shadow.camera.right = 9;
    sun.shadow.camera.top = 12;
    sun.shadow.camera.bottom = -12;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 40;
    sun.shadow.bias = -0.0005;
    sun.shadow.radius = 4;
    this.scene.add(sun, sun.target);
    const length = this.course.length * UNIT + 40;
    const meadow = new Mesh(
      new PlaneGeometry(140, length + 80),
      new MeshLambertMaterial({ color: shade(theme.ground, this.dusk * 0.6) }),
    );
    meadow.rotation.x = -Math.PI / 2;
    meadow.position.set(0, -0.02, finishZ / 2 - 10);
    meadow.receiveShadow = true;
    this.scene.add(meadow);
    for (const id of this.course.racers) {
      const lane = new Mesh(new PlaneGeometry(LANE_WIDTH, length), lambert(theme.lane[id]));
      lane.rotation.x = -Math.PI / 2;
      lane.position.set(LANE_X[id], 0, finishZ / 2 - 2);
      lane.receiveShadow = true;
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
    const hillMaterial = new MeshLambertMaterial({ color: shade(theme.hills, this.dusk * 0.6) });
    for (let i = 0; i < 10; i++) {
      const hill = new Mesh(new SphereGeometry(10 + random() * 8, 14, 10), hillMaterial);
      const side = i % 2 ? 1 : -1;
      hill.scale.y = theme.decor === 'clouds' ? 0.45 : 0.3;
      hill.position.set(side * (20 + random() * 10), 0, 4 - random() * (length + 10));
      this.scene.add(hill);
    }
    this.buildDecor(random, length);
    const moon = theme.orb.moon || this.dusk > 0.5;
    const orb = new Mesh(
      new SphereGeometry(moon ? 2.8 : 3.5, 16, 12),
      new MeshBasicMaterial({ color: moon ? '#fff4c2' : theme.orb.color }),
    );
    orb.position.set(moon ? -18 : 22 - this.dusk * 30, 24 - this.dusk * 14, finishZ - 50);
    this.scene.add(orb);
    // Dusk brings the first stars out; night fills the sky with them.
    if (this.dusk > 0 && theme.decor !== 'stars') {
      const glow = new MeshBasicMaterial({ color: '#fff4c2' });
      for (let i = 0; i < Math.round(this.dusk * 90); i++) {
        const star = new Mesh(new SphereGeometry(0.08 + random() * 0.1, 6, 5), glow);
        star.position.set(
          (random() < 0.5 ? -1 : 1) * (3 + random() * 30),
          6 + random() * 16,
          6 - random() * (length - 4),
        );
        this.scene.add(star);
        this.twinkles.push(star);
      }
    }
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
    if ((this.theme.decor !== 'flowers' && this.theme.decor !== 'clouds') || this.dusk > 0) {
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
    const { racers, running, stumbling, rainbow, finished, won, pulse, stumbles } = this.frame;
    let playerZ = 0;
    let playerSpeed = 0;
    const lumi = this.runners.find((runner) => runner.id === 'player')!;
    if (!this.synced) {
      this.synced = true;
      this.seenPulse = pulse;
      this.seenStumbles = stumbles;
    }
    if (pulse !== this.seenPulse) {
      // A right answer: a puff of gold and pink sparkles and a moment of speed lines.
      // The sparkles travel with Lumi, so they stay round her at a gallop.
      this.burst(
        new Vector3(0, 1.4, -0.2),
        [this.goldMaterial, this.sparkMaterials[0], this.sparkMaterials[4]],
        18,
        0.7,
        3,
        0.13,
        lumi.pony.root,
      );
      this.lineUntil = now + 0.5;
      this.seenPulse = pulse;
    }
    if (stumbles !== this.seenStumbles) {
      this.burst(
        new Vector3(lumi.pony.root.position.x, 0.2, lumi.shownZ - 0.5),
        [this.dustMaterial],
        12,
        0.9,
        1.4,
        0.24,
      );
      this.shakeUntil = now + 0.45;
      this.seenStumbles = stumbles;
    }
    for (const runner of this.runners) {
      const state = racers.find((racer) => racer.id === runner.id);
      const targetZ = -(state?.position ?? 0) * UNIT;
      const previous = runner.shownZ;
      runner.shownZ += (targetZ - runner.shownZ) * Math.min(1, dt * 7);
      const velocity = dt > 0 ? (previous - runner.shownZ) / dt / UNIT : 0;
      const done = state?.finishedAt !== undefined;
      const isPlayer = runner.id === 'player';
      runner.pony.update({
        now,
        dt,
        speed: velocity,
        moving: running && !done && velocity > 0.05,
        waiting: !running && !finished && !done,
        stumbling: isPlayer && stumbling,
        celebrating: isPlayer && finished && won,
      });
      runner.pony.root.position.z = runner.shownZ;
      runner.tag.visible = !finished || !done;
      if (isPlayer) {
        playerZ = runner.shownZ;
        playerSpeed = velocity;
      }
    }
    this.sun.position.set(SUN_OFFSET.x, SUN_OFFSET.y, playerZ + SUN_OFFSET.z);
    this.sun.target.position.set(0, 0, playerZ - 3);
    for (let i = 0; i < this.twinkles.length; i++) {
      const scale = 0.8 + 0.4 * Math.abs(Math.sin(now * 2 + i));
      this.twinkles[i].scale.setScalar(scale);
    }
    const lines = now < this.lineUntil && running;
    for (const line of this.speedLines) {
      line.visible = lines;
      if (lines) line.scale.z = 0.6 + Math.min(1.4, playerSpeed / MAX_SPEED) * 1.5;
    }
    const dizzyNow = stumbling && running;
    this.dizzy.forEach((star, index) => {
      star.visible = dizzyNow;
      if (dizzyNow) {
        const angle = now * 6 + (index * Math.PI * 2) / 3;
        star.position.set(
          Math.cos(angle) * 0.32,
          1.75 + Math.sin(now * 8) * 0.04,
          -1.3 + Math.sin(angle) * 0.32,
        );
      }
    });
    this.trail.visible = rainbow && running;
    if (this.trail.visible) {
      const stretch = 0.6 + Math.min(1, playerSpeed / MAX_SPEED);
      this.trail.scale.z = stretch;
      this.trail.position.y = Math.sin(now * 6) * 0.05;
      this.trail.children.forEach((ribbon, index) => {
        ribbon.position.y = 1.1 - index * 0.04 + Math.sin(now * 9 + index * 0.9) * 0.06;
      });
    }
    if (finished && won) this.celebrate(now);
    this.tickBursts(now, dt);
    this.frameShot(dt, now, playerZ, playerSpeed);
  }
  /**
   * Where the camera stands. It circles Lumi to keep the nearest ponies in the picture: in
   * front of the whole line-up before the start, behind her while there is someone to catch,
   * and round to her side and front once she leads, looking back at the ponies chasing her.
   */
  private frameShot(dt: number, now: number, playerZ: number, playerSpeed: number) {
    const { running, finished } = this.frame;
    // Where the rivals are from Lumi, the near ones counting most: above zero, they are behind.
    let pack = 0;
    let weights = 0;
    for (const runner of this.runners) {
      if (runner.id === 'player') continue;
      const gap = runner.shownZ - playerZ;
      const weight = 1 / (1 + Math.abs(gap) / 6);
      pack += Math.max(-PACK_REACH, Math.min(PACK_REACH, gap)) * weight;
      weights += weight;
    }
    pack = weights ? pack / weights : 0;
    let orbit: number;
    let reach: number;
    let height: number;
    let lookZ: number;
    if (!running && !finished) {
      // The line-up, seen from in front so every face shows.
      orbit = 2.45;
      reach = 8.2;
      height = 2.1;
      lookZ = -0.2;
    } else if (finished) {
      // Back behind Lumi for the rainbow, the castle and the fireworks.
      orbit = 0.3;
      reach = 6.4;
      height = 2.9;
      lookZ = -6;
    } else {
      const turn = smooth((pack + 1.5) / 6.5);
      orbit = 0.12 + turn * 1.8;
      reach = 6 - turn * 0.6;
      height = 3 - turn * 1.2;
      lookZ = -5 + turn * (5.6 + pack * 0.14);
    }
    if (!this.framed) {
      this.framed = true;
      this.orbit = orbit;
      this.reach = reach;
      this.height = height;
      this.lookZ = lookZ;
    }
    const ease = Math.min(1, dt * 1.7);
    this.orbit += (orbit - this.orbit) * ease;
    this.reach += (reach - this.reach) * ease;
    this.height += (height - this.height) * ease;
    this.lookZ += (lookZ - this.lookZ) * ease;
    const span = this.reach * this.stepBack;
    this.camera.position.set(
      CAMERA_X - Math.sin(this.orbit) * span,
      this.height,
      playerZ + Math.cos(this.orbit) * span,
    );
    const shake = now < this.shakeUntil ? (this.shakeUntil - now) * 0.25 : 0;
    if (shake) {
      this.camera.position.x += (Math.random() - 0.5) * shake;
      this.camera.position.y += (Math.random() - 0.5) * shake;
    }
    this.camera.lookAt(0, 1.15, Math.max(this.finishZ - 8, playerZ + this.lookZ));
    // A gallop widens the view a touch, so speed is felt and not just seen.
    const fov = this.fov + Math.min(8, Math.max(0, playerSpeed) * 1.1);
    if (Math.abs(fov - this.camera.fov) > 0.05) {
      this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 3);
      this.camera.updateProjectionMatrix();
    }
  }
  /** A handful of spheres flung out from a point, shrinking as they fall. */
  private burst(
    at: Vector3,
    materials: readonly MeshBasicMaterial[],
    count: number,
    life: number,
    speed: number,
    size: number,
    parent: Object3D = this.scene,
  ) {
    const group = new Group();
    for (let i = 0; i < count; i++) {
      const spark = new Mesh(new SphereGeometry(size, 5, 4), materials[i % materials.length]);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      spark.userData['dir'] = new Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.abs(Math.cos(phi)) + 0.3,
        Math.sin(phi) * Math.sin(theta),
      );
      group.add(spark);
    }
    group.position.copy(at);
    parent.add(group);
    this.bursts.push({ group, born: performance.now() / 1000, life, speed });
  }
  private tickBursts(now: number, dt: number) {
    for (const burst of [...this.bursts]) {
      const age = now - burst.born;
      if (age > burst.life) {
        burst.group.removeFromParent();
        for (const spark of burst.group.children) (spark as Mesh).geometry.dispose();
        this.bursts.splice(this.bursts.indexOf(burst), 1);
        continue;
      }
      for (const spark of burst.group.children) {
        const dir = spark.userData['dir'] as Vector3;
        spark.position.addScaledVector(dir, dt * burst.speed);
        spark.position.y -= dt * age * 1.5;
        spark.scale.setScalar(Math.max(0.1, 1 - age / burst.life));
      }
    }
  }
  /** Bursts of coloured sparks over the castle while the winner is on the line. */
  private celebrate(now: number) {
    if (now < this.nextFirework) return;
    this.nextFirework = now + 0.45;
    const material = this.sparkMaterials[Math.floor(Math.random() * this.sparkMaterials.length)];
    this.burst(
      new Vector3((Math.random() - 0.5) * 12, 8 + Math.random() * 4, this.finishZ - 12),
      [material],
      14,
      1.2,
      4,
      0.12,
    );
  }
}
