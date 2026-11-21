import {
  BufferGeometry,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Float32BufferAttribute,
  InstancedMesh,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  MeshStandardMaterialParameters,
  Object3D,
  SphereGeometry,
} from 'three';
import { smooth } from '../../shared/three/motion';

/**
 * The scenery that makes the mountain feel alive: ranges of peaks fading into the haze behind
 * the summit, clouds drifting past them, a few birds circling over the slope, and pines that
 * sway in the wind. Each is one draw call; under calm motion they hold still.
 */

// ---------------------------------------------------------------------------------------------
// Far ranges

interface Range {
  /** Distance behind the station. */
  readonly z: number;
  /** Height of the valley floor and of the tallest peaks. */
  readonly base: number;
  readonly peak: number;
  readonly rock: string;
  readonly seed: number;
}

/** Near to far: each range paler and bluer, the way air thickens with distance. */
const RANGES: readonly Range[] = [
  { z: -60, base: 6, peak: 17, rock: '#86a9c9', seed: 1.3 },
  { z: -82, base: 9, peak: 27, rock: '#a2bfdb', seed: 4.1 },
  { z: -108, base: 12, peak: 40, rock: '#bed3e8', seed: 7.7 },
];
const HAZE = new Color('#eaf5ff');
const SNOW = new Color('#ffffff');

/** A peaky skyline: sharp tops where the sines fold, softer shoulders between. */
function skyline(x: number, seed: number) {
  const fold = (f: number, s: number) => 1 - Math.abs(Math.sin(x * f + s));
  return (
    0.55 * fold(0.045, seed) ** 1.6 +
    0.3 * fold(0.11, seed * 2.1) ** 1.3 +
    0.15 * (0.5 + 0.5 * Math.sin(x * 0.31 + seed * 3.3))
  );
}

/**
 * The far ranges as one unlit, vertex-coloured mesh: each range is a strip from below the
 * horizon up to its skyline, misty at the foot, rock in the middle and snow on the tall tops.
 */
