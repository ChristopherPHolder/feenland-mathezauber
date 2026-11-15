import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NormalBlending,
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
  Texture,
  Vector3,
} from 'three';
import { TextLabel } from '../../shared/three/labels';
import {
  approach,
  easeOut,
  easeOutBack,
  EventCounter,
  shake,
  smooth,
} from '../../shared/three/motion';
import { Stage } from '../../shared/three/stage';
import { StateWorld } from '../../shared/three/three-stage';
import { constellation, ConstellationId, constellationEdges } from './star-constellations';
import { BRIDGE, FrameTick, StarFrame } from './star-frame';
import { buildNova, glowTexture, GlowKind, HOOP_Y, Nova, NOVA_HEIGHT } from './star-nova';

const DEG = Math.PI / 180;
/** The bridge is always this long in the world; the camera moves so it spans BRIDGE on screen. */
const LENGTH = 10;
const PITCH = 6 * DEG;
/** Falling stars fly a little in front of the bridge, so they drop into Nova's net. */
const STAR_Z = 0.35;
/** A caught star swoops into the net, rests, then arcs up into its constellation. */
const SWOOP = 0.5;
const REST = 0.3;
const ARC = 0.9;
/** A bounced star dips to the rim, then floats back up. */
const BOUNCE_IN = 0.4;
const BOUNCE_OUT = 0.8;
/** The two stars of a "which is further?" pair drop onto the bridge in this long. */
const DROP = 0.5;
/** Hovering stars (No rush, and pairs) hang this far down their fall. */
const HOVER = 0.35;
/** The most finished constellations drawn faintly around the sky. */
const COLLECTION_SLOTS: readonly (readonly [number, number])[] = [
  [-0.78, 0.74],
  [-0.78, 0.26],
  [0.79, 0.3],
];

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** A star with its stardust trail and, when it carries one, its number label above it. */
interface StarView {
  readonly group: Group;
  readonly sprite: Sprite;
  readonly trail: Mesh;
  readonly label: TextLabel;
  readonly tag: Sprite;
}

interface Flyer {
  readonly sprite: Sprite;
  readonly start: number;
  readonly from: Vector3;
  readonly golden: boolean;
  /** Landed stars rise straight up from the bridge: no swoop into the net. */
  readonly swoop: boolean;
  readonly gain: number;
  /** The constellation point it lights when it arrives. */
  readonly point: number;
  burst: boolean;
  started: boolean;
  readonly onStart?: () => void;
}

interface Particle {
  readonly object: Sprite | Mesh;
  readonly material: SpriteMaterial | MeshBasicMaterial;
  readonly born: number;
  readonly life: number;
  readonly velocity: Vector3;
  readonly grow: number;
  readonly fall: number;
  readonly size: number;
  readonly opacity: number;
  /** Labels own their texture and free it when they go. */
  readonly texture?: Texture;
}

interface Sky {
  readonly id: ConstellationId;
  readonly group: Group;
  readonly points: readonly Sprite[];
  readonly lines: LineSegments;
  readonly faint: boolean;
}

/**
 * The Star Catcher's night sky in 3D: a glowing bridge that is the number line, Nova the
 * star-keeper fairy with her lantern net on it, a falling star with its number, and the
 * level's constellation filling up in the sky. The bridge's end posts and walkway land exactly
 * on BRIDGE's spots on screen, so the game's DOM slider lines up with it. It never decides.
 */
