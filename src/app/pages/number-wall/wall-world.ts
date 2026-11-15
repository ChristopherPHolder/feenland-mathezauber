import {
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  OctahedronGeometry,
  PerspectiveCamera,
  PlaneGeometry,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
} from 'three';
import { Stage } from '../../shared/three/stage';
import type { StateWorld } from '../../shared/three/three-stage';
import { TextLabel } from '../../shared/three/labels';
import {
  approach,
  bounce,
  clamp01,
  EventCounter,
  easeOut,
  easeOutBack,
  shake,
  smooth,
} from '../../shared/three/motion';
import { BrickId, sameBrick } from './number-wall';
import { BRICKS_EVENT, BrickRect, WallFrame } from './wall-frame';
import {
  Brick,
  BRICK,
  brickCentre,
  BrickLook,
  Castle,
  crackTexture,
  heartGeometry,
  PINK,
  Scenery,
} from './wall-models';
import { Sparks } from './wall-sparks';
import { Troll } from './wall-troll-model';

const FOV = 40;
/** The camera looks down on the wall by this much (radians). */
const PITCH = 0.24;
/** Seconds from the start of a bonk to the club hitting the wall. */
const IMPACT = 0.42;
const SWOOP = 2.6;
const PINK_GLOW = new Color('#ff3d8b');
const PAIR_GLOW = new Color('#ffbf1f');
const GOLD_GLOW = new Color('#ffcf3a');
const DANGER_SKY = new Color('#ffc7a6');
const WHITE = new Color('#ffffff');
const GEM_COLORS = ['#41c7ff', '#ff5fa8', '#a774ff'];

interface Trip {
  readonly start: number;
  readonly to: Vector3;
  readonly cast: boolean;
}

/**
 * The castle wall in 3D: chunky bricks with their numbers, two towers on a meadow, the fairy
 * who helps and the troll who marches down the road to bonk the wall. It only draws the
 * `WallFrame` it is given; the page decides everything.
 */
export class WallWorld extends Stage implements StateWorld<WallFrame> {
  private frame?: WallFrame;
  private readonly scenery = new Scenery();
  private castle?: Castle;
  private castleKey = '';
  private readonly wallGroup = new Group();
  private bricks: Brick[] = [];
  private readonly troll = new Troll();
  private readonly fairy: Sprite;
  private readonly fairyHome = new Vector3();
  private readonly fairyAt = new Vector3();
  private trip?: Trip;
  private readonly sparks = new Sparks();
  private readonly plus: Mesh;
  private readonly bubble = new Group();
  private readonly heart: Mesh;
  private readonly halves: Mesh[];
  private readonly gems: Mesh[] = [];
  private readonly zzz: Sprite[] = [];
  private cracks: Mesh[] = [];

  private readonly placed = new EventCounter();
  private readonly misses = new EventCounter();
  private readonly bonks = new EventCounter();
  private readonly casts = new EventCounter();
  private build = -1;
  private buildAt = -10;
  private readonly dropAt = new Map<string, number>();
  private missAt = -10;
  private bonkAt = -10;
  private castAt = -10;
  private builtAt = -10;
  private crumbleAt = -10;
  private wasBuilt = false;
  private wasCrumbled = false;
  private wasAsleep = false;
  private danger = 0;
  private trollShown = 0;
  private trollPhase = 0;
  private sparkleClock = 0;

  private aspect = 1;
  private restDistance = 12;
  private lookX = 0;
  private lookY = 2;
  private readonly probe = new PerspectiveCamera(FOV, 1, 0.1, 200);
  private rectsDirty = true;
  private lastRects = '';

