import {
  BufferGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  Material,
  Matrix3,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  MeshStandardMaterialParameters,
  Object3D,
  OctahedronGeometry,
  PlaneGeometry,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import { TextLabel } from '../../shared/three/labels';
import { MONEY_LOOK } from './market-frame';
import type { GoodId } from './market-levels';
import { Denomination, faceUnit, faceValue, isNote } from './market-money';

/**
 * The Fairy Market's models, shared by the shop and its loading scene: Olli the otter behind
 * his counter, Lumi the fairy with her basket, the twelve treats, coins and notes, and the
 * price tag. Soft, rounded toy shapes like the other games' characters.
 *
 * Shapes and materials live in a `Kit`, one per world, so the kit frees everything at once.
 */

const UP = new Vector3(0, 1, 0);

/** A rounded box: a rounded rectangle extruded with a soft bevel, centred on its origin. */
export function roundedBox(width: number, height: number, depth: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  const bevel = Math.min(r * 0.6, depth / 3);
  const w = width / 2 - bevel;
  const h = height / 2 - bevel;
  const c = Math.max(0.001, r - bevel);
  const shape = new Shape();
  shape.moveTo(-w + c, -h);
  shape.lineTo(w - c, -h);
  shape.quadraticCurveTo(w, -h, w, -h + c);
  shape.lineTo(w, h - c);
  shape.quadraticCurveTo(w, h, w - c, h);
  shape.lineTo(-w + c, h);
  shape.quadraticCurveTo(-w, h, -w, h - c);
  shape.lineTo(-w, -h + c);
  shape.quadraticCurveTo(-w, -h, -w + c, -h);
  const geometry = new ExtrudeGeometry(shape, {
    depth: Math.max(0.001, depth - 2 * bevel),
    bevelEnabled: true,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 3,
    curveSegments: 6,
  });
  geometry.translate(0, 0, -(depth - 2 * bevel) / 2);
  geometry.computeVertexNormals();
  return geometry;
}

/** A five-pointed star outline, for the wand and the book cover. */
function starShape(outer: number, inner: number) {
  const shape = new Shape();
  for (let point = 0; point < 10; point++) {
    const angle = Math.PI / 2 + (point * Math.PI) / 5;
    const r = point % 2 ? inner : outer;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (point) shape.lineTo(x, y);
    else shape.moveTo(x, y);
  }
  shape.closePath();
  return shape;
}

/** A gauzy wing blade from the shoulder outwards. */
function wingShape(length: number, width: number, lift: number) {
  const shape = new Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(length * 0.3, width * 0.9 + lift, length * 0.95, width + lift, length, lift);
  shape.bezierCurveTo(length * 0.9, -width * 0.5 + lift, length * 0.35, -width * 0.45, 0, 0);
  return new ShapeGeometry(shape, 18);
}

/** Merges every mesh under `root` into one geometry, with each mesh's colour in its vertices. */
function mergeColored(root: Object3D): BufferGeometry {
  root.updateMatrixWorld(true);
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const point = new Vector3();
  const normal = new Vector3();
  const normalMatrix = new Matrix3();
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const geometry = object.geometry as BufferGeometry;
    const position = geometry.getAttribute('position');
    const normalAttribute = geometry.getAttribute('normal');
    const color = (object.material as MeshStandardMaterial).color;
    normalMatrix.getNormalMatrix(object.matrixWorld);
    const offset = positions.length / 3;
    for (let index = 0; index < position.count; index++) {
      point.fromBufferAttribute(position, index).applyMatrix4(object.matrixWorld);
      normal.fromBufferAttribute(normalAttribute, index).applyMatrix3(normalMatrix).normalize();
      positions.push(point.x, point.y, point.z);
      normals.push(normal.x, normal.y, normal.z);
      colors.push(color.r, color.g, color.b);
    }
    const index = geometry.getIndex();
    if (index) for (let at = 0; at < index.count; at++) indices.push(offset + index.getX(at));
    else for (let at = 0; at < position.count; at++) indices.push(offset + at);
  });
  const merged = new BufferGeometry();
  merged.setAttribute('position', new Float32BufferAttribute(positions, 3));
  merged.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  merged.setAttribute('color', new Float32BufferAttribute(colors, 3));
  merged.setIndex(indices);
  return merged;
}

