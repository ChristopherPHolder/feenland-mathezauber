import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  Vector3,
} from 'three';
import { easeOutBack } from '../../shared/three/motion';
import { Stage } from '../../shared/three/stage';
import type { StateWorld } from '../../shared/three/three-stage';

const DEG = Math.PI / 180;
/** One tray fills in this long, then the scene starts over. */
export const FILL_SECONDS = 2.7;
const ROWS = 2;
const COLS = 3;
const PITCH = 20;
/** The loader's "Loading…" pill sits about this many pixels under the centre line. */
const PILL_CLEAR = 52;
const FRAME_POINTS: readonly Vector3[] = [
  new Vector3(-1.5, 0, 0.8),
  new Vector3(1.5, 0, 0.8),
  new Vector3(-1.3, 2.4, -1),
  new Vector3(1.3, 2.4, -1),
];

/**
 * How far one cookie has popped in at time `t`, from 0 (not yet) to 1 (sitting on the tray).
 * Cookies pop in one after another, row by row, and the full tray rests before it empties.
 */
export function cookiePop(t: number, index: number): number {
  const into = (t % FILL_SECONDS) / FILL_SECONDS;
  const start = 0.08 + index * 0.1;
  return Math.max(0, Math.min(1, (into - start) / 0.12));
}

/**
 * The bakery's loading scene: a little oven glows behind a baking tray while cookies pop onto
 * it in rows, as if being counted in. Under calm motion it holds a full tray.
 */
export class BakeryLoaderWorld extends Stage implements StateWorld<null> {
  private readonly cookies: Mesh[] = [];
  private readonly window: MeshStandardMaterial;
  private readonly probe = new Vector3();

  constructor(canvas: HTMLCanvasElement, host: HTMLElement) {
    super(canvas, host, { fov: 34 });
    this.fill.intensity = 1.7;
    this.sun.position.set(-3, 9, 7);
    const oven = new Group();
    const body = new Mesh(
      new BoxGeometry(2.4, 1.9, 1.2),
      new MeshStandardMaterial({ color: '#b5523b', roughness: 0.8 }),
    );
    body.position.y = 1.2;
    this.window = new MeshStandardMaterial({
      color: '#ffcf6b',
      emissive: '#ff9a1f',
      emissiveIntensity: 0.8,
    });
    const glass = new Mesh(new PlaneGeometry(1.5, 0.8), this.window);
    glass.position.set(0, 1.1, 0.61);
    oven.add(body, glass);
    oven.position.z = -1;
    const tray = new Mesh(
      new BoxGeometry(2.6, 0.12, 1.7),
      new MeshStandardMaterial({ color: '#b8bec8', metalness: 0.5, roughness: 0.4 }),
    );
    tray.position.set(0, 0.06, 0.7);
    const paper = new Mesh(
      new BoxGeometry(2.4, 0.02, 1.5),
      new MeshStandardMaterial({ color: '#f5e7c6' }),
    );
    paper.position.set(0, 0.13, 0.7);
    this.scene.add(oven, tray, paper);
    const dome = new SphereGeometry(0.32, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    dome.scale(1, 0.45, 1);
    const dough = new MeshStandardMaterial({ color: '#e9b56a', roughness: 0.8 });
    const chip = new SphereGeometry(0.06, 8, 6);
    const chocolate = new MeshStandardMaterial({ color: '#4a2a12' });
    for (let row = 0; row < ROWS; row++)
      for (let col = 0; col < COLS; col++) {
        const cookie = new Mesh(dome, dough);
        cookie.position.set((col - 1) * 0.75, 0.14, 0.35 + row * 0.7);
        for (const [x, z] of [
          [-0.1, -0.05],
          [0.12, 0.06],
        ]) {
          const bit = new Mesh(chip, chocolate);
          bit.position.set(x, 0.12, z);
          cookie.add(bit);
        }
        this.cookies.push(cookie);
        this.scene.add(cookie);
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
    camera.position.set(0, 1 + Math.sin(PITCH * DEG) * distance, Math.cos(PITCH * DEG) * distance);
    camera.lookAt(0, 1, 0);
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
    this.cookies.forEach((cookie, index) => {
      const pop = calm ? 1 : easeOutBack(cookiePop(t, index));
      cookie.scale.setScalar(Math.max(0.001, pop));
    });
    this.window.emissiveIntensity = calm ? 0.8 : 0.7 + Math.sin(t * 3) * 0.2;
  }
}
