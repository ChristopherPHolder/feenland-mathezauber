import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  OctahedronGeometry,
  PointLight,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
} from 'three';
import { TextLabel } from '../../shared/three/labels';
import { easeOutBack, EventCounter, shake, smooth } from '../../shared/three/motion';
import { disposeTree, Stage } from '../../shared/three/stage';
import { StateWorld } from '../../shared/three/three-stage';
import { BREW_COLOR, bubble, buildCauldron, Cauldron, SURFACE_Y } from './potion-cauldron';
import { FrameBottle, liquid, PotionFrame, shelfSpot } from './potion-frame';

/** Where the cauldron stands, and where the bottle shelf is. */
const POT_Z = -0.7;
const SHELF_Z = 2.1;
const SHELF_WIDTH = 6.6;
const POP_TIME = 0.4;
const FLY_TIME = 0.45;
const POUR_DELAY = 0.9;

const DONE_COLOR = '#ffd23f';
const FIZZ_COLOR = '#8f8d9e';

interface BottleView {
  readonly id: number;
  readonly group: Group;
  readonly glass: MeshStandardMaterial;
  readonly label: TextLabel;
  x: number;
  lift: number;
  born: number;
  /** When the bottle started leaving, and where it flies to. */
  leaving?: { start: number; to: [number, number, number]; tilt: number };
  /** When the bottle starts pouring itself into the cauldron. */
  pourAt?: number;
}

/** A bottle tips toward where it pours. */
function tiltToward(to: number, from: number) {
  return to < from ? 1 : -1;
}

interface Particle {
  readonly mesh: Mesh;
  velocity: [number, number, number];
  readonly born: number;
  readonly life: number;
  readonly spin: number;
  readonly grow: number;
}

/**
 * Olli's potion kitchen in 3D: a bubbling cauldron with the potion number above it, Olli the
 * owl on a stump, and the bottles on the shelf in front. Picked bottles lift, mixed bottles
 * pour into each other, and the last one pours into the cauldron. It never decides anything.
 */
export class PotionWorld extends Stage implements StateWorld<PotionFrame> {
  private frame?: PotionFrame;
  private potion = -1;
  private readonly bottles = new Map<number, BottleView>();
  /** Bottles already poured into the cauldron: they stay gone while the game still lists them. */
  private readonly poured = new Set<number>();
  private readonly bottleGlass = new SphereGeometry(0.44, 28, 20);
  private readonly bottleLiquid = new SphereGeometry(0.38, 28, 20, 0, Math.PI * 2, Math.PI * 0.42);
  private readonly bottleNeck = new CylinderGeometry(0.13, 0.15, 0.36, 18);
  private readonly bottleCork = new CylinderGeometry(0.15, 0.13, 0.16, 18);
  private readonly corkMaterial = new MeshStandardMaterial({ color: '#b98a5a', roughness: 0.8 });
  private readonly brew: MeshStandardMaterial;
  private readonly potLight = new PointLight(BREW_COLOR, 5, 6);
  private readonly cauldron: Cauldron;
  private readonly signLabel = new TextLabel('0', {
    fill: '#ffd23f',
    border: '#8a5a00',
    width: 224,
    height: 160,
    radius: 0.35,
  });
  private readonly sign: Sprite;
  private readonly sparkle: Mesh;
  private readonly owl = new Group();
  private readonly owlEyes: Mesh[] = [];
  private readonly owlWings: Mesh[] = [];
  private readonly particles: Particle[] = [];
  private readonly coinGeometry = new CylinderGeometry(0.11, 0.11, 0.04, 16);
  private readonly coinMaterial = new MeshStandardMaterial({
    color: '#ffcf33',
    metalness: 0.6,
    roughness: 0.3,
    emissive: '#5a3c00',
  });
  private readonly puffGeometry = new SphereGeometry(0.28, 14, 10);
  private readonly fizzles = new EventCounter();
  private readonly brews = new EventCounter();
  /** When the last pour reached the cauldron, and whether it was the right potion. */
  private landedAt = -10;
  private landedRight = false;
  private landing = false;
  private fizzedAt = -10;
  private cheeredAt = -10;
  private liquidColor = new Color(BREW_COLOR);

