import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Points,
  PointsMaterial,
  RingGeometry,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three';
import { easeOut } from '../../shared/three/motion';

/** The highest the waves reach; ripples float just above them so no wave cuts them in half. */
export const WAVE_TOP = 0.1;

interface Slot<T> {
  readonly object: T;
  readonly velocity: Vector3;
  born: number;
  life: number;
  size: number;
  opacity: number;
  active: boolean;
}

/** A fixed set of reusable objects: taking one when all are busy recycles the oldest. */
class Pool<T> {
  readonly slots: Slot<T>[];
  constructor(count: number, make: (index: number) => T) {
    this.slots = Array.from({ length: count }, (_, index) => ({
      object: make(index),
      velocity: new Vector3(),
      born: 0,
      life: 1,
      size: 1,
      opacity: 1,
      active: false,
    }));
  }
  take(now: number): Slot<T> {
    let pick = this.slots[0]!;
    for (const slot of this.slots) {
      if (!slot.active) {
        pick = slot;
        break;
      }
      if (slot.born < pick.born) pick = slot;
    }
    pick.active = true;
    pick.born = now;
    return pick;
  }
}

const RINGS = 28;
const DROPS = 48;
const SPARKS = 56;
const COINS = 9;
const GLINTS = 30;

const hidden = new Matrix4().makeScale(0, 0, 0);

/**
 * The pond's splashes, ripples, sparkles, coins and the sun glinting on the water. Every
 * object is made once and reused, so a busy pond (a frenzy, a golden snack) never allocates
 * while it plays; when a pool runs out, its oldest effect makes way.
 */
export class PondFx {
  readonly root = new Group();
  private readonly rings: Pool<Mesh<RingGeometry, MeshBasicMaterial>>;
  private readonly drops: Pool<number>;
  private readonly dropMesh: InstancedMesh;
  /** Where each drop is; the instanced mesh only keeps their matrices. */
  private readonly dropAt = Array.from({ length: DROPS }, () => new Vector3());
  private readonly sparks: Pool<Sprite>;
  private readonly coins: Pool<Mesh>;
  private readonly glints: Points<BufferGeometry, PointsMaterial>;
  private readonly glintPhase = new Float32Array(GLINTS);
  private readonly matrix = new Matrix4();
  private readonly color = new Color();
  private now = 0;

  constructor(readonly sparkTexture: CanvasTexture) {
    const ringGeometry = new RingGeometry(0.82, 1, 40);
    this.rings = new Pool(RINGS, () => {
      const mesh = new Mesh(
        ringGeometry,
        new MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      this.root.add(mesh);
      return mesh;
    });

    this.dropMesh = new InstancedMesh(
      new SphereGeometry(1, 8, 6),
      new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 }),
      DROPS,
    );
    this.dropMesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.dropMesh.frustumCulled = false;
    for (let i = 0; i < DROPS; i++) this.dropMesh.setMatrixAt(i, hidden);
    this.root.add(this.dropMesh);
    this.drops = new Pool(DROPS, (index) => index);

    this.sparks = new Pool(SPARKS, () => {
      const sprite = new Sprite(
        new SpriteMaterial({
          map: sparkTexture,
          blending: AdditiveBlending,
          depthWrite: false,
          transparent: true,
        }),
      );
      sprite.visible = false;
      this.root.add(sprite);
      return sprite;
    });

    const coinGeometry = new CylinderGeometry(1, 1, 0.22, 20);
    const coinMaterial = new MeshStandardMaterial({
      color: '#ffc93c',
      metalness: 0.5,
      roughness: 0.3,
      emissive: '#b8740a',
      emissiveIntensity: 0.9,
    });
    this.coins = new Pool(COINS, () => {
      const coin = new Mesh(coinGeometry, coinMaterial);
      coin.castShadow = true;
      coin.visible = false;
      this.root.add(coin);
      return coin;
    });