export class StarWorld extends Stage implements StateWorld<StarFrame> {
  private frame?: StarFrame;
  private item = -1;
  /** Sizes in world units, worked out from pixels on every resize. */
  /** How far the bridge's front edge is from the camera. */
  private depth = 10;
  private ppu = 50;
  private tickH = 0.4;
  private labelH = 0.6;
  private starD = 0.9;
  private thick = 0.25;
  private postH = 0.5;
  private novaScale = 1;
  private yTop = 4;
  private yBottom = 2.5;
  private readonly tex: Record<GlowKind, CanvasTexture>;
  private readonly sky: CanvasTexture;
  private readonly backdrop = new Group();
  private readonly starLayers: Points[] = [];
  private readonly moon: Sprite;
  private readonly hills: Mesh;
  private readonly meadow: Mesh;
  private readonly fireflies: Sprite[] = [];
  private readonly bridge = new Group();
  private readonly walkway: Mesh;
  private readonly glass: Mesh;
  private readonly line: Mesh;
  private readonly abutments: Mesh[] = [];
  private readonly posts = new Group();
  private postLabels: TextLabel[] = [];
  private ticksKey = '';
  private readonly postGeometry = new CylinderGeometry(0.05, 0.06, 1, 10);
  private readonly endGeometry = new BoxGeometry(0.2, 1, 0.2);
  private readonly lampGeometry = new SphereGeometry(0.08, 12, 8);
  private readonly notchGeometry = new BoxGeometry(0.035, 1, 0.02);
  private readonly stone = new MeshStandardMaterial({ color: '#6d6fa8', roughness: 0.85 });
  private readonly postMaterial = new MeshStandardMaterial({
    color: '#cfc6ff',
    roughness: 0.5,
    emissive: '#4b3d9c',
    emissiveIntensity: 0.5,
  });
  private readonly ghostMaterial = new MeshBasicMaterial({
    color: '#9fe6ff',
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  private readonly lampMaterial = new MeshStandardMaterial({
    color: '#fff3c4',
    emissive: '#ffc845',
    emissiveIntensity: 1.6,
  });
  private readonly notchMaterial = new MeshBasicMaterial({ color: '#fff1b8' });
  private readonly nova: Nova;
  private readonly marker: Mesh;
  private readonly comet: Mesh;
  private novaX = 0;
  private lastNovaX = 0;
  private readonly star: StarView;
  private readonly pair: readonly [StarView, StarView];
  private readonly landed: Sprite;
  private readonly queued: Sprite[] = [];
  private starX = 0;
  private fallShown = 0;
  private bornAt = -10;
  private bounceAt = -10;
  private puffed = true;
  private dropAt = -10;
  private hidden = new Set<'star' | 'landed' | 0 | 1>();
  private readonly flyers: Flyer[] = [];
  private readonly particles: Particle[] = [];
  private main?: Sky;
  private collection: Sky[] = [];
  private collectionKey = '';
  private completePending = false;
  private pulseAt = -10;
  private readonly catches = new EventCounter();
  private readonly goldens = new EventCounter();
  private readonly bounces = new EventCounter();
  private readonly drained = new EventCounter();
  private readonly completes = new EventCounter();
  private goldenAt = -10;
  private shrugAt = -10;
  private cheerAt = -10;
  private flareAt = -10;
  private dimAt = -10;
  private shakeAt = -10;
  private cometSparkAt = 0;
  private readonly hoopPosition = new Vector3();
  private readonly scratch = new Vector3();
  private readonly scratch2 = new Vector3();
  private readonly tint = new Color();

  constructor(canvas: HTMLCanvasElement, host: HTMLElement) {
    super(canvas, host, { fov: 40 });
    this.sun.color.set('#bcc8ff');
    this.sun.intensity = 1.3;
    this.sun.position.set(-4, 8, 6);
    this.fill.color.set('#8590dc');
    this.fill.intensity = 1.1;

    const kinds: GlowKind[] = [
      'star',
      'gold',
      'pink',
      'spark',
      'puff',
      'rays',
      'moon',
      'trail',
      'rainbow',
    ];
    this.tex = Object.fromEntries(kinds.map((kind) => [kind, glowTexture(kind)])) as Record<
      GlowKind,
      CanvasTexture
    >;

    // The night: a gradient behind everything, and a backdrop that rides with the camera.
    this.sky = skyGradient();
    this.scene.background = this.sky;
    this.scene.add(this.camera);
    this.camera.add(this.backdrop);
    for (const [count, size, color] of [
      [80, 2, '#ffffff'],
      [45, 2.6, '#fff3c0'],
      [25, 3.4, '#cfe0ff'],
    ] as const) {
      const positions: number[] = [];
      for (let index = 0; index < count; index++)
        positions.push(Math.random() * 2.2 - 1.1, Math.random() * 1.5 - 0.42, 0);
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
      const layer = new Points(
        geometry,
        new PointsMaterial({
          color,
          size: size * 1.6 * this.renderer.getPixelRatio(),
          sizeAttenuation: false,
          map: this.tex.spark,
          blending: AdditiveBlending,
          transparent: true,
          depthWrite: false,
        }),
      );
      this.starLayers.push(layer);
      this.backdrop.add(layer);
    }
    this.moon = new Sprite(
      new SpriteMaterial({ map: this.tex.moon, transparent: true, depthWrite: false }),
    );
    this.hills = new Mesh(
      hillGeometry(),
      new MeshBasicMaterial({ color: '#1a2156', side: DoubleSide }),
    );
    this.meadow = new Mesh(
      new PlaneGeometry(1, 1),
      new MeshBasicMaterial({ map: meadowGradient(), depthWrite: false }),
    );
    this.backdrop.add(this.moon, this.hills, this.meadow);
    const bugColors = ['#fff59a', '#b8ffcf', '#ffd1f3', '#fff59a', '#b8f4ff', '#fff59a'];
    for (const color of bugColors) {
      const bug = new Sprite(
        new SpriteMaterial({
          map: this.tex.spark,
          color,
          transparent: true,
          blending: AdditiveBlending,
          depthWrite: false,
        }),
      );
      this.fireflies.push(bug);
      this.backdrop.add(bug);
    }

    // The bridge: a stone walkway with a glass top, a bright number line along its front edge,
    // and stone towers just past each end.
    this.walkway = new Mesh(new BoxGeometry(LENGTH + 1, 1, 0.8), this.stone);
    this.walkway.position.z = -0.39;
    this.glass = new Mesh(
      new BoxGeometry(LENGTH + 0.9, 0.03, 0.72),
      new MeshStandardMaterial({
        color: '#bdeaff',
        emissive: '#5fc8ff',
        emissiveIntensity: 0.55,
        transparent: true,
        opacity: 0.8,
        roughness: 0.1,
      }),
    );
    this.line = new Mesh(
      new BoxGeometry(LENGTH, 0.05, 0.02),
      new MeshBasicMaterial({ color: '#ffe9a8' }),
    );
    for (const side of [-1, 1]) {
      const tower = new Mesh(new BoxGeometry(0.42, 1, 0.7), this.stone);
      tower.position.z = -0.38;
      tower.position.x = side * (LENGTH / 2 + 0.55);
      this.abutments.push(tower);
    }
    this.bridge.add(this.walkway, this.glass, this.line, ...this.abutments, this.posts);
    this.scene.add(this.bridge);

    // Nova, with a soft glow on the walkway under her lantern and a comet tail for a streak.
    this.nova = buildNova();
    this.marker = new Mesh(
      new RingGeometry(0.16, 0.26, 32),
      new MeshBasicMaterial({
        color: '#ffe38a',
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.position.set(0, 0.03, 0.02);
    const tailGeometry = new PlaneGeometry(1, 1);
    tailGeometry.translate(0, 0.5, 0);
    this.comet = new Mesh(
      tailGeometry,
      new MeshBasicMaterial({
        map: this.tex.rainbow,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
      }),
    );
    this.comet.position.set(0, HOOP_Y - 0.22, 0.05);
    this.comet.scale.set(0.4, 1.6, 1);
    this.comet.rotation.z = 0.95;
    this.comet.visible = false;
    this.nova.body.add(this.comet);
    this.nova.group.add(this.marker);
    this.scene.add(this.nova.group);

    // The falling star, the "which is further?" pair, a landed star, and waiting shooting stars.
    this.star = this.buildStar();
    this.pair = [this.buildStar(), this.buildStar()];
    this.landed = new Sprite(
      new SpriteMaterial({ map: this.tex.star, transparent: true, depthWrite: false }),
    );
    this.scene.add(this.star.group, this.pair[0].group, this.pair[1].group, this.landed);
    for (let index = 0; index < 3; index++) {
      const waiting = new Sprite(
        new SpriteMaterial({ map: this.tex.pink, transparent: true, depthWrite: false }),
      );
      waiting.visible = false;
      this.queued.push(waiting);
      this.backdrop.add(waiting);
    }
  }

  setState(frame: StarFrame) {
    const first = !this.frame;
    this.frame = frame;
    if (first) {
      this.novaX = this.lastNovaX = this.starX = this.atX(frame.net);
    }
    this.syncTicks(frame.ticks);
    this.syncSkies(frame);
    if (frame.item !== this.item) this.startItem(frame);
    this.star.label.update(frame.label);
    if (frame.pair) {
      this.pair[0].label.update(frame.pair[0]);
      this.pair[1].label.update(frame.pair[1]);
    }
    if (frame.kind === 'compare' && frame.landed.length === 2 && this.dropAt < this.bornAt)
      this.dropAt = this.elapsed;

    const caught = this.catches.take(frame.catches);
    const golden = this.goldens.take(frame.goldens);
    if (caught || golden) this.startCatch(frame, golden > 0 || frame.golden);
    if (this.bounces.take(frame.bounces)) this.startBounce(frame);
    if (this.drained.take(frame.drained)) {
      this.starPosition(this.scratch);
      this.puff(this.scratch, 5);
    }
    if (this.completes.take(frame.completes)) this.completePending = true;
    this.draw();
  }

  /* ---------------------------------------------------------------------------------------- */
  /* Layout                                                                                    */
  /* ---------------------------------------------------------------------------------------- */

  protected override layout(aspect: number) {
    super.layout(aspect);
    const camera = this.camera;
    const tan = Math.tan((camera.fov * DEG) / 2);
    const span = BRIDGE.right - BRIDGE.left;
    // At the bridge's depth `depth`, the half-length (5) spans `span` in ndc.
    const depth = LENGTH / 2 / (span * tan * aspect);
    const cx = BRIDGE.left + BRIDGE.right - 1;
    const cy = 1 - 2 * BRIDGE.y;
    const lift = -cy * depth * tan;
    const sin = Math.sin(PITCH);
    const cos = Math.cos(PITCH);
    const x = -cx * depth * tan * aspect;
    camera.position.set(x, depth * sin + lift * cos, depth * cos - lift * sin);
    camera.lookAt(x, camera.position.y - sin, camera.position.z - cos);
    camera.updateMatrixWorld();
    this.depth = depth;

    const { width: w, height: h } = this;
    this.ppu = (w * span) / LENGTH;
    const px = (n: number) => n / this.ppu;
    this.tickH = px(clamp(h * 0.048, 18, 30));
    this.labelH = px(clamp(h * 0.08, 30, 52));
    this.starD = px(clamp(h * 0.11, 40, 76));
    this.thick = px(clamp(h * 0.03, 10, 20));
    this.postH = px(clamp(h * 0.07, 22, 44));
    this.novaScale = clamp(px(clamp(h * 0.19, 78, 150)) / NOVA_HEIGHT, 0.4, 3);

    // The walkway's top is y = 0; its body hangs below.
    this.walkway.scale.y = this.thick;
    this.walkway.position.y = -this.thick / 2;
    this.glass.position.y = 0.0;
    this.line.position.set(0, -this.thick * 0.18, 0.02);
    this.glass.position.z = -0.37;
    for (const tower of this.abutments) {
      const tall = this.thick + 6;
      tower.scale.y = tall;
      tower.position.y = this.postH * 0.6 - tall / 2;
    }
    this.nova.group.scale.setScalar(this.novaScale);
    this.ticksKey = '';
    if (this.frame) this.syncTicks(this.frame.ticks);

    // The star falls from just under the top (its label still showing) to just above the hoop.
    const topPx = 8 + this.labelH * this.ppu + 6 + (this.starD * this.ppu) / 2;
    this.yTop = this.rayY(1 - (2 * topPx) / h, STAR_Z);
    this.yBottom = HOOP_Y * this.novaScale + this.starD * 0.45;
    // On a short board (a sideways phone) the fall gets shorter rather than pushing the label
    // off the top; the hoop end never moves.
    if (this.yTop < this.yBottom + this.starD * 0.25) this.yTop = this.yBottom + this.starD * 0.25;
    for (const view of [this.star, ...this.pair]) this.sizeStar(view);
    this.landed.scale.setScalar(this.starD * 0.85);

    // The backdrop: scaled so ndc-like coordinates fill the view at each depth.
    const at = (group: { position: Vector3; scale: Vector3 }, d: number) => {
      group.position.set(0, 0, -d);
      group.scale.set(d * tan * aspect, d * tan, 1);
    };
    for (const layer of this.starLayers) at(layer, depth + 45);
    at(this.hills, depth + 14);
    this.hills.position.y += cy * (depth + 14) * tan;
    const meadowDepth = depth + 12;
    this.meadow.position.set(0, ((cy - 1) / 2) * meadowDepth * tan, -meadowDepth);
    this.meadow.scale.set(2.3 * meadowDepth * tan * aspect, (cy + 1.05) * meadowDepth * tan, 1);
    const moonDepth = depth + 40;
    this.place(this.moon, 0.78, 0.78, moonDepth);
    this.moon.scale.setScalar(this.pxAt(moonDepth, clamp(h * 0.18, 56, 110)));
    this.queued.forEach((sprite, index) => {
      const d = depth + 8;
      this.place(sprite, 0.36 + index * 0.12, 0.86 - (index % 2) * 0.05, d);
      sprite.scale.setScalar(this.pxAt(d, clamp(h * 0.05, 18, 30)));
    });
    this.layoutSkies();
  }

  /** World y where the ray through screen height `ndcY` (centre column) meets the plane z. */
  private rayY(ndcY: number, z: number) {
    const camera = this.camera;
    const tan = Math.tan((camera.fov * DEG) / 2);
    const sin = Math.sin(PITCH);
    const cos = Math.cos(PITCH);
    const dy = -sin + ndcY * tan * cos;
    const dz = -cos - ndcY * tan * sin;
    const t = (z - camera.position.z) / dz;
    return camera.position.y + t * dy;
  }

  /** Camera units per screen pixel at `depth` in front of the camera. */
  private pxAt(depth: number, px: number) {
    return (px * 2 * depth * Math.tan((this.camera.fov * DEG) / 2)) / this.height;
  }

  /** Puts a backdrop object at ndc-like (x, y) on screen, `depth` in front of the camera. */
  private place(object: { position: Vector3 }, x: number, y: number, depth: number) {
    const tan = Math.tan((this.camera.fov * DEG) / 2);
    object.position.set(x * depth * tan * this.camera.aspect, y * depth * tan, -depth);
  }

  /**
   * The x to give something at (y, z) so it shows straight above or below bridge point x: in
   * perspective, things behind the front edge drift toward the middle, things in front away.
   */
  private alignX(x: number, y: number, z: number) {
    const depth = this.depth - y * Math.sin(PITCH) - z * Math.cos(PITCH);
    return (x * depth) / this.depth;
  }

  private atX(at: number) {
    return (at - 0.5) * LENGTH;
  }

  /* ---------------------------------------------------------------------------------------- */
  /* Bridge posts                                                                              */
  /* ---------------------------------------------------------------------------------------- */

  private syncTicks(ticks: readonly FrameTick[]) {
    const key = ticks
      .map((tick) => `${tick.at}:${tick.label ?? ''}:${tick.hint ? 1 : 0}`)
      .join('|');
    if (key === this.ticksKey) return;
    this.ticksKey = key;
    for (const child of [...this.posts.children]) {
      child.removeFromParent();
      if (child instanceof Sprite) child.material.dispose();
    }
    for (const label of this.postLabels) label.texture.dispose();
    this.postLabels = [];
    for (const tick of ticks) {
      const x = this.atX(tick.at);
      const end = tick.at === 0 || tick.at === 1;
      const labelled = tick.label !== null;
      if (tick.hint) {
        const ghost = new Mesh(this.postGeometry, this.ghostMaterial);
        ghost.scale.set(0.8, this.postH * 0.55, 0.8);
        ghost.position.set(this.alignX(x, this.postH * 0.3, -0.5), (this.postH * 0.55) / 2, -0.5);
        const notch = new Mesh(this.notchGeometry, this.ghostMaterial);
        notch.scale.y = this.thick * 0.7;
        notch.position.set(this.alignX(x, -this.thick * 0.5, 0.03), -this.thick * 0.5, 0.03);
        this.posts.add(ghost, notch);
        continue;
      }
      const tall = this.postH * (end ? 1.15 : labelled ? 1 : 0.6);
      const post = new Mesh(
        end ? this.endGeometry : this.postGeometry,
        end ? this.stone : this.postMaterial,
      );
      post.scale.set(1, tall, 1);
      post.position.set(this.alignX(x, tall / 2, -0.5), tall / 2, -0.5);
      const notch = new Mesh(this.notchGeometry, this.notchMaterial);
      notch.scale.set(labelled ? 1.6 : 1, this.thick * (labelled ? 0.95 : 0.6), 1);
      notch.position.set(
        this.alignX(x, -this.thick * 0.4, 0.03),
        -this.thick * (labelled ? 0.48 : 0.3),
        0.03,
      );
      this.posts.add(post, notch);
      if (labelled || end) {
        const lamp = new Mesh(this.lampGeometry, this.lampMaterial);
        lamp.scale.setScalar(end ? 1.4 : 1);
        lamp.position.set(this.alignX(x, tall, -0.5), tall + 0.05, -0.5);
        this.posts.add(lamp);
      }
      if (labelled) {
        const label = new TextLabel(tick.label!, {
          fill: '#16183dee',
          border: '#ffd86b',
          ink: '#fff6d6',
          width: 200,
          height: 120,
          radius: 0.4,
        });
        this.postLabels.push(label);
        const sprite = new Sprite(
          new SpriteMaterial({ map: label.texture, depthTest: false, transparent: true }),
        );
        sprite.renderOrder = 15;
        sprite.scale.set(this.tickH * (200 / 120), this.tickH, 1);
        const y = -this.thick - 0.08 - this.tickH / 2;
        sprite.position.set(this.alignX(x, y, 0.05), y, 0.05);
        this.posts.add(sprite);
      }
    }
  }

  /* ---------------------------------------------------------------------------------------- */
  /* Constellations                                                                            */
  /* ---------------------------------------------------------------------------------------- */

  private syncSkies(frame: StarFrame) {
    if (this.main?.id !== frame.constellation) {
      if (this.main) this.disposeSky(this.main);
      for (const flyer of [...this.flyers]) this.removeFlyer(flyer);
      this.main = this.buildSky(frame.constellation, false);
      this.layoutSkies();
    }
    const others = frame.collection
      .filter((id) => id !== frame.constellation)
      .slice(0, COLLECTION_SLOTS.length);
    const key = others.join(',');
    if (key !== this.collectionKey) {
      this.collectionKey = key;
      for (const sky of this.collection) this.disposeSky(sky);
      this.collection = others.map((id) => this.buildSky(id, true));
      this.layoutSkies();
    }
  }

  private buildSky(id: ConstellationId, faint: boolean): Sky {
    const shape = constellation(id);
    const group = new Group();
    const points = shape.points.map(() => {
      const sprite = new Sprite(
        new SpriteMaterial({
          map: this.tex.star,
          transparent: true,
          depthWrite: false,
          opacity: faint ? 0.45 : 0.5,
        }),
      );
      group.add(sprite);
      return sprite;
    });
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      'position',
      new Float32BufferAttribute(new Float32Array((shape.points.length + 1) * 6), 3),
    );
    const lines = new LineSegments(
      geometry,
      new LineBasicMaterial({
        color: faint ? '#9fb6ff' : '#cfe7ff',
        transparent: true,
        opacity: faint ? 0.3 : 0.75,
        depthWrite: false,
      }),
    );
    group.add(lines);
    this.backdrop.add(group);
    return { id, group, points, lines, faint };
  }

  private layoutSkies() {
    const { width: w, height: h } = this;
    if (w <= 1) return;
    const depth = -this.starLayers[0].position.z - 20;
    if (this.main) {
      const size = Math.min(h * 0.38, w * 0.55);
      this.place(this.main.group, 0, 0.54, depth);
      this.main.group.userData['unit'] = this.pxAt(depth, size);
      this.main.group.userData['dot'] = this.pxAt(depth, clamp(h * 0.04, 14, 26));
      this.positionSky(this.main, true);
    }
    this.collection.forEach((sky, index) => {
      const [x, y] = COLLECTION_SLOTS[index];
      const size = Math.min(h * 0.17, w * 0.18);
      this.place(sky.group, x, y, depth + 2);
      sky.group.userData['unit'] = this.pxAt(depth + 2, size);
      sky.group.userData['dot'] = this.pxAt(depth + 2, clamp(h * 0.022, 8, 14));
      this.positionSky(sky, true);
    });
  }

  /** Lays out a constellation's points and its lines for `lit` points (all for faint ones). */
  private positionSky(sky: Sky, all: boolean, lit = 0, complete = true) {
    const shape = constellation(sky.id);
    const unit = sky.group.userData['unit'] as number;
    shape.points.forEach(([x, y], index) => {
      sky.points[index].position.set((x - 0.5) * unit, (0.5 - y) * unit, 0);
    });
    const edges = constellationEdges(shape, all ? shape.points.length : lit, all || complete);
    const position = sky.lines.geometry.getAttribute('position') as Float32BufferAttribute;
    edges.forEach(([a, b], index) => {
      const pa = sky.points[a].position;
      const pb = sky.points[b].position;
      position.setXYZ(index * 2, pa.x, pa.y, -0.01);
      position.setXYZ(index * 2 + 1, pb.x, pb.y, -0.01);
    });
    position.needsUpdate = true;
    sky.lines.geometry.setDrawRange(0, edges.length * 2);
  }

  private disposeSky(sky: Sky) {
    sky.group.removeFromParent();
    for (const point of sky.points) point.material.dispose();
    sky.lines.geometry.dispose();
    (sky.lines.material as LineBasicMaterial).dispose();
  }

  /* ---------------------------------------------------------------------------------------- */
  /* Stars                                                                                     */
  /* ---------------------------------------------------------------------------------------- */

  private buildStar(): StarView {
    const group = new Group();
    const sprite = new Sprite(
      new SpriteMaterial({ map: this.tex.star, transparent: true, depthWrite: false }),
    );
    sprite.renderOrder = 12;
    const trailGeometry = new PlaneGeometry(1, 1);
    trailGeometry.translate(0, 0.5, 0);
    const trail = new Mesh(
      trailGeometry,
      new MeshBasicMaterial({
        map: this.tex.trail,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    );
    trail.renderOrder = 11;
    const label = new TextLabel('', {
      fill: '#fff6d6',
      border: '#ffc23d',
      ink: '#1b1f4a',
      width: 320,
      height: 144,
      radius: 0.45,
    });
    const tag = new Sprite(
      new SpriteMaterial({ map: label.texture, depthTest: false, transparent: true }),
    );
    tag.renderOrder = 25;
    group.add(trail, sprite, tag);
    return { group, sprite, trail, label, tag };
  }

  private sizeStar(view: StarView) {
    view.sprite.scale.setScalar(this.starD);
    view.tag.scale.set(this.labelH * (320 / 144), this.labelH, 1);
    view.tag.position.set(0, this.starD * 0.42 + this.labelH * 0.55, 0.05);
  }

  private startItem(frame: StarFrame) {
    this.item = frame.item;
    this.bornAt = this.elapsed;
    this.bounceAt = -10;
    this.dropAt = -10;
    this.puffed = true;
    this.fallShown = frame.hover ? HOVER : frame.fall;
    this.starX = this.novaX;
    this.hidden.clear();
    const finale = frame.finale;
    this.star.sprite.material.map = finale ? this.tex.pink : this.tex.star;
    (this.star.trail.material as MeshBasicMaterial).map = finale
      ? this.tex.rainbow
      : this.tex.trail;
    for (const view of [this.star, ...this.pair]) {
      view.sprite.material.needsUpdate = true;
      (view.trail.material as MeshBasicMaterial).needsUpdate = true;
    }
  }

  /** Where the falling star is now, before any bounce. */
  private restPosition(target: Vector3) {
    return target.set(this.starX, lerp(this.yBottom, this.yTop, 1 - this.fallShown), STAR_Z);
  }

  private starPosition(target: Vector3) {
    return target.copy(this.star.group.position);
  }

  private hoop(target: Vector3) {
    this.nova.group.updateMatrixWorld();
    return this.nova.hoop.getWorldPosition(target);
  }

  private startCatch(frame: StarFrame, golden: boolean) {
    const point = Math.max(0, frame.lit - 1);
    const make = (map: Texture) =>
      new Sprite(new SpriteMaterial({ map, transparent: true, depthWrite: false }));
    const map = golden ? this.tex.gold : frame.finale ? this.tex.pink : this.tex.star;
    if (frame.kind === 'place') {
      const sprite = make(map);
      sprite.renderOrder = 12;
      sprite.scale.setScalar(this.starD);
      const from = this.starPosition(new Vector3());
      sprite.position.copy(from);
      this.scene.add(sprite);
      this.hidden.add('star');
      this.flyers.push({
        sprite,
        start: this.elapsed,
        from,
        golden,
        swoop: true,
        gain: frame.gain,
        point,
        burst: false,
        started: true,
      });
    } else if (frame.kind === 'landed') {
      const sprite = make(map);
      sprite.scale.setScalar(this.starD * 0.85);
      const from = this.landed.position.clone();
      sprite.position.copy(from);
      this.scene.add(sprite);
      this.hidden.add('landed');
      this.flyers.push({
        sprite,
        start: this.elapsed,
        from,
        golden,
        swoop: false,
        gain: frame.gain,
        point,
        burst: false,
        started: true,
      });
    } else {
      // The pair drops onto the bridge first; then the one further along rises.
      const further = (frame.landed[1] ?? 0) > (frame.landed[0] ?? 0) ? 1 : 0;
      const sprite = make(map);
      sprite.scale.setScalar(this.starD);
      sprite.visible = false;
      this.scene.add(sprite);
      const flyer: Flyer = {
        sprite,
        start: this.elapsed + DROP + 0.2,
        from: new Vector3(),
        golden,
        swoop: false,
        gain: frame.gain,
        point,
        burst: false,
        started: false,
        onStart: () => {
          flyer.from.copy(this.pair[further].group.position);
          sprite.position.copy(flyer.from);
          sprite.visible = true;
          this.hidden.add(further);
        },
      };
      this.flyers.push(flyer);
    }
  }

  private startBounce(frame: StarFrame) {
    this.shrugAt = this.elapsed;
    this.dimAt = this.elapsed;
    this.shakeAt = this.elapsed;
    if (frame.kind === 'place') {
      this.bounceAt = this.elapsed;
      this.puffed = false;
    } else if (frame.kind === 'landed') {
      this.puff(this.landed.position, 6);
    } else {
      this.bounceAt = this.elapsed;
      this.puffed = true;
    }
  }

  /* ---------------------------------------------------------------------------------------- */
  /* Effects                                                                                   */
  /* ---------------------------------------------------------------------------------------- */

  private sprite(map: Texture, color: string, additive: boolean) {
    const material = new SpriteMaterial({
      map,
      color,
      transparent: true,
      depthWrite: false,
      blending: additive ? AdditiveBlending : NormalBlending,
    });
    const sprite = new Sprite(material);
    sprite.renderOrder = 18;
    return { sprite, material };
  }

  private burst(at: Vector3, golden: boolean) {
    const count = golden ? 26 : 14;
    const size = this.starD;
    for (let index = 0; index < count; index++) {
      const color = golden
        ? index % 2
          ? '#ffd23f'
          : '#fff3a0'
        : index % 3
          ? '#fff6c8'
          : '#9fe6ff';
      const { sprite, material } = this.sprite(this.tex.spark, color, true);
      sprite.position.copy(at);
      const angle = (index / count) * Math.PI * 2;
      const speed = size * (golden ? 3.2 : 2.2) * (0.7 + (index % 3) * 0.2);
      this.particles.push({
        object: sprite,
        material,
        born: this.elapsed,
        life: golden ? 1.1 : 0.8,
        velocity: new Vector3(Math.cos(angle) * speed, Math.sin(angle) * speed + size, 0.2),
        grow: -0.6,
        fall: size * 3,
        size: size * (golden ? 0.5 : 0.38),
        opacity: 1,
      });
      this.scene.add(sprite);
    }
    if (golden) {
      const rays = this.sprite(this.tex.rays, '#ffe066', true);
      rays.sprite.position.copy(at);
      this.particles.push({
        object: rays.sprite,
        material: rays.material,
        born: this.elapsed,
        life: 1.2,
        velocity: new Vector3(),
        grow: 2.2,
        fall: 0,
        size: size * 1.6,
        opacity: 1,
      });
      this.scene.add(rays.sprite);
      const ringMaterial = new MeshBasicMaterial({
        color: '#ffd23f',
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
      });
      const ring = new Mesh(new RingGeometry(0.8, 1, 40), ringMaterial);
      ring.position.copy(at);
      ring.renderOrder = 17;
      this.particles.push({
        object: ring,
        material: ringMaterial,
        born: this.elapsed,
        life: 0.9,
        velocity: new Vector3(),
        grow: 5,
        fall: 0,
        size: size * 0.5,
        opacity: 0.9,
      });
      this.scene.add(ring);
    }
  }

  private puff(at: Vector3, count: number) {
    for (let index = 0; index < count; index++) {
      const { sprite, material } = this.sprite(this.tex.puff, '#d6d4e4', false);
      const angle = (index / count) * Math.PI * 2;
      sprite.position.set(
        at.x + Math.cos(angle) * this.starD * 0.3,
        at.y + Math.sin(angle) * this.starD * 0.2,
        at.z + 0.05,
      );
      this.particles.push({
        object: sprite,
        material,
        born: this.elapsed,
        life: 0.9,
        velocity: new Vector3(Math.cos(angle) * this.starD * 0.8, this.starD * 0.6, 0),
        grow: 1.4,
        fall: 0,
        size: this.starD * 0.5,
        opacity: 0.85,
      });
      this.scene.add(sprite);
    }
  }

  private pointsLabel(at: Vector3, gain: number) {
    const label = new TextLabel(`+${gain}`, {
      fill: '#1b1f4ae6',
      border: '#ffd23f',
      ink: '#ffe680',
      width: 224,
      height: 112,
      radius: 0.45,
    });
    const material = new SpriteMaterial({
      map: label.texture,
      depthTest: false,
      transparent: true,
    });
    const sprite = new Sprite(material);
    sprite.renderOrder = 30;
    sprite.position.set(at.x, at.y + this.starD * 0.4, at.z + 0.1);
    this.particles.push({
      object: sprite,
      material,
      born: this.elapsed,
      life: 1.4,
      velocity: new Vector3(0, this.labelH * 1.3, 0),
      grow: 0,
      fall: 0,
      size: this.labelH * 0.9,
      opacity: 1,
      texture: label.texture,
    });
    this.scene.add(sprite);
  }

  /* ---------------------------------------------------------------------------------------- */
  /* The frame loop                                                                            */
  /* ---------------------------------------------------------------------------------------- */

  protected update(dt: number, t: number) {
    const frame = this.frame;
    if (!frame) return;
    const calm = this.calm;

    // Twinkling sky and drifting fireflies; both hold still under calm motion.
    this.starLayers.forEach((layer, index) => {
      (layer.material as PointsMaterial).opacity = calm
        ? 0.85
        : 0.6 + 0.4 * Math.sin(t * (1.3 + index * 0.7) + index * 2);
    });
    const cy = 1 - 2 * BRIDGE.y;
    this.fireflies.forEach((bug, index) => {
      const d = -this.starLayers[0].position.z - 35;
      const phase = calm ? index * 1.7 : t * (0.25 + index * 0.05) + index * 1.7;
      const x = Math.sin(phase) * 0.85 + (index % 2 ? 0.08 : -0.08);
      const y =
        index < 3
          ? cy - 0.18 - 0.14 * Math.abs(Math.sin(phase * 1.3))
          : cy + 0.05 + 0.12 * Math.abs(Math.cos(phase));
      this.place(bug, x, y, d);
      bug.scale.setScalar(
        this.pxAt(d, 14) * (calm ? 1 : 0.8 + 0.4 * Math.abs(Math.sin(t * 3 + index))),
      );
    });

    // The bridge shakes a little when a star bounces off.
    this.bridge.position.x = calm ? 0 : shake(t, this.shakeAt, 0.5, 0.06);

    // Nova glides to the net's spot.
    const target = this.atX(frame.net);
    this.lastNovaX = this.novaX;
    this.novaX = approach(this.novaX, target, 12, dt);
    const speed = Math.abs(this.novaX - this.lastNovaX) / Math.max(dt, 1e-3);
    const nova = this.nova;
    nova.group.position.set(this.alignX(this.novaX, 0, -0.12), 0, -0.12);
    this.animateNova(frame, t, speed, calm);

    // The falling star, a landed star, or a pair.
    this.updateStars(frame, t, dt, calm);

    // Queued shooting stars wait in the sky during the finale.
    this.queued.forEach((sprite, index) => {
      sprite.visible = frame.finale && index < frame.queued;
      sprite.material.opacity = calm ? 0.9 : 0.6 + 0.4 * Math.sin(t * 4 + index * 2);
    });

    this.updateFlyers(t);
    this.updateSky(frame, t, calm);
    this.updateParticles(t, dt);
  }

  private animateNova(frame: StarFrame, t: number, speed: number, calm: boolean) {
    const nova = this.nova;
    const moving = speed > 0.3;
    nova.wings.forEach((wing, index) => {
      const side = index < 2 ? -1 : 1;
      const lower = index % 2;
      const flap = calm
        ? 0
        : Math.sin(t * (moving ? 26 : 7) + lower * 0.6) * (moving ? 0.55 : 0.18);
      wing.rotation.y = side * (0.5 + flap);
    });
    nova.body.position.y = calm ? 0 : Math.sin(t * 2.1) * 0.02;
    nova.body.rotation.z = calm ? 0 : clamp((this.novaX - this.lastNovaX) * -1.5, -0.12, 0.12);

    // A golden spin, a shrug at a bounce, a cheer for a finished constellation.
    const spin = t - this.goldenAt;
    nova.body.rotation.y = !calm && spin < 0.8 ? Math.PI * 2 * easeOut(spin / 0.8) : 0;
    const shrug = t - this.shrugAt;
    const shrugging = shrug < 0.8 ? Math.sin((shrug / 0.8) * Math.PI) : 0;
    nova.head.rotation.z = shrugging * 0.25;
    nova.body.rotation.x = shrugging * -0.08;
    const cheer = t - this.cheerAt;
    const cheering = cheer < 1.4;
    if (cheering && !calm)
      nova.body.position.y += Math.abs(Math.sin((cheer / 1.4) * Math.PI * 3)) * 0.18;
    nova.arms[0].rotation.z = cheering ? -2.7 : shrugging ? -0.25 - shrugging * 1.1 : -0.25;

    // The lantern glows brighter as the star comes down, flares at a catch, dims at a bounce.
    const near = frame.kind === 'place' && frame.phase === 'falling' ? this.fallShown : 0.4;
    const flare = Math.max(0, 1 - (t - this.flareAt) / 0.7);
    const dim = t - this.dimAt < 0.7 ? 0.25 + 0.75 * ((t - this.dimAt) / 0.7) : 1;
    const glow = (1.1 + 1.6 * near + 4 * flare) * dim;
    nova.lantern.emissiveIntensity = glow;
    nova.hoopMaterial.emissiveIntensity = 0.5 + 1.2 * flare + (frame.comet ? 0.4 : 0);
    nova.light.intensity = glow * 1.6;
    (this.marker.material as MeshBasicMaterial).opacity = 0.45 + 0.25 * near * dim;

    // The comet tail streams from the lantern while the streak lasts.
    this.comet.visible = frame.comet;
    if (frame.comet) {
      const material = this.comet.material as MeshBasicMaterial;
      material.opacity = calm ? 0.85 : 0.7 + 0.3 * Math.sin(t * 6);
      const lean = clamp((this.novaX - this.lastNovaX) * 8, -0.5, 0.5);
      this.comet.rotation.z = 0.95 + lean;
      if (!calm && t - this.cometSparkAt > 0.07) {
        this.cometSparkAt = t;
        this.hoop(this.hoopPosition);
        const hue = (t * 0.6) % 1;
        const { sprite, material: sparkMaterial } = this.sprite(
          this.tex.spark,
          `#${this.tint.setHSL(hue, 0.9, 0.7).getHexString()}`,
          true,
        );
        sprite.position.set(
          this.hoopPosition.x,
          this.hoopPosition.y - 0.2 * this.novaScale,
          this.hoopPosition.z + 0.05,
        );
        this.particles.push({
          object: sprite,
          material: sparkMaterial,
          born: t,
          life: 0.8,
          velocity: new Vector3(-0.9 * this.novaScale - lean, 0.5 * this.novaScale, 0),
          grow: -0.8,
          fall: 0,
          size: this.starD * 0.28,
          opacity: 1,
        });
        this.scene.add(sprite);
      }
    }
  }

  private updateStars(frame: StarFrame, t: number, dt: number, calm: boolean) {
    const placing = frame.kind === 'place' && frame.phase !== 'complete';
    const star = this.star;
    star.group.visible = placing && !this.hidden.has('star');
    if (placing) {
      const goal = frame.hover ? HOVER : frame.fall;
      this.fallShown = approach(this.fallShown, goal, 3, dt);
      this.starX = approach(this.starX, this.novaX, 1.6, dt);
      const rest = this.restPosition(this.scratch);
      if (frame.hover && !calm) rest.y += Math.sin(t * 1.8) * this.starD * 0.12;
      const age = t - this.bounceAt;
      if (age < BOUNCE_IN + BOUNCE_OUT) {
        const rim = this.hoop(this.scratch2);
        rim.y += this.starD * 0.35;
        rim.z = STAR_Z;
        let w: number;
        let lift = 0;
        if (age < BOUNCE_IN) {
          const p = age / BOUNCE_IN;
          w = p * p;
        } else {
          const p = (age - BOUNCE_IN) / BOUNCE_OUT;
          w = 1 - easeOut(p);
          lift = Math.sin(p * Math.PI) * this.starD * 1.2;
          if (!this.puffed) {
            this.puffed = true;
            this.puff(rim, 6);
          }
        }
        rest.lerp(rim, w);
        rest.y += lift;
      }
      star.group.position.copy(rest);
      const pop = t - this.bornAt;
      star.group.scale.setScalar(pop < 0.45 ? Math.max(0.001, easeOutBack(pop / 0.45)) : 1);
      star.sprite.material.rotation = calm ? 0 : t * 0.6;
      this.shapeTrail(star, frame.stardust, frame.finale, calm, t);
    }

    // A landed star glows on the walkway, waiting for its number.
    this.landed.visible =
      frame.kind === 'landed' && !this.hidden.has('landed') && frame.landed.length > 0;
    if (this.landed.visible) {
      this.landed.position.set(
        this.alignX(this.atX(frame.landed[0]), this.starD * 0.32, 0.2),
        this.starD * 0.32,
        0.2,
      );
      this.landed.scale.setScalar(this.starD * 0.85 * (calm ? 1 : 1 + Math.sin(t * 3) * 0.08));
    }

    // A pair hovers side by side over the middle, then drops onto its two spots.
    const comparing = frame.kind === 'compare';
    const gap = Math.max(this.labelH * (320 / 144) * 1.25, this.starD * 1.8);
    const wobble = calm ? 0 : shake(t, this.bounceAt, 0.6, this.starD * 0.25);
    this.pair.forEach((view, index) => {
      view.group.visible = comparing && !this.hidden.has(index as 0 | 1);
      if (!comparing) return;
      const hoverY =
        lerp(this.yBottom, this.yTop, 1 - HOVER) +
        (calm ? 0 : Math.sin(t * 1.8 + index) * this.starD * 0.1);
      const x = (index ? 1 : -1) * (gap / 2);
      const drop = this.dropAt > this.bornAt ? (t - this.dropAt) / DROP : 0;
      if (drop > 0 && frame.landed.length === 2) {
        const p = Math.min(1, drop);
        view.group.position.set(
          lerp(x, this.alignX(this.atX(frame.landed[index]), 0, STAR_Z), smooth(p)),
          lerp(hoverY, this.starD * 0.35, p * p),
          STAR_Z,
        );
      } else {
        view.group.position.set(x + wobble * (index ? 1 : -1), hoverY, STAR_Z);
      }
      view.group.scale.setScalar(
        Math.min(1, Math.max(0.001, easeOutBack((t - this.bornAt) / 0.45))),
      );
      view.sprite.material.map = this.tex.star;
      view.sprite.material.rotation = calm ? 0 : t * 0.5 + index;
      this.shapeTrail(view, frame.stardust, false, calm, t);
    });
  }

  private shapeTrail(view: StarView, stardust: number, finale: boolean, calm: boolean, t: number) {
    const share = clamp(stardust, 0, 1);
    view.trail.visible = share > 0.01;
    const longest = this.starD * (finale ? 5 : 3.2);
    view.trail.scale.set(this.starD * (finale ? 0.7 : 0.55), Math.max(0.001, longest * share), 1);
    view.trail.rotation.z = finale ? 0.55 : 0.12;
    const flicker = calm ? 1 : 0.9 + 0.1 * Math.sin(t * 9);
    (view.trail.material as MeshBasicMaterial).opacity = (0.25 + 0.75 * share) * flicker;
  }

  private updateFlyers(t: number) {
    const hoop = this.hoop(this.hoopPosition);
    for (const flyer of [...this.flyers]) {
      const age = t - flyer.start;
      if (age < 0) continue;
      if (!flyer.started) {
        flyer.started = true;
        flyer.onStart?.();
      }
      const swoop = flyer.swoop ? SWOOP : 0;
      const sprite = flyer.sprite;
      if (age < swoop) {
        const p = smooth(age / swoop);
        sprite.position.lerpVectors(flyer.from, hoop, p);
        continue;
      }
      if (!flyer.burst) {
        flyer.burst = true;
        const at = flyer.swoop ? hoop : flyer.from;
        this.burst(at, flyer.golden);
        this.pointsLabel(at, flyer.gain);
        this.flareAt = t;
        if (flyer.golden) this.goldenAt = t;
        if (flyer.swoop) sprite.position.copy(hoop);
      }
      const rest = age - swoop;
      if (rest < REST) {
        sprite.scale.setScalar(this.starD * (1 + 0.15 * Math.sin((rest / REST) * Math.PI)));
        continue;
      }
      const sky = this.main;
      const p = Math.min(1, (rest - REST) / ARC);
      const point = sky?.points[Math.min(flyer.point, sky.points.length - 1)];
      if (!point) {
        this.removeFlyer(flyer);
        continue;
      }
      point.getWorldPosition(this.scratch2);
      const start = flyer.swoop ? hoop : flyer.from;
      const eased = smooth(p);
      sprite.position.lerpVectors(start, this.scratch2, eased);
      sprite.position.y += Math.sin(p * Math.PI) * this.starD * 1.5;
      const dotWorld = (sky!.group.userData['dot'] as number) * 1.4;
      sprite.scale.setScalar(lerp(this.starD, dotWorld, eased));
      if (p >= 1) {
        this.removeFlyer(flyer);
        this.twinkle(this.scratch2);
      }
    }
  }

  private removeFlyer(flyer: Flyer) {
    this.flyers.splice(this.flyers.indexOf(flyer), 1);
    flyer.sprite.removeFromParent();
    flyer.sprite.material.dispose();
  }

  /** A small sparkle where a star clicks into its constellation. */
  private twinkle(at: Vector3) {
    const { sprite, material } = this.sprite(this.tex.spark, '#ffffff', true);
    sprite.position.copy(at);
    const size = (this.main?.group.userData['dot'] as number | undefined) ?? 0.5;
    this.particles.push({
      object: sprite,
      material,
      born: this.elapsed,
      life: 0.6,
      velocity: new Vector3(),
      grow: 3,
      fall: 0,
      size: size * 1.5,
      opacity: 1,
    });
    this.scene.add(sprite);
  }

  private updateSky(frame: StarFrame, t: number, calm: boolean) {
    const sky = this.main;
    if (!sky) return;
    const pending = this.flyers.length;
    const lit = Math.max(0, frame.lit - pending);
    const complete = frame.complete && pending === 0;
    if (this.completePending && pending === 0) {
      this.completePending = false;
      this.pulseAt = t;
      this.cheerAt = t;
    }
    const pulse = Math.max(0, 1 - (t - this.pulseAt) / 1.6);
    const dot = sky.group.userData['dot'] as number;
    sky.points.forEach((point, index) => {
      const on = complete || index < lit;
      const glimmer = calm ? 1 : 1 + 0.08 * Math.sin(t * 3 + index);
      point.scale.setScalar(on ? dot * glimmer * (1 + 0.6 * pulse) : dot * 0.62);
      point.material.opacity = on ? 1 : 0.5;
    });
    this.positionSky(sky, false, lit, complete);
    (sky.lines.material as LineBasicMaterial).opacity = 0.7 + 0.3 * pulse;
    for (const other of this.collection) {
      const small = other.group.userData['dot'] as number;
      other.points.forEach((point) => point.scale.setScalar(small));
    }
  }

  private updateParticles(t: number, dt: number) {
    for (const particle of [...this.particles]) {
      const age = t - particle.born;
      if (age > particle.life) {
        particle.object.removeFromParent();
        particle.material.dispose();
        if (particle.object instanceof Mesh) particle.object.geometry.dispose();
        particle.texture?.dispose();
        this.particles.splice(this.particles.indexOf(particle), 1);
        continue;
      }
      const p = age / particle.life;
      particle.velocity.y -= particle.fall * dt;
      particle.object.position.addScaledVector(particle.velocity, dt);
      const scale = particle.size * Math.max(0.05, 1 + particle.grow * p);
      if (particle.texture) particle.object.scale.set(scale * 2, scale, 1);
      else particle.object.scale.setScalar(scale);
      if (
        particle.material instanceof SpriteMaterial &&
        particle.texture === undefined &&
        particle.grow > 2
      )
        particle.material.rotation = age * 1.5;
      particle.material.opacity = particle.opacity * (p < 0.6 ? 1 : 1 - (p - 0.6) / 0.4);
    }
  }

  override dispose() {
    for (const flyer of [...this.flyers]) this.removeFlyer(flyer);
    for (const particle of this.particles) {
      particle.object.removeFromParent();
      particle.material.dispose();
      if (particle.object instanceof Mesh) particle.object.geometry.dispose();
      particle.texture?.dispose();
    }
    this.particles.length = 0;
    if (this.main) this.disposeSky(this.main);
    for (const sky of this.collection) this.disposeSky(sky);
    for (const layer of this.starLayers) {
      layer.geometry.dispose();
      (layer.material as PointsMaterial).dispose();
    }
    for (const label of this.postLabels) label.texture.dispose();
    for (const view of [this.star, ...this.pair]) view.label.texture.dispose();
    for (const geometry of [
      this.postGeometry,
      this.endGeometry,
      this.lampGeometry,
      this.notchGeometry,
    ])
      geometry.dispose();
    for (const material of [
      this.stone,
      this.postMaterial,
      this.ghostMaterial,
      this.lampMaterial,
      this.notchMaterial,
    ])
      material.dispose();
    for (const texture of Object.values(this.tex)) texture.dispose();
    this.sky.dispose();
    super.dispose();
  }
}

/** The night sky, darkest at the top and a deep violet blue near the hills. */
function skyGradient(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const c = canvas.getContext('2d')!;
  const g = c.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#060a24');
  g.addColorStop(0.45, '#141d55');
  g.addColorStop(0.78, '#2b2c7a');
  g.addColorStop(1, '#1a1c4e');
  c.fillStyle = g;
  c.fillRect(0, 0, 4, 256);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** The meadow below the bridge: dark blue-green, a touch lighter where it meets the hills. */
function meadowGradient(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 128;
  const c = canvas.getContext('2d')!;
  const g = c.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, '#24456a');
  g.addColorStop(0.3, '#1b3656');
  g.addColorStop(1, '#0f1e38');
  c.fillStyle = g;
  c.fillRect(0, 0, 4, 128);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Rolling hills in ndc-like units, their tops a little above the bridge's walkway (y = 0). */
function hillGeometry(): ShapeGeometry {
  const shape = new Shape();
  shape.moveTo(-1.2, -0.3);
  const tops = [0.1, 0.2, 0.12, 0.26, 0.08, 0.18, 0.24, 0.1, 0.16];
  tops.forEach((top, index) => {
    const x = -1.2 + (2.4 * (index + 0.5)) / tops.length;
    const prev = -1.2 + (2.4 * index) / tops.length;
    shape.quadraticCurveTo((prev + x) / 2, top + 0.04, x, top);
  });
  shape.lineTo(1.2, -0.3);
  shape.closePath();
  return new ShapeGeometry(shape, 12);
}
