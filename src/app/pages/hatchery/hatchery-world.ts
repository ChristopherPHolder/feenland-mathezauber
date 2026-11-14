import {
  CanvasTexture,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  LatheGeometry,
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
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { DragonModel, RAINBOW } from './dragon-model';
import type { Dragon } from './dragons';

/** What the page asks the nest to show; the page owns the hatchery, this only draws it. */
export interface NestFrame {
  /** The egg in the nest, or a dragon sitting in it. */
  readonly view: 'egg' | 'dragon';
  readonly egg: Dragon;
  /** How warm the egg is, from 0 to 1. */
  readonly warmth: number;
  readonly ready: boolean;
  /** Taps given to a ready egg: each one cracks it a little more. */
  readonly cracks: number;
  readonly dragon: Dragon | null;
  /** Counts hatches this visit; a new one plays the hatching instead of just showing the dragon. */
  readonly hatches: number;
}

const EGG_HEIGHT = 1.15;
const EGG_WIDTH = 0.44;
const SPLIT = 0.56;

/** The widest point sits below the middle, so the egg is round at the bottom and taller on top. */
const WIDEST = 0.42;
function eggRadius(s: number): number {
  const d = s < WIDEST ? (WIDEST - s) / WIDEST : (s - WIDEST) / (1 - WIDEST);
  return EGG_WIDTH * Math.sqrt(Math.max(0, 1 - d * d));
}

function eggProfile(from: number, to: number): Vector2[] {
  const points: Vector2[] = [];
  for (let i = 0; i <= 24; i++) {
    const s = from + ((to - from) * i) / 24;
    points.push(new Vector2(Math.max(0.0001, eggRadius(s)), s * EGG_HEIGHT));
  }
  return points;
}

/** Paints the shell: soft spots, and zigzag cracks along the split once it is tapped. */
function paintShell(
  texture: CanvasTexture,
  egg: Dragon,
  cracks: number,
  half: 'top' | 'bottom',
): void {
  const canvas = texture.image as HTMLCanvasElement;
  const context = canvas.getContext('2d');
  if (!context) return;
  const { width, height } = canvas;
  context.fillStyle = egg.shell;
  context.fillRect(0, 0, width, height);
  // Spots seeded from the dragon id, so an egg always looks the same.
  let seed = [...egg.id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const random = () => ((seed = (seed * 16807) % 2147483647) % 1000) / 1000;
  context.fillStyle = egg.spots;
  for (let i = 0; i < 26; i++) {
    const x = random() * width;
    const y = random() * height;
    const r = 6 + random() * 16;
    context.globalAlpha = 0.55 + random() * 0.35;
    if (egg.starlight) {
      drawStar(context, x, y, r * 0.8);
    } else {
      context.beginPath();
      context.ellipse(x, y, r, r * 0.8, random() * 3, 0, Math.PI * 2);
      context.fill();
    }
  }
  if (egg.element === 'rainbow') {
    RAINBOW.forEach((color, index) => {
      context.fillStyle = color;
      context.globalAlpha = 0.5;
      context.fillRect(0, height * 0.42 + index * 9, width, 7);
    });
  }
  context.globalAlpha = 1;
  if (cracks > 0) {
    context.strokeStyle = '#4a3a2a';
    context.lineWidth = 7;
    context.lineJoin = 'round';
    // The crack runs round the egg at the split, with branches that grow on each tap.
    // Lathe texture rows run bottom to top and canvases top to bottom: the split is the
    // canvas top on the lower half and the canvas bottom on the upper half.
    const edge = half === 'bottom' ? 4 : height - 4;
    const inward = half === 'bottom' ? 1 : -1;
    const reach = Math.min(1, cracks / 3);
    context.beginPath();
    for (let x = 0; x <= width * reach; x += width / 24) {
      const y = edge + inward * ((x / (width / 24)) % 2 ? 26 : 4);
      if (x) context.lineTo(x, y);
      else context.moveTo(x, y);
    }
    context.stroke();
    for (let i = 0; i < cracks * 3; i++) {
      const x = ((i * 0.37) % 1) * width * reach;
      context.beginPath();
      context.moveTo(x, edge);
      context.lineTo(x + 14, edge + inward * (40 + (i % 3) * 22));
      context.stroke();
    }
  }
  texture.needsUpdate = true;
}

function drawStar(context: CanvasRenderingContext2D, x: number, y: number, r: number) {
  context.beginPath();
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 ? r * 0.45 : r;
    const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
    context.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
  }
  context.closePath();
  context.fill();
}

function shellTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** An egg in two halves, so the top can pop off when it hatches. */
class EggModel {
  readonly root = new Group();
  readonly top = new Group();
  readonly bottom = new Group();
  private readonly topTexture = shellTexture();
  private readonly bottomTexture = shellTexture();
  readonly shellMaterial: MeshStandardMaterial[];
  constructor(readonly dragon: Dragon) {
    const top = new MeshStandardMaterial({ map: this.topTexture, roughness: 0.45 });
    const bottom = new MeshStandardMaterial({ map: this.bottomTexture, roughness: 0.45 });
    this.shellMaterial = [top, bottom];
    const lower = new Mesh(new LatheGeometry(eggProfile(0, SPLIT), 48), bottom);
    const upper = new Mesh(new LatheGeometry(eggProfile(SPLIT, 1), 48), top);
    for (const mesh of [lower, upper]) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
    // Pivot the top on the split so it can tip off like a lid.
    const splitY = SPLIT * EGG_HEIGHT;
    upper.position.y = -splitY;
    this.top.position.y = splitY;
    this.top.add(upper);
    this.bottom.add(lower);
    // Jagged teeth on the broken rim, only shown once the egg has opened.
    const rim = eggRadius(SPLIT);
    const teeth = new Group();
    teeth.name = 'teeth';
    teeth.visible = false;
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const tooth = new Mesh(new ConeGeometry(0.06, 0.12, 4), bottom);
      tooth.position.set(Math.cos(angle) * rim * 0.96, splitY + 0.05, Math.sin(angle) * rim * 0.96);
      teeth.add(tooth);
    }
    this.bottom.add(teeth);
    this.root.add(this.bottom, this.top);
    this.setCracks(0);
  }
  setCracks(cracks: number) {
    paintShell(this.topTexture, this.dragon, cracks, 'top');
    paintShell(this.bottomTexture, this.dragon, cracks, 'bottom');
  }
  open() {
    const teeth = this.bottom.getObjectByName('teeth');
    if (teeth) teeth.visible = true;
  }
}

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
export class HatcheryWorld {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(34, 1, 0.1, 60);
  private readonly observer: ResizeObserver;
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
  private frame?: NestFrame;
  private shakeAt = -10;
  private hatchAt = -10;
  private handle = 0;
  private now = 0;
  private visible = true;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly host: HTMLElement,
  ) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.setClearColor(0x000000, 0);

    this.scene.add(new HemisphereLight('#fff6fb', '#7fb07a', 1.5));
    const sun = new DirectionalLight('#fff3e0', 2.2);
    sun.position.set(2.5, 5, 3.5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -2;
    sun.shadow.camera.right = 2;
    sun.shadow.camera.top = 2.5;
    sun.shadow.camera.bottom = -1;
    sun.shadow.radius = 4;
    this.scene.add(sun);
    const rim = new DirectionalLight('#c9b8ff', 1.1);
    rim.position.set(-3, 2.5, -3);
    this.scene.add(rim);

    this.scene.add(this.buildMeadow());
    this.scene.add(this.buildNest());
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

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.resize();
    this.handle = requestAnimationFrame((time) => this.loop(time));
  }

  setFrame(frame: NestFrame) {
    const previous = this.frame;
    this.frame = frame;
    if (frame.view === 'egg') {
      if (!this.egg || this.egg.dragon.id !== frame.egg.id || previous?.view !== 'egg') {
        this.clearDragon();
        this.clearEgg();
        this.egg = new EggModel(frame.egg);
        this.holder.add(this.egg.root);
      }
      if (previous && frame.cracks > previous.cracks) {
        this.shakeAt = this.now;
        this.burst(new Vector3(0, 0.75, 0.2), 6, ['#fffefc', frame.egg.shell], 0.9);
      }
      if (!previous || frame.cracks !== previous.cracks || previous.egg.id !== frame.egg.id)
        this.egg.setCracks(frame.cracks);
      return;
    }
    const dragon = frame.dragon;
    if (!dragon) return;
    const hatching = !!previous && frame.hatches > previous.hatches;
    if (this.dragon?.dragon.id === dragon.id && !hatching) return;
    this.clearDragon();
    this.dragon = new DragonModel(dragon);
    this.holder.add(this.dragon.root);
    if (hatching && this.egg) {
      this.hatchAt = this.now;
      this.egg.open();
      this.dragon.root.scale.setScalar(0.01);
      this.burst(new Vector3(0, 0.8, 0), 40, [...RAINBOW, '#ffe27a'], 2.6);
    } else {
      this.clearEgg();
      this.dragon.root.scale.setScalar(0.78);
      this.dragon.cheer(this.now);
    }
  }

  /** The dragon in the nest does a happy hop. */
  cheer() {
    this.dragon?.cheer(this.now);
    this.burst(new Vector3(0, 1.2, 0), 14, ['#ffe27a', '#ff8cbf', '#fffefc'], 1.6);
  }

  dispose() {
    cancelAnimationFrame(this.handle);
    this.observer.disconnect();
    this.scene.traverse((object) => {
      if (object instanceof Mesh) {
        object.geometry.dispose();
        const materials: Material[] = Array.isArray(object.material)
          ? object.material
          : [object.material];
        for (const material of materials) {
          if ('map' in material && material.map) (material.map as CanvasTexture).dispose();
          material.dispose();
        }
      }
    });
    this.sparkGeometry.dispose();
    for (const material of this.sparkMaterials) material.dispose();
    this.renderer.dispose();
  }

  private clearEgg() {
    if (!this.egg) return;
    this.holder.remove(this.egg.root);
    this.disposeTree(this.egg.root);
    this.egg = undefined;
  }

  private clearDragon() {
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

  private buildNest(): Group {
    const nest = new Group();
    const straw = ['#c99a5b', '#b5844a', '#dcb377'].map(
      (color) => new MeshStandardMaterial({ color, roughness: 1 }),
    );
    const bowl = new Mesh(new TorusGeometry(0.5, 0.17, 14, 40), straw[0]);
    bowl.rotation.x = -Math.PI / 2;
    bowl.position.y = 0.12;
    bowl.scale.z = 0.8;
    bowl.castShadow = bowl.receiveShadow = true;
    nest.add(bowl);
    const floor = new Mesh(new CircleGeometry(0.52, 32), straw[1]);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.05;
    floor.receiveShadow = true;
    nest.add(floor);
    // Twigs sticking out of the rim.
    for (let i = 0; i < 26; i++) {
      const angle = (i / 26) * Math.PI * 2;
      const twig = new Mesh(new CylinderGeometry(0.014, 0.014, 0.42, 5), straw[i % 3]);
      twig.position.set(Math.cos(angle) * 0.52, 0.16 + (i % 2) * 0.05, Math.sin(angle) * 0.52);
      twig.rotation.set(Math.PI / 2 + (i % 3) * 0.15, 0, angle + 0.6);
      twig.castShadow = true;
      nest.add(twig);
    }
    return nest;
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
      this.sparks.push({ mesh, velocity, born: this.now, life: 0.9 + Math.random() * 0.5 });
    }
  }

  private resize() {
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    // Keep the nest and a standing dragon in frame: about 2.5 units tall and 3.2 wide.
    const tan = Math.tan((this.camera.fov * Math.PI) / 360);
    const distance = Math.max(2.5 / (2 * tan), 3.2 / (2 * tan * this.camera.aspect));
    this.camera.position.set(0, 0.85 + distance * 0.32, distance);
    this.camera.lookAt(0, 0.82, 0);
    this.camera.updateProjectionMatrix();
  }

  private loop(time: number) {
    this.handle = requestAnimationFrame((next) => this.loop(next));
    const hidden = typeof document !== 'undefined' && document.hidden;
    if (hidden) return;
    const dt = this.now ? Math.min(0.1, time / 1000 - this.now) : 0.016;
    this.now = time / 1000;
    this.animate(dt);
    if (this.visible) this.renderer.render(this.scene, this.camera);
  }

  private animate(dt: number) {
    const now = this.now;
    const frame = this.frame;
    const warmth = frame?.view === 'egg' ? frame.warmth : 0;
    const ready = frame?.view === 'egg' && frame.ready;
    // Warmth glows from under the egg; a ready egg glows strongest and pulses.
    const pulse = ready ? 0.75 + Math.sin(now * 4) * 0.25 : 1;
    this.glow.intensity = (0.2 + warmth * 1.4) * pulse * (frame?.view === 'egg' ? 1 : 0.2);
    (this.ember.material as MeshBasicMaterial).opacity = (0.05 + warmth * 0.3) * pulse;
    if (this.egg) {
      const since = now - this.shakeAt;
      const shake = since < 0.5 ? Math.sin(since * 40) * 0.18 * (1 - since / 0.5) : 0;
      // A ready egg rocks now and then, as if something inside is wriggling.
      const wiggle = ready ? Math.max(0, Math.sin(now * 2.2)) ** 6 * Math.sin(now * 22) * 0.1 : 0;
      this.egg.root.rotation.z = shake + wiggle;
      this.egg.root.position.y = ready ? Math.max(0, Math.sin(now * 2.2)) ** 8 * 0.05 : 0;
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
    this.dragon?.update(now);
    for (const [index, fly] of this.floaters.entries()) {
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
}

/**
 * Renders each dragon once into a small picture for the dragon book and the home screen,
 * then drops the GL context again.
 */
export function renderPortraits(dragons: readonly Dragon[], size = 256): Record<string, string> {
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
    const model = new DragonModel(dragon);
    model.root.rotation.y = -0.35;
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
