import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  NormalBlending,
  OctahedronGeometry,
  PlaneGeometry,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector3,
} from 'three';
import { Stage } from '../../shared/three/stage';
import type { StateWorld } from '../../shared/three/three-stage';
import { fairyPath, LAP, twinkle } from './castle-loader-path';
import { buildGate, COLOURS, GEM_COLOURS, glowTexture, Sparks } from './castle-models';

const GATE_SCALE = 0.78;
const ISLAND_RADIUS = 2.5;
/** Seconds of trail drawn before the first frame, so the scene opens mid-flight. */
const WARM_UP = 1.2;
/**
 * What every screen shape must show: the fairy at the far ends, top and front of her lap, the
 * flags, and the island's front rim. The clouds may be cropped.
 */
const KEY_POINTS = [
  new Vector3(-3, 2.4, 0),
  new Vector3(3, 2.4, 0),
  new Vector3(0, 3.2, 2.05),
  new Vector3(0, 3.2, -2.05),
  new Vector3(-2.5, -0.32, 0),
  new Vector3(2.5, -0.32, 0),
  new Vector3(0, -0.32, ISLAND_RADIUS),
];
/**
 * The screen band the key points fit in, in pixels: clear of the top and sides, and ending just
 * above the loader's "Loading…" pill, a little below the middle of the screen.
 */
const BAND = { top: 20, side: 14, belowMiddle: 56 };
const AIM_Y = 1.4;
const PITCH = 0.24;
/** Where the fairy rests on a calm screen: front right, clear of the gate. */
const CALM_PHASE = 0.18;