  constructor(canvas: HTMLCanvasElement, host: HTMLElement) {
    super(canvas, host, { shadows: true, fov: FOV, background: '#bfe6f8' });
    this.sun.position.set(-5, 12, 9);
    this.sun.intensity = 2.1;
    this.fill.intensity = 1.5;
    const shadow = this.sun.shadow.camera;
    shadow.left = -9;
    shadow.right = 9;
    shadow.top = 9;
    shadow.bottom = -6;
    shadow.far = 40;
    this.scene.add(this.scenery.group, this.wallGroup, this.troll.root, this.sparks.group);
    this.troll.root.scale.setScalar(0.92);

    const texture = new TextureLoader().load('/images/fairy-defense/fairy.webp', () => this.draw());
    texture.colorSpace = SRGBColorSpace;
    this.fairy = new Sprite(new SpriteMaterial({ map: texture, transparent: true }));
    this.fairy.scale.set(1.5, 1, 1);
    this.fairy.renderOrder = 5;
    this.scene.add(this.fairy);

    const plusLabel = new TextLabel('+', {
      ink: PINK,
      fill: '#ffffff',
      border: PINK,
      radius: 0.5,
      width: 128,
      height: 128,
    });
    this.plus = new Mesh(
      new PlaneGeometry(0.46, 0.46),
      new MeshBasicMaterial({ map: plusLabel.texture, transparent: true, depthWrite: false }),
    );
    this.plus.renderOrder = 4;
    this.wallGroup.add(this.plus);

    const bubbleSkin = new Mesh(
      new SphereGeometry(1.45, 22, 14),
      new MeshLambertMaterial({
        color: '#a8dcff',
        emissive: new Color('#2c6fd0'),
        transparent: true,
        opacity: 0.38,
        depthWrite: false,
      }),
    );
    this.bubble.add(bubbleSkin);
    const ice = new MeshBasicMaterial({ color: '#e6f6ff' });
    const flake = new OctahedronGeometry(0.09);
    for (let i = 0; i < 8; i++) {
      const bit = new Mesh(flake, ice);
      const angle = (i / 8) * Math.PI * 2;
      bit.position.set(Math.cos(angle) * 1.5, ((i % 3) - 1) * 0.6, Math.sin(angle) * 1.5);
      this.bubble.add(bit);
    }
    this.bubble.visible = false;
    this.scene.add(this.bubble);

    const red = new MeshBasicMaterial({ color: '#e8344e', side: DoubleSide, transparent: true });
    this.heart = new Mesh(heartGeometry('whole'), red);
    this.halves = (['left', 'right'] as const).map(
      (half) => new Mesh(heartGeometry(half), red.clone()),
    );
    for (const piece of [this.heart, ...this.halves]) {
      piece.visible = false;
      piece.renderOrder = 6;
      this.scene.add(piece);
    }

    const gem = new OctahedronGeometry(0.3);
    for (const color of GEM_COLORS) {
      const mesh = new Mesh(
        gem,
        new MeshLambertMaterial({ color, emissive: new Color(color).multiplyScalar(0.45) }),
      );
      mesh.scale.y = 1.35;
      mesh.visible = false;
      this.gems.push(mesh);
      this.scene.add(mesh);
    }

    for (let i = 0; i < 3; i++) {
      const z = new TextLabel('z', { ink: '#3d4f86', width: 96, height: 96 });
      const sprite = new Sprite(new SpriteMaterial({ map: z.texture, transparent: true }));
      sprite.visible = false;
      this.zzz.push(sprite);
      this.scene.add(sprite);
    }
  }

  setState(frame: WallFrame) {
    const t = this.elapsed;
    // The frame goes in first: restacking frames the camera on this wall's rows, not the last.
    this.frame = frame;
    if (frame.build !== this.build) this.restack(frame, t);

    if (this.placed.take(frame.placed) && frame.justFilled) {
      const key = keyOf(frame.justFilled);
      this.dropAt.set(key, t);
      const brick = this.brickAt(frame.justFilled);
      if (brick) {
        const to = brick.root.position.clone().add(new Vector3(-0.85, 0.95, 0.75));
        this.trip = { start: t, to, cast: false };
      }
    }
    if (this.misses.take(frame.misses)) this.missAt = t;
    if (this.bonks.take(frame.bonks)) this.bonkAt = t;
    if (this.casts.take(frame.casts)) {
      this.castAt = t;
      const head = this.troll.root.position.clone().add(new Vector3(-1.1, 2.4, 0.4));
      this.trip = { start: t, to: head, cast: true };
    }
    if (frame.built && !this.wasBuilt) this.builtAt = t;
    if (frame.crumbled && !this.wasCrumbled) this.crumbleAt = t + IMPACT;
    if (frame.trollAsleep && !this.wasAsleep && this.castAt < t - 0.1) this.castAt = t;
    this.wasBuilt = frame.built;
    this.wasCrumbled = frame.crumbled;
    this.wasAsleep = frame.trollAsleep;

    for (const brick of this.bricks) {
      const { look, text } = lookOf(frame, brick);
      brick.setLook(look, text);
    }
    this.placePlus(frame);
    this.castle?.pennants.forEach((pennant, index) => {
      pennant.visible = index < frame.wallsDone;
    });
    if (this.castle) this.castle.flag.visible = frame.wallsDone >= frame.total;
  }

