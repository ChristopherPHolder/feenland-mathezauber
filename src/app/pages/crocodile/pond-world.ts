import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  Fog,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Plane,
  PlaneGeometry,
  Raycaster,
  RingGeometry,
  Sprite,
  SpriteMaterial,
  Vector2,
  Vector3,
} from 'three';
import { Stage } from '../../shared/three/stage';
import type { StateWorld } from '../../shared/three/three-stage';
import { TextLabel } from '../../shared/three/labels';
import {
  approach,
  clamp01,
  easeOut,
  easeOutBack,
  EventCounter,
  smooth,
} from '../../shared/three/motion';
import type { Comparison } from './comparison';
import type { PondFrame } from './pond-frame';
import { heronLapAngle, heronLoop } from './heron-flight';
import { Kiki } from './pond-kiki';
import {
  Butterfly,
  Dragonfly,
  Frog,
  HeronModel,
  makeBigFish,
  makeFish,
  makeGoldenPad,
  makeLilyPad,
} from './pond-life';
import {
  chompPose,
  hopPose,
  type KikiPose,
  refusePose,
  refuseShake,
  REST,
  SNAP,
  tileHop,
  widthOf,
} from './pond-chomp';
import { PondFx } from './pond-fx';
import { LotusKit, padVeins, ReedBed } from './pond-plants';

const INK = '#172555';
const FOV = 40;
const DEG = Math.PI / 180;
/** The camera looks down on the pond from this many degrees above the water. */
const PITCH = 46;
const CAMERA_DISTANCE = 10;
const WATER = {
  plain: new Color('#8fd0ec'),
  golden: new Color('#9fd8e2'),
  boss: new Color('#5f9fd6'),
};
const FRENZY_GLOW = new Color('#5a2410');
/** A feeding frenzy turns the sky and water to sunset, like the 2D pond. */
const SKY = new Color('#cfeaf7');
const SUNSET_SKY = new Color('#ffcdb8');
const SUNSET_WATER = new Color('#ffa486');
const FRENZY_SPARKS = ['#ffe27a', '#ff9fc0', '#ffb36b'] as const;
const NO_GLOW = new Color('#000000');
const STEAL_SECONDS = 1.3;
/** The heron's dive on the snack, before it climbs away with it. */
const DIVE_SECONDS = 0.45;
const SHOO_SECONDS = 0.8;
/** How long Kiki's "no thanks" lasts after a wrong pick. */
const WRONG_SECONDS = 1.1;
/** A hop for "both the same" lands this long after the tap. */
const HOP_LANDS = 0.56;
const GLINT = new Color('#fff8e0');
const SUNSET_GLINT = new Color('#ffd0a0');
const UP = new Vector3(0, 1, 0);

type Side = 'left' | 'right';
interface Anchor {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}
interface Token {
  readonly mesh: Mesh;
  readonly back: Mesh;
  readonly label: TextLabel;
  readonly operator: boolean;
  readonly chars: number;
}
/** One side of the question: a lily pad with its number tiles standing on it. */
interface Raft {
  readonly side: Side;
  readonly pad: Group;
  readonly green: Group;
  readonly gold: Group;
  /** A warm glow on the water under a golden pad. */
  readonly halo: Mesh<PlaneGeometry, MeshBasicMaterial>;
  /** Two twinkling stars on the corners of golden tiles, like the 2D pad's sparkles. */
  readonly stars: readonly Sprite[];
  readonly tiles: Group;
  nextSpark: number;
  tokens: Token[];
  text: string;
  readonly home: Vector3;
  readonly padHome: Vector3;
  /** Where the tiles are heading this frame. */
  readonly target: Vector3;
  padRadius: number;
  born: number;
  wobbleAt: number;
}

/**
 * Kiki's pond in 3D: gently moving water with ripples and sun glints, lily pads with water
 * lilies, swaying reeds, a frog, a dragonfly, butterflies and fish; Kiki in the middle; the two
 * sides as number tiles on lily pads; and the heron in race modes. It only draws: every decision
 * comes in through `setState`.
 */
export class PondWorld extends Stage implements StateWorld<PondFrame> {
  private frame: PondFrame | null = null;
  private readonly raycaster = new Raycaster();
  private readonly plane = new Plane(new Vector3(0, 1, 0), 0);
  private readonly ndc = new Vector2();
  private anchors: Record<'left' | 'center' | 'right', Anchor> | null = null;
  private measuredAt = -1;

  private readonly water: Mesh<PlaneGeometry, MeshStandardMaterial>;
  private readonly waterBase: Float32Array;
  private readonly waterColor = WATER.plain.clone();
  private readonly kiki = new Kiki();
  private readonly kikiHome = new Vector3();
  private kikiScale = 1;
  private kikiYaw = 0;
  private readonly kikiLunge = new Vector3();
  private readonly rafts: Record<Side, Raft>;
  private readonly tileGeometry = new PlaneGeometry(1, 1);

  private readonly heron = new HeronModel();
  private readonly heronShadow: Mesh<RingGeometry, MeshBasicMaterial>;
  private heronProgress = 0;
  private heronSnack = -1;
  private heronStateAt = 0;
  private readonly heronFrom = new Vector3();
  private heronScale = 1;
  /** Where the instruction bubble starts, in the host's pixels: the loop stays above it. */
  private floor = 0;
  private carried: Raft | null = null;
  private readonly lastHeron = new Vector3();

  private readonly decor = new Group();
  private readonly frog = new Frog();
  private readonly dragonfly = new Dragonfly();
  private readonly dragonSpots = [new Vector3(), new Vector3(), new Vector3(), new Vector3()];
  private readonly butterflies = [new Butterfly('#ff8fb6'), new Butterfly('#ffd166')];
  private readonly fish = [makeFish(), makeFish('#ffb347', 0.8), makeFish('#f08a24', 0.9)];
  private readonly bigFish = makeBigFish();
  private readonly reedBed = new ReedBed();
  private readonly reeds: Mesh[];
  private readonly veins = padVeins();
  private readonly lotus = new LotusKit();
  private readonly decorPads: Group[];
  private viewWidth = 10;
  private readonly viewCenter = new Vector3();
  private readonly topRow = new Vector3();

  private readonly sparkTexture = sparkTexture();
  private readonly glowTexture = glowTexture();
  private readonly fx = new PondFx(this.sparkTexture);
  private golden = 0;
  private sunset = 0;
  private nextRipple = 0;
  private nextBloop = 2;
  private nextSpark = 0;
  private nextWake = 0;

  private readonly tries = new EventCounter();
  private chompAt = -10;
  private chompSide: Comparison | null = null;
  /** The bite's splash and the hop's landing play once per answer. */
  private landed = true;
  private wrongAt = -10;
  /** The little snort after a wrong pick plays once per pick. */
  private snorted = true;
  private wrongSide: Comparison | null = null;
  private snack = -1;
  private phase: PondFrame['phase'] = 'ready';

  // Scratch vectors, so nothing is allocated per frame.
  private readonly v1 = new Vector3();
  private readonly v2 = new Vector3();
  private readonly v3 = new Vector3();
  private readonly mouthAt = new Vector3();
  private readonly beakAt = new Vector3();
  private readonly glintTint = new Color();

