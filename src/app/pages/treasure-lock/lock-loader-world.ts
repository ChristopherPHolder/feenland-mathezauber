import {
  Box2,
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  ClampToEdgeWrapping,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  SphereGeometry,
  SRGBColorSpace,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three';
import { easeOutBack, smooth } from '../../shared/three/motion';
import { Stage } from '../../shared/three/stage';
import { StateWorld } from '../../shared/three/three-stage';
import { buildChest } from './lock-chest';

/** Radius of the ring of number tiles. */
const RING = 2.2;
/** Tiles on the loading dial; one full turn is this many clicks. */
const TILES = 12;
/** Seconds between clicks, and how long each click takes to turn. */
const CLICK_EVERY = 0.55;
const CLICK_TURN = 0.28;
/** Pip's resting height beside the keyhole. */
const PIP_Y = 0.7;
/** One glint sweep across the lid, then a rest, in seconds. */
const GLINT_EVERY = 2.2;
const GLINT_SWEEP = 0.9;

const STEP = (Math.PI * 2) / TILES;
/** Share of the screen (in normalised units) the scene's outline may reach to. */
const FILL = 0.9;

/** Points on the scene's outline: the rim of the base, the chest's lid and Pip. */
const OUTLINE: readonly Vector3[] = [
  ...Array.from({ length: 24 }, (_, index) => {
    const angle = (index / 24) * Math.PI * 2;
    const radius = RING + 1.1;
    return [
      new Vector3(radius * Math.sin(angle), -0.3, radius * Math.cos(angle)),
      new Vector3(radius * Math.sin(angle), 0.05, radius * Math.cos(angle)),
    ];
  }).flat(),
  ...[-1, 1].flatMap((x) => [new Vector3(x * 1, 2, -0.75), new Vector3(x * 1, 2, 0.6)]),
  new Vector3(0.8, 1.3, RING),
];

/** How far the outline reaches from the screen's middle (1 is the edge), and its own middle. */
function extent(camera: PerspectiveCamera) {
  const box = new Box2();
  const point = new Vector3();
  for (const corner of OUTLINE) {
    point.copy(corner).project(camera);
    box.expandByPoint(new Vector2(point.x, point.y));
  }
  return {
    size: Math.max(-box.min.x, box.max.x, -box.min.y, box.max.y),
    centre: box.getCenter(new Vector2()),
  };
}

/**
 * How far the dial has turned at time `t`, in tiles: whole clicks plus the overshooting ease of
 * the click in progress. Whole turns land on whole tiles, so the dial loops without a jump.
 */
export function dialTurn(t: number): number {
  const clicks = Math.floor(t / CLICK_EVERY);
  const into = t - clicks * CLICK_EVERY;
  return clicks + easeOutBack(into / CLICK_TURN);
}

/**
 * Where the glint sits across the lid at time `t`: -1 before the sweep starts, 1 after it ends,
 * eased in between, so it rests off the lid between sweeps.
 */
export function glintSweep(t: number): number {
  const into = t % GLINT_EVERY;
  return -1 + 2 * smooth(into / GLINT_SWEEP);
}

/**
 * The treasure lock's loading scene: the chest sits inside a ring of stone number tiles that
 * click round one tile at a time, Pip the firefly hops on each click, and a golden glint sweeps
 * across the lid. Under calm motion it holds one posed frame.
 */
export class LockLoaderWorld extends Stage implements StateWorld<null> {
  private readonly dial = new Group();
  private readonly lid: Group;
  private readonly crystal: Mesh;
  private readonly glint: CanvasTexture;
  private readonly pip = new Group();
  private readonly wings: Mesh[] = [];
  private readonly halo: Mesh;
  private readonly twinkle: Sprite;
  /** Starts one behind, so the first click flashes the moment the scene appears. */
  private clicks = -1;
  private clickAt = -10;

  constructor(canvas: HTMLCanvasElement, host: HTMLElement) {
    super(canvas, host, { fov: 34 });
    this.fill.intensity = 1.7;
    this.sun.position.set(3, 10, 7);

    // The stone base with a gold rim, as in the game.
    const base = new Mesh(
      new CylinderGeometry(RING + 0.95, RING + 1.05, 0.3, 32),
      new MeshStandardMaterial({ color: '#3b2f7d', roughness: 0.85 }),
    );
    base.position.y = -0.15;
    const rim = new Mesh(
      new CylinderGeometry(RING + 1.12, RING + 1.12, 0.1, 32),
      new MeshStandardMaterial({ color: '#d9ad4a', metalness: 0.7, roughness: 0.35 }),
    );
    rim.position.y = -0.3;
    const inner = new Mesh(
      new CircleGeometry(RING - 0.5, 24),
      new MeshStandardMaterial({ color: '#2a2160', roughness: 0.9 }),
    );
    inner.rotation.x = -Math.PI / 2;
    inner.position.y = 0.005;

    // The dial: number tiles, every third one taller and lighter, with numbers printed outside.
    const stone = new MeshStandardMaterial({ color: '#6a5bc0', roughness: 0.6 });
    const majorStone = new MeshStandardMaterial({ color: '#8f80e0', roughness: 0.5 });
    const tile = new BoxGeometry(0.62, 0.16, 0.5);
    const majorTile = new BoxGeometry(0.66, 0.24, 0.62);
    for (let index = 0; index < TILES; index++) {
      const major = index % 3 === 0;
      const mesh = new Mesh(major ? majorTile : tile, major ? majorStone : stone);
      const angle = index * STEP;
      mesh.position.set(RING * Math.sin(angle), major ? 0.12 : 0.08, RING * Math.cos(angle));
      mesh.rotation.y = angle;
      this.dial.add(mesh);
    }
    const numbers = new Mesh(
      new CircleGeometry(RING + 0.95, 32),
      new MeshBasicMaterial({ map: numberRing(), transparent: true, depthWrite: false }),
    );
    numbers.rotation.x = -Math.PI / 2;
    numbers.position.y = 0.006;
    this.dial.add(numbers);

    // The keyhole marker: a glowing gold ring over the front tile that flashes on each click.
    this.halo = new Mesh(
      new TorusGeometry(0.42, 0.05, 4, 24),
      new MeshBasicMaterial({ color: '#ffd84a', transparent: true }),
    );
    this.halo.rotation.x = Math.PI / 2;
    this.halo.position.set(0, 0.3, RING);

    // The chest, shared with the game, with a glint map on the lid.
    const plate = plateTexture();
    const chest = buildChest(plate, 16);
    this.lid = chest.lid;
    this.crystal = chest.crystal;
    this.glint = glintTexture();
    chest.lidMaterial.emissive.set('#ffd770');
    chest.lidMaterial.emissiveMap = this.glint;
    chest.lidMaterial.emissiveIntensity = 1.4;
    chest.chest.scale.setScalar(1.25);
    chest.chest.position.set(0, 0, -0.1);

    // Pip the firefly rides the dial just behind the keyhole.
    const body = new Mesh(
      new SphereGeometry(0.2, 12, 8),
      new MeshStandardMaterial({ color: '#ffe066', emissive: '#ffb800', emissiveIntensity: 1.4 }),
    );
    const head = new Mesh(
      new SphereGeometry(0.12, 8, 6),
      new MeshStandardMaterial({ color: '#4a3a8c', roughness: 0.6 }),
    );
    head.position.set(0, 0.16, -0.12);
    const wingMaterial = new MeshStandardMaterial({
      color: '#e8f6ff',
      transparent: true,
      opacity: 0.7,
    });
    for (const side of [-1, 1]) {
      const wing = new Mesh(new SphereGeometry(0.2, 8, 4), wingMaterial);
      wing.scale.set(1, 0.15, 0.6);
      wing.position.set(side * 0.2, 0.16, -0.05);
      this.wings.push(wing);
      this.pip.add(wing);
    }
    this.pip.add(body, head);
    this.pip.scale.setScalar(1.15);
    this.pip.position.set(0.8, PIP_Y, RING - 0.05);

    // A star that winks where the glint leaves the lid.
    this.twinkle = new Sprite(
      new SpriteMaterial({ map: starTexture(), transparent: true, depthWrite: false }),
    );
    this.twinkle.position.set(-1.05, 1.75, 0.05);

    this.scene.add(base, rim, inner, this.dial, this.halo, chest.chest, this.pip, this.twinkle);
  }

  setState(_: null) {}

  protected override layout(aspect: number) {
    super.layout(aspect);
    // Look down a little more on tall screens, so the dial fills more of the height.
    const tall = Math.min(1, Math.max(0, (1 - aspect) / 0.55));
    const elevation = ((33 + tall * 15) * Math.PI) / 180;
    const direction = new Vector3(0, Math.sin(elevation), Math.cos(elevation));
    const target = new Vector3(0, 0.6, 0);
    const place = (distance: number) => {
      this.camera.position.copy(target).addScaledVector(direction, distance);
      this.camera.lookAt(target);
      this.camera.updateMatrixWorld();
    };
    // Find the closest camera that keeps every outline point on screen, then centre them.
    for (let pass = 0; pass < 2; pass++) {
      let near = 3;
      let far = 80;
      for (let step = 0; step < 24; step++) {
        const middle = (near + far) / 2;
        place(middle);
        if (extent(this.camera).size > FILL) near = middle;
        else far = middle;
      }
      place(far);
      const { centre } = extent(this.camera);
      const halfHeight = far * Math.tan((this.camera.fov * Math.PI) / 360);
      target.addScaledVector(
        new Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1),
        centre.y * halfHeight,
      );
      target.addScaledVector(
        new Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0),
        centre.x * halfHeight * aspect,
      );
    }
  }

  protected update(dt: number, t: number) {
    if (this.calm) {
      this.pose();
      return;
    }
    // The dial clicks round clockwise under the keyhole, one tile at a time.
    const turn = dialTurn(t);
    this.dial.rotation.y = -(turn % TILES) * STEP;
    const clicks = Math.floor(t / CLICK_EVERY);
    if (clicks !== this.clicks) {
      this.clicks = clicks;
      this.clickAt = t;
    }
    const since = t - this.clickAt;
    const flash = Math.max(0, 1 - since / 0.3);
    this.halo.scale.setScalar(1 + flash * 0.25);
    (this.halo.material as MeshBasicMaterial).opacity = 0.65 + flash * 0.35;

    // Pip hops with each click; the lid gives a little rattle.
    const hop = since < 0.32 ? Math.sin((since / 0.32) * Math.PI) * 0.35 : 0;
    this.pip.position.y = PIP_Y + hop + Math.sin(t * 3) * 0.04;
    const flap = Math.sin(t * (hop ? 40 : 18)) * 0.6;
    this.wings.forEach((wing, index) => (wing.rotation.z = (index ? -1 : 1) * flap));
    this.lid.rotation.x = -Math.max(0, Math.sin(since * 30)) * 0.05 * flash;
    this.crystal.rotation.y += dt * 1.5;

    // The glint sweeps left to right, and a star winks as it leaves the lid.
    const sweep = glintSweep(t);
    this.glint.offset.y = -sweep * 0.95;
    const wink = (t % GLINT_EVERY) - GLINT_SWEEP + 0.15;
    const star = wink > 0 && wink < 0.45 ? Math.sin((wink / 0.45) * Math.PI) : 0;
    this.twinkle.scale.setScalar(star * 0.7);
    this.twinkle.material.rotation = t * 2;
  }

  /** The still frame for calm motion: dial at rest, glint parked on the lid, star shining. */
  private pose() {
    this.dial.rotation.y = -3 * STEP;
    this.halo.scale.setScalar(1);
    (this.halo.material as MeshBasicMaterial).opacity = 0.9;
    this.pip.position.y = PIP_Y;
    this.wings.forEach((wing, index) => (wing.rotation.z = (index ? -1 : 1) * 0.3));
    this.lid.rotation.x = 0;
    this.crystal.rotation.y = 0.6;
    this.glint.offset.y = -0.2;
    this.twinkle.scale.setScalar(0.55);
    this.twinkle.material.rotation = 0.3;
  }
}

