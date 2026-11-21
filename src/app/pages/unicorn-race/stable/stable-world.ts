import {
  CircleGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  TorusGeometry,
} from 'three';
import { disposeTree, Stage } from '../../../shared/three/stage';
import type { StateWorld } from '../../../shared/three/three-stage';
import { Horse, sameHorse } from '../horse';
import { Pony } from '../race-pony';
import type { Outfit } from '../race-store';

/** What the Stable shows: the horse being made, what it wears, and a count of changes. */
export interface StableState {
  readonly horse: Horse;
  readonly outfit: Outfit | null;
  /** Goes up on every change; each new value makes the horse hop and toss its head. */
  readonly hop: number;
  /** How far the child has turned the stand by dragging it, in radians. */
  readonly spin: number;
}
/** Three-quarter view, face to the left and turned toward the child. */
const FACING = Math.PI / 2 + 0.38;
/** How far the stand sways either way, and how long one sway takes, in seconds. */
const SWAY = 0.42;
const SWAY_SECONDS = 9;
const HOP_SECONDS = 0.9;
/** The box the picture must hold: the horse from hoof to horn tip at any turn of the stand. */
const FRAME_WIDTH = 3;
const FRAME_HEIGHT = 3.1;
const LOOK_Y = 1.08;

/**
 * The Stable's 3D stand: the child's horse on a round pastel stand that sways slowly so every
 * side shows, hopping each time something changes. It reuses the race's own pony, so the horse
 * here is exactly the one that races. Under calm motion it holds the three-quarter view and
 * changes without hopping.
 */
export class StableWorld extends Stage implements StateWorld<StableState> {
  private readonly stand = new Group();
  private pony?: Pony;
  private built?: StableState;
  private seenHop?: number;
  private hopUntil = 0;
  private spin = 0;
  private shownSpin = 0;

  constructor(canvas: HTMLCanvasElement, host: HTMLElement) {
    super(canvas, host, { fov: 30, shadows: true });
    this.sun.position.set(-3, 8, 6);
    this.sun.intensity = 2;
    this.sun.shadow.camera.left = -2;
    this.sun.shadow.camera.right = 2;
    this.sun.shadow.camera.top = 2;
    this.sun.shadow.camera.bottom = -2;
    this.fill.intensity = 0.6;
    this.scene.add(new HemisphereLight('#ffffff', '#ffd9e8', 1.3));

    // A soft round shadow under the stand, then the stand: a lilac drum with a mint top.
    const glow = new Mesh(
      new CircleGeometry(1.55, 40),
      new MeshBasicMaterial({ color: '#6d4a9a', transparent: true, opacity: 0.12 }),
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = -0.17;
    this.scene.add(glow);
    const drum = new Mesh(
      new CylinderGeometry(1.32, 1.38, 0.16, 48),
      new MeshLambertMaterial({ color: '#d9c8ff' }),
    );
    drum.position.y = -0.08;
    const top = new Mesh(
      new CircleGeometry(1.26, 48),
      new MeshLambertMaterial({ color: '#c8f0d6' }),
    );
    top.rotation.x = -Math.PI / 2;
    top.position.y = 0.002;
    top.receiveShadow = true;
    const rim = new Mesh(
      new TorusGeometry(1.29, 0.035, 8, 64),
      new MeshLambertMaterial({ color: '#ffb6d0' }),
    );
    rim.rotation.x = Math.PI / 2;
    this.stand.add(drum, top, rim);
    this.stand.rotation.y = FACING;
    this.scene.add(this.stand);
  }

  setState(state: StableState) {
    const built = this.built;
    if (!built || !sameHorse(built.horse, state.horse) || built.outfit !== state.outfit)
      this.build(state);
    if (this.seenHop !== undefined && state.hop !== this.seenHop)
      this.hopUntil = this.elapsed + HOP_SECONDS;
    this.seenHop = state.hop;
    this.spin = state.spin;
    this.built = state;
    this.animate(0, this.elapsed);
    this.draw();
  }

  protected update(dt: number, t: number) {
    this.animate(dt, t);
  }

  protected override layout(aspect: number) {
    const camera = this.camera;
    camera.aspect = aspect;
    const halfTan = Math.tan((camera.fov * Math.PI) / 360);
    const distance =
      1.08 * Math.max(FRAME_HEIGHT / 2 / halfTan, FRAME_WIDTH / 2 / (halfTan * aspect));
    // A little above the horse, the way a child looks at a toy on a table.
    camera.position.set(0, LOOK_Y + distance * 0.2, distance);
    camera.lookAt(0, LOOK_Y - 0.06, 0);
    camera.updateProjectionMatrix();
  }

  private build(state: StableState) {
    if (this.pony) {
      this.stand.remove(this.pony.root);
      disposeTree(this.pony.root);
      // The hair's instanced meshes hold per-lock buffers of their own.
      this.pony.root.traverse((part) => {
        if (part instanceof InstancedMesh) part.dispose();
      });
    }
    this.pony = new Pony('player', state.outfit, state.horse);
    this.stand.add(this.pony.root);
  }

  private animate(dt: number, t: number) {
    const calm = this.calm;
    // A drag turns the stand straight away; the gentle sway carries on around it.
    this.shownSpin += (this.spin - this.shownSpin) * (calm || dt === 0 ? 1 : Math.min(1, dt * 18));
    this.stand.rotation.y =
      FACING + this.shownSpin + (calm ? 0 : Math.sin((t / SWAY_SECONDS) * Math.PI * 2) * SWAY);
    this.pony?.update({
      now: t,
      dt,
      speed: 0,
      moving: false,
      waiting: false,
      celebrating: false,
      cheering: !calm && t < this.hopUntil,
      wingLift: 0.5,
      calm,
    });
  }
}