/** Shapes, materials and labels one world shares between all its characters, treats and coins. */
export class Kit {
  readonly ball = new SphereGeometry(1, 20, 14);
  readonly smallBall = new SphereGeometry(1, 10, 8);
  readonly hemisphere = new SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  readonly cylinder = new CylinderGeometry(1, 1, 1, 24);
  readonly cone = new ConeGeometry(1, 1, 12);
  readonly sparkle = new OctahedronGeometry(1);
  readonly disc = new CircleGeometry(1, 28);
  readonly plane = new PlaneGeometry(1, 1);
  private readonly owned = new Set<BufferGeometry>([
    this.ball,
    this.smallBall,
    this.hemisphere,
    this.cylinder,
    this.cone,
    this.sparkle,
    this.disc,
    this.plane,
  ]);
  private readonly materials = new Map<string, MeshStandardMaterial>();
  private readonly baked = new Map<string, BufferGeometry>();
  private readonly labels = new Map<string, { label: TextLabel; material: MeshBasicMaterial }>();
  /** The material for baked parts: their colours live in the vertices. */
  readonly painted = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.7,
    side: DoubleSide,
  });

  /**
   * One mesh for a group of parts that never move apart: `build` makes them once per key, and
   * their shapes and colours are merged into a single geometry. One draw instead of twenty.
   */
  bake(key: string, build: () => Object3D): Mesh {
    let geometry = this.baked.get(key);
    if (!geometry) {
      const parts = build();
      geometry = mergeColored(parts);
      parts.traverse((object) => {
        if (object instanceof Mesh && !this.owned.has(object.geometry)) object.geometry.dispose();
      });
      this.baked.set(key, geometry);
    }
    return new Mesh(geometry, this.painted);
  }

  /** A shared material for these settings; the same settings always give the same material. */
  mat(color: string, extra: MeshStandardMaterialParameters = {}): MeshStandardMaterial {
    const key = `${color}|${JSON.stringify(extra)}`;
    let material = this.materials.get(key);
    if (!material) {
      material = new MeshStandardMaterial({ color, roughness: 0.75, ...extra });
      this.materials.set(key, material);
    }
    return material;
  }

  /** A shared see-through material showing `text`, drawn once per key. */
  label(key: string, text: string, style: ConstructorParameters<typeof TextLabel>[1]) {
    let entry = this.labels.get(key);
    if (!entry) {
      const label = new TextLabel(text, style);
      const material = new MeshBasicMaterial({ map: label.texture, transparent: true });
      entry = { label, material };
      this.labels.set(key, entry);
    }
    return entry.material;
  }

  /** An ellipsoid from the shared ball. */
  blob(material: Material, rx: number, ry: number, rz: number, x = 0, y = 0, z = 0) {
    const mesh = new Mesh(this.ball, material);
    mesh.scale.set(rx, ry, rz);
    mesh.position.set(x, y, z);
    return mesh;
  }

  /** A tapered rod from one point to another. */
  rod(
    material: Material,
    from: Vector3,
    to: Vector3,
    startRadius: number,
    endRadius = startRadius,
  ) {
    const direction = to.clone().sub(from);
    const length = direction.length();
    const mesh = new Mesh(new CylinderGeometry(endRadius, startRadius, length, 10), material);
    mesh.position.copy(from).addScaledVector(direction, 0.5);
    mesh.quaternion.setFromUnitVectors(UP, direction.normalize());
    return mesh;
  }

  /** A cylinder from the shared one: radius, height, centred at a point. */
  can(material: Material, radius: number, height: number, x = 0, y = 0, z = 0) {
    const mesh = new Mesh(this.cylinder, material);
    mesh.scale.set(radius, height, radius);
    mesh.position.set(x, y, z);
    return mesh;
  }

  dispose() {
    for (const geometry of this.owned) geometry.dispose();
    for (const material of this.materials.values()) material.dispose();
    this.materials.clear();
    for (const geometry of this.baked.values()) geometry.dispose();
    this.baked.clear();
    for (const { label, material } of this.labels.values()) {
      label.texture.dispose();
      material.dispose();
    }
    this.labels.clear();
    this.painted.dispose();
  }
}

const v = (x: number, y: number, z: number) => new Vector3(x, y, z);

// ---------------------------------------------------------------------------------------------
// The treats

