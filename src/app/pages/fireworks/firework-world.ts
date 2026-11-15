import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Path,
  PlaneGeometry,
  Points,
  PointsMaterial,
  RingGeometry,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
} from 'three';
import { easeOut, easeOutBack, EventCounter, smooth } from '../../shared/three/motion';
import { Stage } from '../../shared/three/stage';
import type { StateWorld } from '../../shared/three/three-stage';
import { FADE_OUT, FireworkFrame, FireworkPhase, RISE, sparkGlow } from './firework-frame';
import { Box, HUES, Pattern, SparkShape } from './firework-levels';
import { shapePoints } from './firework-shapes';

const DEG = Math.PI / 180;
const FOV = 40;
const TAN = Math.tan((FOV / 2) * DEG);
/** The view is always this many units tall at the burst plane (z = 0); wider screens see more lake. */
const VIEW_HEIGHT = 10;
const DISTANCE = VIEW_HEIGHT / 2 / TAN;
/** The camera's height: it looks straight ahead, so the vertical layout is the same on every screen. */
const EYE_Y = 1.6;
/** The burst area: the upper two-thirds of the view, above the far shore. */
const BURST_BOTTOM = 0.95;
const BURST_TOP = EYE_Y + VIEW_HEIGHT / 2 - 0.3;
const BURST_Y = (BURST_BOTTOM + BURST_TOP) / 2;
/** How much of the burst area a pattern may fill, and how big a spark spacing may grow. */
const FILL = 0.85;
const MAX_SCALE = 1.25;
/** The lake's mirror squashes the sky this much. */
const REFLECT = 0.3;
/** Where the near shore, the jetty and the crowd stand. */
const BANK_Z = 1.6;
const JETTY_Y = -2.35;
const MAX_SPARKS = 24;

/** Smoothly from `a` to `b` as `t` runs 0 → 1. */
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

function texture(size: number, draw: (c: CanvasRenderingContext2D, s: number) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  draw(canvas.getContext('2d')!, size);
  const map = new CanvasTexture(canvas);
  map.colorSpace = SRGBColorSpace;
  return map;
}

/** A soft glowing dot: a bright core and a halo that fades out. */
function glowTexture() {
  return texture(128, (c, s) => {
    const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,255,255,1)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.12)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, s, s);
  });
}

/** A glowing five-pointed star. */
function starTexture() {
  return texture(128, (c, s) => {
    c.translate(s / 2, s / 2 + 4);
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? s * 0.15 : s * 0.36;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    c.closePath();
    c.shadowColor = 'rgba(255,255,255,0.9)';
    c.shadowBlur = 16;
    c.fillStyle = '#fff';
    c.lineJoin = 'round';
    c.lineWidth = 6;
    c.strokeStyle = '#fff';
    c.fill();
    c.stroke();
  });
}

/** A vertical gradient, top to bottom, for the sky and the water. */
function gradientTexture(stops: readonly [number, string][]) {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const c = canvas.getContext('2d')!;
  const g = c.createLinearGradient(0, 0, 0, 256);
  for (const [at, color] of stops) g.addColorStop(at, color);
  c.fillStyle = g;
  c.fillRect(0, 0, 4, 256);
  const map = new CanvasTexture(canvas);
  map.colorSpace = SRGBColorSpace;
  return map;
}

/** A flat rounded-rectangle ring: a frame or a group outline, `thickness` wide. */
function boxRing(box: Box, thickness: number) {
  const w = box.w / 2;
  const h = box.h / 2;
  const r = Math.min(0.45, w, h);
  const outer = new Shape();
  roundRect(outer, w, h, r);
  const hole = new Path();
  roundRect(hole, w - thickness, h - thickness, Math.max(0.05, r - thickness));
  outer.holes.push(hole);
  return new ShapeGeometry(outer, 10);
}

function roundRect(path: Path, w: number, h: number, r: number) {
  path.moveTo(-w + r, -h);
  path.lineTo(w - r, -h);
  path.quadraticCurveTo(w, -h, w, -h + r);
  path.lineTo(w, h - r);
  path.quadraticCurveTo(w, h, w - r, h);
  path.lineTo(-w + r, h);
  path.quadraticCurveTo(-w, h, -w, h - r);
  path.lineTo(-w, -h + r);
  path.quadraticCurveTo(-w, -h, -w + r, -h);
}

/** A small seeded random, so the town and crowd look the same on every visit. */
function seededRandom(seed: number) {
  let a = seed;
  return () => {
    a = (a * 16807) % 2147483647;
    return (a - 1) / 2147483646;
  };
}

/**
 * Free-flying glowing bits in one draw call: rocket trails, show bursts, confetti embers, fizzle
 * embers and the sparkler. Each fades in and out smoothly; nothing blinks.
 */
class Particles {
  readonly points: Points;
  private readonly capacity: number;
  private readonly position: Float32Array;
  private readonly color: Float32Array;
  private readonly data: {
    vx: number;
    vy: number;
    born: number;
    life: number;
    gravity: number;
    drag: number;
    r: number;
    g: number;
    b: number;
    hold: number;
  }[] = [];
  private next = 0;