  constructor(canvas: HTMLCanvasElement, host: HTMLElement) {
    super(canvas, host, { shadows: true, fov: 40 });
    this.fill.intensity = 1.5;
    this.sun.position.set(-3, 10, 8);

    const floor = new Mesh(
      new CylinderGeometry(6, 6.3, 0.4, 72),
      new MeshStandardMaterial({ color: '#3b2f7d', roughness: 0.9 }),
    );
    floor.position.set(0, -0.2, 0.4);
    floor.receiveShadow = true;
    const shelf = new Mesh(
      new BoxGeometry(SHELF_WIDTH + 0.6, 0.24, 1.3),
      new MeshStandardMaterial({ color: '#8b5a2b', roughness: 0.8 }),
    );
    shelf.position.set(0, 0.12, SHELF_Z);
    shelf.receiveShadow = true;
    this.scene.add(floor, shelf);

    // The cauldron, shared with the loading scene.
    this.cauldron = buildCauldron();
    this.brew = this.cauldron.brew;
    this.potLight.position.set(0, 2.2, 0);
    this.cauldron.group.add(this.potLight);
    this.cauldron.group.position.set(0, 0, POT_Z);
    this.scene.add(this.cauldron.group);

    // The potion number floats over the cauldron, with the hourglass sparkle beside it.
    this.sign = new Sprite(new SpriteMaterial({ map: this.signLabel.texture, transparent: true }));
    this.sign.scale.set(1.25, 0.9, 1);
    this.sign.position.set(0, 3.0, POT_Z);
    this.sparkle = new Mesh(
      new OctahedronGeometry(0.2),
      new MeshStandardMaterial({
        color: '#ff9ad5',
        emissive: '#c2187a',
        emissiveIntensity: 0.8,
        transparent: true,
      }),
    );
    this.sparkle.position.set(0.95, 3.25, POT_Z);
    this.scene.add(this.sign, this.sparkle);

    this.buildOwl();
  }

  setState(frame: PotionFrame) {
    this.frame = frame;
    if (frame.potion !== this.potion) {
      this.potion = frame.potion;
      for (const view of [...this.bottles.values()]) this.disposeBottle(view);
      this.poured.clear();
      frame.bottles.forEach((bottle, index) =>
        this.addBottle(bottle, frame, this.elapsed + index * 0.08),
      );
      this.landedAt = -10;
      this.landing = false;
      this.liquidColor.set(BREW_COLOR);
    } else {
      this.syncBottles(frame);
    }
    const fizzed = this.fizzles.take(frame.fizzles) > 0;
    const brewed = this.brews.take(frame.brews) > 0;
    if (fizzed || brewed) {
      // The last bottle pours itself into the cauldron.
      for (const view of this.bottles.values())
        if (!view.leaving) view.pourAt = this.elapsed + POUR_DELAY;
      this.landedRight = brewed;
      // Nothing shows in the cauldron until the bottle has poured in.
      this.landedAt = Infinity;
    }
    this.signLabel.update(String(frame.target));
    this.cauldron.group.scale.setScalar(frame.big ? 1.12 : 1);
    this.sparkle.visible = frame.sparkle !== 'none';
    (this.sparkle.material as MeshStandardMaterial).opacity = frame.sparkle === 'faded' ? 0.2 : 1;
    this.draw();
  }

  protected override layout(aspect: number) {
    super.layout(aspect);
    // Pull back on narrow screens so the shelf and Olli stay in view.
    const distance = aspect < 1.25 ? 10.4 * (1.25 / aspect) ** 0.85 : 10.4;
    this.camera.position.set(0, 1.1 + distance * 0.45, 0.7 + distance * 0.89);
    this.camera.lookAt(0, 1.05, 0.7);
  }

