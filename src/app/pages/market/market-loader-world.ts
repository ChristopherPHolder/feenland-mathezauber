import { Group, Vector3 } from 'three';
import { clamp01, smooth } from '../../shared/three/motion';
import { Stage } from '../../shared/three/stage';
import type { StateWorld } from '../../shared/three/three-stage';
import { buildBasket, buildGood, buildMoney, Kit } from './market-models';

/** One coin's flight into the basket takes this long; the scene loops on it. */
export const TOSS_SECONDS = 1.7;
/** Share of a toss spent in the air; the rest is the basket's happy bounce and a pause. */
const FLIGHT = 0.55;
/** Where the coin leaves from, and the basket's mouth it drops into. */
const FROM = new Vector3(-1.5, 0.9, 0);
const INTO = new Vector3(0.15, 0.62, 0);
/** The shared loader's "Loading…" pill sits about this many pixels under the centre line. */
const PILL_CLEAR = 52;
const BASKET_SCALE = 2.2;

/**
 * Where a toss stands at time `t`: which toss it is, how far along its arc the coin is (0 at
 * the start, 1 in the basket), its height above the straight line, how many turns it has
 * flipped, whether it is still shown, and the basket's squash once it lands.
 */
export function tossPhase(t: number) {
  const toss = Math.floor(t / TOSS_SECONDS);
  const into = t / TOSS_SECONDS - toss;
  const along = clamp01(into / FLIGHT);
  const arc = Math.sin(along * Math.PI) * 1.1;
  const flips = smooth(along) * 3;
  const shown = into < FLIGHT;
  const after = (into - FLIGHT) / (1 - FLIGHT);
  const squash = into >= FLIGHT && after < 0.35 ? Math.sin((after / 0.35) * Math.PI) : 0;
  return { toss, along, arc, flips, shown, squash };
}

/**
 * The market's loading scene: a gold coin flips through the air and drops into Lumi's wicker
 * basket, which already holds an apple and a cupcake; the basket gives a happy bounce and the
 * next coin comes. Under calm motion it holds one posed frame with the coin mid-air.
 */
export class MarketLoaderWorld extends Stage implements StateWorld<null> {
  private readonly kit = new Kit();
  private readonly coin: Group;
  private readonly basket = new Group();
  private readonly probe = new Vector3();
  private readonly frameBox: readonly Vector3[];

  constructor(canvas: HTMLCanvasElement, host: HTMLElement) {
    super(canvas, host, { fov: 34 });
    this.fill.intensity = 1.6;
    this.sun.position.set(-3, 9, 7);
    const kit = this.kit;
    const basket = new Group();
    const { root } = buildBasket(kit);
    root.scale.setScalar(BASKET_SCALE);
    root.position.y = 0.2;
    const apple = buildGood(kit, 'apple');
    apple.scale.setScalar(0.85);
    apple.position.set(-0.17, 0.3, 0.02);
    const cupcake = buildGood(kit, 'cupcake');
    cupcake.scale.setScalar(0.8);
    cupcake.position.set(0.2, 0.28, -0.04);
    basket.add(root, apple, cupcake);
    this.basket.add(basket);
    this.basket.position.set(0.15, 0, 0);
    this.scene.add(this.basket);
    // A soft shadow under the basket.
    const shadow = kit.blob(
      kit.mat('#000000', { transparent: true, opacity: 0.12 }),
      0.6,
      0.01,
      0.3,
      0.15,
      0,
      0,
    );
    this.scene.add(shadow);
    this.coin = buildMoney(kit, 100);
    this.coin.scale.setScalar(1.6);
    this.scene.add(this.coin);
    this.frameBox = [
      new Vector3(-1.75, 0.0, 0.3),
      new Vector3(0.75, 0.0, 0.3),
      new Vector3(-1.2, 2.0, 0),
      new Vector3(0.75, 0.9, 0),
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
    let distance = 4;
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
    const pitch = (12 * Math.PI) / 180;
    camera.position.set(-0.4, 0.8 + Math.sin(pitch) * distance, Math.cos(pitch) * distance);
    camera.lookAt(-0.4, 0.8, 0);
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
    const { along, arc, flips, shown, squash } = calm
      ? { along: 0.45, arc: Math.sin(0.45 * Math.PI) * 1.1, flips: 1.1, shown: true, squash: 0 }
      : tossPhase(t);
    this.coin.visible = shown;
    this.coin.position.lerpVectors(FROM, INTO, along);
    this.coin.position.y += arc;
    // Flip about the horizontal axis, settling face-on to the child between flips.
    this.coin.rotation.x = flips * Math.PI * 2;
    this.coin.rotation.y = -0.3;
    const sink = along > 0.85 ? (along - 0.85) / 0.15 : 0;
    this.coin.scale.setScalar(1.6 * (1 - sink * 0.5));
    this.basket.scale.set(1 + squash * 0.08, 1 - squash * 0.1, 1 + squash * 0.08);
  }

  override dispose() {
    super.dispose();
    this.kit.dispose();
  }
}
