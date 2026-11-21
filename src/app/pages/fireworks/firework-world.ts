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
import { FADE_OUT, FireworkFrame, FireworkPhase, RISE, SHOW, sparkGlow } from './firework-frame';
import { Box, HUES, Pattern } from './firework-levels';
import { mergeByMaterial } from './firework-merge';
import {
  Cue,
  finaleCues,
  OPEN,
  openSpread,
  rocketAt,
  RocketPoint,
  shapeGlow,
  shapeSpread,
  ShellKind,
  skyLevel,
} from './firework-shells';
import { BookShape, shapePoints } from './firework-shapes';
import { Cell, FireworkSparks } from './firework-sparks';
import { buildTown, seededRandom } from './firework-town';

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

/** The pinned spark slots: the pattern, its reflection, the rocket's head and two book shapes. */
const SHAPE_SPARKS = 96;
const PATTERN_SLOT = 0;
const MIRROR_SLOT = PATTERN_SLOT + MAX_SPARKS;
const ROCKET_SLOT = MIRROR_SLOT + MAX_SPARKS;
const SHAPE_SLOT = ROCKET_SLOT + 2;
const SHAPES = 2;
const PINNED = SHAPE_SLOT + SHAPES * SHAPE_SPARKS * 2;
/** Free sparks in flight at once: a full finale stays well under this. */
const FREE_SPARKS = 2600;
/** Sky lights remembered at once; older ones have long faded. */
const LIGHTS = 16;
/** Show rockets in flight at once, for their trails. */
const MAX_CUES = 32;
/** Trail sparks are laid this far apart, so a trail stays even at any frame rate. */
const TRAIL_STEP = 0.035;

/** Smoothly from `a` to `b` as `t` runs 0 → 1. */
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
/** Where something at height `y` shows in the lake. */
const mirrorY = (y: number) => -0.15 - REFLECT * y;

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

/** A very soft wash of light, brightest in the middle: the lit sky and the lit lake. */
function washTexture() {
  return texture(128, (c, s) => {
    const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.5)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.12)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, s, s);
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

interface Creature {
  /** Placed along the bank by the layout. */
  readonly holder: Group;
  /** Bounces and sways inside the holder. */
  readonly body: Group;
  readonly head: Group;
  readonly lantern: Group;
  readonly phase: number;
}

/** A burst that lights the sky and the lake for a moment. */
interface Light {
  at: number;
  light: number;
  x: number;
  y: number;
  readonly color: Color;
}

/** A book shape drawn in sparks along its outline. */
interface ShapeBurst {
  at: number;
  x: number;
  y: number;
  size: number;
  glittered: boolean;
  readonly points: Float32Array;
  readonly colors: Color[];
}