  /** A new wall: builds the castle for its size and stacks fresh bricks that pop in. */
  private restack(frame: WallFrame, t: number) {
    this.build = frame.build;
    this.buildAt = t;
    this.dropAt.clear();
    this.crumbleAt = -10;
    this.builtAt = -10;
    this.wasCrumbled = frame.crumbled;
    this.wasBuilt = frame.built;
    const bottom = frame.rows[0]?.length ?? 2;
    const key = `${bottom}x${frame.rows.length}`;
    if (key !== this.castleKey) {
      if (this.castle) {
        this.scene.remove(this.castle.group);
        disposeGroup(this.castle.group);
      }
      this.castle = new Castle(bottom, frame.rows.length);
      this.castleKey = key;
      this.scene.add(this.castle.group);
      this.trollShown = 0;
    }
    for (const brick of this.bricks) {
      this.wallGroup.remove(brick.root);
      brick.dispose();
    }
    for (const crack of this.cracks) {
      crack.removeFromParent();
      crack.material instanceof MeshBasicMaterial && crack.material.map?.dispose();
    }
    this.cracks = [];
    this.bricks = frame.rows.flatMap((row, rowIndex) =>
      row.map((_, col) => {
        const brick = new Brick(rowIndex, col);
        brick.root.position.copy(brickCentre(rowIndex, col, bottom));
        this.wallGroup.add(brick.root);
        return brick;
      }),
    );
    const top = BRICK.base + frame.rows.length * BRICK.rise;
    this.fairyHome.set(-(this.castle!.halfWidth + 0.15), top + 0.15, 1.1);
    if (this.fairyAt.lengthSq() === 0) this.fairyAt.copy(this.fairyHome);
    this.frameCamera();
  }

  private brickAt(id: BrickId): Brick | undefined {
    return this.bricks.find((brick) => brick.row === id.row && brick.col === id.col);
  }

  /** The + badge sits in the gap between the two bricks to add. */
  private placePlus(frame: WallFrame) {
    const pair = frame.pair;
    const left = pair && this.brickAt(pair);
    const right = pair && this.brickAt({ row: pair.row, col: pair.col + 1 });
    this.plus.visible = !!left && !!right && !frame.built && !frame.crumbled;
    if (left && right) {
      this.plus.position
        .copy(left.root.position)
        .add(right.root.position)
        .multiplyScalar(0.5)
        .setZ(BRICK.d / 2 + 0.12);
    }
  }

  protected override layout(aspect: number) {
    this.aspect = aspect;
    this.frameCamera();
  }

