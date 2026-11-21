import {
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Shape,
  Vector3,
} from 'three';
import { easeOutBack } from '../../shared/three/motion';
import { Stage } from '../../shared/three/stage';
import type { StateWorld } from '../../shared/three/three-stage';

const DEG = Math.PI / 180;
/** The pie fills in this long, then it starts over. */
export const FILL_SECONDS = 3;
const SLICES = 6;
const PITCH = 42;
/** The loader's "Loading…" pill sits about this many pixels under the centre line. */
const PILL_CLEAR = 52;
const FRAME_POINTS: readonly Vector3[] = [
  new Vector3(-1.7, 0, 1.2),
  new Vector3(1.7, 0, 1.2),
  new Vector3(-1.7, 0, -1.2),
  new Vector3(1.7, 0.4, -1.2),
];

/**
 * How far one slice has popped onto the pie at time `t`, from 0 (not yet) to 1 (in place).
 * Slices land one after another, and the whole pie rests a moment before it starts over.
 */
export function slicePop(t: number, index: number): number {
  const into = (t % FILL_SECONDS) / FILL_SECONDS;
  const start = 0.06 + index * 0.11;
  return Math.max(0, Math.min(1, (into - start) / 0.12));
}

/**
 * The picnic's loading scene: a checked blanket where a pie is put together slice by slice,
 * each one hopping into place. Under calm motion it holds a whole pie.
 */
export class PicnicLoaderWorld extends Stage implements StateWorld<null> {
  private readonly slices: Group[] = [];
  private readonly probe = new Vector3();

  constructor(canvas: HTMLCanvasElement, host: HTMLElement) {
    super(canvas, host, { fov: 34 });
    this.fill.intensity = 1.7;
    this.sun.position.set(-3, 9, 7);
    const blanket = new Group();
    for (let x = 0; x < 6; x++)
      for (let z = 0; z < 4; z++) {
        const square = new Mesh(
          new PlaneGeometry(0.6, 0.6),
          new MeshStandardMaterial({ color: (x + z) % 2 ? '#e2526e' : '#fff7f0', roughness: 1 }),
        );
        square.rotation.x = -Math.PI / 2;
        square.position.set(-1.5 + x * 0.6, 0, -0.9 + z * 0.6);
        blanket.add(square);
      }
    this.scene.add(blanket);
    const top = new MeshStandardMaterial({ color: '#f4c77d', roughness: 0.7 });
    const jam = new MeshStandardMaterial({ color: '#e2526e', roughness: 0.4 });
    const crust = new MeshStandardMaterial({ color: '#d99a4e', roughness: 0.8 });
    for (let i = 0; i < SLICES; i++) {
      const shape = new Shape();
      shape.moveTo(0, 0);
      for (let step = 0; step <= 12; step++) {
        const angle = ((i + step / 12) / SLICES) * Math.PI * 2;
        shape.lineTo(Math.sin(angle) * 0.95, Math.cos(angle) * 0.95);
      }
      shape.lineTo(0, 0);
      const geometry = new ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: false });
      geometry.rotateX(-Math.PI / 2);
      const slice = new Group();
      slice.add(new Mesh(geometry, [i === 0 ? jam : top, crust]));
      slice.position.y = 0.02;
      this.slices.push(slice);
      this.scene.add(slice);
    }
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
    camera.position.set(0, Math.sin(PITCH * DEG) * distance, Math.cos(PITCH * DEG) * distance);
    camera.lookAt(0, 0, 0);
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
    const calm = this.calm;
    this.slices.forEach((slice, index) => {
      const pop = calm ? 1 : slicePop(t, index);
      slice.scale.setScalar(Math.max(0.001, easeOutBack(pop)));
      slice.position.y = 0.02 + (calm ? 0 : (1 - pop) * 0.6);
    });
  }
}
