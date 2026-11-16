import {
  AdditiveBlending,
  Blending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  NormalBlending,
  Object3D,
  Path,
  PlaneGeometry,
  Points,
  PointsMaterial,
  RepeatWrapping,
  Shape,
  SphereGeometry,
  SRGBColorSpace,
  Texture,
  TextureLoader,
} from 'three';

/** Where each painting's figure sits inside its image, so feet land on the path. */
interface Art {
  readonly size: readonly [number, number];
  /** Opaque bounds: left, top, right, bottom in pixels. */
  readonly box: readonly [number, number, number, number];
}
export const ART: Record<string, Art> = {
  fairy: { size: [1536, 1024], box: [196, 14, 1408, 997] },
  boss: { size: [1312, 1199], box: [9, 6, 1306, 1179] },
  butterfly: { size: [1374, 1145], box: [25, 13, 1356, 1132] },
  'monster-red': { size: [1278, 1230], box: [46, 34, 1225, 1153] },
  'monster-blue': { size: [1146, 1372], box: [65, 13, 1137, 1353] },
  'monster-green': { size: [1312, 1199], box: [197, 38, 1234, 1136] },
  'monster-purple': { size: [1293, 1216], box: [276, 6, 1042, 1196] },
};
/** The five gems in crystals.webp, left to right: ruby, sapphire, amber, amethyst, emerald. */
export const GEM_COLOURS = ['#ff5c9a', '#4f9dff', '#ffbf3c', '#b277ff', '#3fd17f'];
/** The same gem a spell button shows: 1 and 6 are ruby, 5 and 10 emerald, 0 ruby. */
export const gemIndex = (spell: number | null) => ((spell ?? 1) === 0 ? 0 : ((spell ?? 1) - 1) % 5);

export const COLOURS = {
  stone: '#f4e7c9',
  stoneShade: '#dccaa2',
  roof: '#e9799f',
  roofDeep: '#c95482',
  gold: '#ffd23f',
  wood: '#8a5a33',
  trunk: '#7a5232',
  leaf: ['#5fbf6f', '#4aa35c', '#7ccf6a', '#3f8a4b'],
  cypress: '#2f7a4f',
  grass: '#8ccf68',
  rock: '#cfc4ad',
  flower: ['#ff8fb8', '#ffffff', '#f06d9d', '#ffd6e6', '#c9a2ff'],
  fog: '#c4e2b4',
};

const loader = new TextureLoader();
const textures = new Map<string, Promise<Texture>>();
/** Loads a painting once and shares it between everything that wears it. */
export function painting(name: string): Promise<Texture> {
  let texture = textures.get(name);
  if (!texture) {
    const url = new URL(`images/fairy-defense/${name}.webp`, document.baseURI).href;
    texture = loader.loadAsync(url).then((loaded) => {
      loaded.colorSpace = SRGBColorSpace;
      loaded.anisotropy = 4;
      return loaded;
    });
    textures.set(name, texture);
  }
  return texture;
}
/** Forget the shared paintings; the stage disposes the GPU copies with the scene. */
export function forgetPaintings() {
  textures.clear();
}

/**
 * A painted character standing on the ground: a plane cropped to the figure, its feet at the
 * origin, turned to face the camera by the world each frame.
 */
export class Billboard {
  readonly mesh: Mesh<PlaneGeometry, MeshBasicMaterial>;
  /** The figure's width over its height, once its painting is known. */
  aspect = 1;
  name = '';
  private request = 0;

  constructor(
    name: string,
    /** Height in metres. */
    public height: number,
  ) {
    const geometry = new PlaneGeometry(1, 1);
    geometry.translate(0, 0.5, 0);
    this.mesh = new Mesh(
      geometry,
      new MeshBasicMaterial({
        transparent: true,
        alphaTest: 0.03,
        depthWrite: false,
        side: DoubleSide,
        visible: false,
      }),
    );
    this.wear(name);
  }