  /**
   * Fits the wall into the scene box as big as it goes, from where the camera really projects
   * it: the top brick's back edge, the plinth's front corners and the troll beside the wall all
   * stay inside. Roomy boxes back off a little so the towers join in; a tall phone box gets the
   * wall close up instead of a band of sky and grass.
   */
  private frameCamera() {
    const castle = this.castle;
    const rows = this.frame?.rows.length ?? 2;
    const half = castle?.halfWidth ?? 1.6;
    const towerX = castle?.towerX ?? half + 1.95;
    const towerTop = castle?.towerTop ?? 3.2;
    const wallTop = BRICK.base + rows * BRICK.rise;
    const front = BRICK.d / 2 + 0.2;
    // The troll bonks the wall from the right: that side keeps room for all of him, the left
    // only the plinth, and the camera looks at the middle of the two.
    const left = half + 0.3;
    const right = half + 1.4;
    this.lookX = (right - left) / 2;
    const wall = [
      ...[-1, 1].flatMap((x) => [
        new Vector3(x * (half + 0.25), 0, front),
        new Vector3(x * half, BRICK.base + BRICK.h, BRICK.d / 2),
        new Vector3((x * BRICK.w) / 2, wallTop + 0.05, -BRICK.d / 2),
      ]),
      new Vector3(-left, 0, front),
      new Vector3(right, 0, 0.8),
      new Vector3(right, 2.6, 0.3),
    ];
    const whole = [
      ...wall,
      ...[-1, 1].flatMap((x) => [
        new Vector3(x * (towerX + 0.9) + this.lookX, 0, 0),
        new Vector3(x * (towerX + 0.9) + this.lookX, towerTop + 1.6, 0),
      ]),
    ];
    const tight = this.fitCamera(wall, 0.94);
    const full = this.fitCamera(whole, 0.97);
    // Roomy boxes (an iPad) may back off a touch for the towers; small ones keep the wall close.
    const room = 1 + 0.08 * clamp01((this.height - 320) / 300);
    this.restDistance = Math.min(full, tight * room);
    this.lookY = this.centreOn(wall, this.restDistance);
    this.placeCamera(this.camera, 0, 1);
    this.camera.aspect = this.aspect;
    this.camera.updateProjectionMatrix();
    this.rectsDirty = true;
  }

  /** The nearest camera distance at which every point lies within `margin` of the box edges. */
  private fitCamera(points: readonly Vector3[], margin: number): number {
    let near = 2;
    let far = 90;
    for (let step = 0; step < 22; step++) {
      const distance = (near + far) / 2;
      const lookY = this.centreOn(points, distance);
      const { minX, maxX, minY, maxY } = this.project(points, distance, lookY);
      const fits = Math.max(-minX, maxX) <= margin && (maxY - minY) / 2 <= margin;
      if (fits) far = distance;
      else near = distance;
    }
    return far;
  }

  /** The height to look at so the points sit in the middle of the box from this distance. */
  private centreOn(points: readonly Vector3[], distance: number): number {
    const tanV = Math.tan((FOV * Math.PI) / 360);
    let lookY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
    for (let step = 0; step < 4; step++) {
      const { minY, maxY } = this.project(points, distance, lookY);
      lookY += ((minY + maxY) / 2) * distance * tanV;
    }
    return lookY;
  }

  private project(points: readonly Vector3[], distance: number, lookY: number) {
    const probe = this.probe;
    probe.aspect = this.aspect;
    probe.position.set(this.lookX, lookY + distance * Math.sin(PITCH), distance * Math.cos(PITCH));
    probe.lookAt(this.lookX, lookY, 0);
    probe.updateProjectionMatrix();
    probe.updateMatrixWorld();
    const at = new Vector3();
    const box = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
    for (const point of points) {
      at.copy(point).project(probe);
      box.minX = Math.min(box.minX, at.x);
      box.maxX = Math.max(box.maxX, at.x);
      box.minY = Math.min(box.minY, at.y);
      box.maxY = Math.max(box.maxY, at.y);
    }
    return box;
  }

  private placeCamera(camera: PerspectiveCamera, orbit: number, dolly: number, lift = 0) {
    const distance = this.restDistance * dolly;
    camera.position.set(
      this.lookX + Math.sin(orbit) * distance * Math.cos(PITCH),
      this.lookY + distance * Math.sin(PITCH) + lift,
      Math.cos(orbit) * distance * Math.cos(PITCH),
    );
    camera.lookAt(this.lookX, this.lookY + lift * 0.5, 0);
  }