/**
 * The Firework Show in 3D: a lake at dusk with a lantern-lit town on the far shore, a crowd of
 * fairyland creatures on the near bank, and Flick the fox on the jetty lighting rockets.
 *
 * A rocket climbs on a sparkling trail, wobbling and slowing to a breath before it bursts. Each
 * burst is a layered shell: a core flash, the pattern's stars flying out on comet tails to their
 * exact places (so the structure stays crisp for counting), a crackle round the edge, glitter
 * that falls and fades, a puff of smoke lit in the burst's colour, and the sky and lake briefly
 * lit. Every spark is one pooled point system, a single draw call. It never decides anything.
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
  private readonly washMap = washTexture();
  /** The pattern's frames, empty places and outlines; its sparks are pinned in `sparks`. */
  private readonly burst = new Group();
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
  private readonly sparks = new FireworkSparks(PINNED + FREE_SPARKS, PINNED);
  /** Where each pattern spark was last frame, for its comet tail. */
  private readonly tailFrom = new Float32Array(MAX_SPARKS * 2);
  private readonly hue = new Color();
  private readonly tint = new Color();
  private readonly paint = new Color();
  private readonly white = new Color('#ffffff');
  private readonly ember = new Color('#c9b48a');
  private readonly gold = new Color('#ffd45c');
  private readonly warm = new Color('#ffe9c4');
  private readonly smoke = new Color('#8d84b8');
  private readonly ash = new Color('#6f6890');

  private readonly lights: Light[] = Array.from({ length: LIGHTS }, () => ({
    at: -10,
    light: 0,
    x: 0,
    y: 0,
    color: new Color(),
  }));
  private nextLight = 0;
  private readonly lightColor = new Color();
  private readonly fillColor = new Color('#b9a8ff');
  private readonly skyWash: Mesh<PlaneGeometry, MeshBasicMaterial>;
  private readonly lakeWash: Mesh<PlaneGeometry, MeshBasicMaterial>;

  private readonly rocket = new Group();
  private readonly rocketFrom = { x: 0, y: 0 };
  private readonly rocketPoint: RocketPoint = { x: 0, y: 0, lean: 0, glow: 0 };
  /** Where the rocket's trail was last laid. */
  private readonly trailFrom = { x: 0, y: 0, ready: false };
  private cues: Cue[] = [];
  private cueAt = 0;
  private readonly cueDone = new Uint8Array(MAX_CUES);
  private readonly cueTrail = new Float32Array(MAX_CUES * 2);
  private readonly shapes: ShapeBurst[] = Array.from({ length: SHAPES }, () => ({
    at: -10,
    x: 0,
    y: 0,
    size: 1,
    glittered: true,
    points: new Float32Array(SHAPE_SPARKS * 2),
    colors: Array.from({ length: SHAPE_SPARKS }, () => new Color()),
  }));
  private nextShape = 0;

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
  private readonly town: Group;
  private readonly probe = new Vector3();

  constructor(canvas: HTMLCanvasElement, host: HTMLElement) {
    super(canvas, host, { fov: FOV });
    this.fill.intensity = 1.1;
    this.fill.color.copy(this.fillColor);
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
    // The lit sky sits behind the town, so the roofs stand dark against it.
    this.skyWash = this.wash(-6, 26, 20);
    this.town = buildTown();
    this.scene.add(this.town);

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
    this.lakeWash = this.wash(-0.2, 14, 3.2);

    this.burst.position.set(0, BURST_Y, 0);
    this.scene.add(this.burst);
    this.scene.add(this.sparks.points);

    this.buildBank();
    this.buildJetty();
    this.buildFox();
    this.buildRocket();
    this.buildCrowd();
    // Bake each character's still parts into one mesh per material.
    const old = new Set<BufferGeometry>();
    const bake = (group: Group) => mergeByMaterial(group).forEach((g) => old.add(g));
    for (const group of [
      this.jetty,
      this.tube,
      this.foxBody,
      this.foxHead,
      this.foxTail,
      this.foxArm,
      this.scarfEnd,
      this.telescope,
    ])
      bake(group);
    for (const creature of this.crowd) {
      bake(creature.body);
      bake(creature.head);
      bake(creature.lantern);
    }
    for (const geometry of old) geometry.dispose();
  }

  /** An additive soft light on a plane at depth `z`, `w` by `h` units, dark until a burst. */
  private wash(z: number, w: number, h: number) {
    const mesh = new Mesh(
      new PlaneGeometry(1, 1),
      new MeshBasicMaterial({
        map: this.washMap,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    mesh.scale.set(w, h, 1);
    mesh.position.z = z;
    mesh.visible = false;
    this.scene.add(mesh);
    return mesh;
  }

  setState(frame: FireworkFrame) {
    const t = this.elapsed;
    if (frame.firework !== this.firework || frame.pattern !== this.pattern) {
      this.firework = frame.firework;
      this.pattern = frame.pattern;
      this.buildPattern(frame.pattern);
    }
    let opens = false;
    if (frame.phase !== this.phase) {
      this.glowFrom = this.glow;
      if (frame.phase === 'look') opens = true;
      this.phase = frame.phase;
      this.phaseAt = t;
    }
    if (this.launches.take(frame.launches)) this.launch(frame);
    if (this.bursts.take(frame.bursts) && frame.phase === 'look') opens = true;
    this.frame = frame;
    if (opens) this.open(frame);
    if (this.blooms.take(frame.blooms)) this.celebrate(frame);
    if (this.fizzles.take(frame.fizzles)) this.fizzle();
    if (this.peeks.take(frame.peeks)) this.peekAt = t;
    if (this.shows.take(frame.shows)) this.startShow(frame);
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
    // A fresh burst flies out from its centre to its places; under calm motion it fades in.
    const opening = this.phase === 'look' ? t - this.burstAt : 10;
    const spread = openSpread(opening, calm);
    const droop =
      this.phase === 'fade'
        ? smooth(age / FADE_OUT) * 0.35
        : this.phase === 'fizzle'
          ? smooth(age / 0.8) * 0.8
          : 0;
    const bloom = this.phase === 'bloom' && !calm ? mix(1, 1.15, easeOutBack(age / 0.5)) : 1;
    const scale = this.scale * bloom;
    const top = BURST_Y - droop * this.scale;
    this.burst.scale.setScalar(scale);
    this.burst.position.y = top;
    const pattern = this.pattern!;
    const shimmer = calm ? 0 : 1;
    // Colour: the firework's own hue, white-hot as it opens, brighter on the re-bloom, ash-gold
    // in a fizzle.
    const tint = this.tint.copy(this.hue);
    if (this.phase === 'look' && !calm) tint.lerp(this.white, 0.7 * (1 - smooth(opening / 0.5)));
    if (this.phase === 'bloom') tint.lerp(this.white, 0.15 * smooth(age / 0.4));
    if (this.phase === 'fizzle') tint.lerp(this.ember, smooth(age / 0.4));
    const tails = !calm && this.phase === 'look' && opening < OPEN + 0.05 && glow > 0.02;
    for (let index = 0; index < MAX_SPARKS; index++) {
      const at = pattern.sparks[index];
      if (!at || glow <= 0.002) {
        this.sparks.pin(PATTERN_SLOT + index, 0, 0, 0, 0, tint, 0, Cell.Glow);
        this.sparks.pin(MIRROR_SLOT + index, 0, 0, 0, 0, tint, 0, Cell.Streak);
        continue;
      }
      const star = pattern.shapes[at.burst] === 'star';
      const fall = this.phase === 'fizzle' ? smooth(age / 1.1) * (0.25 + (index % 3) * 0.2) : 0;
      // The sparks wobble a little as they sag in a fizzle, like a sigh.
      const sigh = this.phase === 'fizzle' && !calm ? Math.sin(age * 9 + index) * 0.05 * glow : 0;
      const x = (at.x * spread + sigh) * scale;
      const y = top + (at.y * spread - fall) * scale;
      const size = (star ? 1.05 : 1) * scale;
      this.sparks.pin(
        PATTERN_SLOT + index,
        x,
        y,
        0,
        size,
        tint,
        glow,
        star ? Cell.Star : Cell.Glow,
      );
      this.sparks.pin(
        MIRROR_SLOT + index,
        x + Math.sin(t * 2.3 + at.y * 3) * 0.08 * shimmer * scale,
        mirrorY(y),
        0.05,
        size * 1.3,
        tint,
        glow * 0.32,
        Cell.Streak,
      );
      if (tails) this.tail(t, index, x, y);
      this.tailFrom[index * 2] = x;
      this.tailFrom[index * 2 + 1] = y;
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

  /** A comet tail behind a pattern spark flying out to its place: sparks laid along its path. */
  private tail(t: number, index: number, x: number, y: number) {
    const fromX = this.tailFrom[index * 2];
    const fromY = this.tailFrom[index * 2 + 1];
    const length = Math.hypot(x - fromX, y - fromY);
    const steps = Math.min(16, Math.floor(length / TRAIL_STEP));
    if (!steps) return;
    const spec = this.sparks.spec.reset();
    spec.life = 0.4;
    spec.size = 0.2 * this.scale;
    spec.grow = -0.7;
    spec.hold = 0.1;
    spec.alpha = 0.8;
    spec.color.copy(this.hue).lerp(this.white, 0.45);
    for (let step = 1; step <= steps; step++) {
      const k = step / steps;
      this.sparks.emit(t, mix(fromX, x, k), mix(fromY, y, k), -0.02, 0, -0.15);
    }
    this.tailFrom[index * 2] = x;
    this.tailFrom[index * 2 + 1] = y;
  }

  // ------------------------------------------------------------------------------------------
  // Events
  // ------------------------------------------------------------------------------------------

  /** Flick lights the fuse: a puff of smoke and a spit of sparks from the tube. */
  private launch(frame: FireworkFrame) {
    const t = this.elapsed;
    this.launchedAt = t;
    this.trailFrom.ready = false;
    if (this.calm) return;
    const x = this.rocketFrom.x;
    const y = this.rocketFrom.y - 0.1;
    const spec = this.sparks.spec.reset();
    spec.cell = Cell.Puff;
    spec.cover = 0.6;
    spec.life = 1.8;
    spec.size = 0.7;
    spec.grow = 1.4;
    spec.alpha = 0.45;
    spec.fadeIn = 0.15;
    spec.hold = 0.1;
    spec.drag = 1.5;
    spec.color.copy(this.smoke);
    for (let i = 0; i < 3; i++)
      this.sparks.emit(t + i * 0.05, x, y + 0.1, 0.35, (i - 1) * 0.3, 0.5);
    spec.reset();
    spec.cell = Cell.Glint;
    spec.life = 0.35;
    spec.size = 0.16;
    spec.gravity = 3;
    spec.twinkle = 0.6;
    spec.color.copy(frame.bigShow ? this.gold : this.warm);
    for (let i = 0; i < 10; i++) {
      const a = Math.PI / 2 + (i / 9 - 0.5) * 1.6;
      const speed = 1.2 + (i % 3) * 0.5;
      this.sparks.emit(t, x, y + 0.15, 0.4, Math.cos(a) * speed, Math.sin(a) * speed);
    }
    this.addLight(t, 0.12, this.warm, x, y);
  }

  /** The shell opens: a core flash, crackle round the edge, glitter, smoke and the sky lit. */
  private open(frame: FireworkFrame) {
    const t = this.elapsed;
    this.burstAt = t;
    const calm = this.calm;
    const pattern = frame.pattern;
    // Comet tails start from the centre.
    for (let index = 0; index < MAX_SPARKS; index++) {
      this.tailFrom[index * 2] = 0;
      this.tailFrom[index * 2 + 1] = BURST_Y;
    }
    const radius = this.patternRadius(pattern);
    this.flash(t, 0, BURST_Y, this.hue, radius, calm);
    this.puffs(t + 0.15, 0, BURST_Y, radius, this.hue, calm ? 3 : 5);
    this.addLight(t, calm ? 0.3 : 0.6, this.hue, 0, BURST_Y);
    if (calm) return;
    // Crackle: glints pop round the edge of the burst once its stars have landed.
    const spec = this.sparks.spec.reset();
    spec.cell = Cell.Glint;
    spec.life = 0.3;
    spec.size = 0.36;
    spec.hold = 0.2;
    spec.twinkle = 0.5;
    spec.color.copy(this.warm);
    const random = seededRandom(17 + frame.firework * 7 + pattern.sparks.length);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + random() * 0.4;
      const r = radius * (1.05 + random() * 0.3);
      this.sparks.emit(
        t + 0.42 + random() * 0.35,
        Math.cos(a) * r,
        BURST_Y + Math.sin(a) * r * 0.85,
        0.1,
        0,
        0,
      );
    }
    // Glitter: a few tiny sparks drip from each star and fall away with gravity and drag.
    this.glitter(t + 0.45, pattern, 2, 0.11, 1.5, this.hue);
  }

  /** The radius of the pattern in world units, from its centre to its farthest spark. */
  private patternRadius(pattern: Pattern) {
    let most = 0.5;
    for (const spark of pattern.sparks) most = Math.max(most, Math.hypot(spark.x, spark.y) + 0.5);
    return most * this.scale;
  }

  /** A shell's white-hot core: one bright swelling glow, then gone. Calm motion keeps it soft. */
  private flash(t: number, x: number, y: number, color: Color, radius: number, calm: boolean) {
    const spec = this.sparks.spec.reset();
    spec.life = calm ? 0.9 : 0.45;
    spec.size = Math.max(1.6, radius * 1.4);
    spec.grow = calm ? 0.2 : 0.6;
    spec.fadeIn = calm ? 0.25 : 0.04;
    spec.hold = 0.05;
    spec.alpha = calm ? 0.3 : 0.55;
    spec.color.copy(color).lerp(this.white, 0.5);
    this.sparks.emit(t, x, y, -0.1, 0, 0);
    if (calm) return;
    spec.size = Math.max(0.45, radius * 0.35);
    spec.alpha = 0.9;
    spec.life = 0.18;
    spec.color.copy(this.white);
    this.sparks.emit(t, x, y, -0.05, 0, 0);
  }

  /** Smoke left by a burst, lit from inside by its colour, drifting slowly away. */
  private puffs(t: number, x: number, y: number, radius: number, color: Color, count: number) {
    const spec = this.sparks.spec.reset();
    spec.cell = Cell.Puff;
    spec.cover = 0.35;
    spec.life = 3.4;
    spec.size = Math.max(1.2, radius * 0.9);
    spec.grow = 0.8;
    spec.fadeIn = 0.35;
    spec.hold = 0.15;
    spec.alpha = 0.3;
    spec.drag = 0.6;
    spec.color.copy(this.smoke).lerp(color, 0.45);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + 0.4;
      const r = radius * 0.45;
      this.sparks.emit(
        t + i * 0.04,
        x + Math.cos(a) * r,
        y + Math.sin(a) * r * 0.7,
        -0.4,
        Math.cos(a) * 0.25 + 0.08,
        Math.sin(a) * 0.12 + 0.06,
      );
    }
  }

  /** Tiny sparks drip from each pattern star and fall away, twinkling. */
  private glitter(
    t: number,
    pattern: Pattern,
    each: number,
    size: number,
    life: number,
    color: Color,
  ) {
    const spec = this.sparks.spec.reset();
    spec.cell = Cell.Glint;
    spec.life = life;
    spec.size = size * Math.max(1, this.scale);
    spec.gravity = 0.9;
    spec.drag = 1.4;
    spec.twinkle = 0.8;
    spec.hold = 0.35;
    spec.alpha = 0.9;
    const random = seededRandom(31 + pattern.sparks.length * 5 + this.firework);
    pattern.sparks.forEach((spark, index) => {
      for (let k = 0; k < each; k++) {
        spec.color.copy(k % 2 ? this.gold : color).lerp(this.white, 0.3);
        this.sparks.emit(
          t + random() * 0.5 + k * 0.12,
          spark.x * this.scale + (random() - 0.5) * 0.2,
          BURST_Y + spark.y * this.scale - 0.1,
          0.05,
          (random() - 0.5) * 0.5,
          -0.1 - random() * 0.3 + (index % 2) * 0.1,
        );
      }
    });
  }

  private celebrate(frame: FireworkFrame) {
    const t = this.elapsed;
    this.bloomAt = t;
    const pattern = frame.pattern;
    const calm = this.calm;
    const radius = this.patternRadius(pattern) * 1.15;
    this.addLight(t, calm ? 0.35 : 0.7, this.hue, 0, BURST_Y);
    // A golden willow drips from every star of the re-bloom.
    const spec = this.sparks.spec.reset();
    spec.cell = Cell.Glint;
    spec.life = calm ? 1.6 : 2.4;
    spec.size = 0.15 * Math.max(1, this.scale);
    spec.gravity = calm ? 0 : 0.7;
    spec.drag = 1.5;
    spec.twinkle = calm ? 0 : 0.6;
    spec.hold = 0.45;
    const colors = [this.hue, this.gold, this.warm];
    const random = seededRandom(5 + frame.firework * 3);
    pattern.sparks.forEach((spark, index) => {
      for (let k = 0; k < (calm ? 1 : 4); k++) {
        const angle = random() * Math.PI * 2;
        const speed = calm ? 0.15 : 0.6 + random() * 1.1;
        spec.color.copy(colors[(index + k) % colors.length]);
        this.sparks.emit(
          t + 0.12 + k * 0.08,
          spark.x * this.scale * 1.15,
          BURST_Y + spark.y * this.scale * 1.15,
          0.1,
          Math.cos(angle) * speed,
          Math.sin(angle) * speed + (calm ? 0 : 0.5),
        );
      }
    });
    if (!calm) {
      // A ring of crackle bursts round the whole pattern.
      spec.reset();
      spec.cell = Cell.Glint;
      spec.life = 0.35;
      spec.size = 0.42;
      spec.twinkle = 0.4;
      spec.color.copy(this.warm);
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        const r = radius * (1.08 + random() * 0.25);
        this.sparks.emit(
          t + 0.3 + random() * 0.45,
          Math.cos(a) * r,
          BURST_Y + Math.sin(a) * r * 0.85,
          0.1,
          0,
          0,
        );
      }
      // A soft halo of the firework's colour rolls out behind it.
      spec.reset();
      spec.life = 1.1;
      spec.size = 0.3;
      spec.drag = 2.4;
      spec.gravity = 0.4;
      spec.hold = 0.3;
      spec.alpha = 0.8;
      spec.color.copy(this.hue).lerp(this.white, 0.25);
      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * Math.PI * 2;
        const speed = radius * 2.6;
        this.sparks.emit(
          t + 0.05,
          Math.cos(a) * radius * 0.6,
          BURST_Y + Math.sin(a) * radius * 0.6,
          -0.3,
          Math.cos(a) * speed,
          Math.sin(a) * speed,
        );
      }
    }
    if (frame.finale)
      this.bloomShape(frame.shape, t + 0.5, 0, BURST_Y, this.shapeSize(), calm, this.hue);
  }

  /** Not quite: each star sputters out with a little puff and drops a couple of dim embers. */
  private fizzle() {
    const t = this.elapsed;
    this.fizzleAt = t;
    const pattern = this.pattern;
    if (!pattern) return;
    const calm = this.calm;
    const spec = this.sparks.spec.reset();
    const random = seededRandom(43 + pattern.sparks.length);
    // Pfft: a small grey puff where each star was.
    spec.cell = Cell.Puff;
    spec.cover = 0.5;
    spec.life = 1.6;
    spec.size = 0.55 * this.scale;
    spec.grow = 1.2;
    spec.fadeIn = 0.2;
    spec.hold = 0.15;
    spec.alpha = 0.35;
    spec.drag = 1;
    spec.color.copy(this.ash);
    for (const spark of pattern.sparks)
      this.sparks.emit(
        t + 0.12 + random() * 0.25,
        spark.x * this.scale,
        BURST_Y + spark.y * this.scale,
        0.02,
        (random() - 0.5) * 0.2,
        calm ? 0 : 0.25,
      );
    // Embers drift down from every star, slowly, never alarming.
    spec.reset();
    spec.cell = Cell.Glint;
    spec.life = 1.5;
    spec.size = 0.14;
    spec.gravity = calm ? 0 : 0.35;
    spec.drag = 0.6;
    spec.hold = 0.45;
    spec.alpha = 0.8;
    spec.twinkle = calm ? 0 : 0.7;
    spec.color.copy(this.ember);
    for (const spark of pattern.sparks)
      for (let k = 0; k < 2; k++)
        this.sparks.emit(
          t + 0.15 + k * 0.25,
          spark.x * this.scale + (random() - 0.5) * 0.3,
          BURST_Y + spark.y * this.scale,
          0.1,
          (random() - 0.5) * 0.4,
          calm ? -0.1 : -0.2 - random() * 0.35,
        );
  }

  private startShow(frame: FireworkFrame) {
    const t = this.elapsed;
    const calm = this.calm;
    this.cues = finaleCues(frame.launched, calm ? SHOW / 2 : SHOW, calm).slice(0, MAX_CUES);
    this.cueAt = t;
    this.cueDone.fill(0);
    this.cues.forEach((cue, index) => {
      this.cueTrail[index * 2] = Number.NaN;
    });
  }

  /** The book shape's size: as big as the sky above the town allows. */
  private shapeSize() {
    return Math.min(this.viewWidth * 0.42, (BURST_TOP - BURST_BOTTOM) * 0.44);
  }

  /** Where a show cue bursts, in world units. */
  private cueX(cue: Cue) {
    return cue.x * Math.max(1.4, this.viewWidth * 0.38);
  }
  private cueY(cue: Cue) {
    return BURST_BOTTOM + 0.7 + cue.y * (BURST_TOP - BURST_BOTTOM - 1.4);
  }

  /** The level's book shape as a big rainbow firework, sparks flying out to its outline. */
  private bloomShape(
    shape: BookShape,
    at: number,
    x: number,
    y: number,
    size: number,
    calm: boolean,
    core: Color,
  ) {
    const burst = this.shapes[this.nextShape];
    this.nextShape = (this.nextShape + 1) % SHAPES;
    burst.at = at;
    burst.x = x;
    burst.y = y;
    burst.size = size;
    burst.glittered = calm;
    shapePoints(shape, SHAPE_SPARKS).forEach((point, index) => {
      burst.points[index * 2] = point.x;
      burst.points[index * 2 + 1] = point.y;
      burst.colors[index].setHSL(point.t, 0.85, 0.62);
    });
    this.flash(at, x, y, core, size * 0.6, calm);
    this.addLight(at, calm ? 0.3 : 0.55, this.white, x, y);
  }

  private updateShapes(t: number, calm: boolean) {
    this.shapes.forEach((burst, which) => {
      const base = SHAPE_SLOT + which * SHAPE_SPARKS * 2;
      const age = t - burst.at;
      const glow = shapeGlow(age);
      if (glow <= 0) {
        this.sparks.hide(base, base + SHAPE_SPARKS * 2);
        return;
      }
      const size = Math.min(0.42, (burst.size * 0.16) / Math.sqrt(SHAPE_SPARKS / 64));
      for (let index = 0; index < SHAPE_SPARKS; index++) {
        const spread = calm ? 1 : shapeSpread(age, index, SHAPE_SPARKS);
        const reach = mix(0.06, 1, spread) * burst.size;
        const x = burst.x + burst.points[index * 2] * reach;
        const y = burst.y + burst.points[index * 2 + 1] * reach;
        // Every few sparks twinkle once it has settled; the outline itself stays steady.
        const twinkle =
          calm || index % 5 ? 1 : 0.75 + 0.25 * Math.sin(age * 9 + index * 1.7) * smooth(age - 1);
        const color = this.paint.copy(burst.colors[index]);
        if (!calm) color.lerp(this.white, 0.6 * (1 - smooth(age / 0.6)));
        this.sparks.pin(base + index, x, y, 0.15, size, color, glow * twinkle, Cell.Glow);
        this.sparks.pin(
          base + SHAPE_SPARKS + index,
          x,
          mirrorY(y),
          0.05,
          size * 1.4,
          color,
          glow * 0.25,
          Cell.Streak,
        );
      }
      // Once the outline has drawn itself, glitter falls from it.
      if (!burst.glittered && age > 0.9) {
        burst.glittered = true;
        const spec = this.sparks.spec.reset();
        spec.cell = Cell.Glint;
        spec.life = 1.8;
        spec.size = 0.13;
        spec.gravity = 0.8;
        spec.drag = 1.2;
        spec.twinkle = 0.8;
        for (let index = 0; index < SHAPE_SPARKS; index += 3) {
          spec.color.copy(burst.colors[index]).lerp(this.white, 0.4);
          this.sparks.emit(
            t + (index / SHAPE_SPARKS) * 0.6,
            burst.x + burst.points[index * 2] * burst.size,
            burst.y + burst.points[index * 2 + 1] * burst.size,
            0.1,
            0,
            -0.2,
          );
        }
      }
    });
  }

  // ------------------------------------------------------------------------------------------
  // Shells of the show
  // ------------------------------------------------------------------------------------------

  private shell(t: number, kind: ShellKind, x: number, y: number, color: Color, calm: boolean) {
    const spec = this.sparks.spec.reset();
    const random = seededRandom(Math.round(x * 100 + y * 1000) + 7);
    switch (kind) {
      case 'peony':
      case 'ring': {
        const ring = kind === 'ring';
        const count = ring ? 30 : 40;
        const tilt = (random() - 0.5) * 0.8;
        const radius = ring ? 1.25 : 1.4;
        spec.life = calm ? 1.8 : 1.6;
        spec.size = 0.26;
        spec.drag = 2.4;
        spec.gravity = calm ? 0 : 0.7;
        spec.hold = 0.4;
        spec.fadeIn = calm ? 0.35 : 0.04;
        spec.twinkle = calm ? 0 : 0.25;
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2 + random() * (ring ? 0 : 0.2);
          // A ring is a flat circle seen at a tilt; a peony fills a ball.
          const reach = ring ? 1 : 0.55 + random() * 0.45;
          const dx = Math.cos(a) * reach;
          const dy = Math.sin(a) * reach * (ring ? 0.55 : 1);
          const rx = dx * Math.cos(tilt) - dy * Math.sin(tilt);
          const ry = dx * Math.sin(tilt) + dy * Math.cos(tilt);
          spec.color.copy(color).lerp(this.white, i % 4 ? 0 : 0.5);
          if (calm) {
            this.sparks.emit(t, x + rx * radius, y + ry * radius, -0.1, 0, 0);
            continue;
          }
          const speed = radius * 2.4;
          // Each star, then two fainter copies a moment later: a comet tail along its path.
          for (let k = 0; k < 3; k++) {
            spec.size = 0.26 * (1 - k * 0.3);
            spec.alpha = 1 - k * 0.35;
            // They leave from a small ring, so the shell's first frame is not one white blob.
            this.sparks.emit(
              t + k * 0.035,
              x + rx * 0.15,
              y + ry * 0.15,
              -0.1,
              rx * speed,
              ry * speed,
            );
          }
        }
        break;
      }
      case 'crackle': {
        spec.cell = Cell.Glint;
        spec.life = 0.55;
        spec.size = 0.34;
        spec.drag = 3;
        spec.twinkle = 0.9;
        spec.hold = 0.3;
        for (let i = 0; i < 26; i++) {
          const a = random() * Math.PI * 2;
          const speed = 1 + random() * 2.2;
          spec.color.copy(i % 3 ? this.warm : color);
          this.sparks.emit(
            t + random() * 0.25,
            x,
            y,
            -0.05,
            Math.cos(a) * speed,
            Math.sin(a) * speed,
          );
        }
        break;
      }
      case 'willow': {
        spec.cell = Cell.Glint;
        spec.life = calm ? 2 : 3;
        spec.size = 0.2;
        spec.drag = 1.1;
        spec.gravity = calm ? 0 : 1.5;
        spec.hold = 0.5;
        spec.twinkle = calm ? 0 : 0.45;
        for (let i = 0; i < 44; i++) {
          const a = (i / 44) * Math.PI * 2;
          const speed = 1.5 + random() * 0.6;
          // Long golden strands: each star followed by three fainter copies.
          for (let k = 0; k < 4; k++) {
            spec.alpha = 1 - k * 0.2;
            spec.size = 0.2 * (1 - k * 0.12);
            spec.color.copy(this.gold).lerp(this.white, k ? 0 : 0.3);
            this.sparks.emit(
              t + k * 0.09,
              x,
              y,
              -0.15,
              Math.cos(a) * speed,
              Math.sin(a) * speed * 0.9 + 0.3,
            );
          }
        }
        break;
      }
      case 'shape':
        break;
    }
  }

  private updateShow(t: number, frame: FireworkFrame, calm: boolean) {
    if (!this.cues.length) return;
    const since = t - this.cueAt;
    this.cues.forEach((cue, index) => {
      if (this.cueDone[index]) return;
      const x = this.cueX(cue);
      const y = this.cueY(cue);
      const launch = cue.at - cue.rise;
      if (since < launch) return;
      if (since < cue.at && cue.rise > 0) {
        // The rocket climbs from the far shore on a glittering trail.
        const point = rocketAt(
          (since - launch) / cue.rise,
          x * 0.85,
          0.05,
          x,
          y,
          1,
          this.rocketPoint,
        );
        this.rocketTrail(t, index, point.x, point.y, false, 0.6);
        const spec = this.sparks.spec.reset();
        spec.life = 0.05;
        spec.size = 0.22 * point.glow;
        spec.hold = 0.8;
        spec.fadeIn = 0;
        spec.color.copy(this.warm);
        this.sparks.emit(t, point.x, point.y, 0, 0, 0);
        return;
      }
      this.cueDone[index] = 1;
      const color = cue.hue < 0 ? this.gold : this.paint.set(HUES[cue.hue % HUES.length]);
      this.addLight(t, cue.light * (calm ? 0.6 : 1), color, x, y);
      if (cue.kind === 'shape') {
        this.bloomShape(frame.shape, t, 0, BURST_Y + 0.3, this.shapeSize(), calm, this.white);
        return;
      }
      this.flash(t, x, y, color, cue.kind === 'willow' ? 1.3 : 0.9, calm);
      this.shell(t, cue.kind, x, y, color, calm);
      if (!calm && cue.kind !== 'crackle') this.puffs(t + 0.2, x, y, 1.1, color, 2);
    });
  }

  /** Lays sparks along a rocket's path since last frame: a light streak and falling glitter. */
  private rocketTrail(
    t: number,
    index: number,
    x: number,
    y: number,
    big: boolean,
    strength: number,
  ) {
    const fromX = index < 0 ? this.trailFrom.x : this.cueTrail[index * 2];
    const fromY = index < 0 ? this.trailFrom.y : this.cueTrail[index * 2 + 1];
    const fresh = index < 0 ? !this.trailFrom.ready : Number.isNaN(fromX);
    if (index < 0) {
      this.trailFrom.x = x;
      this.trailFrom.y = y;
      this.trailFrom.ready = true;
    } else {
      this.cueTrail[index * 2] = x;
      this.cueTrail[index * 2 + 1] = y;
    }
    if (fresh) return;
    const length = Math.hypot(x - fromX, y - fromY);
    const steps = Math.min(24, Math.floor(length / TRAIL_STEP));
    const spec = this.sparks.spec;
    for (let step = 1; step <= steps; step++) {
      const k = step / steps;
      const px = mix(fromX, x, k);
      const py = mix(fromY, y, k);
      // The streak: a fading line of warm light.
      spec.reset();
      spec.life = 0.6;
      spec.size = 0.16 * strength + 0.04;
      spec.grow = -0.6;
      spec.hold = 0.05;
      spec.alpha = 0.85;
      spec.color.copy(big ? this.gold : this.warm);
      this.sparks.emit(t, px, py - 0.12, 0.12, 0, -0.1);
      // Glitter shed along the way, falling and twinkling.
      if (step % (big ? 2 : 4)) continue;
      spec.cell = Cell.Glint;
      spec.life = big ? 1.1 : 0.8;
      spec.size = 0.13;
      spec.grow = -0.3;
      spec.gravity = 1;
      spec.drag = 0.8;
      spec.twinkle = 0.9;
      spec.hold = 0.3;
      spec.alpha = 0.9;
      const side = Math.sin(t * 37 + step * 2.1);
      this.sparks.emit(t, px, py - 0.15, 0.12, side * 0.45, -0.2);
    }
  }

  /** Remembers a burst's light, so the sky and lake glow in its colour for a moment. */
  private addLight(t: number, light: number, color: Color, x: number, y: number) {
    const slot = this.lights[this.nextLight];
    this.nextLight = (this.nextLight + 1) % LIGHTS;
    slot.at = t;
    slot.light = light;
    slot.x = x;
    slot.y = y;
    slot.color.copy(color);
  }

  /** The sky, the lake and every lit thing take on the colour of the bursts now in the air. */
  private updateLights(t: number, calm: boolean) {
    const level = skyLevel(t, this.lights);
    let weight = 0;
    let x = 0;
    let y = 0;
    const color = this.lightColor.setRGB(0, 0, 0);
    for (const light of this.lights) {
      const age = t - light.at;
      if (age < 0 || age > 1.4) continue;
      const w = Math.max(0.001, light.light * (1 - age / 1.4));
      weight += w;
      x += light.x * w;
      y += light.y * w;
      color.r += light.color.r * w;
      color.g += light.color.g * w;
      color.b += light.color.b * w;
    }
    if (weight > 0) {
      x /= weight;
      y /= weight;
      color.multiplyScalar(1 / weight);
    }
    // The rocket's own little light on the water as it climbs.
    const rocket = this.rocket.visible ? 0.18 : 0;
    const sky = this.skyWash;
    sky.visible = level > 0.002;
    if (sky.visible) {
      sky.material.color.copy(color);
      sky.material.opacity = level * (calm ? 0.3 : 0.45);
      sky.position.set(x * 0.6, Math.max(BURST_BOTTOM + 1, y) + 0.5, sky.position.z);
    }
    const lake = this.lakeWash;
    lake.visible = level + rocket > 0.002;
    if (lake.visible) {
      if (weight > 0) lake.material.color.copy(color).lerp(this.warm, rocket / (level + rocket));
      else lake.material.color.copy(this.warm);
      lake.material.opacity = Math.min(0.75, level * 0.6 + rocket);
      const lx = weight > 0 ? x : this.rocket.position.x;
      lake.position.set(lx, -1.55, lake.position.z);
    }
    // Ambient light carries the colour onto the fox, the crowd and the town.
    this.fill.color.copy(this.fillColor);
    if (weight > 0) this.fill.color.lerp(color, Math.min(0.6, level * 0.7));
    this.fill.intensity = 1.1 + level * (calm ? 0.6 : 1.3);
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
    this.updateShow(t, frame, calm);
    this.updateShapes(t, calm);
    this.updateFox(t, frame, calm);
    this.updateCrowd(t, frame, calm);
    this.updateLights(t, calm);
    // Spark sizes are in device pixels, and the stage may change the pixel ratio any frame.
    this.sparks.setScale((this.height * this.renderer.getPixelRatio()) / (2 * TAN));
    this.sparks.update(t, dt);
  }

  private updateRocket(t: number, frame: FireworkFrame, calm: boolean) {
    const rising = this.phase === 'launch' && !calm;
    const k = (t - this.launchedAt) / RISE;
    this.rocket.visible = rising && k >= 0 && k < 1;
    if (!this.rocket.visible) {
      this.sparks.hide(ROCKET_SLOT, ROCKET_SLOT + 2);
      return;
    }
    const point = rocketAt(
      k,
      this.rocketFrom.x,
      this.rocketFrom.y,
      0,
      BURST_Y,
      1,
      this.rocketPoint,
    );
    this.rocket.position.set(point.x, point.y, 0.2);
    this.rocket.rotation.z = point.lean;
    // The rocket stretches as it leaves the tube and pulls in as it slows at the top.
    const stretch = 1 + 0.25 * (1 - smooth(k / 0.35)) - 0.12 * smooth((k - 0.7) / 0.3);
    this.rocket.scale.set(1 / Math.sqrt(stretch), stretch, 1 / Math.sqrt(stretch));
    // Its burning head, and a soft halo that swells in the breath before the burst.
    const headX = point.x + Math.sin(-point.lean) * -0.22;
    const headY = point.y - Math.cos(point.lean) * 0.22;
    this.sparks.pin(ROCKET_SLOT, headX, headY, 0.25, 0.34 * point.glow, this.warm, 1, Cell.Glow);
    this.sparks.pin(
      ROCKET_SLOT + 1,
      point.x,
      point.y,
      0.18,
      1.3 * point.glow * point.glow,
      this.warm,
      0.22 * point.glow,
      Cell.Glow,
    );
    this.rocketTrail(t, -1, headX, headY, frame.bigShow, 1);
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
      const spec = this.sparks.spec.reset();
      spec.cell = Cell.Glint;
      spec.life = 0.35;
      spec.size = 0.14;
      spec.gravity = 1;
      spec.twinkle = 0.7;
      spec.color.copy(this.gold);
      for (let i = 0; i < 2; i++) {
        const a = t * 23 + i * 2.4;
        this.sparks.emit(t, tip.x, tip.y, tip.z, Math.cos(a) * 0.7, Math.sin(a) * 0.7);
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
      creature.lantern.visible = s > 0.01;
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
    this.rocket.add(body, tip);
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
    const eyeMaterial = new MeshBasicMaterial({ color: '#f3eaff' });
    const poleGeometry = new CylinderGeometry(0.018, 0.018, 0.5, 6);
    const poleMaterial = new MeshStandardMaterial({ color: '#8a6a4b' });
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
        const eye = new Mesh(sphere, eyeMaterial);
        eye.scale.setScalar(0.022);
        eye.position.set(side * 0.06, 0.02, 0.155);
        head.add(eye);
      }
      const lantern = new Group();
      const pole = new Mesh(poleGeometry, poleMaterial);
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
    this.glowMap.dispose();
    this.washMap.dispose();
    (this.scene.background as CanvasTexture | null)?.dispose();
    this.sparks.dispose();
    super.dispose();
  }
}
