import {
  BoxGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  OctahedronGeometry,
  PointLight,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
} from 'three';
import { TextLabel } from '../../shared/three/labels';
import { easeOut, EventCounter, shake, smooth } from '../../shared/three/motion';
import { disposeTree, Stage } from '../../shared/three/stage';
import { StateWorld } from '../../shared/three/three-stage';
import { buildChest } from './lock-chest';
import { dialDegrees, dialNumbers, labelStep, LockFrame } from './lock-frame';

const RING = 3.2;
const HOP_TIME = 0.45;

interface Hop {
  from: number;
  to: number;
  start: number;
}

interface Coin {
  mesh: Mesh;
  velocity: [number, number, number];
  spin: number;
}

/** Where a number sits on the ring, on the table plane (x right, z toward the camera). */
function ringPoint(value: number, max: number, radius = RING): [number, number] {
  const angle = (dialDegrees(value, max) * Math.PI) / 180;
  return [radius * Math.sin(angle), -radius * Math.cos(angle)];
}

/**
 * The treasure lock in 3D: a stone dial of number tiles around a treasure chest, with Pip the
 * firefly hopping from tile to tile. It draws the game's frame and never decides anything.
 */
export class LockWorld extends Stage implements StateWorld<LockFrame> {
  private frame?: LockFrame;
  private dialKey = '';
  private readonly dial = new Group();
  private readonly pip = new Group();
  private readonly pipBody: Mesh;
  private readonly pipLight = new PointLight('#ffd966', 6, 5);
  private readonly wings: Mesh[] = [];
  private readonly pipLabel = new TextLabel('0', {
    fill: '#fff8d6',
    border: '#b77f00',
    width: 192,
    height: 128,
    radius: 0.45,
  });
  private readonly pipTag: Sprite;
  private readonly chest: Group;
  private readonly lid: Group;
  private readonly crystal: Mesh;
  private readonly plateLabel = new TextLabel('0', {
    fill: '#ffd23f',
    border: '#8a5a00',
    width: 192,
    height: 128,
    radius: 0.3,
  });
  private readonly bodyMaterial: MeshStandardMaterial;
  private readonly lidMaterial: MeshStandardMaterial;
  /** The keyhole number floats over the chest, big enough to read from across the table. */
  private readonly signLabel = new TextLabel('0', {
    fill: '#ffd23f',
    border: '#8a5a00',
    width: 224,
    height: 160,
    radius: 0.35,
  });
  private readonly sign: Sprite;
  private readonly keyhole = new Group();
  private gem?: Mesh;
  private shown = 0;
  private hop?: Hop;
  private lidOpen = 0;
  private prickedAt = -10;
  private gemAt = -10;
  private readonly coins: Coin[] = [];
  private readonly hops = new EventCounter();
  private readonly pricks = new EventCounter();
  private readonly gems = new EventCounter();
  private readonly coinGeometry = new CylinderGeometry(0.11, 0.11, 0.04, 16);
  private readonly coinMaterial = new MeshStandardMaterial({
    color: '#ffcf33',
    metalness: 0.6,
    roughness: 0.3,
    emissive: '#5a3c00',
  });

