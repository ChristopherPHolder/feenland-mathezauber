import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CapsuleGeometry,
  Color,
  DoubleSide,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  SRGBColorSpace,
  type IUniform,
} from 'three';

const BLADE_SEGMENTS = 6;
const REED_DARK = new Color('#2f7a44');
const REED_LIGHT = new Color('#7fcf7a');
const CATTAIL = new Color('#8a5a32');
const STALK = new Color('#4f9a52');

/**
 * Reeds for the pond's edges. Every clump is one mesh (curved, tapering blades and a cattail or
 * two merged into a single geometry), and all clumps share one material that sways them in the
 * vertex shader, so a whole reed bed is a handful of draw calls and costs no work per frame
 * beyond one uniform. The tips move most; the roots stay put.
 */
export class ReedBed {
  private readonly time: IUniform<number> = { value: 0 };
  private readonly sway: IUniform<number> = { value: 1 };
  readonly material = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.7,
    side: DoubleSide,
  });

  constructor() {
    this.material.onBeforeCompile = (shader) => {
      shader.uniforms['uReedTime'] = this.time;
      shader.uniforms['uReedSway'] = this.sway;
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nuniform float uReedTime;\nuniform float uReedSway;',
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vec3 reedRoot = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          float reedBend = position.y * position.y * 0.16 * uReedSway;
          float reedPhase = uReedTime * 1.25 + reedRoot.x * 0.6 + reedRoot.z * 0.4 + position.x * 2.0;
          transformed.x += (sin(reedPhase) + 0.4 * sin(reedPhase * 2.3)) * reedBend;
          transformed.z += cos(reedPhase * 0.8) * reedBend * 0.45;`,
        );
    };
    this.material.customProgramCacheKey = () => 'pond-reeds';
  }

  /** A clump of about 1.6 units tall; `seed` varies the blades. */
  clump(seed: number): Mesh {
    const parts: BufferGeometry[] = [];
    for (let i = 0; i < 7; i++) {
      const angle = seed * 1.7 + i * 2.1;
      const height = 0.85 + ((seed * 13 + i * 7) % 8) / 10;
      parts.push(
        blade(
          Math.sin(angle) * 0.14,
          Math.cos(angle) * 0.1,
          height,
          0.075 + (i % 3) * 0.012,
          angle,
          0.22 + (i % 4) * 0.06,
        ),
      );
    }
    // Cattails stand on thin, straight stalks a little above the leaves.
    for (let i = 0; i < 1 + (seed % 2); i++) {
      const x = (i ? -0.08 : 0.06) + (seed % 3) * 0.02;
      const z = i ? 0.05 : -0.04;
      const height = 1.35 + ((seed + i) % 3) * 0.12;
      const angle = seed + i;
      const bend = 0.04;
      parts.push(blade(x, z, height, 0.022, angle, bend, STALK, STALK));
      const head = new CapsuleGeometry(0.055, 0.2, 3, 8).toNonIndexed();
      head.translate(
        x + Math.sin(angle) * bend * height,
        height * (1 - bend * 0.25) - 0.04,
        z + Math.cos(angle) * bend * height,
      );
      paint(head, CATTAIL);
      parts.push(head);
    }
    const mesh = new Mesh(merge(parts), this.material);
    for (const part of parts) part.dispose();
    return mesh;
  }

  /** Moves the sway on; `strength` 0 holds the reeds still (calm motion). */
  update(t: number, strength: number) {
    this.time.value = t;
    // Now and then a soft gust bends the whole bed a little further.
    this.sway.value = strength * (0.8 + 0.35 * Math.max(0, Math.sin(t * 0.37)) ** 3);
  }
}

/**
 * One reed blade: a flat ribbon that tapers to a point and bows over in the direction `angle`
 * by `bend` (a share of its height). Non-indexed, with normals and colours.
 */
function blade(
  x: number,
  z: number,
  height: number,
  width: number,
  angle: number,
  bend: number,
  root = REED_DARK,
  tip = REED_LIGHT,
): BufferGeometry {
  const dx = Math.sin(angle);
  const dz = Math.cos(angle);
  const points: number[][] = [];
  const shades: Color[] = [];
  for (let i = 0; i <= BLADE_SEGMENTS; i++) {
    const t = i / BLADE_SEGMENTS;
    const half = (width / 2) * (1 - t) ** 0.7;
    const lean = bend * height * t * t;
    const cx = x + dx * lean;
    const cz = z + dz * lean;
    const cy = height * t * (1 - bend * 0.25 * t);
    // The ribbon faces across its own bend, so it reads as a leaf from above and from the side.
    points.push([cx - dz * half, cy, cz + dx * half], [cx + dz * half, cy, cz - dx * half]);
    const shade = root.clone().lerp(tip, t);
    shades.push(shade, shade);
  }
  const positions: number[] = [];
  const colors: number[] = [];
  const push = (index: number) => {
    positions.push(...points[index]!);
    const shade = shades[index]!;
    colors.push(shade.r, shade.g, shade.b);
  };
  for (let i = 0; i < BLADE_SEGMENTS; i++) {
    const a = i * 2;
    for (const index of [a, a + 1, a + 2, a + 1, a + 3, a + 2]) push(index);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
  geometry.computeVertexNormals();
  return geometry;
}

function paint(geometry: BufferGeometry, color: Color) {
  const count = geometry.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) colors.set([color.r, color.g, color.b], i * 3);
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
}

/** Joins non-indexed geometries with position, normal and colour into one. */
function merge(parts: readonly BufferGeometry[]): BufferGeometry {
  const merged = new BufferGeometry();
  for (const name of ['position', 'normal', 'color'] as const) {
    const total = parts.reduce((sum, part) => sum + part.getAttribute(name).array.length, 0);
    const array = new Float32Array(total);
    let offset = 0;
    for (const part of parts) {
      array.set(part.getAttribute(name).array as Float32Array, offset);
      offset += part.getAttribute(name).array.length;
    }
    merged.setAttribute(name, new BufferAttribute(array, 3));
  }
  return merged;
}

/**
 * The veins on a lily pad, drawn once: a pale centre and fine lines out to a darker rim. Used as
 * the pads' colour map, so each pad keeps its own tint.
 */
export function padVeins(): CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const c = canvas.getContext('2d')!;
  const middle = size / 2;
  const shade = c.createRadialGradient(middle, middle, 0, middle, middle, middle);
  shade.addColorStop(0, '#ffffff');
  shade.addColorStop(0.75, '#e6e6e6');
  shade.addColorStop(1, '#bdbdbd');
  c.fillStyle = shade;
  c.fillRect(0, 0, size, size);
  c.strokeStyle = 'rgba(255, 255, 235, 0.85)';
  c.lineCap = 'round';
  for (let i = 0; i < 15; i++) {
    const angle = (i / 15) * Math.PI * 2;
    c.lineWidth = 3.2;
    c.beginPath();
    c.moveTo(middle, middle);
    // Each vein curves a little as it runs out.
    const bend = angle + 0.18;
    c.quadraticCurveTo(
      middle + Math.cos(bend) * middle * 0.5,
      middle + Math.sin(bend) * middle * 0.5,
      middle + Math.cos(angle) * middle * 0.94,
      middle + Math.sin(angle) * middle * 0.94,
    );
    c.stroke();
  }
  c.fillStyle = '#fffff0';
  c.beginPath();
  c.arc(middle, middle, 7, 0, Math.PI * 2);
  c.fill();
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/**
 * Water lily flowers: an outer ring of wide pink petals opening outward, an inner ring standing
 * up, and a golden heart. About 0.5 units across; sits on top of a pad. Each flower is one mesh
 * (its petals merged, coloured per vertex) and all flowers share the geometry and material.
 */
export class LotusKit {
  private readonly geometry = lotusGeometry();
  private readonly material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.55 });

  flower(): Mesh {
    return new Mesh(this.geometry, this.material);
  }
}

function lotusGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const petal = new SphereGeometry(1, 12, 8);
  const holder = new Object3D();
  const leaf = new Object3D();
  holder.add(leaf);
  const ring = (count: number, color: Color, tilt: number, r: number) => {
    for (let i = 0; i < count; i++) {
      holder.rotation.y = (i / count) * Math.PI * 2 + tilt * 0.3;
      leaf.scale.set(0.075, 0.03, 0.2);
      leaf.position.set(0, 0.06, r);
      // Tip up: a cupped petal.
      leaf.rotation.x = -tilt;
      holder.updateMatrixWorld(true);
      const part = petal.clone().applyMatrix4(leaf.matrixWorld).toNonIndexed();
      paint(part, color);
      parts.push(part);
    }
  };
  ring(8, new Color('#ffc1d8'), 0.45, 0.16);
  ring(6, new Color('#ff8fb6'), 1.05, 0.08);
  const heart = petal.clone().scale(0.07, 0.05, 0.07).translate(0, 0.1, 0).toNonIndexed();
  paint(heart, new Color('#ffd23f'));
  parts.push(heart);
  const merged = merge(parts);
  for (const part of parts) part.dispose();
  petal.dispose();
  return merged;
}
