import { PerspectiveCamera, Vector3 } from 'three';
import { BRICK } from './wall-models';

export const WALL_FOV = 40;
export const WALL_PITCH = 0.24;
const FOV = WALL_FOV;
const PITCH = WALL_PITCH;

/** Frame the game independently of WebGL so geometry projections can be regression tested. */
export function wallCameraFrame(
  width: number,
  height: number,
  rows: number,
  half: number,
  towerX: number,
  towerTop: number,
) {
  const aspect = width / height;
  const probe = new PerspectiveCamera(FOV, aspect, 0.1, 200);
  const wallTop = BRICK.base + rows * BRICK.rise;
  const front = BRICK.d / 2 + 0.2;
  // Keep room for the troll beside the right-hand brick, as well as the plinth.
  const left = half + 0.3;
  const right = half + 1.4;
  const lookX = 0;
  const wall = [
    ...[-1, 1].flatMap((x) => [
      new Vector3(x * (half + 0.25), 0, front),
      new Vector3(x * half, BRICK.base + BRICK.h, BRICK.d / 2),
      new Vector3((x * BRICK.w) / 2, wallTop + 0.05, -BRICK.d / 2),
    ]),
    new Vector3(-left, 0, front),
    new Vector3(right, 0, 0.8),
    new Vector3(right, 2.6, 0.3),
  ];
  // Fit the actual tower depth and roof tips, the raised victory flag, and the fairy's
  // sprite (including her idle bob). Fitting only the brick wall crops these on phones.
  const whole = [
    ...wall,
    ...[-1, 1].flatMap((side) =>
      boxCorners(side * towerX - 0.95, side * towerX + 0.95, 0, towerTop + 1.8, -1.2, 0.7),
    ),
    ...boxCorners(-towerX - 0.05, -towerX + 0.95, towerTop + 1.7, towerTop + 3.3, -0.3, -0.2),
    ...boxCorners(-half - 0.95, -half + 0.65, wallTop - 0.5, wallTop + 0.8, 1.1, 1.1),
  ];
  const distance = fitCamera(whole, 0.9);
  const lookY = centreOn(whole, distance) + groundDrop(whole);
  return { distance, lookX, lookY };

  /**
   * How far to raise the look point so the wall stands near the bottom of a box taller than it
   * needs (a phone held upright once the keypad goes): the ground under it stays a strip and the
   * sky above holds the fairy, the gems and the troll's road instead of a field of grass.
   */
  function groundDrop(points: readonly Vector3[]): number {
    const tanV = Math.tan((FOV * Math.PI) / 360);
    const { minY, maxY } = project(points, distance, centreOn(points, distance));
    const slack = Math.max(0, 0.92 - (maxY - minY) / 2);
    return slack * 0.7 * distance * tanV;
  }

  /** The nearest camera distance at which every point lies within `margin` of the box edges. */
  function fitCamera(points: readonly Vector3[], margin: number): number {
    let near = 2;
    let far = 90;
    for (let step = 0; step < 22; step++) {
      const distance = (near + far) / 2;
      const lookY = centreOn(points, distance);
      const { minX, maxX, minY, maxY } = project(points, distance, lookY);
      const fits = Math.max(-minX, maxX) <= margin && (maxY - minY) / 2 <= margin;
      if (fits) far = distance;
      else near = distance;
    }
    return far;
  }

  /** The height to look at so the points sit in the middle of the box from this distance. */
  function centreOn(points: readonly Vector3[], distance: number): number {
    const tanV = Math.tan((FOV * Math.PI) / 360);
    let lookY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
    for (let step = 0; step < 4; step++) {
      const { minY, maxY } = project(points, distance, lookY);
      lookY += ((minY + maxY) / 2) * distance * tanV;
    }
    return lookY;
  }

  function project(points: readonly Vector3[], distance: number, lookY: number) {
    probe.aspect = aspect;
    probe.position.set(lookX, lookY + distance * Math.sin(PITCH), distance * Math.cos(PITCH));
    probe.lookAt(lookX, lookY, 0);
    probe.updateProjectionMatrix();
    probe.updateMatrixWorld();
    const at = new Vector3();
    const box = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
    for (const point of points) {
      at.copy(point).project(probe);
      box.minX = Math.min(box.minX, at.x);
      box.maxX = Math.max(box.maxX, at.x);
      box.minY = Math.min(box.minY, at.y);
      box.maxY = Math.max(box.maxY, at.y);
    }
    return box;
  }
}

/** Corners of a world-space envelope; include depth because the camera looks downward. */
function boxCorners(
  left: number,
  right: number,
  bottom: number,
  top: number,
  back: number,
  front: number,
) {
  return [left, right].flatMap((x) =>
    [bottom, top].flatMap((y) => [back, front].map((z) => new Vector3(x, y, z))),
  );
}