  protected update(dt: number, t: number) {
    const frame = this.frame;
    if (!frame) return;
    const calm = this.calm;
    if (!calm)
      for (const cloud of this.scenery.clouds) {
        cloud.position.x += dt * 0.35;
        if (cloud.position.x > 30) cloud.position.x = -30;
      }

    const troll = frame.troll;
    const threatened = troll !== undefined && troll > 0.7 && !frame.trollAsleep && !frame.built;
    this.danger = approach(this.danger, threatened || frame.crumbled ? 1 : 0, 2, dt);
    this.scenery.sky.material.color.copy(WHITE).lerp(DANGER_SKY, this.danger);
    this.scenery.sunGlow.scale.setScalar(1 + this.danger * 0.35 + (calm ? 0 : Math.sin(t) * 0.04));

    this.wallGroup.position.x = shake(t, this.bonkAt + IMPACT, 0.6, 0.16);
    this.updateBricks(frame, t, calm);
    this.updateCracks(frame, t);
    this.updateTroll(frame, dt, t, calm);
    this.updateFairy(frame, dt, t, calm);
    this.updateHeart(t);
    this.updateGems(frame, t);
    this.sparks.update(dt);

    const age = t - this.builtAt;
    const swoop = !calm && frame.built && age < SWOOP ? Math.sin((Math.PI * age) / SWOOP) : 0;
    // The wall already fills the box, so the victory swoop circles and eases back a touch
    // instead of diving in: the top brick and the plinth stay in view.
    this.placeCamera(this.camera, swoop * 0.38, 1 + swoop * 0.08, swoop * 0.25);

    if (this.rectsDirty) this.sendRects();
  }

  private updateBricks(frame: WallFrame, t: number, calm: boolean) {
    const pulse = calm ? 0.7 : 0.5 + 0.5 * Math.sin(t * 4.2);
    const pair = frame.pair;
    const order = [...this.bricks].sort((a, b) => b.row - a.row || a.col - b.col);
    for (const brick of this.bricks) {
      const { block } = brick;
      // Pop in row by row when a wall goes up.
      const rise = clamp01((t - this.buildAt - brick.row * 0.12 - brick.col * 0.04) / 0.45);
      // Calm motion skips the pop: the wall is simply there.
      block.scale.setScalar(calm ? 1 : easeOutBack(rise));
      block.position.set(0, 0, 0);
      block.rotation.set(0, 0, 0);

      const dropped = this.dropAt.get(keyOf(brick));
      if (dropped !== undefined) {
        const k = (t - dropped) / 0.75;
        block.position.y = (1 - bounce(k)) * 3.4;
        // Swing in from the front, so a brick under others never falls through the wall.
        block.position.z = (1 - smooth(clamp01(k * 1.5))) * 2.4;
        const landing = dropped + 0.27;
        if (t >= landing && !brick.block.userData['puffed']) {
          brick.block.userData['puffed'] = true;
          this.sparks.dust(brick.root.position.clone().setY(brick.root.position.y - 0.45), 10);
        }
      }

      const isSelected = !!frame.selected && sameBrick(frame.selected, brick);
      if (isSelected) block.rotation.z = shake(t, this.missAt, 0.55, 0.14);
      const inPair =
        !!pair && pair.row === brick.row && (pair.col === brick.col || pair.col + 1 === brick.col);

      if (frame.built) {
        const wave = 0.5 + 0.5 * Math.sin(t * 5 - brick.row * 1.2 - brick.col * 0.6);
        brick.glowTo(GOLD_GLOW, clamp01((t - this.builtAt) * 2) * (0.25 + 0.35 * wave));
      } else if (isSelected) {
        brick.glowTo(PINK_GLOW, 0.25 + 0.45 * pulse);
        if (!calm) block.scale.multiplyScalar(1 + 0.035 * pulse);
      } else if (inPair) {
        const strength = frame.hinting ? 0.35 + 0.5 * pulse : 0.12 + 0.3 * pulse;
        brick.glowTo(PAIR_GLOW, strength);
        if (frame.hinting && !calm) block.scale.multiplyScalar(1 + 0.05 * pulse);
      } else brick.glowTo(PAIR_GLOW, 0);

      if (frame.crumbled && t > this.crumbleAt) {
        const index = order.indexOf(brick);
        const k = clamp01((t - this.crumbleAt - index * 0.13) / 0.75);
        const fall = k * k;
        const ground = BRICK.d / 2 - brick.root.position.y + 0.02;
        block.position.set((brick.col - 1) * 0.35 * k, ground * fall, (1.2 + brick.row * 0.45) * k);
        block.rotation.x = -fall * Math.PI * 0.5;
        block.rotation.z = (index % 2 ? 1 : -1) * 0.35 * fall;
        if (k >= 1 && !block.userData['landed']) {
          block.userData['landed'] = true;
          const at = brick.root.position.clone().add(block.position);
          this.sparks.dust(at, 7);
        }
      }
    }
  }

