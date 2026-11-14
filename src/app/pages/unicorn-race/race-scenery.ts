import {
  AdditiveBlending,
  BackSide,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  InstancedMesh,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Object3D,
  PlaneGeometry,
  RepeatWrapping,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
} from 'three';
import type { RacerId } from './race';
import type { RaceCup, Sky } from './race-questions';
import { RAINBOW } from './race-pony';
import type { Course } from './race-world';
/** World metres per track unit. */
export const UNIT = 1.1;
export const LANE_WIDTH = 1.8;
/** Lane order across the track, left to right; Lumi runs second from the left. */
export const LANE_X: Readonly<Record<RacerId, number>> = {
  cloud: -2.7,
  player: -0.9,
  mint: 0.9,
  peach: 2.7,
  storm: 0.9,
  shadow: 0.9,
};
export const INK = '#26224a';
/** How far the sky, ground and light are pulled toward night per heat. */
const DUSK: Readonly<Record<Sky, number>> = { day: 0, dusk: 0.35, night: 0.62 };
const NIGHT = new Color('#2a2458');
const DEEP_NIGHT = new Color('#120e33');
function shade(hex: string, amount: number, toward = NIGHT): Color {
  return new Color(hex).lerp(toward, amount);
}
/** What grows beside the track: leafy trees, cloud stacks, glowing crystals or cypresses. */
interface Grove {
  readonly shape: 'round' | 'puff' | 'crystal' | 'cone';
  readonly foliage: readonly string[];
  readonly trunk: string;
}
/** Each cup has its own scenery: a meadow, a path above the clouds, a starry night, a sunset. */
interface Theme {
  /** The sky at the horizon, which is also what distance fades into. */
  readonly sky: string;
  /** The sky straight overhead. */
  readonly zenith: string;
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
  readonly grove: Grove;
}
const THEME: Readonly<Record<RaceCup, Theme>> = {
  meadow: {
    sky: '#f1e9ff',
    zenith: '#9cc4ff',
    fog: [34, 110],
    ground: '#c6ecd2',
    hills: '#aedcb9',
    lane: {
      cloud: '#dfe9ff',
      player: '#ffd9e8',
      mint: '#d9f6e4',
      peach: '#ffebd1',
      storm: '#dfe9ff',
      shadow: '#eee6ff',
    },
    curb: '#ff9fc6',
    castleWall: '#f4ecff',
    castleRoof: '#ff8fb8',
    hemisphere: ['#ffffff', '#cfe8d4', 1.6],
    sun: ['#fff4e0', 2.2],
    orb: { color: '#ffe27a', moon: false },
    decor: 'flowers',
    grove: {
      shape: 'round',
      foliage: ['#93d6a2', '#aee3ad', '#7fcb99', '#ffc4dc'],
      trunk: '#b98d6b',
    },
  },
  sky: {
    sky: '#e6f2ff',
    zenith: '#78b4ff',
    fog: [32, 105],
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
    grove: { shape: 'puff', foliage: ['#ffffff', '#eef4ff', '#dfeaff'], trunk: '#cfe0ff' },
  },
  star: {
    sky: '#3a3178',
    zenith: '#120e33',
    fog: [34, 110],
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
    grove: { shape: 'crystal', foliage: ['#9a8cff', '#c4a8ff', '#7cc7ff', '#ff9ed1'], trunk: '' },
  },
  castle: {
    sky: '#ffd9bd',
    zenith: '#a98bd8',
    fog: [32, 110],
    ground: '#f6dcc0',
    hills: '#e9b39a',
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
    sun: ['#ffc48f', 2.1],
    orb: { color: '#ff9a4d', moon: false },
    decor: 'lanterns',
    grove: { shape: 'cone', foliage: ['#8fb98f', '#7aa883', '#a5c79a'], trunk: '#8c5a3c' },
  },
  rainbow: {
    sky: '#ffe9f4',
    zenith: '#b9a6ff',
    fog: [34, 110],
    ground: '#fff0f6',
    hills: '#ffcfe4',
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
    grove: {
      shape: 'round',
      foliage: ['#ffb3d1', '#ffe08a', '#b9f0c8', '#b5dcff', '#d4c2ff'],
      trunk: '#f0c9a8',
    },
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
function lambert(color: string | Color): MeshLambertMaterial {
  return new MeshLambertMaterial({ color });
}
function box(w: number, h: number, d: number, material: Material): Mesh {
  return new Mesh(new BoxGeometry(w, h, d), material);
}
/** The top half of a disc standing upright and facing down the track, for arches. */
function halfDisc(radius: number, depth: number): BufferGeometry {
  return new CylinderGeometry(radius, radius, depth, 16, 1, false, -Math.PI / 2, Math.PI).rotateX(
    -Math.PI / 2,
  );
}
const BALL = new SphereGeometry(1, 12, 9);
/** Paints a small canvas and wraps it as a colour texture. */
function painted(
  width: number,
  height: number,
  paint: (context: CanvasRenderingContext2D) => void,
): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (context) paint(context);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
/** Many copies of one shape in a single draw call, each with its own place, size and colour. */
function scatter(
  geometry: BufferGeometry,
  material: Material,
  items: readonly { at: Vector3; scale: Vector3; color: Color; turn?: number }[],
): InstancedMesh {
  const mesh = new InstancedMesh(geometry, material, items.length);
  const dummy = new Object3D();
  items.forEach((item, index) => {
    dummy.position.copy(item.at);
    dummy.scale.copy(item.scale);
    dummy.rotation.set(0, item.turn ?? 0, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
    mesh.setColorAt(index, item.color);
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}
/**
 * Everything that stands still: the sky, the ground and lanes, the start gate, the trackside
 * life of each cup, the hills and the castle at the end. The world adds `group` to its scene
 * and calls `update` once a frame for the few things that move.
 */
export class Scenery {
  readonly group = new Group();
  /** The colour distance fades into; the scene background and the fog use it. */
  readonly horizon: Color;
  readonly fog: readonly [number, number];
  /** The sun, which the world keeps over Lumi so the ponies near her cast shadows. */
  readonly sun = new DirectionalLight();
  private readonly theme: Theme;
  private readonly dusk: number;
  private readonly finishZ: number;
  private readonly length: number;
  private readonly twinkles: Mesh[] = [];
  private readonly flags: Object3D[] = [];
  private readonly dome: Mesh;
  constructor(private readonly course: Course) {
    this.theme = THEME[course.cup];
    this.dusk = course.cup === 'star' ? 0 : DUSK[course.sky];
    this.finishZ = -course.length * UNIT;
    this.length = course.length * UNIT + 40;
    this.horizon = shade(this.theme.sky, this.dusk);
    this.fog = this.theme.fog;
    this.dome = this.buildSky();
    this.buildLights();
    this.buildGround();
    this.buildGate();
    this.buildFinish();
    this.group.add(this.buildCastle());
    const random = seeded(7 + course.length);
    this.buildClouds(random);
    this.buildHills(random);
    this.buildGrove(random);
    this.buildDecor(random);
    this.buildHeavens(random);
  }
  /** Keeps the sky centred on the camera and moves the flags and stars. */
  update(now: number, eye: Vector3) {
    this.dome.position.copy(eye);
    for (const [index, star] of this.twinkles.entries())
      star.scale.setScalar(
        (star.userData['size'] as number) * (0.6 + 0.6 * Math.abs(Math.sin(now * 2 + index))),
      );
    for (const [index, flag] of this.flags.entries())
      flag.rotation.y = Math.sin(now * 3.2 + index * 1.7) * 0.35;
  }
  /** A dome that fades from the horizon colour up to the zenith. */
  private buildSky(): Mesh {
    const top = shade(this.theme.zenith, this.dusk * 1.1, DEEP_NIGHT);
    const texture = painted(4, 256, (context) => {
      const fade = context.createLinearGradient(0, 0, 0, 256);
      fade.addColorStop(0, top.getStyle());
      fade.addColorStop(0.22, top.getStyle());
      fade.addColorStop(0.5, this.horizon.getStyle());
      fade.addColorStop(1, this.horizon.getStyle());
      context.fillStyle = fade;
      context.fillRect(0, 0, 4, 256);
    });
    const dome = new Mesh(
      new SphereGeometry(165, 24, 16),
      new MeshBasicMaterial({ map: texture, side: BackSide, fog: false, depthWrite: false }),
    );
    dome.renderOrder = -1;
    this.group.add(dome);
    return dome;
  }
  private buildLights() {
    const theme = this.theme;
    const dim = 1 - this.dusk * 0.45;
    this.group.add(
      new HemisphereLight(theme.hemisphere[0], theme.hemisphere[1], theme.hemisphere[2] * dim),
    );
    const sun = this.sun;
    sun.color.set(theme.sun[0]);
    sun.intensity = theme.sun[1] * dim;
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
    this.group.add(sun, sun.target);
  }
  /** The meadow, the lanes with arrows painted along them, the dividers and the curbs. */
  private buildGround() {
    const theme = this.theme;
    const finishZ = this.finishZ;
    const length = this.length;
    const patches = painted(256, 256, (context) => {
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, 256, 256);
      const random = seeded(31);
      for (let i = 0; i < 46; i++) {
        const x = random() * 256;
        const y = random() * 256;
        const radius = 14 + random() * 34;
        const blot = context.createRadialGradient(x, y, 0, x, y, radius);
        blot.addColorStop(0, `rgba(60, 110, 90, ${0.05 + random() * 0.07})`);
        blot.addColorStop(1, 'rgba(60, 110, 90, 0)');
        context.fillStyle = blot;
        // Draw each blot wrapped round the edges so the texture tiles without seams.
        for (const dx of [-256, 0, 256])
          for (const dy of [-256, 0, 256]) {
            context.setTransform(1, 0, 0, 1, dx, dy);
            context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
          }
        context.setTransform(1, 0, 0, 1, 0, 0);
      }
    });
    patches.wrapS = patches.wrapT = RepeatWrapping;
    patches.repeat.set(25, (length + 120) / 16);
    const meadow = new Mesh(
      new PlaneGeometry(400, length + 120),
      new MeshLambertMaterial({ color: shade(theme.ground, this.dusk * 0.6), map: patches }),
    );
    meadow.rotation.x = -Math.PI / 2;
    meadow.position.set(0, -0.02, finishZ / 2);
    meadow.receiveShadow = true;
    this.group.add(meadow);
    // Arrows down every lane: they slide under the hooves, so speed shows on the ground.
    const arrows = painted(64, 256, (context) => {
      context.fillStyle = '#ececec';
      context.fillRect(0, 0, 64, 256);
      context.fillStyle = '#ffffff';
      context.beginPath();
      context.moveTo(32, 70);
      context.lineTo(54, 118);
      context.lineTo(54, 150);
      context.lineTo(32, 102);
      context.lineTo(10, 150);
      context.lineTo(10, 118);
      context.closePath();
      context.fill();
    });
    arrows.wrapT = RepeatWrapping;
    arrows.repeat.set(1, length / 5);
    for (const id of this.course.racers) {
      const lane = new Mesh(
        new PlaneGeometry(LANE_WIDTH, length),
        new MeshLambertMaterial({ color: theme.lane[id], map: arrows }),
      );
      lane.rotation.x = -Math.PI / 2;
      lane.position.set(LANE_X[id], 0, finishZ / 2 - 2);
      lane.receiveShadow = true;
      this.group.add(lane);
    }
    const line = lambert('#ffffff');
    for (const x of this.twoLanes ? [0] : [-1.8, 0, 1.8]) {
      const divider = box(0.06, 0.02, length, line);
      divider.position.set(x, 0.01, finishZ / 2 - 2);
      this.group.add(divider);
    }
    const curb = lambert(theme.curb);
    for (const x of [-this.edge, this.edge]) {
      const rail = box(0.2, 0.12, length, curb);
      rail.position.set(x, 0.06, finishZ / 2 - 2);
      this.group.add(rail);
    }
    for (const z of [0, finishZ]) {
      const stripe = box(this.edge * 2, 0.03, 0.5, line);
      stripe.position.set(0, 0.015, z);
      this.group.add(stripe);
    }
    // Distance marks every quarter so the track reads as long.
    for (const fraction of [0.25, 0.5, 0.75])
      for (const x of [-this.edge - 0.4, this.edge + 0.4]) {
        const post = box(0.16, 0.9, 0.16, curb);
        post.position.set(x, 0.45, finishZ * fraction);
        this.group.add(post);
        const bunting = new Mesh(new ConeGeometry(0.18, 0.35, 4), line);
        bunting.position.set(x, 1.05, finishZ * fraction);
        this.group.add(bunting);
      }
  }
  private get twoLanes() {
    return this.course.racers.length === 2;
  }
  /** Half the width of the track, out to the curbs. */
  private get edge() {
    return this.twoLanes ? 1.9 : 3.7;
  }
  /** A start gate behind the line: two striped posts, a chequered banner and a row of pennants. */
  private buildGate() {
    const gate = new Group();
    const reach = this.edge + 0.45;
    const post = lambert(this.theme.curb);
    const cap = lambert('#ffd54a');
    for (const side of [-1, 1]) {
      const pole = new Mesh(new CylinderGeometry(0.13, 0.16, 3.9, 10), post);
      pole.position.set(side * reach, 1.95, 0);
      pole.castShadow = true;
      gate.add(pole);
      const ball = new Mesh(new SphereGeometry(0.22, 12, 8), cap);
      ball.position.set(side * reach, 4.0, 0);
      gate.add(ball);
    }
    const squares = this.twoLanes ? 10 : 18;
    const checks = painted(squares * 16, 32, (context) => {
      for (let column = 0; column < squares; column++)
        for (let row = 0; row < 2; row++) {
          context.fillStyle = (column + row) % 2 ? INK : '#ffffff';
          context.fillRect(column * 16, row * 16, 16, 16);
        }
    });
    const banner = new Mesh(
      new BoxGeometry(reach * 2, 0.62, 0.08),
      new MeshLambertMaterial({ map: checks }),
    );
    banner.position.set(0, 3.45, 0);
    gate.add(banner);
    const pennants = this.twoLanes ? 7 : 13;
    for (let index = 0; index < pennants; index++) {
      const pennant = new Mesh(
        new ConeGeometry(0.2, 0.42, 3),
        lambert(RAINBOW[index % RAINBOW.length]),
      );
      pennant.rotation.x = Math.PI;
      pennant.scale.z = 0.25;
      pennant.position.set(-reach + 0.5 + (index * (reach * 2 - 1)) / (pennants - 1), 2.9, 0);
      gate.add(pennant);
    }
    gate.position.z = 1.5;
    this.group.add(gate);
  }
  /** The chequered line and the rainbow arch over it. */
  private buildFinish() {
    const finishZ = this.finishZ;
    const checks = lambert(INK);
    const squares = this.twoLanes ? 6 : 12;
    for (let i = 0; i < squares; i++) {
      const square = box(0.6, 0.035, 0.25, checks);
      square.position.set(-this.edge + 0.3 + i * 0.62, 0.02, finishZ + (i % 2 ? 0.12 : -0.12));
      this.group.add(square);
    }
    RAINBOW.forEach((color, index) => {
      const arc = new Mesh(
        new TorusGeometry(5.6 - index * 0.32, 0.16, 8, 40, Math.PI),
        lambert(color),
      );
      arc.position.set(0, 0, finishZ - 0.6);
      this.group.add(arc);
    });
  }
  /** Bright, soft clouds high over both sides of the track. */
  private buildClouds(random: () => number) {
    // A touch of their own light keeps the undersides from going grey.
    const tint = shade('#ffffff', this.dusk * 0.5);
    const material = new MeshLambertMaterial({
      color: tint,
      emissive: shade(this.theme.decor === 'stars' ? '#5a4f9c' : '#cfd3f2', this.dusk * 0.6),
      emissiveIntensity: 0.6,
    });
    const puffs: { at: Vector3; scale: Vector3; color: Color }[] = [];
    for (let i = 0; i < 18; i++) {
      const side = i % 2 ? 1 : -1;
      const centre = new Vector3(
        side * (13 + random() * 30),
        10 + random() * 9,
        24 - random() * (this.length + 20),
      );
      const size = 1.3 + random() * 1.3;
      const count = 4 + Math.floor(random() * 3);
      for (let puff = 0; puff < count; puff++) {
        const across = (puff - (count - 1) / 2) * size * 0.95;
        const swell = 1 - Math.abs(puff - (count - 1) / 2) / count;
        const radius = size * (0.65 + swell * 0.7);
        puffs.push({
          at: centre.clone().add(new Vector3(across, radius * 0.35, (random() - 0.5) * size)),
          scale: new Vector3(radius, radius * 0.72, radius),
          color: tint,
        });
      }
    }
    this.group.add(scatter(new SphereGeometry(1, 12, 9), material, puffs));
  }
  /** Two ranges of hills: near ones in the cup's colour, far ones fading into the sky. */
  private buildHills(random: () => number) {
    const near = shade(this.theme.hills, this.dusk * 0.6);
    const far = near.clone().lerp(this.horizon, 0.5);
    const geometry = new SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    const squash = this.theme.decor === 'clouds' ? 0.5 : 0.34;
    const hills: { at: Vector3; scale: Vector3; color: Color }[] = [];
    for (let i = 0; i < 16; i++) {
      const side = i % 2 ? 1 : -1;
      const radius = 10 + random() * 9;
      hills.push({
        at: new Vector3(side * (30 + random() * 16), -0.05, 30 - random() * (this.length + 40)),
        scale: new Vector3(radius, radius * squash * (0.8 + random() * 0.5), radius),
        color: near,
      });
    }
    for (let i = 0; i < 12; i++) {
      const side = i % 2 ? 1 : -1;
      const radius = 24 + random() * 16;
      hills.push({
        at: new Vector3(side * (62 + random() * 26), -0.05, 40 - random() * (this.length + 60)),
        scale: new Vector3(radius, radius * (squash + 0.18 + random() * 0.2), radius),
        color: far,
      });
    }
    this.group.add(scatter(geometry, lambert('#ffffff'), hills));
  }
  /**
   * Trees along both sides, far enough out that the camera never stands among them. They
   * pass at different speeds by distance, which is what makes a gallop look fast.
   */
  private buildGrove(random: () => number) {
    const grove = this.theme.grove;
    const dusk = this.dusk * 0.55;
    const trunks: { at: Vector3; scale: Vector3; color: Color; turn?: number }[] = [];
    const crowns: { at: Vector3; scale: Vector3; color: Color; turn?: number }[] = [];
    const trunkColor = grove.trunk ? shade(grove.trunk, dusk) : new Color('#ffffff');
    for (let z = 26; z > this.finishZ - 12; z -= 5.5)
      for (const side of [-1, 1]) {
        if (random() < 0.22) continue;
        const x = side * (10.5 + random() * 11);
        const at = new Vector3(x, 0, z + (random() - 0.5) * 4);
        const size = 0.8 + random() * 0.7;
        const color = shade(grove.foliage[Math.floor(random() * grove.foliage.length)], dusk);
        const turn = random() * Math.PI;
        switch (grove.shape) {
          case 'round':
            trunks.push({
              at: at.clone().setY(size * 0.9),
              scale: new Vector3(size * 0.22, size * 1.8, size * 0.22),
              color: trunkColor,
            });
            for (const [dx, dy, r] of [
              [0, 2.5, 1.25],
              [0.7, 2.0, 0.85],
              [-0.65, 2.1, 0.9],
              [0.1, 3.3, 0.8],
            ])
              crowns.push({
                at: at.clone().add(new Vector3(dx * size, dy * size, (dx * 0.5 - 0.1) * size)),
                scale: new Vector3(r * size, r * size * 0.9, r * size),
                color,
                turn,
              });
            break;
          case 'cone':
            trunks.push({
              at: at.clone().setY(size * 0.5),
              scale: new Vector3(size * 0.2, size, size * 0.2),
              color: trunkColor,
            });
            crowns.push({
              at: at.clone().setY(size * 3.3),
              scale: new Vector3(size * 0.75, size * 5, size * 0.75),
              color,
              turn,
            });
            break;
          case 'puff':
            for (const [dy, r] of [
              [0.6, 1.1],
              [1.7, 0.85],
              [2.6, 0.6],
            ])
              crowns.push({
                at: at.clone().setY(dy * size),
                scale: new Vector3(r * size * 1.2, r * size * 0.8, r * size * 1.2),
                color,
                turn,
              });
            break;
          case 'crystal':
            for (const [dx, tall, wide] of [
              [0, 3.4, 0.5],
              [0.55, 2.1, 0.36],
              [-0.5, 1.6, 0.3],
            ])
              crowns.push({
                at: at.clone().add(new Vector3(dx * size, (tall * size) / 2, 0)),
                scale: new Vector3(wide * size, tall * size, wide * size),
                color,
                turn: turn + dx,
              });
            break;
        }
      }
    if (trunks.length)
      this.group.add(scatter(new CylinderGeometry(0.7, 1, 1, 7), lambert('#ffffff'), trunks));
    const cone = grove.shape === 'cone' || grove.shape === 'crystal';
    const crown = cone ? new ConeGeometry(1, 1, grove.shape === 'crystal' ? 5 : 9) : BALL;
    // Crystals glow in the dark, so they are lit by nothing and shaded by nothing.
    const material =
      grove.shape === 'crystal' ? new MeshBasicMaterial({ color: '#ffffff' }) : lambert('#ffffff');
    this.group.add(scatter(crown, material, crowns));
  }
  /** Trackside life per cup: flowers, cloud puffs, floating stars or glowing lanterns. */
  private buildDecor(random: () => number) {
    const length = this.length;
    const count = Math.round(length / 3);
    const sideX = () => (random() < 0.5 ? -1 : 1) * (4.4 + random() * 5);
    const alongZ = () => 14 - random() * (length - 4);
    const white = lambert('#ffffff');
    const heads: { at: Vector3; scale: Vector3; color: Color }[] = [];
    const flower = (colors: readonly Color[], size: number, height: number) => {
      const at = new Vector3(sideX(), height, alongZ());
      heads.push({
        at,
        scale: new Vector3(size, size, size),
        color: colors[heads.length % colors.length],
      });
      return at;
    };
    switch (this.theme.decor) {
      case 'flowers': {
        const petals = ['#ff8fb8', '#ffd36b', '#ffffff', '#b79bff'].map((c) => new Color(c));
        const stems: { at: Vector3; scale: Vector3; color: Color }[] = [];
        const green = new Color('#8fd49c');
        for (let i = 0; i < count * 1.5; i++) {
          const at = flower(petals, 0.14 + random() * 0.05, 0.34);
          stems.push({
            at: at.clone().setY(0.16),
            scale: new Vector3(0.03, 0.32, 0.03),
            color: green,
          });
        }
        this.group.add(scatter(new CylinderGeometry(1, 1, 1, 5), white, stems));
        break;
      }
      case 'clouds': {
        const puff = new Color('#ffffff');
        for (let i = 0; i < count / 2; i++) {
          const size = 0.5 + random() * 0.7;
          heads.push({
            at: new Vector3(sideX(), 0.1, alongZ()),
            scale: new Vector3(size, size * 0.5, size),
            color: puff,
          });
        }
        break;
      }
      case 'stars': {
        // Stars drifting low beside the track, close enough to rush past.
        const near: { at: Vector3; scale: Vector3; color: Color }[] = [];
        const pale = new Color('#fff4c2');
        for (let i = 0; i < count; i++) {
          const size = 0.08 + random() * 0.1;
          near.push({
            at: new Vector3(
              (random() < 0.5 ? -1 : 1) * (4 + random() * 26),
              1 + random() * 16,
              alongZ(),
            ),
            scale: new Vector3(size, size, size),
            color: pale,
          });
        }
        this.group.add(
          scatter(new SphereGeometry(1, 6, 5), new MeshBasicMaterial({ color: '#ffffff' }), near),
        );
        const lamp = new MeshBasicMaterial({ color: '#ffd36b' });
        for (let i = 0; i < count / 4; i++) {
          const bulb = new Mesh(new SphereGeometry(0.18, 8, 6), lamp);
          bulb.position.set(sideX(), 0.6 + random() * 0.6, alongZ());
          this.group.add(bulb);
        }
        break;
      }
      case 'rainbows': {
        const petals = ['#ff8fb8', '#ffd36b', '#ffffff', '#b79bff'].map((c) => new Color(c));
        for (let i = 0; i < count; i++) flower(petals, 0.16, 0.2);
        const arches = Math.max(3, Math.round(length / 60));
        for (let i = 0; i < arches; i++) {
          const z = -8 - (i * (length - 30)) / arches;
          RAINBOW.forEach((color, index) => {
            const arc = new Mesh(
              new TorusGeometry(9 - index * 0.35, 0.18, 8, 36, Math.PI),
              lambert(color),
            );
            arc.position.set(0, 0, z);
            this.group.add(arc);
          });
        }
        break;
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
          this.group.add(lantern);
        }
        const banners = ['#ff8fb8', '#ffd36b', '#b79bff'].map((c) => lambert(c));
        for (let i = 0; i < count / 4; i++) {
          const flag = box(0.5, 0.3, 0.04, banners[i % 3]);
          flag.position.set(sideX(), 1.3 + random() * 0.5, alongZ());
          this.group.add(flag);
        }
        break;
      }
    }
    if (heads.length) this.group.add(scatter(new SphereGeometry(1, 8, 6), white, heads));
  }
  /** The sun or moon with its glow, and the stars that come out at dusk and at night. */
  private buildHeavens(random: () => number) {
    const theme = this.theme;
    const moon = theme.orb.moon || this.dusk > 0.5;
    const color = moon ? '#fff4c2' : theme.orb.color;
    const at = new Vector3(moon ? -24 : 26 - this.dusk * 34, 30 - this.dusk * 14, -70);
    const orb = new Mesh(
      new SphereGeometry(moon ? 3.2 : 4, 20, 14),
      new MeshBasicMaterial({ color, fog: false }),
    );
    orb.position.copy(at);
    const halo = new Sprite(
      new SpriteMaterial({
        map: painted(128, 128, (context) => {
          const glow = context.createRadialGradient(64, 64, 6, 64, 64, 64);
          glow.addColorStop(0, 'rgba(255, 255, 255, 0.75)');
          glow.addColorStop(0.35, 'rgba(255, 255, 255, 0.25)');
          glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
          context.fillStyle = glow;
          context.fillRect(0, 0, 128, 128);
        }),
        color,
        blending: AdditiveBlending,
        depthWrite: false,
        fog: false,
        opacity: moon ? 0.55 : 0.8,
      }),
    );
    halo.position.copy(at);
    halo.scale.setScalar(moon ? 20 : 30);
    // The sun and moon ride with the sky, always the same way off however long the track is.
    this.dome.add(halo, orb);
    const night = theme.decor === 'stars';
    if (this.dusk <= 0 && !night) return;
    const glow = new MeshBasicMaterial({ color: '#fff4c2', fog: false });
    const stars = night ? 150 : Math.round(this.dusk * 150);
    const geometry = new SphereGeometry(1, 6, 5);
    for (let i = 0; i < stars; i++) {
      const star = new Mesh(geometry, glow);
      // Spread over the upper dome, well clear of the horizon.
      const around = random() * Math.PI * 2;
      const up = 0.12 + random() * 1.1;
      star.position.set(
        Math.cos(around) * Math.cos(up) * 120,
        Math.sin(up) * 120,
        Math.sin(around) * Math.cos(up) * 120,
      );
      star.scale.setScalar(0.28 + random() * 0.4);
      star.userData['size'] = star.scale.x;
      this.dome.add(star);
      if (i % 3 === 0) this.twinkles.push(star);
    }
  }
  /** The rainbow castle: a keep with battlements, five towers, lit windows and flags. */
  private buildCastle(): Group {
    const castle = new Group();
    const theme = this.theme;
    const wall = lambert(theme.castleWall);
    const trim = lambert(new Color(theme.castleWall).multiplyScalar(0.88));
    const roof = lambert(theme.castleRoof);
    const gold = lambert('#ffd54a');
    const lit = (theme.decor !== 'flowers' && theme.decor !== 'clouds') || this.dusk > 0;
    const pane = lit
      ? new MeshBasicMaterial({ color: '#ffe27a' })
      : lambert(new Color(theme.castleRoof).lerp(new Color('#4b3a70'), 0.45));
    const window = (x: number, y: number, z: number, turn = 0) => {
      const frame = new Group();
      const glass = box(0.5, 0.7, 0.08, pane);
      frame.add(glass);
      const arch = new Mesh(halfDisc(0.25, 0.08), pane);
      arch.position.y = 0.35;
      frame.add(arch);
      frame.position.set(x, y, z);
      frame.rotation.y = turn;
      castle.add(frame);
    };
    const battlements = (width: number, y: number, z: number, x = 0) => {
      const teeth = Math.round(width / 0.9);
      for (let i = 0; i < teeth; i++) {
        const tooth = box(0.5, 0.55, 0.5, trim);
        tooth.position.set(x - width / 2 + 0.45 + (i * (width - 0.9)) / (teeth - 1), y, z);
        castle.add(tooth);
      }
    };
    const tower = (x: number, z: number, radius: number, height: number, flagColor: string) => {
      const shaft = new Mesh(new CylinderGeometry(radius, radius * 1.08, height, 16), wall);
      shaft.position.set(x, height / 2, z);
      castle.add(shaft);
      const collar = new Mesh(new CylinderGeometry(radius * 1.2, radius, 0.5, 16), trim);
      collar.position.set(x, height - 0.1, z);
      castle.add(collar);
      const cap = new Mesh(new ConeGeometry(radius * 1.32, radius * 2.3, 16), roof);
      cap.position.set(x, height + 0.15 + radius * 1.15, z);
      castle.add(cap);
      const top = height + 0.15 + radius * 2.3;
      const pole = new Mesh(new CylinderGeometry(0.04, 0.04, 1.5, 5), gold);
      pole.position.set(x, top + 0.6, z);
      castle.add(pole);
      // The flag hangs off a pivot on the pole so it can swing in the wind.
      const pivot = new Group();
      pivot.position.set(x, top + 1.05, z);
      const flag = box(0.9, 0.5, 0.04, lambert(flagColor));
      flag.position.x = 0.47;
      pivot.add(flag);
      castle.add(pivot);
      this.flags.push(pivot);
      window(x, height * 0.72, z + radius * 1.02);
      if (height > 8) window(x, height * 0.45, z + radius * 1.04);
    };
    // The keep, with a gatehouse in front of it.
    const keep = box(6.4, 7, 4, wall);
    keep.position.y = 3.5;
    castle.add(keep);
    battlements(6.4, 7.25, 1.75);
    for (const [x, y] of [
      [-2, 4.3],
      [2, 4.3],
      [0, 5.6],
      [-2, 2.4],
      [2, 2.4],
    ])
      window(x, y, 2.03);
    const gatehouse = box(3.2, 3.4, 1.2, trim);
    gatehouse.position.set(0, 1.7, 2.4);
    castle.add(gatehouse);
    battlements(3.2, 3.65, 2.75);
    const door = lambert('#b98cd9');
    const arch = new Mesh(halfDisc(1, 0.3), door);
    arch.position.set(0, 1.5, 3);
    castle.add(arch);
    const leaf = box(2, 1.5, 0.3, door);
    leaf.position.set(0, 0.75, 3);
    castle.add(leaf);
    // Curtain walls out to the corner towers.
    for (const side of [-1, 1]) {
      const curtain = box(4.4, 3.6, 1, wall);
      curtain.position.set(side * 5.4, 1.8, 0.6);
      castle.add(curtain);
      battlements(4.4, 3.85, 0.85, side * 5.4);
    }
    tower(0, -1.6, 1.9, 12.5, '#ffd36b');
    tower(-3.6, 1.2, 1.35, 9, '#ff6fa6');
    tower(3.6, 1.2, 1.35, 9, '#ff6fa6');
    tower(-7.8, 0.6, 1.15, 6.2, '#7cc7ff');
    tower(7.8, 0.6, 1.15, 6.2, '#7cc7ff');
    castle.position.set(0, 0, this.finishZ - 15);
    return castle;
  }
}
