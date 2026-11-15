import {
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RingGeometry,
  SphereGeometry,
  Vector3,
} from 'three';
import { smooth } from '../../shared/three/motion';
import { Stage } from '../../shared/three/stage';
import type { StateWorld } from '../../shared/three/three-stage';
import { BREW_COLOR, bubble, buildCauldron, Cauldron, SURFACE_Y } from './potion-cauldron';
import { LIQUIDS } from './potion-frame';

const DEG = Math.PI / 180;
/** One pour takes this long; the scene loops on this beat. */
export const POUR_SECONDS = 1.8;
/** How far the bottle tips to pour, in radians. */
const TIP = 1.7;
/** Where the bottle hangs: up and to the right of the cauldron, its neck over the potion. */
const BOTTLE = new Vector3(1.15, 3.05, 0.2);
/** The camera looks down on the cauldron from this many degrees up. */
const PITCH = 22;
/**
 * The shared loader centres its "Loading…" pill a little below the middle, with its top about
 * this many pixels under the centre line; the cauldron's feet end there.
 */
const PILL_CLEAR = 52;
/** The outline that must stay in view: the cauldron's belly and feet, and the tipped bottle. */
const FRAME_POINTS: readonly Vector3[] = [
  new Vector3(-1.45, 0, 0),
  new Vector3(1.45, 0, 0),
  new Vector3(-1.45, 1.75, 0),
  new Vector3(0, 0, 1.4),
  new Vector3(0, 1.75, -1.4),
  new Vector3(BOTTLE.x + 0.7, BOTTLE.y + 0.7, BOTTLE.z),
  new Vector3(BOTTLE.x - 0.4, BOTTLE.y + 0.9, BOTTLE.z),
];

/**
 * Where a pour stands at time `t`: how far the bottle has tipped (0 upright, 1 fully tipped),
 * how far the drop has fallen (null while there is none), and how far the splash ring has
 * spread (null before it lands). Which pour this is picks the potion's colour.
 */
export function pourPhase(t: number) {
  const pour = Math.floor(t / POUR_SECONDS);
  const into = t / POUR_SECONDS - pour;
  const tip =
    into < 0.25 ? smooth(into / 0.25) : into < 0.55 ? 1 : 1 - smooth((into - 0.55) / 0.25);
  const drop = into >= 0.25 && into < 0.45 ? (into - 0.25) / 0.2 : null;
  const splash = into >= 0.45 && into < 0.85 ? (into - 0.45) / 0.4 : null;
  return { pour, tip: into >= 0.8 ? 0 : tip, drop, splash };
}

/**
 * The potion cauldron's loading scene: the cauldron bubbles over its fire while a bottle above
 * it tips, a drop falls in, and the potion glows the bottle's colour with a ring of ripples.
 * Every pour brings a bottle of the next colour. Under calm motion it holds one posed frame.
 */
export class PotionLoaderWorld extends Stage implements StateWorld<null> {
  private readonly cauldron: Cauldron;
  private readonly bottle = new Group();
  private readonly bottleLiquid: MeshStandardMaterial;
  private readonly drop: Mesh;
  private readonly dropMaterial: MeshStandardMaterial;
  private readonly ripple: Mesh;
  private readonly probe = new Vector3();
  private readonly tint = new Color(BREW_COLOR);

