import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Fog,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  PlaneGeometry,
  PointLight,
  Points,
  PointsMaterial,
  QuadraticBezierCurve3,
  Quaternion,
  RingGeometry,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TubeGeometry,
  Vector3,
} from 'three';
import { TextLabel } from '../../shared/three/labels';
import { approach, clamp01, EventCounter } from '../../shared/three/motion';
import { Stage } from '../../shared/three/stage';
import type { StateWorld } from '../../shared/three/three-stage';
import { CAP_COLORS, capColor, DrumFrame, MAX_LAYERS, stepLabel } from './drum-frame';
import {
  Band,
  BAND_HEIGHT,
  BAND_WIDTH,
  buildBand,
  buildPom,
  MushroomKit,
  MushroomView,
  Pom,
  SKIN_Y,
} from './drum-models';

/** Distance between mushrooms along the path. */
const SPACING = 2.7;
/** The drum skin is tipped toward the camera by this much (see MushroomKit). */
const HEAD_TILT = 0.2;
/** Mushrooms kept built behind and ahead of Pom. */
const BEHIND = 3;
const AHEAD = 7;
const RING_SEGMENTS = 64;
const SKY = new Color('#1d1946');
const SKY_LIT = new Color('#3a3478');
const RING_EARLY = new Color('#5ff0d8');
const RING_LATE = new Color('#ff7ab8');

/** A soft round dot, so spores and fireflies glow instead of drawing as squares. */
function dotTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d')!;
  const glow = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  glow.addColorStop(0, '#ffffffff');
  glow.addColorStop(0.35, '#ffffffcc');
  glow.addColorStop(1, '#ffffff00');
  context.fillStyle = glow;
  context.fillRect(0, 0, 64, 64);
  return new CanvasTexture(canvas);
}

/** Where mushroom `index` stands: a gentle S curve walking away from the camera. */
export function pathPoint(index: number) {
  return {
    x: Math.sin(index * 0.55) * 2,
    z: -index * SPACING,
    height: 1.25 + 0.3 * Math.sin(index * 1.7 + 0.6),
    lean: 0.05 * Math.sin(index * 2.1),
  };
}

/** The middle of mushroom `index`'s drum skin, where Pom's feet go. */
export function skinTop(index: number, target = new Vector3()) {
  const p = pathPoint(index);
  return target.set(
    p.x - Math.sin(p.lean) * p.height,
    p.height + SKIN_Y * Math.cos(HEAD_TILT),
    p.z + SKIN_Y * Math.sin(HEAD_TILT),
  );
}

/**
 * Where Pom stands on mushroom `index`: on the far side of the drum skin, so the number he is
 * standing on stays readable in front of him.
 */
export function standSpot(index: number, target = new Vector3()) {
  return skinTop(index, target).add(STAND_OFFSET);
}
const STAND_OFFSET = new Vector3(0, 0.13, -0.62);

/** How far into the current beat we are, 0 on the beat, as a sharp hit that dies away. */
export function beatPulse(now: number, origin: number, period: number) {
  if (period <= 0) return 0;
  const phase = ((((now - origin) / period) % 1) + 1) % 1;
  return Math.exp(-phase * 7);
}

interface View {
  readonly mushroom: MushroomView;
  readonly index: number;
  squishAt: number;
  hitAt: number;
}

interface Particle {
  readonly mesh: Mesh;
  readonly material: MeshBasicMaterial | MeshStandardMaterial;
  readonly velocity: Vector3;
  readonly born: number;
  readonly life: number;
  readonly grow: number;
  readonly gravity: number;
  readonly spin: number;
  readonly opacity: number;
}

interface Arc {
  readonly group: Group;
  readonly tube: Mesh<TubeGeometry, MeshBasicMaterial>;
  readonly sprite: Sprite;
  readonly label: TextLabel;
  readonly born: number;
  readonly key: string;
}

/**
 * The mushroom drums in 3D: a twilight forest where giant drum-mushrooms wind away along an S
 * path. Pom the hedgehog bounces from cap to cap on the game clock, the "?" mushroom carries a
 * countdown ring, every cap pulses on the beat so the game plays without sound, and the forest
 * band on its log in the corner joins in layer by layer. It draws the game's frame and never
 * decides anything.
 */
