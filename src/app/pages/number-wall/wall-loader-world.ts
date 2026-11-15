import {
  BoxGeometry,
  CircleGeometry,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  OctahedronGeometry,
  PlaneGeometry,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { TextLabel } from '../../shared/three/labels';
import { bounce, clamp01, easeOutBack, smooth } from '../../shared/three/motion';
import { Stage } from '../../shared/three/stage';
import type { StateWorld } from '../../shared/three/three-stage';
import { BRICK, brickCentre, INK, lambert } from './wall-models';

const FOV = 38;
/** The camera looks down on the wall by this much (radians). */
const PITCH = 0.2;
/** One full build: drop, sparkle, pop away. */
export const LOOP = 4.6;
/** Seconds between one brick and the next starting to fall. */
const STAGGER = 0.3;
/** Seconds a brick takes to fall and bounce to rest. */
const FALL = 0.55;
/** How far above its place a brick starts falling. */
const DROP = 3.2;
/** The first brick is already falling, so something lands within the first moments. */
const HEAD_START = 0.32;
/** When the golden top brick starts to shine. */
const SHINE = 5 * STAGGER + FALL;
/** When the bricks start popping away, top first, ready for the next build. */
const CLEAR = 3.65;
const POP = 0.22;
const SPARKS = 14;

/**
 * A little number wall: bottom row given, middle row worked out, the top brick golden, just
 * like a finished wall in the game. Each brick is the sum of the two below it.
 */
const PLAN: readonly { row: number; col: number; text: string; look: Look }[] = [
  { row: 0, col: 0, text: '2', look: 'given' },
  { row: 0, col: 1, text: '3', look: 'given' },
  { row: 0, col: 2, text: '4', look: 'given' },
  { row: 1, col: 0, text: '5', look: 'filled' },
  { row: 1, col: 1, text: '7', look: 'filled' },
  { row: 2, col: 0, text: '12', look: 'golden' },
];

type Look = 'given' | 'filled' | 'golden';
const LOOKS: Readonly<Record<Look, { color: string; ink: string }>> = {
  given: { color: '#f2dcaa', ink: INK },
  filled: { color: '#c9ecbb', ink: '#1f4d27' },
  golden: { color: '#ffd66b', ink: '#3d2a00' },
};
const GOLD_GLOW = new Color('#a06a00');
const BLACK = new Color('#000000');
const SPARK_COLORS = ['#ffd23f', '#fff1a8', '#ff8fb8', '#ffffff'];

/** When brick `index` starts to fall, on the loop's clock. */
export function dropStart(index: number): number {
  return index * STAGGER - HEAD_START;
}

/** How far a brick sits above its place (0 resting, 1 at the top of its fall) at loop time `t`. */
export function dropHeight(index: number, t: number): number {
  return 1 - bounce((t - dropStart(index)) / FALL);
}

/** Its size while the wall clears away, top brick first: 1 standing, 0 gone. */
export function popScale(index: number, t: number): number {
  const order = PLAN.length - 1 - index;
  const k = clamp01((t - CLEAR - order * 0.07) / POP);
  return 1 - k * k;
}

/** Half the width the wall needs, plinth and shadow included. */
const HALF_WIDTH = 3.1;
/** The wall's lowest and highest points in the frame: its shadow up to the top sparkles. */
const BOTTOM = -0.3;
const TOP = 4.3;
/**
 * The loader's "Loading…" pill sits just below the middle of the screen, so the wall stands in
 * the band above it: from a small margin at the top down to this many pixels below the middle.
 */
const PILL_CLEARANCE = 56;

/**
 * How far back the camera stands and where it looks so the wall fills the band above the
 * loader's pill on a `width` x `height` pixel canvas, at any shape from phone to landscape iPad.
 */
export function wallFraming(width: number, height: number): { distance: number; lookY: number } {
  const tan = Math.tan(((FOV / 2) * Math.PI) / 180);
  const top = height * 0.08;
  const bottom = Math.min(height * 0.94, height / 2 + PILL_CLEARANCE);
  const band = bottom - top;
  // Pixels per world unit at the wall is height / (2 * distance * tan).
  const distance = Math.max(
    ((TOP - BOTTOM) * height) / (2 * tan * band),
    (2 * HALF_WIDTH * height) / (2 * tan * width * 0.9),
  );
  const scale = height / (2 * distance * tan);
  const centre = (top + bottom) / 2;
  return { distance, lookY: (TOP + BOTTOM) / 2 - (height / 2 - centre) / scale };
}

/**
 * The loading scene for the number wall: chunky clay bricks drop one by one and bounce into a
 * 3-2-1 wall on its stone plinth, the golden top brick shines and sparkles, then the bricks pop
 * away and the wall builds again. Under calm motion it holds the finished wall, still.
 */
export class WallLoaderWorld extends Stage implements StateWorld<null> {
  private readonly wall = new Group();
  private readonly bricks: { root: Group; block: Group; rest: number }[] = [];
  private readonly topMaterial: MeshLambertMaterial;
  private readonly sparks: Mesh<OctahedronGeometry, MeshBasicMaterial>[] = [];

  constructor(canvas: HTMLCanvasElement, host: HTMLElement) {
    super(canvas, host, { fov: FOV });
    this.sun.position.set(-5, 12, 9);
    this.sun.intensity = 2.1;
    this.fill.intensity = 1.5;

    const geometry = new RoundedBoxGeometry(BRICK.w, BRICK.h, BRICK.d, 1, 0.13);
    const face = new PlaneGeometry(BRICK.w * 0.9, BRICK.h * 0.86);
    const bodies: Record<Look, MeshLambertMaterial> = {
      given: lambert(LOOKS.given.color),
      filled: lambert(LOOKS.filled.color),
      golden: lambert(LOOKS.golden.color),
    };
    this.topMaterial = bodies.golden;
    for (const { row, col, text, look } of PLAN) {
      const label = new TextLabel(text, { ink: LOOKS[look].ink, width: 192, height: 120 });
      const front = new Mesh(
        face,
        new MeshBasicMaterial({ map: label.texture, transparent: true, depthWrite: false }),
      );
      front.position.z = BRICK.d / 2 + 0.006;
      front.renderOrder = 2;
      const block = new Group();
      block.add(new Mesh(geometry, bodies[look]), front);
      const root = new Group();
      root.position.copy(brickCentre(row, col, 3));
      root.add(block);
      this.wall.add(root);
      this.bricks.push({ root, block, rest: root.position.y });
    }

    const plinth = new Mesh(
      new BoxGeometry(3 * BRICK.w + 2 * BRICK.gap + 0.5, BRICK.base, BRICK.d + 0.4),
      lambert('#a99f92', { flatShading: true }),
    );
    plinth.position.y = BRICK.base / 2;
    const shadow = new Mesh(
      new CircleGeometry(1, 24),
      new MeshBasicMaterial({
        color: '#1d2a4a',
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.set(3, 1, 1);
    shadow.position.y = 0.002;
    this.wall.add(shadow, plinth);

    const star = new OctahedronGeometry(0.11);
    for (let i = 0; i < SPARKS; i++) {
      const spark = new Mesh(
        star,
        new MeshBasicMaterial({ color: SPARK_COLORS[i % SPARK_COLORS.length], depthWrite: false }),
      );
      spark.renderOrder = 3;
      spark.visible = false;
      this.sparks.push(spark);
      this.wall.add(spark);
    }

    this.scene.add(this.wall);
  }

  setState(_: null) {}

  protected override layout(aspect: number) {
    const { distance, lookY } = wallFraming(this.width, this.height);
    this.camera.position.set(0, lookY + Math.sin(PITCH) * distance, Math.cos(PITCH) * distance);
    this.camera.lookAt(0, lookY, 0);
    super.layout(aspect);
  }

  protected update(_dt: number, elapsed: number) {
    const calm = this.calm;
    // The clock runs a little ahead so the first brick is already falling as the scene appears.
    const t = calm ? SHINE + 0.4 : ((elapsed + HEAD_START) % LOOP) - HEAD_START;

    this.bricks.forEach((brick, index) => {
      const lift = calm ? 0 : dropHeight(index, t);
      const scale = calm ? 1 : popScale(index, t);
      // A little hop as it pops away.
      brick.root.position.y = brick.rest + lift * DROP + (1 - scale) * 0.5;
      brick.root.visible = t >= dropStart(index) && scale > 0.01;
      // A squash as it lands, then it springs back to shape.
      const since = t - dropStart(index) - FALL * 0.36;
      const squash = calm || since < 0 ? 0 : Math.sin(clamp01(since / 0.3) * Math.PI) * 0.12;
      brick.block.scale.set((1 + squash * 0.6) * scale, (1 - squash) * scale, scale);
    });

    // The top brick shines gold once it lands, and fades back before it pops away.
    const glow = calm ? 0.55 : smooth((t - SHINE) / 0.3) * (1 - smooth((t - CLEAR + 0.2) / 0.3));
    const pulse = calm ? 1 : 0.8 + 0.2 * Math.sin((t - SHINE) * 9);
    this.topMaterial.emissive.copy(BLACK).lerp(GOLD_GLOW, glow * pulse);
    const top = this.bricks[this.bricks.length - 1]!;
    if (!calm) top.block.rotation.z = Math.sin(clamp01((t - SHINE) / 0.6) * Math.PI * 2) * 0.06;
    else top.block.rotation.z = 0;

    // Sparkles burst out of the golden brick in a ring and drift down as they fade.
    const burst = (t - SHINE) / 1.1;
    this.sparks.forEach((spark, i) => {
      if (calm) {
        // A still halo of a few twinkles around the finished wall.
        spark.visible = i % 2 === 0;
        const angle = (i / SPARKS) * Math.PI * 2 + 0.3;
        spark.position.set(Math.cos(angle) * 1.5, top.rest + Math.sin(angle) * 0.9, 0.6);
        spark.scale.setScalar(0.8 + (i % 3) * 0.25);
        spark.rotation.set(0.4, i, 0);
        return;
      }
      spark.visible = burst > 0 && burst < 1;
      if (!spark.visible) return;
      const angle = (i / SPARKS) * Math.PI * 2;
      const reach = easeOutBack(burst) * (1.3 + (i % 3) * 0.35);
      spark.position.set(
        Math.cos(angle) * reach * 1.25,
        top.rest + Math.sin(angle) * reach * 0.85 - burst * burst * 0.8,
        0.6,
      );
      spark.rotation.set(0.4, t * 6 + i, 0);
      spark.scale.setScalar((1 - burst) * (0.8 + (i % 3) * 0.3));
    });
  }
}
