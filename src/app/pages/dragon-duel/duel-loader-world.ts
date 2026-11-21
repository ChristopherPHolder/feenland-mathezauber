import { CircleGeometry, Group, HemisphereLight, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { smooth } from '../../shared/three/motion';
import { Stage } from '../../shared/three/stage';
import type { StateWorld } from '../../shared/three/three-stage';
import { DragonModel } from '../hatchery/dragon-model';
import { dragonById } from '../hatchery/dragons';
import { ball, paint, SpriteModel } from './duel-models';

/** One fire ball across and back to rest takes this long; the scene loops on it. */
export const VOLLEY_SECONDS = 1.8;
/** Of each volley, the share the fire ball is in the air. */
const FLY = 0.45;
const DEG = Math.PI / 180;
const PITCH = 10;
/** The shared loader's "Loading…" pill sits about this many pixels under the centre line. */
const PILL_CLEAR = 52;
const DRAGON = new Vector3(-1.05, 0, 0.1);
const SPRITE = new Vector3(1.1, 0, 0);

/**
 * Where a volley stands at time `t`: how far across the fire ball is (0 at the dragon, 1 at
 * the sprite), whether it is in the air, and how hard the sprite is still reeling from it.
 */
export function volleyPhase(t: number) {
  const volley = Math.floor(t / VOLLEY_SECONDS);
  const into = t / VOLLEY_SECONDS - volley;
  const flying = into < FLY;
  const along = flying ? smooth(into / FLY) : 1;
  const reel = flying ? 0 : Math.max(0, 1 - (into - FLY) / 0.25);
  return { volley, along, flying, reel };
}

/**
 * The duel's loading scene: a baby fire dragon puffs fire balls at a pebble pixie, who wobbles
 * at each hit. Under calm motion it holds one posed frame with the fire ball halfway.
 */
export class DuelLoaderWorld extends Stage implements StateWorld<null> {
  private readonly dragon = new DragonModel(dragonById('ember')!, 0);
  private readonly sprite = new SpriteModel('pebble');
  private readonly fireball = new Group();
  private readonly probe = new Vector3();
  private readonly frameBox: readonly Vector3[];
  private readonly from = DRAGON.clone().add(new Vector3(0.4, 0.8, 0.2));
  private readonly to = SPRITE.clone().add(new Vector3(-0.2, 0.6, 0.15));
  private lastVolley = -1;

  constructor(canvas: HTMLCanvasElement, host: HTMLElement) {
    super(canvas, host, { fov: 32 });
    this.fill.intensity = 0.6;
    this.scene.add(new HemisphereLight('#fff6fb', '#7fb07a', 1.4));
    this.sun.position.set(2, 6, 5);
    const ground = new Mesh(new CircleGeometry(2.4, 40), paint('#8fd28a', { roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2;
    ground.scale.set(1.2, 0.55, 1);
    this.scene.add(ground);
    this.dragon.root.position.copy(DRAGON);
    this.dragon.root.rotation.y = 0.85;
    this.sprite.root.position.copy(SPRITE);
    this.sprite.root.rotation.y = -0.6;
    this.fireball.add(
      ball(new MeshBasicMaterial({ color: '#ffd43f' }), 0.1, 0, 0, 0),
      ball(new MeshBasicMaterial({ color: '#ff7a2f' }), 0.14, -0.06, 0, 0, [1.3, 1, 1]),
      ball(new MeshBasicMaterial({ color: '#ff5a1f' }), 0.08, -0.2, 0, 0),
    );
    this.scene.add(this.dragon.root, this.sprite.root, this.fireball);
    this.frameBox = [
      new Vector3(DRAGON.x - 1.05, 0, 0.6),
      new Vector3(SPRITE.x + 0.7, 0, 0.6),
      new Vector3(DRAGON.x - 1.05, 1.5, 0),
      new Vector3(SPRITE.x + 0.6, 1.5, 0),
    ];
  }

  setState(_: null) {}

  protected override layout(aspect: number) {
    this.camera.clearViewOffset();
    super.layout(aspect);
    // As big as fits above the loader's "Loading…" pill, its ground just above it.
    const { width, height } = this;
    const top = height * 0.08;
    const floor = height / 2 + PILL_CLEAR;
    // A small scene, never more than a hand's width, however big the screen.
    const room = { x: Math.min(width * 0.86, 420), y: Math.min(floor - top, 220) };
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
    camera.position.set(
      0,
      0.7 + Math.sin(PITCH * DEG) * distance,
      Math.cos(PITCH * DEG) * distance,
    );
    camera.lookAt(0, 0.7, 0);
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
    const { volley, along, flying, reel } = calm
      ? { volley: 0, along: 0.5, flying: true, reel: 0 }
      : volleyPhase(t);
    if (volley !== this.lastVolley && !calm) {
      this.lastVolley = volley;
      this.dragon.cheer(t);
    }
    this.dragon.update(t, true, calm);
    this.sprite.update(t, calm);
    this.fireball.visible = flying;
    this.fireball.position.lerpVectors(this.from, this.to, along);
    this.fireball.position.y += Math.sin(along * Math.PI) * 0.3;
    this.sprite.root.position.x = SPRITE.x + Math.sin(reel * Math.PI) * 0.18;
    this.sprite.body.rotation.z = reel * Math.sin(t * 30) * 0.15;
    this.sprite.blink(reel > 0.3);
    this.sprite.skin.emissiveIntensity = reel > 0.6 ? 0.6 : 0;
  }
}
