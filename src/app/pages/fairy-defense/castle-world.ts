import {
  AdditiveBlending,
  CylinderGeometry,
  IcosahedronGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Fog,
  Group,
  InstancedMesh,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Object3D,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector3,
} from 'three';
import { TextLabel } from '../../shared/three/labels';
import { easeOut, easeOutBack, shake, smooth } from '../../shared/three/motion';
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
  shardGeometry,
  Sparks,
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
const YAW = { upright: -0.36, wide: -0.08 };
const PITCH = { upright: 0.3, wide: 0.17 };
const START_S = 6.2;
const STEP_S = [START_S, 5.1, 4.0];
/** Where a monster that gets past every stone stomps to, right at the gate. */
const RUSH_S = 2.7;
const WAIT_S = 8.6;
/** The stones on the path: one under each step, the last one just before the gate. */
const MARKER_S = [STEP_S[1], STEP_S[2], RUSH_S + 0.4];
const MONSTER_HEIGHT = 1.75;
const BOSS_HEIGHT = 2.55;
const FAIRY_HEIGHT = 1.85;
const FAIRY_LIFT = 0.75;
/** How long a cast gem flies, a little under the game's 550 ms before it resolves. */
const FLIGHT = 0.48;
const RUSH_IN = 0.38;
const KNOCK_BACK = 0.7;
/** Pixels kept clear for the HUD at the top and a little air on the other sides. */
const MARGIN = { top: 70, bottom: 6, side: 8 };

const along = (s: number, across = 0, y = 0) =>
  new Vector3(GATE.x, y, GATE.z).addScaledVector(DIRECTION, s).addScaledVector(ACROSS, across);
const GATE_SPOT = along(GATE_S, GATE_ACROSS);

interface Butterfly {
  readonly art: Billboard;
  readonly from: Vector3;
  born: number;
  /** Which way it drifts off, so two in a row do not overlap. */
  readonly side: number;
}
interface Shard {
  readonly mesh: Mesh;
  readonly velocity: Vector3;
  readonly spin: Vector3;
  born: number;
}

export class CastleWorld extends Stage implements StateWorld<CastleFrame> {
  private frame?: CastleFrame;
  /** The world's own clock: it stops while the game is paused. */
  private now = 0;
  private readonly glow = glowTexture();
  private readonly target = new Vector3();
  private distance = 12;
  private yaw = 0;
  private pitch = 0.2;
  /** Upright screens draw the monster's badge bigger, since the whole scene is drawn smaller. */
  private badgeSize = 1;
  private readonly backdrop: Mesh<PlaneGeometry, MeshBasicMaterial>;
  private readonly gate: Group;
  private readonly fairy = new Billboard('fairy', FAIRY_HEIGHT);
  private readonly fairyShadow: Mesh;
  private readonly halo: Sprite;
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
  private readonly glows: Sparks;
  private readonly dust: Sparks;
  private readonly fireflies: Points<BufferGeometry, PointsMaterial>;
  private readonly fireflySeeds: number[] = [];
  private readonly petals: InstancedMesh;
  private readonly petalState: { p: Vector3; v: Vector3; spin: number; phase: number }[] = [];
  private readonly butterflies: Butterfly[] = [];
  private readonly shards: Shard[] = [];
  private readonly dummy = new Object3D();
  private readonly scratch = new Vector3();
  private readonly colour = new Color();

  // Where things are and when each reaction started (world clock seconds; -99 = never).
  private monsterS = START_S;
  private stepFrom = START_S;
  private stepAt = -99;
  private castAt = -99;
  private castFrom = new Vector3();
  private castColour = new Color();
  private landed = true;
  private wrongAt = -99;
  private rightAt = -99;
  private rushAt = -99;
  private rushStay = false;
  private walkInAt = -99;
  private crackAt = -99;
  private cheerAt = -99;
  private shieldAt = -99;
  private nextFirework = 0;
  private shieldsBroken = 0;
  private gone = false;

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
    scene.add(this.gate);
    this.dress();

    // Three stones on the path mark the monster's steps toward the gate.
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

    this.monster.mesh.material.depthWrite = true;
    this.monster.mesh.material.alphaTest = 0.35;
    this.monsterShadow = blobShadow(this.glow, 1.7);
    this.monsterGroup.add(this.monster.mesh);
    scene.add(this.monsterGroup, this.monsterShadow);
    this.waiting.mesh.material.color.set('#d9e6dd');
    this.waitingShadow = blobShadow(this.glow, 1.2);
    this.waitingShadow.position.copy(along(WAIT_S, -0.9, 0.02));
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
    scene.add(this.gem, this.gemGlow);

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