  /** One crack per bonk, painted on a brick when the club lands. */
  private updateCracks(frame: WallFrame, t: number) {
    if (frame.crumbled || t < this.bonkAt + IMPACT) return;
    while (this.cracks.length < Math.min(frame.cracks, 2) && this.bricks.length) {
      const index = this.cracks.length;
      const bottom = this.bricks.filter((brick) => brick.row === index % 2);
      const brick = bottom[bottom.length - 1 - (index % bottom.length)] ?? this.bricks[0]!;
      const crack = new Mesh(
        new PlaneGeometry(BRICK.w * 0.8, BRICK.h * 0.8),
        new MeshBasicMaterial({
          map: crackTexture(index + 3),
          transparent: true,
          depthWrite: false,
        }),
      );
      crack.position.z = BRICK.d / 2 + 0.012;
      crack.renderOrder = 3;
      brick.block.add(crack);
      this.cracks.push(crack);
      // Bits of stone fly off where the club hit.
      this.sparks.dust(
        brick.root.position.clone().add(new Vector3(BRICK.w * 0.45, -0.2, 0.6)),
        4,
        '#d9c9a8',
      );
    }
  }

  private updateTroll(frame: WallFrame, dt: number, t: number, calm: boolean) {
    const { troll } = this;
    const road = this.castle?.road;
    const progress = frame.troll;
    troll.root.rotation.set(0, 0, 0);
    troll.body.scale.set(1, 1, 1);
    for (const z of this.zzz) z.visible = false;
    if (progress === undefined || !road) {
      // Cozy: nobody is coming. He naps on the meadow beside the castle.
      const half = this.castle?.halfWidth ?? 2;
      const napX = half + 1.1;
      troll.root.position.set(napX, 0.55, -4.2);
      troll.root.rotation.set(0, -0.6, Math.PI / 2 - 0.15);
      troll.walk(0, 0);
      troll.daze(t, false);
      troll.body.scale.y = 1 + (calm ? 0 : Math.sin(t * 1.6) * 0.03);
      this.bubble.visible = false;
      this.zzz.forEach((z, index) => {
        const age = (t * 0.45 + index / 3) % 1;
        z.visible = true;
        z.position.set(napX + 0.2 + age * 0.6, 1.2 + age * 1.4, -4);
        z.scale.setScalar(0.35 + age * 0.35);
        z.material.opacity = calm ? 0.9 : 1 - age;
      });
      return;
    }

    const goingBack = progress < this.trollShown - 0.02;
    const before = this.trollShown;
    this.trollShown = goingBack
      ? approach(this.trollShown, progress, 2.2, dt)
      : approach(this.trollShown, progress, 6, dt);
    const shown = clamp01(this.trollShown);
    const point = road.getPointAt(shown);
    const tangent = road.getTangentAt(Math.min(shown, 0.999));
    troll.root.position.copy(point);
    troll.root.rotation.y = Math.atan2(tangent.x, tangent.z);

    const moved = Math.abs(this.trollShown - before) * road.getLength();
    const speed = dt > 0 ? moved / dt : 0;
    const stepping = frame.trollAsleep || frame.crumbled ? 0 : clamp01(speed / 0.25);
    this.trollPhase += moved * (goingBack ? -3.5 : 3.5);
    troll.walk(this.trollPhase, Math.max(stepping, frame.trollAsleep ? 0 : 0.15));

    // The bonk: wind the club up over his head, then bring it down on the wall.
    const bonk = t - this.bonkAt;
    if (bonk >= 0 && bonk < 0.9) {
      const raise = smooth(bonk / 0.28);
      const smash = easeOut((bonk - 0.28) / (IMPACT - 0.28));
      troll.clubArm.rotation.x = -0.4 - raise * 2.4 + smash * 1.5;
      troll.body.rotation.x = 0.1 + smash * 0.35 - clamp01((bonk - 0.6) / 0.3) * 0.35;
      troll.root.rotation.y = -Math.PI / 2 + 0.2;
    }
    troll.daze(t, (frame.trollBump && bonk > IMPACT) || (goingBack && !frame.crumbled));

    if (frame.crumbled && t > this.crumbleAt) {
      // Victory: he turns to us and hops with his club up.
      troll.root.rotation.y = -0.4;
      troll.body.position.y = calm ? 0 : Math.abs(Math.sin(t * 6)) * 0.3;
      troll.clubArm.rotation.x = -2.6 + (calm ? 0 : Math.sin(t * 6) * 0.3);
      troll.leftArm.rotation.x = -2.4;
    }

    const asleep = frame.trollAsleep;
    this.bubble.visible = asleep;
    if (asleep) {
      const grow = calm ? 1 : easeOutBack((t - this.castAt - 0.45) / 0.5);
      this.bubble.position.copy(troll.root.position).setY(1.15);
      this.bubble.scale.setScalar(Math.max(0.01, grow));
      if (!calm) this.bubble.rotation.y = t * 0.6;
      troll.walk(0, 0);
      troll.body.rotation.x = -0.1;
      troll.head.rotation.y = 0.3;
    }
  }