  protected update(dt: number, t: number) {
    const frame = this.frame;
    if (!frame) return;
    const calm = this.calm;

    // Bottles pop in, lift when picked, fly to where they pour, and shrink away.
    for (const view of [...this.bottles.values()]) {
      const group = view.group;
      if (view.leaving) {
        const progress = Math.min(1, (t - view.leaving.start) / FLY_TIME);
        const eased = smooth(progress);
        const [tx, ty, tz] = view.leaving.to;
        group.position.x += (tx - group.position.x) * eased;
        group.position.y += (ty - group.position.y) * eased;
        group.position.z += (tz - group.position.z) * eased;
        group.rotation.z = view.leaving.tilt * eased;
        group.scale.setScalar(Math.max(0.001, 1 - eased));
        if (progress >= 1) this.disposeBottle(view);
        continue;
      }
      if (view.pourAt !== undefined && t >= view.pourAt) {
        view.leaving = { start: t, to: [0, SURFACE_Y + 0.6, POT_Z], tilt: tiltToward(0, view.x) };
        this.poured.add(view.id);
        this.landedAt = t + FLY_TIME;
        this.landing = true;
        continue;
      }
      const age = t - view.born;
      group.scale.setScalar(age < 0 ? 0.001 : Math.max(0.001, easeOutBack(age / POP_TIME)));
      const picked = view.id === frame.picked;
      view.lift += ((picked ? 0.5 : 0) - view.lift) * Math.min(1, dt * 12);
      group.position.x += (view.x - group.position.x) * Math.min(1, dt * 8);
      const bob = calm || !picked ? 0 : Math.sin(t * 5) * 0.05;
      group.position.y = view.lift + bob;
      group.position.z = SHELF_Z;
      group.rotation.z = 0;
      view.glass.emissiveIntensity = picked ? 0.9 : 0;
    }

    // The potion surface turns gold for a right potion and grey for a fizz.
    const landed = t >= this.landedAt;
    if (this.landing && landed) {
      this.landing = false;
      if (this.landedRight) this.celebrate(frame.big);
      else this.fizz();
    }
    const tint = frame.fever && !calm ? new Color().setHSL((t * 0.25) % 1, 0.7, 0.6) : null;
    const goal = frame.brewed && landed ? DONE_COLOR : frame.fizzing && landed ? FIZZ_COLOR : null;
    const color = goal ?? tint ?? BREW_COLOR;
    this.liquidColor.lerp(new Color(color), Math.min(1, dt * 5));
    this.brew.color.copy(this.liquidColor);
    this.brew.emissive.copy(this.liquidColor);
    this.potLight.color.copy(this.liquidColor);
    this.potLight.intensity = frame.brewed && landed ? 9 : 5;
    this.cauldron.group.position.x = shake(t, this.fizzedAt, 0.6, 0.12);

    // Bubbles rise faster once the potion is brewed; flames flicker.
    bubble(this.cauldron, t, frame.brewed ? 1.4 : 0.7, calm);

    this.sign.position.y = 3.0 + (calm ? 0 : Math.sin(t * 2) * 0.05);
    this.sparkle.rotation.y += dt * (calm ? 0 : 1.5);

    // Olli bobs, blinks, cheers with flapping wings, and shakes its head at a fizz.
    const cheer = t - this.cheeredAt;
    const hop = cheer < 0.9 ? Math.sin((cheer / 0.9) * Math.PI) * 0.6 : 0;
    this.owl.position.y = hop + (calm ? 0 : Math.sin(t * 1.6) * 0.03);
    this.owl.rotation.y = 0.45 + shake(t, this.fizzedAt, 0.8, 0.5);
    const flap = cheer < 1.2 && !calm ? Math.sin(t * 30) * 0.6 : 0;
    this.owlWings.forEach((wing, index) => (wing.rotation.z = (index ? -1 : 1) * (0.1 + flap)));
    const blink = !calm && t % 4 < 0.12 ? 0.1 : 1;
    this.owlEyes.forEach((eye) => (eye.scale.y = blink));

    // Coins and smoke fly and fade.
    for (const particle of [...this.particles]) {
      const age = t - particle.born;
      if (age > particle.life) {
        particle.mesh.removeFromParent();
        if (particle.grow) (particle.mesh.material as MeshStandardMaterial).dispose();
        this.particles.splice(this.particles.indexOf(particle), 1);
        continue;
      }
      particle.velocity[1] -= particle.grow ? -0.4 * dt : 9.8 * dt;
      particle.mesh.position.x += particle.velocity[0] * dt;
      particle.mesh.position.y = Math.max(
        0.05,
        particle.mesh.position.y + particle.velocity[1] * dt,
      );
      particle.mesh.position.z += particle.velocity[2] * dt;
      particle.mesh.rotation.x += particle.spin * dt;
      if (particle.grow) {
        particle.mesh.scale.setScalar(1 + age * particle.grow);
        (particle.mesh.material as MeshStandardMaterial).opacity = 0.75 * (1 - age / particle.life);
      }
    }
  }

