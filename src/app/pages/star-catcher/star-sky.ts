import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Points,
  ShaderMaterial,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Texture,
} from 'three';

/** A small seeded random, so the sky looks the same on every visit. */
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/** Star layers from far to near: how many, their size range in px, colours, parallax weight. */
const LAYERS = [
  { count: 190, size: [1.4, 2.4], depth: 0, colors: ['#dfe6ff', '#c7d3ff', '#ffffff'] },
  { count: 80, size: [2.4, 3.6], depth: 0.5, colors: ['#fff6dc', '#ffffff', '#ffe9b8'] },
  { count: 26, size: [4.2, 6.2], depth: 1, colors: ['#fff3c4', '#ffd6f1', '#c9f6ff', '#ffffff'] },
  { count: 7, size: [7.5, 9.5], depth: 1, colors: ['#fff3c4', '#ffe1f4', '#e6f4ff'] },
] as const;

/** Shooting stars cross this share of the screen in this many seconds. */
const SHOOT_TIME = 1.1;
const SHOOT_SLOTS = 2;

interface Shooter {
  readonly head: Sprite;
  readonly tail: Mesh;
  start: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
}

/**
 * The night sky behind the bridge: a few hundred stars in three depths that each twinkle on
 * their own and drift with Nova a little (the near ones more), a soft milky way, and now and
 * then a shooting star. All of it rides with the camera in `backdrop`, in screen-like units.
 * Under calm motion the stars hold still and no shooting stars fly.
 */
export class NightSky {
  private readonly field: Points;
  private readonly fieldMaterial: ShaderMaterial;
  private readonly milky: Mesh;
  private readonly milkyTexture: CanvasTexture;
  private readonly shooters: Shooter[] = [];
  private readonly tailGeometry = new PlaneGeometry(1, 1);
  private nextShot = 2.5;
  private readonly random = seeded(7);
  private drift = 0;
  private parallax = 0;
  /** Camera units per screen-like unit at the shooting stars' depth, and that depth. */
  private shootDepth = 40;
  private sx = 1;
  private sy = 1;
  private px = 0.01;

  constructor(backdrop: Group, spark: Texture, trail: Texture, pixelRatio: number) {
    const random = seeded(2024);
    const total = LAYERS.reduce((sum, layer) => sum + layer.count, 0);
    const position = new Float32Array(total * 3);
    const tint = new Float32Array(total * 3);
    const size = new Float32Array(total);
    const phase = new Float32Array(total);
    const rate = new Float32Array(total);
    const depth = new Float32Array(total);
    const color = new Color();
    let index = 0;
    for (const layer of LAYERS) {
      for (let n = 0; n < layer.count; n++, index++) {
        position[index * 3] = random() * 2.3 - 1.15;
        // A little denser towards the top, where the sky is darkest.
        position[index * 3 + 1] = 1.05 - 1.7 * random() ** 1.3;
        color.set(layer.colors[n % layer.colors.length]);
        tint[index * 3] = color.r;
        tint[index * 3 + 1] = color.g;
        tint[index * 3 + 2] = color.b;
        size[index] = layer.size[0] + (layer.size[1] - layer.size[0]) * random();
        phase[index] = random() * Math.PI * 2;
        rate[index] = 0.8 + random() * (1.4 + layer.depth * 1.6);
        depth[index] = layer.depth;
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(position, 3));
    geometry.setAttribute('tint', new BufferAttribute(tint, 3));
    geometry.setAttribute('size', new BufferAttribute(size, 1));
    geometry.setAttribute('phase', new BufferAttribute(phase, 1));
    geometry.setAttribute('rate', new BufferAttribute(rate, 1));
    geometry.setAttribute('depth', new BufferAttribute(depth, 1));
    this.fieldMaterial = new ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        motion: { value: 1 },
        shift: { value: 0 },
        ratio: { value: pixelRatio },
      },
      vertexShader: `
        attribute vec3 tint;
        attribute float size;
        attribute float phase;
        attribute float rate;
        attribute float depth;
        uniform float time;
        uniform float motion;
        uniform float shift;
        uniform float ratio;
        varying vec3 vTint;
        varying float vAlpha;
        varying float vFlare;
        void main() {
          vec3 p = position;
          p.x = mod(p.x + shift * (0.25 + depth) + 1.15, 2.3) - 1.15;
          float wave = 0.5 + 0.5 * sin(time * rate + phase);
          // A second, slower wave so neighbours never twinkle in step.
          float slow = 0.5 + 0.5 * sin(time * rate * 0.37 + phase * 1.7);
          float twinkle = mix(0.8, 0.35 + 0.65 * wave * (0.6 + 0.4 * slow), motion);
          vAlpha = twinkle * (0.55 + 0.45 * depth);
          vFlare = smoothstep(4.0, 7.5, size) * (0.6 + 0.4 * twinkle);
          vTint = tint;
          gl_PointSize = size * ratio * (1.6 + 0.5 * twinkle);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `
        varying vec3 vTint;
        varying float vAlpha;
        varying float vFlare;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c) * 2.0;
          float core = smoothstep(0.32, 0.0, d);
          float halo = exp(-d * d * 6.0) * 0.6;
          float cross = (exp(-abs(c.x) * 38.0) + exp(-abs(c.y) * 38.0)) * (1.0 - d) * vFlare;
          float a = clamp(core + halo + max(cross, 0.0), 0.0, 1.0) * vAlpha;
          gl_FragColor = vec4(mix(vTint, vec3(1.0), core * 0.7), a);
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.field = new Points(geometry, this.fieldMaterial);
    this.field.frustumCulled = false;