  private updateFairy(frame: WallFrame, dt: number, t: number, calm: boolean) {
    const trip = this.trip;
    const target = this.fairyHome.clone();
    let sprinkling = false;
    if (trip) {
      const age = t - trip.start;
      if (age < 0.5) target.lerpVectors(this.fairyHome, trip.to, smooth(age / 0.5));
      else if (age < 1.5) {
        target.copy(trip.to);
        sprinkling = true;
      } else if (age < 2.2) target.lerpVectors(trip.to, this.fairyHome, smooth((age - 1.5) / 0.7));
      else this.trip = undefined;
      this.fairyAt.copy(target);
    } else this.fairyAt.lerp(target, 1 - Math.exp(-4 * dt));
    if (frame.built && t - this.builtAt < 2.4 && !calm) {
      // A happy loop round the finished wall.
      const angle = (t - this.builtAt) * 2.6;
      this.fairyAt.set(Math.sin(angle) * 2.4, this.lookY + 1 + Math.cos(angle) * 0.5, 1.4);
    }
    const bob = calm ? 0 : Math.sin(t * 2.4) * 0.09;
    this.fairy.position.copy(this.fairyAt).setY(this.fairyAt.y + bob);
    this.fairy.material.rotation = calm ? 0 : Math.sin(t * 1.7) * 0.06;

    this.sparkleClock -= dt;
    if (this.sparkleClock > 0) return;
    const wand = this.fairy.position.clone().add(new Vector3(0.55, 0.32, 0.1));
    if (sprinkling) {
      this.sparks.sprinkle(wand, trip?.cast ? 'ice' : 'gold', 3);
      this.sparkleClock = 0.05;
    } else if (frame.combo && !calm) {
      this.sparks.sprinkle(wand, 'gold', 1);
      this.sparkleClock = 0.16;
    }
  }

  /** On impact a heart pops out of the wall and breaks in two. */
  private updateHeart(t: number) {
    const age = t - this.bonkAt - IMPACT;
    const on = age >= 0 && age < 1.4;
    const castle = this.castle;
    const origin = new Vector3((castle?.halfWidth ?? 2) - 0.6, BRICK.base + 1.7, 1.2);
    this.heart.visible = on && age < 0.45;
    if (this.heart.visible) {
      this.heart.position.copy(origin).setY(origin.y + easeOut(age / 0.45) * 0.5);
      this.heart.scale.setScalar(easeOutBack(age / 0.3) * 0.9);
    }
    this.halves.forEach((half, index) => {
      half.visible = on && age >= 0.45;
      if (!half.visible) return;
      const k = age - 0.45;
      const side = index ? 1 : -1;
      half.position.set(
        origin.x + side * (0.08 + k * 0.6),
        origin.y + 0.5 + k * 0.8 - k * k * 3,
        origin.z,
      );
      half.rotation.z = side * -k * 1.4;
      half.scale.setScalar(0.9);
      (half.material as MeshBasicMaterial).opacity = 1 - clamp01((k - 0.4) / 0.55);
    });
  }