/** Builds one treat's parts, about 0.5 tall, standing on y = 0 and facing +z. */
function goodParts(kit: Kit, id: GoodId): Group {
  const g = new Group();
  const m = (color: string) => kit.mat(color);
  switch (id) {
    case 'apple': {
      const red = m('#e0473c');
      g.add(
        kit.blob(red, 0.21, 0.19, 0.2, 0, 0.19, 0),
        kit.blob(red, 0.1, 0.08, 0.1, -0.07, 0.31, 0),
        kit.blob(red, 0.1, 0.08, 0.1, 0.07, 0.31, 0),
        kit.blob(m('#ffd0c8'), 0.05, 0.07, 0.03, -0.09, 0.24, 0.17),
        kit.rod(m('#6b4226'), v(0, 0.32, 0), v(0.03, 0.46, 0), 0.018, 0.014),
      );
      const leaf = kit.blob(m('#4fae55'), 0.08, 0.028, 0.045, 0.09, 0.44, 0);
      leaf.rotation.z = 0.5;
      g.add(leaf);
      break;
    }
    case 'cookie': {
      const dough = kit.can(m('#d9a35f'), 0.22, 0.07, 0, 0.23, 0);
      dough.rotation.x = Math.PI / 2 - 0.12;
      g.add(dough, kit.blob(m('#e9bd7c'), 0.2, 0.2, 0.02, 0, 0.23, 0.032));
      const chips: [number, number][] = [
        [-0.09, 0.3],
        [0.06, 0.33],
        [0.11, 0.2],
        [-0.04, 0.16],
        [-0.12, 0.2],
        [0.02, 0.25],
      ];
      for (const [x, y] of chips) g.add(kit.blob(m('#5a3418'), 0.03, 0.028, 0.02, x, y, 0.05));
      // A little stand, so it shows its face.
      g.add(kit.can(m('#f4e6d0'), 0.12, 0.02, 0, 0.01, 0));
      break;
    }
    case 'flower': {
      g.add(
        kit.rod(m('#c8643c'), v(0, 0, 0), v(0, 0.17, 0), 0.09, 0.12),
        kit.can(m('#b5532e'), 0.13, 0.04, 0, 0.18, 0),
        kit.can(m('#4b2f1c'), 0.11, 0.02, 0, 0.2, 0),
        kit.rod(m('#4f9a4a'), v(0, 0.2, 0), v(0, 0.4, 0), 0.016),
      );
      const leaf = kit.blob(m('#5cb05a'), 0.07, 0.025, 0.035, 0.05, 0.28, 0);
      leaf.rotation.z = 0.6;
      g.add(leaf);
      for (let petal = 0; petal < 5; petal++) {
        const angle = (petal / 5) * Math.PI * 2;
        g.add(
          kit.blob(
            m('#f27aa8'),
            0.06,
            0.06,
            0.03,
            Math.cos(angle) * 0.065,
            0.42 + Math.sin(angle) * 0.065,
            0.02,
          ),
        );
      }
      g.add(kit.blob(m('#ffd34d'), 0.04, 0.04, 0.03, 0, 0.42, 0.04));
      break;
    }
    case 'cupcake': {
      g.add(
        kit.rod(m('#f5a3c0'), v(0, 0, 0), v(0, 0.19, 0), 0.12, 0.17),
        kit.blob(m('#fff4f8'), 0.19, 0.09, 0.19, 0, 0.23, 0),
        kit.blob(m('#ffe3ee'), 0.14, 0.08, 0.14, 0, 0.3, 0),
        kit.blob(m('#fff4f8'), 0.08, 0.07, 0.08, 0, 0.37, 0),
        kit.blob(m('#d92b3a'), 0.05, 0.05, 0.05, 0, 0.45, 0),
        kit.rod(m('#5c8a2e'), v(0, 0.48, 0), v(0.03, 0.54, 0), 0.007),
      );
      const sprinkles: [number, number, number, string][] = [
        [-0.1, 0.27, 0.12, '#3d8fe0'],
        [0.09, 0.29, 0.11, '#ffd34d'],
        [0.02, 0.33, 0.12, '#4fae55'],
        [-0.05, 0.36, 0.06, '#e0457b'],
      ];
      for (const [x, y, z, c] of sprinkles) g.add(kit.blob(m(c), 0.018, 0.01, 0.01, x, y, z));
      break;
    }
    case 'ribbon': {
      const pink = m('#e8457f');
      for (const side of [-1, 1]) {
        const loop = new Mesh(new TorusGeometry(0.09, 0.04, 10, 20), pink);
        loop.scale.set(1.35, 0.95, 0.7);
        loop.position.set(side * 0.13, 0.32, 0);
        loop.rotation.z = side * 0.25;
        g.add(loop);
        g.add(kit.rod(pink, v(side * 0.02, 0.3, 0), v(side * 0.12, 0.04, 0.02), 0.03, 0.022));
      }
      g.add(kit.blob(m('#c9306a'), 0.055, 0.06, 0.05, 0, 0.31, 0.01));
      break;
    }
    case 'honey': {
      const jar = m('#f0a91c');
      g.add(
        kit.can(jar, 0.16, 0.26, 0, 0.13, 0),
        kit.blob(jar, 0.16, 0.05, 0.16, 0, 0.26, 0),
        kit.can(m('#c98a12'), 0.11, 0.05, 0, 0.3, 0),
        kit.blob(m('#e24b4b'), 0.17, 0.045, 0.17, 0, 0.34, 0),
        kit.blob(m('#ffffff'), 0.06, 0.03, 0.06, 0.07, 0.355, 0.07),
        kit.can(m('#8a5a2b'), 0.115, 0.015, 0, 0.32, 0),
      );
      const label = new Mesh(roundedBox(0.18, 0.12, 0.02, 0.03), m('#fff4dc'));
      label.position.set(0, 0.13, 0.16);
      g.add(label);
      // A tiny bee on the label.
      g.add(
        kit.blob(m('#ffd34d'), 0.03, 0.022, 0.015, 0, 0.13, 0.175),
        kit.blob(m('#3b2416'), 0.008, 0.022, 0.016, 0.008, 0.13, 0.178),
      );
      g.scale.setScalar(1.25);
      break;
    }
    case 'ball': {
      g.add(kit.blob(m('#e84a5f'), 0.22, 0.22, 0.22, 0, 0.22, 0));
      const white = new Mesh(new TorusGeometry(0.218, 0.035, 8, 32), m('#ffffff'));
      white.position.y = 0.22;
      white.rotation.y = Math.PI / 2 - 0.35;
      const blue = new Mesh(new TorusGeometry(0.218, 0.035, 8, 32), m('#3d8fe0'));
      blue.position.y = 0.22;
      blue.rotation.y = Math.PI / 2 + 0.35;
      const yellow = new Mesh(new TorusGeometry(0.218, 0.03, 8, 32), m('#ffd34d'));
      yellow.position.y = 0.22;
      yellow.rotation.x = Math.PI / 2;
      g.add(white, blue, yellow);
      break;
    }
    case 'book': {
      const cover = new Mesh(roundedBox(0.34, 0.44, 0.1, 0.03), m('#4a78d8'));
      cover.position.set(0, 0.22, 0);
      const pages = new Mesh(roundedBox(0.31, 0.4, 0.085, 0.01), m('#fff8e6'));
      pages.position.set(0.025, 0.22, 0.001);
      const spine = new Mesh(roundedBox(0.05, 0.44, 0.11, 0.02), m('#2f56a8'));
      spine.position.set(-0.16, 0.22, 0);
      const star = new Mesh(
        new ExtrudeGeometry(starShape(0.08, 0.035), { depth: 0.015, bevelEnabled: false }),
        m('#f6c945'),
      );
      star.position.set(0.01, 0.25, 0.05);
      g.add(cover, pages, spine, star);
      g.rotation.y = -0.25;
      break;
    }
    case 'teddy': {
      const fur = m('#b07845');
      const cream = m('#f0d6ae');
      g.add(
        kit.blob(fur, 0.15, 0.16, 0.13, 0, 0.17, 0),
        kit.blob(cream, 0.09, 0.1, 0.05, 0, 0.16, 0.1),
        kit.blob(fur, 0.13, 0.12, 0.12, 0, 0.38, 0),
        kit.blob(cream, 0.06, 0.045, 0.05, 0, 0.36, 0.1),
        kit.blob(m('#3b2416'), 0.022, 0.017, 0.015, 0, 0.38, 0.145),
      );
      for (const side of [-1, 1]) {
        g.add(
          kit.blob(fur, 0.05, 0.05, 0.03, side * 0.095, 0.48, 0),
          kit.blob(cream, 0.028, 0.028, 0.02, side * 0.095, 0.48, 0.02),
          kit.blob(m('#1e140d'), 0.016, 0.019, 0.01, side * 0.045, 0.41, 0.11),
          kit.blob(fur, 0.05, 0.09, 0.05, side * 0.15, 0.2, 0.03),
          kit.blob(fur, 0.065, 0.05, 0.085, side * 0.08, 0.04, 0.05),
        );
        const bow = kit.blob(m('#e0457b'), 0.04, 0.025, 0.02, side * 0.04, 0.28, 0.11);
        bow.rotation.z = side * 0.4;
        g.add(bow);
      }
      break;
    }
    case 'wand': {
      g.add(kit.rod(m('#b48ad8'), v(0, 0, 0), v(0, 0.33, 0), 0.022, 0.018));
      g.add(kit.can(m('#f6c945'), 0.035, 0.02, 0, 0.02, 0));
      const star = new Mesh(
        new ExtrudeGeometry(starShape(0.14, 0.06), {
          depth: 0.04,
          bevelEnabled: true,
          bevelSize: 0.012,
          bevelThickness: 0.012,
          bevelSegments: 2,
        }),
        m('#f6c945'),
      );
      star.position.set(0, 0.42, -0.02);
      g.add(star);
      for (const [x, y, c] of [
        [-0.14, 0.33, '#f27aa8'],
        [0.15, 0.5, '#7fc4ff'],
        [0.12, 0.3, '#ffe6a0'],
      ] as const) {
        const twinkle = new Mesh(kit.sparkle, m(c));
        twinkle.scale.set(0.03, 0.045, 0.02);
        twinkle.position.set(x, y, 0);
        g.add(twinkle);
      }
      break;
    }
    case 'kite': {
      const colors = ['#e84a5f', '#ffd34d', '#3d8fe0', '#4fae55'];
      const corners: [number, number][] = [
        [0, 0.55],
        [0.19, 0.36],
        [0, 0.12],
        [-0.19, 0.36],
      ];
      const centre: [number, number] = [0, 0.38];
      corners.forEach((corner, index) => {
        const next = corners[(index + 1) % 4];
        const shape = new Shape();
        shape.moveTo(...centre);
        shape.lineTo(...corner);
        shape.lineTo(...next);
        shape.closePath();
        const face = new Mesh(
          new ShapeGeometry(shape),
          kit.mat(colors[index], { side: DoubleSide }),
        );
        g.add(face);
      });
      const stick = m('#8a5a2b');
      g.add(
        kit.rod(stick, v(0, 0.12, 0.01), v(0, 0.55, 0.01), 0.008),
        kit.rod(stick, v(-0.19, 0.36, 0.01), v(0.19, 0.36, 0.01), 0.008),
        kit.rod(m('#6b4226'), v(0, 0.12, 0), v(0.05, 0.0, 0), 0.006),
      );
      for (const [x, y, c] of [
        [0.015, 0.08, '#e0457b'],
        [0.035, 0.035, '#3d8fe0'],
      ] as const) {
        const bow = kit.blob(m(c), 0.028, 0.016, 0.01, x, y, 0.01);
        g.add(bow);
      }
      break;
    }
    case 'dragon': {
      const green = m('#5cbf72');
      const belly = m('#f4e6a0');
      g.add(
        kit.blob(green, 0.15, 0.15, 0.14, 0, 0.15, 0),
        kit.blob(belly, 0.1, 0.11, 0.06, 0, 0.14, 0.1),
        kit.blob(green, 0.13, 0.12, 0.12, 0, 0.36, 0.02),
        kit.blob(green, 0.07, 0.055, 0.06, 0, 0.33, 0.12),
        kit.blob(m('#2f7a45'), 0.012, 0.01, 0.01, -0.03, 0.35, 0.18),
        kit.blob(m('#2f7a45'), 0.012, 0.01, 0.01, 0.03, 0.35, 0.18),
      );
      for (const side of [-1, 1]) {
        g.add(
          kit.blob(m('#1e140d'), 0.022, 0.026, 0.012, side * 0.055, 0.4, 0.11),
          kit.blob(green, 0.055, 0.04, 0.075, side * 0.08, 0.03, 0.05),
        );
        const horn = new Mesh(kit.cone, m('#fff1c8'));
        horn.scale.set(0.025, 0.07, 0.025);
        horn.position.set(side * 0.06, 0.49, -0.01);
        horn.rotation.z = -side * 0.3;
        g.add(horn);
        const wing = new Mesh(wingShape(0.2, 0.12, 0.08), kit.mat('#9fe0a8', { side: DoubleSide }));
        wing.position.set(side * 0.06, 0.22, -0.1);
        wing.scale.x = side;
        wing.rotation.y = side * 0.6;
        g.add(wing);
      }
      for (let spike = 0; spike < 3; spike++) {
        const cone = new Mesh(kit.cone, m('#f2a33a'));
        cone.scale.set(0.025, 0.05, 0.025);
        cone.position.set(0, 0.27 - spike * 0.08, -0.12 - spike * 0.015);
        cone.rotation.x = -0.6;
        g.add(cone);
      }
      g.add(kit.rod(green, v(0.08, 0.06, -0.08), v(0.24, 0.05, 0.02), 0.05, 0.015));
      break;
    }
  }
  return g;
}