  constructor(canvas: HTMLCanvasElement, host: HTMLElement) {
    super(canvas, host, { shadows: true, fov: 38 });
    this.fill.intensity = 1.6;
    this.sun.position.set(3, 10, 7);

    const base = new Mesh(
      new CylinderGeometry(RING + 1.15, RING + 1.3, 0.4, 72),
      new MeshStandardMaterial({ color: '#3b2f7d', roughness: 0.85 }),
    );
    base.position.y = -0.2;
    base.receiveShadow = true;
    const rim = new Mesh(
      new TorusGeometry(RING + 1.2, 0.08, 10, 96),
      new MeshStandardMaterial({ color: '#d9ad4a', metalness: 0.7, roughness: 0.35 }),
    );
    rim.rotation.x = Math.PI / 2;
    const inner = new Mesh(
      new CircleGeometry(RING - 0.55, 64),
      new MeshStandardMaterial({ color: '#2a2160', roughness: 0.9 }),
    );
    inner.rotation.x = -Math.PI / 2;
    inner.position.y = 0.01;
    inner.receiveShadow = true;
    this.scene.add(base, rim, inner, this.dial, this.keyhole);

    // Pip: a glowing body, a small head, two fluttering wings and a number tag.
    this.pipBody = new Mesh(
      new SphereGeometry(0.2, 24, 16),
      new MeshStandardMaterial({ color: '#ffe066', emissive: '#ffb800', emissiveIntensity: 1.4 }),
    );
    const head = new Mesh(
      new SphereGeometry(0.12, 20, 14),
      new MeshStandardMaterial({ color: '#4a3a8c', roughness: 0.6 }),
    );
    head.position.set(0, 0.12, -0.16);
    for (const side of [-1, 1]) {
      const wing = new Mesh(
        new SphereGeometry(0.2, 16, 8),
        new MeshStandardMaterial({ color: '#e8f6ff', transparent: true, opacity: 0.7 }),
      );
      wing.scale.set(1, 0.15, 0.6);
      wing.position.set(side * 0.2, 0.18, -0.05);
      this.wings.push(wing);
      this.pip.add(wing);
    }
    this.pipBody.castShadow = true;
    this.pipTag = new Sprite(
      new SpriteMaterial({ map: this.pipLabel.texture, depthTest: false, transparent: true }),
    );
    this.pipTag.scale.set(0.66, 0.44, 1);
    this.pipTag.renderOrder = 10;
    this.pip.add(this.pipBody, head, this.pipLight, this.pipTag);
    this.scene.add(this.pip);

    // The chest in the middle: body, a hinged lid with a crystal, and the keyhole plate.
    const model = buildChest(this.plateLabel.texture);
    this.chest = model.chest;
    this.lid = model.lid;
    this.crystal = model.crystal;
    this.bodyMaterial = model.bodyMaterial;
    this.lidMaterial = model.lidMaterial;
    this.chest.position.set(0, 0, 0.35);
    this.sign = new Sprite(new SpriteMaterial({ map: this.signLabel.texture, transparent: true }));
    this.sign.scale.set(1.3, 0.93, 1);
    this.sign.position.set(0, 2.1, 0.1);
    this.scene.add(this.chest, this.sign);
  }

  setState(frame: LockFrame) {
    const previous = this.frame;
    this.frame = frame;
    const key = `${frame.lock}|${frame.max}|${frame.target}|${frame.thorns.join(',')}`;
    if (key !== this.dialKey) {
      this.dialKey = key;
      this.buildDial(frame);
      this.shown = frame.value;
      this.hop = undefined;
      this.lidOpen = frame.opened ? 1 : 0;
      this.coins.splice(0).forEach((coin) => coin.mesh.removeFromParent());
    } else if (previous && frame.value !== previous.value) {
      this.hop = { from: this.shown, to: frame.value, start: this.elapsed };
    }
    if (this.hops.take(frame.hops) && !this.hop) this.shown = frame.value;
    if (this.pricks.take(frame.pricks)) this.prickedAt = this.elapsed;
    if (this.gems.take(frame.gems)) this.gemAt = this.elapsed;
    if (frame.opened && !previous?.opened) this.burst(frame.big);
    if (this.gem && frame.gem === null) this.gem.visible = false;
    this.pipLabel.update(String(frame.value));
    this.plateLabel.update(String(frame.target));
    this.signLabel.update(String(frame.target));
    this.chest.scale.setScalar(frame.big ? 1.25 : 1);
    this.bodyMaterial.color.set(frame.big ? '#d49a2a' : '#a8623a');
    this.lidMaterial.color.set(frame.big ? '#d49a2a' : '#a8623a');
    this.crystal.visible = frame.crystal !== 'none';
    (this.crystal.material as MeshStandardMaterial).opacity = frame.crystal === 'faded' ? 0.2 : 1;
    this.pipLight.color = new Color(frame.fever ? '#ff7ac8' : '#ffd966');
    this.draw();
  }

  protected override layout(aspect: number) {
    super.layout(aspect);
    // Pull back on narrow screens so the whole dial stays in view.
    const distance = (aspect < 1 ? 14.2 / aspect ** 0.7 : 14.2) * 1;
    this.camera.position.set(0, distance * 0.86, distance * 0.5);
    this.camera.lookAt(0, 0, 0.35);
  }