export function buildRanges(): Mesh {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const columns = 120;
  const rows = [0, 0.5, 0.82, 1];
  const rock = new Color();
  const mixed = new Color();
  for (const range of RANGES) {
    const offset = positions.length / 3;
    rock.set(range.rock);
    const snowLine = range.base + (range.peak - range.base) * 0.62;
    for (let column = 0; column <= columns; column++) {
      const x = -150 + (column / columns) * 300;
      const top = range.base + (range.peak - range.base) * skyline(x, range.seed);
      const bottom = -12;
      for (const row of rows) {
        const y = bottom + (top - bottom) * row;
        // Wrap the strip a little round the camera, so its ends stay out of sight.
        positions.push(x, y, range.z + (x * x) / 900);
        if (row === 0) mixed.copy(HAZE);
        else if (row === rows[1]) mixed.lerpColors(HAZE, rock, 0.55);
        else {
          const snow = smooth((y - snowLine) / 5) * (row === 1 ? 1 : 0.55);
          mixed.lerpColors(rock, SNOW, snow);
        }
        colors.push(mixed.r, mixed.g, mixed.b);
      }
    }
    const stride = rows.length;
    for (let column = 0; column < columns; column++)
      for (let row = 0; row < stride - 1; row++) {
        const a = offset + column * stride + row;
        const b = a + stride;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  const mesh = new Mesh(
    geometry,
    new MeshBasicMaterial({ vertexColors: true, fog: false, side: DoubleSide }),
  );
  mesh.renderOrder = -1;
  return mesh;
}

// ---------------------------------------------------------------------------------------------
// Drifting clouds

/** Puffs per cloud, as offsets and sizes; every cloud is the same few puffs, scaled. */
const PUFFS: readonly (readonly [number, number, number, number])[] = [
  [0, 0, 0, 1],
  [1.1, 0.25, 0.1, 0.8],
  [-1.1, 0.1, -0.1, 0.75],
  [0.45, 0.65, 0, 0.7],
  [-0.5, 0.55, 0.15, 0.65],
  [2, -0.05, 0, 0.55],
];
const CLOUDS: readonly (readonly [number, number, number, number])[] = [
  // x, y, z, size
  [-30, 18, -66, 3.4],
  [8, 23, -88, 4.4],
  [40, 16, -60, 3],
  [-60, 21, -80, 4],
  [70, 25, -96, 5],
];
const CLOUD_SPAN = 180;

export class DriftingClouds {
  readonly mesh: InstancedMesh;
  private readonly geometry = new SphereGeometry(1, 14, 10);
  private readonly material = new MeshStandardMaterial({
    color: '#ffffff',
    emissive: '#dfeeff',
    emissiveIntensity: 0.45,
    roughness: 1,
    fog: false,
  });
  private readonly dummy = new Object3D();

  constructor() {
    this.mesh = new InstancedMesh(this.geometry, this.material, CLOUDS.length * PUFFS.length);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.place(0);
  }

  /** Clouds sail slowly to the right and come round again. */
  update(t: number, calm: boolean) {
    if (!calm) this.place(t);
  }

  private place(t: number) {
    const dummy = this.dummy;
    let index = 0;
    CLOUDS.forEach(([x, y, z, size], cloud) => {
      const drift =
        (((x + t * (0.5 + cloud * 0.08) + CLOUD_SPAN / 2) % CLOUD_SPAN) + CLOUD_SPAN) % CLOUD_SPAN;
      const cx = drift - CLOUD_SPAN / 2;
      for (const [px, py, pz, ps] of PUFFS) {
        dummy.position.set(cx + px * size, y + py * size * 0.8, z + pz * size);
        dummy.scale.set(ps * size, ps * size * 0.62, ps * size * 0.7);
        dummy.updateMatrix();
        this.mesh.setMatrixAt(index++, dummy.matrix);
      }
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.mesh.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
}

// ---------------------------------------------------------------------------------------------
// Birds

/** A bird seen from afar: a body and two swept wings, wings tips at y = 1 so they can flap. */
function birdGeometry() {
  // prettier-ignore
  const positions = [
    // left wing: shoulder, tip, trailing edge
    0, 0, 0.12,   -1, 0.35, -0.1,   0, 0, -0.18,
    // right wing
    0, 0, 0.12,   0, 0, -0.18,   1, 0.35, -0.1,
    // body, a thin diamond
    0, 0.04, 0.32,   -0.08, 0, -0.05,   0, 0, -0.38,
    0, 0.04, 0.32,   0, 0, -0.38,   0.08, 0, -0.05,
  ];
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

const BIRDS = 5;

/** A few birds circling lazily over the slope, wings beating then gliding. */
export class Birds {
  readonly mesh: InstancedMesh;
  private readonly geometry = birdGeometry();
  private readonly material = new MeshBasicMaterial({ color: '#46506a', side: DoubleSide });
  private readonly dummy = new Object3D();

  constructor(
    private readonly centre: { x: number; y: number; z: number },
    private readonly radius: number,
  ) {
    this.mesh = new InstancedMesh(this.geometry, this.material, BIRDS);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.update(0, false);
  }

  update(t: number, calm: boolean) {
    const dummy = this.dummy;
    const time = calm ? 0 : t;
    for (let index = 0; index < BIRDS; index++) {
      const angle = time * 0.16 + index * 0.55;
      const r = this.radius * (0.82 + (index % 3) * 0.12);
      dummy.position.set(
        this.centre.x + Math.cos(angle) * r,
        this.centre.y + Math.sin(time * 0.5 + index) * 0.5 + (index % 2) * 0.6,
        this.centre.z + Math.sin(angle) * r * 0.55,
      );
      // Fly along the circle, banking into the turn.
      dummy.rotation.set(0, Math.atan2(-Math.sin(angle), 0.55 * Math.cos(angle)), -0.3);
      // A few quick beats, then a long glide with the wings held up.
      const cycle = (time * 0.9 + index * 0.37) % 2.2;
      const flap = calm ? 0.55 : cycle < 0.9 ? Math.cos(cycle * 14) : 0.55;
      dummy.scale.set(0.5, 0.5 * flap, 0.5);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(index, dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.mesh.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
}

// ---------------------------------------------------------------------------------------------
// Swaying pines

/** The wind every swaying material reads: its clock and how hard it blows (0 under calm). */
export interface Wind {
  readonly time: { value: number };
  readonly strength: { value: number };
}

export const createWind = (): Wind => ({ time: { value: 0 }, strength: { value: 0.035 } });

/**
 * A standard material for instanced pine parts that bends with the wind: points higher up the
 * tree move further, and each tree has its own phase from where it stands. `lift` is how high
 * this part's origin sits above the tree's foot, in tree units.
 */
export function swayingMaterial(
  wind: Wind,
  lift: number,
  parameters: MeshStandardMaterialParameters,
): Material {
  const material = new MeshStandardMaterial(parameters);
  material.onBeforeCompile = (shader) => {
    shader.uniforms['windTime'] = wind.time;
    shader.uniforms['windStrength'] = wind.strength;
    shader.uniforms['windLift'] = { value: lift };
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform float windTime;\nuniform float windStrength;\nuniform float windLift;',
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float windPhase = instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 0.45;
        #else
          float windPhase = 0.0;
        #endif
        float windBend = windStrength * max(0.0, transformed.y + windLift);
        transformed.x += sin(windTime * 1.3 + windPhase) * windBend;
        transformed.z += sin(windTime * 0.9 + windPhase * 1.7) * windBend * 0.5;`,
      );
  };
  material.customProgramCacheKey = () => 'gondola-sway';
  return material;
}
