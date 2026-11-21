import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import { easeOutBack } from '../../shared/three/motion';
import { Stage } from '../../shared/three/stage';
import type { StateWorld } from '../../shared/three/three-stage';
import { swing } from './scales-math';

const DEG = Math.PI / 180;
/** One weight drops in this long, then the next; after three the scale starts over. */
export const DROP_SECONDS = 0.9;
const DROPS = 3;
export const LOOP_SECONDS = DROP_SECONDS * (DROPS + 1.5);
/** The loader's "Loading…" pill sits about this many pixels under the centre line. */
const PILL_CLEAR = 52;
const FRAME_POINTS: readonly Vector3[] = [
  new Vector3(-2.3, 0, 0.6),
  new Vector3(2.3, 0, 0.6),
  new Vector3(-2.3, 2.6, 0),
  new Vector3(2.3, 2.6, 0),
];

/**
 * How many weights sit on the right pan at time `t`, and how far the newest one has dropped
 * (0 just appearing, 1 resting). A pumpkin on the left pan weighs as much as all three.
 */
export function dropState(t: number): { count: number; fall: number } {
  const into = t % LOOP_SECONDS;
  const count = Math.min(DROPS, Math.floor(into / DROP_SECONDS));
  const fall = count >= DROPS ? 1 : (into % DROP_SECONDS) / DROP_SECONDS;
  return { count, fall };
}

/** Where the beam settles with `weights` of three on the right pan, in radians. */
export function loaderTilt(weights: number): number {
  return ((DROPS - weights) / DROPS) * 0.28;
}

/**
 * The kitchen's loading scene: a little brass balance with a pumpkin on one pan, rocking as
 * three weights drop onto the other until it sits level. Under calm motion it holds level.
 */
export class ScalesLoaderWorld extends Stage implements StateWorld<null> {
  private readonly beam = new Group();
  private readonly pans: Group[] = [];
  private readonly weights: Mesh[] = [];
  private readonly probe = new Vector3();
  private angle = loaderTilt(0);
  private speed = 0;

  constructor(canvas: HTMLCanvasElement, host: HTMLElement) {
    super(canvas, host, { fov: 34 });
    this.fill.intensity = 1.6;
    this.sun.position.set(-3, 9, 7);
    const brass = new MeshStandardMaterial({ color: '#d8ac45', metalness: 0.6, roughness: 0.35 });
    const base = new Mesh(new CylinderGeometry(0.6, 0.75, 0.2, 24), brass);
    base.position.y = 0.1;
    const column = new Mesh(new CylinderGeometry(0.08, 0.1, 2.2, 12), brass);
    column.position.y = 1.2;
    this.beam.position.y = 2.3;
    const bar = new Mesh(new BoxGeometry(3.6, 0.12, 0.14), brass);
    this.beam.add(bar);
    for (const side of [-1, 1]) {
      const pan = new Group();
      pan.position.x = side * 1.75;
      const dish = new Mesh(new CylinderGeometry(0.62, 0.45, 0.12, 24), brass);
      dish.position.y = -1.05;
      const rod = new Mesh(new CylinderGeometry(0.02, 0.02, 1, 6), brass);
      rod.position.y = -0.5;
      pan.add(dish, rod);
      this.beam.add(pan);
      this.pans.push(pan);
    }
    const pumpkin = new Mesh(
      new SphereGeometry(0.42, 20, 14),
      new MeshStandardMaterial({ color: '#f0952e', roughness: 0.7 }),
    );
    pumpkin.scale.set(1, 0.78, 1);
    pumpkin.position.y = -0.66;
    this.pans[0].add(pumpkin);
    const iron = new MeshStandardMaterial({ color: '#c9a24a', metalness: 0.7, roughness: 0.35 });
    for (let index = 0; index < DROPS; index++) {
      const weight = new Mesh(new CylinderGeometry(0.16, 0.2, 0.26, 16), iron);
      weight.position.set((index - 1) * 0.36, -0.86, 0);
      this.pans[1].add(weight);
      this.weights.push(weight);
    }
    this.scene.add(base, column, this.beam);
  }

  setState(_: null) {}

  protected override layout(aspect: number) {
    this.camera.clearViewOffset();
    super.layout(aspect);
    // As big as fits above the loader's "Loading…" pill.
    const { width, height } = this;
    const floor = height / 2 + PILL_CLEAR;
    const room = { x: width * 0.85, y: floor - height * 0.08 };
    let distance = 6;
    let box = this.aim(distance);
    while ((box.right - box.left > room.x || box.bottom - box.top > room.y) && distance < 80) {
      distance *= 1.04;
      box = this.aim(distance);
    }
    const centre = (box.left + box.right) / 2 - width / 2;
    this.camera.setViewOffset(width, height, centre, box.bottom - floor, width, height);
  }

  private aim(distance: number) {
    const camera = this.camera;
    camera.position.set(0, 1.3 + Math.sin(12 * DEG) * distance, Math.cos(12 * DEG) * distance);
    camera.lookAt(0, 1.3, 0);
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
    const calm = this.calm;
    const { count, fall } = calm ? { count: DROPS, fall: 1 } : dropState(t);
    this.weights.forEach((weight, index) => {
      const shown = index < count || (index === count && count < DROPS);
      weight.visible = shown;
      const drop = index === count ? easeOutBack(fall) : 1;
      weight.position.y = -0.86 + (1 - drop) * 1.4;
    });
    const target = loaderTilt(count);
    if (calm) this.angle = target;
    else ({ angle: this.angle, speed: this.speed } = swing(this.angle, this.speed, target, dt));
    this.beam.rotation.z = this.angle;
    for (const pan of this.pans) pan.rotation.z = -this.angle;
  }
}
