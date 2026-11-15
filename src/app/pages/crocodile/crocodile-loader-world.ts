import {
  CircleGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  RingGeometry,
  SphereGeometry,
  Vector3,
} from 'three';
import { Stage } from '../../shared/three/stage';
import type { StateWorld } from '../../shared/three/three-stage';
import { easeOut, smooth } from '../../shared/three/motion';
import { Kiki } from './pond-kiki';
import { makeLilyPad } from './pond-life';

const DEG = Math.PI / 180;
/** One bob-and-snap takes this long; everything else repeats on the same beat, so it loops. */
export const SNAP_SECONDS = 2;
/** Where in the beat the jaws clap shut and the ripple starts. */
const SNAP_AT = 0.72;
/** The first snap lands this soon after the scene appears. */
const FIRST_SNAP = 0.25;
const POND_RADIUS = 2.3;
/** The camera looks down on the pond from this many degrees above the water. */
const PITCH = 34;
/** Lily pads float clear of the ripples, even as they rock. */
const PAD_Y = 0.06;
const RIPPLES = 3;
/** Roughly where the tip of her snout meets the water, for the splash. */
const SNOUT_X = 0.75;
const SNOUT_Z = 1.2;
const DROPS = 5;
/**
 * The shared loader centres its "Loading…" pill a little below the middle, with its top about
 * this many pixels under the centre line; the pond ends there, so the pill sits on clear ground.
 */
const PILL_CLEAR = 52;
/** The bank all round, and the tip of Kiki's open snout: what must stay in view. */
const FRAME_POINTS = [
  ...Array.from({ length: 16 }, (_, index) => {
    const angle = (index / 16) * Math.PI * 2;
    return new Vector3(Math.sin(angle), 0, Math.cos(angle)).multiplyScalar(POND_RADIUS + 0.22);
  }),
  new Vector3(0.5, 1.2, 0.7),
];

/**
 * How far open Kiki's jaws are at `phase` seconds into a beat, 0 (shut) to 1 (wide): she opens
 * wide, waits, claps shut on the beat, chews twice and rests. Starts and ends shut, so the beat
 * repeats without a jump.
 */
export function snapJaw(phase: number): number {
  const p = ((phase % SNAP_SECONDS) + SNAP_SECONDS) % SNAP_SECONDS;
  if (p < 0.35) return smooth(p / 0.35);
  if (p < SNAP_AT - 0.08) return 1;
  if (p < SNAP_AT) return 1 - smooth((p - (SNAP_AT - 0.08)) / 0.08);
  if (p < SNAP_AT + 0.5) return Math.max(0, Math.sin(((p - SNAP_AT) / 0.25) * Math.PI)) * 0.22;
  return 0;
}

/** Seconds since the last snap at `phase` seconds into a beat. */
export function sinceSnap(phase: number): number {
  return (((phase - SNAP_AT) % SNAP_SECONDS) + SNAP_SECONDS) % SNAP_SECONDS;
}

/**
 * The loading view's little pond: Kiki bobbing in a round of water, snapping her jaws open and
 * shut on a steady beat, with ripples spreading past the lily pads after every snap. The water
 * floats on the loader's own colour (no sky), and calm motion holds her still with a smile.
 */
export class CrocodileLoaderWorld extends Stage implements StateWorld<null> {
  private readonly kiki = new Kiki();
  private readonly ripples: Mesh<RingGeometry, MeshBasicMaterial>[] = [];
  private readonly drops: Mesh[] = [];
  private readonly pads: Group[] = [];
  private readonly probe = new Vector3();
  private readonly dropMaterial = new MeshBasicMaterial({ color: '#ffffff', transparent: true });

