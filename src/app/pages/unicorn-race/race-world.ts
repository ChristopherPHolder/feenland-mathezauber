import {
  BoxGeometry,
  CanvasTexture,
  Fog,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
  WebGLRenderer,
} from 'three';
import { MAX_SPEED, RacerId, RacerState } from './race';
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
const SUN_OFFSET = new Vector3(5, 12, 5);
/** Rivals further than this from Lumi no longer pull the camera round. */
const PACK_REACH = 12;
/** How long the others take to reach the line once Lumi has crossed it, and to turn round. */
const RUN_IN_SECONDS = 2.6;
const TURN_SECONDS = 0.9;
/** The camera circles a point a little left of the middle lanes, nearer Lumi's lane. */
const CAMERA_X = -0.3;
/** Tangent of half the vertical field of view: from a 46 to a 68 degree lens. */
const LENS_MIN = 0.424;
const LENS_MAX = 0.675;
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
  private readonly scenery: Scenery;
  private readonly trail: Group;
  private readonly observer: ResizeObserver;
  private readonly finishZ: number;
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
    this.finishZ = -course.length * UNIT;
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.scenery = new Scenery(course);
    this.scene.background = this.scenery.horizon;
    this.scene.fog = new Fog(this.scenery.horizon, ...this.scenery.fog);
    this.scene.add(this.scenery.group);
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
      const velocity = dt > 0 ? (previous - runner.shownZ) / dt / UNIT : 0;
      // On the line each pony turns round to face us, and then shows how it feels.
      runner.turn = onLine ? Math.min(1, runner.turn + dt / TURN_SECONDS) : 0;
      const turning = runner.turn > 0 && runner.turn < 1;
      const root = runner.pony.root;
      const facing = Math.atan2(
        root.position.x - this.camera.position.x,
        runner.shownZ - this.camera.position.z,
      );
      root.rotation.y = facing * smooth(runner.turn);
      runner.pony.update({
        now,
        dt,
        speed: turning ? 2.2 : Math.min(MAX_SPEED, velocity),
        moving: turning || (!onLine && (running || finished) && !done && velocity > 0.05),
        waiting: !running && !finished && !done,
        stumbling: isPlayer && stumbling && !finished,
        celebrating: runner.turn >= 1 && isPlayer && won,
        cheering: runner.turn >= 1 && !(isPlayer && won),
      });
      root.position.z = runner.shownZ;
      if (isPlayer) {
        playerZ = runner.shownZ;
        playerSpeed = velocity;
      }
    }
    const sun = this.scenery.sun;
    sun.position.set(SUN_OFFSET.x, SUN_OFFSET.y, playerZ + SUN_OFFSET.z);
    sun.target.position.set(0, 0, playerZ - 3);
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
    this.scenery.update(now, this.camera.position);
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
      // Low on the track side of the line, where the ponies turn to face us in front of the
      // rainbow, the castle and the fireworks.
      orbit = 0.34;
      reach = 6.3;
      height = 1.9;
      lookZ = -1.5;
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
    this.camera.lookAt(0, finished ? 1.5 : 1.15, Math.max(this.finishZ - 8, playerZ + this.lookZ));
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