  constructor(canvas: HTMLCanvasElement, host: HTMLElement) {
    super(canvas, host, { shadows: true, fov: FOV, background: '#cfeaf7' });
    this.scene.fog = new Fog('#cfeaf7', 11, 26);
    this.camera.position.set(
      0,
      Math.sin(PITCH * DEG) * CAMERA_DISTANCE,
      Math.cos(PITCH * DEG) * CAMERA_DISTANCE,
    );
    this.camera.lookAt(0, 0, 0);
    this.camera.updateMatrixWorld();
    this.sun.position.set(-3, 10, 7);
    const shadow = this.sun.shadow.camera;
    shadow.left = shadow.bottom = -9;
    shadow.right = shadow.top = 9;
    shadow.updateProjectionMatrix();
    this.fill.intensity = 1.35;

    const geometry = new PlaneGeometry(44, 44, 44, 44);
    geometry.rotateX(-Math.PI / 2);
    this.waterBase = Float32Array.from(geometry.attributes['position']!.array);
    this.water = new Mesh(
      geometry,
      new MeshStandardMaterial({
        color: WATER.plain,
        roughness: 0.3,
        metalness: 0.05,
        // Flat shading lights each facet from its own slope, so the waves need no normals.
        flatShading: true,
        transparent: true,
        opacity: 0.86,
      }),
    );
    this.water.receiveShadow = true;
    const floor = new Mesh(new PlaneGeometry(44, 44), new MeshBasicMaterial({ color: '#5b9fc4' }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.7;
    this.scene.add(floor, this.water);

    this.rafts = { left: this.makeRaft('left'), right: this.makeRaft('right') };
    this.scene.add(this.kiki.root);
    this.kiki.root.traverse((object) => (object.castShadow = true));
    // Pitch in her own frame first, then turn: a lunge to the side never rolls her over.
    this.kiki.body.rotation.order = 'YXZ';

    this.heronShadow = new Mesh(
      new RingGeometry(0, 1, 24),
      new MeshBasicMaterial({
        color: '#1f4f6e',
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
      }),
    );
    this.heronShadow.rotation.x = -Math.PI / 2;
    this.heron.root.visible = this.heronShadow.visible = false;
    this.heron.root.rotation.order = 'YXZ';
    this.scene.add(this.heron.root, this.heronShadow);

    this.decorPads = DECOR_PADS.map(([, , , tone]) => {
      const pad = makeLilyPad(tone ? '#5fb86c' : '#4ca25f', '#2f7a44', this.veins);
      this.decor.add(pad);
      return pad;
    });
    // Water lilies bloom on two of the pads.
    for (const index of LOTUS_PADS) {
      const flower = this.lotus.flower();
      flower.position.set(0.25, 0.03, -0.15);
      flower.scale.setScalar(1.5);
      this.decorPads[index]!.add(flower);
    }
    this.reeds = REED_SPOTS.map((_, index) => {
      const clump = this.reedBed.clump(index + 1);
      this.decor.add(clump);
      return clump;
    });
    for (const fish of this.fish) this.decor.add(fish);
    this.bigFish.visible = false;
    this.decor.add(
      this.bigFish,
      this.frog.root,
      this.dragonfly.root,
      ...this.butterflies.map((b) => b.root),
    );
    this.scene.add(this.decor, this.fx.root);
  }

  setState(frame: PondFrame) {
    const previous = this.frame;
    this.frame = frame;
    this.kiki.setHat(frame.hat);
    for (const side of ['left', 'right'] as const)
      this.setRaftText(this.rafts[side], frame[side], frame.kind);
    if (frame.snack !== this.snack) {
      const fresh = this.snack !== -1;
      this.snack = frame.snack;
      this.chompSide = null;
      this.carried = null;
      for (const raft of Object.values(this.rafts)) {
        raft.born = fresh ? this.elapsed : -10;
        raft.tiles.visible = raft.pad.visible = true;
        // The new numbers grow out of their own pad, not from wherever the last ones went
        // (Kiki's mouth, or off-screen in the heron's beak).
        raft.tiles.position.copy(raft.home);
        // A fresh pad bobs up out of the water with a ripple.
        if (fresh) this.fx.ring(raft.padHome, raft.padRadius * 1.05, 0.9, 0.3);
      }
      this.tries.take(0);
    }
    if (this.tries.take(frame.tries) > 0 && frame.wrong) {
      this.wrongAt = this.elapsed;
      this.wrongSide = frame.wrong;
      this.snorted = false;
      const raft = this.raftFor(frame.wrong);
      if (raft) {
        raft.wobbleAt = this.elapsed;
        this.fx.splash(raft.padHome, raft.padRadius * 0.6, 5, this.calm);
      }
    }
    if (frame.phase === 'chomping' && this.phase !== 'chomping' && frame.chosen) {
      this.chompAt = this.elapsed;
      this.chompSide = frame.chosen;
      this.landed = false;
      if (frame.kind === 'golden') this.goldRush(frame.chosen);
      // The round's last and biggest snack: a ring of party sparkles round Kiki.
      if (frame.kind === 'boss') this.sparkle(this.kikiHome, this.kikiScale * 1.5, 18, true);
    }
    if (frame.heron?.state !== previous?.heron?.state || frame.snack !== previous?.snack)
      this.heronChanged(frame);
    this.phase = frame.phase;
    this.measuredAt = -1;
  }

  protected override layout(aspect: number) {
    super.layout(aspect);
    this.camera.updateMatrixWorld();
    this.measuredAt = -1;
  }

  protected update(dt: number, t: number) {
    if (this.measuredAt < 0 || t - this.measuredAt > 0.3) {
      this.measuredAt = t;
      this.measure();
    }
    const frame = this.frame;
    const calm = this.calm;
    this.animateWater(t, calm, frame);
    this.animateKiki(t, dt, calm, frame);
    // The heron moves first, so a snack in its beak hangs from where the beak is this frame.
    this.animateHeron(t, dt, frame);
    for (const raft of Object.values(this.rafts)) this.animateRaft(raft, t, calm, frame);
    this.animateDecor(t, calm, frame);
    this.glintTint.copy(GLINT).lerp(SUNSET_GLINT, this.sunset);
    this.fx.update(t, dt, frame?.kind === 'boss' ? 0.5 : 1, calm, this.glintTint);
  }

  // ---------------------------------------------------------------- layout from the DOM

  /** Reads where the page's buttons are, so the pads and Kiki sit right under them. */
  private measure() {
    const board = this.host.parentElement;
    if (!board) return;
    const base = this.host.getBoundingClientRect();
    const instruction = board.querySelector<HTMLElement>('.instruction');
    const floor = instruction ? instruction.getBoundingClientRect().top - base.top : this.height;
    const read = (side: string): Anchor | null => {
      const element = board.querySelector<HTMLElement>(`[data-side="${side}"]`);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return { x: rect.left - base.left, y: rect.top - base.top, w: rect.width, h: rect.height };
    };
    const left = read('left');
    const center = read('center');
    const right = read('right');
    if (!left || !center || !right || !left.w) return;
    const before = this.anchors;
    const same = (a: Anchor, b: Anchor) =>
      Math.abs(a.x - b.x) < 1 &&
      Math.abs(a.y - b.y) < 1 &&
      Math.abs(a.w - b.w) < 1 &&
      Math.abs(a.h - b.h) < 1;
    if (
      before &&
      Math.abs(floor - this.floor) < 1 &&
      same(before.left, left) &&
      same(before.center, center) &&
      same(before.right, right)
    )
      return;
    this.floor = floor;
    const first = !before;
    this.anchors = { left, center, right };
    this.place(first);
  }

  /** The point on the horizontal plane at height `y` under a pixel of the host. */
  private ground(px: number, py: number, y: number, out: Vector3): Vector3 {
    this.ndc.set((px / this.width) * 2 - 1, -(py / this.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    this.plane.constant = -y;
    return this.raycaster.ray.intersectPlane(this.plane, out) ?? out.set(0, y, 0);
  }

  /** World units per screen pixel at a point. */
  private perPixel(point: Vector3): number {
    const depth = -this.v3.copy(point).applyMatrix4(this.camera.matrixWorldInverse).z;
    return (2 * depth * Math.tan((FOV / 2) * DEG)) / this.height;
  }

  private place(snap: boolean) {
    const anchors = this.anchors;
    if (!anchors) return;
    const { center } = anchors;
    this.ground(center.x + center.w / 2, center.y + center.h * 0.55, 0, this.kikiHome);
    this.kikiScale =
      (Math.min(center.w * 1.15, center.h * 1.3) * this.perPixel(this.kikiHome)) / 1.25;
    this.kiki.root.scale.setScalar(this.kikiScale);
    if (snap) this.kiki.root.position.copy(this.kikiHome);
    for (const side of ['left', 'right'] as const)
      this.placeRaft(this.rafts[side], anchors[side], snap);

    // The rest of the pond is framed from what the camera sees.
    const bottomLeft = this.ground(0, this.height, 0, this.v1);
    const bottomRight = this.ground(this.width, this.height, 0, this.v2);
    this.viewWidth = bottomRight.x - bottomLeft.x;
    this.ground(this.width * 0.5, this.height * 0.55, 0, this.viewCenter);
    this.ground(this.width * 0.5, this.height * 0.18, 0, this.topRow);
    const unit = this.perPixel(this.viewCenter) * Math.min(this.width, this.height * 1.4);
    this.placeDecor(unit);
    // Glints over the open water between the top edge and the instruction.
    const top = this.ground(this.width * 0.5, 0, 0, this.v1);
    const bottom = this.ground(this.width * 0.5, this.floor || this.height, 0, this.v2);
    this.v3.addVectors(top, bottom).multiplyScalar(0.5);
    this.fx.placeGlints(this.v3, this.viewWidth * 0.95, Math.abs(bottom.z - top.z) * 0.95);

    this.heronScale = unit * 0.11;
    this.heron.root.scale.setScalar(this.heronScale);
  }

  private placeRaft(raft: Raft, anchor: Anchor, snap: boolean) {
    const sizes = this.tileSizes(raft, anchor);
    // A sum that fills its pad leans to the outer edge, which opens clear water between the two.
    const outward = raft.tokens.length === 1 ? 0 : raft.side === 'left' ? -1 : 1;
    const lean =
      outward * Math.min(anchor.w * 0.07, Math.max(0, (anchor.w * 0.94 - sizes.total) / 2));
    const cx = anchor.x + anchor.w / 2 + lean;
    const cy = anchor.y + anchor.h / 2;
    const lift = 0.05;
    const below = this.perPixel(this.ground(cx, cy, 0, this.v1));
    this.ground(cx, cy, lift + sizes.height * 0.5 * below, raft.home);
    const unit = this.perPixel(raft.home);
    raft.tiles.quaternion.copy(this.camera.quaternion);
    let x = -sizes.total / 2;
    raft.tokens.forEach((token, index) => {
      const width = sizes.widths[index]!;
      const height = token.operator ? width : sizes.height;
      token.mesh.scale.set(width * unit, height * unit, 1);
      token.mesh.position.set((x + width / 2) * unit, 0, 0);
      token.back.scale.copy(token.mesh.scale);
      token.back.position.set(token.mesh.position.x, -height * 0.07 * unit, -0.01);
      token.back.visible = !token.operator;
      x += width + sizes.gap;
    });
    const half = (sizes.total / 2) * unit;
    const top = (sizes.height / 2) * unit;
    const starSize = Math.min(sizes.height * 0.42, 40) * unit;
    raft.stars[0]!.position.set(half - starSize * 0.15, top - starSize * 0.1, 0.02);
    raft.stars[1]!.position.set(-half + starSize * 0.2, -top + starSize * 0.25, 0.02);
    for (const star of raft.stars) star.userData['size'] = starSize;
    this.ground(cx, cy + sizes.height * 0.18, 0, raft.padHome);
    raft.padRadius = anchor.w * 0.46 * this.perPixel(raft.padHome);
    raft.pad.scale.set(
      raft.padRadius,
      raft.padRadius,
      raft.padRadius * Math.min(1, (anchor.h * 1.15) / (anchor.w * 0.85)),
    );
    if (snap) {
      raft.tiles.position.copy(raft.home);
      raft.pad.position.copy(raft.padHome);
    }
  }

  /** Pixel sizes of a side's tiles, as large as the button allows (like the 2D tiles). */
  private tileSizes(raft: Raft, anchor: Anchor) {
    const plain = raft.tokens.length === 1;
    let height = plain
      ? Math.min(anchor.h * 0.7, anchor.w * 0.62, 112)
      : Math.min(anchor.h * 0.6, 86);
    const measure = (h: number) => {
      const widths = raft.tokens.map((token) =>
        token.operator ? h * 0.52 : Math.max(h * 0.8, h * (0.28 + 0.31 * token.chars)),
      );
      const gap = h * 0.1;
      return { widths, gap, total: widths.reduce((a, b) => a + b, 0) + gap * (widths.length - 1) };
    };
    let sizes = measure(height);
    // A sum keeps clear water on both sides, so on a narrow phone the two sums (and the golden
    // frames around their tiles) never run together into one long row of numbers.
    const room = anchor.w * (plain ? 0.9 : 0.8);
    if (sizes.total > room) {
      height *= room / sizes.total;
      sizes = measure(height);
    }
    return { ...sizes, height };
  }

  /**
   * Puts the reeds, the decorative pads, the frog and the dragonfly's hovering spots round the
   * edge of what the camera sees. Things meant to be watched (the frog, the water lilies) stay
   * above the instruction bubble, so it never hides them.
   */
  private placeDecor(unit: number) {
    const open = this.floor || this.height;
    REED_SPOTS.forEach(([x, y, size], index) => {
      const clump = this.reeds[index]!;
      this.ground(x * this.width, y * this.height, 0, clump.position);
      clump.scale.setScalar(unit * 0.16 * size);
      clump.rotation.y = index * 1.3;
    });
    this.decorPads.forEach((pad, index) => {
      const [x, y, size] = DECOR_PADS[index]!;
      // Pads above the bubble are placed in the open water's height; the rest in the view's.
      const py = y <= 1 ? y * open : open + (y - 1) * (this.height - open);
      this.ground(x * this.width, py, 0, pad.position);
      pad.scale.setScalar(unit * 0.07 * size);
      pad.rotation.y = index * 1.9;
      pad.userData['spin'] = pad.rotation.y;
    });
    const frogPad = this.decorPads[FROG_PAD]!;
    this.frog.root.position.copy(frogPad.position).setY(0.05);
    this.frog.root.scale.setScalar(unit * 0.12);
    // Turned toward the middle of the pond, three-quarters to the camera.
    this.frog.root.rotation.y = frogPad.position.x > this.viewCenter.x ? -0.7 : 0.7;
    for (const fish of this.fish) fish.scale.setScalar(unit * 0.22);
    this.bigFish.scale.setScalar(unit * 0.11);
    for (const butterfly of this.butterflies) butterfly.root.scale.setScalar(unit * 0.17);
    // The dragonfly hovers over the reeds and the pads at the edges, above the water.
    this.dragonfly.root.scale.setScalar(unit * 0.24);
    DRAGON_SPOTS.forEach(([x, y], index) => {
      this.ground(x * this.width, y * open, unit * 0.09, this.dragonSpots[index]!);
    });
    this.dragonfly.setSpots(this.dragonSpots);
  }

  // ---------------------------------------------------------------- sides

  private makeRaft(side: Side): Raft {
    const pad = new Group();
    const green = makeLilyPad('#4ca25f', '#2f7a44', this.veins);
    const gold = makeGoldenPad();
    gold.visible = false;
    // The question's pads float a little above the waves, so the water never washes over them
    // (on a sunset-pink frenzy pond a half-sunk leaf turns muddy).
    green.position.y = 0.04;
    gold.position.y = 0.06;
    const halo = new Mesh(
      this.tileGeometry,
      new MeshBasicMaterial({
        map: this.glowTexture,
        color: '#ffcf4a',
        blending: AdditiveBlending,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        fog: false,
      }),
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.02;
    halo.renderOrder = 2;
    halo.scale.setScalar(3.4);
    halo.visible = false;
    pad.add(halo, green, gold);
    const tiles = new Group();
    const stars = [0, 1].map(() => {
      const star = new Sprite(
        new SpriteMaterial({
          map: this.sparkTexture,
          color: '#fff4c2',
          blending: AdditiveBlending,
          depthTest: false,
          depthWrite: false,
          transparent: true,
          fog: false,
        }),
      );
      star.renderOrder = 12;
      star.visible = false;
      tiles.add(star);
      return star;
    });
    this.scene.add(pad, tiles);
    return {
      side,
      pad,
      green,
      gold,
      halo,
      stars,
      tiles,
      nextSpark: 0,
      tokens: [],
      text: '',
      home: new Vector3(),
      padHome: new Vector3(),
      target: new Vector3(),
      padRadius: 1,
      born: -10,
      wobbleAt: -10,
    };
  }

  private setRaftText(raft: Raft, text: string, kind: PondFrame['kind']) {
    const key = text + '|' + kind;
    if (key === raft.text) return;
    raft.text = key;
    for (const token of raft.tokens) {
      raft.tiles.remove(token.mesh, token.back);
      token.label.texture.dispose();
      (token.mesh.material as MeshBasicMaterial).dispose();
      (token.back.material as MeshBasicMaterial).dispose();
    }
    const golden = kind === 'golden';
    const border = golden ? '#e09a00' : kind === 'boss' ? '#1f5fa8' : '#d6e8db';
    raft.tokens = text.split(' ').map((value) => {
      const operator = value === '+' || value === '−' || value === '×';
      const chars = [...value].length;
      const aspect = operator ? 1 : Math.max(0.8, 0.28 + 0.31 * chars);
      const label = new TextLabel(value, {
        ink: INK,
        fill: operator ? (value === '−' ? '#9fd6f2' : '#f4b740') : golden ? '#fff6d2' : '#ffffff',
        border: operator ? undefined : border,
        width: Math.round(192 * aspect),
        height: 192,
        radius: operator ? 0.5 : 0.24,
      });
      const mesh = new Mesh(
        this.tileGeometry,
        new MeshBasicMaterial({
          map: label.texture,
          transparent: true,
          fog: false,
          depthTest: false,
        }),
      );
      const back = new Mesh(
        this.tileGeometry,
        new MeshBasicMaterial({
          color: golden ? '#c98a00' : '#b9d6c2',
          transparent: true,
          opacity: 0.95,
          fog: false,
          depthTest: false,
        }),
      );
      // The numbers always draw on top, so the heron or a splash never hides them.
      mesh.renderOrder = 11;
      back.renderOrder = 10;
      raft.tiles.add(back, mesh);
      return { mesh, back, label, operator, chars };
    });
    if (this.anchors) this.placeRaft(raft, this.anchors[raft.side], false);
  }

  private animateRaft(raft: Raft, t: number, calm: boolean, frame: PondFrame | null) {
    const bob = calm
      ? 0
      : Math.sin(t * 1.6 + (raft.side === 'left' ? 0 : 2)) * 0.03 * raft.padRadius;
    const born = clamp01((t - raft.born - (raft.side === 'right' ? 0.12 : 0)) / 0.5);
    const grow = raft.born < 0 ? 1 : easeOutBack(born);
    raft.pad.position.lerp(raft.padHome, 0.25);
    raft.pad.position.y = bob * 0.5 - (1 - grow) * 0.2;
    const wobbleAge = t - raft.wobbleAt;
    const wobble = wobbleAge < 0.9 ? Math.sin(wobbleAge * 22) * 0.28 * (1 - wobbleAge / 0.9) : 0;
    // An offered pad that was turned down dips under the weight of the "no", then bobs back.
    const dip = wobbleAge < 0.9 ? Math.sin(Math.min(1, wobbleAge / 0.9) * Math.PI) * 0.06 : 0;
    raft.pad.position.y -= dip * raft.padRadius;
    raft.pad.rotation.set(wobble * 0.4, raft.side === 'left' ? 0.6 : -2.4, wobble * 0.3);

    const eaten =
      this.chompSide !== null &&
      ((raft.side === 'left' && this.chompSide === '>') ||
        (raft.side === 'right' && this.chompSide === '<'));
    const chompAge = t - this.chompAt;
    const target = raft.target.copy(raft.home);
    target.y += bob - dip * raft.padRadius;
    let scale = grow;
    let spin = 0;
    let follow = 0.25;
    if (eaten) {
      // Gulped: the tiles hop off the pad on an arc and drop into Kiki's open jaws just as
      // they snap shut, shrinking as they go in.
      const hop = tileHop(chompAge);
      const mouth = this.mouth();
      const span = this.v1.copy(mouth).sub(raft.home).length();
      target.lerp(mouth, hop.along).addScaledVector(UP, hop.arc * span);
      scale *= 1 - hop.along ** 2 * 0.9;
      spin = hop.along * (raft.side === 'left' ? -0.5 : 0.5);
      raft.tiles.visible = chompAge < SNAP + 0.02;
      follow = 1;
      if (chompAge > 0.3 && chompAge < 0.3 + 1 / 30)
        this.fx.splash(raft.padHome, raft.padRadius * 0.8, 10, calm);
    } else if (this.carried === raft && frame?.heron) {
      // The snack waits on its pad until the beak gets there, then hangs from it.
      if (t - this.heronStateAt >= DIVE_SECONDS * 0.9) {
        target.copy(this.heronBeak());
        scale *= 0.75;
        follow = 1;
      }
    } else if (frame?.phase === 'chomping' && this.chompSide === '=') {
      // Both the same: each pad bounces once as Kiki lands from her happy hop.
      const age = chompAge - HOP_LANDS;
      target.y += age > 0 ? Math.sin(Math.min(1, age / 0.35) * Math.PI) * 0.18 * raft.padRadius : 0;
    }
    raft.tiles.position.lerp(target, follow);
    raft.tiles.scale.setScalar(Math.max(0.001, scale));
    raft.tiles.rotation.setFromQuaternion(this.camera.quaternion);
    raft.tiles.rotateZ(wobble * 0.5 + spin);
    raft.pad.visible = true;

    this.animateGolden(raft, t, calm, frame, eaten ? chompAge : -1);
  }

  /**
   * A golden snack: the pad turns to polished gold with a warm glow on the water, the tiles get a
   * gold frame with two twinkling stars, and sparkles drift up while it waits. Calm motion keeps
   * the gold, the glow and the stars, and only drops the twinkle and the drifting sparkles.
   */
  private animateGolden(
    raft: Raft,
    t: number,
    calm: boolean,
    frame: PondFrame | null,
    eatenAge: number,
  ) {
    const golden = frame?.kind === 'golden';
    raft.gold.visible = golden;
    raft.green.visible = !golden;
    const ready = golden && frame.phase === 'ready';
    const offset = raft.side === 'left' ? 0 : 1.7;
    const pulse = calm ? 0.5 : 0.5 + 0.5 * Math.sin(t * 3 + offset);
    raft.halo.visible = golden;
    raft.halo.material.opacity = golden ? (0.55 + 0.3 * pulse) * (eatenAge >= 0 ? 0.4 : 1) : 0;
    raft.stars.forEach((star, index) => {
      star.visible = ready;
      const size = (star.userData['size'] as number | undefined) ?? 0.3;
      const twinkle = calm ? 1 : 0.65 + 0.45 * Math.abs(Math.sin(t * 2.2 + index * 1.6 + offset));
      star.scale.setScalar(size * twinkle);
      star.material.rotation = calm ? 0 : t * 0.6 * (index ? -1 : 1);
    });
    if (ready && !calm && t > raft.nextSpark) {
      raft.nextSpark = t + 0.16;
      const spot = this.v1.set(
        raft.padHome.x + (Math.random() - 0.5) * raft.padRadius * 1.8,
        raft.padHome.y + raft.padRadius * (0.1 + Math.random() * 0.3),
        raft.padHome.z + (Math.random() - 0.5) * raft.padRadius * 1.2,
      );
      this.fx.spark(spot, raft.padRadius * 0.22, 0.9);
    }
  }

  // ---------------------------------------------------------------- Kiki

  /** Where Kiki's mouth is in the world right now. */
  private mouth(): Vector3 {
    return this.mouthAt
      .set(Math.sin(this.kikiYaw), 0, Math.cos(this.kikiYaw))
      .multiplyScalar(this.kikiScale * 0.85)
      .add(this.kiki.root.position)
      .setY(this.kikiScale * 0.2);
  }

  private raftFor(choice: Comparison | null): Raft | null {
    return choice === '>' ? this.rafts.left : choice === '<' ? this.rafts.right : null;
  }

  /** Heading from Kiki's home toward a point, in radians. */
  private headingTo(point: Vector3): number {
    return Math.atan2(point.x - this.kikiHome.x, point.z - this.kikiHome.z);
  }

  private animateKiki(t: number, dt: number, calm: boolean, frame: PondFrame | null) {
    const kiki = this.kiki;
    const facing = this.raftFor(frame?.pose ?? null);
    const chompAge = t - this.chompAt;
    const chomping = frame?.phase === 'chomping' && this.chompSide !== null;
    const wrongAge = t - this.wrongAt;
    const refusing = wrongAge < WRONG_SECONDS && frame?.phase === 'ready';
    const refused = refusing ? this.raftFor(this.wrongSide) : null;

    let yawTarget = facing ? this.headingTo(facing.padHome) : 0;
    // A stolen snack: she watches the heron go.
    if (frame?.phase === 'stolen' && this.heron.root.visible) {
      const heron = this.heron.root.position;
      yawTarget = Math.atan2(
        heron.x - kiki.root.position.x,
        Math.max(0.2, heron.z - kiki.root.position.z),
      );
    }
    // A wrong pick: she glances at the side she was offered, then shakes her head, no thanks.
    if (refused) yawTarget = this.headingTo(refused.padHome) * 0.45;
    this.kikiYaw = approach(this.kikiYaw, yawTarget, chomping ? 16 : 7, dt);

    let pose: KikiPose = REST;
    if (chomping && facing) pose = chompPose(chompAge);
    else if (chomping && this.chompSide === '=') pose = hopPose(chompAge);
    else if (refusing) pose = refusePose(wrongAge, WRONG_SECONDS);

    // Lunge: surge toward the chosen pad (after pulling back to wind up), and drift home.
    const lunge = this.kikiLunge;
    if (chomping && facing) {
      const toward = this.v1.copy(facing.padHome).sub(this.kikiHome).setY(0);
      const reach = Math.max(0, toward.length() - facing.padRadius * 0.9 - this.kikiScale * 0.75);
      toward.normalize();
      lunge
        .copy(toward)
        .multiplyScalar(pose.lunge < 0 ? pose.lunge * this.kikiScale * 2 : reach * pose.lunge);
    } else if (refused) {
      const away = this.v1.copy(refused.padHome).sub(this.kikiHome).setY(0).normalize();
      lunge.copy(away).multiplyScalar(pose.lunge * this.kikiScale * 2.2);
    } else {
      lunge.multiplyScalar(Math.exp(-6 * dt));
    }

    let jaw = pose.jaw;
    if (!chomping) {
      if (facing && frame?.phase === 'ready' && !refusing) jaw = 0.5;
      if (frame?.phase === 'stolen') jaw = 0.25;
      kiki.jaw = approach(kiki.jaw, jaw, 10, dt);
    } else {
      kiki.jaw = approach(kiki.jaw, jaw, 60, dt);
    }
    kiki.cheeks = pose.cheeks;
    kiki.gulp = pose.gulp;
    kiki.content = approach(kiki.content, pose.content, pose.content > kiki.content ? 14 : 6, dt);

    // The head shake carries meaning, so calm motion keeps it.
    const shake = refusing ? refuseShake(wrongAge, WRONG_SECONDS) : 0;
    kiki.puzzled = approach(
      kiki.puzzled,
      refusing && wrongAge < WRONG_SECONDS - 0.25 ? 1 : 0,
      refusing ? 14 : 5,
      dt,
    );
    const bob = calm ? 0 : Math.sin(t * 1.8) * 0.03 * this.kikiScale;
    const idleYaw = calm || facing ? 0 : Math.sin(t * 0.6) * 0.12;
    kiki.root.position.x = this.kikiHome.x + lunge.x;
    kiki.root.position.z = this.kikiHome.z + lunge.z;
    kiki.root.position.y = bob + pose.rise * this.kikiScale;
    kiki.body.rotation.y = this.kikiYaw + idleYaw + shake;
    kiki.body.rotation.x = -pose.pitch;
    kiki.body.scale.set(widthOf(pose), pose.height, pose.length);
    const glowing = (frame?.combo ?? 1) >= 3;
    kiki.glow = approach(kiki.glow, glowing ? 1 : 0, 3, dt);
    const look = refusing || facing ? 0 : Math.sin(t * 0.5) * 0.6;
    const swim = chomping && facing ? Math.min(1, Math.abs(pose.lunge) * 1.5) : 0;
    kiki.animate(t, dt, calm, swim, calm ? 0 : look);

    // The bite lands: a splash at her jaws and a burst of sparkles. The hop lands with a ring.
    if (chomping && !this.landed) {
      const at = facing ? SNAP : HOP_LANDS;
      if (chompAge >= at) {
        this.landed = true;
        if (facing) {
          const mouth = this.mouth();
          this.fx.splash(mouth.setY(0.05), this.kikiScale * 0.5, 12, calm);
          this.chompBurst(this.mouth(), this.kikiScale * 0.55);
        } else {
          this.fx.splash(
            this.v1.copy(kiki.root.position).setY(0.05),
            this.kikiScale * 0.7,
            14,
            calm,
          );
          this.sparkle(this.kikiHome, this.kikiScale * 1.2, 14);
        }
      }
    }

    // "Hmm, no thanks": a little snort of spray out of her nose as she pulls back.
    if (refusing && !this.snorted && wrongAge > 0.14) {
      this.snorted = true;
      if (!calm) {
        const nose = this.mouth();
        nose.y += this.kikiScale * 0.08;
        for (let i = 0; i < 5; i++) {
          const spread = (i - 2) * 0.35;
          this.fx.drop(
            nose,
            Math.sin(this.kikiYaw + spread) * this.kikiScale * 0.7,
            this.kikiScale * (1.6 + (i % 2) * 0.4),
            Math.cos(this.kikiYaw + spread) * this.kikiScale * 0.7,
            this.kikiScale * 0.035,
            0.6,
          );
        }
      }
    }

    // A wake of ripples while she swims out and back, and a soft ring as she flinches back.
    const moving = lunge.lengthSq() > (this.kikiScale * 0.15) ** 2;
    if (moving && t > this.nextWake) {
      this.fx.ring(this.v1.copy(kiki.root.position).setY(0.02), this.kikiScale * 0.55, 0.7, 0.35);
      this.nextWake = t + 0.12;
    }
  }

  // ---------------------------------------------------------------- the heron

  private heronChanged(frame: PondFrame) {
    const heron = frame.heron;
    this.heronStateAt = this.elapsed;
    this.heronFrom.copy(this.heron.root.position);
    if (!heron) return;
    if (heron.state === 'flying' && (this.heronSnack !== frame.snack || !this.heron.root.visible)) {
      this.heronSnack = frame.snack;
      this.heronProgress = 0;
      this.heronPoint(0, 0, this.heron.root.position);
      this.heronFrom.copy(this.heron.root.position);
    }
    if (heron.state === 'stole') {
      this.carried =
        heron.target === 'left'
          ? this.rafts.left
          : heron.target === 'right'
            ? this.rafts.right
            : null;
    }
  }

  /**
   * The heron's place on its loop round the pond (see `heronLoop`). It skims low over the water,
   * so where it crosses behind Kiki she hides it, and it sinks lower as time runs out.
   */
  private heronPoint(progress: number, angle: number, out: Vector3): Vector3 {
    const anchors = this.anchors;
    const altitude = this.kikiScale * (1.1 - progress * 0.45);
    if (!anchors) return this.ground(this.width * 1.4, this.height * 0.3, altitude, out);
    const point = heronLoop(progress, angle, {
      width: this.width,
      height: this.height,
      padsTop: Math.min(anchors.left.y, anchors.center.y, anchors.right.y),
      padsBottom: Math.max(
        anchors.left.y + anchors.left.h,
        anchors.center.y + anchors.center.h,
        anchors.right.y + anchors.right.h,
      ),
      floor: this.floor || this.height,
      reach: (this.heronScale * 1.3) / this.perPixel(this.viewCenter),
    });
    return this.ground(point.x, point.y, altitude, out);
  }

  private heronBeak(): Vector3 {
    return this.beakAt.copy(this.heron.beak).applyMatrix4(this.heron.root.matrixWorld);
  }

  private animateHeron(t: number, dt: number, frame: PondFrame | null) {
    const heron = frame?.heron ?? null;
    const root = this.heron.root;
    const age = t - this.heronStateAt;
    if (
      !heron ||
      (heron.state === 'shooed' && age > SHOO_SECONDS) ||
      (heron.state === 'stole' && age > STEAL_SECONDS)
    ) {
      root.visible = this.heronShadow.visible = false;
      if (heron?.state === 'stole' && this.carried) this.carried.tiles.visible = false;
      return;
    }
    root.visible = this.heronShadow.visible = true;
    this.lastHeron.copy(root.position);
    let beat = 0.6;
    let fold = 0;
    let reach = 0;
    let bank = 0;
    if (heron.state === 'flying') {
      // Follows the page's own clock, not frame steps, which fall behind on a slow device; so
      // the heron really is over the middle of the pond when it swoops.
      if (!heron.paused)
        this.heronProgress = clamp01(1 - (heron.due - Date.now()) / heron.duration);
      const p = this.heronProgress;
      // Laps the whole pond, in and out of view, on a tighter, quicker loop as time runs out.
      this.heronPoint(p, heronLapAngle(p, heron.duration), root.position);
      root.scale.setScalar(this.heronScale * (1 + p * 0.25));
      // Banks into the turn: the loop always bends to its left. It glides between bursts of
      // flapping, like a big bird does.
      bank = -0.3;
      beat = (0.35 + p * 0.5) * (0.55 + 0.45 * Math.max(0, Math.sin(t * 1.3)));
    } else if (heron.state === 'stole') {
      // Dives on the snack on a curve (wings swept back, legs reaching), flares to grab it, then
      // labours up and away on another curve, heavy with the snack.
      const raft = this.carried;
      const prey = raft
        ? this.v1.copy(raft.home).setY(raft.home.y + 0.1)
        : this.v1.copy(this.kikiHome).setY(this.kikiScale * 0.6);
      const offBeak = this.v2.copy(this.heron.beak).multiplyScalar(root.scale.x);
      const low = prey.sub(offBeak.setY(offBeak.y * 0.6));
      if (age < DIVE_SECONDS) {
        const s = smooth(age / DIVE_SECONDS);
        // The control point sits high above the middle of the dive, so it swoops down.
        const lift = this.v3.addVectors(this.heronFrom, low).multiplyScalar(0.5);
        lift.y = Math.max(this.heronFrom.y, low.y) + this.kikiScale * 0.9;
        bezier(root.position, this.heronFrom, lift, low, s);
        fold =
          Math.sin(clamp01(age / (DIVE_SECONDS * 0.8)) * Math.PI * 0.5) *
          (1 - smooth((age - DIVE_SECONDS * 0.7) / (DIVE_SECONDS * 0.3)));
        reach = smooth((age - DIVE_SECONDS * 0.5) / (DIVE_SECONDS * 0.5));
        beat = age > DIVE_SECONDS * 0.75 ? 1 : 0.1;
      } else {
        const s = (age - DIVE_SECONDS) / (STEAL_SECONDS - DIVE_SECONDS);
        const exit = this.ground(-this.width * 0.3, -this.height * 0.3, 4, this.v2);
        const climb = this.v3.copy(low).lerp(exit, 0.25);
        climb.y = low.y + this.kikiScale * 0.8;
        // Slow off the water with the weight, then faster and faster.
        bezier(root.position, low, climb, exit, s * s);
        reach = 1 - smooth(s * 2);
        beat = 1;
      }
    } else {
      // Shooed: a startled flinch up and back with the wings thrown open, then it flaps off on
      // a rising curve, a little flustered.
      const exit = this.ground(this.width * 1.4, -this.height * 0.4, 5, this.v2);
      const flinch = 0.18;
      if (age < flinch) {
        const s = Math.sin((age / flinch) * Math.PI * 0.5);
        root.position.copy(this.heronFrom).addScaledVector(UP, s * this.kikiScale * 0.35);
        beat = 0.1;
        fold = -0.6 * s;
      } else {
        const s = easeOut((age - flinch) / (SHOO_SECONDS - flinch)) ** 1.3;
        const start = this.v1.copy(this.heronFrom).addScaledVector(UP, this.kikiScale * 0.35);
        const control = this.v3.copy(start).lerp(exit, 0.3);
        control.y = start.y + this.kikiScale * 1.2;
        bezier(root.position, start, control, exit, s);
        beat = 1;
      }
      bank = Math.sin(age * 16) * 0.25 * (1 - age / SHOO_SECONDS);
    }
    root.rotation.z = approach(root.rotation.z, bank, 6, dt);
    const velocity = this.v1.copy(root.position).sub(this.lastHeron);
    if (velocity.lengthSq() > 1e-6) {
      const yaw = Math.atan2(velocity.x, velocity.z);
      root.rotation.y = approach(root.rotation.y, nearAngle(root.rotation.y, yaw), 8, dt);
      // Nose down in a dive and up in a climb.
      const level = Math.hypot(velocity.x, velocity.z);
      const pitch = Math.max(-0.6, Math.min(0.6, Math.atan2(velocity.y, level)));
      root.rotation.x = approach(root.rotation.x, -pitch, 6, dt);
    }
    const calm = this.calm;
    this.heron.animate(t, calm ? Math.min(beat, 0.5) : beat, fold, reach);
    root.updateMatrixWorld();
    const height = Math.max(0.3, root.position.y);
    this.heronShadow.position.set(root.position.x, 0.03, root.position.z);
    // A soft spot under the wings' own shadow: small, since the heron skims low.
    this.heronShadow.scale.setScalar(root.scale.x * (0.7 - Math.min(1, height / 5) * 0.3));
    this.heronShadow.material.opacity = 0.2 - Math.min(0.12, height * 0.03);
    // Its wingtips stir the water when it skims low or grabs.
    if (height < this.kikiScale * 0.9 && t > this.nextRipple && !calm) {
      this.fx.ring(this.v1.copy(root.position).setY(0.02), root.scale.x * 0.8, 0.8, 0.4);
      this.nextRipple = t + 0.2;
    }
  }

  // ---------------------------------------------------------------- water and pond life

  private animateWater(t: number, calm: boolean, frame: PondFrame | null) {
    const kind = frame?.kind ?? 'plain';
    const frenzy = (frame?.combo ?? 1) >= 3 && kind !== 'boss';
    // The sunset fades in and out over about a second; the colour itself is not motion, so calm
    // motion keeps it.
    this.sunset += ((frenzy ? 1 : 0) - this.sunset) * 0.05;
    this.waterColor.lerp(WATER[kind], 0.04);
    this.water.material.color.copy(this.waterColor).lerp(SUNSET_WATER, this.sunset * 0.9);
    this.water.material.emissive.lerp(frenzy ? FRENZY_GLOW : NO_GLOW, 0.05);
    const sky = this.scene.background;
    if (sky instanceof Color) sky.copy(SKY).lerp(SUNSET_SKY, this.sunset);
    if (this.scene.fog) this.scene.fog.color.copy(SKY).lerp(SUNSET_SKY, this.sunset);
    if (calm) return;
    const position = this.water.geometry.attributes['position']!;
    const array = position.array as Float32Array;
    const base = this.waterBase;
    const speed = frenzy ? 2 : 1;
    for (let i = 0; i < array.length; i += 3) {
      const x = base[i]!;
      const z = base[i + 2]!;
      array[i + 1] =
        Math.sin(x * 0.8 + t * 1.1 * speed) * 0.05 +
        Math.cos(z * 1.1 + t * 0.8 * speed + x * 0.3) * 0.045;
    }
    position.needsUpdate = true;
    if (frenzy && t > this.nextSpark) {
      this.nextSpark = t + 0.08;
      const spot = this.v1.set(
        this.viewCenter.x + (Math.random() - 0.5) * this.viewWidth,
        0.1,
        this.viewCenter.z + (Math.random() - 0.4) * this.viewWidth * 0.8,
      );
      this.fx.spark(
        spot,
        this.viewWidth * 0.03,
        0.9,
        FRENZY_SPARKS[Math.floor(Math.random() * FRENZY_SPARKS.length)],
      );
    }
  }

  private animateDecor(t: number, calm: boolean, frame: PondFrame | null) {
    if (this.frog.animate(t, calm))
      this.fx.ring(this.frog.root.position, this.frog.root.scale.x * 2.2, 0.9, 0.45);
    this.reedBed.update(t, calm ? 0 : 1);
    this.dragonfly.update(t, calm);
    // The pads drift and turn a little on the swell.
    this.decorPads.forEach((pad, index) => {
      pad.position.y = calm ? 0 : Math.sin(t * 1.3 + index * 1.7) * 0.02;
      const spin = (pad.userData['spin'] as number | undefined) ?? 0;
      pad.rotation.y = calm ? spin : spin + Math.sin(t * 0.25 + index) * 0.12;
      pad.rotation.x = calm ? 0 : Math.sin(t * 1.1 + index * 2.3) * 0.03;
    });
    this.butterflies.forEach((butterfly, index) => {
      const time = calm ? index * 3 : t * 0.35 + index * 3;
      const spread = this.viewWidth * 0.36;
      butterfly.root.position.set(
        this.viewCenter.x + Math.sin(time * (1 + index * 0.3)) * spread,
        1.6 + Math.sin(time * 3.1) * 0.25,
        this.topRow.z +
          Math.cos(time * 0.8 + index) * this.viewWidth * 0.12 +
          index * this.viewWidth * 0.2,
      );
      butterfly.root.rotation.y =
        Math.cos(time * (1 + index * 0.3)) > 0 ? Math.PI / 2 : -Math.PI / 2;
      butterfly.animate(t, calm);
    });
    this.fish.forEach((fish, index) => {
      const time = calm ? index * 2 : t * (0.3 + index * 0.06) + index * 2.1;
      const rx = this.viewWidth * (0.32 - index * 0.04);
      const rz = this.viewWidth * 0.18;
      fish.position.set(
        this.viewCenter.x + Math.cos(time) * rx,
        -0.18,
        this.viewCenter.z + Math.sin(time) * rz,
      );
      fish.rotation.y = Math.atan2(-Math.sin(time) * rx, Math.cos(time) * rz);
    });
    if (!calm && t > this.nextBloop) {
      // A fish nibbles at the surface: a little ring right above it, and a drop or two.
      this.nextBloop = t + 2.2 + ((t * 3.1) % 2.4);
      const fish = this.fish[Math.floor(t * 10) % this.fish.length]!;
      const at = this.v1.copy(fish.position).setY(0.05);
      this.fx.ring(at, fish.scale.x * 0.35, 1.4, 0.45);
      this.fx.drop(at, 0, fish.scale.x * 0.8, 0, fish.scale.x * 0.025, 0.5);
    }

    // The big fish leaps across the back of the pond on the last snack.
    const boss = frame?.kind === 'boss' && frame.phase !== 'stolen';
    this.bigFish.visible = boss;
    if (boss) {
      const cycle = calm ? 0.5 : (t % 3.6) / 2.2;
      const leap = clamp01(cycle);
      const span = this.viewWidth * 0.3;
      const x = this.viewCenter.x - span + span * 2 * leap;
      const height = Math.sin(leap * Math.PI) * this.bigFish.scale.x * 3.2;
      this.bigFish.position.set(
        x,
        cycle > 1 ? -2 : height - this.bigFish.scale.x * 0.5,
        this.topRow.z - this.viewWidth * 0.05,
      );
      this.bigFish.rotation.set(0, Math.PI / 2, 0);
      this.bigFish.rotateX(-(leap - 0.5) * 1.8 * (calm ? 0 : 1));
      if (!calm && (Math.abs(leap - 0.06) < 0.01 || Math.abs(leap - 0.94) < 0.01))
        this.fx.splash(
          this.v1.copy(this.bigFish.position).setY(0.02),
          this.bigFish.scale.x * 1.1,
          6,
          calm,
        );
    }
  }

  // ---------------------------------------------------------------- sparkles

  /** The crunch of a bite: a star of bright sparks flying out from her jaws. */
  private chompBurst(at: Vector3, radius: number) {
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      this.fx.spark(
        this.v2.set(
          at.x + Math.cos(angle) * radius,
          at.y + radius * 0.5 + Math.sin(angle) * radius * 0.5,
          at.z + Math.sin(angle) * radius * 0.6,
        ),
        radius * 0.45,
        0.45,
        i % 2 ? '#ffffff' : '#fff1a8',
        1.5,
      );
    }
  }

  /**
   * A golden snack eaten: gold coins pop up out of the pad and tumble, with a ring of sparkles
   * round Kiki. Calm motion keeps only the sparkle ring.
   */
  private goldRush(chosen: Comparison) {
    const raft = this.raftFor(chosen);
    const from = this.v1.copy(raft ? raft.padHome : this.kikiHome).setY(0.15);
    const size = raft ? raft.padRadius : this.kikiScale;
    this.sparkle(this.kikiHome, this.kikiScale * 1.1, 16);
    if (this.calm) return;
    for (let i = 0; i < 9; i++) {
      const angle = (i / 9) * Math.PI * 2 + Math.random() * 0.5;
      const speed = size * (0.9 + Math.random() * 0.8);
      this.fx.coin(
        from,
        Math.cos(angle) * speed,
        size * (3.4 + Math.random() * 1.2),
        Math.sin(angle) * speed,
        size * 0.1,
      );
    }
  }

  private sparkle(at: Vector3, radius: number, count: number, party = false) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const color = party ? FRENZY_SPARKS[i % FRENZY_SPARKS.length] : undefined;
      this.fx.spark(
        this.v2.set(
          at.x + Math.cos(angle) * radius,
          at.y + radius * (0.3 + Math.random() * 0.6),
          at.z + Math.sin(angle) * radius * 0.6,
        ),
        radius * 0.22,
        party ? 1.2 : 0.9,
        color,
      );
    }
  }
}

/** A point on the curve from `a` to `b` that bends toward `control`, at `t` from 0 to 1. */
function bezier(out: Vector3, a: Vector3, control: Vector3, b: Vector3, t: number): Vector3 {
  const u = 1 - t;
  return out.set(
    u * u * a.x + 2 * u * t * control.x + t * t * b.x,
    u * u * a.y + 2 * u * t * control.y + t * t * b.y,
    u * u * a.z + 2 * u * t * control.z + t * t * b.z,
  );
}

/**
 * Decorative lily pads round the edge of the pond: x as a share of the width; y as a share of
 * the open water above the instruction bubble (above 1: of the strip below its top); size; tone.
 */
const DECOR_PADS: readonly [number, number, number, number][] = [
  [0.06, 0.9, 1, 0],
  [0.9, 0.9, 1.2, 1],
  [0.94, 0.06, 0.8, 0],
  [0.2, 0.03, 0.7, 1],
  [0.6, 1.6, 0.7, 0],
];
/** The pads with a water lily on them, and the frog's pad. */
const LOTUS_PADS = [0, 3] as const;
const FROG_PAD = 1;
/** Reed clumps: x, y as a share of the view, size. */
const REED_SPOTS: readonly [number, number, number][] = [
  [0.04, 0.98, 1],
  [0.12, 1.02, 0.8],
  [0.96, 0.97, 1.1],
  [0.02, 0.12, 0.8],
  [0.99, 0.2, 0.7],
];
/**
 * Where the dragonfly hovers: x as a share of the width, y of the open water; a high and a low
 * spot on the left, then on the right.
 */
const DRAGON_SPOTS: readonly [number, number][] = [
  [0.1, 0.24],
  [0.12, 0.8],
  [0.88, 0.2],
  [0.88, 0.76],
];

/** The nearest equivalent of `target` to `current`, so turning never spins the long way round. */
function nearAngle(current: number, target: number): number {
  let delta = (target - current) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return current + delta;
}

/** A soft four-pointed star for sparkles. */
function sparkTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const c = canvas.getContext('2d')!;
  const glow = c.createRadialGradient(32, 32, 0, 32, 32, 30);
  glow.addColorStop(0, 'rgba(255,255,255,1)');
  glow.addColorStop(0.25, 'rgba(255,240,180,0.7)');
  glow.addColorStop(1, 'rgba(255,220,120,0)');
  c.fillStyle = glow;
  c.beginPath();
  c.moveTo(32, 0);
  c.quadraticCurveTo(36, 28, 64, 32);
  c.quadraticCurveTo(36, 36, 32, 64);
  c.quadraticCurveTo(28, 36, 0, 32);
  c.quadraticCurveTo(28, 28, 32, 0);
  c.fill();
  return new CanvasTexture(canvas);
}

/** A soft round glow, for the warm light under a golden pad. */
function glowTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const c = canvas.getContext('2d')!;
  const glow = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  glow.addColorStop(0, 'rgba(255,236,160,1)');
  glow.addColorStop(0.45, 'rgba(255,200,80,0.55)');
  glow.addColorStop(1, 'rgba(255,180,40,0)');
  c.fillStyle = glow;
  c.fillRect(0, 0, 64, 64);
  return new CanvasTexture(canvas);
}