  protected update(dt: number, t: number) {
    const frame = this.frame;
    if (!frame) return;
    const calm = this.calm;

    // Pip hops along the ring in an arc; long hops (doubling) fly higher.
    let value = this.shown;
    let lift = 0;
    if (this.hop) {
      const progress = Math.min(1, (t - this.hop.start) / HOP_TIME);
      const eased = smooth(progress);
      value = this.hop.from + (this.hop.to - this.hop.from) * eased;
      const span = Math.abs(this.hop.to - this.hop.from) / frame.max;
      lift = Math.sin(progress * Math.PI) * (0.6 + span * 2.4);
      if (progress >= 1) {
        this.shown = this.hop.to;
        this.hop = undefined;
      }
    }
    const [x, z] = ringPoint(value, frame.max);
    const bob = calm ? 0 : Math.sin(t * 3) * 0.06;
    const jolt = shake(t, this.prickedAt, 0.5, 0.12);
    this.pip.position.set(x + jolt, 0.55 + lift + bob, z);
    // Pip's number tag sits on the inside of the ring, clear of the printed numbers outside.
    this.pipTag.position.set((-x / RING) * 0.95, 0.35, (-z / RING) * 0.95);
    const flap = calm ? 0.3 : Math.sin(t * (this.hop ? 40 : 18)) * 0.6;
    this.wings.forEach((wing, index) => (wing.rotation.z = (index ? -1 : 1) * flap));
    const pricked = t - this.prickedAt < 0.5;
    const gemmed = t - this.gemAt < 0.6;
    const glow = frame.fever && !calm ? 1.6 + Math.sin(t * 10) * 0.6 : 1.4;
    const body = this.pipBody.material as MeshStandardMaterial;
    body.emissive.set(pricked ? '#ff3355' : gemmed ? '#55ddff' : '#ffb800');
    body.emissiveIntensity = glow;
    this.pipLight.intensity = gemmed ? 12 : 6;

    // The keyhole tile pulses; the gem spins above its tile.
    const pulse = calm ? 1 : 1 + Math.sin(t * 4) * 0.08;
    this.keyhole.scale.setScalar(pulse);
    if (this.gem) {
      this.gem.rotation.y += dt * 2;
      this.gem.position.y = 0.55 + (calm ? 0 : Math.sin(t * 2.5) * 0.08);
    }

    // The lid swings open; coins fly out and fall back onto the chest.
    const target = frame.opened ? 1 : 0;
    this.lidOpen += (target - this.lidOpen) * Math.min(1, dt * 8);
    this.lid.rotation.x = -easeOut(this.lidOpen) * 1.25;
    this.sign.position.y = 2.1 + easeOut(this.lidOpen) * 0.5 + (calm ? 0 : Math.sin(t * 2) * 0.05);
    this.crystal.rotation.y += dt * (calm ? 0 : 1.5);
    for (const coin of this.coins) {
      coin.velocity[1] -= 9.8 * dt;
      coin.mesh.position.x += coin.velocity[0] * dt;
      coin.mesh.position.y = Math.max(0.05, coin.mesh.position.y + coin.velocity[1] * dt);
      coin.mesh.position.z += coin.velocity[2] * dt;
      if (coin.mesh.position.y <= 0.05) coin.velocity = [0, 0, 0];
      coin.mesh.rotation.x += coin.spin * dt;
    }
  }

  private burst(big: boolean) {
    const count = big ? 22 : 12;
    for (let index = 0; index < count; index++) {
      const mesh = new Mesh(this.coinGeometry, this.coinMaterial);
      mesh.position.set(0, 1.1, 0.35);
      const angle = (index / count) * Math.PI * 2;
      const speed = 1.2 + (index % 3) * 0.5;
      this.coins.push({
        mesh,
        velocity: [Math.cos(angle) * speed, 4 + (index % 4) * 0.6, Math.sin(angle) * speed],
        spin: 6 + index,
      });
      this.scene.add(mesh);
    }
  }