/** One treat as a single baked mesh in a group, about 0.5 tall, standing on y = 0. */
export function buildGood(kit: Kit, id: GoodId): Group {
  const group = new Group();
  group.add(kit.bake(`good|${id}`, () => goodParts(kit, id)));
  return group;
}

// ---------------------------------------------------------------------------------------------
// Money

/** Coin radius or note half-size, in world units; real money differs in size, so does ours. */
export const COIN_RADIUS: Record<number, number> = {
  10: 0.13,
  20: 0.145,
  50: 0.16,
  100: 0.155,
  200: 0.172,
};
export const NOTE_SIZE: Record<number, readonly [number, number]> = {
  500: [0.56, 0.3],
  1000: [0.6, 0.32],
  2000: [0.64, 0.34],
};

/** How wide a coin or note sits on the tray. */
export function moneyWidth(value: Denomination) {
  return isNote(value) ? NOTE_SIZE[value][0] : COIN_RADIUS[value] * 2;
}

/**
 * A coin or note lying in the x-y plane with its face toward +z: a rim, a raised centre in the
 * other metal (bimetal 1 € and 2 €), and its value printed on top.
 */
export function buildMoney(kit: Kit, value: Denomination): Group {
  const look = MONEY_LOOK[value];
  const group = new Group();
  const text = `${faceValue(value)} ${faceUnit(value)}`;
  if (isNote(value)) {
    const [w, h] = NOTE_SIZE[value];
    const body = new Mesh(roundedBox(w, h, 0.02, 0.03), kit.mat(look.rim, { roughness: 0.9 }));
    const face = new Mesh(
      kit.plane,
      kit.label(`note|${value}`, text, {
        fill: look.fill,
        border: look.rim,
        ink: look.ink,
        width: 256,
        height: Math.round((256 * h) / w),
        radius: 0.12,
      }),
    );
    face.scale.set(w - 0.02, h - 0.02, 1);
    face.position.z = 0.012;
    group.add(body, face);
    return group;
  }
  const r = COIN_RADIUS[value];
  const metal = { metalness: 0.45, roughness: 0.35 };
  const rim = kit.can(kit.mat(look.rim, metal), r, 0.04);
  rim.rotation.x = Math.PI / 2;
  const centre = kit.can(kit.mat(look.fill, metal), r * 0.72, 0.05);
  centre.rotation.x = Math.PI / 2;
  const face = new Mesh(
    kit.plane,
    kit.label(`coin|${value}`, text, { ink: look.ink, width: 256, height: 256 }),
  );
  face.scale.set(r * 1.5, r * 1.5, 1);
  face.position.z = 0.027;
  group.add(rim, centre, face);
  return group;
}

