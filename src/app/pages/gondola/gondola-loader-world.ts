import { ConeGeometry, InstancedMesh, Matrix4, Vector3 } from 'three';
import { smooth } from '../../shared/three/motion';
import { Stage } from '../../shared/three/stage';
import type { StateWorld } from '../../shared/three/three-stage';
import { CABIN_COLORS } from './gondola-frame';
import { Bunny, bunnyLook, Cabin, CABIN, Kit } from './gondola-models';

/** One ride up the cable takes this long; the scene loops on it. */
export const RIDE_SECONDS = 3.2;
/** The short cable, low left to high right. */
const FROM = new Vector3(-2.6, 2.6, 0);
const TO = new Vector3(2.6, 4.4, 0);
const CABIN_SCALE = 0.62;
const DEG = Math.PI / 180;
const PITCH = 8;
/** The shared loader's "Loading…" pill sits about this many pixels under the centre line. */
const PILL_CLEAR = 52;

/**
 * Where a ride stands at time `t`: how far along the cable the cabin is (0 low, 1 high), how
 * much it is shown (it fades in at the bottom and out at the top), and its swing. Which ride
 * this is picks the cabin's colour.
 */
export function ridePhase(t: number) {
  const ride = Math.floor(t / RIDE_SECONDS);
  const into = t / RIDE_SECONDS - ride;
  const along = smooth(into);
  const shown = into < 0.12 ? into / 0.12 : into > 0.88 ? (1 - into) / 0.12 : 1;
  const swing = Math.sin(into * Math.PI * 4) * 0.08 * (1 - into);
  return { ride, along, shown, swing };
}

/**
 * The gondola's loading scene: a cabin with a bunny waving from its window glides up a short
 * cable between two snowy pines, then the next cabin comes. Under calm motion it holds one
 * posed frame halfway up.
 */
export class GondolaLoaderWorld extends Stage implements StateWorld<null> {
  private readonly kit = new Kit();
  private readonly cabin: Cabin;
  private readonly bunny: Bunny;
  private readonly probe = new Vector3();
  private readonly frameBox: readonly Vector3[];
  private color = -1;

  constructor(canvas: HTMLCanvasElement, host: HTMLElement) {
    super(canvas, host, { fov: 34 });
    this.fill.intensity = 1.6;
    this.sun.position.set(-3, 9, 7);
    const kit = this.kit;
    const steel = kit.mat('#4a5260', { metalness: 0.5, roughness: 0.45 });
    const ends = [FROM.clone().add(new Vector3(-0.8, -0.3, 0)), TO.clone().add(new Vector3(0.8, 0.3, 0))];
    this.scene.add(kit.rod(steel, ends[0], ends[1], 0.03));
    // Two pylons and a little snowy ground under the cable.
    for (const [x, top] of [
      [ends[0].x + 0.2, ends[0].y],
      [ends[1].x - 0.2, ends[1].y],
    ]) {
      this.scene.add(
        kit.rod(kit.mat('#7c8796', { metalness: 0.4 }), new Vector3(x, 0, -0.1), new Vector3(x, top + 0.15, -0.1), 0.09, 0.06),
      );
    }
    this.scene.add(kit.blob(kit.mat('#ffffff', { roughness: 1 }), 4.4, 0.35, 1.4, 0, 0, -0.4));
    const pines = new InstancedMesh(new ConeGeometry(0.6, 1.1, 9), kit.mat('#2f6b45'), 6);
    const matrix = new Matrix4();
    [
      [-2.8, 0.55, -0.8, 1],
      [-2.8, 1.15, -0.8, 0.75],
      [-2.8, 1.65, -0.8, 0.5],
      [3.0, 0.55, -0.9, 1],
      [3.0, 1.15, -0.9, 0.75],
      [3.0, 1.65, -0.9, 0.5],
    ].forEach(([x, y, z, s], index) => {
      matrix.makeScale(s, s, s).setPosition(x, y, z);
      pines.setMatrixAt(index, matrix);
    });
    this.scene.add(pines);

    this.cabin = new Cabin(kit, { color: CABIN_COLORS[0] });
    this.cabin.root.scale.setScalar(CABIN_SCALE);
    this.bunny = new Bunny(kit, bunnyLook(1));
    this.cabin.seats[2].add(this.bunny.root);
    this.bunny.root.scale.setScalar(CABIN.rider * 1.2);
    this.bunny.paw.rotation.x = -2.3;
    this.scene.add(this.cabin.root);
    const drop = (CABIN.height + CABIN.hanger) * CABIN_SCALE;
    this.frameBox = [
      new Vector3(ends[0].x, 0, 0.6),
      new Vector3(ends[1].x, 0, 0.6),
      new Vector3(FROM.x - 0.8, FROM.y - drop, 0.5),
      new Vector3(TO.x + 0.8, TO.y + 0.4, 0),
    ];
  }

  setState(_: null) {}

  protected override layout(aspect: number) {
    this.camera.clearViewOffset();
    super.layout(aspect);
    // As big as fits above the loader's "Loading…" pill, its ground just above it.
    const { width, height } = this;
    const top = height * 0.06;
    const floor = height / 2 + PILL_CLEAR;
    const room = { x: width * 0.9, y: floor - top };
    let distance = 8;
    let box = this.aim(distance);
    while ((box.right - box.left > room.x || box.bottom - box.top > room.y) && distance < 90) {
      distance *= 1.03;
      box = this.aim(distance);
    }
    const centre = (box.left + box.right) / 2 - width / 2;
    this.camera.setViewOffset(width, height, centre, box.bottom - floor, width, height);
  }

  private aim(distance: number) {
    const camera = this.camera;
    camera.position.set(0, 2.2 + Math.sin(PITCH * DEG) * distance, Math.cos(PITCH * DEG) * distance);
    camera.lookAt(0, 2.2, 0);
    camera.updateMatrixWorld();
    const box = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
    for (const point of this.frameBox) {
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
    const { ride, along, shown, swing } = calm
      ? { ride: 0, along: 0.5, shown: 1, swing: 0 }
      : ridePhase(t);
    if (ride !== this.color) {
      this.color = ride;
      this.cabin.setColor(CABIN_COLORS[ride % CABIN_COLORS.length]);
    }
    this.cabin.root.position.lerpVectors(FROM, TO, along);
    this.cabin.root.scale.setScalar(CABIN_SCALE * Math.max(0.001, shown));
    this.cabin.body.rotation.z = swing;
    this.bunny.paw.rotation.z = calm ? 0 : Math.sin(t * 10) * 0.45;
    this.bunny.ears[0].rotation.x = -0.22 + (calm ? 0 : Math.sin(t * 3) * 0.12);
  }

  override dispose() {
    super.dispose();
    this.kit.dispose();
  }
}

