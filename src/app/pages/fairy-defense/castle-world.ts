import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Fog,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Object3D,
  PlaneGeometry,
  Points,
  PointsMaterial,
  RingGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector3,
} from 'three';
import { TextLabel } from '../../shared/three/labels';
import { approach, clamp01, easeOut, easeOutBack, shake, smooth } from '../../shared/three/motion';
import { Stage } from '../../shared/three/stage';
import type { StateWorld } from '../../shared/three/three-stage';
import type { CastleFrame } from './castle-frame';
import {
  Billboard,
  blobShadow,
  buildBush,
  buildGate,
  buildGround,
  buildRock,
  buildShieldRing,
  buildTree,
  COLOURS,
  dustBlending,
  GEM_COLOURS,
  gemIndex,
  glowTexture,
  heartTexture,
  painting,
  Ribbon,
  shardGeometry,
  Sparks,
  starTexture,
} from './castle-models';

/** The path runs from the castle gate (front left) toward the forest (back right). */
const PATH_ANGLE = 0.4;
const GATE = { x: -4.3, z: 1.1 };
const DIRECTION = new Vector3(Math.cos(PATH_ANGLE), 0, -Math.sin(PATH_ANGLE));
/** Sideways across the path, toward the camera's side. */
const ACROSS = new Vector3(Math.sin(PATH_ANGLE), 0, Math.cos(PATH_ANGLE));
/** Distances along the path from the gate. */
/** The gate stands back from the path behind the fairy, scaled down to fit beside her. */
const GATE_S = 0.2;
const GATE_ACROSS = -1.4;
const GATE_SCALE = 0.8;
/** The top of the towers' roofs. */
const GATE_TOP = 4 * GATE_SCALE;
/** A cracking heart rises, cracks at CRACK_AT and its halves have fallen by CRACK seconds. */
const CRACK_AT = 0.45;
const CRACK = 1.5;
const FAIRY_S = 1.6;
/** The fairy hovers a little toward the camera, clear of the gate behind her. */
const FAIRY_ACROSS = 0.7;
/** Camera angles for upright and wide scenes. */
const YAW = { upright: -0.56, wide: -0.08 };
const PITCH = { upright: 0.36, wide: 0.17 };
const START_S = 6.2;
const STEP_S = [START_S, 5.1, 4.0];
/** Where a monster that gets past every stone stomps to, right at the gate. */
const RUSH_S = 2.7;
/** It charges past the fairy on the gate's side of the path, not through her. */
const RUSH_ACROSS = -0.75;
const WAIT_S = 8.6;
/** The stones on the path: one under each step, the last one just before the gate. */
const MARKER_S = [STEP_S[1], STEP_S[2], RUSH_S + 0.4];
const MONSTER_HEIGHT = 1.75;
const BOSS_HEIGHT = 2.55;
const FAIRY_HEIGHT = 1.85;
const FAIRY_LIFT = 0.75;
/**
 * A cast: the fairy winds up for WIND seconds while the gem gathers on her wand, then it flies
 * for FLIGHT seconds and lands just before the game's 550 ms decision.
 */
const WIND = 0.11;
const FLIGHT = 0.37;
/** A monster's step closer: a smug giggle first, then the walk. */
const TAUNT = 0.32;
const STEP_TIME = 0.62;
/** Metres a monster covers per footfall. */
const STRIDE = 0.5;
const RUSH_IN = 0.42;
const KNOCK_BACK = 0.7;
/** A freed creature recoils, pops up spinning and vanishes in a puff at these seconds. */
const RECOIL = 0.1;
const POP = 0.3;
const POOF = 0.42;
/** Little helper fairies that live round the towers. */
const HELPER_HEIGHT = 0.82;
/** Pixels kept clear for the HUD at the top and a little air on the other sides. */
const MARGIN = { top: 70, bottom: 6, side: 8 };

/** Writes the point `s` metres along the path (and `across` it, `y` up) into `out`. */
const alongInto = (out: Vector3, s: number, across = 0, y = 0) =>
  out.set(GATE.x, y, GATE.z).addScaledVector(DIRECTION, s).addScaledVector(ACROSS, across);
const along = (s: number, across = 0, y = 0) => alongInto(new Vector3(), s, across, y);
const GATE_SPOT = along(GATE_S, GATE_ACROSS);
const FAIRY_SPOT = along(FAIRY_S, FAIRY_ACROSS, FAIRY_LIFT);
const WAIT_SPOT = along(WAIT_S, -0.9);

const TINTS = {
  window: new Color('#ffc65a'),
  alarm: new Color('#ff5a6e'),
  gold: new Color('#fff1a8'),
  dark: new Color('#4c4560'),
  marker: new Color('#ffd23f'),
  markerLight: new Color('#ffcf4d'),
  danger: new Color('#ff3d5e'),
  white: new Color('#ffffff'),
  dusk: new Color('#8f93b8'),
  sky: new Color('#bfe3f5'),
  duskSky: new Color('#8e98b8'),
  spark: new Color('#fff3a0'),
  dust: new Color('#efe2c4'),
  puff: new Color('#fff4fb'),
  puffPink: new Color('#ffd2e6'),
  heart: new Color('#ff5c9a'),
  gem: new Color('#ffe27a'),
  fizzle: new Color('#cfd3dc'),
};

interface Butterfly {
  readonly art: Billboard;
  readonly from: Vector3;
  born: number;
  /** Which way it drifts off, so two in a row do not overlap. */
  side: number;
}
interface Shard {
  readonly mesh: Mesh;
  readonly velocity: Vector3;
  readonly spin: Vector3;
  born: number;
}
interface Helper {
  readonly art: Billboard;
  readonly seed: number;
  readonly at: Vector3;
  readonly last: Vector3;
  /** 1 facing right as painted, -1 turned round; eases between for a turn. */
  facing: number;
}
interface Petal {
  readonly p: Vector3;
  readonly v: Vector3;
  /** The breeze it settles back into after a burst. */
  readonly drift: Vector3;
  readonly spin: number;
  readonly phase: number;
}

export class CastleWorld extends Stage implements StateWorld<CastleFrame> {
  private frame?: CastleFrame;
  /** The world's own clock: it stops while the game is paused. */
  private now = 0;
  private readonly glow = glowTexture();
  private readonly star = starTexture();
  private readonly target = new Vector3();
  private distance = 12;
  private yaw = 0;
  private pitch = 0.2;
  /** Upright screens draw the monster's badge bigger, since the whole scene is drawn smaller. */
  private badgeSize = 1;
  private readonly backdrop: Mesh<PlaneGeometry, MeshBasicMaterial>;
  private readonly gate: Group;
  private readonly flags: Mesh[] = [];
  private flagRest?: Float32Array;
  private windowLight?: MeshBasicMaterial;
  private readonly fairy = new Billboard('fairy', FAIRY_HEIGHT);
  private readonly fairyShadow: Mesh;
  private readonly halo: Sprite;
  /** A warm light that swells round the castle when a wave is won. */
  private readonly shine: Sprite;
  private readonly helpers: Helper[] = [];
  private readonly monster = new Billboard('monster-red', MONSTER_HEIGHT);
  private readonly monsterGroup = new Group();
  private readonly monsterShadow: Mesh;
  private readonly waiting = new Billboard('monster-blue', MONSTER_HEIGHT * 0.8);
  private readonly waitingShadow: Mesh;
  private readonly badgeLabel = new TextLabel('?', {
    fill: '#fffdf5',
    border: '#d8a84a',
    width: 200,
    height: 160,
    radius: 0.28,
  });
  private readonly badge: Sprite;
  private readonly gem: Sprite;
  private readonly gemGlow: Sprite;
  private readonly trail = new Ribbon(20, 0.46);
  private readonly flash: Sprite;
  private readonly shockwave: Mesh<RingGeometry, MeshBasicMaterial>;
  private readonly heart: Sprite;
  private cracked = true;
  private readonly halves: Sprite[] = [];
  private readonly heartTextures = {
    full: heartTexture('full'),
    left: heartTexture('left'),
    right: heartTexture('right'),
  };
  private readonly markers: { top: Mesh<IcosahedronGeometry, MeshBasicMaterial>; light: Sprite }[] =
    [];
  private readonly rings: Mesh[] = [];
  private readonly ripple: Mesh<TorusGeometry, MeshBasicMaterial>;
  private readonly sparks: Sparks;
  private readonly stars: Sparks;
  private readonly glows: Sparks;
  private readonly dust: Sparks;
  private readonly puffs: Sparks;
  private readonly fireflies: Points<BufferGeometry, PointsMaterial>;
  private readonly fireflySpots: Vector3[] = [];
  private readonly fireflySeeds: number[] = [];
  private readonly petals: InstancedMesh;
  private readonly petalState: Petal[] = [];
  private readonly butterflies: Butterfly[] = [];
  private readonly shards: Shard[] = [];
  private readonly dummy = new Object3D();
  // Scratch space, so nothing is allocated per frame.
  private readonly scratch = new Vector3();
  private readonly point = new Vector3();
  private readonly spot = new Vector3();
  private readonly chestAt = new Vector3();
  private readonly tip = new Vector3();
  private readonly cameraRight = new Vector3();
  private readonly colour = new Color();
  private readonly tint = new Color();