  /** Adds new bottles, sends removed ones off, and slides the rest to their new spots. */
  private syncBottles(frame: PotionFrame) {
    const ids = new Set(frame.bottles.map((bottle) => bottle.id));
    for (const id of this.poured) if (!ids.has(id)) this.poured.delete(id);
    const fresh = frame.bottles.filter(
      (bottle) => !this.bottles.has(bottle.id) && !this.poured.has(bottle.id),
    );
    const made = fresh.length === 1 ? fresh[0] : null;
    for (const view of this.bottles.values()) {
      if (ids.has(view.id) || view.leaving) continue;
      if (made) {
        // Mixed: both bottles pour into the new one.
        const x = this.spotX(frame.bottles.indexOf(made), frame.bottles.length);
        view.leaving = { start: this.elapsed, to: [x, 0.9, SHELF_Z], tilt: tiltToward(x, view.x) };
      } else {
        view.leaving = { start: this.elapsed, to: [view.x, 0, SHELF_Z], tilt: 0 };
      }
    }
    for (const bottle of fresh)
      this.addBottle(bottle, frame, this.elapsed + (made ? FLY_TIME * 0.6 : 0));
    frame.bottles.forEach((bottle, index) => {
      const view = this.bottles.get(bottle.id);
      if (view && !view.leaving) view.x = this.spotX(index, frame.bottles.length);
    });
  }

  private spotX(index: number, count: number) {
    return (shelfSpot(index, count) - 0.5) * SHELF_WIDTH;
  }

