import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  NoColorSpace,
  OctahedronGeometry,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three';
import { Stage } from '../../shared/three/stage';
import type { StateWorld } from '../../shared/three/three-stage';
import { Pony, RAINBOW } from './race-pony';

/** How fast Lumi gallops, in track units a second: a happy canter, not a flat-out sprint. */
const GALLOP = 4.2;
/** How fast the ground slides back, matched to a planted hoof so she grips and does not skate. */
const GROUND_SPEED = 6;
/** The strip of track she runs on, along x, and how wide it is. */
const STRIP_LENGTH = 7;
const STRIP_WIDTH = 1.9;
const STRIP_CENTRE = -0.3;
/** The rainbow trails from just behind the tail. */
const RIBBON_START = -0.62;
const RIBBON_HEIGHT = 1.02;
const RIBBON_LENGTH = 2.5;
const RIBBON_SEGMENTS = 18;
const BAND = 0.085;
/** Trackside posts drift past behind the lane and wrap round. */
const POSTS = 3;
const POST_SPACING = STRIP_LENGTH / POSTS;
const SPARKLES = 6;
/** Seconds of gallop run before the first frame, so Lumi is mid-stride the moment she shows. */
const PRIME_SECONDS = 1.1;
/** What the picture must hold: the pony, the ribbon behind her and a little room round both. */
const FRAME_HEIGHT = 3;
const LOOK_Y = 1.15;
/** A wide box shows the whole ribbon; a tall phone crops its faded end and centres on Lumi. */
const WIDE = { width: 5, x: -0.4 };
const NARROW = { width: 3.7, x: 0.05 };

/**
 * The race's loading scene: Lumi gallops on the spot along a looping strip of her pink lane,
 * mane and tail streaming, with a rainbow ribbon waving behind her and sparkles drifting off it.
 * It reuses the race's own pony, so it is the same unicorn the child is about to race with.
 * Under calm motion she holds one pleasant mid-gallop pose and nothing moves.
 */
export class RaceLoaderWorld extends Stage implements StateWorld<null> {
  private readonly pony = new Pony('player');
  private readonly lane: CanvasTexture;
  private readonly ribbon: Mesh<BufferGeometry, MeshBasicMaterial>;
  private readonly ribbonRest: Float32Array;
  private readonly posts: Group[] = [];
  private readonly sparkles: Mesh[] = [];
  private readonly shadow: Mesh;
  private travelled = 0;