  constructor(canvas: HTMLCanvasElement, host: HTMLElement) {
    super(canvas, host, { fov: 36 });
    this.sun.position.set(-3, 10, 7);
    this.fill.intensity = 1.35;

    const pond = new Group();
    const bank = new Mesh(
      new CircleGeometry(POND_RADIUS + 0.22, 64),
      new MeshStandardMaterial({ color: '#7cc47f', roughness: 0.8 }),
    );
    const water = new Mesh(
      new CircleGeometry(POND_RADIUS, 64),
      new MeshStandardMaterial({ color: '#8fd0ec', roughness: 0.35 }),
    );
    bank.rotation.x = water.rotation.x = -Math.PI / 2;
    bank.position.y = -0.02;
    // A soft dark patch under her, so she sits in the water rather than on it.
    const shade = new Mesh(
      new CircleGeometry(1, 24),
      new MeshBasicMaterial({
        color: '#2f7fa6',
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      }),
    );
    shade.rotation.x = -Math.PI / 2;
    shade.position.set(0, 0.01, 0.05);
    shade.scale.set(0.62, 0.95, 1);
    pond.add(bank, water, shade);

    // Two pads of each tone share one set of materials.
    const padTones = [makeLilyPad('#4ca25f'), makeLilyPad('#5fb86c')];
    const used = new Set<Group>();
    for (const [x, z, size, turn, tone] of PADS) {
      const source = padTones[tone]!;
      const pad = used.has(source) ? source.clone() : source;
      used.add(source);
      pad.position.set(x, PAD_Y, z);
      pad.scale.setScalar(size);
      pad.rotation.y = turn;
      this.pads.push(pad);
      pond.add(pad);
    }
    const flower = new Mesh(
      new SphereGeometry(0.11, 10, 8),
      new MeshStandardMaterial({ color: '#ff8fb6', roughness: 0.5 }),
    );
    flower.position.set(0.25, 0.08, -0.1);
    flower.scale.set(1, 0.6, 1);
    this.pads[0]!.add(flower);

    const ring = new RingGeometry(0.9, 1, 64);
    for (let i = 0; i < RIPPLES; i++) {
      const ripple = new Mesh(
        ring,
        new MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false }),
      );
      ripple.rotation.x = -Math.PI / 2;
      ripple.position.y = 0.01;
      this.ripples.push(ripple);
      pond.add(ripple);
    }
    const drop = new SphereGeometry(1, 8, 6);
    for (let i = 0; i < DROPS; i++) {
      const mesh = new Mesh(drop, this.dropMaterial);
      mesh.visible = false;
      this.drops.push(mesh);
      pond.add(mesh);
    }

    // Facing the camera, turned a little so her long snout shows when she opens wide.
    this.kiki.body.rotation.y = 0.55;
    this.kiki.root.scale.setScalar(1.55);
    lighten(this.kiki.root);
    pond.add(this.kiki.root);
    this.scene.add(pond);
  }

  setState(_: null) {}

  protected override layout(aspect: number) {
    this.camera.clearViewOffset();
    super.layout(aspect);
    // As big as fits in the space above the loader's "Loading…" pill, its bank resting just
    // above the pill.
    const { width, height } = this;
    const top = height * 0.06;
    const floor = height / 2 + PILL_CLEAR;
    const room = { x: width * 0.92, y: floor - top };
    let distance = 4;
    let box = this.aim(distance);
    while ((box.right - box.left > room.x || box.bottom - box.top > room.y) && distance < 60) {
      distance *= 1.03;
      box = this.aim(distance);
    }
    const shift = box.bottom - floor;
    this.camera.setViewOffset(width, height, 0, shift, width, height);
  }

  /** Puts the camera `distance` away and returns the pond's box on screen, in pixels. */
  private aim(distance: number) {
    const camera = this.camera;
    camera.position.set(0, Math.sin(PITCH * DEG) * distance, Math.cos(PITCH * DEG) * distance);
    camera.lookAt(0, 0.25, 0.35);
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

  protected update(dt: number, t: number) {
    const kiki = this.kiki;
    if (this.calm) {
      // A still, happy pose: jaws shut with her smile, the ripples at rest, a very slow breath.
      kiki.jaw = 0;
      kiki.root.position.y = 0;
      kiki.body.scale.set(1, 1 + Math.sin(t * 1.1) * 0.012, 1);
      kiki.body.rotation.x = 0;
      for (const [index, ripple] of this.ripples.entries()) {
        ripple.scale.setScalar(1 + index * 0.5);
        ripple.material.opacity = 0.28 - index * 0.08;
      }
      for (const drop of this.drops) drop.visible = false;
      for (const pad of this.pads) {
        pad.position.y = PAD_Y;
        pad.rotation.z = 0;
      }
      kiki.animate(t, dt, true, 0, 0);
      return;
    }

    const phase = t + SNAP_AT - FIRST_SNAP;
    const since = sinceSnap(phase);
    const beat = (phase / SNAP_SECONDS) * Math.PI * 2;
    kiki.jaw = snapJaw(phase);
    // She bobs on the beat and dips into the water as the jaws clap.
    const dip = since < 0.4 ? Math.sin((since / 0.4) * Math.PI) * 0.08 : 0;
    kiki.root.position.y = Math.sin(beat) * 0.06 - dip;
    kiki.body.rotation.x = -kiki.jaw * 0.1 + dip * 0.6;
    kiki.body.scale.set(1, 1, 1);
    kiki.animate(t, dt, false, 0.15, Math.sin(beat * 0.5) * 0.5);

    // A ripple leaves her after each snap; the older ones spread past the lily pads and fade.
    for (const [index, ripple] of this.ripples.entries()) {
      const age = (since + index * SNAP_SECONDS) / (SNAP_SECONDS * RIPPLES);
      ripple.scale.setScalar(0.7 + easeOut(age) * (POND_RADIUS - 0.75));
      ripple.material.opacity = 0.5 * (1 - age) * smooth(age * 12);
    }
    // A few drops fly up from the snap and fall back.
    const flight = since / 0.55;
    this.dropMaterial.opacity = 0.9 * Math.max(0, 1 - flight);
    for (const [index, drop] of this.drops.entries()) {
      drop.visible = flight < 1;
      if (!drop.visible) continue;
      const angle = (index / DROPS) * Math.PI * 2 + 0.4;
      const reach = 0.35 + flight * 0.55;
      drop.position.set(
        SNOUT_X + Math.sin(angle) * reach,
        0.15 + Math.sin(flight * Math.PI) * 0.6,
        SNOUT_Z + Math.cos(angle) * reach,
      );
      drop.scale.setScalar(0.065 * (1 - flight * 0.5));
    }
    // The pads rock gently as the ripples pass under them.
    for (const [index, pad] of this.pads.entries()) {
      const wave = Math.sin(beat - index * 1.3);
      pad.position.y = PAD_Y + wave * 0.02;
      pad.rotation.z = wave * 0.04;
    }
  }
}

/** Lily pads round Kiki: x, z, size, turn, tone. */
const PADS: readonly [number, number, number, number, number][] = [
  [-1.5, 0.55, 0.42, 0.4, 0],
  [1.45, -0.75, 0.48, 2.3, 1],
  [0.2, -1.75, 0.3, 4.1, 1],
  [-0.65, 1.65, 0.3, 5.2, 0],
];

/**
 * Swaps Kiki's smooth spheres for lighter ones. The loader only shows her for a moment, so she
 * can draw with about half the triangles and still look round.
 */
function lighten(root: Object3D) {
  const light = new SphereGeometry(1, 14, 10);
  const heavy = new Set<SphereGeometry>();
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const geometry = object.geometry;
    if (geometry instanceof SphereGeometry && geometry.parameters.widthSegments > 14) {
      heavy.add(geometry);
      object.geometry = light;
    }
  });
  for (const geometry of heavy) geometry.dispose();
}