// ---------------------------------------------------------------------------------------------
// The price tag

export interface PriceTag {
  readonly root: Group;
  /** The card that swings on its string. */
  readonly card: Group;
  setText(text: string, big: boolean): void;
}

/**
 * A cream card with a pink border. `hook`: it hangs on a string from a little brass hook that
 * stands on the counter. `edge`: a squarer card clipped to the counter's front edge, for a row
 * of treats that each need their own price.
 */
export function buildPriceTag(kit: Kit, mount: 'hook' | 'edge' = 'hook'): PriceTag {
  const root = new Group();
  const brass = kit.mat('#c99a3a', { metalness: 0.5, roughness: 0.35 });
  const card = new Group();
  const [w, h] = mount === 'hook' ? [0.72, 0.42] : [0.5, 0.38];
  const string = kit.mat('#7a5a3a');
  if (mount === 'hook') {
    root.add(
      kit.can(brass, 0.06, 0.03, 0, 0.015, 0),
      kit.rod(brass, v(0, 0, 0), v(0, 0.86, 0), 0.016),
      kit.rod(brass, v(0, 0.86, 0), v(-0.12, 0.86, 0), 0.014),
    );
    card.position.set(-0.12, 0.86, 0.02);
    card.add(
      kit.rod(string, v(0, 0, 0), v(0, -0.2, 0), 0.006),
      kit.blob(string, 0.02, 0.02, 0.01, 0, -0.23, 0.014),
    );
  } else {
    // A little brass clip over the edge.
    const clip = new Mesh(roundedBox(0.12, 0.09, 0.06, 0.02), brass);
    clip.position.set(0, -0.02, -0.01);
    card.add(clip);
  }
  const top = mount === 'hook' ? -0.2 : -0.04;
  const body = new Mesh(roundedBox(w, h, 0.025, 0.07), kit.mat('#fff6e4'));
  body.position.y = top - h / 2;
  const size = { width: 320, height: Math.round((320 * h) / w), radius: 0.2 };
  const plain = new TextLabel('', { fill: '#fff6e4', border: '#e0457b', ink: '#16264f', ...size });
  const golden = new TextLabel('', { fill: '#ffe08a', border: '#c99a1c', ink: '#4a3200', ...size });
  const face = new MeshBasicMaterial({ map: plain.texture, transparent: true });
  const front = new Mesh(kit.plane, face);
  front.scale.set(w - 0.02, h - 0.02, 1);
  front.position.set(0, top - h / 2, 0.014);
  card.add(body, front);
  root.add(card);
  return {
    root,
    card,
    setText(text: string, big: boolean) {
      const label = big ? golden : plain;
      label.update(text);
      if (face.map !== label.texture) {
        face.map = label.texture;
        face.needsUpdate = true;
      }
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Olli the otter

export interface Olli {
  readonly root: Group;
  /** Everything above the floor: it bobs and bounces. */
  readonly body: Group;
  readonly head: Group;
  /** Shoulder pivots: [0] on −x (toward the till), [1] on +x (toward the treat). */
  readonly arms: readonly Group[];
}

/**
 * Olli the otter, about 2.5 tall, standing behind his counter and facing +z: a long brown body
 * with a cream chest, a green apron, a wide flat head with a cream muzzle, a big dark nose,
 * whiskers, small round ears and shiny eyes.
 */
export function buildOlli(kit: Kit): Olli {
  const fur = '#8b5a36';
  const cream = '#f2e0c2';
  const dark = '#3b2416';
  const root = new Group();
  const body = new Group();
  root.add(body);
  body.add(
    kit.bake('olli-body', () => {
      const g = new Group();
      const furM = kit.mat(fur);
      const creamM = kit.mat(cream);
      const apron = kit.mat('#4f9a62');
      g.add(
        kit.blob(furM, 0.4, 0.62, 0.33, 0, 1.05, 0),
        kit.blob(furM, 0.33, 0.38, 0.29, 0, 1.55, 0),
        kit.blob(creamM, 0.24, 0.3, 0.12, 0, 1.62, 0.2),
        kit.blob(furM, 0.2, 0.22, 0.2, 0, 1.86, 0.02),
      );
      const bib = new Mesh(roundedBox(0.5, 0.66, 0.04, 0.1), apron);
      bib.position.set(0, 1.25, 0.32);
      bib.rotation.x = -0.12;
      const pocket = new Mesh(roundedBox(0.26, 0.15, 0.03, 0.05), kit.mat('#6fbf7f'));
      pocket.position.set(0, 1.12, 0.35);
      pocket.rotation.x = -0.12;
      g.add(bib, pocket);
      for (const side of [-1, 1])
        g.add(kit.rod(apron, v(side * 0.2, 1.56, 0.3), v(side * 0.12, 1.84, 0.18), 0.022));
      // A little leaf badge on the strap.
      g.add(kit.blob(kit.mat('#f6c945'), 0.035, 0.035, 0.015, 0.16, 1.62, 0.31));
      return g;
    }),
  );
  const head = new Group();
  head.position.set(0, 2.08, 0.04);
  head.add(
    kit.bake('olli-head', () => {
      const g = new Group();
      const furM = kit.mat(fur);
      const creamM = kit.mat(cream);
      const darkM = kit.mat(dark, { roughness: 0.3 });
      const white = kit.mat('#ffffff');
      g.add(
        kit.blob(furM, 0.34, 0.24, 0.28, 0, 0, 0),
        kit.blob(creamM, 0.22, 0.13, 0.15, 0, -0.08, 0.2),
        kit.blob(creamM, 0.1, 0.07, 0.08, -0.1, -0.06, 0.26),
        kit.blob(creamM, 0.1, 0.07, 0.08, 0.1, -0.06, 0.26),
        kit.blob(darkM, 0.075, 0.05, 0.045, 0, -0.01, 0.34),
        kit.blob(white, 0.022, 0.012, 0.01, -0.02, 0.01, 0.38),
        kit.blob(kit.mat('#6b3a28'), 0.04, 0.02, 0.02, 0, -0.14, 0.31),
        kit.blob(furM, 0.12, 0.06, 0.1, 0, 0.24, -0.02),
      );
      for (const side of [-1, 1]) {
        g.add(
          kit.blob(darkM, 0.042, 0.048, 0.03, side * 0.12, 0.08, 0.23),
          kit.blob(white, 0.013, 0.013, 0.01, side * 0.12 + 0.012, 0.096, 0.258),
          kit.blob(furM, 0.055, 0.05, 0.035, side * 0.3, 0.1, -0.04),
          kit.blob(kit.mat('#5c3820'), 0.03, 0.028, 0.02, side * 0.3, 0.1, -0.015),
          kit.blob(kit.mat('#f5a3a8'), 0.05, 0.03, 0.02, side * 0.2, -0.04, 0.22),
        );
        for (let whisker = 0; whisker < 3; whisker++)
          g.add(
            kit.rod(
              kit.mat('#fbf6ec'),
              v(side * 0.15, -0.06 + whisker * 0.03, 0.29),
              v(side * 0.4, -0.02 + whisker * 0.06, 0.24),
              0.006,
              0.003,
            ),
          );
      }
      return g;
    }),
  );
  body.add(head);
  const arms: Group[] = [];
  const arm = () =>
    kit.bake('olli-arm', () => {
      const g = new Group();
      g.add(
        kit.rod(kit.mat(fur), v(0, 0, 0), v(0, -0.44, 0.04), 0.09, 0.075),
        kit.blob(kit.mat('#5c3820'), 0.085, 0.075, 0.085, 0, -0.48, 0.05),
      );
      return g;
    });
  for (const side of [-1, 1]) {
    const shoulder = new Group();
    shoulder.position.set(side * 0.34, 1.7, 0.06);
    shoulder.add(arm());
    shoulder.rotation.z = side * 0.22;
    arms.push(shoulder);
    body.add(shoulder);
  }
  return { root, body, head, arms };
}

// ---------------------------------------------------------------------------------------------
// Lumi the fairy

export interface Lumi {
  /** Her shoes are at the origin; she floats wherever the world puts this. */
  readonly root: Group;
  readonly body: Group;
  readonly head: Group;
  readonly wings: readonly Mesh[];
  readonly arms: readonly Group[];
  /** The wicker basket she carries; treats go into `basketItems`. */
  readonly basket: Group;
  readonly basketItems: Group;
}

/** The wicker basket: an open woven bowl with a rim and a handle. */
export function buildBasket(kit: Kit): { root: Group; items: Group } {
  const root = new Group();
  root.add(
    kit.bake('basket', () => {
      const g = new Group();
      const wicker = kit.mat('#c48a4a', { side: DoubleSide });
      g.add(
        new Mesh(new CylinderGeometry(0.2, 0.15, 0.17, 18, 1, true), wicker),
        kit.can(kit.mat('#a8713a'), 0.15, 0.015, 0, -0.08, 0),
      );
      const rim = new Mesh(new TorusGeometry(0.2, 0.022, 8, 24), kit.mat('#9c6534'));
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.085;
      const handle = new Mesh(new TorusGeometry(0.19, 0.016, 8, 22, Math.PI), kit.mat('#9c6534'));
      handle.position.y = 0.085;
      g.add(rim, handle);
      // Two woven bands round the bowl.
      for (const y of [-0.04, 0.02]) {
        const band = new Mesh(
          new TorusGeometry(0.167 + (y + 0.04) * 0.55, 0.01, 6, 24),
          kit.mat('#a8713a'),
        );
        band.rotation.x = Math.PI / 2;
        band.position.y = y;
        g.add(band);
      }
      return g;
    }),
  );
  const items = new Group();
  items.position.y = 0.03;
  root.add(items);
  return { root, items };
}

/**
 * Lumi, about 1.45 tall: golden hair down her back with a pink flower clip, blue eyes, a pale
 * mint leaf dress with a hem of leaves, gold slippers and gauzy wings. She carries her basket
 * in front of her on the −x side.
 */
export function buildLumi(kit: Kit): Lumi {
  const root = new Group();
  const body = new Group();
  root.add(body);
  const skin = kit.mat('#ffd9c2', { roughness: 0.7 });
  const hair = kit.mat('#f4d27a', { roughness: 0.55 });
  body.add(
    kit.bake('lumi-body', () => {
      const g = new Group();
      const dress = kit.mat('#bde8cf', { roughness: 0.6 });
      const leaf = kit.mat('#8fd1a6');
      const gold = kit.mat('#f2c14e', { metalness: 0.4, roughness: 0.35 });
      for (const side of [-1, 1]) {
        g.add(kit.rod(skin, v(side * 0.065, 0.06, 0), v(side * 0.065, 0.45, 0), 0.03, 0.033));
        const shoe = kit.blob(gold, 0.05, 0.035, 0.075, side * 0.065, 0.035, 0.025);
        g.add(shoe, kit.blob(gold, 0.018, 0.018, 0.018, side * 0.065, 0.07, 0.09));
      }
      // A bell-shaped dress from the waist to the knees, with a hem of leaves.
      g.add(kit.rod(dress, v(0, 0.42, 0), v(0, 0.82, 0), 0.27, 0.1));
      for (let index = 0; index < 11; index++) {
        const angle = (index / 11) * Math.PI * 2;
        const piece = kit.blob(
          leaf,
          0.075,
          0.032,
          0.05,
          Math.sin(angle) * 0.27,
          0.42,
          Math.cos(angle) * 0.27,
        );
        piece.rotation.y = angle;
        piece.rotation.x = 0.5;
        g.add(piece);
      }
      g.add(
        kit.rod(kit.mat('#9edbb6'), v(0, 0.78, 0), v(0, 1.0, 0), 0.1, 0.085),
        kit.blob(leaf, 0.06, 0.025, 0.03, -0.05, 0.96, 0.08),
        kit.blob(leaf, 0.06, 0.025, 0.03, 0.05, 0.96, 0.08),
        kit.rod(skin, v(0, 0.98, 0), v(0, 1.08, 0), 0.034),
        // Long golden hair down her back.
        kit.blob(hair, 0.16, 0.26, 0.09, 0, 1.0, -0.1),
      );
      return g;
    }),
  );
  const head = new Group();
  head.position.y = 1.2;
  head.add(
    kit.bake('lumi-head', () => {
      const g = new Group();
      g.add(
        kit.blob(skin, 0.155, 0.16, 0.15, 0, 0, 0),
        kit.blob(hair, 0.17, 0.16, 0.16, 0, 0.035, -0.035),
        kit.blob(hair, 0.15, 0.06, 0.1, 0, 0.1, 0.07),
        kit.blob(hair, 0.06, 0.13, 0.07, -0.13, -0.06, -0.02),
        kit.blob(hair, 0.06, 0.13, 0.07, 0.13, -0.06, -0.02),
        kit.blob(kit.mat('#f27aa8'), 0.04, 0.04, 0.03, 0.12, 0.12, 0.06),
        kit.blob(kit.mat('#ffd34d'), 0.015, 0.015, 0.015, 0.12, 0.12, 0.09),
        kit.blob(kit.mat('#c2410c', { roughness: 0.5 }), 0.03, 0.012, 0.01, 0, -0.075, 0.145),
      );
      for (const side of [-1, 1]) {
        g.add(
          kit.blob(kit.mat('#ffffff'), 0.03, 0.034, 0.015, side * 0.055, -0.005, 0.135),
          kit.blob(
            kit.mat('#3a6fd8', { roughness: 0.3 }),
            0.022,
            0.026,
            0.012,
            side * 0.055,
            -0.008,
            0.145,
          ),
          kit.blob(
            kit.mat('#16264f', { roughness: 0.2 }),
            0.011,
            0.013,
            0.01,
            side * 0.055,
            -0.008,
            0.153,
          ),
          kit.blob(kit.mat('#ffffff'), 0.006, 0.006, 0.005, side * 0.055 + 0.008, 0.004, 0.158),
          kit.blob(kit.mat('#ff9fb2'), 0.028, 0.016, 0.01, side * 0.09, -0.05, 0.12),
        );
      }
      return g;
    }),
  );
  body.add(head);

  const wingMaterial = kit.mat('#d9f4ff', {
    emissive: '#8fd0ff',
    emissiveIntensity: 0.5,
    transparent: true,
    opacity: 0.5,
    side: DoubleSide,
    depthWrite: false,
    roughness: 0.2,
  });
  const upper = wingShape(0.46, 0.28, 0.2);
  const lower = wingShape(0.32, 0.15, -0.12);
  const wings: Mesh[] = [];
  for (const side of [-1, 1])
    for (const geometry of [upper, lower]) {
      const wing = new Mesh(geometry, wingMaterial);
      wing.position.set(side * 0.03, 0.92, -0.1);
      wing.scale.x = side;
      wing.rotation.y = side * 0.5;
      wings.push(wing);
      body.add(wing);
    }

  const arms: Group[] = [];
  for (const side of [-1, 1]) {
    const shoulder = new Group();
    shoulder.position.set(side * 0.11, 0.97, 0);
    shoulder.add(
      kit.bake('lumi-arm', () => {
        const g = new Group();
        g.add(
          kit.rod(skin, v(0, 0, 0), v(0, -0.28, 0), 0.03, 0.026),
          kit.blob(skin, 0.036, 0.036, 0.036, 0, -0.3, 0),
        );
        return g;
      }),
    );
    shoulder.rotation.z = side * 0.25;
    arms.push(shoulder);
    body.add(shoulder);
  }
  // The basket arm reaches forward to hold it.
  arms[0].rotation.x = -0.7;
  arms[0].rotation.z = -0.15;
  const basket = buildBasket(kit);
  basket.root.position.set(-0.13, 0.62, 0.26);
  body.add(basket.root);
  return { root, body, head, wings, arms, basket: basket.root, basketItems: basket.items };
}