  constructor(canvas: HTMLCanvasElement, host: HTMLElement) {
    super(canvas, host, { fov: 36 });
    this.sun.position.set(-3, 9, 7);
    this.sun.intensity = 2.1;
    this.fill.intensity = 0.7;
    this.scene.add(new HemisphereLight('#ffffff', '#ffd9e8', 1.3));

    // Lumi runs to the right, turned a little toward us so her face and horn show.
    this.pony.root.rotation.y = -Math.PI / 2 - 0.32;
    this.scene.add(this.pony.root);

    this.lane = laneTexture();
    const fade = endFade();
    const strip = new Mesh(
      new PlaneGeometry(STRIP_LENGTH, STRIP_WIDTH),
      new MeshBasicMaterial({ map: this.lane, alphaMap: fade, transparent: true }),
    );
    strip.rotation.x = -Math.PI / 2;
    strip.position.x = STRIP_CENTRE;
    this.scene.add(strip);

    this.shadow = new Mesh(
      new CircleGeometry(1, 20),
      new MeshBasicMaterial({ map: softSpot(), transparent: true, depthWrite: false }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.set(0.05, 0.005, 0);
    this.shadow.scale.set(1.15, 0.5, 1);
    this.scene.add(this.shadow);

    const curb = new MeshLambertMaterial({ color: '#ff9fc6' });
    const pennant = new MeshLambertMaterial({ color: '#ffffff' });
    const pole = new CylinderGeometry(0.05, 0.06, 0.8, 8).translate(0, 0.4, 0);
    const flag = new ConeGeometry(0.13, 0.26, 4).translate(0, 0.95, 0);
    for (let index = 0; index < POSTS; index++) {
      const post = new Group();
      post.add(new Mesh(pole, curb), new Mesh(flag, pennant));
      post.position.z = -STRIP_WIDTH / 2 + 0.05;
      this.posts.push(post);
      this.scene.add(post);
    }

    this.ribbon = rainbowRibbon();
    this.ribbonRest = Float32Array.from(this.ribbon.geometry.getAttribute('position').array);
    this.ribbon.position.set(RIBBON_START, RIBBON_HEIGHT, -0.32);
    this.scene.add(this.ribbon);

    const star = new OctahedronGeometry(0.055, 0);
    const gold = new MeshBasicMaterial({ color: '#ffe27a' });
    const white = new MeshBasicMaterial({ color: '#ffffff' });
    for (let index = 0; index < SPARKLES; index++) {
      const sparkle = new Mesh(star, index % 2 ? white : gold);
      this.sparkles.push(sparkle);
      this.scene.add(sparkle);
    }

    // Run the gallop on for a moment before anything is drawn, so the very first frame is
    // already mid-stride with the mane streaming, never a pony standing still.
    for (let step = 0; step < PRIME_SECONDS * 60; step++) this.animate(1 / 60, step / 60);
  }

  setState(_: null) {}

  protected update(dt: number, t: number) {
    if (this.calm) return;
    this.animate(dt, PRIME_SECONDS + t);
  }

  /** Frames the pony and her ribbon so both fit, whether the box is tall, wide or square. */
  protected override layout(aspect: number) {
    const camera = this.camera;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    const halfTan = Math.tan((camera.fov * Math.PI) / 360);
    const wide = Math.max(0, Math.min(1, (aspect - 0.5) / 0.9));
    const width = NARROW.width + (WIDE.width - NARROW.width) * wide;
    const lookX = NARROW.x + (WIDE.x - NARROW.x) * wide;
    const distance = Math.max(FRAME_HEIGHT / 2 / halfTan, width / 2 / (halfTan * aspect));
    // A little above and in front, the way a spectator at the rail would see her.
    camera.position.set(lookX + distance * 0.12, LOOK_Y + distance * 0.24, distance);
    camera.lookAt(lookX, LOOK_Y - 0.05, 0);
  }

  private animate(dt: number, now: number) {
    this.pony.update({
      now,
      dt,
      speed: GALLOP,
      moving: true,
      waiting: false,
      stumbling: false,
      celebrating: false,
      cheering: false,
    });
    this.travelled += dt * GROUND_SPEED;

    // The lane's arrows slide back under the hooves.
    this.lane.offset.x = (this.travelled / (STRIP_LENGTH / 2)) % 1;

    // A soft shadow that tightens as she lifts off the ground.
    const lift = Math.max(0, Math.sin(now * GALLOP * 2.4 + 1.2));
    this.shadow.scale.set(1.15 - lift * 0.08, 0.5 - lift * 0.04, 1);

    // Posts drift past and wrap round, growing in and shrinking out at the strip's ends.
    const half = STRIP_LENGTH / 2;
    this.posts.forEach((post, index) => {
      const along = (index * POST_SPACING - this.travelled) % STRIP_LENGTH;
      const x = ((along + STRIP_LENGTH) % STRIP_LENGTH) - half;
      post.position.x = STRIP_CENTRE + x;
      post.scale.setScalar(Math.max(0.001, Math.min(1, (half - Math.abs(x)) / 0.8)));
    });

    // The ribbon ripples, still where it leaves her and freer toward its tail.
    const positions = this.ribbon.geometry.getAttribute('position') as BufferAttribute;
    const rest = this.ribbonRest;
    for (let vertex = 0; vertex < positions.count; vertex++) {
      const x = rest[vertex * 3];
      const freedom = -x / RIBBON_LENGTH;
      const wave = Math.sin(now * 7 + x * 2.4) * 0.16 * freedom;
      const sway = Math.sin(now * 3.1 + x * 1.3) * 0.08 * freedom;
      positions.setY(vertex, rest[vertex * 3 + 1] + wave);
      positions.setZ(vertex, rest[vertex * 3 + 2] + sway);
    }
    positions.needsUpdate = true;
    this.ribbon.position.y = RIBBON_HEIGHT + lift * 0.06;

    // Sparkles shed from the ribbon drift back, twinkle and fade out.
    this.sparkles.forEach((sparkle, index) => {
      const life = (now * 0.55 + index / SPARKLES) % 1;
      const x = RIBBON_START - 0.3 - life * RIBBON_LENGTH * 0.95;
      const band = (index * 7) % 6;
      sparkle.position.set(
        x,
        RIBBON_HEIGHT + 0.4 - band * BAND + Math.sin(now * 7 + x * 2.4) * 0.16 * life + life * 0.15,
        -0.2 + (index % 3) * 0.06,
      );
      sparkle.rotation.set(now * 2 + index, now * 3, 0);
      sparkle.scale.setScalar(Math.sin(life * Math.PI) * (0.8 + 0.4 * Math.sin(now * 12 + index)));
    });
  }
}

/** The pink lane with its white edges and arrows pointing the way she runs. */
function laneTexture(): CanvasTexture {
  const texture = painted(256, 128, (context) => {
    context.fillStyle = '#ffd9e8';
    context.fillRect(0, 0, 256, 128);
    context.fillStyle = '#ff9fc6';
    context.fillRect(0, 0, 256, 12);
    context.fillRect(0, 116, 256, 12);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 12, 256, 4);
    context.fillRect(0, 112, 256, 4);
    for (const left of [40, 168]) {
      context.beginPath();
      context.moveTo(left + 48, 64);
      context.lineTo(left, 40);
      context.lineTo(left + 18, 40);
      context.lineTo(left + 66, 64);
      context.lineTo(left + 18, 88);
      context.lineTo(left, 88);
      context.closePath();
      context.fill();
    }
  });
  texture.wrapS = RepeatWrapping;
  texture.repeat.set(2, 1);
  return texture;
}

/** An alpha ramp that softens both ends of the strip, so it fades into the loader's colour. */
function endFade(): CanvasTexture {
  const texture = painted(128, 4, (context) => {
    const ramp = context.createLinearGradient(0, 0, 128, 0);
    ramp.addColorStop(0, '#000');
    ramp.addColorStop(0.22, '#fff');
    ramp.addColorStop(0.78, '#fff');
    ramp.addColorStop(1, '#000');
    context.fillStyle = ramp;
    context.fillRect(0, 0, 128, 4);
  });
  texture.colorSpace = NoColorSpace;
  return texture;
}

/** A round soft-edged spot for the shadow under the hooves. */
function softSpot(): CanvasTexture {
  return painted(64, 64, (context) => {
    const spot = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    spot.addColorStop(0, 'rgba(120, 60, 110, 0.28)');
    spot.addColorStop(1, 'rgba(120, 60, 110, 0)');
    context.fillStyle = spot;
    context.fillRect(0, 0, 64, 64);
  });
}

/**
 * Six stacked colour bands in one mesh, running back from x = 0 to -RIBBON_LENGTH and fading
 * out toward the tail through per-vertex alpha.
 */
function rainbowRibbon(): Mesh<BufferGeometry, MeshBasicMaterial> {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const columns = RIBBON_SEGMENTS + 1;
  RAINBOW.forEach((hex, band) => {
    const [r, g, b] = rgb(hex);
    const top = (RAINBOW.length / 2 - band) * BAND;
    const start = positions.length / 3;
    for (let column = 0; column < columns; column++) {
      const along = column / RIBBON_SEGMENTS;
      const x = -along * RIBBON_LENGTH;
      // Narrow where it leaves her, widest midway, and fading out at the far end.
      const swell = 0.55 + 0.45 * Math.sin(Math.min(1, along * 1.6) * (Math.PI / 2));
      const alpha = Math.min(1, (1 - along) * 1.8);
      positions.push(x, top * swell, 0, x, (top - BAND) * swell, 0);
      colors.push(r, g, b, alpha, r, g, b, alpha);
    }
    for (let column = 0; column < RIBBON_SEGMENTS; column++) {
      const a = start + column * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 4));
  geometry.setIndex(indices);
  return new Mesh(
    geometry,
    new MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      side: DoubleSide,
      depthWrite: false,
    }),
  );
}

function rgb(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  // Linear values, since vertex colours skip the sRGB decode a material colour gets.
  const linear = (channel: number) => ((channel / 255 + 0.055) / 1.055) ** 2.4;
  return [linear((value >> 16) & 255), linear((value >> 8) & 255), linear(value & 255)];
}

function painted(
  width: number,
  height: number,
  paint: (context: CanvasRenderingContext2D) => void,
): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (context) paint(context);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