  private addBottle(bottle: FrameBottle, frame: PotionFrame, born: number) {
    const group = new Group();
    const glass = new MeshStandardMaterial({
      color: '#eaf4ff',
      transparent: true,
      opacity: 0.35,
      roughness: 0.1,
      emissive: '#ffd23f',
      emissiveIntensity: 0,
    });
    const color = liquid(bottle.id);
    const body = new Mesh(this.bottleGlass, glass);
    body.position.y = 0.68;
    const potion = new Mesh(
      this.bottleLiquid,
      new MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35 }),
    );
    potion.position.y = 0.68;
    const neck = new Mesh(this.bottleNeck, glass);
    neck.position.y = 1.25;
    const cork = new Mesh(this.bottleCork, this.corkMaterial);
    cork.position.y = 1.48;
    body.castShadow = true;
    const label = new TextLabel(String(bottle.value), {
      fill: '#ffffff',
      border: '#b9a9e0',
      width: 192,
      height: 144,
      radius: 0.35,
    });
    const tag = new Sprite(
      new SpriteMaterial({ map: label.texture, depthTest: false, transparent: true }),
    );
    tag.scale.set(0.72, 0.54, 1);
    tag.position.set(0, 0.62, 0.5);
    tag.renderOrder = 10;
    group.add(body, potion, neck, cork, tag);
    const index = frame.bottles.findIndex((item) => item.id === bottle.id);
    const x = this.spotX(index, frame.bottles.length);
    group.position.set(x, 0, SHELF_Z);
    group.scale.setScalar(0.001);
    this.scene.add(group);
    this.bottles.set(bottle.id, { id: bottle.id, group, glass, label, x, lift: 0, born });
  }

  /** Frees a bottle's own materials and label; the shared shapes stay for the next bottles. */
  private disposeBottle(view: BottleView) {
    this.bottles.delete(view.id);
    view.group.removeFromParent();
    view.group.traverse((object) => {
      if (object instanceof Sprite) {
        object.material.map?.dispose();
        object.material.dispose();
      } else if (object instanceof Mesh && object.material !== this.corkMaterial) {
        (object.material as MeshStandardMaterial).dispose();
      }
    });
  }

  private celebrate(big: boolean) {
    this.cheeredAt = this.elapsed;
    const count = big ? 22 : 12;
    for (let index = 0; index < count; index++) {
      const mesh = new Mesh(this.coinGeometry, this.coinMaterial);
      mesh.position.set(0, SURFACE_Y + 0.3, POT_Z);
      const angle = (index / count) * Math.PI * 2;
      const speed = 1.1 + (index % 3) * 0.5;
      this.particles.push({
        mesh,
        velocity: [Math.cos(angle) * speed, 4.5 + (index % 4) * 0.6, Math.sin(angle) * speed],
        born: this.elapsed,
        life: 2.4,
        spin: 6 + index,
        grow: 0,
      });
      this.scene.add(mesh);
    }
  }

  private fizz() {
    this.fizzedAt = this.elapsed;
    for (let index = 0; index < 7; index++) {
      const mesh = new Mesh(
        this.puffGeometry,
        new MeshStandardMaterial({ color: '#b8b6c6', transparent: true, opacity: 0.75 }),
      );
      const angle = (index / 7) * Math.PI * 2;
      mesh.position.set(Math.cos(angle) * 0.5, SURFACE_Y + 0.2, POT_Z + Math.sin(angle) * 0.5);
      this.particles.push({
        mesh,
        velocity: [Math.cos(angle) * 0.5, 0.7 + (index % 3) * 0.2, Math.sin(angle) * 0.5],
        born: this.elapsed,
        life: 1.2,
        spin: 0,
        grow: 1.4,
      });
      this.scene.add(mesh);
    }
  }

  private buildOwl() {
    const feathers = new MeshStandardMaterial({ color: '#a7774d', roughness: 0.8 });
    const light = new MeshStandardMaterial({ color: '#ecd6b2', roughness: 0.8 });
    const stump = new Mesh(
      new CylinderGeometry(0.5, 0.6, 0.9, 20),
      new MeshStandardMaterial({ color: '#7a4f2a', roughness: 0.9 }),
    );
    stump.position.set(-4, 0.45, -2);
    stump.castShadow = true;
    this.scene.add(stump);
    const body = new Mesh(new SphereGeometry(0.6, 24, 18), feathers);
    body.scale.set(1, 1.15, 0.9);
    body.position.y = 1.55;
    body.castShadow = true;
    const belly = new Mesh(new SphereGeometry(0.45, 20, 14), light);
    belly.scale.set(1, 1.1, 0.5);
    belly.position.set(0, 1.42, 0.36);
    this.owl.add(body, belly);
    const white = new MeshStandardMaterial({ color: '#fffaf0' });
    const dark = new MeshStandardMaterial({ color: '#2a1d12' });
    for (const side of [-1, 1]) {
      const eye = new Mesh(new SphereGeometry(0.2, 18, 12), white);
      eye.position.set(side * 0.23, 1.92, 0.42);
      const pupil = new Mesh(new SphereGeometry(0.09, 12, 8), dark);
      pupil.position.set(0, 0, 0.16);
      eye.add(pupil);
      this.owlEyes.push(eye);
      const ear = new Mesh(new ConeGeometry(0.11, 0.32, 10), feathers);
      ear.position.set(side * 0.33, 2.3, 0.05);
      ear.rotation.z = -side * 0.35;
      const wing = new Mesh(new SphereGeometry(0.36, 16, 12), feathers);
      wing.scale.set(0.35, 1, 0.8);
      wing.position.set(side * 0.6, 1.5, 0);
      this.owlWings.push(wing);
      this.owl.add(eye, ear, wing);
    }
    const beak = new Mesh(
      new ConeGeometry(0.08, 0.22, 10),
      new MeshStandardMaterial({ color: '#f4b740' }),
    );
    beak.rotation.x = Math.PI;
    beak.position.set(0, 1.76, 0.56);
    this.owl.add(beak);
    const holder = new Group();
    holder.position.set(-4, 0.4, -2);
    holder.add(this.owl);
    this.scene.add(holder);
  }

  override dispose() {
    for (const view of [...this.bottles.values()]) this.disposeBottle(view);
    for (const geometry of [
      this.bottleGlass,
      this.bottleLiquid,
      this.bottleNeck,
      this.bottleCork,
      this.coinGeometry,
      this.puffGeometry,
    ])
      geometry.dispose();
    this.corkMaterial.dispose();
    this.coinMaterial.dispose();
    for (const particle of this.particles) particle.mesh.removeFromParent();
    super.dispose();
  }
}
