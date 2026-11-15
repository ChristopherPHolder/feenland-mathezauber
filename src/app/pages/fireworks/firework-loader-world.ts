import {
  AdditiveBlending,
  CanvasTexture,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SRGBColorSpace,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three';
import { easeOut, smooth } from '../../shared/three/motion';
import { Stage } from '../../shared/three/stage';
import type { StateWorld } from '../../shared/three/three-stage';
import { HUES } from './firework-levels';

const DEG = Math.PI / 180;
/** One rocket, rise and bloom, takes this long; the scene loops on this beat. */
export const LOOP_SECONDS = 2.6;
const RISE_END = 0.3;
const BLOOM_END = 0.9;
/** Where the rocket starts, and where it blooms. */
const FROM = new Vector3(-0.75, 0.4, -0.1);
const AT = new Vector3(0, 2.55, 0);
const RING = 1.05;
const SPARKS = 14;
/** The camera looks down a little, from this many degrees up. */
const PITCH = 8;
/** The shared loader's "Loading…" pill sits about this many pixels under the centre line. */
const PILL_CLEAR = 52;
/** The outline that must stay in view: the round dusk window and its sliver of lake. */
const FRAME_POINTS: readonly Vector3[] = [
  new Vector3(-2.05, 1.7, -0.6),
  new Vector3(2.05, 1.7, -0.6),
  new Vector3(0, 3.8, -0.6),
  new Vector3(0, -0.1, -0.6),
];

/**
 * Where a loop stands at time `t`: how far the rocket has risen (null once it has burst), and how
 * far the bloom has opened and faded (null before the burst). Which loop it is picks the colour.
 */
export function rocketPhase(t: number) {
  const loop = Math.floor(t / LOOP_SECONDS);
  const into = t / LOOP_SECONDS - loop;
  const rise = into < RISE_END ? into / RISE_END : null;
  const bloom =
    into >= RISE_END && into < BLOOM_END ? (into - RISE_END) / (BLOOM_END - RISE_END) : null;
  return { loop, rise, bloom };
}

/** How bright a bloom is as it opens (0 → 1): it glows up smoothly and dims away, never blinks. */
export function bloomGlow(bloom: number) {
  return bloom < 0.2 ? smooth(bloom / 0.2) : 1 - smooth((bloom - 0.45) / 0.55);
}

function glowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const c = canvas.getContext('2d')!;
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.4)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 64, 64);
  const map = new CanvasTexture(canvas);
  map.colorSpace = SRGBColorSpace;
  return map;
}

function skyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 128;
  const c = canvas.getContext('2d')!;
  const g = c.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, '#140f3a');
  g.addColorStop(0.55, '#3b2a6e');
  g.addColorStop(0.78, '#b06f88');
  g.addColorStop(0.8, '#3a3570');
  g.addColorStop(1, '#16163a');
  c.fillStyle = g;
  c.fillRect(0, 0, 4, 128);
  const map = new CanvasTexture(canvas);
  map.colorSpace = SRGBColorSpace;
  return map;
}

/**
 * The Firework Show's loading scene: a round window of dusk sky over a sliver of lake, where a
 * rocket rises from the jetty and blooms into a soft ring of sparks, a new colour each time.
 * Under calm motion it holds one posed frame with the ring open.
 */
export class FireworkLoaderWorld extends Stage implements StateWorld<null> {
  private readonly glow = glowTexture();
  private readonly rocket = new Group();
  private readonly sparks: Sprite[] = [];
  private readonly reflections: Sprite[] = [];
  private readonly sparkMaterial: SpriteMaterial;
  private readonly mirrorMaterial: SpriteMaterial;
  private readonly trail: Sprite[] = [];
  private readonly probe = new Vector3();

  constructor(canvas: HTMLCanvasElement, host: HTMLElement) {
    super(canvas, host, { fov: 34 });
    const sky = new Mesh(
      new CircleGeometry(2.05, 64),
      new MeshBasicMaterial({ map: skyTexture() }),
    );
    sky.position.set(0, 1.7, -0.6);
    this.scene.add(sky);

    // A little jetty with the launch tube.
    const wood = new MeshStandardMaterial({ color: '#8a5a36', roughness: 0.85 });
    const deck = new Mesh(new CylinderGeometry(0.5, 0.5, 0.08, 4), wood);
    deck.scale.set(1.2, 1, 0.5);
    deck.rotation.y = Math.PI / 4;
    deck.position.set(FROM.x, FROM.y - 0.2, FROM.z);
    const tube = new Mesh(
      new CylinderGeometry(0.09, 0.1, 0.32, 12),
      new MeshStandardMaterial({ color: '#2f8f9a' }),
    );
    tube.position.set(FROM.x, FROM.y - 0.02, FROM.z);
    this.scene.add(deck, tube);

    const body = new Mesh(
      new CylinderGeometry(0.05, 0.05, 0.26, 10),
      new MeshStandardMaterial({ color: '#ffd45c', emissive: '#6b4a00' }),
    );
    const tip = new Mesh(
      new ConeGeometry(0.06, 0.12, 10),
      new MeshStandardMaterial({ color: '#7cc8ff', emissive: '#1d4a6b' }),
    );
    tip.position.y = 0.19;
    this.rocket.add(body, tip);
    this.scene.add(this.rocket);

    const material = (opacity: number) =>
      new SpriteMaterial({
        map: this.glow,
        transparent: true,
        opacity,
        depthWrite: false,
        blending: AdditiveBlending,
      });
    this.sparkMaterial = material(1);
    this.mirrorMaterial = material(0.3);
    for (let i = 0; i < SPARKS; i++) {
      const spark = new Sprite(this.sparkMaterial);
      spark.scale.setScalar(0.3);
      const twin = new Sprite(this.mirrorMaterial);
      twin.scale.set(0.3, 0.1, 1);
      this.sparks.push(spark);
      this.reflections.push(twin);
      this.scene.add(spark, twin);
    }
    for (let i = 0; i < 6; i++) {
      const bit = new Sprite(
        new SpriteMaterial({
          map: this.glow,
          color: '#ffe9c4',
          transparent: true,
          depthWrite: false,
          blending: AdditiveBlending,
        }),
      );
      bit.scale.setScalar(0.16 - i * 0.015);
      this.trail.push(bit);
      this.scene.add(bit);
    }
  }

