import {
  AdditiveBlending,
  BoxGeometry,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RingGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three';
import { easeOut } from '../../shared/three/motion';
import { Stage } from '../../shared/three/stage';
import type { StateWorld } from '../../shared/three/three-stage';
import { buildNova, glowTexture, HOOP_Y, Nova } from './star-nova';

const DEG = Math.PI / 180;
/** One star falls, is caught and rises away in this long; the scene loops on this beat. */
export const CATCH_SECONDS = 2.4;
/** Where a star starts its fall, above the net. */
const STAR_TOP = HOOP_Y + 1.7;
const BRIDGE_HALF = 1.8;
/** The camera looks down on the bridge from this many degrees up. */
const PITCH = 10;
/**
 * The shared loader centres its "Loading…" pill a little below the middle, with its top about
 * this many pixels under the centre line; the bridge ends there.
 */
const PILL_CLEAR = 52;
/** The outline that must stay in view: the bridge, Nova's hoop and where a star starts. */
const FRAME_POINTS: readonly Vector3[] = [
  new Vector3(-BRIDGE_HALF - 0.2, -0.28, 0.4),
  new Vector3(BRIDGE_HALF + 0.2, -0.28, 0.4),
  new Vector3(0, HOOP_Y + 0.3, 0),
  new Vector3(-0.5, STAR_TOP + 0.35, 0.3),
  new Vector3(0.5, STAR_TOP + 0.35, 0.3),
];

/**
 * Where a catch stands at time `t`: how far the star has fallen toward the net (null once it is
 * in), how bright the net's flash is (null outside it), and how far the caught star has risen
 * away (null before it leaves). Which catch this is comes back as `catch`.
 */
export function catchPhase(t: number) {
  const index = Math.floor(t / CATCH_SECONDS);
  const into = t / CATCH_SECONDS - index;
  const fall = into < 0.5 ? into / 0.5 : null;
  const flash = into >= 0.5 && into < 0.8 ? (into - 0.5) / 0.3 : null;
  const rise = into >= 0.62 && into < 0.95 ? (into - 0.62) / 0.33 : null;
  return { catch: index, fall, flash, rise };
}

/**
 * The Star Catcher's loading scene: Nova stands on a short glowing bridge holding up her lantern
 * net, a star falls into it, the net flashes with a ring of light, and the star floats up and
 * away, then the next one falls. Under calm motion it holds one posed frame: a star resting in
 * the glowing net.
 */
export class StarLoaderWorld extends Stage implements StateWorld<null> {
  private readonly nova: Nova;
  private readonly star: Sprite;
  private readonly ring: Mesh;
  private readonly probe = new Vector3();
  private readonly hoop = new Vector3();

  constructor(canvas: HTMLCanvasElement, host: HTMLElement) {
    super(canvas, host, { fov: 34 });
    this.fill.color.set('#8590dc');
    this.fill.intensity = 1.3;
    this.sun.color.set('#c6d0ff');
    this.sun.intensity = 1.5;

    const walkway = new Mesh(
      new BoxGeometry(BRIDGE_HALF * 2, 0.24, 0.7),
      new MeshStandardMaterial({ color: '#6d6fa8', roughness: 0.85 }),
    );
    walkway.position.y = -0.12;
    const glass = new Mesh(
      new BoxGeometry(BRIDGE_HALF * 2 - 0.1, 0.03, 0.6),
      new MeshStandardMaterial({
        color: '#bdeaff',
        emissive: '#5fc8ff',
        emissiveIntensity: 0.6,
        transparent: true,
        opacity: 0.85,
      }),
    );
    const line = new Mesh(
      new BoxGeometry(BRIDGE_HALF * 2 - 0.2, 0.04, 0.02),
      new MeshBasicMaterial({ color: '#ffe9a8' }),
    );
    line.position.set(0, -0.05, 0.36);
    this.scene.add(walkway, glass, line);

    this.nova = buildNova();
    this.scene.add(this.nova.group);

    this.star = new Sprite(
      new SpriteMaterial({ map: glowTexture('star'), transparent: true, depthWrite: false }),
    );
    this.star.scale.setScalar(0.55);
    this.ring = new Mesh(
      new RingGeometry(0.25, 0.32, 36),
      new MeshBasicMaterial({
        color: '#ffe38a',
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
      }),
    );
    this.scene.add(this.star, this.ring);
    this.nova.group.updateMatrixWorld();
    this.nova.hoop.getWorldPosition(this.hoop);
  }

  setState(_: null) {}

  protected override layout(aspect: number) {
    this.camera.clearViewOffset();
    super.layout(aspect);
    // As big as fits in the space above the loader's "Loading…" pill, the bridge just above it.
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
    const look = 1.6;
    camera.position.set(
      0,
      look + Math.sin(PITCH * DEG) * distance,
      Math.cos(PITCH * DEG) * distance,
    );
    camera.lookAt(0, look, 0);
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
    const nova = this.nova;
    const ring = this.ring.material as MeshBasicMaterial;
    if (calm) {
      // A still frame: a star resting in the glowing net.
      this.star.visible = true;
      this.star.position.set(this.hoop.x, this.hoop.y + 0.12, this.hoop.z + 0.1);
      this.star.material.opacity = 1;
      this.star.material.rotation = 0;
      this.ring.visible = false;
      nova.lantern.emissiveIntensity = 2.6;
      nova.light.intensity = 4;
      for (const wing of nova.wings) wing.rotation.y = (wing.scale.x < 0 ? -1 : 1) * 0.5;
      return;
    }
    const { fall, flash, rise } = catchPhase(t);
    nova.wings.forEach((wing, index) => {
      const side = wing.scale.x < 0 ? -1 : 1;
      wing.rotation.y = side * (0.5 + Math.sin(t * 8 + (index % 2) * 0.6) * 0.2);
    });
    nova.body.position.y = Math.sin(t * 2.1) * 0.02;

    // The star drops into the net, rests in its glow, then floats up and fades.
    this.star.visible = rise === null || rise < 1;
    this.star.material.rotation = t * 0.8;
    if (fall !== null) {
      const eased = fall * fall;
      this.star.position.set(
        this.hoop.x + Math.sin(fall * Math.PI) * 0.15,
        STAR_TOP + (this.hoop.y + 0.12 - STAR_TOP) * eased,
        this.hoop.z + 0.1,
      );
      this.star.material.opacity = Math.min(1, fall * 4);
    } else if (rise !== null) {
      const up = easeOut(rise);
      this.star.position.set(this.hoop.x - up * 0.6, this.hoop.y + 0.12 + up * 1.8, this.hoop.z);
      this.star.material.opacity = 1 - rise;
    } else {
      this.star.position.set(this.hoop.x, this.hoop.y + 0.12, this.hoop.z + 0.1);
      this.star.material.opacity = 1;
    }
    this.star.scale.setScalar(0.55 * (rise === null ? 1 : 1 - rise * 0.5));

    // The net flashes and a ring of light spreads when the star drops in.
    this.ring.visible = flash !== null;
    if (flash !== null) {
      this.ring.position.set(this.hoop.x, this.hoop.y, this.hoop.z + 0.12);
      this.ring.scale.setScalar(1 + flash * 3);
      ring.opacity = 0.9 * (1 - flash);
    }
    const glow = flash === null ? (fall ?? 0) : 1 - flash;
    nova.lantern.emissiveIntensity = 1.2 + 1.4 * (fall ?? 0) + 3 * (flash === null ? 0 : glow);
    nova.light.intensity = nova.lantern.emissiveIntensity * 1.6;
  }
}