  constructor(capacity: number, map: CanvasTexture, size: number) {
    this.capacity = capacity;
    this.position = new Float32Array(capacity * 3);
    this.color = new Float32Array(capacity * 3);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(this.position, 3));
    geometry.setAttribute('color', new BufferAttribute(this.color, 3));
    this.points = new Points(
      geometry,
      new PointsMaterial({
        size,
        map,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    this.points.frustumCulled = false;
    for (let i = 0; i < capacity; i++)
      this.data.push({
        vx: 0,
        vy: 0,
        born: 0,
        life: 0,
        gravity: 0,
        drag: 0,
        r: 0,
        g: 0,
        b: 0,
        hold: 0,
      });
  }

  add(
    t: number,
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    color: Color,
    life: number,
    options: { gravity?: number; drag?: number; hold?: number } = {},
  ) {
    const i = this.next;
    this.next = (this.next + 1) % this.capacity;
    this.position.set([x, y, z], i * 3);
    Object.assign(this.data[i], {
      vx,
      vy,
      born: t,
      life,
      gravity: options.gravity ?? 0,
      drag: options.drag ?? 0,
      hold: options.hold ?? 0.35,
      r: color.r,
      g: color.g,
      b: color.b,
    });
  }

  update(t: number, dt: number) {
    for (let i = 0; i < this.capacity; i++) {
      const p = this.data[i];
      const age = t - p.born;
      if (p.life <= 0 || age > p.life || age < 0) {
        this.color.set([0, 0, 0], i * 3);
        continue;
      }
      const slow = Math.exp(-p.drag * dt);
      p.vx *= slow;
      p.vy = p.vy * slow - p.gravity * dt;
      this.position[i * 3] += p.vx * dt;
      this.position[i * 3 + 1] += p.vy * dt;
      // Fade in quickly, hold, then dim away smoothly.
      const k = age / p.life;
      const glow = Math.min(
        smooth(age / 0.18),
        k < p.hold ? 1 : 1 - smooth((k - p.hold) / (1 - p.hold)),
      );
      this.color.set([p.r * glow, p.g * glow, p.b * glow], i * 3);
    }
    this.points.geometry.attributes['position'].needsUpdate = true;
    this.points.geometry.attributes['color'].needsUpdate = true;
  }
}

interface Creature {
  /** Placed along the bank by the layout. */
  readonly holder: Group;
  /** Bounces and sways inside the holder. */
  readonly body: Group;
  readonly head: Group;
  readonly lantern: Group;
  readonly phase: number;
}

interface ShowBurst {
  readonly at: number;
  readonly x: number;
  readonly y: number;
  readonly hue: number;
  done: boolean;
}

/**
 * The Firework Show in 3D: a lake at dusk with a lantern-lit town on the far shore, a crowd of
 * fairyland creatures on the near bank, and Flick the fox on the jetty lighting rockets. Each
 * burst puts its sparks at the pattern's exact places, scaled to fill the sky above the town, so
 * the structure stays crisp; it glows up, holds for the look, and dims away. It never decides.
 */
export class FireworkWorld extends Stage implements StateWorld<FireworkFrame> {
  private frame?: FireworkFrame;
  private pattern?: Pattern;
  private firework = -1;
  private phase: FireworkPhase = 'idle';
  private phaseAt = 0;
  private burstAt = -10;
  /** Glow when the current phase began, so fades start from where the burst was. */
  private glowFrom = 0;
  private glow = 0;
  private launchedAt = -10;
  private bloomAt = -10;
  private fizzleAt = -10;
  private peekAt = -10;
  private showAt = -10;
  private scale = 1;
  private viewWidth = 10;
  private patternWidth = 1;
  private patternHeight = 1;
  private readonly launches = new EventCounter();
  private readonly bursts = new EventCounter();
  private readonly blooms = new EventCounter();
  private readonly fizzles = new EventCounter();
  private readonly peeks = new EventCounter();
  private readonly shows = new EventCounter();

  private readonly glowMap = glowTexture();
  private readonly starMap = starTexture();
  /** The pattern, in spark units; the group's scale fits it to the sky. */
  private readonly burst = new Group();
  private readonly reflection = new Group();
  private readonly sparks: Sprite[] = [];
  private readonly mirrored: Sprite[] = [];
  private readonly sparkMaterials: Record<SparkShape, SpriteMaterial>;
  private readonly mirrorMaterials: Record<SparkShape, SpriteMaterial>;
  private readonly ringGeometry = new RingGeometry(0.2, 0.27, 28);
  private readonly ringMaterial = new MeshBasicMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  private readonly frameMaterial = new MeshBasicMaterial({
    color: '#e6ddff',
    transparent: true,
    depthWrite: false,
  });
  private readonly patternParts: Mesh[] = [];
  private outlines: { mesh: Mesh; material: MeshBasicMaterial }[] = [];
  private readonly particles: Particles;
  private readonly hue = new Color();
  private readonly white = new Color('#ffffff');
  private readonly ember = new Color('#c9b48a');

  private readonly rocket = new Group();
  private readonly rocketFrom = { x: 0, y: 0 };
  private readonly fox = new Group();
  private readonly foxBody = new Group();
  private readonly foxHead = new Group();
  private readonly foxTail = new Group();
  private readonly foxArm = new Group();
  private readonly taper = new Group();
  private readonly telescope = new Group();
  private readonly sparkler = new Group();
  private readonly scarfEnd = new Group();
  private readonly tube = new Group();
  private readonly jetty = new Group();
  private readonly crowd: Creature[] = [];
  private readonly crowdRoot = new Group();
  private readonly lake: Mesh;
  private readonly bank: Mesh;
  private readonly town = new Group();
  private readonly showBursts: ShowBurst[] = [];
  private shapeAt = -10;
  private readonly probe = new Vector3();

  constructor(canvas: HTMLCanvasElement, host: HTMLElement) {
    super(canvas, host, { fov: FOV });
    this.fill.intensity = 1.1;
    this.fill.color.set('#b9a8ff');
    this.sun.intensity = 1.1;
    this.sun.color.set('#ffc9a0');
    this.sun.position.set(-6, 6, 10);

    this.scene.background = gradientTexture([
      [0, '#0f0c2e'],
      [0.35, '#251d5c'],
      [0.56, '#4c3378'],
      [0.64, '#a86a86'],
      [0.7, '#e3a07c'],
      [1, '#e3a07c'],
    ]);
    this.buildStars();
    this.buildTown();

    this.lake = new Mesh(
      new PlaneGeometry(200, 9),
      new MeshBasicMaterial({
        map: gradientTexture([
          [0, '#5d4f8f'],
          [0.08, '#34306c'],
          [0.5, '#1d1c4a'],
          [1, '#121233'],
        ]),
      }),
    );
    this.lake.position.set(0, -4.5, -0.25);
    this.scene.add(this.lake);

    this.sparkMaterials = {
      round: this.sparkMaterial(this.glowMap, 1),
      star: this.sparkMaterial(this.starMap, 1),
    };
    this.mirrorMaterials = {
      round: this.sparkMaterial(this.glowMap, 0.3),
      star: this.sparkMaterial(this.starMap, 0.3),
    };
    for (let i = 0; i < MAX_SPARKS; i++) {
      const spark = new Sprite(this.sparkMaterials.round);
      spark.renderOrder = 5;
      this.sparks.push(spark);
      this.burst.add(spark);
      const twin = new Sprite(this.mirrorMaterials.round);
      this.mirrored.push(twin);
      this.reflection.add(twin);
    }
    this.burst.position.set(0, BURST_Y, 0);
    this.reflection.position.z = 0.05;
    this.scene.add(this.burst, this.reflection);

    this.particles = new Particles(900, this.glowMap, 0.42);
    this.particles.points.renderOrder = 6;
    this.scene.add(this.particles.points);

    this.bank = this.buildBank();
    this.buildJetty();
    this.buildFox();
    this.buildRocket();
    this.buildCrowd();
  }

  private sparkMaterial(map: CanvasTexture, opacity: number) {
    return new SpriteMaterial({
      map,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: AdditiveBlending,
    });
  }

  setState(frame: FireworkFrame) {
    const t = this.elapsed;
    if (frame.firework !== this.firework || frame.pattern !== this.pattern) {
      this.firework = frame.firework;
      this.pattern = frame.pattern;
      this.buildPattern(frame.pattern);
    }
    if (frame.phase !== this.phase) {
      this.glowFrom = this.glow;
      if (frame.phase === 'look') this.burstAt = t;
      this.phase = frame.phase;
      this.phaseAt = t;
    }
    if (this.launches.take(frame.launches)) this.launchedAt = t;
    if (this.bursts.take(frame.bursts) && frame.phase === 'look') this.burstAt = t;
    if (this.blooms.take(frame.blooms)) this.celebrate(frame);
    if (this.fizzles.take(frame.fizzles)) this.fizzle();
    if (this.peeks.take(frame.peeks)) this.peekAt = t;
    if (this.shows.take(frame.shows)) this.startShow(frame);
    this.frame = frame;
    this.draw();
  }

  protected override layout(aspect: number) {
    super.layout(aspect);
    this.camera.position.set(0, EYE_Y, DISTANCE);
    this.camera.lookAt(0, EYE_Y, 0);
    this.viewWidth = VIEW_HEIGHT * aspect;
    // Flick and the jetty stand near the left edge; the crowd fills the rest of the bank.
    const half = (z: number) => (DISTANCE - z) * TAN * aspect;
    const bankHalf = half(BANK_Z);
    const foxX = -bankHalf + Math.min(2.2, Math.max(1.05, bankHalf * 0.3));
    this.jetty.position.x = foxX;
    this.fox.position.x = foxX - 0.05;
    this.tube.position.x = foxX + 0.75;
    this.rocketFrom.x = this.tube.position.x;
    this.rocketFrom.y = JETTY_Y + 0.55;
    const from = foxX + 1.3;
    const to = bankHalf - 0.35;
    const room = Math.max(0, to - from);
    const count = Math.max(2, Math.min(this.crowd.length, Math.round(room / 0.85)));
    this.crowd.forEach((creature, index) => {
      creature.holder.visible = index < count;
      creature.holder.position.x = from + (room * (index + 0.5)) / count;
    });
    this.fitPattern();
  }

  /** Scales the pattern to fill the burst area at this screen's shape. */
  private fitPattern() {
    const width = (this.viewWidth * FILL) / this.patternWidth;
    const height = ((BURST_TOP - BURST_BOTTOM) * FILL) / this.patternHeight;
    this.scale = Math.min(MAX_SCALE, width, height);
    this.burst.scale.setScalar(this.scale);
    this.reflection.scale.set(this.scale, -this.scale * REFLECT, this.scale);
    this.reflection.position.y = -BURST_Y * REFLECT - 0.15;
  }

  // ------------------------------------------------------------------------------------------
  // The pattern
  // ------------------------------------------------------------------------------------------

  private buildPattern(pattern: Pattern) {
    for (const mesh of this.patternParts) {
      mesh.removeFromParent();
      if (mesh.geometry !== this.ringGeometry) mesh.geometry.dispose();
    }
    this.patternParts.length = 0;
    for (const { material } of this.outlines) material.dispose();
    this.outlines = [];

    this.sparks.forEach((spark, index) => {
      const at = pattern.sparks[index];
      const twin = this.mirrored[index];
      spark.visible = twin.visible = !!at;
      if (!at) return;
      const shape = pattern.shapes[at.burst];
      spark.material = this.sparkMaterials[shape];
      twin.material = this.mirrorMaterials[shape];
      const size = shape === 'star' ? 1.05 : 1.0;
      spark.scale.setScalar(size);
      twin.scale.setScalar(size * 1.3);
      spark.position.set(at.x, at.y, 0);
      twin.position.set(at.x, at.y, 0);
    });
    for (const place of pattern.empty) {
      const ring = new Mesh(this.ringGeometry, this.ringMaterial);
      ring.position.set(place.x, place.y, -0.02);
      this.patternParts.push(ring);
      this.burst.add(ring);
    }
    for (const box of pattern.frames) {
      const frame = new Mesh(boxRing(box, 0.05), this.frameMaterial);
      frame.position.set(box.x, box.y, -0.03);
      frame.rotation.z = box.angle;
      this.patternParts.push(frame);
      this.burst.add(frame);
    }
    for (const box of pattern.groups) {
      const material = new MeshBasicMaterial({
        color: '#fff2b8',
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const mesh = new Mesh(boxRing({ ...box, w: box.w + 0.15, h: box.h + 0.15 }, 0.1), material);
      mesh.position.set(box.x, box.y, -0.01);
      mesh.rotation.z = box.angle;
      mesh.renderOrder = 4;
      this.patternParts.push(mesh);
      this.outlines.push({ mesh, material });
      this.burst.add(mesh);
    }
    this.hue.set(HUES[pattern.hue]);
    this.ringMaterial.color.copy(this.hue);

    // The pattern's whole extent, so it can be fitted to the sky.
    const xs: number[] = [];
    const ys: number[] = [];
    for (const p of [...pattern.sparks, ...pattern.empty]) {
      xs.push(p.x - 0.5, p.x + 0.5);
      ys.push(p.y - 0.5, p.y + 0.5);
    }
    for (const box of [...pattern.frames, ...pattern.groups]) {
      const c = Math.abs(Math.cos(box.angle));
      const s = Math.abs(Math.sin(box.angle));
      const hw = (box.w * c + box.h * s) / 2 + 0.1;
      const hh = (box.w * s + box.h * c) / 2 + 0.1;
      xs.push(box.x - hw, box.x + hw);
      ys.push(box.y - hh, box.y + hh);
    }
    // Leave room for the 15 % re-bloom.
    this.patternWidth = Math.max(3, Math.max(...xs) - Math.min(...xs)) * 1.12;
    this.patternHeight = Math.max(3, Math.max(...ys) - Math.min(...ys)) * 1.12;
    this.fitPattern();
  }

  /** How bright the pattern is now, from the phase and how long it has run. */
  private patternGlow(t: number, frame: FireworkFrame): number {
    const age = t - this.phaseAt;
    switch (this.phase) {
      case 'look': {
        const since = t - this.burstAt;
        // Glows up, then dims a little across the look so the time draining is visible.
        const hold = Math.min(1, Math.max(0, since / Math.max(0.1, frame.look)));
        return sparkGlow(Math.min(since, frame.look - 0.001), frame.look) * (1 - 0.22 * hold);
      }
      case 'fade':
        return this.glowFrom * (1 - smooth(age / FADE_OUT));
      case 'bloom':
        return mix(this.glowFrom, 1, smooth(age / 0.4));
      case 'fizzle':
        // A soft fizzle: the sparks go ash-gold, sag and dim over a second.
        return this.glowFrom * (1 - smooth(age / 1.1));
      default:
        return this.glowFrom * (1 - smooth(age / 0.5));
    }
  }

  private updatePattern(t: number, frame: FireworkFrame, calm: boolean) {
    const glow = this.patternGlow(t, frame);
    this.glow = glow;
    const age = t - this.phaseAt;
    // A fresh burst spreads out from its centre; under calm motion it fades in in place.
    const spread =
      calm || this.phase !== 'look' ? 1 : mix(0.35, 1, easeOut((t - this.burstAt) / 0.45));
    const droop =
      this.phase === 'fade'
        ? smooth(age / FADE_OUT) * 0.35
        : this.phase === 'fizzle'
          ? smooth(age / 0.8) * 0.8
          : 0;
    const bloom = this.phase === 'bloom' && !calm ? mix(1, 1.15, easeOutBack(age / 0.5)) : 1;
    this.burst.scale.setScalar(this.scale * bloom);
    this.burst.position.y = BURST_Y - droop * this.scale;
    this.reflection.scale.set(this.scale * bloom, -this.scale * REFLECT * bloom, this.scale);
    const pattern = this.pattern!;
    const shimmer = calm ? 0 : 1;
    this.sparks.forEach((spark, index) => {
      const at = pattern.sparks[index];
      if (!at) return;
      const fall = this.phase === 'fizzle' ? smooth(age / 1.1) * (0.25 + (index % 3) * 0.2) : 0;
      spark.position.set(at.x * spread, at.y * spread - fall, 0);
      const twin = this.mirrored[index];
      twin.position.set(
        at.x * spread + Math.sin(t * 2.3 + at.y * 3) * 0.08 * shimmer,
        at.y * spread - fall,
        0,
      );
    });
    // Colour: the firework's own hue, brighter on the re-bloom, ash-gold in a fizzle.
    const tint = this.hue.clone();
    if (this.phase === 'bloom') tint.lerp(this.white, 0.15 * smooth(age / 0.4));
    if (this.phase === 'fizzle') tint.lerp(this.ember, smooth(age / 0.4));
    for (const material of Object.values(this.sparkMaterials)) {
      material.color.copy(tint);
      material.opacity = glow;
    }
    for (const material of Object.values(this.mirrorMaterials)) {
      material.color.copy(tint);
      material.opacity = glow * 0.32;
    }
    this.ringMaterial.opacity = glow * 0.45;
    this.frameMaterial.opacity = glow * 0.3;
    // Group outlines: shown after a second miss, and drawn one after another on the re-bloom.
    this.outlines.forEach(({ mesh, material }, index) => {
      let show = frame.outlines && (this.phase === 'look' || this.phase === 'fade') ? glow : 0;
      if (this.phase === 'bloom') {
        const reveal = smooth((age - 0.35 - index * 0.4) / 0.3);
        show = reveal * glow;
        mesh.scale.setScalar(calm ? 1 : mix(1.12, 1, easeOut((age - 0.35 - index * 0.4) / 0.4)));
      } else mesh.scale.setScalar(1);
      material.opacity = show * 0.9;
    });
  }

  // ------------------------------------------------------------------------------------------
  // Events
  // ------------------------------------------------------------------------------------------

  private celebrate(frame: FireworkFrame) {
    const t = this.elapsed;
    this.bloomAt = t;
    const pattern = frame.pattern;
    const calm = this.calm;
    // Confetti embers in the firework's colours drift out from the sparks.
    const colors = [
      new Color(HUES[pattern.hue]),
      new Color('#fff4c2'),
      new Color(HUES[(pattern.hue + 2) % HUES.length]),
    ];
    pattern.sparks.forEach((spark, index) => {
      for (let k = 0; k < 2; k++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = calm ? 0.2 : 0.8 + Math.random() * 1.4;
        this.particles.add(
          t + 0.15,
          spark.x * this.scale * 1.15,
          BURST_Y + spark.y * this.scale * 1.15,
          0.1,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed + (calm ? -0.2 : 0.4),
          colors[(index + k) % colors.length],
          1.8,
          { gravity: calm ? 0 : 1.2, drag: 0.8, hold: 0.4 },
        );
      }
    });
    if (frame.finale) {
      this.shapeAt = t + 0.5;
      this.bloomShape(frame, t + 0.5, 0, BURST_Y, Math.min(this.viewWidth * 0.46, 3.1));
    }
  }

  private fizzle() {
    const t = this.elapsed;
    this.fizzleAt = t;
    const pattern = this.pattern;
    if (!pattern) return;
    // Embers drift down from every spark, slowly, never alarming.
    pattern.sparks.forEach((spark) => {
      for (let k = 0; k < 2; k++)
        this.particles.add(
          t + 0.15 + k * 0.25,
          spark.x * this.scale + (Math.random() - 0.5) * 0.3,
          BURST_Y + spark.y * this.scale,
          0.1,
          (Math.random() - 0.5) * 0.4,
          -0.2 - Math.random() * 0.35,
          this.ember,
          1.5,
          { gravity: 0.35, drag: 0.6, hold: 0.45 },
        );
    });
  }

  private startShow(frame: FireworkFrame) {
    const t = this.elapsed;
    this.showAt = t;
    this.showBursts.length = 0;
    const hues = frame.launched.length ? frame.launched : [0, 1, 2, 3];
    const halfWidth = Math.max(1.5, this.viewWidth * 0.36);
    hues.forEach((hue, index) => {
      const side = index % 2 ? 1 : -1;
      const spread = ((index * 0.618) % 1) * halfWidth;
      this.showBursts.push({
        at: t + index * 0.32,
        x: side * spread,
        y: BURST_BOTTOM + 1.2 + ((index * 0.37) % 1) * (BURST_TOP - BURST_BOTTOM - 2.2),
        hue,
        done: false,
      });
    });
    this.shapeAt = t + hues.length * 0.32 + 0.3;
    this.bloomShape(frame, this.shapeAt, 0, BURST_Y + 0.3, Math.min(halfWidth, 2.8));
  }

  /** The level's book shape as a big rainbow firework, made of sparks along its outline. */
  private bloomShape(frame: FireworkFrame, at: number, x: number, y: number, size: number) {
    const calm = this.calm;
    const color = new Color();
    for (const point of shapePoints(frame.shape, 64)) {
      color.setHSL(point.t, 0.75, 0.68);
      const tx = x + point.x * size;
      const ty = y + point.y * size;
      if (calm) {
        this.particles.add(at, tx, ty, 0.2, 0, 0, color, 2.6, { hold: 0.65 });
      } else {
        // The sparks fly out from the middle and settle on the outline.
        this.particles.add(
          at,
          x + point.x * size * 0.2,
          y + point.y * size * 0.2,
          0.2,
          point.x * size * 3.2,
          point.y * size * 3.2,
          color,
          2.6,
          {
            drag: 4,
            gravity: 0.15,
            hold: 0.6,
          },
        );
      }
    }
  }

  private peony(t: number, x: number, y: number, hue: number, calm: boolean) {
    const color = new Color(HUES[hue]);
    const count = 26;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      if (calm) {
        this.particles.add(
          t,
          x + Math.cos(angle) * 1.1,
          y + Math.sin(angle) * 1.1,
          -0.1,
          0,
          0,
          color,
          1.6,
          { hold: 0.5 },
        );
      } else {
        const speed = 2.6 + (i % 2) * 0.5;
        this.particles.add(
          t,
          x,
          y,
          -0.1,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed,
          color,
          1.7,
          {
            drag: 1.8,
            gravity: 0.9,
            hold: 0.35,
          },
        );
      }
    }
  }

  // ------------------------------------------------------------------------------------------
  // The frame loop
  // ------------------------------------------------------------------------------------------

  protected update(dt: number, t: number) {
    const frame = this.frame;
    if (!frame || !this.pattern) return;
    const calm = this.calm;
    this.updatePattern(t, frame, calm);
    this.updateRocket(t, frame, calm);

    for (const burst of this.showBursts) {
      if (burst.done || t < burst.at) continue;
      burst.done = true;
      if (!calm) {
        // A short trail up to the burst.
        for (let i = 0; i < 8; i++)
          this.particles.add(
            t - 0.05 * i,
            burst.x,
            burst.y - i * 0.22,
            -0.1,
            0,
            -0.2,
            new Color('#ffe8b0'),
            0.5,
          );
      }
      this.peony(t, burst.x, burst.y, burst.hue, calm);
    }

    this.updateFox(t, frame, calm);
    this.updateCrowd(t, frame, calm);
    this.particles.update(t, dt);
  }

  private updateRocket(t: number, frame: FireworkFrame, calm: boolean) {
    const rising = this.phase === 'launch' && !calm;
    const k = (t - this.launchedAt) / RISE;
    this.rocket.visible = rising && k >= 0 && k < 1;
    if (!this.rocket.visible) return;
    const e = easeOut(k);
    const x = mix(this.rocketFrom.x, 0, smooth(k));
    const y = mix(this.rocketFrom.y, BURST_Y, e);
    this.rocket.position.set(x, y, 0.2);
    const dx = (0 - this.rocketFrom.x) / RISE;
    this.rocket.rotation.z = Math.atan2(-dx * 0.25, 1);
    // A trail of sparks; a golden glitter trail in the Big show.
    const big = frame.bigShow;
    const gold = new Color(big ? '#ffd45c' : '#ffe9c4');
    for (let i = 0; i < (big ? 3 : 1); i++) {
      this.particles.add(
        t,
        x + (big ? (Math.random() - 0.5) * 0.25 : 0),
        y - 0.25,
        0.15,
        big ? (Math.random() - 0.5) * 0.6 : 0,
        big ? -0.4 - Math.random() * 0.6 : -0.3,
        gold,
        big ? 0.9 : 0.45,
        { gravity: big ? 0.8 : 0 },
      );
    }
  }

  // ------------------------------------------------------------------------------------------
  // Flick and the crowd
  // ------------------------------------------------------------------------------------------

  private updateFox(t: number, frame: FireworkFrame, calm: boolean) {
    const idle = calm ? 0 : 1;
    // Breathing and a lazy tail.
    this.foxBody.scale.y = 1 + Math.sin(t * 2) * 0.012 * idle;
    this.foxTail.rotation.y = Math.sin(t * 1.3) * 0.18 * idle;
    this.scarfEnd.rotation.z = -0.25 + Math.sin(t * 2.6) * 0.12 * idle;

    // Lighting the fuse: the paw with the taper dips to the tube while the rocket starts.
    const lit = t - this.launchedAt;
    const lighting = this.phase === 'launch' ? 1 - smooth((lit - 0.35) / 0.3) : 0;
    // Looking up at the burst.
    const watching =
      this.phase === 'look' ||
      this.phase === 'fade' ||
      this.phase === 'bloom' ||
      this.phase === 'show';
    const peek = t - this.peekAt;
    const peeking = peek >= 0 && peek < 1.8;
    const show = this.phase === 'show';
    const duck = t - this.fizzleAt;
    const ducking = duck >= 0 && duck < 1.3 ? Math.sin((duck / 1.3) * Math.PI) : 0;
    const cheer = t - this.bloomAt;
    const hop = !calm && cheer >= 0 && cheer < 0.8 ? Math.sin((cheer / 0.8) * Math.PI) * 0.18 : 0;

    this.taper.visible = lighting > 0 && !peeking;
    this.telescope.visible = peeking;
    this.sparkler.visible = show;
    // The arm hangs from the shoulder; turning it forward (+z rotation) raises the paw.
    const armTarget = peeking
      ? 2.5
      : show
        ? 2.85 + Math.sin(t * 5) * 0.3 * idle
        : lighting > 0
          ? mix(0.15, 0.75, lighting)
          : 0.15;
    this.foxArm.rotation.z = armTarget;
    this.foxHead.rotation.z = peeking ? 0.25 : watching ? 0.32 : lighting > 0 ? -0.15 : 0.05;
    // A laugh: the head bobs while Flick ducks.
    this.foxHead.rotation.x = ducking * Math.sin(duck * 18) * 0.12 * idle;
    this.fox.scale.y = 1 - ducking * 0.14;
    this.fox.position.y = JETTY_Y + 0.06 + hop;

    // The sparkler throws tiny golden sparks.
    if (show && !calm) {
      this.sparkler.updateMatrixWorld(true);
      const tip = this.sparkler.localToWorld(this.probe.set(0, 0.42, 0));
      const gold = new Color('#ffd45c');
      for (let i = 0; i < 2; i++) {
        const a = Math.random() * Math.PI * 2;
        this.particles.add(
          t,
          tip.x,
          tip.y,
          tip.z,
          Math.cos(a) * 0.7,
          Math.sin(a) * 0.7,
          gold,
          0.35,
          { gravity: 1 },
        );
      }
    }
  }

  private updateCrowd(t: number, frame: FireworkFrame, calm: boolean) {
    const ooh = t - this.burstAt;
    const cheer = t - this.bloomAt;
    for (const creature of this.crowd) {
      if (!creature.holder.visible) continue;
      // "Ooh": heads lift as a burst opens. "Aah": a happy bounce on a right answer.
      const look =
        ooh >= 0 && ooh < 1.2 && this.phase === 'look' ? Math.sin((ooh / 1.2) * Math.PI) : 0;
      const bounce =
        !calm && cheer >= 0 && cheer < 1.4
          ? Math.abs(Math.sin((cheer + creature.phase * 0.2) * 9)) * 0.16 * (1 - cheer / 1.4)
          : 0;
      const sway = calm ? 0 : Math.sin(t * 1.2 + creature.phase) * 0.02;
      creature.body.position.y = bounce;
      creature.body.rotation.z = sway;
      creature.head.rotation.x = -look * 0.3;
      // Lanterns go up in the Big show.
      const lift = frame.bigShow ? 1 : 0;
      const s = creature.lantern.scale.x + (lift - creature.lantern.scale.x) * 0.08;
      creature.lantern.scale.setScalar(Math.max(0.001, s));
      creature.lantern.position.y = 0.95 + (calm ? 0 : Math.sin(t * 2 + creature.phase) * 0.04);
    }
  }

  // ------------------------------------------------------------------------------------------
  // Building the lakeside
  // ------------------------------------------------------------------------------------------

  private buildStars() {
    const random = seededRandom(7);
    const count = 140;
    const position = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      position.set([(random() - 0.5) * 110, 4 + random() * 24, -30], i * 3);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(position, 3));
    const stars = new Points(
      geometry,
      new PointsMaterial({
        size: 0.35,
        map: this.glowMap,
        color: '#d9d4ff',
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
      }),
    );
    this.scene.add(stars);
  }

  private buildTown() {
    const random = seededRandom(11);
    const hill = new MeshStandardMaterial({ color: '#2a2152', roughness: 1 });
    const wall = new MeshStandardMaterial({ color: '#3a2d63', roughness: 0.9 });
    const roof = new MeshStandardMaterial({ color: '#2b2050', roughness: 0.9 });
    const window = new MeshBasicMaterial({ color: '#ffcf7a' });
    const hills = new Mesh(new SphereGeometry(1, 24, 12), hill);
    hills.scale.set(60, 0.75, 2);
    hills.position.set(0, -0.6, -4.5);
    this.town.add(hills);
    const box = new BoxGeometry(1, 1, 1);
    const cone = new ConeGeometry(0.75, 0.6, 4);
    const pane = new PlaneGeometry(0.12, 0.16);
    for (let x = -26; x < 26;) {
      const w = 0.45 + random() * 0.5;
      const h = 0.3 + random() * 0.4;
      const house = new Mesh(box, wall);
      house.scale.set(w, h, 0.6);
      house.position.set(x + w / 2, -0.45 + h / 2, -4);
      const top = new Mesh(cone, roof);
      top.scale.set(w * 0.95, 0.45 + random() * 0.3, 0.6);
      top.rotation.y = Math.PI / 4;
      top.position.set(x + w / 2, -0.45 + h + top.scale.y * 0.3, -4);
      this.town.add(house, top);
      const lights = 1 + Math.floor(random() * 2);
      for (let i = 0; i < lights; i++) {
        const glow = new Mesh(pane, window);
        glow.position.set(x + (w * (i + 1)) / (lights + 1), -0.45 + h * 0.55, -3.69);
        this.town.add(glow);
      }
      x += w + 0.15 + random() * (Math.abs(x) < 4 ? 0.3 : 1.4);
    }
    // A string of lanterns over the far shore.
    const lanternColors = ['#ffb347', '#ff9ccf', '#8fd3ff', '#ffe066', '#b7f0a0'];
    const bulb = new SphereGeometry(0.07, 10, 8);
    for (let x = -24; x <= 24; x += 0.55) {
      const sag = ((x % 3.3) + 3.3) % 3.3;
      const y = 0.68 - Math.sin((sag / 3.3) * Math.PI) * 0.18;
      const lamp = new Mesh(
        bulb,
        new MeshBasicMaterial({ color: lanternColors[Math.round(x / 0.55 + 100) % 5] }),
      );
      lamp.position.set(x, y, -3.3);
      this.town.add(lamp);
    }
    this.scene.add(this.town);
  }

  private buildBank() {
    const shape = new Shape();
    shape.moveTo(-60, -4);
    shape.lineTo(-60, -2.75);
    for (let x = -60; x <= 60; x += 1)
      shape.lineTo(x, -2.62 + Math.sin(x * 0.9) * 0.08 + Math.sin(x * 2.3) * 0.04);
    shape.lineTo(60, -4);
    const bank = new Mesh(
      new ShapeGeometry(shape),
      new MeshStandardMaterial({ color: '#2b3a52', roughness: 1 }),
    );
    bank.position.z = BANK_Z;
    this.scene.add(bank);
    return bank;
  }

  private buildJetty() {
    const wood = new MeshStandardMaterial({ color: '#8a5a36', roughness: 0.85 });
    const dark = new MeshStandardMaterial({ color: '#5e3c24', roughness: 0.9 });
    const deck = new Mesh(new BoxGeometry(1.9, 0.12, 2.6), wood);
    deck.position.set(0, JETTY_Y - 0.06, 0.55);
    this.jetty.add(deck);
    for (const [x, z] of [
      [-0.85, -0.6],
      [0.85, -0.6],
      [-0.85, 0.9],
      [0.85, 0.9],
    ]) {
      const post = new Mesh(new CylinderGeometry(0.07, 0.07, 0.9, 10), dark);
      post.position.set(x, JETTY_Y - 0.35, z);
      this.jetty.add(post);
    }
    // A lantern post at the end of the jetty.
    const pole = new Mesh(new CylinderGeometry(0.035, 0.035, 1.2, 8), dark);
    pole.position.set(-0.78, JETTY_Y + 0.6, -0.5);
    const lamp = new Mesh(
      new SphereGeometry(0.11, 12, 10),
      new MeshBasicMaterial({ color: '#ffcf7a' }),
    );
    lamp.position.set(-0.78, JETTY_Y + 1.25, -0.5);
    this.jetty.add(pole, lamp);
    this.scene.add(this.jetty);

    // The launch tube Flick lights the rockets in.
    const paper = new MeshStandardMaterial({ color: '#2f8f9a', roughness: 0.7 });
    const tube = new Mesh(new CylinderGeometry(0.13, 0.15, 0.5, 14), paper);
    tube.position.y = JETTY_Y + 0.25;
    const band = new Mesh(
      new CylinderGeometry(0.155, 0.155, 0.08, 14),
      new MeshStandardMaterial({ color: '#ffd45c' }),
    );
    band.position.y = JETTY_Y + 0.3;
    this.tube.add(tube, band);
    this.tube.position.z = 0.3;
    this.scene.add(this.tube);
  }

  private buildRocket() {
    const body = new Mesh(
      new CylinderGeometry(0.07, 0.07, 0.36, 10),
      new MeshStandardMaterial({ color: '#ffd45c', emissive: '#6b4a00' }),
    );
    const tip = new Mesh(
      new ConeGeometry(0.08, 0.16, 10),
      new MeshStandardMaterial({ color: '#7cc8ff', emissive: '#1d4a6b' }),
    );
    tip.position.y = 0.26;
    const flame = new Sprite(
      new SpriteMaterial({
        map: this.glowMap,
        color: '#ffd9a0',
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    );
    flame.scale.setScalar(0.4);
    flame.position.y = -0.22;
    this.rocket.add(body, tip, flame);
    this.rocket.visible = false;
    this.scene.add(this.rocket);
  }

  /**
   * Flick: a fox sitting up on the jetty, three-quarters toward the sky. A slim body and chest,
   * a long snout, big pointed ears with dark tips, slim legs with dark socks and a big bushy tail
   * with a white tip, plus brass goggles pushed up on the forehead and a teal scarf.
   */
  private buildFox() {
    const orange = new MeshStandardMaterial({ color: '#e0782f', roughness: 0.75 });
    const cream = new MeshStandardMaterial({ color: '#fff0d8', roughness: 0.8 });
    const sock = new MeshStandardMaterial({ color: '#3b2418', roughness: 0.8 });
    const brass = new MeshStandardMaterial({ color: '#d6a63f', metalness: 0.6, roughness: 0.35 });
    const lens = new MeshStandardMaterial({
      color: '#9fe3ff',
      emissive: '#2d6f8c',
      roughness: 0.1,
    });
    const scarf = new MeshStandardMaterial({ color: '#2fb5a8', roughness: 0.7 });
    const eyeMaterial = new MeshStandardMaterial({ color: '#1d130c', roughness: 0.3 });
    const sphere = new SphereGeometry(1, 24, 18);
    const part = (
      material: Material,
      sx: number,
      sy: number,
      sz: number,
      x: number,
      y: number,
      z: number,
    ) => {
      const mesh = new Mesh(sphere, material);
      mesh.scale.set(sx, sy, sz);
      mesh.position.set(x, y, z);
      return mesh;
    };

    // Haunches, body and chest: a sitting fox leans its chest up and forward.
    const haunch = part(orange, 0.36, 0.32, 0.3, -0.12, 0.3, 0);
    const body = part(orange, 0.24, 0.42, 0.24, 0.08, 0.62, 0);
    body.rotation.z = -0.45;
    const chest = part(cream, 0.15, 0.3, 0.17, 0.2, 0.66, 0.05);
    chest.rotation.z = -0.4;
    const thigh = part(orange, 0.2, 0.22, 0.12, -0.08, 0.26, 0.2);
    const foot = part(orange, 0.16, 0.06, 0.08, 0.06, 0.05, 0.23);
    this.foxBody.add(haunch, body, chest, thigh, foot);

    // Slim front legs with dark socks; the near one is the arm that lights fuses.
    const leg = new CylinderGeometry(0.045, 0.04, 0.5, 10);
    const farLeg = new Mesh(leg, orange);
    farLeg.position.set(0.28, 0.27, -0.1);
    const farSock = new Mesh(new CylinderGeometry(0.045, 0.05, 0.16, 10), sock);
    farSock.position.set(0.28, 0.07, -0.1);
    this.foxBody.add(farLeg, farSock);
    const upper = new Mesh(leg, orange);
    upper.position.y = -0.25;
    const paw = new Mesh(new CylinderGeometry(0.045, 0.05, 0.16, 10), sock);
    paw.position.y = -0.52;
    this.foxArm.add(upper, paw);
    this.foxArm.position.set(0.28, 0.6, 0.1);
    // What the paw holds: a glowing taper, a telescope, or a sparkler at the show.
    const stick = new Mesh(
      new CylinderGeometry(0.015, 0.015, 0.4, 6),
      new MeshStandardMaterial({ color: '#c8b28a' }),
    );
    stick.position.y = 0.15;
    const flame = new Sprite(
      new SpriteMaterial({
        map: this.glowMap,
        color: '#ffc46b',
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    );
    flame.scale.setScalar(0.22);
    flame.position.y = 0.36;
    this.taper.add(stick, flame);
    this.taper.position.y = -0.55;
    this.taper.rotation.z = Math.PI;
    const glass = new Mesh(new CylinderGeometry(0.05, 0.075, 0.5, 14), brass);
    glass.rotation.z = Math.PI / 2;
    glass.position.set(0.18, 0, 0);
    this.telescope.add(glass);
    // Held at the eye and pointing up at the sky (the arm itself is turned up by 2.5 rad).
    this.telescope.position.set(0.02, -0.5, 0.04);
    this.telescope.rotation.z = -1.5;
    const wand = new Mesh(
      new CylinderGeometry(0.012, 0.012, 0.5, 6),
      new MeshStandardMaterial({ color: '#9a9aa6', metalness: 0.6 }),
    );
    wand.position.y = 0.2;
    const fizz = new Sprite(
      new SpriteMaterial({
        map: this.glowMap,
        color: '#ffe08a',
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    );
    fizz.scale.setScalar(0.32);
    fizz.position.y = 0.44;
    this.sparkler.add(wand, fizz);
    this.sparkler.position.y = -0.55;
    this.sparkler.rotation.z = Math.PI;
    this.foxArm.add(this.taper, this.telescope, this.sparkler);
    this.foxBody.add(this.foxArm);

    // The head: round skull, long tapering snout with a dark nose, cream cheeks.
    const skull = part(orange, 0.2, 0.18, 0.18, 0, 0, 0);
    const snout = new Mesh(new ConeGeometry(0.1, 0.32, 16), orange);
    snout.rotation.z = -Math.PI / 2;
    snout.scale.set(1, 1, 0.85);
    snout.position.set(0.27, -0.05, 0);
    const jaw = new Mesh(new ConeGeometry(0.08, 0.26, 14), cream);
    jaw.rotation.z = -Math.PI / 2;
    jaw.position.set(0.24, -0.1, 0);
    const nose = part(sock, 0.035, 0.03, 0.035, 0.43, -0.05, 0);
    const cheekNear = part(cream, 0.1, 0.08, 0.06, 0.08, -0.08, 0.13);
    const cheekFar = part(cream, 0.1, 0.08, 0.06, 0.08, -0.08, -0.13);
    const eyeNear = part(eyeMaterial, 0.032, 0.036, 0.02, 0.14, 0.03, 0.12);
    const eyeFar = part(eyeMaterial, 0.032, 0.036, 0.02, 0.14, 0.03, -0.12);
    this.foxHead.add(skull, snout, jaw, nose, cheekNear, cheekFar, eyeNear, eyeFar);
    for (const side of [-1, 1]) {
      const ear = new Mesh(new ConeGeometry(0.1, 0.3, 4), orange);
      ear.scale.set(1, 1, 0.45);
      ear.position.set(-0.04, 0.24, side * 0.1);
      ear.rotation.set(side * -0.25, 0, 0.08);
      const inner = new Mesh(new ConeGeometry(0.06, 0.2, 4), cream);
      inner.scale.set(1, 1, 0.3);
      inner.position.set(0.02, -0.02, 0);
      const tip = new Mesh(new ConeGeometry(0.045, 0.1, 4), sock);
      tip.position.y = 0.11;
      ear.add(inner, tip);
      this.foxHead.add(ear);
      // Brass goggles pushed up on the forehead.
      const ring = new Mesh(new TorusGeometry(0.055, 0.018, 8, 18), brass);
      ring.position.set(0.12, 0.12, side * 0.075);
      ring.rotation.y = Math.PI / 2 - 0.3 * side;
      const glassDisc = part(lens, 0.012, 0.05, 0.05, 0.125, 0.12, side * 0.075);
      this.foxHead.add(ring, glassDisc);
    }
    // The goggle strap wraps round the head just above the eyes.
    const strap = new Mesh(
      new TorusGeometry(0.185, 0.016, 6, 30),
      new MeshStandardMaterial({ color: '#5a3a24' }),
    );
    strap.position.set(0.0, 0.11, 0);
    strap.rotation.set(Math.PI / 2, -0.25, 0);
    this.foxHead.add(strap);
    this.foxHead.position.set(0.3, 1.04, 0);
    this.foxBody.add(this.foxHead);

    // The scarf, with an end that flutters.
    const wrap = new Mesh(new TorusGeometry(0.15, 0.055, 10, 24), scarf);
    wrap.position.set(0.24, 0.86, 0);
    wrap.rotation.set(Math.PI / 2, 0.35, 0);
    const end = new Mesh(new BoxGeometry(0.1, 0.3, 0.04), scarf);
    end.position.y = -0.15;
    this.scarfEnd.add(end);
    this.scarfEnd.position.set(0.12, 0.84, 0.13);
    this.foxBody.add(wrap, this.scarfEnd);

    // The big bushy tail curls around the haunches, ending in a white tip.
    const tailBits: [number, number, number, number, Material][] = [
      [-0.42, 0.18, 0.05, 0.15, orange],
      [-0.56, 0.12, 0.2, 0.19, orange],
      [-0.5, 0.08, 0.42, 0.18, orange],
      [-0.3, 0.07, 0.55, 0.15, orange],
      [-0.1, 0.07, 0.58, 0.11, cream],
    ];
    for (const [x, y, z, r, material] of tailBits)
      this.foxTail.add(part(material, r * 1.15, r * 0.8, r, x, y, z));
    this.foxBody.add(this.foxTail);

    for (const mesh of [haunch, body]) mesh.castShadow = false;
    this.fox.add(this.foxBody);
    this.fox.rotation.y = -0.55;
    this.fox.scale.setScalar(1);
    this.fox.position.set(0, JETTY_Y, 0.25);
    this.scene.add(this.fox);
  }

  private buildCrowd() {
    const random = seededRandom(23);
    const colors = ['#3f3270', '#4a3478', '#34386e', '#523a6e', '#3a2f62'];
    const sphere = new SphereGeometry(1, 18, 14);
    const bulbColors = ['#ffcf7a', '#ff9ccf', '#8fd3ff', '#b7f0a0'];
    for (let i = 0; i < 18; i++) {
      const material = new MeshStandardMaterial({
        color: colors[i % colors.length],
        emissive: '#1a1238',
        roughness: 0.9,
      });
      const group = new Group();
      const big = 0.85 + random() * 0.3;
      const body = new Mesh(sphere, material);
      body.scale.set(0.27, 0.3, 0.24);
      body.position.y = 0.28;
      const head = new Group();
      const skull = new Mesh(sphere, material);
      skull.scale.setScalar(0.17);
      head.add(skull);
      head.position.y = 0.66;
      const kind = i % 4;
      for (const side of [-1, 1]) {
        let ear: Mesh;
        if (kind === 0) {
          // A bunny: long ears.
          ear = new Mesh(sphere, material);
          ear.scale.set(0.045, 0.17, 0.04);
          ear.position.set(side * 0.07, 0.24, 0);
          ear.rotation.z = -side * 0.15;
        } else if (kind === 1) {
          // A cat: pointed ears.
          ear = new Mesh(new ConeGeometry(0.06, 0.13, 4), material);
          ear.position.set(side * 0.1, 0.15, 0);
          ear.rotation.z = -side * 0.3;
        } else if (kind === 2) {
          // A bear cub: round ears.
          ear = new Mesh(sphere, material);
          ear.scale.setScalar(0.06);
          ear.position.set(side * 0.13, 0.12, 0);
        } else {
          // A little owl: feather tufts.
          ear = new Mesh(new ConeGeometry(0.035, 0.1, 6), material);
          ear.position.set(side * 0.09, 0.16, 0);
          ear.rotation.z = -side * 0.5;
        }
        head.add(ear);
      }
      // Two bright eyes catch the firework light.
      for (const side of [-1, 1]) {
        const eye = new Mesh(sphere, new MeshBasicMaterial({ color: '#f3eaff' }));
        eye.scale.setScalar(0.022);
        eye.position.set(side * 0.06, 0.02, 0.155);
        head.add(eye);
      }
      const lantern = new Group();
      const pole = new Mesh(
        new CylinderGeometry(0.018, 0.018, 0.5, 6),
        new MeshStandardMaterial({ color: '#8a6a4b' }),
      );
      pole.position.y = -0.2;
      const bulb = new Mesh(
        sphere,
        new MeshBasicMaterial({ color: bulbColors[i % bulbColors.length] }),
      );
      bulb.scale.set(0.11, 0.14, 0.11);
      bulb.position.y = 0.08;
      lantern.add(pole, bulb);
      lantern.position.set(0.18, 0.95, 0.05);
      lantern.scale.setScalar(0.001);
      group.add(body, head, lantern);
      group.scale.setScalar(big);
      const holder = new Group();
      holder.add(group);
      holder.position.set(0, -2.62, BANK_Z + 0.15);
      this.crowdRoot.add(holder);
      this.crowd.push({ holder, body: group, head, lantern, phase: random() * 6 });
    }
    this.scene.add(this.crowdRoot);
  }

  override dispose() {
    for (const mesh of this.patternParts)
      if (mesh.geometry !== this.ringGeometry) mesh.geometry.dispose();
    for (const { material } of this.outlines) material.dispose();
    this.ringGeometry.dispose();
    this.ringMaterial.dispose();
    this.frameMaterial.dispose();
    for (const material of [
      ...Object.values(this.sparkMaterials),
      ...Object.values(this.mirrorMaterials),
    ])
      material.dispose();
    this.glowMap.dispose();
    this.starMap.dispose();
    (this.scene.background as CanvasTexture | null)?.dispose();
    this.particles.points.geometry.dispose();
    (this.particles.points.material as Material).dispose();
    super.dispose();
  }
}