    // Sun glints: points on the water that flash and fade at their own pace.
    const glintGeometry = new BufferGeometry();
    glintGeometry.setAttribute('position', new BufferAttribute(new Float32Array(GLINTS * 3), 3));
    const colors = new BufferAttribute(new Float32Array(GLINTS * 3), 3);
    colors.setUsage(DynamicDrawUsage);
    glintGeometry.setAttribute('color', colors);
    this.glints = new Points(
      glintGeometry,
      new PointsMaterial({
        map: sparkTexture,
        size: 0.3,
        vertexColors: true,
        blending: AdditiveBlending,
        depthWrite: false,
        transparent: true,
        fog: false,
      }),
    );
    this.glints.frustumCulled = false;
    this.glints.renderOrder = 1;
    this.root.add(this.glints);
    for (let i = 0; i < GLINTS; i++) this.glintPhase[i] = (i * 2.399) % (Math.PI * 2);
  }

  /** Spreads the glints over the open water: `center` and `width` describe what the camera sees. */
  placeGlints(center: Vector3, width: number, depth: number) {
    const position = this.glints.geometry.getAttribute('position') as BufferAttribute;
    for (let i = 0; i < GLINTS; i++) {
      // An R2 scatter (from the plastic number) spreads them evenly, without clumps or rows.
      const u = ((0.5 + i * 0.7548777) % 1) - 0.5;
      const v = ((0.5 + i * 0.5698403) % 1) - 0.5;
      position.setXYZ(i, center.x + u * width, WAVE_TOP + 0.02, center.z + v * depth);
    }
    position.needsUpdate = true;
    this.glints.material.size = width * 0.075;
  }

  /** A ripple ring spreading on the water. */
  ring(at: Vector3, size: number, life: number, opacity = 0.6) {
    const slot = this.rings.take(this.now);
    slot.life = life;
    slot.size = size;
    slot.opacity = opacity;
    const mesh = slot.object;
    mesh.position.copy(at).setY(Math.max(at.y, WAVE_TOP));
    mesh.scale.setScalar(size * 0.3);
    mesh.material.opacity = opacity;
    mesh.visible = true;
  }

  /** A water drop thrown up from `at` with `vx, vy, vz` per second. */
  drop(at: Vector3, vx: number, vy: number, vz: number, size: number, life = 0.7) {
    const slot = this.drops.take(this.now);
    slot.life = life;
    slot.size = size;
    slot.velocity.set(vx, vy, vz);
    this.dropAt[slot.object]!.copy(at);
  }

  /** A sparkle that drifts up and fades. */
  spark(at: Vector3, size: number, life: number, color: string | Color = '#ffe27a', rise = 0.8) {
    const slot = this.sparks.take(this.now);
    slot.life = life;
    slot.size = size;
    slot.velocity.set(0, size * rise, 0);
    const sprite = slot.object;
    sprite.position.copy(at);
    sprite.scale.setScalar(0.0001);
    sprite.material.color.set(color);
    sprite.material.opacity = 1;
    sprite.visible = true;
  }

  /** A gold coin tossed up from `at`, tumbling as it falls. */
  coin(at: Vector3, vx: number, vy: number, vz: number, size: number) {
    const slot = this.coins.take(this.now);
    slot.life = 1.1;
    slot.size = size;
    slot.velocity.set(vx, vy, vz);
    const coin = slot.object;
    coin.position.copy(at);
    coin.rotation.set(Math.random() * 3, Math.random() * 3, Math.PI / 2);
    coin.scale.setScalar(size);
    coin.visible = true;
  }

  /** A splash: a ring and a crown of drops. Calm motion keeps the ring only. */
  splash(at: Vector3, size: number, drops: number, calm: boolean) {
    this.ring(at, size * 1.4, 0.8);
    if (calm) return;
    for (let i = 0; i < drops; i++) {
      const angle = (i / drops) * Math.PI * 2 + Math.random() * 0.4;
      const speed = size * (1.6 + Math.random());
      this.drop(
        at,
        Math.cos(angle) * speed,
        size * (3 + Math.random() * 2),
        Math.sin(angle) * speed,
        size * 0.09,
      );
    }
  }

  /**
   * Moves every live effect on. `glint` is 0 (no glints, a dull sky) to 1; `calm` holds the
   * glints still at a soft shine instead of flashing.
   */
  update(t: number, dt: number, glint: number, calm: boolean, tint: Color) {
    this.now = t;
    for (const slot of this.rings.slots) {
      if (!slot.active) continue;
      const age = (t - slot.born) / slot.life;
      const mesh = slot.object;
      if (age >= 1) {
        slot.active = mesh.visible = false;
        continue;
      }
      mesh.scale.setScalar(slot.size * (0.3 + easeOut(age) * 1.2));
      mesh.material.opacity = slot.opacity * (1 - age);
    }

    let dropsChanged = false;
    for (const slot of this.drops.slots) {
      if (!slot.active) continue;
      dropsChanged = true;
      const at = this.dropAt[slot.object]!;
      const age = (t - slot.born) / slot.life;
      slot.velocity.y -= 9.8 * slot.size * 12 * dt;
      at.addScaledVector(slot.velocity, dt);
      if (age >= 1 || at.y < 0) {
        slot.active = false;
        this.dropMesh.setMatrixAt(slot.object, hidden);
        // A drop landing back in the pond leaves a tiny ring.
        if (at.y < 0 && slot.size > 0.02) this.ring(at, slot.size * 4, 0.5, 0.45);
        continue;
      }
      // Stretched along its fall, like a real drop.
      const stretch = 1 + Math.min(1.2, Math.abs(slot.velocity.y) / (slot.size * 60));
      this.matrix.makeScale(slot.size, slot.size * stretch, slot.size).setPosition(at);
      this.dropMesh.setMatrixAt(slot.object, this.matrix);
    }
    if (dropsChanged) this.dropMesh.instanceMatrix.needsUpdate = true;

    for (const slot of this.sparks.slots) {
      if (!slot.active) continue;
      const age = (t - slot.born) / slot.life;
      const sprite = slot.object;
      if (age >= 1) {
        slot.active = sprite.visible = false;
        continue;
      }
      sprite.position.addScaledVector(slot.velocity, dt);
      sprite.scale.setScalar(Math.max(0.0001, slot.size * Math.sin(age * Math.PI)));
      sprite.material.opacity = 1 - age;
    }

    for (const slot of this.coins.slots) {
      if (!slot.active) continue;
      const age = (t - slot.born) / slot.life;
      const coin = slot.object;
      slot.velocity.y -= 9.8 * slot.size * 5 * dt;
      coin.position.addScaledVector(slot.velocity, dt);
      coin.rotation.x += dt * 9;
      coin.rotation.y += dt * 4;
      if (age > 0.75) coin.scale.setScalar(Math.max(0.0001, slot.size * (1 - (age - 0.75) * 4)));
      if (age >= 1 || coin.position.y < 0) {
        if (coin.position.y < 0) this.ring(coin.position, slot.size * 5, 0.6, 0.5);
        slot.active = coin.visible = false;
      }
    }

    const colors = this.glints.geometry.getAttribute('color') as BufferAttribute;
    this.glints.visible = glint > 0.01;
    if (this.glints.visible) {
      for (let i = 0; i < GLINTS; i++) {
        const phase = this.glintPhase[i]!;
        // Mostly dark, with a short bright flash now and then.
        const wave = calm
          ? 0.12 + 0.18 * ((i * 0.37) % 1)
          : Math.max(0, Math.sin(t * (0.9 + (i % 5) * 0.23) + phase));
        const flash = (calm ? wave : wave ** 4) * glint;
        this.color.copy(tint).multiplyScalar(flash);
        colors.setXYZ(i, this.color.r, this.color.g, this.color.b);
      }
      colors.needsUpdate = true;
    }
  }
}