function canvasTexture(
  width: number,
  height: number,
  paint: (c: CanvasRenderingContext2D) => void,
) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (context) paint(context);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** The dial's printed numbers 0 to 11, each upright when it passes the front. */
function numberRing() {
  const size = 512;
  const texture = canvasTexture(size, size, (c) => {
    const centre = size / 2;
    const radius = (centre * (RING + 0.62)) / (RING + 0.95);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (let index = 0; index < TILES; index++) {
      const major = index % 3 === 0;
      // Tile `index` sits at angle index·STEP from the front (+z), which is the canvas bottom.
      const angle = index * STEP;
      c.save();
      c.translate(centre + radius * Math.sin(angle), centre + radius * Math.cos(angle));
      c.rotate(-angle);
      c.font = `600 ${major ? 46 : 34}px Fredoka, system-ui, sans-serif`;
      c.fillStyle = major ? '#ffe9a0' : '#fff4c2';
      c.fillText(String(index), 0, 0);
      c.restore();
    }
  });
  return texture;
}

/** The keyhole plate on the chest: a gold plate with a dark keyhole. */
function plateTexture() {
  return canvasTexture(96, 64, (c) => {
    c.fillStyle = '#ffd23f';
    c.strokeStyle = '#8a5a00';
    c.lineWidth = 5;
    c.beginPath();
    c.roundRect(4, 4, 88, 56, 14);
    c.fill();
    c.stroke();
    c.fillStyle = '#3b2a07';
    c.beginPath();
    c.arc(48, 26, 8, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.moveTo(43, 30);
    c.lineTo(53, 30);
    c.lineTo(56, 50);
    c.lineTo(40, 50);
    c.closePath();
    c.fill();
  });
}

/**
 * A bright slanted band on black, used as the lid's emissive map. Its edges are black and clamp,
 * so sliding the offset carries the band across the lid and leaves the rest unlit.
 */
function glintTexture() {
  const texture = canvasTexture(16, 128, (c) => {
    c.fillStyle = '#000';
    c.fillRect(0, 0, 16, 128);
    const band = c.createLinearGradient(0, 44, 0, 84);
    band.addColorStop(0, 'rgba(255,255,255,0)');
    band.addColorStop(0.5, 'rgba(255,255,255,1)');
    band.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = band;
    c.fillRect(0, 44, 16, 40);
  });
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.center.set(0.5, 0.5);
  texture.rotation = 0.35;
  return texture;
}

/** A four-point sparkle. */
function starTexture() {
  return canvasTexture(64, 64, (c) => {
    const glow = c.createRadialGradient(32, 32, 0, 32, 32, 30);
    glow.addColorStop(0, 'rgba(255,250,220,1)');
    glow.addColorStop(0.25, 'rgba(255,220,110,0.8)');
    glow.addColorStop(1, 'rgba(255,200,60,0)');
    c.fillStyle = glow;
    c.beginPath();
    c.moveTo(32, 0);
    c.quadraticCurveTo(36, 28, 64, 32);
    c.quadraticCurveTo(36, 36, 32, 64);
    c.quadraticCurveTo(28, 36, 0, 32);
    c.quadraticCurveTo(28, 28, 32, 0);
    c.fill();
  });
}