export class DrumWorld extends Stage implements StateWorld<DrumFrame> {
  private frame?: DrumFrame;
  private round = -1;
  private readonly kit = new MushroomKit();
  private readonly views = new Map<number, View>();
  private readonly pom: Pom;
  private readonly band: Band;
  private readonly dizzy = new Group();
  private readonly pomLight = new PointLight('#ffd9a0', 7, 9);
  private readonly ringTrack: Mesh<RingGeometry, MeshBasicMaterial>;
  private readonly ringFill: Mesh<RingGeometry, MeshBasicMaterial>;
  private readonly ground: Mesh;
  private readonly moon: Mesh;
  private readonly spores: Points<BufferGeometry, PointsMaterial>;
  private readonly sporeSpeed: Float32Array;
  private readonly fireflies: Points<BufferGeometry, PointsMaterial>;
  private trees: InstancedMesh[] = [];
  private readonly trunkShape = new CylinderGeometry(0.18, 0.26, 2.4, 7);
  private readonly crownShape = new ConeGeometry(1.3, 3.4, 8);
  private readonly toadstoolShape = new SphereGeometry(0.16, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  private readonly trunkMaterial = new MeshStandardMaterial({ color: '#2b2138', roughness: 1 });
  private readonly crownMaterial = new MeshStandardMaterial({ color: '#ffffff', roughness: 1 });
  private readonly toadstoolMaterial = new MeshBasicMaterial({ color: '#ffffff' });
  private readonly ringShape = new RingGeometry(0.78, 0.92, 40);
  private readonly puffShape = new SphereGeometry(0.13, 10, 8);
  private readonly sparkShape = new OctahedronGeometry(0.08);
  private readonly particles: Particle[] = [];
  private arcs: Arc[] = [];
  private hintArc: Arc | null = null;
  private readonly hits = new EventCounter();
  private readonly bonks = new EventCounter();
  private pendingHit = false;
  /** The mushroom Pom last landed on, so each landing plays once. */
  private landedOn = -1;
  private landedAt = -10;
  private bonkedAt = -10;
  private yaw = Math.PI / 2;
  private side = 1;
  private full = 0;
  private distance = 8;
  private readonly focus = new Vector3();
  private readonly pomSpot = new Vector3();
  private readonly scratch = new Vector3();
  private readonly scratch2 = new Vector3();

  constructor(canvas: HTMLCanvasElement, host: HTMLElement) {
    super(canvas, host, { background: '#1d1946', fov: 44 });
    this.scene.fog = new Fog(SKY.clone(), 13, 40);
    this.sun.color.set('#c9d4ff');
    this.sun.intensity = 1.5;
    this.fill.color.set('#8c80d8');
    this.fill.intensity = 1.35;
    this.camera.far = 120;

    this.ground = new Mesh(
      new PlaneGeometry(140, 140),
      new MeshStandardMaterial({ color: '#1f2a3c', roughness: 1 }),
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.moon = new Mesh(
      new SphereGeometry(3, 24, 16),
      new MeshBasicMaterial({ color: '#fff4cf', fog: false }),
    );
    this.scene.add(this.ground, this.moon);

    this.pom = buildPom();
    this.pom.group.scale.setScalar(1.15);
    this.pom.group.add(this.pomLight);
    this.pomLight.position.set(0, 2.2, 1.2);
    const starMaterial = new MeshBasicMaterial({ color: '#ffe066' });
    for (let index = 0; index < 3; index++) {
      const star = new Mesh(this.sparkShape, starMaterial);
      this.dizzy.add(star);
    }
    this.dizzy.position.y = 0.95;
    this.dizzy.visible = false;
    this.pom.group.add(this.dizzy);
    this.scene.add(this.pom.group);

    this.ringTrack = new Mesh(
      new RingGeometry(0.86, 1.0, RING_SEGMENTS, 1, Math.PI / 2, Math.PI * 2),
      new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.25 }),
    );
    this.ringFill = new Mesh(
      new RingGeometry(0.86, 1.0, RING_SEGMENTS, 1, Math.PI / 2, Math.PI * 2),
      new MeshBasicMaterial({ color: RING_EARLY.clone(), transparent: true, opacity: 0.95 }),
    );
    for (const ring of [this.ringTrack, this.ringFill]) {
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = SKIN_Y + 0.03;
      ring.visible = false;
    }

    // Spores drift around the camera's focus, so a few always float in view.
    const sporeCount = 170;
    const sporePositions = new Float32Array(sporeCount * 3);
    this.sporeSpeed = new Float32Array(sporeCount);
    for (let index = 0; index < sporeCount; index++) {
      sporePositions[index * 3] = (Math.random() - 0.5) * 20;
      sporePositions[index * 3 + 1] = Math.random() * 7;
      sporePositions[index * 3 + 2] = -16 + Math.random() * 22;
      this.sporeSpeed[index] = 0.15 + Math.random() * 0.35;
    }
    const sporeGeometry = new BufferGeometry();
    sporeGeometry.setAttribute('position', new BufferAttribute(sporePositions, 3));
    this.spores = new Points(
      sporeGeometry,
      new PointsMaterial({
        color: '#d6f7c4',
        size: 0.12,
        map: dotTexture(),
        alphaTest: 0.01,
        transparent: true,
        opacity: 0.85,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    );

    // Coloured fireflies that swirl around Pom while the whole band plays.
    const flyCount = 48;
    const flyGeometry = new BufferGeometry();
    flyGeometry.setAttribute('position', new BufferAttribute(new Float32Array(flyCount * 3), 3));
    const flyColors = new Float32Array(flyCount * 3);
    const tint = new Color();
    for (let index = 0; index < flyCount; index++) {
      tint.set(CAP_COLORS[index % CAP_COLORS.length]);
      flyColors.set([tint.r, tint.g, tint.b], index * 3);
    }
    flyGeometry.setAttribute('color', new BufferAttribute(flyColors, 3));
    this.fireflies = new Points(
      flyGeometry,
      new PointsMaterial({
        size: 0.3,
        map: dotTexture(),
        alphaTest: 0.01,
        vertexColors: true,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.scene.add(this.spores, this.fireflies);

    // The band rides with the camera, standing in the lower left corner of the view.
    this.band = buildBand();
    this.band.group.rotation.x = 0.22;
    this.camera.add(this.band.group);
    this.scene.add(this.camera);
  }

  setState(frame: DrumFrame) {
    this.frame = frame;
    if (frame.round !== this.round) this.rebuild(frame);
    if (this.hits.take(frame.hits) > 0) this.pendingHit = true;
    if (this.bonks.take(frame.bonks) > 0) this.bonk(frame);
    this.syncViews(frame);
    this.syncHint(frame);
    this.draw();
  }

  protected override layout(aspect: number) {
    // Narrow boards pull back and widen the view so the path's sway and the next mushrooms fit.
    const narrow = aspect < 1.25 ? 1.25 / aspect : 1;
    this.camera.fov = 44 + Math.min(12, (narrow - 1) * 10);
    this.distance = 8.6 * narrow ** 0.7;
    super.layout(aspect);
    // Fit the band into the lower left corner at a set depth in front of the camera.
    const depth = 5;
    const viewHeight = 2 * Math.tan((this.camera.fov * Math.PI) / 360) * depth;
    const viewWidth = viewHeight * aspect;
    const scale = Math.min((0.4 * viewWidth) / BAND_WIDTH, (0.24 * viewHeight) / BAND_HEIGHT);
    this.band.group.scale.setScalar(scale);
    this.band.group.position.set(
      -viewWidth / 2 + (BAND_WIDTH * scale) / 2 + viewWidth * 0.03,
      -viewHeight / 2 + viewHeight * 0.03,
      -depth,
    );
  }

  protected update(dt: number, t: number) {
    const frame = this.frame;
    if (!frame || frame.paused) return;
    const calm = this.calm;
    const now = frame.now();
    const count = frame.mushrooms.length;
    if (!count) return;

    // Where Pom is: standing, or on the way from one cap to the next.
    const hop = frame.hop;
    const inAir = !!hop && now >= hop.start && now < hop.end;
    const standing = hop && now >= hop.end ? hop.to : hop ? hop.from : frame.at;
    if (standing !== this.landedOn) this.land(frame, standing);
    let lift = 0;
    let stretch = 0;
    if (inAir && hop) {
      const p = (now - hop.start) / Math.max(0.01, hop.end - hop.start);
      const a = standSpot(hop.from, this.scratch);
      const b = standSpot(hop.to, this.scratch2);
      const height = 1 + 0.12 * a.distanceTo(b);
      this.pomSpot.lerpVectors(a, b, p);
      lift = 4 * height * p * (1 - p);
      stretch = Math.sin(p * Math.PI) * (calm ? 0.04 : 0.12);
    } else {
      standSpot(standing, this.pomSpot);
    }

    // Which way Pom faces: sideways toward the next cap, so his snout and face show in profile.
    const next = Math.min(count - 1, standing + 1);
    const target = frame.waiting && frame.ask !== null ? frame.ask : inAir && hop ? hop.to : next;
    const dx = skinTop(target, this.scratch).x - skinTop(standing, this.scratch2).x;
    if (Math.abs(dx) > 0.3) this.side = Math.sign(dx);
    let yaw = this.side * (Math.PI / 2 + 0.45);
    if (frame.finished) yaw = 0.35;
    this.yaw = approach(this.yaw, yaw, 8, dt);

    // Waiting for a late answer: Pom creeps to the near edge, leans and drums his paws.
    let lean = 0;
    let wiggle = 0;
    if (frame.waiting && !inAir && frame.ask !== null) {
      const toward = skinTop(frame.ask, this.scratch).sub(skinTop(standing, this.scratch2));
      toward.y = 0;
      this.pomSpot.addScaledVector(toward.normalize(), 0.2);
      lean = 0.22;
      wiggle = calm ? 0 : Math.sin(t * 34) * 0.07;
    }

    // Squash on landing, a crouch just before take-off.
    const landedAge = t - this.landedAt;
    let squash = landedAge < 0.35 ? (calm ? 0.08 : 0.26) * Math.exp(-landedAge * 12) : 0;
    if (hop && now < hop.start && hop.start - now < 0.14)
      squash = Math.max(squash, (1 - (hop.start - now) / 0.14) * (calm ? 0.05 : 0.14));
    const sy = 1 - squash + stretch;
    const sxz = 1 + squash * 0.5 - stretch * 0.4;
    this.pom.group.position.set(this.pomSpot.x, this.pomSpot.y + lift, this.pomSpot.z);
    this.pom.group.rotation.y = this.yaw;
    this.pom.body.scale.set(sxz, sy, sxz);

    // Dizzy after a bonk: a wobble and three little stars around his head.
    const bonkAge = t - this.bonkedAt;
    const dizzy = bonkAge < 1.1;
    const wobble = dizzy && !calm ? Math.sin(bonkAge * 14) * 0.28 * (1 - bonkAge / 1.1) : 0;
    this.pom.body.rotation.set(lean, 0, wobble + wiggle);
    this.dizzy.visible = dizzy;
    if (dizzy)
      this.dizzy.children.forEach((star, index) => {
        const angle = (calm ? 0 : bonkAge * 6) + (index / 3) * Math.PI * 2;
        star.position.set(
          Math.cos(angle) * 0.38,
          Math.sin(angle * 2) * 0.05,
          Math.sin(angle) * 0.38,
        );
        star.rotation.y = angle;
      });

    // Spines ripple through after a drum hit; the drumsticks come out for the finale.
    const ripple = landedAge < 0.6 && !calm ? 1 - landedAge / 0.6 : 0;
    this.pom.ripple(ripple, t);
    this.pom.sticks.forEach((stick, index) => {
      stick.visible = frame.finished;
      const beat = frame.finished && !calm ? Math.max(0, Math.sin(t * 26 + index * Math.PI)) : 0;
      stick.rotation.x = 0.9 - beat * 0.7;
    });

    // The beat: every cap pulses with it, the "?" most, unless the beat holds.
    const beat =
      frame.beat && !frame.held ? beatPulse(now, frame.beat.origin, frame.beat.period) : 0;
    for (const view of this.views.values()) {
      const ask = view.index === frame.ask;
      const mushroom = view.mushroom;
      let sy = 1;
      let sxz = 1;
      if (!calm) {
        const grow = (ask ? 0.07 : 0.03) * beat;
        sy += grow;
        sxz += grow;
      }
      const hitAge = t - view.hitAt;
      if (hitAge < 0.3) sy -= 0.14 * (1 - hitAge / 0.3);
      const squishAge = t - view.squishAt;
      if (squishAge < 0.7) {
        const amount =
          0.3 * (1 - squishAge / 0.7) * Math.abs(Math.cos(squishAge * (calm ? 0 : 16)));
        sy -= amount;
        sxz += amount * 0.5;
      }
      if (frame.finished && view.index === standing && !calm)
        sy -= 0.05 * Math.abs(Math.sin(t * 26));
      mushroom.head.scale.set(sxz, sy, sxz);
      const glow = ask ? 0.85 + beat * 0.7 : 0.5 + beat * 0.3;
      mushroom.cap.emissiveIntensity = glow + (frame.solo ? 0.25 : 0) + this.full * 0.3;
      if (mushroom.lantern) {
        mushroom.lantern.rotation.y = calm ? 0.6 : t * 1.6;
        mushroom.lantern.position.y = SKIN_Y + 0.55 + (calm ? 0 : Math.sin(t * 2.4) * 0.06);
      }
    }

    // The countdown ring on the "?" fills up toward the landing.
    const ringOn = frame.ring && frame.ask !== null && this.views.has(frame.ask);
    this.ringTrack.visible = frame.ask !== null && this.views.has(frame.ask);
    this.ringFill.visible = !!ringOn;
    if (ringOn && frame.ring) {
      const share = clamp01(
        (now - frame.ring.start) / Math.max(0.01, frame.ring.end - frame.ring.start),
      );
      this.ringFill.geometry.setDrawRange(0, Math.round(share * RING_SEGMENTS) * 6);
      this.ringFill.material.color.copy(RING_EARLY).lerp(RING_LATE, clamp01((share - 0.6) / 0.4));
    }

    // Arcs: landing flashes fade, the hint arc glows steadily.
    for (const arc of [...this.arcs]) {
      const age = t - arc.born;
      if (age > 1.2) {
        this.disposeArc(arc);
        this.arcs.splice(this.arcs.indexOf(arc), 1);
        continue;
      }
      const fade = 1 - clamp01((age - 0.6) / 0.6);
      arc.tube.material.opacity = 0.9 * fade;
      arc.sprite.material.opacity = fade;
      arc.sprite.scale.set(0.95, 0.63, 1).multiplyScalar(Math.min(1, 0.4 + age * 4));
    }
    if (this.hintArc) {
      const glow = calm ? 0.85 : 0.6 + Math.sin(t * 5) * 0.3;
      this.hintArc.tube.material.opacity = glow;
    }

    // The whole band lights up the forest.
    this.full = approach(this.full, frame.layers >= MAX_LAYERS ? 1 : 0, 2, dt);
    (this.scene.background as Color).copy(SKY).lerp(SKY_LIT, this.full * 0.6);
    this.scene.fog?.color.copy(this.scene.background as Color);
    this.fill.intensity = 1.35 + this.full * 0.8;
    this.band.update(t, frame.layers, frame.held ? 0 : beat, calm);

    // The camera follows Pom and looks ahead to the next mushrooms.
    const ahead = skinTop(Math.min(count - 1, standing + 2), this.scratch);
    const goal = this.scratch2.copy(this.pomSpot).multiplyScalar(0.7).addScaledVector(ahead, 0.3);
    if (this.focus.lengthSq() === 0) this.focus.copy(goal);
    this.focus.set(
      approach(this.focus.x, goal.x, 3, dt),
      approach(this.focus.y, goal.y, 3, dt),
      approach(this.focus.z, goal.z, 3, dt),
    );
    this.camera.position.set(
      this.focus.x * 0.7,
      this.focus.y + this.distance * 0.6,
      this.focus.z + this.distance * 0.82,
    );
    this.camera.lookAt(this.focus.x, this.focus.y - 0.3, this.focus.z - 1.3);
    this.ground.position.set(this.focus.x, 0, this.focus.z);
    this.moon.position.set(this.focus.x - 14, 26, this.focus.z - 70);

    this.moveSpores(dt, t, calm);
    this.moveParticles(dt, t);
  }

  /** A fresh round: new path, new trees, Pom on his first mushroom, old events forgotten. */
  private rebuild(frame: DrumFrame) {
    this.round = frame.round;
    for (const view of [...this.views.values()]) this.release(view);
    for (const arc of this.arcs) this.disposeArc(arc);
    this.arcs = [];
    if (this.hintArc) this.disposeArc(this.hintArc);
    this.hintArc = null;
    this.pendingHit = false;
    this.landedOn = frame.hop ? frame.hop.from : frame.at;
    this.landedAt = -10;
    this.bonkedAt = -10;
    this.focus.set(0, 0, 0);
    this.plantForest(frame.mushrooms.length);
  }

  /** Trees and little glowing toadstools along both sides of the path. */
  private plantForest(count: number) {
    for (const mesh of this.trees) {
      mesh.removeFromParent();
      mesh.dispose();
    }
    const spots = Math.max(8, count + 12);
    const trees = spots * 2;
    const trunks = new InstancedMesh(this.trunkShape, this.trunkMaterial, trees);
    const crowns = new InstancedMesh(this.crownShape, this.crownMaterial, trees);
    const toadstools = new InstancedMesh(this.toadstoolShape, this.toadstoolMaterial, spots * 4);
    const matrix = new Matrix4();
    const turn = new Quaternion();
    const size = new Vector3();
    const where = new Vector3();
    const tone = new Color();
    const shades = ['#1f3a4a', '#243154', '#2d2a58', '#1d4044'];
    let tree = 0;
    let stool = 0;
    for (let spot = -4; spot < spots - 4; spot++) {
      const p = pathPoint(spot);
      for (const side of [-1, 1]) {
        const wobble = Math.sin(spot * 12.9898 + side * 78.233) * 43758.5453;
        const jitter = wobble - Math.floor(wobble);
        const scale = 0.8 + jitter * 0.7;
        where.set(p.x + side * (5 + jitter * 4), 1.2 * scale, p.z + (jitter - 0.5) * 1.6);
        size.set(scale, scale, scale);
        trunks.setMatrixAt(tree, matrix.compose(where, turn, size));
        where.y = (2.4 + 1.6) * scale;
        crowns.setMatrixAt(tree, matrix.compose(where, turn, size));
        crowns.setColorAt(tree, tone.set(shades[(spot + 4 + (side > 0 ? 1 : 0)) % shades.length]));
        tree++;
        for (let k = 0; k < 2; k++) {
          const off = (jitter * 2.3 + k * 1.7) % 1;
          where.set(p.x + side * (1.8 + off * 2.2), 0, p.z + (off - 0.5) * 2.4);
          size.setScalar(0.35 + off * 0.45);
          toadstools.setMatrixAt(stool, matrix.compose(where, turn, size));
          toadstools.setColorAt(
            stool,
            tone.set(CAP_COLORS[(spot + 4 + k * 2 + side) & 3]).multiplyScalar(0.7),
          );
          stool++;
        }
      }
    }
    this.trees = [trunks, crowns, toadstools];
    this.scene.add(trunks, crowns, toadstools);
  }

  /** Keeps mushrooms built only around Pom, with the right number on each skin. */
  private syncViews(frame: DrumFrame) {
    const count = frame.mushrooms.length;
    const around = frame.hop ? Math.max(frame.hop.to, frame.at) : frame.at;
    const first = Math.max(0, Math.min(frame.at, around) - BEHIND);
    const last = Math.min(count - 1, around + AHEAD);
    for (const view of [...this.views.values()])
      if (view.index < first || view.index > last) this.release(view);
    for (let index = first; index <= last; index++) {
      let view = this.views.get(index);
      const mushroom = frame.mushrooms[index];
      if (!view) {
        const p = pathPoint(index);
        const built = this.kit.build(capColor(index, mushroom), p.height, mushroom.fresh, p.lean);
        built.group.position.set(p.x, 0, p.z);
        this.scene.add(built.group);
        view = { mushroom: built, index, squishAt: -10, hitAt: -10 };
        this.views.set(index, view);
      }
      view.mushroom.label.update(this.text(frame, index));
    }
    if (frame.ask !== null) {
      const ask = this.views.get(frame.ask);
      if (ask) ask.mushroom.head.add(this.ringTrack, this.ringFill);
    }
  }

  /** What mushroom `index` shows: its number once given or reached, "?" while asked, else blank. */
  private text(frame: DrumFrame, index: number) {
    const mushroom = frame.mushrooms[index];
    if (index === frame.ask) return '?';
    const reached =
      index <= frame.at ||
      (frame.hop !== null && index === frame.hop.to) ||
      (frame.ask !== null && index < frame.ask);
    return mushroom.given || reached ? String(mushroom.value) : '';
  }

  private release(view: View) {
    if (this.ringTrack.parent === view.mushroom.head) {
      view.mushroom.head.remove(this.ringTrack, this.ringFill);
    }
    this.kit.release(view.mushroom);
    this.views.delete(view.index);
  }

  /** Pom touches down on a drum: a ring spreads, the step arc flashes, the spines ripple. */
  private land(frame: DrumFrame, index: number) {
    const before = this.landedOn;
    this.landedOn = index;
    this.landedAt = this.elapsed;
    const view = this.views.get(index);
    if (view) view.hitAt = this.elapsed;
    const top = skinTop(index, new Vector3());
    const hit = this.pendingHit;
    this.pendingHit = false;
    this.ring(top, hit ? '#ffe27a' : '#ffffff', hit ? 2.6 : 1.8);
    const mushroom = frame.mushrooms[index];
    if (mushroom && !mushroom.fresh && mushroom.step !== 0 && before >= 0 && before !== index) {
      const arc = this.arc(before, index, stepLabel(mushroom.step), '#ffd23f', `flash-${index}`);
      this.arcs.push(arc);
    }
    if (hit && !this.calm)
      for (let k = 0; k < 10; k++) {
        const angle = (k / 10) * Math.PI * 2;
        this.spawn(
          this.sparkShape,
          new MeshBasicMaterial({ color: k % 2 ? '#ffd23f' : '#fff6bf', transparent: true }),
          top,
          new Vector3(Math.cos(angle) * 1.4, 3 + (k % 3) * 0.6, Math.sin(angle) * 1.4),
          { life: 1, gravity: 7, spin: 8 },
        );
      }
  }

  /** A wrong answer: the "?" cap squishes, spores puff up, and Pom gets dizzy. */
  private bonk(frame: DrumFrame) {
    this.bonkedAt = this.elapsed;
    if (frame.ask === null) return;
    const view = this.views.get(frame.ask);
    if (view) view.squishAt = this.elapsed;
    const top = skinTop(frame.ask, new Vector3());
    for (let k = 0; k < 9; k++) {
      const angle = (k / 9) * Math.PI * 2;
      const from = top.clone().add(new Vector3(Math.cos(angle) * 0.6, 0.1, Math.sin(angle) * 0.6));
      this.spawn(
        this.puffShape,
        new MeshStandardMaterial({ color: '#b9b2d8', transparent: true, opacity: 0.8 }),
        from,
        new Vector3(Math.cos(angle) * 0.6, 0.8 + (k % 3) * 0.25, Math.sin(angle) * 0.6),
        { life: 1.1, grow: 1.6, gravity: -0.3, opacity: 0.8 },
      );
    }
  }

  private syncHint(frame: DrumFrame) {
    const key =
      frame.stepHint !== null && frame.ask !== null
        ? `${frame.at}-${frame.ask}-${frame.stepHint}`
        : '';
    if ((this.hintArc?.key ?? '') === key) return;
    if (this.hintArc) this.disposeArc(this.hintArc);
    this.hintArc =
      key && frame.stepHint !== null && frame.ask !== null
        ? this.arc(frame.at, frame.ask, frame.stepHint, '#7ff0ff', key)
        : null;
  }

  /** An arc over the path from one cap to another, with the step written above it. */
  private arc(from: number, to: number, text: string, color: string, key: string): Arc {
    const a = skinTop(from, new Vector3());
    const b = skinTop(to, new Vector3());
    const middle = a.clone().lerp(b, 0.5);
    middle.y += 2;
    const curve = new QuadraticBezierCurve3(
      a.clone().setY(a.y + 0.3),
      middle,
      b.clone().setY(b.y + 0.3),
    );
    const tube = new Mesh(
      new TubeGeometry(curve, 28, 0.045, 6),
      new MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }),
    );
    const label = new TextLabel(text, {
      fill: color === '#ffd23f' ? '#ffd23f' : '#c9fbff',
      border: '#3a2160',
      ink: '#2a1650',
      width: 192,
      height: 128,
      radius: 0.4,
    });
    const sprite = new Sprite(
      new SpriteMaterial({ map: label.texture, transparent: true, depthTest: false }),
    );
    sprite.renderOrder = 10;
    sprite.scale.set(0.95, 0.63, 1);
    sprite.position.copy(curve.getPoint(0.5)).add(new Vector3(0, 0.45, 0));
    const group = new Group();
    group.add(tube, sprite);
    this.scene.add(group);
    return { group, tube, sprite, label, born: this.elapsed, key };
  }

  private disposeArc(arc: Arc) {
    arc.group.removeFromParent();
    arc.tube.geometry.dispose();
    arc.tube.material.dispose();
    arc.sprite.material.dispose();
    arc.label.texture.dispose();
  }

  private ring(at: Vector3, color: string, grow: number) {
    const ring = this.spawn(
      this.ringShape,
      new MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }),
      at.clone().setY(at.y + 0.06),
      new Vector3(),
      { life: 0.6, grow, opacity: 0.9 },
    );
    ring.rotation.x = -Math.PI / 2 + HEAD_TILT;
  }

  private spawn(
    geometry: BufferGeometry,
    material: MeshBasicMaterial | MeshStandardMaterial,
    at: Vector3,
    velocity: Vector3,
    options: { life: number; grow?: number; gravity?: number; spin?: number; opacity?: number },
  ) {
    const mesh = new Mesh(geometry, material);
    mesh.position.copy(at);
    this.scene.add(mesh);
    this.particles.push({
      mesh,
      material,
      velocity,
      born: this.elapsed,
      life: options.life,
      grow: options.grow ?? 0,
      gravity: options.gravity ?? 0,
      spin: options.spin ?? 0,
      opacity: options.opacity ?? 1,
    });
    return mesh;
  }

  private moveParticles(dt: number, t: number) {
    for (const particle of [...this.particles]) {
      const age = t - particle.born;
      if (age > particle.life) {
        particle.mesh.removeFromParent();
        particle.material.dispose();
        this.particles.splice(this.particles.indexOf(particle), 1);
        continue;
      }
      particle.velocity.y -= particle.gravity * dt;
      particle.mesh.position.addScaledVector(particle.velocity, dt);
      particle.mesh.rotation.y += particle.spin * dt;
      if (particle.grow) particle.mesh.scale.setScalar(1 + age * particle.grow * 2);
      particle.material.opacity = particle.opacity * (1 - age / particle.life);
    }
  }

  private moveSpores(dt: number, t: number, calm: boolean) {
    this.spores.position.set(this.focus.x, 0, this.focus.z);
    this.fireflies.position.set(this.focus.x, 0, this.focus.z);
    if (!calm) {
      const positions = this.spores.geometry.getAttribute('position') as BufferAttribute;
      for (let index = 0; index < positions.count; index++) {
        let y = positions.getY(index) + this.sporeSpeed[index] * dt;
        if (y > 7) y = 0;
        positions.setY(index, y);
        positions.setX(index, positions.getX(index) + Math.sin(t * 0.7 + index) * dt * 0.1);
      }
      positions.needsUpdate = true;
    }
    this.fireflies.material.opacity = this.full;
    this.fireflies.visible = this.full > 0.01;
    if (this.fireflies.visible) {
      const positions = this.fireflies.geometry.getAttribute('position') as BufferAttribute;
      const clock = calm ? 0 : t;
      for (let index = 0; index < positions.count; index++) {
        const angle = index * 2.4 + clock * (0.6 + (index % 5) * 0.12);
        const radius = 1.6 + (index % 7) * 0.45;
        positions.setXYZ(
          index,
          Math.cos(angle) * radius,
          1.6 + (index % 4) * 0.6 + Math.sin(clock * 2 + index) * 0.3,
          Math.sin(angle) * radius - 1.5,
        );
      }
      positions.needsUpdate = true;
    }
  }

  override dispose() {
    for (const view of [...this.views.values()]) this.release(view);
    for (const arc of this.arcs) this.disposeArc(arc);
    if (this.hintArc) this.disposeArc(this.hintArc);
    for (const particle of this.particles) {
      particle.mesh.removeFromParent();
      particle.material.dispose();
    }
    for (const mesh of this.trees) mesh.dispose();
    this.kit.dispose();
    for (const geometry of [this.ringShape, this.puffShape, this.sparkShape]) geometry.dispose();
    for (const points of [this.spores, this.fireflies]) {
      points.geometry.dispose();
      points.material.map?.dispose();
      points.material.dispose();
    }
    super.dispose();
  }
}
