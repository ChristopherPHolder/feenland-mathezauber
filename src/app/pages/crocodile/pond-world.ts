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
  SphereGeometry,
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
import { Kiki } from './pond-kiki';
import {
  Butterfly,
  Frog,
  HeronModel,
  makeBigFish,
  makeFish,
  makeLilyPad,
  makeReeds,
} from './pond-life';

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
const FRENZY_GLOW = new Color('#4a3500');
const NO_GLOW = new Color('#000000');
const STEAL_SECONDS = 1.3;
const SHOO_SECONDS = 0.8;

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
  readonly tiles: Group;
  tokens: Token[];
  text: string;
  home: Vector3;
  padHome: Vector3;
  padRadius: number;
  born: number;
  wobbleAt: number;
}
interface Burst {
  readonly mesh: Mesh | Sprite;
  readonly velocity: Vector3;
  born: number;
  life: number;
  size: number;
  readonly opacity: number;
  kind: 'drop' | 'ring' | 'spark';
}

/**
 * Kiki's pond in 3D: gently moving water with ripples, lily pads, reeds, a frog, butterflies
 * and fish; Kiki in the middle; the two sides as number tiles on lily pads; and the heron in
 * race modes. It only draws: every decision comes in through `setState`.
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
  private kikiHome = new Vector3();
  private kikiScale = 1;
  private kikiYaw = 0;
  private kikiLunge = new Vector3();
  private readonly rafts: Record<Side, Raft>;
  private readonly tileGeometry = new PlaneGeometry(1, 1);

  private readonly heron = new HeronModel();
  private readonly heronShadow: Mesh<RingGeometry, MeshBasicMaterial>;
  private heronProgress = 0;
  private heronSnack = -1;
  private heronStateAt = 0;
  private heronFrom = new Vector3();
  private heronScale = 1;
  private heronStart = new Vector3();
  private orbitCenter = new Vector3();
  private orbitRadius = 2;
  private carried: Raft | null = null;
  private readonly lastHeron = new Vector3();

  private readonly decor = new Group();
  private readonly frog = new Frog();
  private readonly butterflies = [new Butterfly('#ff8fb6'), new Butterfly('#ffd166')];
  private readonly fish = [makeFish(), makeFish('#ffb347', 0.8), makeFish('#f08a24', 0.9)];
  private readonly bigFish = makeBigFish();
  private reeds: Group[] = [];
  private viewWidth = 10;
  private viewCenter = new Vector3();
  private topRow = new Vector3();

  private readonly bursts: Burst[] = [];
  private readonly dropGeometry = new SphereGeometry(1, 8, 6);
  private readonly ringGeometry = new RingGeometry(0.82, 1, 40);
  private readonly dropMaterial = new MeshBasicMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: 0.9,
  });
  private readonly sparkTexture = sparkTexture();
  private nextRipple = 0;
  private nextSpark = 0;

  private readonly tries = new EventCounter();
  private chompAt = -10;
  private chompSide: Comparison | null = null;
  private wrongAt = -10;
  private wrongSide: Comparison | null = null;
  private snack = -1;
  private phase: PondFrame['phase'] = 'ready';

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
        roughness: 0.35,
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
    this.scene.add(this.heron.root, this.heronShadow);

    for (const fish of this.fish) this.decor.add(fish);
    this.bigFish.visible = false;
    this.decor.add(this.bigFish, this.frog.root, ...this.butterflies.map((b) => b.root));
    this.scene.add(this.decor);
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
      }
      this.tries.take(0);
    }
    if (this.tries.take(frame.tries) > 0 && frame.wrong) {
      this.wrongAt = this.elapsed;
      this.wrongSide = frame.wrong;
      const raft =
        frame.wrong === '>' ? this.rafts.left : frame.wrong === '<' ? this.rafts.right : null;
      if (raft) {
        raft.wobbleAt = this.elapsed;
        this.splash(raft.padHome, raft.padRadius * 0.6, 5);
      }
    }
    if (frame.phase === 'chomping' && this.phase !== 'chomping' && frame.chosen) {
      this.chompAt = this.elapsed;
      this.chompSide = frame.chosen;
      if (frame.chosen === '=') this.sparkle(this.kikiHome, this.kikiScale * 1.2, 14);
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
    for (const raft of Object.values(this.rafts)) this.animateRaft(raft, t, calm, frame);
    this.animateHeron(t, dt, frame);
    this.animateDecor(t, calm, frame);
    this.animateBursts(t, dt);
  }

  // ---------------------------------------------------------------- layout from the DOM

  /** Reads where the page's buttons are, so the pads and Kiki sit right under them. */
  private measure() {
    const board = this.host.parentElement;
    if (!board) return;
    const base = this.host.getBoundingClientRect();
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
      same(before.left, left) &&
      same(before.center, center) &&
      same(before.right, right)
    )
      return;
    const first = !before;
    this.anchors = { left, center, right };
    this.place(first);
  }

  /** The point on the horizontal plane at height `y` under a pixel of the host. */
  private ground(px: number, py: number, y = 0, out = new Vector3()): Vector3 {
    this.ndc.set((px / this.width) * 2 - 1, -(py / this.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    this.plane.constant = -y;
    return this.raycaster.ray.intersectPlane(this.plane, out) ?? out.set(0, y, 0);
  }

  /** World units per screen pixel at a point. */
  private perPixel(point: Vector3): number {
    const depth = -point.clone().applyMatrix4(this.camera.matrixWorldInverse).z;
    return (2 * depth * Math.tan((FOV / 2) * DEG)) / this.height;
  }

  private place(snap: boolean) {
    const anchors = this.anchors;
    if (!anchors) return;
    const { center } = anchors;
    this.kikiHome = this.ground(center.x + center.w / 2, center.y + center.h * 0.55);
    this.kikiScale =
      (Math.min(center.w * 1.15, center.h * 1.3) * this.perPixel(this.kikiHome)) / 1.25;
    this.kiki.root.scale.setScalar(this.kikiScale);
    if (snap) this.kiki.root.position.copy(this.kikiHome);
    for (const side of ['left', 'right'] as const)
      this.placeRaft(this.rafts[side], anchors[side], snap);

    // The rest of the pond is framed from what the camera sees.
    const corner = (x: number, y: number) => this.ground(x * this.width, y * this.height);
    const bottomLeft = corner(0, 1);
    const bottomRight = corner(1, 1);
    this.viewCenter = corner(0.5, 0.55);
    this.topRow = corner(0.5, 0.18);
    this.viewWidth = bottomRight.x - bottomLeft.x;
    const unit = this.perPixel(this.viewCenter) * Math.min(this.width, this.height * 1.4);
    this.placeDecor(unit);

    const heronHeight = 2.6;
    this.heronStart = this.ground(this.width * 1.25, -this.height * 0.2, heronHeight + 1.2);
    this.orbitCenter = this.ground(this.width / 2, this.height * 0.4, heronHeight);
    this.orbitRadius = Math.min(this.viewWidth * 0.18, unit * 0.22);
    this.heronScale = unit * 0.11;
    this.heron.root.scale.setScalar(this.heronScale);
  }

  private placeRaft(raft: Raft, anchor: Anchor, snap: boolean) {
    const cx = anchor.x + anchor.w / 2;
    const cy = anchor.y + anchor.h / 2;
    const sizes = this.tileSizes(raft, anchor);
    const lift = 0.05;
    const tileCenter = this.ground(
      cx,
      cy,
      lift + sizes.height * 0.5 * this.perPixel(this.ground(cx, cy)),
    );
    const unit = this.perPixel(tileCenter);
    raft.home = tileCenter;
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
    raft.padHome = this.ground(cx, cy + sizes.height * 0.18);
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
    const room = anchor.w * 0.9;
    if (sizes.total > room) {
      height *= room / sizes.total;
      sizes = measure(height);
    }
    return { ...sizes, height };
  }

  private placeDecor(unit: number) {
    for (const clump of this.reeds) this.decor.remove(clump);
    this.reeds = [];
    const spots: readonly [number, number, number][] = [
      [0.04, 0.98, 1],
      [0.12, 1.02, 0.8],
      [0.96, 0.97, 1.1],
      [0.02, 0.12, 0.8],
      [0.99, 0.2, 0.7],
    ];
    spots.forEach(([x, y, size], index) => {
      const clump = makeReeds(index + 1);
      clump.position.copy(this.ground(x * this.width, y * this.height));
      clump.scale.setScalar(unit * 0.16 * size);
      this.reeds.push(clump);
      this.decor.add(clump);
    });
    this.decorPads.forEach((pad, index) => {
      const [x, y, size] = DECOR_PADS[index]!;
      pad.position.copy(this.ground(x * this.width, y * this.height));
      pad.scale.setScalar(unit * 0.07 * size);
      pad.rotation.y = index * 1.9;
    });
    const frogPad = this.decorPads[1]!;
    this.frog.root.position.copy(frogPad.position).setY(0.05);
    this.frog.root.scale.setScalar(unit * 0.12);
    this.frog.root.rotation.y = -0.6;
    for (const fish of this.fish) fish.scale.setScalar(unit * 0.22);
    this.bigFish.scale.setScalar(unit * 0.11);
    for (const butterfly of this.butterflies) butterfly.root.scale.setScalar(unit * 0.14);
  }

  private readonly decorPads: Group[] = DECOR_PADS.map(([, , , tone]) => {
    const pad = makeLilyPad(tone ? '#5fb86c' : '#4ca25f');
    this.decor.add(pad);
    return pad;
  });

  // ---------------------------------------------------------------- sides

  private makeRaft(side: Side): Raft {
    const pad = makeLilyPad();
    const tiles = new Group();
    this.scene.add(pad, tiles);
    return {
      side,
      pad,
      tiles,
      tokens: [],
      text: '',
      home: new Vector3(),
      padHome: new Vector3(),
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
    const border = golden ? '#f4b740' : kind === 'boss' ? '#1f5fa8' : '#d6e8db';
    raft.tokens = text.split(' ').map((value) => {
      const operator = value === '+' || value === '−' || value === '×';
      const chars = [...value].length;
      const aspect = operator ? 1 : Math.max(0.8, 0.28 + 0.31 * chars);
      const label = new TextLabel(value, {
        ink: INK,
        fill: operator ? (value === '−' ? '#9fd6f2' : '#f4b740') : golden ? '#fff3c4' : '#ffffff',
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
          color: golden ? '#e2a82e' : '#b9d6c2',
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
    const wobble = wobbleAge < 0.7 ? Math.sin(wobbleAge * 26) * 0.2 * (1 - wobbleAge / 0.7) : 0;
    raft.pad.rotation.set(wobble * 0.4, raft.side === 'left' ? 0.6 : -2.4, wobble * 0.3);

    const eaten =
      this.chompSide !== null &&
      ((raft.side === 'left' && this.chompSide === '>') ||
        (raft.side === 'right' && this.chompSide === '<'));
    const chompAge = t - this.chompAt;
    const target = raft.home.clone();
    target.y += bob;
    let scale = grow;
    if (eaten) {
      // Gulped: the tiles fly into Kiki's mouth as her jaws snap shut.
      const gulp = smooth((chompAge - 0.18) / 0.32);
      target.lerp(this.mouth(), gulp);
      scale *= 1 - gulp * 0.92;
      raft.tiles.visible = gulp < 0.98;
      if (chompAge > 0.3 && chompAge < 0.3 + 1 / 30)
        this.splash(raft.padHome, raft.padRadius * 0.8, 10);
    } else if (this.carried === raft && frame?.heron) {
      target.copy(this.heronBeak());
      scale *= 0.75;
    } else if (frame?.phase === 'chomping' && this.chompSide === '=') {
      target.y +=
        Math.abs(Math.sin(chompAge * 9)) * 0.12 * raft.padRadius * (1 - clamp01(chompAge / 1.2));
    }
    raft.tiles.position.lerp(target, eaten || this.carried === raft ? 0.5 : 0.25);
    raft.tiles.scale.setScalar(Math.max(0.001, scale));
    raft.tiles.rotation.setFromQuaternion(this.camera.quaternion);
    raft.tiles.rotateZ(wobble * 0.5);
    raft.pad.visible = true;

    const golden = frame?.kind === 'golden' && frame.phase === 'ready';
    if (golden && !calm && t > this.nextSpark) {
      this.nextSpark = t + 0.12;
      const spot = raft.home
        .clone()
        .add(
          new Vector3(
            (Math.random() - 0.5) * raft.padRadius * 1.6,
            (Math.random() - 0.3) * raft.padRadius * 0.5,
            0,
          ),
        );
      this.spark(spot, raft.padRadius * 0.16, 0.7);
    }
  }

  // ---------------------------------------------------------------- Kiki

  /** Where Kiki's mouth is in the world right now. */
  private mouth(): Vector3 {
    const forward = new Vector3(Math.sin(this.kikiYaw), 0, Math.cos(this.kikiYaw));
    return this.kiki.root.position
      .clone()
      .addScaledVector(forward, this.kikiScale * 0.85)
      .setY(this.kikiScale * 0.2);
  }

  private raftFor(choice: Comparison | null): Raft | null {
    return choice === '>' ? this.rafts.left : choice === '<' ? this.rafts.right : null;
  }

  private animateKiki(t: number, dt: number, calm: boolean, frame: PondFrame | null) {
    const kiki = this.kiki;
    const pose = frame?.pose ?? null;
    const facing = this.raftFor(pose);
    const chompAge = t - this.chompAt;
    const chomping = frame?.phase === 'chomping' && this.chompSide !== null;
    let yawTarget = 0;
    if (facing) {
      const toward = facing.padHome.clone().sub(this.kikiHome);
      yawTarget = Math.atan2(toward.x, toward.z);
    }
    // A stolen snack: she watches the heron go.
    if (frame?.phase === 'stolen' && this.heron.root.visible) {
      const toward = this.heron.root.position.clone().sub(kiki.root.position);
      yawTarget = Math.atan2(toward.x, Math.max(0.2, toward.z));
    }
    this.kikiYaw = approach(this.kikiYaw, yawTarget, chomping ? 14 : 7, dt);

    // Lunge: surge toward the chosen pad, snap, chew, drift home.
    let jaw = 0;
    let lungeAmount = 0;
    let rise = 0;
    if (chomping && facing) {
      const toward = facing.padHome.clone().sub(this.kikiHome).setY(0);
      const reach = Math.max(0, toward.length() - facing.padRadius * 0.9 - this.kikiScale * 0.75);
      lungeAmount =
        chompAge < 0.25
          ? easeOut(chompAge / 0.25)
          : chompAge < 0.9
            ? 1
            : 1 - smooth((chompAge - 0.9) / 0.5);
      this.kikiLunge.copy(toward.normalize().multiplyScalar(reach * lungeAmount));
      jaw =
        chompAge < 0.2
          ? smooth(chompAge / 0.2)
          : chompAge < 0.32
            ? 1 - smooth((chompAge - 0.2) / 0.12)
            : chompAge < 0.9
              ? Math.max(0, Math.sin((chompAge - 0.32) * 18)) * 0.25
              : 0;
    } else {
      this.kikiLunge.multiplyScalar(Math.exp(-6 * dt));
      if (chomping && this.chompSide === '=') {
        // Both sides the same: mouth shut, a happy hop and a smile.
        rise = Math.sin(clamp01(chompAge / 0.6) * Math.PI) * 0.45 * this.kikiScale;
      } else if (facing && frame?.phase === 'ready') {
        jaw = 0.5;
      }
    }
    if (frame?.phase === 'stolen') jaw = 0.25;
    kiki.jaw = approach(kiki.jaw, jaw, chomping ? 40 : 10, dt);

    const wrongAge = t - this.wrongAt;
    const shake = wrongAge < 0.65 ? Math.sin(wrongAge * 30) * 0.32 * (1 - wrongAge / 0.65) : 0;
    const bob = calm ? 0 : Math.sin(t * 1.8) * 0.03 * this.kikiScale;
    const idleYaw = calm || facing ? 0 : Math.sin(t * 0.6) * 0.12;
    const target = this.kikiHome.clone().add(this.kikiLunge);
    kiki.root.position.x = target.x;
    kiki.root.position.z = target.z;
    kiki.root.position.y = bob + rise;
    kiki.body.rotation.y = this.kikiYaw + idleYaw + shake;
    kiki.body.rotation.x =
      rise > 0 ? -0.25 * (rise / (0.45 * this.kikiScale)) : -lungeAmount * 0.08;
    const glowing = (frame?.combo ?? 1) >= 3;
    kiki.glow = approach(kiki.glow, glowing ? 1 : 0, 3, dt);
    const look = this.wrongSide && wrongAge < 0.65 ? 0 : facing ? 0 : Math.sin(t * 0.5) * 0.6;
    kiki.animate(t, dt, calm, lungeAmount, calm ? 0 : look);

    // A wake of ripples while she swims out and back.
    if (lungeAmount > 0.2 && t > this.nextRipple - 0.8) {
      this.ring(kiki.root.position.clone().setY(0.02), this.kikiScale * 0.5, 0.6, 0.3);
      this.nextRipple = t + 0.3;
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
      this.heron.root.position.copy(this.heronStart);
      this.heronFrom.copy(this.heronStart);
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

  private heronBeak(): Vector3 {
    return this.heron.beak.clone().applyMatrix4(this.heron.root.matrixWorld);
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
    if (heron.state === 'flying') {
      if (!heron.paused)
        this.heronProgress = Math.min(1, this.heronProgress + (dt * 1000) / heron.duration);
      const p = this.heronProgress;
      // Flies in, then circles over the middle of the pond, lower and tighter as time runs out.
      const arrive = smooth(p / 0.12);
      const angle = t * (0.9 + p * 1.2);
      const radius = this.orbitRadius * (1 - p * 0.45);
      const orbit = this.orbitCenter
        .clone()
        .add(new Vector3(Math.cos(angle) * radius, -p * 1.1, Math.sin(angle) * radius * 0.6));
      root.position.lerpVectors(this.heronStart, orbit, arrive);
      root.scale.setScalar(this.heronScale * (1 + p * 0.25));
      beat = 0.35 + p * 0.5;
    } else if (heron.state === 'stole') {
      // Dives on the snack, then flaps away with it.
      const raft = this.carried;
      const prey = raft
        ? raft.home.clone().setY(raft.home.y + 0.1)
        : this.kikiHome.clone().setY(this.kikiScale * 0.6);
      const dive = smooth(age / 0.4);
      const away = smooth((age - 0.4) / (STEAL_SECONDS - 0.4));
      const offBeak = this.heron.beak.clone().multiplyScalar(root.scale.x);
      const low = prey.clone().sub(offBeak.setY(offBeak.y * 0.6));
      const exit = this.ground(-this.width * 0.3, -this.height * 0.3, 4);
      root.position.lerpVectors(this.heronFrom, low, dive).lerp(exit, away);
      beat = age < 0.4 ? 0.2 : 1;
    } else {
      const exit = this.ground(this.width * 1.4, -this.height * 0.4, 5);
      root.position.lerpVectors(this.heronFrom, exit, easeOut(age / SHOO_SECONDS) ** 1.4);
      root.rotation.z = Math.sin(age * 20) * 0.3;
      beat = 1;
    }
    const velocity = root.position.clone().sub(this.lastHeron);
    if (velocity.lengthSq() > 1e-6) {
      const yaw = Math.atan2(velocity.x, velocity.z);
      root.rotation.y = approach(root.rotation.y, nearAngle(root.rotation.y, yaw), 8, dt);
    }
    this.heron.animate(t, this.calm ? Math.min(beat, 0.5) : beat);
    root.updateMatrixWorld();
    const height = Math.max(0.3, root.position.y);
    this.heronShadow.position.set(root.position.x, 0.03, root.position.z);
    this.heronShadow.scale.setScalar(root.scale.x * (1.4 - Math.min(1, height / 5) * 0.6));
    this.heronShadow.material.opacity = 0.32 - Math.min(0.2, height * 0.04);
  }

  // ---------------------------------------------------------------- water and pond life

  private animateWater(t: number, calm: boolean, frame: PondFrame | null) {
    const kind = frame?.kind ?? 'plain';
    this.waterColor.lerp(WATER[kind], 0.04);
    this.water.material.color.copy(this.waterColor);
    const frenzy = (frame?.combo ?? 1) >= 3;
    this.water.material.emissive.lerp(frenzy ? FRENZY_GLOW : NO_GLOW, 0.05);
    if (!calm) {
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
      this.water.geometry.computeVertexNormals();
      if (t > this.nextRipple) {
        this.nextRipple = t + (frenzy ? 0.5 : 1.4);
        const spot = this.viewCenter
          .clone()
          .add(
            new Vector3(
              (Math.random() - 0.5) * this.viewWidth * 0.9,
              0.02,
              (Math.random() - 0.3) * this.viewWidth * 0.7,
            ),
          );
        this.ring(spot, this.viewWidth * 0.06, 2.4);
      }
      if (frenzy && t > this.nextSpark) {
        this.nextSpark = t + 0.08;
        const spot = this.viewCenter
          .clone()
          .add(
            new Vector3(
              (Math.random() - 0.5) * this.viewWidth,
              0.1,
              (Math.random() - 0.4) * this.viewWidth * 0.8,
            ),
          );
        this.spark(spot, this.viewWidth * 0.025, 0.8);
      }
    }
  }

  private animateDecor(t: number, calm: boolean, frame: PondFrame | null) {
    this.frog.animate(t, calm);
    const sway = calm ? 0 : 1;
    this.reeds.forEach(
      (clump, index) => (clump.rotation.z = Math.sin(t * 1.2 + index) * 0.06 * sway),
    );
    this.decorPads.forEach(
      (pad, index) => (pad.position.y = calm ? 0 : Math.sin(t * 1.3 + index * 1.7) * 0.02),
    );
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
        this.ring(this.bigFish.position.clone().setY(0.02), this.bigFish.scale.x * 1.5, 0.8);
    }
  }

  // ---------------------------------------------------------------- splashes and sparkles

  private splash(at: Vector3, size: number, drops: number) {
    this.ring(at.clone().setY(0.03), size * 1.4, 0.8);
    if (this.calm) return;
    for (let i = 0; i < drops; i++) {
      const angle = (i / drops) * Math.PI * 2 + Math.random() * 0.4;
      const mesh = new Mesh(this.dropGeometry, this.dropMaterial);
      mesh.position.copy(at).setY(0.05);
      const speed = size * (1.6 + Math.random());
      this.addBurst(
        mesh,
        new Vector3(
          Math.cos(angle) * speed,
          size * (3 + Math.random() * 2),
          Math.sin(angle) * speed,
        ),
        0.7,
        size * 0.09,
        'drop',
      );
    }
  }

  private ring(at: Vector3, size: number, life: number, opacity = 0.6) {
    const mesh = new Mesh(
      this.ringGeometry,
      new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity, depthWrite: false }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(at);
    this.addBurst(mesh, new Vector3(), life, size, 'ring');
  }

  private spark(at: Vector3, size: number, life: number) {
    const sprite = new Sprite(
      new SpriteMaterial({
        map: this.sparkTexture,
        color: '#ffe27a',
        blending: AdditiveBlending,
        depthWrite: false,
        transparent: true,
      }),
    );
    sprite.position.copy(at);
    this.addBurst(sprite, new Vector3(0, size * 0.8, 0), life, size, 'spark');
  }

  private sparkle(at: Vector3, radius: number, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      this.spark(
        at
          .clone()
          .add(
            new Vector3(
              Math.cos(angle) * radius,
              radius * (0.3 + Math.random() * 0.6),
              Math.sin(angle) * radius * 0.6,
            ),
          ),
        radius * 0.22,
        0.9,
      );
    }
  }

  private addBurst(
    mesh: Mesh | Sprite,
    velocity: Vector3,
    life: number,
    size: number,
    kind: Burst['kind'],
  ) {
    // Keep the pool small for tablets: drop the oldest when it is full.
    if (this.bursts.length > 70) this.removeBurst(0);
    mesh.scale.setScalar(size);
    this.scene.add(mesh);
    const opacity = (mesh.material as MeshBasicMaterial | SpriteMaterial).opacity;
    this.bursts.push({ mesh, velocity, born: this.elapsed, life, size, opacity, kind });
  }

  private removeBurst(index: number) {
    const [burst] = this.bursts.splice(index, 1);
    if (!burst) return;
    this.scene.remove(burst.mesh);
    if (burst.kind !== 'drop')
      (burst.mesh.material as MeshBasicMaterial | SpriteMaterial).dispose();
  }

  private animateBursts(t: number, dt: number) {
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const burst = this.bursts[i]!;
      const age = (t - burst.born) / burst.life;
      if (age >= 1) {
        this.removeBurst(i);
        continue;
      }
      const material = burst.mesh.material as MeshBasicMaterial | SpriteMaterial;
      if (burst.kind === 'ring') {
        burst.mesh.scale.setScalar(burst.size * (0.3 + easeOut(age) * 1.2));
        material.opacity = burst.opacity * (1 - age);
      } else if (burst.kind === 'drop') {
        burst.velocity.y -= 9.8 * burst.size * 12 * dt;
        burst.mesh.position.addScaledVector(burst.velocity, dt);
        if (burst.mesh.position.y < 0) burst.life = 0;
      } else {
        burst.mesh.position.addScaledVector(burst.velocity, dt);
        burst.mesh.scale.setScalar(burst.size * Math.sin(age * Math.PI));
        material.opacity = 1 - age;
      }
    }
  }
}

/** Decorative lily pads round the edge of the pond: x, y as a share of the view, size, tone. */
const DECOR_PADS: readonly [number, number, number, number][] = [
  [0.1, 0.84, 1, 0],
  [0.88, 0.86, 1.2, 1],
  [0.94, 0.08, 0.8, 0],
  [0.22, 0.04, 0.7, 1],
  [0.6, 0.97, 0.7, 0],
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