  /** Gems fly up out of a finished wall. */
  private updateGems(frame: WallFrame, t: number) {
    const age = t - this.builtAt;
    const top = BRICK.base + frame.rows.length * BRICK.rise;
    this.gems.forEach((gem, index) => {
      const k = (age - index * 0.15) / 1.8;
      gem.visible = frame.built && k > 0 && k < 1;
      if (!gem.visible) return;
      const angle = k * 5 + index * 2.1;
      gem.position.set(
        Math.cos(angle) * 0.9 * (1 - k * 0.5),
        top + k * 3,
        0.8 + Math.sin(angle) * 0.6,
      );
      gem.rotation.y = t * 4;
      gem.scale.setScalar(easeOutBack(k * 4) * (1 - clamp01((k - 0.8) / 0.2)));
      gem.scale.y *= 1.35;
      if (Math.random() < 0.3) this.sparks.sprinkle(gem.position, 'gold', 1);
    });
  }

  /** Tells the page where every brick sits on screen, so real buttons can lie over them. */
  private sendRects() {
    this.rectsDirty = false;
    if (!this.frame || !this.castle) return;
    const probe = this.camera.clone();
    this.placeCamera(probe, 0, 1);
    probe.updateMatrixWorld();
    const bottom = this.frame.rows[0]?.length ?? 2;
    const corner = new Vector3();
    const rects: BrickRect[] = this.bricks.map((brick) => {
      const centre = brickCentre(brick.row, brick.col, bottom);
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const dx of [-0.5, 0.5])
        for (const dy of [-0.5, 0.5]) {
          corner.set(centre.x + dx * BRICK.w, centre.y + dy * BRICK.h, BRICK.d / 2).project(probe);
          minX = Math.min(minX, corner.x);
          maxX = Math.max(maxX, corner.x);
          minY = Math.min(minY, corner.y);
          maxY = Math.max(maxY, corner.y);
        }
      const round = (value: number) => Math.round(value * 100) / 100;
      return {
        build: this.build,
        row: brick.row,
        col: brick.col,
        x: round(((minX + maxX) / 2 + 1) * 50),
        y: round((1 - (minY + maxY) / 2) * 50),
        w: round((maxX - minX) * 50),
        h: round((maxY - minY) * 50),
      };
    });
    const signature = JSON.stringify(rects);
    if (signature === this.lastRects) return;
    this.lastRects = signature;
    this.host.dispatchEvent(new CustomEvent(BRICKS_EVENT, { detail: rects }));
  }

  override dispose() {
    for (const brick of this.bricks) brick.dispose();
    super.dispose();
  }
}

function keyOf(brick: BrickId): string {
  return `${brick.row}-${brick.col}`;
}

function lookOf(frame: WallFrame, brick: Brick): { look: BrickLook; text: string } {
  const has = (list: readonly BrickId[]) => list.some((id) => sameBrick(id, brick));
  const value = String(frame.rows[brick.row]?.[brick.col] ?? '');
  if (has(frame.missing) && !has(frame.filled)) {
    const selected = !!frame.selected && sameBrick(frame.selected, brick);
    return {
      look: selected ? 'selected' : 'open',
      text: selected && frame.entry ? frame.entry : '?',
    };
  }
  return {
    look: has(frame.golden) ? 'golden' : has(frame.filled) ? 'filled' : 'given',
    text: value,
  };
}

function disposeGroup(group: Group) {
  group.traverse((object) => {
    if (object instanceof Mesh) {
      object.geometry.dispose();
      (Array.isArray(object.material) ? object.material : [object.material]).forEach((m) =>
        m.dispose(),
      );
    }
  });
}