  constructor(canvas: HTMLCanvasElement, host: HTMLElement) {
    super(canvas, host, { fov: 34 });
    this.fill.intensity = 1.6;
    this.sun.position.set(-3, 9, 7);
    this.cauldron = buildCauldron();
    this.scene.add(this.cauldron.group);

    // The bottle: a round glass belly with coloured potion, a neck and a cork.
    const glass = new MeshStandardMaterial({
      color: '#eaf4ff',
      transparent: true,
      opacity: 0.35,
      roughness: 0.1,
    });
    this.bottleLiquid = new MeshStandardMaterial({
      color: LIQUIDS[0],
      emissive: LIQUIDS[0],
      emissiveIntensity: 0.35,
    });
    const body = new Mesh(new SphereGeometry(0.44, 24, 16), glass);
    const potion = new Mesh(
      new SphereGeometry(0.38, 24, 16, 0, Math.PI * 2, Math.PI * 0.42),
      this.bottleLiquid,
    );
    const neck = new Mesh(new CylinderGeometry(0.13, 0.15, 0.36, 16), glass);
    neck.position.y = 0.57;
    // The cork is out: the bottle is pouring.
    this.bottle.add(body, potion, neck);
    this.bottle.position.copy(BOTTLE);

    this.dropMaterial = new MeshStandardMaterial({ color: LIQUIDS[0], emissive: LIQUIDS[0] });
    this.drop = new Mesh(new SphereGeometry(0.11, 12, 8), this.dropMaterial);
    this.ripple = new Mesh(
      new RingGeometry(0.2, 0.28, 32),
      new MeshBasicMaterial({ color: '#fff4c2', transparent: true }),
    );
    this.ripple.rotation.x = -Math.PI / 2;
    this.ripple.position.y = SURFACE_Y + 0.02;
    this.scene.add(this.bottle, this.drop, this.ripple);
  }

  setState(_: null) {}

  protected override layout(aspect: number) {
    this.camera.clearViewOffset();
    super.layout(aspect);
    // As big as fits in the space above the loader's "Loading…" pill, its feet just above it.
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
      1.4 + Math.sin(PITCH * DEG) * distance,
      Math.cos(PITCH * DEG) * distance,
    );
    camera.lookAt(0, 1.4, 0);
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
    bubble(this.cauldron, t, 0.8, calm);
    if (calm) {
      // A still frame: the bottle held a little tipped, the potion glowing, no drop.
      this.bottle.rotation.z = TIP * 0.35;
      this.drop.visible = false;
      this.ripple.visible = false;
      this.paint(BREW_COLOR, LIQUIDS[0]);
      return;
    }
    const { pour, tip, drop, splash } = pourPhase(t);
    const color = LIQUIDS[pour % LIQUIDS.length];
    this.bottle.rotation.z = tip * TIP;
    this.bottle.position.y = BOTTLE.y + Math.sin(t * 2.2) * 0.05;
    // The drop falls from the neck's mouth into the middle of the potion.
    this.drop.visible = drop !== null;
    if (drop !== null) {
      const from = this.mouth();
      const eased = drop * drop;
      this.drop.position.set(
        from.x * (1 - drop),
        from.y + (SURFACE_Y - from.y) * eased,
        from.z * (1 - drop),
      );
    }
    this.ripple.visible = splash !== null;
    if (splash !== null) {
      this.ripple.scale.setScalar(1 + splash * 3.4);
      (this.ripple.material as MeshBasicMaterial).opacity = 0.8 * (1 - splash);
    }
    // The potion takes on the drop's colour when it lands, then settles back to violet.
    const glow = splash === null ? 0 : 1 - splash;
    this.tint.set(BREW_COLOR).lerp(new Color(color), glow * 0.8);
    this.paint(`#${this.tint.getHexString()}`, color);
    this.cauldron.brew.emissiveIntensity = 0.6 + glow * 0.6;
  }

  /** Where the bottle's mouth is, so the drop leaves from it. */
  private mouth() {
    const angle = this.bottle.rotation.z;
    return new Vector3(
      this.bottle.position.x - Math.sin(angle) * 0.75,
      this.bottle.position.y + Math.cos(angle) * 0.75,
      this.bottle.position.z,
    );
  }

  private paint(potion: string, bottle: string) {
    this.cauldron.brew.color.set(potion);
    this.cauldron.brew.emissive.set(potion);
    this.bottleLiquid.color.set(bottle);
    this.bottleLiquid.emissive.set(bottle);
    this.dropMaterial.color.set(bottle);
    this.dropMaterial.emissive.set(bottle);
  }
}
