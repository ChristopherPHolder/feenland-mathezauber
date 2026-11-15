import { Mesh, MeshBasicMaterial, RingGeometry, Vector3 } from 'three';
import { Stage } from '../../shared/three/stage';
import type { StateWorld } from '../../shared/three/three-stage';
import { CAP_COLORS } from './drum-frame';
import { buildPom, MushroomKit, MushroomView, Pom, SKIN_Y } from './drum-models';

const DEG = Math.PI / 180;
/** One bounce, in seconds: Pom stands for the first part of it and hops for the rest. */
export const BOUNCE_SECONDS = 0.62;
/** The share of a bounce Pom spends standing on the drum before the next hop. */
const STAND = 0.35;
/** Pom bounces 1 → 2 → 3 → 2 → 1 …, so he never has to jump back across the row. */
const ORDER = [0, 1, 2, 1] as const;
const GAP = 2.6;
const HEIGHTS = [1.0, 1.35, 1.0];
const NUMBERS = ['10', '20', '30'];
/** How long the drum ring takes to spread after a landing, in seconds. */
const RING_SECONDS = 0.45;
const PITCH = 16;
/** See potion-loader-world: the shared "Loading…" pill's top sits about this far below centre. */
const PILL_CLEAR = 52;
const FRAME_POINTS: readonly Vector3[] = [
  new Vector3(-GAP - 1.25, 0, 0),
  new Vector3(GAP + 1.25, 0, 0),
  new Vector3(-GAP - 1.25, 1.6, 0),
  new Vector3(GAP + 1.25, 1.6, 0),
  new Vector3(0, 3.6, 0),
  new Vector3(0, 0, 1.3),
];

/**
 * Where a bounce stands at time `t`: the mushroom Pom stands on or jumps from, the one he jumps
 * to, how far through the hop he is (null while standing), and how far the drum ring under
 * him has spread since he landed (null once it has faded).
 */
export function bouncePhase(t: number) {
  const bounce = Math.floor(t / BOUNCE_SECONDS);
  const into = t / BOUNCE_SECONDS - bounce;
  const from = ORDER[((bounce % ORDER.length) + ORDER.length) % ORDER.length];
  const to = ORDER[(((bounce + 1) % ORDER.length) + ORDER.length) % ORDER.length];
  const hop = into >= STAND ? (into - STAND) / (1 - STAND) : null;
  const age = into * BOUNCE_SECONDS;
  const ring = age < RING_SECONDS ? age / RING_SECONDS : null;
  return { bounce, from, to, hop, ring };
}

/**
 * The mushroom drums' loading scene: Pom bounces in rhythm across three drum-mushrooms
 * marked 10, 20 and 30, and a ring spreads from each drum he lands on. Under calm motion he
 * stands posed on the middle drum.
 */
export class DrumLoaderWorld extends Stage implements StateWorld<null> {
  private readonly kit = new MushroomKit();
  private readonly mushrooms: MushroomView[] = [];
  private readonly pom: Pom;
  private readonly ring: Mesh<RingGeometry, MeshBasicMaterial>;
  private readonly probe = new Vector3();
  private readonly a = new Vector3();
  private readonly b = new Vector3();

  constructor(canvas: HTMLCanvasElement, host: HTMLElement) {
    super(canvas, host, { fov: 34 });
    this.fill.intensity = 1.7;
    this.sun.position.set(-3, 9, 7);
    HEIGHTS.forEach((height, index) => {
      const view = this.kit.build(CAP_COLORS[index], height, false);
      view.group.position.set((index - 1) * GAP, 0, 0);
      view.label.update(NUMBERS[index]);
      this.mushrooms.push(view);
      this.scene.add(view.group);
    });
    this.pom = buildPom();
    this.pom.group.rotation.y = 0.5;
    this.scene.add(this.pom.group);
    this.ring = new Mesh(
      new RingGeometry(0.78, 0.92, 40),
      new MeshBasicMaterial({ color: '#ffe27a', transparent: true, depthWrite: false }),
    );
    this.ring.rotation.x = -Math.PI / 2 + 0.2;
    this.scene.add(this.ring);
  }

  setState(_: null) {}

  protected override layout(aspect: number) {
    this.camera.clearViewOffset();
    super.layout(aspect);
    // As big as fits in the space above the loader's "Loading…" pill, the stems' feet just above it.
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
      1.5 + Math.sin(PITCH * DEG) * distance,
      Math.cos(PITCH * DEG) * distance,
    );
    camera.lookAt(0, 1.5, 0);
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

  /** The middle of drum `index`'s skin. */
  private top(index: number, target: Vector3) {
    const view = this.mushrooms[index];
    return target.set(view.group.position.x, view.top, SKIN_Y * Math.sin(0.2));
  }

  protected update(_dt: number, t: number) {
    if (this.calm) {
      this.top(1, this.a);
      this.pom.group.position.copy(this.a);
      this.pom.body.scale.set(1, 1, 1);
      this.ring.visible = false;
      this.mushrooms.forEach((view) => view.head.scale.set(1, 1, 1));
      return;
    }
    const { from, to, hop, ring } = bouncePhase(t);
    this.top(from, this.a);
    this.top(to, this.b);
    let lift = 0;
    let squash = 0;
    let stretch = 0;
    if (hop !== null) {
      this.pom.group.position.lerpVectors(this.a, this.b, hop);
      lift = 4 * 1.1 * hop * (1 - hop);
      stretch = Math.sin(hop * Math.PI) * 0.12;
    } else {
      this.pom.group.position.copy(this.a);
      const age = (t % BOUNCE_SECONDS) / BOUNCE_SECONDS / STAND;
      squash = 0.24 * Math.exp(-age * 5);
    }
    this.pom.group.position.y += lift;
    this.pom.group.rotation.y = to > from ? 1.9 : to < from ? -1.9 : 0.5;
    this.pom.body.scale.set(
      1 + squash * 0.5 - stretch * 0.4,
      1 - squash + stretch,
      1 + squash * 0.5 - stretch * 0.4,
    );
    this.pom.ripple(squash > 0.02 ? squash * 3 : 0, t);
    this.mushrooms.forEach((view, index) => {
      const dip = index === from && ring !== null ? 0.12 * (1 - ring) : 0;
      view.head.scale.set(1 + dip * 0.4, 1 - dip, 1 + dip * 0.4);
    });
    this.ring.visible = ring !== null;
    if (ring !== null) {
      this.ring.position.set(this.a.x, this.a.y + 0.06, this.a.z);
      this.ring.scale.setScalar(1 + ring * 1.6);
      this.ring.material.opacity = 0.9 * (1 - ring);
    }
  }

  override dispose() {
    for (const view of this.mushrooms) this.kit.release(view);
    this.kit.dispose();
    super.dispose();
  }
}
