import { Box3, PerspectiveCamera, Vector3 } from 'three';
import { disposeTree } from '../../shared/three/stage';
import { wallCameraFrame, WALL_FOV, WALL_PITCH } from './wall-camera';
import { BRICK, brickCentre, Castle } from './wall-models';

function corners(box: Box3): Vector3[] {
  return [box.min.x, box.max.x].flatMap((x) =>
    [box.min.y, box.max.y].flatMap((y) => [box.min.z, box.max.z].map((z) => new Vector3(x, y, z))),
  );
}

describe('Magic walls camera framing', () => {
  for (const rows of [2, 3, 4]) {
    for (const [width, height] of [
      [358, 220],
      [343, 180],
      [730, 520],
      [650, 600],
      [430, 320],
      [358, 600],
      [640, 180],
    ]) {
      it(`keeps the complete ${rows}-row castle and fairy inside ${width}x${height}`, () => {
        const castle = new Castle(rows, rows);
        const framing = wallCameraFrame(
          width,
          height,
          rows,
          castle.halfWidth,
          castle.towerX,
          castle.towerTop,
        );
        const camera = new PerspectiveCamera(WALL_FOV, width / height, 0.1, 200);
        camera.position.set(
          framing.lookX,
          framing.lookY + framing.distance * Math.sin(WALL_PITCH),
          framing.distance * Math.cos(WALL_PITCH),
        );
        camera.lookAt(framing.lookX, framing.lookY, 0);
        camera.updateMatrixWorld();
        // The road is background scenery; the plinth, towers and victory flag must fit.
        const objects = [...castle.group.children.slice(0, 3), castle.flag];
        const points = objects.flatMap((object) => corners(new Box3().setFromObject(object)));
        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < rows - row; col++) {
            const centre = brickCentre(row, col, rows);
            const extent = new Vector3(BRICK.w / 2, BRICK.h / 2, BRICK.d / 2);
            points.push(
              ...corners(new Box3(centre.clone().sub(extent), centre.clone().add(extent))),
            );
          }
        }
        const fairy = new Vector3(
          -(castle.halfWidth + 0.15),
          BRICK.base + rows * BRICK.rise + 0.15,
          1.1,
        );
        // Include her sprite and idle bob, rather than just her centre.
        points.push(
          ...corners(
            new Box3(
              fairy.clone().add(new Vector3(-0.8, -0.65, 0)),
              fairy.clone().add(new Vector3(0.8, 0.65, 0)),
            ),
          ),
        );
        try {
          for (const point of points) {
            const projected = point.clone().project(camera);
            expect(Math.abs(projected.x), `horizontal clipping of ${point.toArray()}`).toBeLessThan(
              0.98,
            );
            expect(Math.abs(projected.y), `vertical clipping of ${point.toArray()}`).toBeLessThan(
              0.98,
            );
          }
        } finally {
          disposeTree(castle.group);
        }
      });
    }
  }
});
