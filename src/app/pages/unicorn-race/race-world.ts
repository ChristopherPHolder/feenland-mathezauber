import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Fog,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  OctahedronGeometry,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
  WebGLRenderer,
} from 'three';
import { approach, shake } from '../../shared/three/motion';
import { MAX_SPEED, RacerId, RacerState } from './race';
import { Particles } from './race-particles';
import type { RaceCup, Sky } from './race-questions';
import type { Outfit } from './race-store';
import { Pony, RAINBOW } from './race-pony';
import { INK, LANE_X, Scenery, UNIT } from './race-scenery';
/** Everything the scene needs to know per frame; the page owns the race, this only draws it. */
export interface WorldFrame {
  readonly racers: readonly RacerState[];
  readonly running: boolean;
  readonly stumbling: boolean;
  readonly rainbow: boolean;
  readonly finished: boolean;
  /** Finished in first place: the castle lets off fireworks. */
  readonly won: boolean;
  /** Counts right answers; each new one sends Lumi surging forward in a spray of sparkles. */
  readonly pulse: number;
  /** Counts stumbles; each new one trips Lumi onto her knees in a cloud of dust. */
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
const SUN_OFFSET = new Vector3(5, 12, 5);
/** Rivals further than this from Lumi no longer pull the camera round. */
const PACK_REACH = 12;
/** How long the others take to reach the line once Lumi has crossed it, and to turn round. */
const RUN_IN_SECONDS = 2.6;
const TURN_SECONDS = 0.6;
/** The camera circles a point a little left of the middle lanes, nearer Lumi's lane. */
const CAMERA_X = -0.3;
/** Tangent of half the vertical field of view: from a 46 to a 68 degree lens. */
const LENS_MIN = 0.424;
const LENS_MAX = 0.675;
/** The fastest Lumi runs, in metres a second. */
const TOP_SPEED = MAX_SPEED * UNIT;
/** How far the camera may drop behind Lumi when she bursts forward, in metres. */
const MAX_LAG = 1.4;
/** The rainbow trail: six ribbons this long, cut into this many lengths so they can ripple. */
const TRAIL_LENGTH = 2.8;
const TRAIL_STEPS = 16;
/** Seconds a right answer flares the trail. */
const FLARE_SECONDS = 0.9;
/** How far round the camera tries to swing when a pony is in the way, from all to none. */
const SWINGS = [1, 0.65, 0.35, 0];
/** Spots along a pony, chest to rump, that may stand between the camera and Lumi. */
const BODY_SPOTS = [-0.8, 0, 0.8];
function smooth(value: number): number {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}
/** A pony on the track, with its name tag and where the scene is showing it. */
interface Runner {
  readonly id: RacerId;
  readonly pony: Pony;
  readonly tag: Sprite;
  shownZ: number;
  /** How fast it gallops in once the race is decided, in metres a second; 0 until then. */
  runIn: number;
  /** From 0 to 1 as it turns round on the finish line to face the camera. */
  turn: number;
}
/** One ribbon of the rainbow trail, with the flat shape its ripple starts from. */
interface Ribbon {
  readonly mesh: Mesh<BufferGeometry, MeshBasicMaterial>;
  readonly base: Float32Array;
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
/** A flat ribbon along +z that widens from its root, cut into lengths so it can ripple. */
function ribbonGeometry(width: number): BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  for (let step = 0; step <= TRAIL_STEPS; step++) {
    const along = step / TRAIL_STEPS;
    const half = (width / 2) * (0.35 + 0.65 * along);
    positions.push(-half, 0, along * TRAIL_LENGTH, half, 0, along * TRAIL_LENGTH);
    if (step < TRAIL_STEPS) {
      const a = step * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  return geometry;
}
const random = (spread: number) => (Math.random() - 0.5) * spread;
export class RaceWorld {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera: PerspectiveCamera;
  private readonly runners: readonly Runner[];
  private readonly lumi: Runner;
  private readonly scenery: Scenery;
  private readonly trail = new Group();
  private readonly ribbons: Ribbon[] = [];
  private readonly observer: ResizeObserver;
  private readonly motionQuery?: MediaQueryList;
  private readonly finishZ: number;
  private readonly rainbowColors = RAINBOW.map((color) => new Color(color));
  private readonly gold = new Color('#ffe27a');
  /** Sparkles, confetti and fireworks: one pool, one draw call. */
  private readonly sparks = new Particles(
    new OctahedronGeometry(1, 0),
    new MeshBasicMaterial({ color: '#ffffff' }),
    320,
    { gravity: 5, drag: 1.2, swell: false },
  );
  /** Puffs of dust from hooves and stumbles. */
  private readonly dust = new Particles(
    new IcosahedronGeometry(1, 1),
    new MeshLambertMaterial({
      color: '#f6eee4',
      emissive: '#7a6a5c',
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    }),
    120,
    { gravity: -0.4, drag: 3, swell: true },
  );
  private readonly goldMaterial = new MeshBasicMaterial({ color: '#ffe27a' });
  private readonly speedLines: Mesh[] = [];
  private readonly dizzy: Mesh[] = [];
  /** Scratch vectors, reused every frame. */
  private readonly at = new Vector3();
  private readonly carry = new Vector3();
  private readonly lastLumi = new Vector3();
  private readonly still = new Vector3();
  private nextFirework = 0;
  private seenPulse = 0;
  private seenStumbles = 0;
  /** The first frame only syncs the counters, so a rebuilt world does not replay old answers. */
  private synced = false;
  private lineUntil = 0;
  private shakeAt = -10;
  private flareAt = -10;
  private surgeAt = -10;
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
  /** Where the camera follows along the track; it lags a little when Lumi bursts ahead. */
  private followZ = 0;
  /** Lumi's speed, smoothed, for the lens and the lean. */
  private pace = 0;
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
    this.finishZ = -course.length * UNIT;
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.motionQuery = host.ownerDocument.defaultView?.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    );
    this.scenery = new Scenery(course);
    this.scene.background = this.scenery.horizon;
    this.scene.fog = new Fog(this.scenery.horizon, ...this.scenery.fog);
    this.scene.add(this.scenery.group, this.sparks.mesh, this.dust.mesh);
    this.camera = new PerspectiveCamera(58, 1, 0.1, 180);
    this.runners = course.racers.map((id) => {
      const pony = new Pony(id, id === 'player' ? course.outfit : null);
      pony.root.position.x = LANE_X[id];
      const tag = makeTag('');
      tag.position.set(0, 2.7, -0.5);
      pony.root.add(tag);
      this.scene.add(pony.root);
      return { id, pony, tag, shownZ: 0, runIn: 0, turn: 0 };
    });
    this.lumi = this.runners.find((runner) => runner.id === 'player')!;
    const lumi = this.lumi.pony;
    this.buildTrail();
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
    const star = new SphereGeometry(0.07, 6, 5);
    for (let i = 0; i < 3; i++) {
      const mesh = new Mesh(star, this.goldMaterial);
      mesh.visible = false;
      lumi.root.add(mesh);
      this.dizzy.push(mesh);
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
      if (object instanceof InstancedMesh) object.dispose();
    });
    this.renderer.dispose();
  }
  /** True while motion should be kept to what carries meaning. */
  private get calm(): boolean {
    return (
      !!this.motionQuery?.matches ||
      this.host.ownerDocument.documentElement.classList.contains('calm-motion')
    );
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
  /** Six coloured ribbons that stream from Lumi's tail on a rainbow streak, and flare on a right answer. */
  private buildTrail() {
    RAINBOW.forEach((color, index) => {
      const geometry = ribbonGeometry(0.13);
      const mesh = new Mesh(
        geometry,
        new MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.85,
          side: DoubleSide,
          depthWrite: false,
        }),
      );
      mesh.position.set(-0.3 + index * 0.12, 1.22 - index * 0.025, 0.85);
      this.trail.add(mesh);
      this.ribbons.push({
        mesh,
        base: Float32Array.from(geometry.getAttribute('position').array),
      });
    });
    this.trail.visible = false;
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
    const calm = this.calm;
    const lumi = this.lumi;
    if (!this.synced) {
      this.synced = true;
      this.seenPulse = pulse;
      this.seenStumbles = stumbles;
    }
    const answered = pulse !== this.seenPulse;
    const tripped = stumbles !== this.seenStumbles;
    this.seenPulse = pulse;
    this.seenStumbles = stumbles;
    if (answered) {
      lumi.pony.surge(now);
      this.surgeAt = now;
      this.flareAt = now;
      this.lineUntil = now + 0.55;
    }
    if (tripped) {
      lumi.pony.trip(now);
      this.shakeAt = now;
    }
    let playerZ = 0;
    let playerSpeed = 0;
    for (const runner of this.runners) {
      const state = racers.find((racer) => racer.id === runner.id);
      const done = state?.finishedAt !== undefined;
      const isPlayer = runner.id === 'player';
      const previous = runner.shownZ;
      let onLine = finished && done;
      if (finished && !done) {
        // The race is decided, but the others still gallop in and take their place on the line.
        if (!runner.runIn)
          runner.runIn = Math.max(6, (runner.shownZ - this.finishZ) / RUN_IN_SECONDS);
        runner.shownZ = Math.max(this.finishZ, runner.shownZ - runner.runIn * dt);
        onLine = runner.shownZ <= this.finishZ + 0.01;
      } else {
        runner.runIn = 0;
        const targetZ = -(state?.position ?? 0) * UNIT;
        runner.shownZ += (targetZ - runner.shownZ) * Math.min(1, dt * 7);
      }
      const velocity = dt > 0 ? (previous - runner.shownZ) / dt : 0;
      // On the line each pony turns round to face us, and then shows how it feels.
      runner.turn = onLine ? Math.min(1, runner.turn + dt / TURN_SECONDS) : 0;
      const turning = runner.turn > 0 && runner.turn < 1;
      const root = runner.pony.root;
      const facing = Math.atan2(
        root.position.x - this.camera.position.x,
        runner.shownZ - this.camera.position.z,
      );
      root.rotation.y = facing * smooth(runner.turn);
      // Place the pony before it moves, so its hair lags behind where it really is.
      root.position.z = runner.shownZ;
      const celebrating = runner.turn >= 1 && isPlayer && won;
      // The winner's name would cover her as she rears; everyone knows who won by then.
      runner.tag.visible = !celebrating;
      runner.pony.update({
        now,
        dt,
        speed: turning ? 2.4 : Math.min(TOP_SPEED, velocity),
        moving: turning || (!onLine && (running || finished) && !done && velocity > 0.05),
        waiting: !running && !finished && !done,
        celebrating,
        cheering: runner.turn >= 1 && !(isPlayer && won),
        calm,
      });
      if (isPlayer) {
        playerZ = runner.shownZ;
        playerSpeed = velocity;
      }
    }
    this.react(now, answered, tripped, playerSpeed, calm);
    const sun = this.scenery.sun;
    sun.position.set(SUN_OFFSET.x, SUN_OFFSET.y, playerZ + SUN_OFFSET.z);
    sun.target.position.set(0, 0, playerZ - 3);
    const lines = now < this.lineUntil && running;
    for (const line of this.speedLines) {
      line.visible = lines;
      if (lines) line.scale.z = 0.6 + Math.min(1.4, playerSpeed / TOP_SPEED) * 1.5;
    }
    const dizzyNow = stumbling && running;
    this.dizzy.forEach((star, index) => {
      star.visible = dizzyNow;
      if (dizzyNow) {
        const angle = now * (calm ? 2 : 6) + (index * Math.PI * 2) / 3;
        star.position.set(
          Math.cos(angle) * 0.32,
          1.55 + Math.sin(now * 8) * 0.04,
          -1.3 + Math.sin(angle) * 0.32,
        );
      }
    });
    this.rippleTrail(now, rainbow && running, playerSpeed, calm);
    if (finished && won) this.celebrate(now);
    // Sparkles round Lumi travel with her; everything else stays where it was thrown.
    lumi.pony.root.getWorldPosition(this.at);
    this.carry.subVectors(this.at, this.lastLumi);
    if (this.carry.lengthSq() > 4) this.carry.set(0, 0, 0);
    this.lastLumi.copy(this.at);
    this.sparks.update(dt, this.carry);
    this.dust.update(dt, this.still);
    this.frameShot(dt, now, playerZ, playerSpeed, calm);
    this.scenery.update(now, this.camera.position);
  }
  /** Sparkles and dust: what the hooves kick up, a right answer's spray, a stumble's cloud. */
  private react(now: number, answered: boolean, tripped: boolean, speed: number, calm: boolean) {
    const { pony } = this.lumi;
    const { rainbow, running } = this.frame;
    if (answered) {
      // A burst of speed: glitter flies back off the hind hooves, a puff of dust behind them,
      // and a ring of gold and rainbow sparkles round Lumi that travels with her.
      for (const leg of [2, 3]) {
        pony.hoof(leg, this.at);
        for (let i = 0; i < 9; i++)
          this.sparks.emit(
            this.at,
            random(1.6),
            1.6 + Math.random() * 2,
            2.4 + Math.random() * 2.4,
            0.75,
            0.06 + Math.random() * 0.04,
            this.rainbowColors[(i + leg) % this.rainbowColors.length],
          );
        for (let i = 0; i < 3; i++)
          this.dust.emit(this.at, random(1), 0.4 + Math.random() * 0.4, 1.6, 0.7, 0.08);
      }
      pony.root.getWorldPosition(this.at).add(this.carry.set(0, 1.45, -0.3));
      for (let i = 0; i < 14; i++) {
        const angle = (i / 14) * Math.PI * 2;
        this.sparks.emit(
          this.at,
          Math.cos(angle) * 2.2,
          1 + Math.random() * 1.2,
          Math.sin(angle) * 2.2,
          0.7,
          0.07,
          i % 3 ? this.rainbowColors[i % this.rainbowColors.length] : this.gold,
          true,
        );
      }
    }
    if (tripped) {
      // The front hooves plough in and throw up a cloud of dust.
      for (const leg of [0, 1]) {
        pony.hoof(leg, this.at);
        this.at.z -= 0.2;
        for (let i = 0; i < 7; i++)
          this.dust.emit(
            this.at,
            random(2.4),
            0.5 + Math.random() * 0.9,
            -0.6 - Math.random() * 1.2,
            0.9 + Math.random() * 0.3,
            0.13 + Math.random() * 0.08,
          );
      }
    }
    // At a gallop each hoof that lands kicks up a little dust, glitter too on a rainbow streak.
    if (!running || calm || !pony.strikes || speed < 2.6) return;
    for (let leg = 0; leg < 4; leg++) {
      if (!(pony.strikes & (1 << leg))) continue;
      pony.hoof(leg, this.at);
      this.dust.emit(this.at, random(0.6), 0.35, 0.6, 0.55, 0.07 + speed * 0.006);
      if (rainbow)
        this.sparks.emit(
          this.at,
          random(0.8),
          1.2 + Math.random(),
          1.2,
          0.6,
          0.05,
          this.rainbowColors[Math.floor(now * 10 + leg) % this.rainbowColors.length],
        );
    }
  }
  /** The ribbons ripple back from the tail, stretch with speed and flare on a right answer. */
  private rippleTrail(now: number, streak: boolean, speed: number, calm: boolean) {
    const age = now - this.flareAt;
    const flare = age < FLARE_SECONDS ? Math.sin(Math.PI * Math.min(1, age / FLARE_SECONDS)) : 0;
    this.trail.visible = streak || flare > 0.01;
    if (!this.trail.visible) return;
    const pace = Math.min(1, speed / TOP_SPEED);
    this.trail.scale.set(1 + flare * 0.4, 1, (streak ? 0.55 + pace * 0.5 : 0.3) + flare * 0.35);
    const wave = calm ? 0.25 : 1;
    for (let index = 0; index < this.ribbons.length; index++) {
      const { mesh, base } = this.ribbons[index];
      mesh.material.opacity = streak ? 0.88 : 0.9 * Math.min(1, flare * 1.6);
      const position = mesh.geometry.getAttribute('position');
      const array = position.array as Float32Array;
      for (let vertex = 0; vertex < base.length; vertex += 3) {
        const z = base[vertex + 2];
        const along = z / TRAIL_LENGTH;
        const phase = now * 9 - z * 2.4 + index * 0.5;
        array[vertex] = base[vertex] + Math.sin(phase * 0.6) * 0.12 * along * wave;
        array[vertex + 1] = Math.sin(phase) * (0.05 + 0.16 * along) * wave - along * 0.2;
      }
      position.needsUpdate = true;
    }
  }
  /**
   * Where the camera stands. It circles Lumi to keep the nearest ponies in the picture: in
   * front of the whole line-up before the start, behind her while there is someone to catch,
   * and round to her side and front once she leads, looking back at the ponies chasing her.
   * It never swings round so far that a rival stands between it and Lumi.
   */
  private frameShot(dt: number, now: number, playerZ: number, playerSpeed: number, calm: boolean) {
    const { running, finished, won } = this.frame;
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
      // Low on the track side of the line, where the ponies turn to face us in front of the
      // rainbow, the castle and the fireworks.
      orbit = 0.34;
      reach = won ? 5.4 : 6.3;
      height = won ? 1.7 : 1.9;
      lookZ = -1.5;
    } else {
      const turn = smooth((pack + 1.5) / 6.5);
      orbit = 0.12 + turn * 1.8;
      reach = 6 - turn * 0.6;
      // A pony between the camera and Lumi would fill the picture: swing round less until the
      // view is clear, and look down over it from higher up if it never is.
      let crowd = 1;
      for (const share of SWINGS) {
        const tried = 0.12 + (orbit - 0.12) * share;
        if (!this.blocked(tried, reach * this.stepBack, playerZ)) {
          orbit = tried;
          crowd = 0;
          break;
        }
      }
      if (crowd) orbit = 0.12 + (orbit - 0.12) * 0.35;
      // A little lower at full speed, so the ground rushes by; higher over a pony alongside.
      const pace = Math.min(1, Math.max(0, playerSpeed) / TOP_SPEED);
      height = 3 - turn * 1.2 - pace * 0.3 + crowd * 1.2;
      lookZ = -5 + turn * (5.6 + pack * 0.14);
    }
    if (!this.framed) {
      this.framed = true;
      this.orbit = orbit;
      this.reach = reach;
      this.height = height;
      this.lookZ = lookZ;
      this.followZ = playerZ;
    }
    const ease = Math.min(1, dt * 1.7);
    this.orbit += (orbit - this.orbit) * ease;
    this.reach += (reach - this.reach) * ease;
    this.height += (height - this.height) * ease;
    this.lookZ += (lookZ - this.lookZ) * ease;
    // The camera chases Lumi down the track: a burst of speed pulls her ahead for a moment.
    this.followZ = approach(this.followZ, playerZ, 5, dt);
    this.followZ = Math.max(playerZ - MAX_LAG, Math.min(playerZ + MAX_LAG, this.followZ));
    if (finished) this.followZ = playerZ;
    const span = this.reach * this.stepBack;
    this.camera.position.set(
      CAMERA_X - Math.sin(this.orbit) * span,
      this.height,
      this.followZ + Math.cos(this.orbit) * span,
    );
    if (!calm) {
      this.camera.position.x += shake(now, this.shakeAt, 0.45, 0.09);
      this.camera.position.y += shake(now, this.shakeAt - 0.03, 0.45, 0.06);
    }
    // A winner is framed on herself, a little high, so her rear fills the picture.
    this.camera.lookAt(
      finished && won ? LANE_X.player * 0.6 : 0,
      finished ? (won ? 1.95 : 1.5) : 1.15,
      Math.max(this.finishZ - 8, playerZ + this.lookZ),
    );
    // At speed the camera leans into the run and sways a touch with the gallop.
    this.pace = approach(this.pace, running ? Math.max(0, playerSpeed) / TOP_SPEED : 0, 3, dt);
    const sway = calm ? 0 : Math.sin(now * 1.7) * 0.012 * this.pace;
    this.camera.rotateZ(0.03 * this.pace + sway);
    // A gallop widens the view, and a right answer kicks it wider for a moment.
    const kick = now - this.surgeAt < 0.6 ? Math.sin((Math.PI * (now - this.surgeAt)) / 0.6) : 0;
    const fov = this.fov + Math.min(8, Math.max(0, playerSpeed / UNIT) * 1.1) + kick * 4;
    if (Math.abs(fov - this.camera.fov) > 0.05) {
      this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 5);
      this.camera.updateProjectionMatrix();
    }
  }
  /** Whether a rival would stand in the way of Lumi for a camera at `orbit` and `span`. */
  private blocked(orbit: number, span: number, playerZ: number): boolean {
    const eyeX = CAMERA_X - Math.sin(orbit) * span;
    const eyeZ = playerZ + Math.cos(orbit) * span;
    const toX = LANE_X.player - eyeX;
    const toZ = playerZ - eyeZ;
    const reach = toX * toX + toZ * toZ;
    for (const runner of this.runners) {
      if (runner.id === 'player') continue;
      // A pony is about two metres long: test its chest, middle and rump.
      for (const along of BODY_SPOTS) {
        const x = runner.pony.root.position.x - eyeX;
        const z = runner.shownZ + along - eyeZ;
        const t = (x * toX + z * toZ) / reach;
        if (t < 0.08 || t > 0.92) continue;
        if (Math.hypot(x - toX * t, z - toZ * t) < 0.9) return true;
      }
    }
    return false;
  }
  /** Fireworks over the castle while the winner is on the line, and confetti on every rear. */
  private celebrate(now: number) {
    const { pony } = this.lumi;
    if (pony.reared) {
      pony.root.getWorldPosition(this.at).y += 2.2;
      for (let i = 0; i < 28; i++)
        this.sparks.emit(
          this.at,
          random(4),
          2.5 + Math.random() * 2.5,
          random(4),
          1.3,
          0.07,
          this.rainbowColors[i % this.rainbowColors.length],
        );
    }
    if (now < this.nextFirework) return;
    this.nextFirework = now + 0.45;
    const color = this.rainbowColors[Math.floor(Math.random() * this.rainbowColors.length)];
    this.at.set(random(12), 8 + Math.random() * 4, this.finishZ - 12);
    for (let i = 0; i < 16; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      this.sparks.emit(
        this.at,
        Math.sin(phi) * Math.cos(theta) * 4,
        Math.cos(phi) * 4 + 1,
        Math.sin(phi) * Math.sin(theta) * 4,
        1.2,
        0.12,
        color,
      );
    }
  }
}
