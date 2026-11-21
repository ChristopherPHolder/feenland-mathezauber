import { Group, InstancedMesh, Matrix4, Mesh, TorusGeometry, Vector3 } from 'three';
import { Stage } from '../../shared/three/stage';
import type { StateWorld } from '../../shared/three/three-stage';
import { BRONZE, FACE, INK } from './clock-frame';
import { Kit, PipModel } from './clock-models';

/** One full sweep of the long hand takes this long; the scene loops on it. */
export const SWEEP_SECONDS = 3;
const DEG = Math.PI / 180;
/** The shared loader's "Loading…" pill sits about this many pixels under the centre line. */
const PILL_CLEAR = 52;

/**
 * Where the hands and the bell stand at time `t`: the long hand goes once round per sweep,
 * the short hand a twelfth of that, and the bell swings for a moment each time the long hand
 * passes 12.
 */
export function sweepPhase(t: number) {
  const into = (t / SWEEP_SECONDS) % 1;
  const minute = into * 360;
  const hour = (((t / SWEEP_SECONDS) % 12) / 12) * 360;
  const swing = into < 0.3 ? Math.sin((into / 0.3) * Math.PI * 3) * 0.4 * (1 - into / 0.3) : 0;
  return { minute, hour, swing };
}

/**
 * The tower's loading scene: a small clock face whose long hand sweeps round, the bell above it
 * swinging each time the hour comes round, and Pip peeking from the side. Under calm motion it
 * holds one posed frame at ten past ten.
 */
export class ClockLoaderWorld extends Stage implements StateWorld<null> {
  private readonly kit = new Kit();
  private readonly hourHand = new Group();
  private readonly minuteHand = new Group();
  private readonly bell = new Group();
  private readonly pip: PipModel;
  private readonly probe = new Vector3();
  private readonly frameBox: readonly Vector3[] = [
    new Vector3(-1.5, -1.2, 0),
    new Vector3(1.9, -1.2, 0),
    new Vector3(-1.5, 2.0, 0),
    new Vector3(1.9, 2.0, 0),
  ];

  constructor(canvas: HTMLCanvasElement, host: HTMLElement) {
    super(canvas, host, { fov: 34 });
    this.fill.intensity = 1.7;
    const kit = this.kit;
    const tower = new Mesh(kit.box, kit.mat('#e8d3b4', { roughness: 0.95 }));
    tower.scale.set(2.5, 2.8, 0.8);
    tower.position.set(0, 0.1, -0.5);
    this.scene.add(tower);
    const roof = new Mesh(kit.cone, kit.mat('#7a5ac0'));
    roof.scale.set(1.9, 1, 1.9);
    roof.rotation.y = Math.PI / 4;
    roof.position.set(0, 2, -0.5);
    this.scene.add(roof);
    const rim = new Mesh(
      new TorusGeometry(0.97, 0.07, 10, 60),
      kit.mat(BRONZE, { metalness: 0.6, roughness: 0.35 }),
    );
    this.scene.add(rim);
    const face = new Mesh(kit.disc, kit.mat(FACE));
    face.scale.setScalar(0.95);
    face.position.z = 0.01;
    this.scene.add(face);
    const ticks = new InstancedMesh(kit.box, kit.mat(INK), 12);
    const matrix = new Matrix4();
    const rotation = new Matrix4();
    for (let index = 0; index < 12; index++) {
      rotation.makeRotationZ(-index * 30 * DEG);
      matrix.makeScale(0.05, 0.14, 0.01).setPosition(0, 0.78, 0.02);
      ticks.setMatrixAt(index, rotation.clone().multiply(matrix));
    }
    this.scene.add(ticks);
    const hour = new Mesh(kit.box, kit.mat(INK));
    hour.scale.set(0.09, 0.5, 0.02);
    hour.position.set(0, 0.22, 0.04);
    this.hourHand.add(hour);
    const minute = new Mesh(kit.box, kit.mat('#3d3470'));
    minute.scale.set(0.05, 0.78, 0.02);
    minute.position.set(0, 0.36, 0.06);
    this.minuteHand.add(minute);
    this.scene.add(this.hourHand, this.minuteHand);
    this.bell.position.set(0, 1.7, 0.3);
    this.bell.add(new Mesh(kit.bell, kit.mat(BRONZE, { metalness: 0.75, roughness: 0.3 })));
    this.scene.add(this.bell);
    this.pip = new PipModel(kit);
    this.pip.root.scale.setScalar(0.5);
    this.pip.root.position.set(1.45, -1.2, 0.3);
    this.pip.root.rotation.y = -0.4;
    this.scene.add(this.pip.root);
  }

  setState(_: null) {}

  protected override layout(aspect: number) {
    this.camera.clearViewOffset();
    super.layout(aspect);
    // As big as fits above the loader's "Loading…" pill, its foot just above it.
    const { width, height } = this;
    const top = height * 0.06;
    const floor = height / 2 + PILL_CLEAR;
    const room = { x: width * 0.9, y: floor - top };
    let distance = 6;
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
    camera.position.set(0, 0.4, distance);
    camera.lookAt(0, 0.4, 0);
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
    const { minute, hour, swing } = calm ? { minute: 60, hour: 305, swing: 0 } : sweepPhase(t);
    this.minuteHand.rotation.z = -minute * DEG;
    this.hourHand.rotation.z = -hour * DEG;
    this.bell.rotation.z = swing;
    this.pip.head.rotation.z = calm ? 0 : Math.sin(t * 1.5) * 0.12;
    const blink = !calm && t % 3.4 > 3.25;
    for (const lid of this.pip.lids) lid.scale.y = blink ? 1 : 0.001;
  }

  override dispose() {
    super.dispose();
    this.kit.dispose();
  }
}