  setState(_: null) {}

  protected override layout(aspect: number) {
    this.camera.clearViewOffset();
    super.layout(aspect);
    // As big as fits in the space above the loader's "Loading…" pill, resting just above it.
    const { width, height } = this;
    const top = height * 0.06;
    const floor = height / 2 + PILL_CLEAR;
    const room = { x: width * 0.9, y: floor - top };
    let distance = 6;
    let box = this.aim(distance);
    while ((box.right - box.left > room.x || box.bottom - box.top > room.y) && distance < 80) {
      distance *= 1.03;
      box = this.aim(distance);
    }
    const centre = (box.left + box.right) / 2 - width / 2;
    this.camera.setViewOffset(width, height, centre, box.bottom - floor, width, height);
  }

  /** Puts the camera `distance` away and returns the scene's box on screen, in pixels. */
  private aim(distance: number) {
    const camera = this.camera;
    camera.position.set(
      0,
      1.7 + Math.sin(PITCH * DEG) * distance,
      Math.cos(PITCH * DEG) * distance,
    );
    camera.lookAt(0, 1.7, 0);
    camera.updateMatrixWorld();
    const box = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
    for (const point of FRAME_POINTS) {
      const { x, y } = this.probe.copy(point).project(camera);
      const px = ((x + 1) / 2) * this.width;
      const py = ((1 - y) / 2) * this.height;
      box.left = Math.min(box.left, px);
      box.right = Math.max(box.right, px);
      box.top = Math.min(box.top, py);
      box.bottom = Math.max(box.bottom, py);
    }
    return box;
  }

  protected update(_: number, t: number) {
    if (this.calm) {
      // A still frame: the ring open and glowing, the rocket resting in its tube.
      this.rocket.position.copy(FROM);
      this.trail.forEach((bit) => (bit.visible = false));
      this.place(0.55, 1, HUES[0]);
      return;
    }
    const { loop, rise, bloom } = rocketPhase(t);
    const color = HUES[loop % HUES.length];
    this.rocket.visible = rise !== null;
    if (rise !== null) {
      const e = easeOut(rise);
      this.rocket.position.set(
        FROM.x + (AT.x - FROM.x) * smooth(rise),
        FROM.y + (AT.y - FROM.y) * e,
        FROM.z + (AT.z - FROM.z) * rise,
      );
      this.rocket.rotation.z = -0.25 * (1 - rise);
    }
    this.trail.forEach((bit, i) => {
      bit.visible = rise !== null && rise > i * 0.06;
      if (!bit.visible) return;
      const back = Math.max(0, rise! - (i + 1) * 0.06);
      bit.position.set(
        FROM.x + (AT.x - FROM.x) * smooth(back),
        FROM.y + (AT.y - FROM.y) * easeOut(back) - 0.12,
        FROM.z,
      );
      (bit.material as SpriteMaterial).opacity = 0.8 - i * 0.12;
    });
    if (bloom === null) {
      this.place(0, 0, color);
      return;
    }
    this.place(easeOut(bloom / 0.6), bloomGlow(bloom), color, bloom * 0.35);
  }

  /** Puts the ring's sparks `open` (0–1) of the way out, at brightness `glow`. */
  private place(open: number, glow: number, color: string, droop = 0) {
    this.sparkMaterial.color.set(color);
    this.sparkMaterial.opacity = glow;
    this.mirrorMaterial.color.set(new Color(color));
    this.mirrorMaterial.opacity = glow * 0.35;
    this.sparks.forEach((spark, i) => {
      const angle = (i / SPARKS) * Math.PI * 2;
      const x = AT.x + Math.cos(angle) * RING * open;
      const y = AT.y + Math.sin(angle) * RING * open - droop;
      spark.position.set(x, y, AT.z);
      spark.visible = glow > 0.01;
      // The lake mirrors the ring, squashed.
      const twin = this.reflections[i];
      twin.position.set(x, 0.4 - (y - 0.47) * 0.15, -0.55);
      twin.visible = spark.visible;
    });
  }

  override dispose() {
    this.glow.dispose();
    super.dispose();
  }
}