  private buildDial(frame: LockFrame) {
    for (const child of [...this.dial.children, ...this.keyhole.children]) {
      disposeTree(child);
      child.removeFromParent();
    }
    this.gem = undefined;
    const step = labelStep(frame.max);
    const spacing = ((270 / frame.max) * Math.PI * RING) / 180;
    const width = Math.min(0.6, spacing * 0.78);
    const stone = new MeshStandardMaterial({ color: '#6a5bc0', roughness: 0.6 });
    const majorStone = new MeshStandardMaterial({ color: '#8f80e0', roughness: 0.5 });
    const tile = new BoxGeometry(width, 0.16, 0.5);
    const majorTile = new BoxGeometry(width, 0.24, 0.62);
    for (const value of dialNumbers(frame.max)) {
      const major = value % step === 0;
      const mesh = new Mesh(major ? majorTile : tile, major ? majorStone : stone);
      this.place(mesh, value, frame.max, RING, major ? 0.12 : 0.08);
      mesh.receiveShadow = true;
      this.dial.add(mesh);
      // A printed number right next to an off-step keyhole would sit under its gold label.
      const crowded = value !== frame.target && Math.abs(value - frame.target) < frame.max / 25;
      if (major && !crowded)
        this.dial.add(this.numberSprite(value, frame.max, value === frame.target));
    }
    if (frame.target % step !== 0) this.dial.add(this.numberSprite(frame.target, frame.max, true));

    // The keyhole: a gold tile with a glowing ring around it.
    const gold = new Mesh(
      new BoxGeometry(width * 1.1, 0.3, 0.7),
      new MeshStandardMaterial({
        color: '#ffd23f',
        metalness: 0.5,
        roughness: 0.3,
        emissive: '#6b4a00',
      }),
    );
    this.place(gold, frame.target, frame.max, RING, 0.15);
    const halo = new Mesh(
      new TorusGeometry(0.42, 0.05, 8, 32),
      new MeshBasicMaterial({ color: '#fff3a6' }),
    );
    halo.rotation.x = Math.PI / 2;
    const [hx, hz] = ringPoint(frame.target, frame.max);
    this.keyhole.position.set(hx, 0.32, hz);
    halo.position.set(0, 0, 0);
    gold.position.set(0, -0.17, 0);
    gold.rotation.y = -(dialDegrees(frame.target, frame.max) * Math.PI) / 180;
    this.keyhole.add(gold, halo);

    for (const thorn of frame.thorns) {
      const bush = new Group();
      const material = new MeshStandardMaterial({ color: '#d8476a', roughness: 0.5 });
      for (let spike = 0; spike < 5; spike++) {
        const cone = new Mesh(new ConeGeometry(0.07, 0.42, 8), material);
        const a = (spike / 5) * Math.PI * 2;
        cone.position.set(Math.cos(a) * 0.1, 0.22, Math.sin(a) * 0.1);
        cone.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
        cone.castShadow = true;
        bush.add(cone);
      }
      this.place(bush, thorn, frame.max, RING, 0.12);
      this.dial.add(bush);
    }

    if (frame.gem !== null) {
      this.gem = new Mesh(
        new OctahedronGeometry(0.2),
        new MeshStandardMaterial({
          color: '#6fe0ff',
          emissive: '#0b6c8c',
          metalness: 0.3,
          roughness: 0.2,
        }),
      );
      const [gx, gz] = ringPoint(frame.gem, frame.max);
      this.gem.position.set(gx, 0.55, gz);
      this.gem.castShadow = true;
      this.dial.add(this.gem);
    }
  }

  private place(object: Object3D, value: number, max: number, radius: number, y: number) {
    const [x, z] = ringPoint(value, max, radius);
    object.position.set(x, y, z);
    object.rotation.y = -(dialDegrees(value, max) * Math.PI) / 180;
  }

  private numberSprite(value: number, max: number, target: boolean): Sprite {
    const label = new TextLabel(String(value), {
      ink: target ? '#3b2a07' : '#fff4c2',
      fill: target ? '#ffd23f' : undefined,
      border: target ? '#8a5a00' : undefined,
      width: 160,
      height: 128,
      radius: 0.4,
    });
    const sprite = new Sprite(new SpriteMaterial({ map: label.texture, transparent: true }));
    const [x, z] = ringPoint(value, max, RING + 0.82);
    sprite.position.set(x, 0.35, z);
    const size = max <= 20 ? 0.62 : 0.7;
    sprite.scale.set(size * 1.25, size, 1);
    return sprite;
  }

  override dispose() {
    this.coinGeometry.dispose();
    this.coinMaterial.dispose();
    super.dispose();
  }
}
