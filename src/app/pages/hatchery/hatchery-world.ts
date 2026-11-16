import {
  CanvasTexture,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PointLight,
  Scene,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';
import { Stage } from '../../shared/three/stage';
import type { StateWorld } from '../../shared/three/three-stage';
import { DragonModel, RAINBOW } from './dragon-model';
import { buildNest, EGG_HEIGHT, EggModel, SPLIT } from './egg-model';
import type { Dragon } from './dragons';

/** What the page asks the nest to show; the page owns the hatchery, this only draws it. */
export interface NestFrame {
  /** Counts cheers; each new one makes the dragon in the nest hop. */
  readonly cheers: number;
  /** The egg in the nest, or a dragon sitting in it. */
  readonly view: 'egg' | 'dragon';
  readonly egg: Dragon;
  /** How warm the egg is, or how close the dragon is to growing, from 0 to 1. */
  readonly warmth: number;
  /** The egg is ready to hatch, or the dragon ready to grow. */
  readonly ready: boolean;
  /** Taps given to a ready egg or dragon: each one cracks the egg a little more. */
  readonly cracks: number;
  readonly dragon: Dragon | null;
  /** The dragon's form, from 0 (the hatchling) to 2 (its final form). */
  readonly stage: number;
  /** Counts hatches this visit; a new one plays the hatching instead of just showing the dragon. */
  readonly hatches: number;
  /** Counts evolutions this visit; a new one plays the change into the next form. */
  readonly growths: number;
}

/** How long the old dragon spins and glows before the grown-up one bursts out. */
const GROW_SPIN = 1.1;

interface Spark {
  readonly mesh: Mesh;
  readonly velocity: Vector3;
  readonly born: number;
  readonly life: number;
}

/**
 * A cosy nest on a little floating meadow: the egg sits in it, glows as it warms, wobbles when
 * it is ready, cracks on each tap and pops open to let a baby dragon out.
 */
export class HatcheryWorld extends Stage implements StateWorld<NestFrame> {
  private readonly glow = new PointLight('#ff9a3c', 0, 1.6, 1.4);
  private readonly ember: Mesh;
  private readonly holder = new Group();
  private readonly sparks: Spark[] = [];
  private readonly sparkMaterials = [...RAINBOW, '#ffe27a', '#fffefc'].map(
    (color) => new MeshBasicMaterial({ color, transparent: true }),
  );
  private readonly sparkGeometry = new OctahedronGeometry(0.05);
  private readonly floaters: Mesh[] = [];
  private egg?: EggModel;
  private dragon?: DragonModel;
  /** The dragon spinning and glowing as it changes into its next form. */
  private outgoing?: DragonModel;
  private frame?: NestFrame;
  private shakeAt = -10;
  private hatchAt = -10;
  private growAt = -10;
  private hopAt = -10;

  constructor(canvas: HTMLCanvasElement, host: HTMLElement) {
    super(canvas, host, { shadows: true, fov: 34 });
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.fill.intensity = 0.5;
    this.scene.add(new HemisphereLight('#fff6fb', '#7fb07a', 1.3));
    this.sun.color.set('#fff3e0');
    this.sun.intensity = 2.2;
    this.sun.position.set(2.5, 5, 3.5);
    this.sun.shadow.camera.left = -2;
    this.sun.shadow.camera.right = 2;
    this.sun.shadow.camera.top = 2.5;
    this.sun.shadow.camera.bottom = -1;
    this.sun.shadow.radius = 4;
    const rim = new DirectionalLight('#c9b8ff', 1.1);
    rim.position.set(-3, 2.5, -3);
    this.scene.add(rim);

    this.scene.add(this.buildMeadow());
    this.scene.add(buildNest());
    this.ember = new Mesh(
      new CircleGeometry(0.42, 32),
      new MeshBasicMaterial({ color: '#ffb35c', transparent: true, opacity: 0 }),
    );
    this.ember.rotation.x = -Math.PI / 2;
    this.ember.position.y = 0.2;
    this.scene.add(this.ember);
    this.glow.position.set(0, 0.12, 0.25);
    this.scene.add(this.glow);
    this.holder.position.y = 0.04;
    this.scene.add(this.holder);
  }

  setState(frame: NestFrame) {
    const previous = this.frame;
    this.frame = frame;
    if (previous && frame.cheers > previous.cheers) this.cheer();
    if (frame.view === 'egg') {
      if (!this.egg || this.egg.dragon.id !== frame.egg.id || previous?.view !== 'egg') {
        this.clearDragon();
        this.clearEgg();
        this.egg = new EggModel(frame.egg);
        this.holder.add(this.egg.root);
      }
      if (previous && frame.cracks > previous.cracks) {
        this.shakeAt = this.elapsed;
        this.burst(new Vector3(0, 0.75, 0.2), 6, ['#fffefc', frame.egg.shell], 0.9);
      }
      if (!previous || frame.cracks !== previous.cracks || previous.egg.id !== frame.egg.id)
        this.egg.setCracks(frame.cracks);
      return;
    }
    const dragon = frame.dragon;
    if (!dragon) return;
    const hatching = !!previous && frame.hatches > previous.hatches;
    if (previous && frame.growths > previous.growths && this.dragon) {
      this.growUp(dragon, frame.stage);
      return;
    }
    if (this.dragon?.dragon.id === dragon.id && this.dragon.stage === frame.stage && !hatching) {
      if (previous && frame.cracks > previous.cracks) {
        // A tap on a dragon ready to grow: it wriggles and sparkles a little more each time.
        this.shakeAt = this.elapsed;
        this.dragon.cheer(this.elapsed);
        this.burst(new Vector3(0, 1, 0.2), 8 + frame.cracks * 4, ['#ffe27a', dragon.accent], 1.2);
      }
      return;
    }
    this.clearDragon();
    this.dragon = new DragonModel(dragon, frame.stage);
    this.holder.add(this.dragon.root);
    if (hatching && this.egg) {
      this.hatchAt = this.elapsed;
      this.egg.open();
      this.dragon.root.scale.setScalar(0.01);
      this.burst(new Vector3(0, 0.8, 0), 40, [...RAINBOW, '#ffe27a'], 2.6);
    } else {
      this.clearEgg();
      this.dragon.root.scale.setScalar(0.78);
      this.dragon.cheer(this.elapsed);
    }
  }

  /**
   * The dragon spins faster and faster, glowing white, then its next form bursts out in a
   * shower of sparkles. Calm motion skips the spin and only swaps it with a burst.
   */
  private growUp(dragon: Dragon, stage: number) {
    this.clearOutgoing();
    this.outgoing = this.dragon;
    this.dragon = new DragonModel(dragon, stage);
    this.dragon.root.visible = false;
    this.dragon.root.scale.setScalar(0.78);
    this.holder.add(this.dragon.root);
    this.growAt = this.elapsed;
    this.burst(new Vector3(0, 0.9, 0), 12, ['#fffefc', '#ffe27a'], 0.8);
  }

  /** The dragon in the nest does a happy hop. */
  private cheer() {
    this.dragon?.cheer(this.elapsed);
    this.burst(new Vector3(0, 1.2, 0), 14, ['#ffe27a', '#ff8cbf', '#fffefc'], 1.6);
  }

  override dispose() {
    for (const spark of this.sparks) (spark.mesh.material as Material).dispose();
    this.sparks.length = 0;
    this.sparkGeometry.dispose();
    for (const material of this.sparkMaterials) material.dispose();
    super.dispose();
  }

  private clearEgg() {
    if (!this.egg) return;
    this.holder.remove(this.egg.root);
    this.disposeTree(this.egg.root);
    this.egg = undefined;
  }

  private clearOutgoing() {
    if (!this.outgoing) return;
    this.holder.remove(this.outgoing.root);
    this.disposeTree(this.outgoing.root);
    this.outgoing = undefined;
  }

  private clearDragon() {
    this.clearOutgoing();
    if (!this.dragon) return;
    this.holder.remove(this.dragon.root);
    this.disposeTree(this.dragon.root);
    this.dragon = undefined;
  }

  private disposeTree(root: Group) {
    root.traverse((object) => {
      if (object instanceof Mesh) {
        object.geometry.dispose();
        const material = object.material as Material & { map?: CanvasTexture | null };
        material.map?.dispose();
        material.dispose();
      }
    });
  }

  private buildMeadow(): Group {
    const meadow = new Group();
    const grass = new MeshStandardMaterial({ color: '#8fd28a', roughness: 0.9 });
    const earth = new MeshStandardMaterial({ color: '#b48a5a', roughness: 1 });
    const top = new Mesh(new CylinderGeometry(2.1, 2.1, 0.16, 48), grass);
    top.position.y = -0.08;
    top.receiveShadow = true;
    const rock = new Mesh(new ConeGeometry(2.05, 1.3, 48), earth);
    rock.rotation.x = Math.PI;
    rock.position.y = -0.8;
    meadow.add(top, rock);
    // Flowers, mushrooms and pebbles round the edge.
    const petals = ['#ff8cbf', '#ffd43f', '#b79bff', '#fffefc', '#7cc7ff'];
    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2 + 0.3;
      const radius = 1.25 + (i % 3) * 0.22;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (i % 4 === 0) {
        const stem = new Mesh(
          new CylinderGeometry(0.05, 0.06, 0.18, 10),
          new MeshStandardMaterial({ color: '#fff4e0' }),
        );
        stem.position.set(x, 0.09, z);
        const cap = new Mesh(
          new SphereGeometry(0.14, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
          new MeshStandardMaterial({ color: '#ff6f7d', roughness: 0.6 }),
        );
        cap.position.set(x, 0.17, z);
        stem.castShadow = cap.castShadow = true;
        meadow.add(stem, cap);
      } else {
        const flower = new Mesh(
          new SphereGeometry(0.07, 10, 8),
          new MeshStandardMaterial({ color: petals[i % petals.length], roughness: 0.6 }),
        );
        flower.position.set(x, 0.1, z);
        flower.scale.y = 0.6;
        const stem = new Mesh(
          new CylinderGeometry(0.012, 0.012, 0.1, 6),
          new MeshStandardMaterial({ color: '#4f9a52' }),
        );
        stem.position.set(x, 0.04, z);
        meadow.add(flower, stem);
      }
    }
    // A few glowing fireflies drift round the nest.
    const fly = new MeshBasicMaterial({ color: '#fff6a8' });
    for (let i = 0; i < 6; i++) {
      const mesh = new Mesh(new SphereGeometry(0.025, 8, 6), fly);
      this.floaters.push(mesh);
      meadow.add(mesh);
    }
    return meadow;
  }

  private burst(at: Vector3, count: number, colors: readonly string[], speed: number) {
    for (let i = 0; i < count; i++) {
      const color = new Color(colors[i % colors.length]);
      const material =
        this.sparkMaterials.find((m) => m.color.equals(color)) ?? this.sparkMaterials[6];
      const mesh = new Mesh(this.sparkGeometry, material.clone());
      mesh.position.copy(at);
      const angle = Math.random() * Math.PI * 2;
      const lift = 0.4 + Math.random() * 0.9;
      const velocity = new Vector3(
        Math.cos(angle),
        lift,
        Math.sin(angle) * 0.7 + 0.3,
      ).multiplyScalar(speed * (0.5 + Math.random() * 0.6));
      this.scene.add(mesh);
      this.sparks.push({ mesh, velocity, born: this.elapsed, life: 0.9 + Math.random() * 0.5 });
    }
  }

  protected override layout(aspect: number) {
    this.camera.aspect = aspect;
    // Keep the nest and a standing dragon in frame: about 2.5 units tall and 3.2 wide.
    const tan = Math.tan((this.camera.fov * Math.PI) / 360);
    const distance = Math.max(2.5 / (2 * tan), 3.2 / (2 * tan * aspect));
    this.camera.position.set(0, 0.85 + distance * 0.32, distance);
    this.camera.lookAt(0, 0.82, 0);
    this.camera.updateProjectionMatrix();
  }

  protected override update(dt: number, now: number) {
    const frame = this.frame;
    const calm = this.calm;
    const warmth = frame?.warmth ?? 0;
    const ready = !!frame?.ready;
    // Warmth glows from under the egg or the growing dragon; ready glows strongest and pulses.
    const pulse = ready && !calm ? 0.75 + Math.sin(now * 4) * 0.25 : 1;
    this.glow.intensity = (0.2 + warmth * 1.4) * pulse * (frame?.view === 'egg' ? 1 : 0.6);
    (this.ember.material as MeshBasicMaterial).opacity = (0.05 + warmth * 0.3) * pulse;
    if (frame?.view === 'dragon' && this.dragon && !this.outgoing) {
      const since = now - this.shakeAt;
      this.dragon.root.rotation.z =
        since < 0.5 ? Math.sin(since * 30) * 0.08 * (1 - since / 0.5) : 0;
      // A dragon ready to grow hops now and then, as if it cannot wait.
      if (ready && !calm && now - this.hopAt > 2.6) {
        this.hopAt = now;
        this.dragon.cheer(now);
      }
    }
    this.updateGrowing(now, calm);
    if (this.egg) {
      const since = now - this.shakeAt;
      const shake = since < 0.5 ? Math.sin(since * 40) * 0.18 * (1 - since / 0.5) : 0;
      // A ready egg rocks now and then, as if something inside is wriggling.
      const wiggle =
        ready && !calm ? Math.max(0, Math.sin(now * 2.2)) ** 6 * Math.sin(now * 22) * 0.1 : 0;
      this.egg.root.rotation.z = shake + wiggle;
      this.egg.root.position.y = ready && !calm ? Math.max(0, Math.sin(now * 2.2)) ** 8 * 0.05 : 0;
      for (const material of this.egg.shellMaterial) {
        material.emissive.set(frame?.egg.spots ?? '#ffb35c');
        material.emissiveIntensity = ready ? 0.12 + Math.sin(now * 4) * 0.06 : warmth * 0.08;
      }
      const opened = now - this.hatchAt;
      if (opened >= 0 && opened < 3 && this.dragon) {
        // The lid pops off and tumbles away; the dragon grows out of the bottom half.
        const t = Math.min(1, opened / 0.9);
        this.egg.top.position.set(
          t * 0.9,
          SPLIT * EGG_HEIGHT + Math.sin(t * Math.PI) * 0.9,
          t * 0.3,
        );
        this.egg.top.rotation.set(t * 1.2, 0, -t * 2.6);
        this.egg.top.visible = t < 1;
        const grow = Math.min(1, Math.max(0, (opened - 0.15) / 0.6));
        const elastic = grow < 1 ? 1 - Math.cos(grow * Math.PI * 2.5) * (1 - grow) : 1;
        this.dragon.root.scale.setScalar(0.78 * Math.max(0.01, elastic));
        this.dragon.root.position.y = 0.25 * (1 - Math.min(1, opened / 1.5)) + 0.05;
        if (opened > 0.7 && opened - dt <= 0.7) this.dragon.cheer(now);
        // The bottom shell sinks into the nest once the dragon is out.
        this.egg.bottom.position.y = -Math.max(0, opened - 1.8) * 0.6;
        this.egg.bottom.visible = opened < 2.8;
      } else if (opened >= 3 && this.dragon) {
        this.clearEgg();
        this.dragon.root.position.y = 0;
      }
    }
    this.dragon?.update(now, true, calm);
    this.outgoing?.update(now, true, calm);
    for (const [index, fly] of this.floaters.entries()) {
      fly.visible = !calm;
      const angle = now * (0.3 + index * 0.05) + index;
      fly.position.set(
        Math.cos(angle) * (1 + index * 0.12),
        0.6 + Math.sin(now * 1.3 + index) * 0.3 + index * 0.08,
        Math.sin(angle) * (0.8 + index * 0.1),
      );
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const spark = this.sparks[i];
      const age = now - spark.born;
      if (age > spark.life) {
        this.scene.remove(spark.mesh);
        (spark.mesh.material as Material).dispose();
        this.sparks.splice(i, 1);
        continue;
      }
      spark.velocity.y -= 3.2 * dt;
      spark.mesh.position.addScaledVector(spark.velocity, dt);
      spark.mesh.rotation.y += dt * 6;
      (spark.mesh.material as MeshBasicMaterial).opacity = 1 - age / spark.life;
    }
  }

  private updateGrowing(now: number, calm: boolean) {
    const since = now - this.growAt;
    const spin = calm ? 0 : GROW_SPIN;
    if (this.outgoing) {
      if (since < spin) {
        const t = since / spin;
        this.outgoing.root.rotation.y = t * t * 14;
        this.outgoing.root.traverse((object) => {
          if (!(object instanceof Mesh)) return;
          const material = object.material as MeshStandardMaterial;
          material.emissive?.set('#fffef0');
          if (material.emissive) material.emissiveIntensity = t * 0.9;
        });
        return;
      }
      this.clearOutgoing();
      if (this.dragon) {
        this.dragon.root.visible = true;
        this.dragon.cheer(now);
      }
      this.burst(new Vector3(0, 1.1, 0), 46, [...RAINBOW, '#ffe27a'], 2.8);
    }
    const grow = (since - spin) / 0.7;
    if (this.dragon && grow >= 0 && grow < 1) {
      // Out it pops, wobbling into its new shape.
      const elastic = 1 - Math.cos(grow * Math.PI * 2.5) * (1 - grow) * 0.35;
      this.dragon.root.scale.setScalar(0.78 * elastic);
    } else if (this.dragon && grow >= 1 && grow < 1.2) {
      this.dragon.root.scale.setScalar(0.78);
    }
  }
}

/**
 * Renders each dragon once into a small picture for the dragon book and the home screen,
 * then drops the GL context again.
 */
export function renderPortraits(
  dragons: readonly Dragon[],
  stageOf: (dragon: Dragon) => number = () => 0,
  size = 256,
): Record<string, string> {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });
  renderer.setSize(size, size, false);
  renderer.setClearColor(0x000000, 0);
  const scene = new Scene();
  scene.add(new HemisphereLight('#fff6fb', '#9fbf9a', 1.7));
  const sun = new DirectionalLight('#fff3e0', 2.2);
  sun.position.set(2, 4, 4);
  scene.add(sun);
  const rim = new DirectionalLight('#c9b8ff', 1);
  rim.position.set(-3, 2, -2);
  scene.add(rim);
  const camera = new PerspectiveCamera(30, 1, 0.1, 20);
  camera.position.set(0.9, 1.35, 4);
  camera.lookAt(0, 0.85, 0);
  const pictures: Record<string, string> = {};
  for (const dragon of dragons) {
    const stage = stageOf(dragon);
    const model = new DragonModel(dragon, stage);
    model.root.rotation.y = -0.35;
    // Taller forms are framed further out, so their heads and wings stay in the picture.
    model.root.scale.setScalar([1, 0.88, 0.74][stage] ?? 1);
    model.root.position.y = [0, 0.04, 0.12][stage] ?? 0;
    model.update(0.2, false);
    scene.add(model.root);
    renderer.render(scene, camera);
    pictures[dragon.id] = canvas.toDataURL('image/png');
    scene.remove(model.root);
    model.root.traverse((object) => {
      if (object instanceof Mesh) {
        object.geometry.dispose();
        (object.material as Material).dispose();
      }
    });
  }
  renderer.dispose();
  renderer.forceContextLoss();
  return pictures;
}
