import {
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  OctahedronGeometry,
  SphereGeometry,
  Vector3,
} from 'three';

const POOL = 90;
const PALETTES = {
  gold: ['#ffd23f', '#fff1a8', '#ff8fb8', '#ffffff'],
  ice: ['#9fe3ff', '#e6f6ff', '#6fb6ff', '#ffffff'],
} as const;

interface Spark {
  readonly mesh: Mesh<OctahedronGeometry | SphereGeometry, MeshBasicMaterial>;
  readonly velocity: Vector3;
  age: number;
  life: number;
  gravity: number;
  grow: number;
  size: number;
}

/**
 * A fixed pool of little particles for fairy sparkles and dust puffs. Nothing is created while
 * the game runs; a spark that dies goes back to the pool.
 */
export class Sparks {
  readonly group = new Group();
  private readonly star = new OctahedronGeometry(0.07);
  private readonly puff = new SphereGeometry(0.16, 7, 5);
  private readonly sparks: Spark[] = [];
  private next = 0;

  constructor() {
    for (let i = 0; i < POOL; i++) {
      const mesh = new Mesh<OctahedronGeometry | SphereGeometry, MeshBasicMaterial>(
        this.star,
        new MeshBasicMaterial({ transparent: true, depthWrite: false }),
      );
      mesh.visible = false;
      mesh.renderOrder = 7;
      this.group.add(mesh);
      this.sparks.push({
        mesh,
        velocity: new Vector3(),
        age: 0,
        life: 0,
        gravity: 0,
        grow: 0,
        size: 1,
      });
    }
  }

  /** Twinkles that drift down from a wand. */
  sprinkle(at: Vector3, palette: keyof typeof PALETTES, count: number) {
    const colors = PALETTES[palette];
    for (let i = 0; i < count; i++) {
      const spark = this.take();
      spark.mesh.geometry = this.star;
      spark.mesh.material.color.set(colors[Math.floor(Math.random() * colors.length)]!);
      spark.mesh.position.copy(at);
      spark.velocity.set(
        (Math.random() - 0.5) * 1.2,
        Math.random() * 0.6 - 0.2,
        (Math.random() - 0.5) * 0.6,
      );
      spark.life = 0.8 + Math.random() * 0.5;
      spark.gravity = 1.6;
      spark.grow = 0;
      spark.size = 0.8 + Math.random() * 0.9;
    }
  }

  /** A puff of dust rolling out along the ground. */
  dust(at: Vector3, count: number, color = '#efe3cc') {
    for (let i = 0; i < count; i++) {
      const spark = this.take();
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      spark.mesh.geometry = this.puff;
      spark.mesh.material.color.set(new Color(color));
      spark.mesh.position.copy(at);
      spark.velocity.set(
        Math.cos(angle) * 1.3,
        0.35 + Math.random() * 0.4,
        Math.sin(angle) * 0.7 + 0.3,
      );
      spark.life = 0.55 + Math.random() * 0.25;
      spark.gravity = 0.4;
      spark.grow = 1.3;
      spark.size = 0.8 + Math.random() * 0.5;
    }
  }

  update(dt: number) {
    for (const spark of this.sparks) {
      if (!spark.mesh.visible) continue;
      spark.age += dt;
      if (spark.age >= spark.life) {
        spark.mesh.visible = false;
        continue;
      }
      spark.velocity.y -= spark.gravity * dt;
      spark.velocity.multiplyScalar(1 - dt * 1.5);
      spark.mesh.position.addScaledVector(spark.velocity, dt);
      const k = spark.age / spark.life;
      spark.mesh.scale.setScalar(spark.size * (1 + spark.grow * k));
      spark.mesh.rotation.y += dt * 5;
      spark.mesh.material.opacity = 1 - k * k;
    }
  }

  private take(): Spark {
    const spark = this.sparks[this.next]!;
    this.next = (this.next + 1) % POOL;
    spark.mesh.visible = true;
    spark.age = 0;
    return spark;
  }
}