/** A four-pointed twinkle, white so each sparkle tints it with its own gem colour. */
function starTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const c = canvas.getContext('2d')!;
  const core = c.createRadialGradient(32, 32, 0, 32, 32, 14);
  core.addColorStop(0, 'rgba(255,255,255,1)');
  core.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = core;
  c.fillRect(0, 0, 64, 64);
  c.fillStyle = '#ffffff';
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const r = i % 2 ? 6 : 30;
    c.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
  }
  c.closePath();
  c.fill();
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Two rounded wing lobes, lilac fading to clear, hinged on the texture's left edge. */
function wingTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const c = canvas.getContext('2d')!;
  const lobe = (cx: number, cy: number, rx: number, ry: number, tilt: number) => {
    const gradient = c.createRadialGradient(8, 64, 4, 8, 64, 130);
    gradient.addColorStop(0, 'rgba(255,255,255,0.95)');
    gradient.addColorStop(0.55, 'rgba(214,190,255,0.8)');
    gradient.addColorStop(1, 'rgba(160,210,255,0.55)');
    c.fillStyle = gradient;
    c.strokeStyle = 'rgba(255,255,255,0.95)';
    c.lineWidth = 4;
    c.beginPath();
    c.ellipse(cx, cy, rx, ry, tilt, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  };
  lobe(62, 40, 56, 32, -0.45);
  lobe(48, 90, 38, 22, 0.5);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/**
 * The loading scene for the fairy castle: the castle gate on a floating grassy island, a glowing
 * fairy looping around it and leaving a trail of gem-coloured sparkles, and a gem twinkling in
 * each tower window and above the arch. Calm motion holds a posed frame with the fairy in front
 * and her trail resting behind her.
 */
export class CastleLoaderWorld extends Stage implements StateWorld<null> {
  private readonly glow = glowTexture();
  private readonly island = new Group();
  private readonly fairy = new Group();
  private readonly wings: Mesh[] = [];
  private readonly halo: Sprite;
  private readonly gems: { mesh: Mesh; light: Sprite; offset: number }[] = [];
  private readonly clouds: Group[] = [];
  private readonly trail: Sparks;
  private readonly colour = new Color();
  private readonly scratch = new Vector3();
  /** The world's own clock: it stands still while calm. */
  private clock = 0;
  private emitted = 0;

  constructor(canvas: HTMLCanvasElement, host: HTMLElement) {
    super(canvas, host, { fov: 35 });
    this.sun.position.set(5, 12, 9);
    this.sun.intensity = 2.1;
    this.fill.intensity = 1.5;

    this.buildIsland();
    this.halo = this.buildFairy();
    this.buildGems();
    this.buildClouds();
    this.trail = new Sparks(220, 0.3, starTexture(), NormalBlending);
    this.scene.add(this.island, this.fairy, this.trail.points);

    // Open mid-flight: run the last stretch of the lap so the trail is already there.
    this.clock = this.calm ? CALM_PHASE * LAP : 0;
    const step = 1 / 60;
    for (let t = -WARM_UP; t < 0; t += step) this.fly(this.clock + t, step);
    this.pose(this.clock, 0);
  }

  setState(_: null) {}

  protected update(dt: number) {
    const calm = this.calm;
    if (!calm) {
      this.clock += dt;
      this.fly(this.clock, dt);
    }
    this.pose(this.clock, calm ? this.elapsed : 0);
  }

  /**
   * Fits the castle, the fairy's whole lap and the island's grass into the band above the
   * loader's "Loading…" pill, which sits just below the middle of the screen. The island's
   * earthy underside hangs down behind the pill.
   */
  protected override layout(aspect: number) {
    const { camera, width, height } = this;
    camera.aspect = aspect;
    camera.clearViewOffset();
    const top = BAND.top;
    const bottom = height / 2 + BAND.belowMiddle;
    const roomWidth = 2 - (4 * BAND.side) / width;
    const roomHeight = (2 * (bottom - top)) / height;
    // The closest camera that still fits every key point.
    let near = 3;
    let far = 80;
    for (let step = 0; step < 24; step++) {
      const distance = (near + far) / 2;
      this.place(distance);
      const box = this.screenBox();
      if (box.right - box.left <= roomWidth && box.top - box.bottom <= roomHeight) far = distance;
      else near = distance;
    }
    this.place(far);
    // Slide the picture so the points' box is centred across and its foot rests on the band's
    // bottom: on a narrow screen the island still sits just above the pill.
    const box = this.screenBox();
    const x = ((box.left + box.right) / 2 + 1) * (width / 2) - width / 2;
    const y = (1 - box.bottom) * (height / 2) - bottom;
    camera.setViewOffset(width, height, x, y, width, height);
  }

  private place(distance: number) {
    const camera = this.camera;
    camera.position.set(0, AIM_Y + Math.sin(PITCH) * distance, Math.cos(PITCH) * distance);
    camera.lookAt(0, AIM_Y, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }

  /** The key points' bounds on screen, in normalised device units. */
  private screenBox() {
    let left = Infinity;
    let right = -Infinity;
    let bottom = Infinity;
    let top = -Infinity;
    for (const point of KEY_POINTS) {
      const p = this.scratch.copy(point).project(this.camera);
      left = Math.min(left, p.x);
      right = Math.max(right, p.x);
      bottom = Math.min(bottom, p.y);
      top = Math.max(top, p.y);
    }
    return { left, right, bottom, top };
  }

  /** Moves the fairy along her lap and sprinkles the trail behind her. */
  private fly(t: number, dt: number) {
    const { x, y, z } = fairyPath(t / LAP);
    this.emitted += dt * 85;
    while (this.emitted >= 1) {
      this.emitted -= 1;
      const gem = Math.floor(Math.random() * (GEM_COLOURS.length + 2));
      this.colour.set(gem < GEM_COLOURS.length ? GEM_COLOURS[gem] : '#fff7c2');
      const spread = () => (Math.random() - 0.5) * 0.35;
      this.trail.emit(
        x + spread() * 0.4,
        y + spread() * 0.4,
        z + spread() * 0.4,
        spread(),
        spread() + 0.1,
        spread(),
        this.colour,
        0.9 + Math.random() * 0.6,
        0.45,
        0.95,
      );
    }
    this.trail.update(dt);
  }

  /**
   * Places everything for the clock `t`. On a calm screen `breath` (seconds) only swells the
   * fairy's glow, very slowly; otherwise she flaps and the gems twinkle.
   */
  private pose(t: number, breath: number) {
    const calm = this.calm;
    const phase = t / LAP;
    const { x, y, z, lean } = fairyPath(phase);
    this.fairy.position.set(x, y, z);
    this.fairy.rotation.set(0, 0, calm ? 0.12 : lean);
    const flap = calm ? 0.55 : 0.55 + Math.sin(t * Math.PI * 2 * 5) * 0.55;
    this.wings.forEach((wing, i) => (wing.rotation.y = (i % 2 ? -1 : 1) * flap));
    const swell = calm
      ? 1 + Math.sin(breath * 0.6) * 0.05
      : 1 + Math.sin(t * Math.PI * 2 * 2.5) * 0.08;
    this.halo.scale.setScalar(1.25 * swell);

    for (const gem of this.gems) {
      const shine = calm ? 0.35 : twinkle(phase * 2, gem.offset);
      gem.light.scale.setScalar(0.42 + shine * 0.5);
      gem.light.material.opacity = 0.45 + shine * 0.55;
      gem.mesh.rotation.y = calm ? 0.4 : phase * Math.PI * 2;
    }
    this.clouds.forEach((cloud, i) => {
      cloud.position.y =
        cloud.userData['y'] + (calm ? 0 : Math.sin(phase * Math.PI * 2 + i * 2) * 0.08);
    });
    this.island.position.y = calm ? 0 : Math.sin(phase * Math.PI * 2) * 0.05;
  }

  /** A grassy disc with an earthy underside, the gate on top and a bush either side. */
  private buildIsland() {
    const grass = new Mesh(
      new CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS * 0.94, 0.32, 18),
      new MeshLambertMaterial({ color: COLOURS.grass }),
    );
    grass.position.y = -0.16;
    const earth = new Mesh(
      new ConeGeometry(ISLAND_RADIUS * 0.94, 1.25, 9),
      new MeshLambertMaterial({ color: '#c79a63', flatShading: true }),
    );
    earth.rotation.x = Math.PI;
    earth.position.y = -0.32 - 0.62;
    const gate = buildGate();
    gate.scale.setScalar(GATE_SCALE);
    gate.position.z = -0.2;
    this.island.add(grass, earth, gate);

    const leaf = new IcosahedronGeometry(0.42, 0);
    const blossom = new IcosahedronGeometry(0.07, 0);
    const flower = new MeshLambertMaterial({ color: COLOURS.flower[0] });
    for (const [side, tone] of [
      [-1, 0],
      [1, 2],
    ]) {
      const bush = new Mesh(
        leaf,
        new MeshLambertMaterial({ color: COLOURS.leaf[tone], flatShading: true }),
      );
      bush.scale.set(1.2, 0.8, 1);
      bush.position.set(side * 1.85, 0.22, 0.75);
      const bloom = new Mesh(blossom, flower);
      bloom.position.set(side * 1.75, 0.5, 1.05);
      this.island.add(bush, bloom);
    }
  }

  /** A tiny fairy: a pink dress, a head, flapping wings and a warm glow around her. */
  private buildFairy(): Sprite {
    const dress = new Mesh(
      new ConeGeometry(0.15, 0.36, 8),
      new MeshLambertMaterial({ color: COLOURS.roof }),
    );
    const head = new Mesh(
      new SphereGeometry(0.09, 10, 8),
      new MeshLambertMaterial({ color: '#ffd9c2' }),
    );
    head.position.y = 0.25;
    const hair = new Mesh(
      new SphereGeometry(0.1, 10, 8, 0, Math.PI * 2, 0, 1.4),
      new MeshLambertMaterial({ color: COLOURS.gold }),
    );
    hair.position.y = 0.265;
    const wingGeometry = new PlaneGeometry(0.42, 0.42);
    wingGeometry.translate(0.21, 0, 0);
    const wingMaterial = new MeshBasicMaterial({
      map: wingTexture(),
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    });
    for (const side of [1, -1]) {
      const wing = new Mesh(wingGeometry, wingMaterial);
      wing.scale.x = side;
      wing.position.set(0, 0.12, -0.05);
      this.wings.push(wing);
    }
    const halo = new Sprite(
      new SpriteMaterial({
        map: this.glow,
        color: '#fff2b0',
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    halo.position.y = 0.1;
    this.fairy.add(halo, dress, head, hair, ...this.wings);
    this.fairy.scale.setScalar(1.3);
    return halo;
  }

  /** A gem in each tower window and one above the arch, each with its own glow. */
  private buildGems() {
    const shape = new OctahedronGeometry(0.11, 0);
    const spots: [number, number, number][] = [
      [-1.35, 1.95, 0.62],
      [0, 2.0, 0.36],
      [1.35, 1.95, 0.62],
    ];
    spots.forEach(([x, y, z], i) => {
      const tone = GEM_COLOURS[[0, 2, 1][i]];
      const mesh = new Mesh(shape, new MeshBasicMaterial({ color: tone }));
      mesh.scale.y = 1.4;
      const light = new Sprite(
        new SpriteMaterial({ map: this.glow, color: tone, transparent: true, depthWrite: false }),
      );
      const spot = (object: Mesh | Sprite) => {
        object.position.set(x * GATE_SCALE, y * GATE_SCALE, z * GATE_SCALE - 0.2);
        this.island.add(object);
      };
      spot(light);
      spot(mesh);
      this.gems.push({ mesh, light, offset: i / 3 });
    });
  }

  /** Two soft clouds drifting by the island's edge. */
  private buildClouds() {
    const puff = new IcosahedronGeometry(0.4, 1);
    const white = new MeshLambertMaterial({
      color: '#ffffff',
      emissive: '#e8f2ff',
      emissiveIntensity: 0.4,
    });
    for (const [x, y, z, size] of [
      [-2.7, -0.55, 0.9, 1],
      [2.85, 0.15, -0.6, 0.8],
    ]) {
      const cloud = new Group();
      for (const [dx, dy, s] of [
        [-0.35, 0, 0.8],
        [0, 0.12, 1],
        [0.38, 0, 0.75],
      ]) {
        const ball = new Mesh(puff, white);
        ball.position.set(dx, dy, 0);
        ball.scale.set(s, s * 0.8, s * 0.8);
        cloud.add(ball);
      }
      cloud.scale.setScalar(size);
      cloud.position.set(x, y, z);
      cloud.userData['y'] = y;
      this.clouds.push(cloud);
      this.scene.add(cloud);
    }
  }
}