    this.sparks = new Sparks(260, 0.16, this.glow);
    this.glows = new Sparks(60, 0.55, this.glow);
    this.dust = new Sparks(80, 0.5, this.glow, dustBlending);
    scene.add(this.sparks.points, this.glows.points, this.dust.points);

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
    for (let i = 0; i < flies; i++) this.fireflySeeds.push(i * 1.618);
    scene.add(this.fireflies);
    const petalGeometry = new PlaneGeometry(0.11, 0.07);
    this.petals = new InstancedMesh(
      petalGeometry,
      new MeshLambertMaterial({ color: '#ffb3cf', side: DoubleSide }),
      18,
    );
    for (let i = 0; i < 18; i++)
      this.petalState.push({
        p: new Vector3(-7 + ((i * 7.3) % 15), 0.5 + ((i * 1.37) % 4), -4 + ((i * 3.1) % 7)),
        v: new Vector3(0.35 + (i % 3) * 0.1, -0.12 - (i % 4) * 0.03, 0.05),
        spin: 1 + (i % 5) * 0.6,
        phase: i,
      });
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
    else if (next.phase === 'complete') this.nextFirework = this.now;
  }

  /** Jumps to a state without replaying anything: a new world, a new wave, a restart. */
  private sync(frame: CastleFrame) {
    this.monster.wear(frame.appearance);
    this.monster.resize(frame.boss ? BOSS_HEIGHT : MONSTER_HEIGHT);
    if (frame.waiting) this.waiting.wear(frame.waiting);
    this.monsterS = STEP_S[Math.min(frame.approach, 2)];
    this.stepAt = this.castAt = this.wrongAt = this.rightAt = this.rushAt = -99;
    this.walkInAt = this.crackAt = this.cheerAt = this.shieldAt = -99;
    this.gone = frame.phase === 'complete';
    this.rushStay = frame.phase === 'lost';
    if (this.rushStay) this.monsterS = RUSH_S;
    this.shieldsBroken = frame.encounter + (frame.phase === 'transforming' ? 1 : 0);
    this.landed = true;
    this.gem.visible = this.gemGlow.visible = false;
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
    this.castFrom.copy(this.wandTip());
    this.landed = false;
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
    this.colour.set('#ffffff');
    this.glows.emit(chest.x, chest.y, chest.z, 0, 0.2, 0, this.colour, 0.45);
    if (shieldOnly) {
      this.shieldAt = this.now;
      this.shatter(this.shieldsBroken);
      this.shieldsBroken++;
      return;
    }
    if (frame.boss) this.shatter(this.shieldsBroken);
    this.shieldsBroken = frame.encounters;
    // The creature turns into a butterfly that flutters off over the trees.
    const free = this.butterflies.find((b) => this.now - b.born > 2.6);
    const art = free?.art ?? new Billboard('butterfly', 1);
    if (!free) this.scene.add(art.mesh);
    const butterfly: Butterfly = free ?? { art, from: new Vector3(), born: 0, side: 1 };
    butterfly.from.copy(chest);
    butterfly.born = this.now + 0.22;
    (butterfly as { side: number }).side = this.butterflies.length % 2 ? -1 : 1;
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
    this.landed = true;
    // The gem glances off and tumbles to the ground.
    const chest = this.chest();
    for (let i = 0; i < 16; i++) {
      this.sparks.emit(
        chest.x - 0.3,
        chest.y,
        chest.z,
        -1 - Math.random() * 2,
        1 + Math.random() * 2,
        (Math.random() - 0.5) * 2,
        this.castColour,
        0.9,
        6,
      );
    }
    this.colour.set('#ffffff');
    this.dust.emit(chest.x - 0.3, chest.y, chest.z, -0.4, 0.3, 0, this.colour, 0.5, 0, 0.7);
    if (frame.damaged || frame.phase === 'lost') {
      // Past the last stone: it stomps right up to the gate and a heart cracks.
      this.rushAt = this.now + 0.25;
      this.rushStay = frame.phase === 'lost';
      this.stepFrom = this.monsterS;
      this.crackAt = this.rushAt + RUSH_IN;
      this.cracked = false;
      return;
    }
    if (frame.approach > previous.approach) {
      this.stepFrom = this.monsterS;
      this.stepAt = this.now + 0.3;
    }
  }

  private walkIn(frame: CastleFrame) {
    // The boss stays put behind what is left of his shield.
    if (!frame.boss) {
      this.walkInAt = this.now + 0.1;
      this.monster.wear(frame.appearance);
      if (frame.waiting) this.waiting.wear(frame.waiting);
    }
    this.monsterS = START_S;
    this.stepAt = this.wrongAt = -99;
    this.rushStay = false;
  }

  /** Where the fairy's star wand is, in the world. */
  private wandTip(): Vector3 {
    // The star sits 87% across and 78% up the fairy's painted figure.
    const mesh = this.fairy.mesh;
    mesh.updateMatrixWorld();
    return mesh.localToWorld(new Vector3(0.37, 0.78, 0.02));
  }

  private chest(): Vector3 {
    const height = this.monster.height;
    return this.monsterGroup.position.clone().setY(height * 0.48);
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
    const fairy = along(FAIRY_S, FAIRY_ACROSS, FAIRY_LIFT);
    const monster = along(START_S);
    const gate = GATE_SPOT.clone();
    return [
      fairy.clone().add(new Vector3(-0.9, FAIRY_HEIGHT * 0.95, 0)),
      fairy.clone().add(new Vector3(-0.9, -FAIRY_LIFT, 0)),
      monster.clone().add(new Vector3(0.85, 0, 0)),
      monster.clone().add(new Vector3(0.85, height + 0.3 + 0.25 * this.badgeSize, 0)),
      monster.clone().add(new Vector3(-0.85, height + 0.3 + 0.25 * this.badgeSize, 0)),
      // Wide screens show the whole gate; upright ones may crop its far tower.
      ...(this.camera.aspect > 1.4
        ? [
            gate.clone().add(new Vector3(-1.3, 0, 0)),
            gate.clone().add(new Vector3(-1.3, GATE_TOP, 0)),
          ]
        : [gate.clone().add(new Vector3(0, GATE_TOP * 0.8, 0))]),
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

    // Camera: a slow drift for parallax, and a shake when something hits.
    const drift = calm || frame.paused ? 0 : Math.sin(t * 0.21) * 1.0 + Math.sin(t * 0.13) * 0.5;
    this.place(this.distance, drift);
    const hit = shake(now, this.crackAt, 0.55, 0.16) + shake(now, this.stepAt + 0.42, 0.3, 0.05);
    if (hit) {
      this.camera.position.x += hit;
      this.camera.position.y += hit * 0.5;
    }
    const faceYaw = Math.atan2(
      this.camera.position.x - this.target.x,
      this.camera.position.z - this.target.z,
    );

    this.updateFairy(frame, now, t, calm, faceYaw);
    this.updateMonster(frame, now, t, calm, faceYaw);
    this.updateGem(now, calm);
    this.updateHearts(now);
    this.updateButterflies(now, faceYaw);
    this.updateShards(now, step);
    this.updateAmbient(step, t, calm);
    if (frame.phase === 'complete' && now >= this.nextFirework && !frame.paused) {
      this.firework();
      this.nextFirework = now + (calm ? 2.4 : 0.7);
    }
    this.sparks.update(step);
    this.glows.update(step);
    this.dust.update(step);
  }

  private updateFairy(frame: CastleFrame, now: number, t: number, calm: boolean, yaw: number) {
    const mesh = this.fairy.mesh;
    const base = along(FAIRY_S, FAIRY_ACROSS, FAIRY_LIFT);
    const bob = calm ? 0 : Math.sin(t * 1.7) * 0.09;
    const castAge = now - this.castAt;
    const lunge = castAge >= 0 && castAge < 0.5 ? Math.sin((castAge / 0.5) * Math.PI) : 0;
    const cheerAge = now - this.cheerAt;
    const cheer =
      cheerAge >= 0 && cheerAge < 1.2 ? Math.abs(Math.sin((cheerAge / 1.2) * Math.PI * 2)) : 0;
    const flinchAge = now - this.wrongAt;
    const flinch = flinchAge >= 0 && flinchAge < 0.5 ? Math.sin((flinchAge / 0.5) * Math.PI) : 0;
    mesh.position.copy(base);
    mesh.position.addScaledVector(DIRECTION, lunge * 0.25 - flinch * 0.25);
    mesh.position.y += bob + cheer * 0.45;
    mesh.rotation.set(0, yaw, -lunge * 0.12 + flinch * 0.1 + (calm ? 0 : Math.sin(t * 1.1) * 0.03));
    this.fairyShadow.scale.setScalar(1 - (bob + cheer * 0.45) * 0.4);
    // Three first-try answers in a row: a golden glow gathers round her.
    const glowing = frame.streak >= 3 && frame.started;
    const halo = this.halo.material;
    halo.opacity = MathUtils.lerp(
      halo.opacity,
      glowing ? 0.55 + (calm ? 0 : Math.sin(t * 3) * 0.12) : 0,
      0.08,
    );
    this.halo.position.copy(mesh.position).add(new Vector3(0.1, FAIRY_HEIGHT * 0.5, -0.05));
    if (glowing && !calm && Math.random() < 0.25) {
      const tip = this.wandTip();
      this.colour.set('#fff3a0');
      this.sparks.emit(
        tip.x,
        tip.y,
        tip.z,
        (Math.random() - 0.5) * 0.4,
        0.4,
        0,
        this.colour,
        0.8,
        -0.2,
      );
    }
  }

  private updateMonster(frame: CastleFrame, now: number, t: number, calm: boolean, yaw: number) {
    const target = STEP_S[Math.min(frame.approach, 2)];
    let s = target;
    let hop = 0;
    let squash = 0;
    let tilt = 0;
    // A step closer after a mistake: a wobble, then two heavy stomps.
    const stepAge = now - this.stepAt;
    if (stepAge < 0) s = this.stepFrom;
    else if (stepAge < 0.5) {
      const k = smooth(stepAge / 0.5);
      s = MathUtils.lerp(this.stepFrom, target, k);
      hop = Math.abs(Math.sin(k * Math.PI * 2)) * 0.28;
    } else if (stepAge < 0.6) this.stomp(this.stepAt);
    // Past every stone: a rush to the gate, then knocked back to where it started.
    const rushAge = now - this.rushAt;
    if (rushAge < 0) s = this.stepFrom;
    else if (rushAge < RUSH_IN) {
      const k = easeOut(rushAge / RUSH_IN);
      s = MathUtils.lerp(this.stepFrom, RUSH_S, k);
      hop = Math.abs(Math.sin(k * Math.PI * 3)) * 0.22;
    } else if (this.rushStay) {
      s = RUSH_S;
      if (rushAge < RUSH_IN + 0.1) this.stomp(this.rushAt);
    } else if (rushAge < RUSH_IN + KNOCK_BACK) {
      if (rushAge < RUSH_IN + 0.1) this.stomp(this.rushAt);
      const k = (rushAge - RUSH_IN) / KNOCK_BACK;
      s = MathUtils.lerp(RUSH_S, START_S, easeOut(k));
      hop = Math.sin(k * Math.PI) * 0.9;
      tilt = Math.sin(k * Math.PI) * 0.5;
    }
    // A new monster trots in from the forest.
    const walkAge = now - this.walkInAt;
    let walking = false;
    if (walkAge >= -0.2 && walkAge < 1) {
      walking = true;
      const k = smooth(Math.max(0, walkAge));
      s = MathUtils.lerp(WAIT_S, START_S, k);
      hop = Math.abs(Math.sin(k * Math.PI * 4)) * 0.18;
    }
    this.monsterS = s;
    const across = walking ? MathUtils.lerp(-0.9, 0, smooth(Math.max(0, walkAge))) : 0;
    const position = along(s, across);
    // Idle: a soft bounce, faster and twitchier as the timer runs down.
    const urgency = frame.pressure;
    const idle =
      calm || !frame.started
        ? 0
        : Math.abs(Math.sin(t * (2.2 + urgency * 4))) * (0.06 + urgency * 0.06);
    const wrongAge = now - this.wrongAt;
    if (wrongAge >= 0 && wrongAge < 0.5) tilt += Math.sin((wrongAge / 0.5) * Math.PI * 3) * 0.16;
    // The burst: a quick swell, then gone in a flash.
    const rightAge = now - this.rightAt;
    const shieldOnly = this.shieldAt === this.rightAt && this.rightAt >= 0;
    let scale = 1;
    if (rightAge >= 0 && rightAge < 2.2 && !shieldOnly) {
      scale =
        rightAge < 0.12
          ? 1 + rightAge * 1.2
          : Math.max(0, 1.15 - easeOut((rightAge - 0.12) / 0.2) * 1.15);
      if (rightAge > 0.32) this.gone = true;
    } else if (shieldOnly && rightAge >= 0 && rightAge < 0.6) {
      squash = Math.sin((rightAge / 0.6) * Math.PI) * 0.12;
      tilt += Math.sin((rightAge / 0.6) * Math.PI * 2) * 0.08;
    }
    if (walking) this.gone = false;
    const hidden = this.gone && !walking;
    this.monsterGroup.visible = !hidden;
    this.monsterGroup.position.copy(position);
    this.monsterGroup.position.y = hop + idle;
    this.monster.mesh.rotation.set(0, yaw, tilt);
    this.monster.mesh.scale.set(
      this.monster.height * this.monster.aspect * scale * (1 + squash),
      this.monster.height * scale * (1 - squash),
      1,
    );
    this.monsterShadow.visible = !hidden;
    this.monsterShadow.position.set(position.x, 0.02, position.z);
    this.monsterShadow.scale.setScalar((frame.boss ? 1.3 : 1) * scale * (1 - (hop + idle) * 0.5));
    for (const [index, ring] of this.rings.entries())
      ring.rotation.y = calm ? index : t * (0.5 + index * 0.15) * (index % 2 ? -1 : 1);
    // The badge rides above its head while a sum is open.
    const badgeOn =
      frame.started &&
      !hidden &&
      (frame.phase === 'ready' || frame.phase === 'casting' || frame.phase === 'wrong') &&
      !walking;
    this.badge.visible = badgeOn;
    this.badgeLabel.update(frame.badge);
    const pulse = urgency > 0.6 && !calm ? 1 + Math.sin(t * 9) * 0.06 : 1;
    const size = this.badgeSize * pulse;
    this.badge.scale.set(0.62 * size, 0.5 * size, 1);
    this.badge.position
      .copy(position)
      .setY(
        this.monsterGroup.position.y + this.monster.height * scale + 0.07 + 0.25 * this.badgeSize,
      );
    // Waiting in line at the forest's edge.
    const waiting = !!frame.waiting && frame.phase !== 'complete';
    const show = waiting && !(walking && walkAge < 0.6);
    this.waiting.mesh.visible = show;
    this.waitingShadow.visible = show;
    const appear = walking ? smooth((walkAge - 0.6) / 0.4) : 1;
    this.waiting.mesh.position.copy(along(WAIT_S, -0.9));
    this.waiting.mesh.position.y = calm ? 0 : Math.abs(Math.sin(t * 1.6 + 1)) * 0.05;
    this.waiting.mesh.rotation.set(0, yaw, 0);
    this.waiting.mesh.scale.set(
      this.waiting.height * this.waiting.aspect * appear,
      this.waiting.height * appear,
      1,
    );
    // Posts the monster has passed burn red.
    for (const [index, { top, light }] of this.markers.entries()) {
      const danger = frame.started && s <= MARKER_S[index] + 0.05;
      top.material.color.set(danger ? '#ff3d5e' : '#ffd23f');
      light.material.color.set(danger ? '#ff3d5e' : '#ffcf4d');
      const pulse = danger && !calm ? 1 + Math.sin(t * 6) * 0.2 : 1;
      light.scale.setScalar((danger ? 1.1 : 0.8) * pulse);
      top.rotation.y = calm ? 0 : t * 1.2 + index;
    }
  }

  private stomp(at: number) {
    if (this.dustAt === at) return;
    this.dustAt = at;
    const p = this.monsterGroup.position;
    this.colour.set('#efe2c4');
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      this.dust.emit(
        p.x + Math.cos(a) * 0.4,
        0.12,
        p.z + Math.sin(a) * 0.3,
        Math.cos(a) * 1.4,
        0.4 + Math.random() * 0.4,
        Math.sin(a) * 0.8,
        this.colour,
        0.7,
        0.4,
        0.8,
      );
    }
  }
  private dustAt = -99;

  private updateGem(now: number, calm: boolean) {
    const age = now - this.castAt;
    if (this.landed || age < 0) {
      this.gem.visible = this.gemGlow.visible = false;
      return;
    }
    const k = Math.min(1, age / FLIGHT);
    const to = this.chest();
    const position = this.castFrom.clone().lerp(to, smooth(k));
    position.y += Math.sin(k * Math.PI) * 1.1;
    this.gem.position.copy(position);
    this.gemGlow.position.copy(position);
    this.gem.material.rotation = calm ? 0 : Math.sin(age * 20) * 0.2;
    this.gemGlow.material.opacity = 0.75;
    // A trail of sparks and soft glow behind it.
    if (Math.random() < 0.6)
      this.glows.emit(position.x, position.y, position.z, 0, 0, 0, this.castColour, 0.3, 0, 0.5);
    for (let i = 0; i < 4; i++)
      this.sparks.emit(
        position.x + (Math.random() - 0.5) * 0.12,
        position.y + (Math.random() - 0.5) * 0.12,
        position.z,
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.5,
        0,
        i ? this.castColour : this.colour.set('#ffffff'),
        0.45,
        -0.3,
      );
    if (k >= 1) {
      this.landed = true;
      this.gem.visible = this.gemGlow.visible = false;
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        this.sparks.emit(
          to.x,
          to.y,
          to.z,
          Math.cos(a) * 2.2,
          Math.sin(a) * 2.2,
          0.3,
          this.castColour,
          0.5,
          1.5,
        );
      }
      this.glows.emit(to.x, to.y, to.z, 0, 0, 0, this.castColour, 0.35);
    } else {
      this.gem.visible = this.gemGlow.visible = true;
    }
  }

  /**
   * When a monster reaches the gate, one of the castle's hearts rises over it, cracks and
   * falls apart in two halves. The HUD keeps the count; this is the moment of losing one.
   */
  private updateHearts(now: number) {
    const age = now - this.crackAt;
    const active = this.crackAt >= 0 && age >= 0 && age < CRACK;
    const top = this.gate.position.clone().setY(GATE_TOP + 0.5);
    const rise = easeOutBack(Math.min(1, age / 0.3));
    this.heart.visible = active && age < CRACK_AT;
    this.heart.position.copy(top).setY(top.y - 0.6 + rise * 0.6);
    this.heart.scale.setScalar(0.8 * rise * (1 + Math.max(0, Math.sin(age * 18)) * 0.06));
    if (active && age >= CRACK_AT && !this.cracked) {
      this.cracked = true;
      this.ripple.visible = true;
      this.colour.set('#ff5c9a');
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        this.sparks.emit(
          top.x,
          top.y,
          top.z,
          Math.cos(a) * 2.2,
          Math.sin(a) * 2.2,
          0,
          this.colour,
          0.7,
          2,
        );
      }
    }
    for (const [side, half] of this.halves.entries()) {
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
    const rippleAge = age - CRACK_AT;
    if (this.ripple.visible && rippleAge >= 0 && rippleAge < 0.8) {
      this.ripple.position.copy(this.gate.position).setY(0.1);
      this.ripple.rotation.x = -Math.PI / 2;
      this.ripple.scale.setScalar(0.5 + easeOut(rippleAge / 0.8) * 2.4);
      this.ripple.material.opacity = 1 - rippleAge / 0.8;
    } else this.ripple.visible = false;
    // The gate shudders when the monster reaches it.
    const jolt = shake(now, this.crackAt, 0.5, 0.06);
    this.gate.position.copy(GATE_SPOT).add(new Vector3(jolt, 0, 0));
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
        this.colour.set('#ffe27a');
        this.sparks.emit(
          mesh.position.x,
          mesh.position.y + size * 0.4,
          mesh.position.z,
          0,
          -0.3,
          0,
          this.colour,
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
    for (const [index, seed] of this.fireflySeeds.entries()) {
      const base = along(
        -1 + ((seed * 7.1) % 11),
        -2.6 + ((seed * 3.3) % 5.5),
        0.5 + ((seed * 1.9) % 3),
      );
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
    // Petals drift across and loop round.
    for (const [index, petal] of this.petalState.entries()) {
      if (!calm) {
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
    // The pennants on the towers flutter.
    for (const child of this.gate.children)
      if (child.name === 'flag')
        child.rotation.y = calm ? 0.3 : Math.sin(t * 3 + child.position.x) * 0.35;
  }

  private firework() {
    const at = along(Math.random() * 6 - 0.5, -1.5 - Math.random() * 2, 3.6 + Math.random() * 1.5);
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