  // Where things are and when each reaction started (world clock seconds; -99 = never).
  private monsterS = START_S;
  private stepFrom = START_S;
  private stepAt = -99;
  private castAt = -99;
  private readonly castFrom = new Vector3();
  private readonly castColour = new Color();
  private released = false;
  private landed = true;
  private impactAt = -99;
  private readonly impactSpot = new Vector3();
  private burstAt = -99;
  private readonly burstSpot = new Vector3();
  private bounceAt = -99;
  private readonly bounceFrom = new Vector3();
  private wrongAt = -99;
  private rightAt = -99;
  private poofedAt = -99;
  private rushAt = -99;
  private rushStay = false;
  private walkInAt = -99;
  private crackAt = -99;
  private cheerAt = -99;
  private shieldAt = -99;
  private winAt = -99;
  private dustAt = -99;
  private nextFirework = 0;
  private shieldsBroken = 0;
  private gone = false;
  // The walk cycle: metres walked, the last footfall and how much the creature is walking now.
  private lastS = START_S;
  private travel = 0;
  private footfall = 0;
  private walking = 0;
  private danceBeat = -1;
  // Moods that ease in and out: a monster near the gate, a wave lost, a wave won.
  private alarm = 0;
  private dim = 0;
  private joy = 0;

  constructor(canvas: HTMLCanvasElement, host: HTMLElement) {
    super(canvas, host, { shadows: true, fov: 40, background: '#bfe3f5' });
    const { scene, sun } = this;
    scene.fog = new Fog(COLOURS.fog, 26, 60);
    sun.position.set(5, 12, 9);
    sun.intensity = 2.1;
    sun.shadow.camera.left = -12;
    sun.shadow.camera.right = 12;
    sun.shadow.camera.top = 10;
    sun.shadow.camera.bottom = -10;
    sun.shadow.bias = -0.002;
    this.fill.intensity = 1.5;

    // The painted forest, mountains and castle far behind everything.
    this.backdrop = new Mesh(
      new PlaneGeometry(1, 1),
      new MeshBasicMaterial({ fog: false, depthWrite: false, visible: false }),
    );
    this.backdrop.renderOrder = -10;
    void painting('forest').then((texture) => {
      // Only the part above the painted path: the 3D path takes over from there.
      const crop = texture.clone();
      crop.repeat.set(1, 0.33);
      crop.offset.set(0, 1 - 0.33 - 0.0);
      this.backdrop.material.map = crop;
      this.backdrop.material.visible = true;
      this.backdrop.material.needsUpdate = true;
      this.layoutBackdrop();
    });
    scene.add(this.backdrop);

    scene.add(buildGround(26, PATH_ANGLE, along(-1.2)));
    this.gate = buildGate();
    this.gate.position.copy(GATE_SPOT);
    this.gate.scale.setScalar(GATE_SCALE);
    // Its arch faces the path, turned a little toward the camera.
    this.gate.rotation.y = Math.PI / 2 + PATH_ANGLE - 0.75;
    for (const child of this.gate.children) {
      if (!(child instanceof Mesh)) continue;
      if (child.name === 'flag') this.flags.push(child);
      if (child.name === 'window') this.windowLight = child.material as MeshBasicMaterial;
    }
    const flagGeometry = this.flags[0]?.geometry as BufferGeometry | undefined;
    if (flagGeometry)
      this.flagRest = flagGeometry.getAttribute('position').array.slice() as Float32Array;
    scene.add(this.gate);
    this.dress();

    // Three crystal posts along the path's edge mark the monster's steps toward the gate.
    const post = new CylinderGeometry(0.08, 0.12, 0.45, 6);
    const stoneMaterial = new MeshLambertMaterial({ color: COLOURS.stone, flatShading: true });
    const gemShape = new IcosahedronGeometry(0.14, 0);
    for (const s of MARKER_S) {
      const base = along(s, 1.45);
      const pillar = new Mesh(post, stoneMaterial);
      pillar.position.copy(base).setY(0.22);
      pillar.castShadow = true;
      const top = new Mesh(gemShape, new MeshBasicMaterial({ color: '#ffd23f' }));
      top.position.copy(base).setY(0.6);
      top.scale.set(1, 1.4, 1);
      const light = new Sprite(
        new SpriteMaterial({
          map: this.glow,
          color: '#ffcf4d',
          blending: AdditiveBlending,
          transparent: true,
          depthWrite: false,
        }),
      );
      light.position.copy(top.position);
      light.scale.setScalar(0.8);
      this.markers.push({ top, light });
      scene.add(pillar, top, light);
    }

    this.fairyShadow = blobShadow(this.glow, 1.3);
    this.fairyShadow.position.copy(along(FAIRY_S, FAIRY_ACROSS, 0.02));
    this.halo = new Sprite(
      new SpriteMaterial({
        map: this.glow,
        color: '#ffe27a',
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
        opacity: 0,
      }),
    );
    this.halo.scale.setScalar(2.6);
    scene.add(this.fairy.mesh, this.fairyShadow, this.halo);
    this.shine = new Sprite(
      new SpriteMaterial({
        map: this.glow,
        color: '#ffd76a',
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
        opacity: 0,
      }),
    );
    this.shine.position.copy(GATE_SPOT).setY(GATE_TOP * 0.55);
    this.shine.scale.setScalar(7);
    this.shine.visible = false;
    scene.add(this.shine);

    // Two little fairies keep the towers company.
    for (let index = 0; index < 2; index++) {
      const art = new Billboard('fairy', HELPER_HEIGHT);
      const at = GATE_SPOT.clone().setY(GATE_TOP * 0.7);
      this.helpers.push({ art, seed: index * 2.6, at, last: at.clone(), facing: 1 });
      scene.add(art.mesh);
    }

    this.monster.mesh.material.depthWrite = true;
    this.monster.mesh.material.alphaTest = 0.35;
    this.monsterShadow = blobShadow(this.glow, 1.7);
    this.monsterGroup.add(this.monster.mesh);
    scene.add(this.monsterGroup, this.monsterShadow);
    this.waiting.mesh.material.color.set('#d9e6dd');
    this.waitingShadow = blobShadow(this.glow, 1.2);
    this.waitingShadow.position.copy(WAIT_SPOT).setY(0.02);
    scene.add(this.waiting.mesh, this.waitingShadow);

    this.badge = new Sprite(
      new SpriteMaterial({ map: this.badgeLabel.texture, depthTest: false, transparent: true }),
    );
    this.badge.scale.set(0.62, 0.5, 1);
    this.badge.renderOrder = 20;
    scene.add(this.badge);

    // The cast gem: the same crystal painting the buttons use, cropped to one gem.
    this.gem = new Sprite(new SpriteMaterial({ transparent: true, depthWrite: false }));
    this.gem.scale.set(0.62, 0.78, 1);
    this.gem.renderOrder = 12;
    this.gem.visible = false;
    void painting('crystals').then((texture) => {
      this.gem.material.map = texture.clone();
      this.gem.material.needsUpdate = true;
      this.wearGem(this.frame?.spell ?? 1);
    });
    this.gemGlow = new Sprite(
      new SpriteMaterial({
        map: this.glow,
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    );
    this.gemGlow.scale.setScalar(1.3);
    this.gemGlow.renderOrder = 11;
    this.gemGlow.visible = false;
    scene.add(this.gem, this.gemGlow, this.trail.mesh);

    // Where a spell lands: a bright flash and a ring of light rushing outward.
    this.flash = new Sprite(
      new SpriteMaterial({
        map: this.glow,
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
        depthTest: false,
      }),
    );
    this.flash.renderOrder = 13;
    this.flash.visible = false;
    this.shockwave = new Mesh(
      new RingGeometry(0.8, 1, 48),
      new MeshBasicMaterial({
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
      }),
    );
    this.shockwave.renderOrder = 13;
    this.shockwave.visible = false;
    scene.add(this.flash, this.shockwave);

    // The heart that cracks when a monster reaches the gate.
    this.heart = new Sprite(
      new SpriteMaterial({ map: this.heartTextures.full, transparent: true, depthTest: false }),
    );
    this.heart.renderOrder = 15;
    this.heart.visible = false;
    scene.add(this.heart);
    for (const side of ['left', 'right'] as const) {
      const half = new Sprite(
        new SpriteMaterial({ map: this.heartTextures[side], transparent: true, depthTest: false }),
      );
      half.scale.setScalar(0.8);
      half.renderOrder = 15;
      half.visible = false;
      this.halves.push(half);
      scene.add(half);
    }
    this.ripple = new Mesh(
      new TorusGeometry(1, 0.06, 6, 40),
      new MeshBasicMaterial({
        color: '#ff5c9a',
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.ripple.visible = false;
    scene.add(this.ripple);

    this.sparks = new Sparks(300, 0.16, this.glow);
    this.stars = new Sparks(140, 0.55, this.star);
    this.glows = new Sparks(60, 0.55, this.glow);
    this.dust = new Sparks(100, 0.5, this.glow, dustBlending);
    this.puffs = new Sparks(48, 1.5, this.glow, dustBlending);
    scene.add(
      this.sparks.points,
      this.stars.points,
      this.glows.points,
      this.dust.points,
      this.puffs.points,
    );

    // Fireflies hang in the light and drift; petals tumble across.
    const flies = 22;
    const flyGeometry = new BufferGeometry();
    flyGeometry.setAttribute('position', new BufferAttribute(new Float32Array(flies * 3), 3));
    flyGeometry.setAttribute('color', new BufferAttribute(new Float32Array(flies * 4), 4));
    this.fireflies = new Points(
      flyGeometry,
      new PointsMaterial({
        size: 0.2,
        map: this.glow,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    this.fireflies.frustumCulled = false;
    for (let i = 0; i < flies; i++) {
      const seed = i * 1.618;
      this.fireflySeeds.push(seed);
      this.fireflySpots.push(
        along(-1 + ((seed * 7.1) % 11), -2.6 + ((seed * 3.3) % 5.5), 0.5 + ((seed * 1.9) % 3)),
      );
    }
    scene.add(this.fireflies);
    const petalGeometry = new PlaneGeometry(0.11, 0.07);
    this.petals = new InstancedMesh(
      petalGeometry,
      new MeshLambertMaterial({ color: '#ffffff', side: DoubleSide }),
      24,
    );
    const petalTints = ['#ffb3cf', '#ffb3cf', '#ffd6e6', '#fff1b0', '#d9c2ff'];
    for (let i = 0; i < 24; i++) {
      const drift = new Vector3(0.35 + (i % 3) * 0.1, -0.12 - (i % 4) * 0.03, 0.05);
      this.petalState.push({
        p: new Vector3(-7 + ((i * 7.3) % 15), 0.5 + ((i * 1.37) % 4), -4 + ((i * 3.1) % 7)),
        v: drift.clone(),
        drift,
        spin: 1 + (i % 5) * 0.6,
        phase: i,
      });
      this.petals.setColorAt(i, this.colour.set(petalTints[i % petalTints.length]));
    }
    this.petals.frustumCulled = false;
    scene.add(this.petals);

    const geometry = shardGeometry();
    const crystal = [
      new MeshBasicMaterial({ color: '#c9a2ff' }),
      new MeshBasicMaterial({ color: '#9fd6f2' }),
    ];
    for (let i = 0; i < 36; i++) {
      const mesh = new Mesh(geometry, crystal[i % 2]);
      mesh.visible = false;
      this.shards.push({ mesh, velocity: new Vector3(), spin: new Vector3(), born: -99 });
      scene.add(mesh);
    }
  }

  setState(next: CastleFrame) {
    const previous = this.frame;
    this.frame = next;
    if (!previous) return this.sync(next);
    if (next.boss !== previous.boss) this.layout(this.camera.aspect);
    if (next.boss !== previous.boss || next.encounters !== previous.encounters) this.sync(next);
    const turnChanged = next.turn !== previous.turn;
    const newWave =
      next.turn.split(':')[0] !== previous.turn.split(':')[0] ||
      (next.encounter === 0 && previous.encounter !== 0) ||
      (next.started && !previous.started) ||
      (next.hearts > previous.hearts && next.phase !== 'complete');
    if (newWave) return this.sync(next);
    if (next.encounter === previous.encounter + 1) this.walkIn(next);
    if (next.phase === previous.phase && !turnChanged) return;
    if (next.phase === 'casting') this.cast(next);
    else if (next.phase === 'transforming') this.right(next);
    else if (next.phase === 'wrong' || next.phase === 'lost') this.mistake(next, previous);
    else if (next.phase === 'complete') this.celebrate();
  }

  /** Jumps to a state without replaying anything: a new world, a new wave, a restart. */
  private sync(frame: CastleFrame) {
    this.monster.wear(frame.appearance);
    this.monster.resize(frame.boss ? BOSS_HEIGHT : MONSTER_HEIGHT);
    if (frame.waiting) this.waiting.wear(frame.waiting);
    this.monsterS = STEP_S[Math.min(frame.approach, 2)];
    this.stepAt = this.castAt = this.wrongAt = this.rightAt = this.rushAt = -99;
    this.walkInAt = this.crackAt = this.cheerAt = this.shieldAt = this.winAt = -99;
    this.impactAt = this.bounceAt = this.poofedAt = this.burstAt = -99;
    this.gone = frame.phase === 'complete';
    this.rushStay = frame.phase === 'lost';
    if (this.rushStay) this.monsterS = RUSH_S;
    this.lastS = this.monsterS;
    this.walking = 0;
    this.dim = frame.phase === 'lost' ? 1 : 0;
    this.joy = frame.phase === 'complete' ? 1 : 0;
    this.shieldsBroken = frame.encounter + (frame.phase === 'transforming' ? 1 : 0);
    this.landed = true;
    this.gem.visible = this.gemGlow.visible = this.trail.mesh.visible = false;
    for (const butterfly of this.butterflies) butterfly.born = -99;
    this.buildRings(frame);
  }

  private buildRings(frame: CastleFrame) {
    for (const ring of this.rings) {
      this.monsterGroup.remove(ring);
      ring.geometry.dispose();
      (ring.material as MeshBasicMaterial).dispose();
    }
    this.rings.length = 0;
    if (!frame.boss) return;
    for (let index = 0; index < frame.encounters; index++) {
      const ring = buildShieldRing(1.05 + index * 0.1, index);
      ring.position.y = 0.45 + (index * (BOSS_HEIGHT - 0.9)) / Math.max(1, frame.encounters - 1);
      ring.rotation.set(0.28 * Math.sin(index * 2.1), 0, 0.22 * Math.cos(index * 1.7));
      ring.renderOrder = 5;
      ring.visible = index >= this.shieldsBroken;
      this.rings.push(ring);
      this.monsterGroup.add(ring);
    }
  }

  private wearGem(spell: number) {
    const map = this.gem.material.map;
    if (!map) return;
    // crystals.webp: five gems in equal columns, opaque between rows 73 and 634 of 724.
    map.repeat.set(0.2 * 0.92, (634 - 73) / 724);
    map.offset.set(gemIndex(spell) * 0.2 + 0.2 * 0.04, 1 - 634 / 724);
    this.castColour.set(GEM_COLOURS[gemIndex(spell)]);
    this.gemGlow.material.color.copy(this.castColour);
  }

  private cast(frame: CastleFrame) {
    this.wearGem(frame.spell ?? 1);
    this.castAt = this.now;
    this.released = false;
    this.landed = false;
    this.bounceAt = -99;
    this.gem.material.opacity = 1;
    this.gem.visible = this.gemGlow.visible = true;
  }

  private right(frame: CastleFrame) {
    this.rightAt = this.cheerAt = this.now;
    const shieldOnly = frame.boss && frame.encounter < frame.encounters - 1;
    const chest = this.chest();
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2;
      const lift = Math.random() * 2 - 0.4;
      this.colour.set(i % 3 ? '#fff3a0' : GEM_COLOURS[i % 5]);
      this.sparks.emit(
        chest.x,
        chest.y,
        chest.z,
        Math.cos(a) * (2 + Math.random() * 2),
        lift * 2.2,
        Math.sin(a) * (1 + Math.random()),
        this.colour,
        0.9 + Math.random() * 0.6,
        2.5,
      );
    }
    this.glows.emit(chest.x, chest.y, chest.z, 0, 0.2, 0, TINTS.white, 0.45);
    // The big hit: a white flash and a ring of light rushing out from the creature.
    this.burstAt = this.now;
    this.burstSpot.copy(chest);
    if (shieldOnly) {
      this.shieldAt = this.now;
      this.shatter(this.shieldsBroken);
      this.shieldsBroken++;
      return;
    }
    if (frame.boss) this.shatter(this.shieldsBroken);
    this.shieldsBroken = frame.encounters;
    // The creature turns into a butterfly that flutters out of the puff, over the trees.
    const free = this.butterflies.find((b) => this.now - b.born > 2.6);
    const art = free?.art ?? new Billboard('butterfly', 1);
    if (!free) this.scene.add(art.mesh);
    const butterfly: Butterfly = free ?? { art, from: new Vector3(), born: 0, side: 1 };
    butterfly.from.copy(chest);
    butterfly.born = this.now + POOF - 0.04;
    butterfly.side = this.butterflies.length % 2 ? -1 : 1;
    if (!free) this.butterflies.push(butterfly);
  }

  private shatter(index: number) {
    const ring = this.rings[index];
    if (!ring) return;
    ring.visible = false;
    ring.getWorldPosition(this.scratch);
    let used = 0;
    for (const shard of this.shards) {
      if (used >= 12 || this.now - shard.born < 1.2) continue;
      const a = (used / 12) * Math.PI * 2;
      shard.born = this.now;
      shard.mesh.position.set(
        this.scratch.x + Math.cos(a) * 1.05,
        this.scratch.y,
        this.scratch.z + Math.sin(a) * 1.05,
      );
      shard.velocity.set(Math.cos(a) * 2.6, 1.6 + Math.random() * 2, Math.sin(a) * 2.6);
      shard.spin.set(Math.random() * 9, Math.random() * 9, Math.random() * 9);
      used++;
    }
  }

  private mistake(frame: CastleFrame, previous: CastleFrame) {
    this.wrongAt = this.now;
    // A spell that was cast glances off and tumbles away; a run-out ring has no gem.
    if (previous.phase === 'casting') {
      this.landed = true;
      this.bounceAt = this.now;
      this.bounceFrom.copy(this.chest());
      const chest = this.bounceFrom;
      // A grey puff where it bounced: no flash, no burst.
      for (let i = 0; i < 6; i++)
        this.puffs.emit(
          chest.x,
          chest.y,
          chest.z,
          (Math.random() - 0.5) * 0.8,
          0.3 + Math.random() * 0.4,
          0,
          TINTS.fizzle,
          0.5,
          -0.3,
          0.5,
        );
      for (let i = 0; i < 12; i++) {
        this.sparks.emit(
          chest.x - 0.3,
          chest.y,
          chest.z,
          -1 - Math.random() * 2,
          1 + Math.random() * 2,
          (Math.random() - 0.5) * 2,
          this.castColour,
          0.7,
          6,
        );
      }
    }
    if (frame.damaged || frame.phase === 'lost') {
      // Past the last stone: it stomps right up to the gate and a heart cracks.
      this.rushAt = this.now + 0.25;
      this.rushStay = frame.phase === 'lost';
      this.stepFrom = this.monsterS;
      this.crackAt = this.rushAt + RUSH_IN;
      this.cracked = false;
      this.danceBeat = -1;
      return;
    }
    if (frame.approach > previous.approach) {
      this.stepFrom = this.monsterS;
      this.stepAt = this.now + TAUNT;
    }
  }

  private walkIn(frame: CastleFrame) {
    // The boss stays put behind what is left of his shield.
    if (!frame.boss) {
      this.walkInAt = this.now + 0.1;
      this.monster.wear(frame.appearance);
      if (frame.waiting) this.waiting.wear(frame.waiting);
      this.lastS = WAIT_S;
    }
    this.monsterS = START_S;
    this.stepAt = this.wrongAt = -99;
    this.rushStay = false;
  }

  /** The wave is won: the castle lights up gold and throws confetti. */
  private celebrate() {
    this.winAt = this.now;
    this.nextFirework = this.now + 0.25;
    const top = this.spot.copy(GATE_SPOT).setY(GATE_TOP);
    this.ripple.material.color.set('#ffd23f');
    this.ripple.visible = true;
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      const speed = 2.2 + (i % 3) * 0.6;
      this.colour.set(i % 2 ? '#ffe27a' : GEM_COLOURS[i % 5]);
      this.stars.emit(
        top.x,
        top.y,
        top.z,
        Math.cos(a) * speed,
        2 + Math.sin(a) * speed,
        Math.sin(a) * 1.2,
        this.colour,
        1.6,
        2.2,
      );
    }
    this.colour.set('#ffe27a');
    this.glows.emit(top.x, top.y, top.z, 0, 0, 0, this.colour, 0.6);
    this.glows.emit(top.x, top.y, top.z, 0, 0.3, 0, TINTS.white, 0.4);
    if (this.calm) return;
    // Petals burst up out of the towers like confetti and drift back into the breeze.
    for (const [index, petal] of this.petalState.entries()) {
      const a = index * 2.4;
      petal.p.copy(top).add(this.scratch.set(Math.cos(a) * 0.6, Math.random() * 0.4, 0));
      petal.v.set(Math.cos(a) * (1.5 + Math.random() * 2), 3 + Math.random() * 2.5, Math.sin(a));
    }
  }

  /** Where the fairy's star wand is, in the world. */
  private wandTip(): Vector3 {
    // The star sits 87% across and 78% up the fairy's painted figure.
    const mesh = this.fairy.mesh;
    mesh.updateMatrixWorld();
    return mesh.localToWorld(this.tip.set(0.37, 0.78, 0.02));
  }

  private chest(): Vector3 {
    const height = this.monster.height;
    return this.chestAt.copy(this.monsterGroup.position).setY(height * 0.48);
  }

  // ---- Framing ----

  protected override layout(aspect: number) {
    const camera = this.camera;
    camera.aspect = aspect;
    const wide = smooth((aspect - 0.9) / 1.3);
    this.yaw = MathUtils.lerp(YAW.upright, YAW.wide, wide);
    this.pitch = MathUtils.lerp(PITCH.upright, PITCH.wide, wide);
    this.badgeSize = MathUtils.lerp(1.5, 1, wide);
    // On an upright screen the width decides the size and leaves spare height. The characters
    // sit low in it, so the spare room is painted sky above them, not empty grass in front.
    const lift = 0.35 * (1 - wide);
    const points = this.keyPoints();
    // The room left between the HUD and the edges, in normalised device units.
    const roomWidth = 2 - (4 * MARGIN.side) / this.width;
    const roomHeight = 2 - (2 * (MARGIN.top + MARGIN.bottom)) / this.height;
    const middleY = (MARGIN.bottom - MARGIN.top) / this.height;
    this.target.set(0, 0, 0);
    for (const point of points) this.target.add(point);
    this.target.multiplyScalar(1 / points.length);
    const right = new Vector3();
    const up = new Vector3();
    // Find the closest camera that fits every key point, centre them, and repeat once the
    // centring has shifted the perspective a little.
    for (let pass = 0; pass < 3; pass++) {
      let near = 2;
      let far = 60;
      for (let step = 0; step < 20; step++) {
        const distance = (near + far) / 2;
        this.place(distance, 0);
        const box = this.screenBox(points);
        if (box.width <= roomWidth && box.height <= roomHeight) far = distance;
        else near = distance;
      }
      this.distance = far;
      this.place(far, 0);
      const box = this.screenBox(points);
      const low = Math.min(lift, Math.max(0, (roomHeight - box.height) / 2));
      const halfHeight = far * Math.tan(MathUtils.degToRad(camera.fov / 2));
      right.setFromMatrixColumn(camera.matrixWorld, 0);
      up.setFromMatrixColumn(camera.matrixWorld, 1);
      this.target
        .addScaledVector(right, box.x * halfHeight * aspect)
        .addScaledVector(up, (box.y - middleY + low) * halfHeight);
    }
    this.place(this.distance, 0);
    this.layoutBackdrop();
  }

  /** The gate, the fairy and the monster: what every screen shape must show. */
  private keyPoints(): Vector3[] {
    const height = this.frame?.boss ? BOSS_HEIGHT : MONSTER_HEIGHT;
    // Paintings face the camera, so their width runs along the camera's right.
    const right = new Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const fairy = FAIRY_SPOT.clone();
    const monster = along(START_S);
    const gate = GATE_SPOT.clone();
    const reach = this.frame?.boss ? 1.25 : 1.0;
    const head = height + 0.3 + 0.25 * this.badgeSize;
    return [
      fairy
        .clone()
        .addScaledVector(right, -1.05)
        .setY(FAIRY_LIFT + FAIRY_HEIGHT * 0.95),
      fairy.clone().addScaledVector(right, -1.05).setY(0),
      monster.clone().addScaledVector(right, reach),
      monster.clone().addScaledVector(right, reach).setY(head),
      monster.clone().addScaledVector(right, -reach).setY(head),
      // Wide screens show the whole gate.
      ...(this.camera.aspect > 1.4
        ? [
            gate.clone().add(new Vector3(-1.3, 0, 0)),
            gate.clone().add(new Vector3(-1.3, GATE_TOP, 0)),
            gate.clone().setY(GATE_TOP + 0.9),
          ]
        : // Upright ones may crop its far tower, but not the spot where a heart cracks.
          [
            gate.clone().setY(GATE_TOP + 0.9),
            gate
              .clone()
              .addScaledVector(right, -0.5)
              .setY(GATE_TOP * 0.5),
          ]),
    ];
  }

  /** Centre and size of the points' bounding box on screen, in normalised device units. */
  private screenBox(points: readonly Vector3[]) {
    let left = Infinity;
    let right = -Infinity;
    let bottom = Infinity;
    let top = -Infinity;
    for (const point of points) {
      const p = this.scratch.copy(point).project(this.camera);
      left = Math.min(left, p.x);
      right = Math.max(right, p.x);
      bottom = Math.min(bottom, p.y);
      top = Math.max(top, p.y);
    }
    return {
      x: (left + right) / 2,
      y: (top + bottom) / 2,
      width: right - left,
      height: top - bottom,
    };
  }

  /** Puts the camera `distance` from the target along the framing angles, plus a drift. */
  private place(distance: number, drift: number) {
    const yaw = this.yaw + drift * 0.035;
    const pitch = this.pitch + drift * 0.01;
    this.camera.position.set(
      this.target.x + Math.sin(yaw) * Math.cos(pitch) * distance,
      this.target.y + Math.sin(pitch) * distance,
      this.target.z + Math.cos(yaw) * Math.cos(pitch) * distance,
    );
    this.camera.lookAt(this.target);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
  }

  /** Stands the painting far behind, upright, filling the view above the path. */
  private layoutBackdrop() {
    const behind = 24;
    const centre = this.target
      .clone()
      .add(new Vector3(-Math.sin(this.yaw) * behind, 0, -Math.cos(this.yaw) * behind));
    const depth = this.distance + behind;
    const tan = Math.tan(MathUtils.degToRad(this.camera.fov / 2));
    const viewHeight = 2 * depth * tan;
    const viewWidth = viewHeight * this.camera.aspect;
    // The cropped painting is 1536 x (0.67 * 1024); cover the view with room for drift.
    const cropAspect = 1536 / (1024 * 0.67);
    const width = Math.max(viewWidth * 1.15, viewHeight * 0.9 * cropAspect);
    const height = width / cropAspect;
    this.backdrop.scale.set(width, height, 1);
    // Its bottom edge, where the painted grass meets the path, sits on the ground.
    this.backdrop.position.set(centre.x, height / 2 - 0.4, centre.z);
    this.backdrop.rotation.y = this.yaw;
    const map = this.backdrop.material.map;
    if (map) {
      map.repeat.set(1, 0.67);
      map.offset.set(0, 1 - 0.67);
    }
  }

  // ---- Frame loop ----

  protected override update(dt: number, t: number) {
    const frame = this.frame;
    if (!frame) return;
    const calm = this.calm;
    const step = frame.paused ? 0 : dt;
    this.now += step;
    const now = this.now;

    // Moods: the castle grows uneasy as a monster nears, dims when the wave is lost and shines
    // when it is won.
    const danger =
      frame.started && frame.phase !== 'complete'
        ? clamp01((START_S - this.monsterS) / (START_S - RUSH_S))
        : 0;
    this.alarm = approach(this.alarm, danger, 4, step);
    const lost = frame.phase === 'lost' && now - this.crackAt > CRACK_AT;
    this.dim = approach(this.dim, lost ? 1 : 0, 1.8, step);
    this.joy = approach(this.joy, frame.phase === 'complete' ? 1 : 0, 2.5, step);

    // Camera: a slow drift for parallax, and a shake when something hits (never when calm).
    const drift = calm || frame.paused ? 0 : Math.sin(t * 0.21) * 1.0 + Math.sin(t * 0.13) * 0.5;
    this.place(this.distance, drift);
    if (!calm) {
      const hit =
        shake(now, this.crackAt, 0.55, 0.16) +
        shake(now, this.stepAt + STEP_TIME, 0.3, 0.05) +
        shake(now, this.impactAt, 0.22, 0.03) +
        shake(now, this.burstAt, 0.4, this.shieldAt === this.burstAt ? 0.12 : 0.09);
      if (hit) {
        this.camera.position.x += hit;
        this.camera.position.y += hit * 0.5;
      }
    }
    this.cameraRight.setFromMatrixColumn(this.camera.matrixWorld, 0);
    const faceYaw = Math.atan2(
      this.camera.position.x - this.target.x,
      this.camera.position.z - this.target.z,
    );

    this.updateFairy(frame, now, t, calm, faceYaw);
    this.updateMonster(frame, now, t, step, calm, faceYaw);
    this.updateGem(now, calm);
    this.updateImpact(now);
    this.updateHearts(now);
    this.updateCastle(t, calm);
    this.updateHelpers(frame, now, t, step, calm, faceYaw);
    this.updateButterflies(now, faceYaw);
    this.updateShards(now, step);
    this.updateAmbient(step, t, calm);
    // Glitter drifts down over the castle and the fairy while the wave is won.
    if (this.joy > 0.5 && !calm && !frame.paused && Math.random() < 0.6) {
      const at = alongInto(
        this.spot,
        -0.5 + Math.random() * 4,
        -2 + Math.random() * 3,
        GATE_TOP + 0.6 + Math.random(),
      );
      this.colour.set(GEM_COLOURS[Math.floor(Math.random() * GEM_COLOURS.length)]);
      this.stars.emit(at.x, at.y, at.z, 0, -0.4, 0, this.colour, 2.2, 0.4, 0.9);
    }
    if (frame.phase === 'complete' && now >= this.nextFirework && !frame.paused) {
      this.firework();
      this.nextFirework = now + (calm ? 2.4 : 0.7);
    }
    this.sparks.update(step);
    this.stars.update(step);
    this.glows.update(step);
    this.dust.update(step);
    this.puffs.update(step);
  }

  private updateFairy(frame: CastleFrame, now: number, t: number, calm: boolean, yaw: number) {
    const mesh = this.fairy.mesh;
    const alarm = this.alarm;
    const bob = calm ? 0 : Math.sin(t * (1.7 + alarm * 1.8)) * (0.09 - alarm * 0.03);
    // The cast: she draws the wand back, then flings it forward and overshoots a little.
    const castAge = now - this.castAt;
    let reach = 0;
    let lift = 0;
    let lean = 0;
    if (castAge >= 0 && castAge < WIND) {
      const k = smooth(castAge / WIND);
      reach = -0.24 * k;
      lift = 0.12 * k;
      lean = 0.16 * k;
    } else if (castAge >= WIND && castAge < WIND + 0.55) {
      const j = castAge - WIND;
      const snap = easeOut(j / 0.12);
      const settle = 1 - smooth((j - 0.12) / 0.43);
      reach = j < 0.12 ? MathUtils.lerp(-0.24, 0.32, snap) : 0.32 * settle;
      lean = j < 0.12 ? MathUtils.lerp(0.16, -0.18, snap) : -0.18 * settle;
      lift = 0.12 * (1 - smooth(j / 0.2));
    }
    // A right answer: a happy hop and a twirl. A wrong one: a flinch.
    const cheerAge = now - this.cheerAt;
    const cheer =
      cheerAge >= 0 && cheerAge < 1.1 ? Math.abs(Math.sin((cheerAge / 1.1) * Math.PI * 2)) : 0;
    const flinchAge = now - this.wrongAt;
    const flinch = flinchAge >= 0 && flinchAge < 0.5 ? Math.sin((flinchAge / 0.5) * Math.PI) : 0;
    // Twirls: one after a rescue, one when the wave is won.
    let twirl = 0;
    if (!calm && cheerAge >= 0.15 && cheerAge < 0.75) twirl = smooth((cheerAge - 0.15) / 0.6);
    const winAge = now - this.winAt;
    if (!calm && winAge >= 0 && winAge < 0.9) twirl = smooth(winAge / 0.9) * 2;
    const party = this.joy * (calm ? 0.25 : 0.3 + Math.abs(Math.sin(t * 4)) * 0.18);
    mesh.position.copy(FAIRY_SPOT);
    mesh.position.addScaledVector(DIRECTION, reach - flinch * 0.25 - alarm * 0.12);
    mesh.position.y += bob + lift + cheer * 0.45 + party - this.dim * 0.4;
    const nervous = calm || alarm < 0.5 ? 0 : Math.sin(t * 37) * 0.02 * alarm;
    mesh.rotation.set(
      0,
      yaw,
      lean +
        flinch * 0.1 +
        alarm * 0.07 +
        nervous -
        this.dim * 0.12 +
        (calm ? 0 : Math.sin(t * 1.1) * 0.03),
    );
    const turn = Math.cos(twirl * Math.PI * 2);
    const height = this.fairy.height;
    mesh.scale.set(height * this.fairy.aspect * turn, height, 1);
    const rise = mesh.position.y - FAIRY_SPOT.y;
    this.fairyShadow.scale.setScalar(Math.max(0.4, 1 - rise * 0.4));
    // Three first-try answers in a row: a golden glow gathers round her.
    const glowing = frame.streak >= 3 && frame.started;
    const halo = this.halo.material;
    halo.opacity = MathUtils.lerp(
      halo.opacity,
      glowing ? 0.55 + (calm ? 0 : Math.sin(t * 3) * 0.12) : 0,
      0.08,
    );
    this.halo.position.copy(mesh.position);
    this.halo.position.x += 0.1;
    this.halo.position.y += FAIRY_HEIGHT * 0.5;
    this.halo.position.z -= 0.05;
    if (glowing && !calm && Math.random() < 0.25) {
      const tip = this.wandTip();
      this.sparks.emit(
        tip.x,
        tip.y,
        tip.z,
        (Math.random() - 0.5) * 0.4,
        0.4,
        0,
        TINTS.spark,
        0.8,
        -0.2,
      );
    }
  }

  private updateMonster(
    frame: CastleFrame,
    now: number,
    t: number,
    dt: number,
    calm: boolean,
    yaw: number,
  ) {
    const target = STEP_S[Math.min(frame.approach, 2)];
    let s = target;
    let air = 0;
    let tilt = 0;
    let stretch = 0;
    let airborne = false;
    let across = 0;
    // A step closer after a mistake: a smug giggle, then a waddle to the next stone.
    const stepAge = now - this.stepAt;
    if (stepAge < 0) s = this.stepFrom;
    else if (stepAge < STEP_TIME)
      s = MathUtils.lerp(this.stepFrom, target, smooth(stepAge / STEP_TIME));
    else if (stepAge < STEP_TIME + 0.1) this.stomp(this.stepAt);
    // Past every stone: a charge at the gate, then knocked back head over heels.
    const rushAge = now - this.rushAt;
    if (rushAge < 0) s = this.stepFrom;
    else if (rushAge < RUSH_IN) {
      s = MathUtils.lerp(this.stepFrom, RUSH_S, smooth(rushAge / RUSH_IN));
      across = RUSH_ACROSS * smooth(rushAge / RUSH_IN);
      tilt += 0.1;
    } else if (this.rushStay) {
      s = RUSH_S;
      across = RUSH_ACROSS;
      if (rushAge < RUSH_IN + 0.1) this.stomp(this.rushAt);
      // The wave is lost: it stomps a little victory dance at the gate.
      const beat = (rushAge - RUSH_IN - 0.4) * 2.4;
      if (beat > 0 && !calm) {
        air = Math.abs(Math.sin(beat * Math.PI)) * 0.3;
        tilt += Math.sin(beat * Math.PI) * 0.14;
        stretch += Math.sin(beat * Math.PI * 2) * 0.05;
        if (Math.floor(beat) !== this.danceBeat) {
          this.danceBeat = Math.floor(beat);
          this.puffFeet(0.6);
        }
      }
    } else if (rushAge < RUSH_IN + KNOCK_BACK) {
      if (rushAge < RUSH_IN + 0.1) this.stomp(this.rushAt);
      const k = (rushAge - RUSH_IN) / KNOCK_BACK;
      s = MathUtils.lerp(RUSH_S, START_S, easeOut(k));
      across = RUSH_ACROSS * (1 - easeOut(k));
      air = Math.sin(k * Math.PI) * 0.9;
      tilt -= Math.sin(k * Math.PI) * 0.55;
      airborne = true;
    } else if (rushAge < RUSH_IN + KNOCK_BACK + 0.2) {
      // A heavy landing.
      const k = (rushAge - RUSH_IN - KNOCK_BACK) / 0.2;
      stretch -= Math.sin(k * Math.PI) * 0.16;
      if (this.dustAt !== this.rushAt + 1) {
        this.dustAt = this.rushAt + 1;
        this.puffFeet(1);
      }
    }
    // A new monster waddles in from the forest.
    const walkAge = now - this.walkInAt;
    let walkingIn = false;
    if (walkAge >= -0.2 && walkAge < 1) {
      walkingIn = true;
      s = MathUtils.lerp(WAIT_S, START_S, smooth(Math.max(0, walkAge)));
    }
    // The walk cycle runs on the distance covered, so feet plant once per stride at any speed.
    const moved = s - this.lastS;
    this.lastS = s;
    const pace = dt > 0 ? Math.abs(moved) / dt : 0;
    if (!airborne && Math.abs(moved) < 1) this.travel += Math.abs(moved);
    this.walking = approach(this.walking, !airborne && pace > 0.3 ? 1 : 0, 16, dt);
    const stride = (this.travel / STRIDE) * Math.PI;
    const foot = Math.floor(stride / Math.PI);
    if (foot !== this.footfall) {
      this.footfall = foot;
      if (this.walking > 0.3) this.puffFeet(0.45);
    }
    const swing = Math.abs(Math.sin(stride));
    const walk = this.walking;
    // Up over each foot, rocking from one to the other, squashing as the weight lands.
    air += swing * 0.15 * walk;
    tilt += Math.sin(stride) * 0.1 * walk + Math.sign(-moved) * 0.07 * walk;
    stretch += (swing * 0.06 - (1 - swing) ** 4 * 0.12) * walk;
    this.monsterS = s;
    if (walkingIn) across = MathUtils.lerp(-0.9, 0, smooth(Math.max(0, walkAge)));
    const position = alongInto(this.point, s, across);
    // Idle: it breathes and shifts its weight; impatient bouncing as the timer runs down.
    const urgency = frame.pressure;
    const still = (1 - walk) * (calm || !frame.started ? 0 : 1);
    const breath = Math.sin(t * (2 + urgency * 3));
    stretch += breath * 0.03 * still;
    tilt += Math.sin(t * 1.1) * 0.035 * still;
    air += urgency > 0.5 ? Math.abs(Math.sin(t * 7)) * 0.08 * (urgency - 0.5) * 2 * still : 0;
    // A wrong spell: it puffs itself up and giggles.
    const wrongAge = now - this.wrongAt;
    if (wrongAge >= 0 && wrongAge < TAUNT + 0.15) {
      const k = wrongAge / (TAUNT + 0.15);
      stretch += Math.sin(k * Math.PI) * 0.12;
      if (!calm) tilt += Math.sin(wrongAge * 38) * 0.08 * (1 - k);
    }
    // A right spell: it recoils white-hot, pops up spinning and vanishes in a puff.
    const rightAge = now - this.rightAt;
    const shieldOnly = this.shieldAt === this.rightAt && this.rightAt >= 0;
    let scale = 1;
    let flash = 0;
    let spin = 0;
    if (rightAge >= 0 && rightAge < 0.6) {
      const recoil = rightAge < RECOIL ? Math.sin((rightAge / RECOIL) * (Math.PI / 2)) : 0;
      flash = 1 - smooth(rightAge / (shieldOnly ? 0.35 : POOF));
      stretch -= recoil * 0.22;
      tilt -= recoil * 0.22;
      if (shieldOnly) {
        // The boss staggers but stays.
        const k = rightAge / 0.6;
        tilt -= Math.sin(k * Math.PI) * 0.12 * (1 - k);
        stretch -= Math.sin(k * Math.PI * 2) * 0.06 * (1 - k);
      } else if (rightAge >= RECOIL) {
        const k = clamp01((rightAge - RECOIL) / (POOF - RECOIL));
        if (!calm) {
          air += Math.sin(Math.min(1, k * 1.4) * (Math.PI / 2)) * 0.6;
          spin = k * k * 2.5;
        }
        stretch += Math.sin(Math.min(1, k * 1.6) * Math.PI) * 0.22;
        scale = rightAge < POP ? 1 : 1 - easeOut((rightAge - POP) / (POOF - POP));
        if (rightAge >= POP && this.poofedAt !== this.rightAt) {
          this.poofedAt = this.rightAt;
          this.poof(position, air + this.monster.height * 0.5);
        }
        if (rightAge > POOF) this.gone = true;
      }
    }
    if (walkingIn) this.gone = false;
    const hidden = this.gone && !walkingIn;
    this.monsterGroup.visible = !hidden;
    this.monsterGroup.position.copy(position);
    this.monsterGroup.position.y = air;
    this.monster.mesh.rotation.set(0, yaw, tilt);
    this.monster.mesh.material.color.setScalar(1 + flash * 2.2);
    const width = this.monster.height * this.monster.aspect * scale;
    this.monster.mesh.scale.set(
      width * (1 - stretch * 0.7) * Math.cos(spin * Math.PI * 2),
      this.monster.height * scale * (1 + stretch),
      1,
    );
    this.monsterShadow.visible = !hidden;
    this.monsterShadow.position.set(position.x, 0.02, position.z);
    this.monsterShadow.scale.setScalar(
      (frame.boss ? 1.3 : 1) * Math.max(0.1, scale) * (1 - air * 0.45) * (1 - stretch * 0.4),
    );
    for (let index = 0; index < this.rings.length; index++)
      this.rings[index].rotation.y = calm ? index : t * (0.5 + index * 0.15) * (index % 2 ? -1 : 1);
    // The badge rides above its head while a sum is open.
    const badgeOn =
      frame.started &&
      !hidden &&
      (frame.phase === 'ready' || frame.phase === 'casting' || frame.phase === 'wrong') &&
      !walkingIn;
    this.badge.visible = badgeOn;
    this.badgeLabel.update(frame.badge);
    const pulse = urgency > 0.6 && !calm ? 1 + Math.sin(t * 9) * 0.06 : 1;
    const size = this.badgeSize * pulse;
    this.badge.scale.set(0.62 * size, 0.5 * size, 1);
    this.badge.position
      .copy(position)
      .setY(air + this.monster.height * scale * (1 + stretch) + 0.07 + 0.25 * this.badgeSize);
    // Waiting in line at the forest's edge, breathing quietly.
    const waiting = !!frame.waiting && frame.phase !== 'complete';
    const show = waiting && !(walkingIn && walkAge < 0.6);
    this.waiting.mesh.visible = show;
    this.waitingShadow.visible = show;
    const appear = walkingIn ? smooth((walkAge - 0.6) / 0.4) : 1;
    const sigh = calm ? 0 : Math.sin(t * 1.8 + 1);
    this.waiting.mesh.position.copy(WAIT_SPOT);
    this.waiting.mesh.rotation.set(0, yaw, calm ? 0 : Math.sin(t * 0.9) * 0.04);
    this.waiting.mesh.scale.set(
      this.waiting.height * this.waiting.aspect * appear * (1 - sigh * 0.02),
      this.waiting.height * appear * (1 + sigh * 0.03),
      1,
    );
    // Posts the monster has passed burn red.
    for (let index = 0; index < this.markers.length; index++) {
      const { top, light } = this.markers[index];
      const danger = frame.started && s <= MARKER_S[index] + 0.05;
      top.material.color.copy(danger ? TINTS.danger : TINTS.marker);
      light.material.color.copy(danger ? TINTS.danger : TINTS.markerLight);
      const glow = danger && !calm ? 1 + Math.sin(t * 6) * 0.2 : 1;
      light.scale.setScalar((danger ? 1.1 : 0.8) * glow);
      top.rotation.y = calm ? 0 : t * 1.2 + index;
    }
  }

  /** A big stomp: a ring of dust and a jolt, once per event. */
  private stomp(at: number) {
    if (this.dustAt === at) return;
    this.dustAt = at;
    this.puffFeet(1);
  }

  /** Dust kicked up round the monster's feet; `strength` 1 is a full stomp. */
  private puffFeet(strength: number) {
    const p = this.monsterGroup.position;
    const count = Math.round(4 + strength * 8);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      this.dust.emit(
        p.x + Math.cos(a) * 0.4,
        0.1,
        p.z + Math.sin(a) * 0.3,
        Math.cos(a) * 1.4 * strength,
        0.3 + Math.random() * 0.4 * strength,
        Math.sin(a) * 0.8 * strength,
        TINTS.dust,
        0.45 + strength * 0.3,
        0.4,
        0.55 + strength * 0.25,
      );
    }
  }

  /** The freed creature vanishes in a soft cloud with stars tumbling out of it. */
  private poof(at: Vector3, height: number) {
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      this.puffs.emit(
        at.x + Math.cos(a) * 0.3,
        height + Math.sin(a) * 0.25,
        at.z,
        Math.cos(a) * 1.3,
        Math.sin(a) * 1.0 + 0.3,
        (Math.random() - 0.5) * 0.6,
        i % 3 ? TINTS.puff : TINTS.puffPink,
        0.75 + Math.random() * 0.3,
        -0.6,
        1,
      );
    }
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + 0.2;
      this.colour.set(i % 2 ? '#fff3a0' : GEM_COLOURS[i % 5]);
      this.stars.emit(
        at.x,
        height,
        at.z,
        Math.cos(a) * (1.6 + Math.random()),
        Math.sin(a) * 1.4 + 1.6,
        (Math.random() - 0.5) * 1.2,
        this.colour,
        1 + Math.random() * 0.5,
        3.2,
      );
    }
  }

  private updateGem(now: number, calm: boolean) {
    const age = now - this.castAt;
    const trail = this.trail;
    const eye = this.camera.position;
    if (!this.landed && age >= 0) {
      const tip = this.wandTip();
      if (age < WIND) {
        // Gathering on the wand while she winds up.
        const grow = easeOutBack(age / WIND);
        this.gem.position.copy(tip);
        this.gemGlow.position.copy(tip);
        this.gem.scale.set(0.5 * grow, 0.63 * grow, 1);
        this.gemGlow.scale.setScalar(0.6 + grow * 1.1);
        this.gemGlow.material.opacity = 0.9;
        this.gem.material.rotation = 0;
        this.gem.visible = this.gemGlow.visible = true;
        trail.mesh.visible = false;
        return;
      }
      if (!this.released) {
        this.released = true;
        this.castFrom.copy(tip);
        trail.reset(tip);
        trail.mesh.visible = true;
      }
      const k = Math.min(1, (age - WIND) / FLIGHT);
      const to = this.chest();
      // Quick off the wand, an arc, and a hard landing.
      const position = this.point.copy(this.castFrom).lerp(to, k * (2 - k) * 0.35 + k * k * 0.65);
      position.y += Math.sin(k * Math.PI) * 1.0;
      this.gem.position.copy(position);
      this.gemGlow.position.copy(position);
      const pulse = 1 + Math.sin(age * 40) * 0.06;
      this.gem.scale.set(0.62 * pulse, 0.78 * pulse, 1);
      this.gemGlow.scale.setScalar(1.4);
      this.gem.material.rotation = calm ? 0 : -age * 9;
      this.gemGlow.material.opacity = 0.85;
      trail.push(position);
      trail.draw(eye, TINTS.white, this.castColour, 1);
      for (let i = 0; i < 2; i++)
        this.sparks.emit(
          position.x + (Math.random() - 0.5) * 0.14,
          position.y + (Math.random() - 0.5) * 0.14,
          position.z,
          (Math.random() - 0.5) * 0.6,
          (Math.random() - 0.5) * 0.6,
          0,
          i ? this.castColour : TINTS.white,
          0.5,
          0.6,
        );
      if (k >= 1) {
        this.landed = true;
        this.gem.visible = this.gemGlow.visible = false;
        this.impact(to);
      } else {
        this.gem.visible = this.gemGlow.visible = true;
      }
      return;
    }
    // After landing the tail catches up with the head and fades.
    const tailAge = now - this.impactAt;
    if (trail.mesh.visible) {
      if (tailAge >= 0 && tailAge < 0.2) {
        trail.push(this.impactSpot);
        trail.draw(eye, TINTS.white, this.castColour, 1 - tailAge / 0.2);
      } else trail.mesh.visible = false;
    }
    // A wrong spell: the gem glances off, tumbles down and fades on the grass.
    const bounce = now - this.bounceAt;
    if (bounce >= 0 && bounce < 0.9) {
      const g = this.point.copy(this.bounceFrom);
      // Off to the side on screen, whichever way the camera looks down the path.
      g.addScaledVector(this.cameraRight, -1.9 * bounce).addScaledVector(ACROSS, 0.4 * bounce);
      g.y = Math.max(0.2, this.bounceFrom.y + 3.4 * bounce - 6.5 * bounce * bounce);
      this.gem.position.copy(g);
      this.gem.scale.set(0.5, 0.63, 1);
      this.gem.material.rotation = calm ? 0.6 : bounce * 14;
      this.gem.material.opacity = 1 - smooth((bounce - 0.55) / 0.35);
      this.gem.visible = true;
      this.gemGlow.visible = false;
    } else if (this.landed) {
      this.gem.visible = this.gemGlow.visible = false;
    }
  }

  /** The spell lands: a flash, a ring of light and a spray of sparks. */
  private impact(at: Vector3) {
    this.impactAt = this.now;
    this.impactSpot.copy(at);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      this.sparks.emit(
        at.x,
        at.y,
        at.z,
        Math.cos(a) * 2.8,
        Math.sin(a) * 2.8,
        0.3,
        i % 3 ? this.castColour : TINTS.white,
        0.5,
        1.5,
      );
    }
  }

  /**
   * Every spell lands with a small glint; only a right one bursts into a big white flash and a
   * ring of light, so a wrong spell never looks like a hit.
   */
  private updateImpact(now: number) {
    const glint = now - this.impactAt;
    const burst = now - this.burstAt;
    const big = burst >= 0 && burst < 0.3;
    const small = glint >= 0 && glint < 0.18;
    this.flash.visible = big || small;
    if (big) {
      this.flash.position.copy(this.burstSpot);
      this.flash.scale.setScalar(1 + easeOut(burst / 0.2) * 2.8);
      this.flash.material.opacity = (1 - burst / 0.3) ** 2;
      this.flash.material.color.copy(TINTS.white).lerp(this.castColour, clamp01(burst / 0.25));
    } else if (small) {
      this.flash.position.copy(this.impactSpot);
      this.flash.scale.setScalar(0.6 + easeOut(glint / 0.12) * 0.9);
      this.flash.material.opacity = 0.7 * (1 - glint / 0.18);
      this.flash.material.color.copy(this.castColour);
    }
    const ring = burst >= 0 && burst < 0.45;
    this.shockwave.visible = ring;
    if (!ring) return;
    this.shockwave.position.copy(this.burstSpot);
    this.shockwave.quaternion.copy(this.camera.quaternion);
    this.shockwave.scale.setScalar(0.3 + easeOut(burst / 0.45) * 1.9);
    this.shockwave.material.color.copy(this.castColour);
    this.shockwave.material.opacity = 1 - burst / 0.45;
  }

  /**
   * When a monster reaches the gate, one of the castle's hearts rises over it, cracks and
   * falls apart in two halves. The HUD keeps the count; this is the moment of losing one.
   */
  private updateHearts(now: number) {
    const age = now - this.crackAt;
    const active = this.crackAt >= 0 && age >= 0 && age < CRACK;
    const top = this.spot.copy(GATE_SPOT).setY(GATE_TOP + 0.5);
    const rise = easeOutBack(Math.min(1, age / 0.3));
    this.heart.visible = active && age < CRACK_AT;
    this.heart.position.copy(top).setY(top.y - 0.6 + rise * 0.6);
    this.heart.scale.setScalar(0.8 * rise * (1 + Math.max(0, Math.sin(age * 18)) * 0.06));
    if (active && age >= CRACK_AT && !this.cracked) {
      this.cracked = true;
      this.ripple.material.color.copy(TINTS.heart);
      this.ripple.visible = true;
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        this.sparks.emit(
          top.x,
          top.y,
          top.z,
          Math.cos(a) * 2.2,
          Math.sin(a) * 2.2,
          0,
          TINTS.heart,
          0.7,
          2,
        );
      }
    }
    for (let side = 0; side < this.halves.length; side++) {
      const half = this.halves[side];
      half.visible = active && age >= CRACK_AT;
      if (!half.visible) continue;
      const k = (age - CRACK_AT) / (CRACK - CRACK_AT);
      const dir = side ? 1 : -1;
      half.position.set(
        top.x + dir * (0.06 + k * 0.7),
        top.y - k * k * 2.6 + Math.sin(k * Math.PI) * 0.25,
        top.z,
      );
      half.material.rotation = -dir * k * 1.6;
      half.material.opacity = 1 - smooth((k - 0.6) / 0.4);
    }
    // The ripple rings out from the gate when a heart cracks, or gold when the wave is won.
    const crackRipple = age - CRACK_AT;
    const winRipple = now - this.winAt;
    const rippleAge =
      winRipple >= 0 && winRipple < 1 ? winRipple / 1 : crackRipple >= 0 ? crackRipple / 0.8 : -1;
    if (this.ripple.visible && rippleAge >= 0 && rippleAge < 1) {
      this.ripple.position.copy(GATE_SPOT).setY(0.1);
      this.ripple.rotation.x = -Math.PI / 2;
      this.ripple.scale.setScalar(0.5 + easeOut(rippleAge) * (winRipple < 1 ? 3 : 2.4));
      this.ripple.material.opacity = (1 - rippleAge) ** 2;
    } else this.ripple.visible = false;
    // The gate shudders when the monster reaches it.
    const jolt = shake(now, this.crackAt, 0.5, 0.06);
    this.gate.position.copy(GATE_SPOT);
    this.gate.position.x += jolt;
  }

  /** Windows, pennants and light: the castle's mood. */
  private updateCastle(t: number, calm: boolean) {
    const { alarm, dim, joy } = this;
    // Candle-lit windows flicker; a monster near the gate makes them flash red.
    const flicker = calm ? 1 : 0.92 + Math.sin(t * 7.3) * Math.sin(t * 3.1) * 0.08;
    const close = smooth((alarm - 0.45) / 0.35);
    const blink = calm ? 0.7 : 0.5 + 0.5 * Math.sin(t * 8);
    this.tint
      .copy(TINTS.window)
      .lerp(TINTS.alarm, close * blink)
      .lerp(TINTS.gold, joy)
      .lerp(TINTS.dark, dim);
    if (this.windowLight) this.windowLight.color.copy(this.tint).multiplyScalar(flicker);
    // The pennants ripple like cloth: faster in a fright or a party, hanging limp when lost.
    const flag = this.flags[0]?.geometry as BufferGeometry | undefined;
    const rest = this.flagRest;
    if (flag && rest) {
      const position = flag.getAttribute('position') as BufferAttribute;
      const clock = calm ? 0 : t;
      const speed = 7 + alarm * 5 + joy * 5;
      const amplitude = calm ? 0.025 : (0.05 + alarm * 0.03 + joy * 0.03) * (1 - dim * 0.8);
      for (let i = 0; i < position.count; i++) {
        const x = rest[i * 3];
        const reach = x / 0.42;
        position.setZ(i, Math.sin(x * 14 - clock * speed) * amplitude * reach);
        position.setY(i, rest[i * 3 + 1] - reach * reach * 0.05 * (1 - joy));
      }
      position.needsUpdate = true;
      for (let index = 0; index < this.flags.length; index++) {
        const pennant = this.flags[index];
        pennant.rotation.y = calm ? 0.3 : 0.25 + Math.sin(t * 1.3 + index) * 0.15;
        pennant.rotation.z = -dim * 1.2;
      }
    }
    // A won wave: the castle glows, with a swell as the win lands.
    const swell = Math.max(0, 1 - Math.abs(this.now - this.winAt - 0.35) / 0.5);
    this.shine.visible = joy > 0.01;
    this.shine.material.opacity =
      joy * (0.35 + (calm ? 0 : Math.sin(t * 2.4) * 0.06)) + swell * 0.35;
    this.shine.scale.setScalar(6 + swell * 2);
    // A lost wave draws a dusk over the meadow.
    this.sun.intensity = 2.1 * (1 - dim * 0.4) + joy * 0.25;
    this.fill.intensity = 1.5 * (1 - dim * 0.3);
    this.backdrop.material.color.copy(TINTS.white).lerp(TINTS.dusk, dim * 0.6);
    (this.scene.background as Color).copy(TINTS.sky).lerp(TINTS.duskSky, dim * 0.6);
  }

  /** The two little fairies circle the towers, guard the gate in danger and party on a win. */
  private updateHelpers(
    frame: CastleFrame,
    now: number,
    t: number,
    dt: number,
    calm: boolean,
    yaw: number,
  ) {
    const guard = smooth((this.alarm - 0.35) / 0.3) * (1 - this.dim);
    const cheerAge = now - this.cheerAt;
    const cheer = cheerAge >= 0 && cheerAge < 0.8 ? Math.sin((cheerAge / 0.8) * Math.PI) : 0;
    for (let index = 0; index < this.helpers.length; index++) {
      const helper = this.helpers[index];
      const side = index ? 1 : -1;
      const a = (calm ? 0 : t * (0.8 + this.joy * 1.2)) + helper.seed;
      // Round the towers in a lazy loop.
      const goal = this.spot.copy(GATE_SPOT);
      goal.x += Math.cos(a) * (1.4 + this.joy * 0.5);
      goal.z += Math.sin(a) * 0.8;
      goal.y = GATE_TOP * 0.72 + Math.sin(a * 2) * 0.3 + index * 0.35 + this.joy * 0.4;
      // On guard between the gate and the monster, wands out.
      alongInto(
        this.scratch,
        GATE_S + 1.3 + index * 0.4,
        0.3 + side * 0.55,
        1.5 + index * 0.35 + (calm ? 0 : Math.sin(t * 6 + helper.seed) * 0.06),
      );
      goal.lerp(this.scratch, guard);
      // A lost wave: they huddle by the big fairy.
      alongInto(this.scratch, FAIRY_S - 0.5, FAIRY_ACROSS + 0.4 + side * 0.5, 0.75 + index * 0.25);
      goal.lerp(this.scratch, this.dim);
      goal.y += cheer * 0.35;
      helper.last.copy(helper.at);
      helper.at.lerp(goal, 1 - Math.exp(-5 * dt));
      // Face the way they fly across the screen, turning over a few frames.
      const across = this.scratch.subVectors(helper.at, helper.last).dot(this.cameraRight);
      const facing = guard > 0.5 ? 1 : Math.abs(across) > 0.002 ? Math.sign(across) : helper.facing;
      helper.facing = approach(helper.facing, facing, 9, dt);
      const mesh = helper.art.mesh;
      mesh.position.copy(helper.at);
      if (!calm) mesh.position.y += Math.sin(t * 9 + helper.seed) * 0.03;
      const climb = dt > 0 ? (helper.at.y - helper.last.y) / dt : 0;
      mesh.rotation.set(0, yaw, MathUtils.clamp(climb * 0.15, -0.3, 0.3) * helper.facing);
      const height = helper.art.height;
      mesh.scale.set(height * helper.art.aspect * helper.facing, height, 1);
      // A trickle of fairy dust.
      if (!calm && !frame.paused && Math.random() < 0.18)
        this.sparks.emit(
          mesh.position.x,
          mesh.position.y + height * 0.4,
          mesh.position.z,
          0,
          -0.25,
          0,
          TINTS.gem,
          0.7,
          0.3,
        );
    }
  }

  private updateButterflies(now: number, yaw: number) {
    for (const butterfly of this.butterflies) {
      const age = now - butterfly.born;
      const mesh = butterfly.art.mesh;
      if (age < 0 || age > 2.6) {
        mesh.visible = false;
        continue;
      }
      mesh.visible = true;
      const grow = easeOutBack(Math.min(1, age / 0.35));
      const k = age / 2.6;
      // Up and away over the forest, weaving as it goes.
      mesh.position.copy(butterfly.from);
      mesh.position.addScaledVector(DIRECTION, k * 4.5);
      mesh.position.addScaledVector(ACROSS, Math.sin(age * 4) * 0.35 * butterfly.side);
      mesh.position.y += -0.4 + k * 3.4 + Math.sin(age * 7) * 0.15;
      const flap = 0.45 + Math.abs(Math.sin(age * 13)) * 0.55;
      const fade = 1 - smooth((k - 0.75) / 0.25);
      mesh.material.opacity = fade;
      mesh.rotation.set(0, yaw, Math.sin(age * 3) * 0.2);
      const size = 1.1 * grow * (1 - k * 0.4);
      // Painted facing left; flip it to face the way it flies.
      mesh.scale.set(-size * butterfly.art.aspect * flap, size, 1);
      if (Math.random() < 0.4) {
        this.sparks.emit(
          mesh.position.x,
          mesh.position.y + size * 0.4,
          mesh.position.z,
          0,
          -0.3,
          0,
          TINTS.gem,
          0.6,
          0.5,
        );
      }
    }
  }

  private updateShards(now: number, dt: number) {
    for (const shard of this.shards) {
      const age = now - shard.born;
      if (age < 0 || age > 1.2) {
        shard.mesh.visible = false;
        continue;
      }
      shard.mesh.visible = true;
      shard.velocity.y -= 7 * dt;
      shard.mesh.position.addScaledVector(shard.velocity, dt);
      shard.mesh.rotation.x += shard.spin.x * dt;
      shard.mesh.rotation.y += shard.spin.y * dt;
      shard.mesh.scale.setScalar(1.4 * (1 - age / 1.2));
    }
  }

  private updateAmbient(dt: number, t: number, calm: boolean) {
    // Fireflies wander in the warm air over the path.
    const position = this.fireflies.geometry.getAttribute('position') as BufferAttribute;
    const colour = this.fireflies.geometry.getAttribute('color') as BufferAttribute;
    const clock = calm ? 0 : t;
    for (let index = 0; index < this.fireflySeeds.length; index++) {
      const seed = this.fireflySeeds[index];
      const base = this.fireflySpots[index];
      position.setXYZ(
        index,
        base.x + Math.sin(clock * 0.4 + seed) * 0.6,
        base.y + Math.sin(clock * 0.7 + seed * 2) * 0.35,
        base.z + Math.cos(clock * 0.3 + seed) * 0.5,
      );
      const twinkle = calm ? 0.7 : 0.35 + 0.65 * Math.max(0, Math.sin(t * 1.3 + seed * 3));
      colour.setXYZW(index, 1, 0.95, 0.6, twinkle);
    }
    position.needsUpdate = colour.needsUpdate = true;
    // Petals drift across and loop round; after a burst they settle back into the breeze.
    const settle = 1 - Math.exp(-1.6 * dt);
    for (let index = 0; index < this.petalState.length; index++) {
      const petal = this.petalState[index];
      if (!calm) {
        petal.v.lerp(petal.drift, settle);
        petal.p.addScaledVector(petal.v, dt);
        petal.p.x += Math.sin(t + petal.phase) * 0.15 * dt;
        if (petal.p.y < 0.05 || petal.p.x > 8)
          petal.p.set(-8 + Math.random() * 3, 2.5 + Math.random() * 2.5, -5 + Math.random() * 8);
      }
      this.dummy.position.copy(petal.p);
      const spin = calm ? petal.phase : t * petal.spin + petal.phase;
      this.dummy.rotation.set(spin, spin * 0.7, spin * 0.3);
      this.dummy.updateMatrix();
      this.petals.setMatrixAt(index, this.dummy.matrix);
    }
    this.petals.instanceMatrix.needsUpdate = true;
  }

  private firework() {
    const at = alongInto(
      this.spot,
      Math.random() * 5,
      -1.2 - Math.random() * 2,
      2.8 + Math.random() * 1.2,
    );
    const tint = GEM_COLOURS[Math.floor(Math.random() * GEM_COLOURS.length)];
    this.colour.set(tint);
    for (let i = 0; i < 34; i++) {
      const a = (i / 34) * Math.PI * 2;
      const b = Math.random() * Math.PI;
      this.sparks.emit(
        at.x,
        at.y,
        at.z,
        Math.cos(a) * Math.sin(b) * 2.6,
        Math.cos(b) * 2.6,
        Math.sin(a) * Math.sin(b) * 2.6,
        this.colour,
        1.1,
        1.6,
      );
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      this.stars.emit(
        at.x,
        at.y,
        at.z,
        Math.cos(a) * 1.4,
        Math.sin(a) * 1.4,
        0,
        this.colour,
        1,
        1.2,
      );
    }
    this.glows.emit(at.x, at.y, at.z, 0, 0, 0, this.colour, 0.4);
  }

  /** Trees, bushes and rocks at several depths, so the camera's drift shows parallax. */
  private dress() {
    const { scene } = this;
    const trees: [number, number, 'round' | 'cypress', number][] = [
      [-2.2, -4.6, 'cypress', 1],
      [1.2, -5.2, 'round', 1.15],
      [3.6, -4.4, 'cypress', 1.05],
      [6.2, -5.6, 'round', 1.2],
      [9.6, -3.6, 'round', 1.25],
      [11.4, -2.2, 'cypress', 1.1],
      [-4.8, -3.2, 'round', 1.2],
      [9.2, 3.6, 'round', 1.1],
      [12.5, 1.8, 'round', 1.3],
    ];
    for (const [s, across, kind, size] of trees) {
      const tree = buildTree(kind, Math.round(s * 3));
      tree.position.copy(along(s, across));
      tree.scale.setScalar(size);
      tree.rotation.y = s;
      scene.add(tree);
    }
    const bushes: [number, number, number][] = [
      [0.2, 2.6, 0.9],
      [3.0, 2.3, 0.75],
      [5.8, 2.1, 0.8],
      [-2.4, 2.2, 0.9],
      [3.8, -2.2, 0.8],
      [8.0, -1.9, 0.9],
      [-0.2, -2.3, 0.7],
      [7.6, 2.8, 1],
      [-3.4, -2.0, 0.8],
    ];
    for (const [index, [s, across, size]] of bushes.entries()) {
      const bush = buildBush(index, size);
      bush.position.copy(along(s, across));
      scene.add(bush);
    }
    const rocks: [number, number, number][] = [
      [1.2, 1.8, 0.9],
      [6.8, 1.75, 0.7],
      [4.8, -1.75, 0.6],
      [-1.0, 3.2, 1.3],
      [8.4, 2.6, 1.1],
    ];
    for (const [index, [s, across, size]] of rocks.entries()) {
      const rock = buildRock(index + 1, size);
      rock.position.add(along(s, across));
      scene.add(rock);
    }
  }
}