  /** Changes the painting (a new monster walking in), keeping the height. */
  wear(name: string) {
    if (name === this.name) return;
    this.name = name;
    const art = ART[name] ?? ART['monster-red'];
    const [width, height] = art.size;
    const [left, top, right, bottom] = art.box;
    this.aspect = (right - left) / (bottom - top);
    const uv = this.mesh.geometry.getAttribute('uv') as BufferAttribute;
    // PlaneGeometry corners: top-left, top-right, bottom-left, bottom-right; textures flip Y.
    const u0 = left / width;
    const u1 = right / width;
    const v0 = 1 - bottom / height;
    const v1 = 1 - top / height;
    uv.setXY(0, u0, v1);
    uv.setXY(1, u1, v1);
    uv.setXY(2, u0, v0);
    uv.setXY(3, u1, v0);
    uv.needsUpdate = true;
    this.resize();
    const request = ++this.request;
    void painting(name).then((texture) => {
      if (request !== this.request) return;
      this.mesh.material.map = texture;
      this.mesh.material.visible = true;
      this.mesh.material.needsUpdate = true;
    });
  }

  resize(height = this.height) {
    this.height = height;
    this.mesh.scale.set(height * this.aspect, height, 1);
  }
}

/** A soft round glow, white in the middle, for sparks, fireflies and halos. */
export function glowTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const c = canvas.getContext('2d')!;
  const gradient = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.25, 'rgba(255,255,255,0.85)');
  gradient.addColorStop(0.6, 'rgba(255,255,255,0.25)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = gradient;
  c.fillRect(0, 0, 64, 64);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** A dark soft disc laid under a character instead of a real shadow. */
export function blobShadow(texture: Texture, width: number): Mesh {
  const shadow = new Mesh(
    new PlaneGeometry(width, width * 0.42),
    new MeshBasicMaterial({
      map: texture,
      color: '#1d3b24',
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.015;
  return shadow;
}

const HEART = new Path2D('M16 27S2 19 2 10a7 7 0 0 1 14-3 7 7 0 0 1 14 3c0 9-14 17-14 17Z');
/** A castle heart: whole, lost (grey), or one half of a cracked one. */
export function heartTexture(kind: 'full' | 'empty' | 'left' | 'right'): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const c = canvas.getContext('2d')!;
  c.translate(8, 10);
  c.scale(3.5, 3.5);
  if (kind === 'left' || kind === 'right') {
    // A zigzag crack down the middle; each half keeps its side of it.
    const crack = new Path2D();
    const zig = [
      [16, 4],
      [13, 11],
      [18, 16],
      [14, 22],
      [16, 28],
    ];
    const edge = kind === 'left' ? -2 : 34;
    crack.moveTo(edge, 0);
    for (const [x, y] of zig) crack.lineTo(x, y);
    crack.lineTo(edge, 30);
    crack.closePath();
    c.clip(crack);
  }
  c.fillStyle = kind === 'empty' ? '#e3dace' : '#e0285f';
  c.strokeStyle = kind === 'empty' ? '#746c64' : '#8b173b';
  c.lineWidth = 2;
  c.lineJoin = 'round';
  c.fill(HEART);
  c.stroke(HEART);
  if (kind !== 'empty') {
    c.fillStyle = 'rgba(255,255,255,0.55)';
    c.beginPath();
    c.ellipse(9, 9, 3, 2, -0.6, 0, Math.PI * 2);
    c.fill();
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Golden cobbles like the painting's path, fading into grass along both edges. */
function cobbleTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const c = canvas.getContext('2d')!;
  c.fillStyle = '#d9b26a';
  c.fillRect(0, 0, 512, 256);
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const tones = ['#f6dc98', '#f0cf86', '#f9e3a8', '#ecc77a', '#f3d690'];
  for (let row = 0; row < 7; row++) {
    const h = 256 / 7;
    let x = -random() * 40;
    while (x < 512) {
      const w = 46 + random() * 34;
      // Stones that cross the tile's left/right edge are drawn twice so the texture repeats.
      for (const shift of [0, 512, -512]) {
        c.fillStyle = tones[Math.floor(random() * tones.length)];
        c.strokeStyle = '#b98d4a';
        c.lineWidth = 3;
        c.beginPath();
        c.roundRect(x + shift + 2, row * h + 3, w - 4, h - 6, 12);
        c.fill();
        c.stroke();
      }
      x += w;
    }
  }
  // Feather both long edges into transparency.
  c.globalCompositeOperation = 'destination-in';
  const fade = c.createLinearGradient(0, 0, 0, 256);
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(0.12, 'rgba(0,0,0,1)');
  fade.addColorStop(0.88, 'rgba(0,0,0,1)');
  fade.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = fade;
  c.fillRect(0, 0, 512, 256);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

/** Soft mottled grass. */
function grassTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const c = canvas.getContext('2d')!;
  c.fillStyle = COLOURS.grass;
  c.fillRect(0, 0, 128, 128);
  let seed = 3;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 260; i++) {
    c.fillStyle = random() > 0.5 ? 'rgba(70,140,60,0.25)' : 'rgba(190,230,120,0.3)';
    c.beginPath();
    c.ellipse(
      random() * 128,
      random() * 128,
      2 + random() * 5,
      1 + random() * 2,
      random() * 3,
      0,
      7,
    );
    c.fill();
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(18, 18);
  return texture;
}

/** The meadow and the cobbled path laid from `from` along `angle` (radians from +x). */
export function buildGround(length: number, angle: number, from: { x: number; z: number }) {
  const group = new Group();
  const ground = new Mesh(
    new PlaneGeometry(80, 80),
    new MeshLambertMaterial({ map: grassTexture() }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);
  const cobbles = cobbleTexture();
  cobbles.repeat.set(length / 3.2, 1);
  const path = new Mesh(
    new PlaneGeometry(length, 2.7),
    new MeshLambertMaterial({ map: cobbles, transparent: true, depthWrite: false }),
  );
  path.rotation.x = -Math.PI / 2;
  path.rotation.z = angle;
  path.position.set(
    from.x + (Math.cos(angle) * length) / 2,
    0.01,
    from.z - (Math.sin(angle) * length) / 2,
  );
  path.receiveShadow = true;
  group.add(path);
  return group;
}

const lambert = (color: string, flat = true) =>
  new MeshLambertMaterial({ color, flatShading: flat });

/** The castle's outer gate: two round towers with pink cone roofs and an arched wall. */
export function buildGate(): Group {
  const gate = new Group();
  const stone = lambert(COLOURS.stone, false);
  const shade = lambert(COLOURS.stoneShade, false);
  const roof = lambert(COLOURS.roof);
  const gold = lambert(COLOURS.gold);
  const towerGeometry = new CylinderGeometry(0.5, 0.56, 2.7, 14);
  const roofGeometry = new ConeGeometry(0.68, 1.2, 14);
  const ballGeometry = new SphereGeometry(0.09, 8, 6);
  const flagGeometry = new PlaneGeometry(0.42, 0.24);
  flagGeometry.translate(0.21, 0, 0);
  const flag = new MeshLambertMaterial({ color: COLOURS.roofDeep, side: DoubleSide });
  for (const side of [-1, 1]) {
    const tower = new Mesh(towerGeometry, stone);
    tower.position.set(side * 1.35, 1.35, 0);
    tower.castShadow = true;
    const cap = new Mesh(roofGeometry, roof);
    cap.position.set(side * 1.35, 3.3, 0);
    cap.castShadow = true;
    const ball = new Mesh(ballGeometry, gold);
    ball.position.set(side * 1.35, 3.95, 0);
    const pennant = new Mesh(flagGeometry, flag);
    pennant.position.set(side * 1.35, 3.85, 0);
    pennant.name = 'flag';
    // A window slit on each tower.
    const window = new Mesh(new PlaneGeometry(0.16, 0.36), lambert('#5b4a6b'));
    window.position.set(side * 1.35, 1.95, 0.565);
    gate.add(tower, cap, ball, pennant, window);
  }
  // The arched wall between the towers.
  const outline = new Shape();
  outline.moveTo(-0.95, 0);
  outline.lineTo(0.95, 0);
  outline.lineTo(0.95, 2.2);
  outline.lineTo(-0.95, 2.2);
  outline.lineTo(-0.95, 0);
  const arch = new Path();
  arch.moveTo(-0.55, 0);
  arch.lineTo(-0.55, 1.15);
  arch.absarc(0, 1.15, 0.55, Math.PI, 0, true);
  arch.lineTo(0.55, 0);
  arch.lineTo(-0.55, 0);
  outline.holes.push(arch);
  const wall = new Mesh(
    new ExtrudeGeometry(outline, { depth: 0.6, bevelEnabled: false, curveSegments: 12 }),
    [stone, shade],
  );
  wall.position.z = -0.3;
  wall.castShadow = true;
  gate.add(wall);
  // Battlements along the top.
  const merlon = new CylinderGeometry(0.13, 0.13, 0.26, 4);
  for (let i = 0; i < 4; i++) {
    const block = new Mesh(merlon, stone);
    block.position.set(-0.72 + i * 0.48, 2.33, 0);
    block.rotation.y = Math.PI / 4;
    gate.add(block);
  }
  // Warm light glowing inside the arch, and a wooden door swung open.
  const glow = new Mesh(new PlaneGeometry(1.1, 1.7), new MeshBasicMaterial({ color: '#ffe9a8' }));
  glow.position.set(0, 0.85, -0.2);
  const door = new Mesh(new PlaneGeometry(0.55, 1.5), lambert(COLOURS.wood));
  door.position.set(-0.5, 0.75, 0.25);
  door.rotation.y = 1.2;
  gate.add(glow, door);
  return gate;
}

/** A round leafy tree or a slim cypress, like the ones in the painting. */
export function buildTree(kind: 'round' | 'cypress', seed: number): Group {
  const tree = new Group();
  const trunk = new Mesh(new CylinderGeometry(0.1, 0.16, 1.1, 6), lambert(COLOURS.trunk));
  trunk.position.y = 0.55;
  trunk.castShadow = true;
  tree.add(trunk);
  if (kind === 'cypress') {
    const crown = new Mesh(new ConeGeometry(0.55, 3.2, 7), lambert(COLOURS.cypress));
    crown.position.y = 2.4;
    crown.castShadow = true;
    tree.add(crown);
    return tree;
  }
  const leaf = new IcosahedronGeometry(0.8, 0);
  for (let i = 0; i < 3; i++) {
    const clump = new Mesh(leaf, lambert(COLOURS.leaf[(seed + i) % COLOURS.leaf.length]));
    const a = seed * 1.7 + i * 2.1;
    clump.position.set(Math.cos(a) * 0.45, 1.6 + i * 0.35, Math.sin(a) * 0.35);
    clump.scale.setScalar(1 - i * 0.18);
    clump.rotation.set(a, a * 0.5, 0);
    clump.castShadow = true;
    tree.add(clump);
  }
  return tree;
}

/** A bush dotted with flowers. */
export function buildBush(seed: number, scale = 1): Group {
  const bush = new Group();
  const body = new Mesh(new IcosahedronGeometry(0.5, 1), lambert(COLOURS.leaf[seed % 4]));
  body.scale.set(1.2, 0.75, 1);
  body.position.y = 0.25;
  body.castShadow = true;
  bush.add(body);
  const blossom = new IcosahedronGeometry(0.05, 0);
  const flowers = new InstancedMesh(
    blossom,
    new MeshLambertMaterial({ color: COLOURS.flower[seed % COLOURS.flower.length] }),
    14,
  );
  const dummy = new Object3D();
  for (let i = 0; i < 14; i++) {
    const a = seed + i * 2.4;
    const up = 0.3 + (i % 4) * 0.1;
    const reach = 0.62 - (i % 4) * 0.09;
    dummy.position.set(Math.cos(a) * reach * 0.95, up, Math.sin(a) * reach * 0.75);
    dummy.scale.setScalar(0.9 + (i % 3) * 0.3);
    dummy.updateMatrix();
    flowers.setMatrixAt(i, dummy.matrix);
  }
  bush.add(flowers);
  bush.scale.setScalar(scale);
  return bush;
}

export function buildRock(seed: number, scale = 1): Mesh {
  const rock = new Mesh(new DodecahedronGeometry(0.45, 0), lambert(COLOURS.rock));
  rock.scale.set(1.3 * scale, 0.7 * scale, scale);
  rock.rotation.set(seed, seed * 2, 0);
  rock.position.y = 0.18 * scale;
  rock.castShadow = true;
  rock.receiveShadow = true;
  return rock;
}

/** A shield of crystal rings around the boss, one per right answer it takes to free him. */
export function buildShieldRing(radius: number, index: number): Mesh {
  const ring = new Mesh(
    // A faceted band looks like cut crystal.
    new CylinderGeometry(radius, radius, 0.16, 18, 1, true),
    new MeshBasicMaterial({
      color: index % 2 ? '#9fd6f2' : '#c9a2ff',
      transparent: true,
      opacity: 0.55,
      side: DoubleSide,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
  );
  return ring;
}

/** A small reusable shard for shattered shields. */
export const shardGeometry = () => new IcosahedronGeometry(0.09, 0);

/**
 * A pool of glowing particles in one draw call: sparks, trails, fireflies, dust. Each fades out
 * over its life; dead ones park far below the ground.
 */
export class Sparks {
  readonly points: Points<BufferGeometry, PointsMaterial>;
  private readonly position: Float32Array;
  private readonly colour: Float32Array;
  private readonly velocity: Float32Array;
  private readonly life: Float32Array;
  private readonly age: Float32Array;
  private readonly weight: Float32Array;
  private readonly alpha: Float32Array;
  private cursor = 0;

  constructor(
    private readonly capacity: number,
    size: number,
    map: Texture,
    blending: Blending = AdditiveBlending,
  ) {
    this.position = new Float32Array(capacity * 3).fill(-50);
    this.colour = new Float32Array(capacity * 4);
    this.velocity = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.age = new Float32Array(capacity).fill(1);
    this.weight = new Float32Array(capacity);
    this.alpha = new Float32Array(capacity);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(this.position, 3));
    geometry.setAttribute('color', new BufferAttribute(this.colour, 4));
    this.points = new Points(
      geometry,
      new PointsMaterial({
        size,
        map,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending,
      }),
    );
    this.points.frustumCulled = false;
  }

  emit(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    colour: Color,
    life: number,
    /** Pull downward in m/s²; negative floats up. */
    gravity = 0,
    alpha = 1,
  ) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.capacity;
    this.position.set([x, y, z], i * 3);
    this.velocity.set([vx, vy, vz], i * 3);
    this.colour.set([colour.r, colour.g, colour.b, alpha], i * 4);
    this.life[i] = life;
    this.age[i] = 0;
    this.weight[i] = gravity;
    this.alpha[i] = alpha;
  }

  update(dt: number) {
    for (let i = 0; i < this.capacity; i++) {
      if (this.age[i] >= this.life[i]) continue;
      this.age[i] += dt;
      const p = i * 3;
      if (this.age[i] >= this.life[i]) {
        this.position[p + 1] = -50;
        this.colour[i * 4 + 3] = 0;
        continue;
      }
      this.velocity[p + 1] -= this.weight[i] * dt;
      this.velocity[p] *= 1 - 1.2 * dt;
      this.velocity[p + 2] *= 1 - 1.2 * dt;
      this.position[p] += this.velocity[p] * dt;
      this.position[p + 1] += this.velocity[p + 1] * dt;
      this.position[p + 2] += this.velocity[p + 2] * dt;
      const left = 1 - this.age[i] / this.life[i];
      this.colour[i * 4 + 3] =
        this.alpha[i] * Math.min(1, left * 2.5) * Math.min(1, this.age[i] * 12 + 0.3);
    }
    this.points.geometry.getAttribute('position').needsUpdate = true;
    this.points.geometry.getAttribute('color').needsUpdate = true;
  }
}

export const dustBlending = NormalBlending;

/** Releases geometries and materials of objects taken out of the scene. */
export function release(object: Object3D) {
  object.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    child.geometry.dispose();
    const materials: Material[] = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) material.dispose();
  });
}