    this.milkyTexture = milkyWay();
    const band = new PlaneGeometry(3.2, 0.62);
    band.rotateZ(0.42);
    band.translate(0.05, 0.42, 0);
    this.milky = new Mesh(
      band,
      new MeshBasicMaterial({
        map: this.milkyTexture,
        transparent: true,
        opacity: 0.6,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.tailGeometry.translate(0, 0.5, 0);
    for (let slot = 0; slot < SHOOT_SLOTS; slot++) {
      const head = new Sprite(
        new SpriteMaterial({
          map: spark,
          color: '#fffbe8',
          transparent: true,
          blending: AdditiveBlending,
          depthWrite: false,
        }),
      );
      const tail = new Mesh(
        this.tailGeometry,
        new MeshBasicMaterial({
          map: trail,
          color: '#e9f3ff',
          transparent: true,
          blending: AdditiveBlending,
          depthWrite: false,
          side: DoubleSide,
        }),
      );
      head.visible = tail.visible = false;
      this.shooters.push({ head, tail, start: -10, x: 0, y: 0, dx: 0, dy: 0 });
      backdrop.add(tail, head);
    }
    backdrop.add(this.milky, this.field);
  }

  /** Frames the sky `depth` in front of the camera; `tan` is tan(fov / 2). */
  layout(depth: number, tan: number, aspect: number, height: number) {
    for (const [object, d] of [
      [this.field, depth],
      [this.milky, depth + 1],
    ] as const) {
      object.position.set(0, 0, -d);
      object.scale.set(d * tan * aspect, d * tan, 1);
    }
    this.shootDepth = depth - 15;
    this.sx = this.shootDepth * tan * aspect;
    this.sy = this.shootDepth * tan;
    this.px = (2 * this.shootDepth * tan) / height;
  }

  /** `toward` is where Nova stands, from -1 (left end) to 1 (right end). */
  update(t: number, dt: number, calm: boolean, toward: number) {
    const uniforms = this.fieldMaterial.uniforms;
    uniforms['time'].value = t;
    uniforms['motion'].value = calm ? 0 : 1;
    if (!calm) {
      // The sky turns very slowly, and the near stars slide a little against Nova's walk.
      this.drift += dt * 0.006;
      this.parallax += (-toward * 0.05 - this.parallax) * (1 - Math.exp(-2 * dt));
    }
    uniforms['shift'].value = calm ? 0 : this.drift + this.parallax;

    if (!calm && t >= this.nextShot) {
      this.nextShot = t + 4 + this.random() * 6;
      const free = this.shooters.find((shooter) => t - shooter.start > SHOOT_TIME);
      if (free) {
        const fromLeft = this.random() < 0.5;
        free.start = t;
        free.x = (fromLeft ? -0.75 : 0.75) + (this.random() - 0.5) * 0.5;
        free.y = 0.6 + this.random() * 0.35;
        free.dx = (fromLeft ? 1 : -1) * (0.7 + this.random() * 0.4);
        free.dy = -(0.28 + this.random() * 0.2);
      }
    }
    for (const shooter of this.shooters) {
      const p = (t - shooter.start) / SHOOT_TIME;
      const on = !calm && p >= 0 && p < 1;
      shooter.head.visible = shooter.tail.visible = on;
      if (!on) continue;
      const travel = 1 - (1 - p) ** 2;
      const x = (shooter.x + shooter.dx * travel) * this.sx;
      const y = (shooter.y + shooter.dy * travel) * this.sy;
      const fade = Math.min(1, p / 0.12) * (p > 0.6 ? 1 - (p - 0.6) / 0.4 : 1);
      const mx = shooter.dx * this.sx;
      const my = shooter.dy * this.sy;
      const length = Math.hypot(mx, my);
      shooter.head.position.set(x, y, -this.shootDepth);
      shooter.head.scale.setScalar(this.px * 22);
      shooter.head.material.opacity = fade;
      shooter.tail.position.set(x, y, -this.shootDepth);
      shooter.tail.rotation.z = Math.atan2(-my, -mx) - Math.PI / 2;
      shooter.tail.scale.set(this.px * 7, length * 0.42 * Math.min(1, p / 0.35), 1);
      (shooter.tail.material as MeshBasicMaterial).opacity = fade * 0.9;
    }
  }

  dispose() {
    this.field.removeFromParent();
    this.field.geometry.dispose();
    this.fieldMaterial.dispose();
    this.milky.removeFromParent();
    this.milky.geometry.dispose();
    (this.milky.material as MeshBasicMaterial).dispose();
    this.milkyTexture.dispose();
    for (const shooter of this.shooters) {
      shooter.head.removeFromParent();
      shooter.tail.removeFromParent();
      shooter.head.material.dispose();
      (shooter.tail.material as MeshBasicMaterial).dispose();
    }
    this.tailGeometry.dispose();
  }
}

/** A soft band of pastel star clouds and fine dust, drawn once onto a small canvas. */
function milkyWay(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const c = canvas.getContext('2d')!;
  const random = seeded(11);
  const band = c.createLinearGradient(0, 0, 0, 128);
  band.addColorStop(0, '#6a5cc400');
  band.addColorStop(0.5, '#6a5cc433');
  band.addColorStop(1, '#6a5cc400');
  c.fillStyle = band;
  c.fillRect(0, 0, 512, 128);
  const clouds = ['#8f7be0', '#d68bd0', '#6fc3dc', '#a99cff', '#f0a6c8'];
  for (let index = 0; index < 70; index++) {
    const x = random() * 512;
    const y = 64 + (random() - 0.5) * 50 * Math.sin((x / 512) * Math.PI);
    const r = 14 + random() * 34;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    const color = clouds[index % clouds.length];
    g.addColorStop(0, `${color}2e`);
    g.addColorStop(1, `${color}00`);
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let index = 0; index < 520; index++) {
    const x = random() * 512;
    const y = 64 + (random() + random() + random() - 1.5) * 34;
    const a = Math.round(40 + random() * 140)
      .toString(16)
      .padStart(2, '0');
    c.fillStyle = `#ffffff${a}`;
    c.fillRect(x, y, random() < 0.85 ? 1 : 2, 1);
  }
  // Feather the ends so the band never shows an edge.
  c.globalCompositeOperation = 'destination-in';
  const ends = c.createLinearGradient(0, 0, 512, 0);
  ends.addColorStop(0, '#ffffff00');
  ends.addColorStop(0.14, '#ffffffff');
  ends.addColorStop(0.86, '#ffffffff');
  ends.addColorStop(1, '#ffffff00');
  c.fillStyle = ends;
  c.fillRect(0, 0, 512, 128);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
