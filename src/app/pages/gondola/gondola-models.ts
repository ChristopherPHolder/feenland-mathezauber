import {
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  Material,
  Matrix3,
  Mesh,
  MeshStandardMaterial,
  MeshStandardMaterialParameters,
  Object3D,
  OctahedronGeometry,
  Shape,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector3,
} from 'three';
import { TextLabel } from '../../shared/three/labels';
import { GOLDEN, SEAT_FIRST, SEAT_SECOND } from './gondola-frame';

/**
 * The Mountain Gondola's characters and cabins, shared by the mountain world and the loading
 * scene: bunnies with real rabbit proportions, Gusti the mountain goat in his conductor's cap,
 * and the gondola cabin with two rows of five seats.
 *
 * Every shape and material lives in a `Kit`, one per world, so a cabin or bunny that leaves the
 * scene can be dropped without freeing what the others still use; the kit frees it all at once.
 */

const UP = new Vector3(0, 1, 0);

/** One cross-section of a lofted shape: its centre on the spine and its half width and depth. */
interface Ring {
  readonly y: number;
  readonly z: number;
  readonly rx: number;
  readonly ry: number;
}

/** Skins a row of elliptical rings on a spine in the y-z plane into one smooth surface. */
function loft(rings: readonly Ring[], segments = 18): BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  rings.forEach((ring, index) => {
    const before = rings[Math.max(0, index - 1)];
    const after = rings[Math.min(rings.length - 1, index + 1)];
    const length = Math.hypot(after.y - before.y, after.z - before.z) || 1;
    const ny = -(after.z - before.z) / length;
    const nz = (after.y - before.y) / length;
    for (let step = 0; step < segments; step++) {
      const angle = (step / segments) * Math.PI * 2;
      const across = Math.cos(angle) * ring.rx;
      const along = Math.sin(angle) * ring.ry;
      positions.push(across, ring.y + ny * along, ring.z + nz * along);
    }
  });
  for (let ring = 0; ring < rings.length - 1; ring++)
    for (let step = 0; step < segments; step++) {
      const a = ring * segments + step;
      const b = ring * segments + ((step + 1) % segments);
      indices.push(a, a + segments, b, b, a + segments, b + segments);
    }
  const first = rings[0];
  const last = rings[rings.length - 1];
  const start = positions.length / 3;
  positions.push(0, first.y, first.z, 0, last.y, last.z);
  const tail = (rings.length - 1) * segments;
  for (let step = 0; step < segments; step++) {
    const next = (step + 1) % segments;
    indices.push(start, step, next, start + 1, tail + next, tail + step);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** A rounded box: a rounded rectangle extruded with a soft bevel, centred on its origin. */
function roundedBox(width: number, height: number, depth: number, radius: number) {
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
    depth: depth - 2 * bevel,
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

/** Shapes and materials one world shares between all its bunnies, goats and cabins. */
export class Kit {
  readonly ball = new SphereGeometry(1, 18, 14);
  readonly smallBall = new SphereGeometry(1, 10, 8);
  /** An ellipsoid that grows up from its base, for ears and locks. */
  readonly ear = new SphereGeometry(1, 14, 10).translate(0, 1, 0);
  readonly hemisphere = new SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  readonly cylinder = new CylinderGeometry(1, 1, 1, 14);
  readonly cone = new ConeGeometry(1, 1, 12);
  readonly sparkle = new OctahedronGeometry(1);
  readonly scarf = new TorusGeometry(0.085, 0.03, 8, 22);
  readonly brim = new TorusGeometry(0.1, 0.022, 8, 22);
  readonly crown = new CylinderGeometry(0.07, 0.078, 0.06, 18, 1, true);
  readonly horn = new TorusGeometry(0.14, 0.028, 8, 18, Math.PI * 0.95);
  readonly capBand = new TorusGeometry(0.128, 0.018, 8, 24);
  readonly bunnyBody = loft(BUNNY_BODY);
  readonly goatBody = loft(GOAT_BODY);
  readonly goatNeck = loft(GOAT_NECK);
  readonly goatHead = loft(GOAT_HEAD);
  readonly cabinShell = roundedBox(CABIN.width, CABIN.height - 0.5, CABIN.depth, 0.32);
  readonly cabinRoof = roundedBox(CABIN.width + 0.16, 0.3, CABIN.depth + 0.14, 0.14);
  readonly cabinFloor = roundedBox(CABIN.width + 0.06, 0.26, CABIN.depth + 0.06, 0.12);
  readonly cabinBench = roundedBox(CABIN.seat * 5 + 0.1, 0.16, 0.42, 0.06);
  readonly cabinSeat = roundedBox(CABIN.seat - 0.06, 0.1, 0.36, 0.05);
  readonly cabinDoor = roundedBox(CABIN.width / 2 - 0.06, CABIN.height - 0.62, 0.05, 0.12);
  readonly tarp = roundedBox(CABIN.width - 0.08, CABIN.height - 0.66, 0.16, 0.2);
  private readonly materials = new Map<string, MeshStandardMaterial>();
  private readonly baked = new Map<string, BufferGeometry>();
  /** The material for baked parts: their colours live in the vertices. */
  readonly painted = new MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });

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
        if (
          object instanceof Mesh &&
          object.geometry instanceof CylinderGeometry &&
          object.geometry !== this.cylinder
        )
          object.geometry.dispose();
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

  /** An ellipsoid from the shared ball. */
  blob(material: Material, rx: number, ry: number, rz: number, x = 0, y = 0, z = 0) {
    const mesh = new Mesh(this.ball, material);
    mesh.scale.set(rx, ry, rz);
    mesh.position.set(x, y, z);
    return mesh;
  }

  /** A tapered rod from one point to another, for legs, posts and hanger arms. */
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

  dispose() {
    for (const value of Object.values(this)) if (value instanceof BufferGeometry) value.dispose();
    for (const material of this.materials.values()) material.dispose();
    this.materials.clear();
    for (const geometry of this.baked.values()) geometry.dispose();
    this.baked.clear();
    this.painted.dispose();
  }
}

// ---------------------------------------------------------------------------------------------
// Bunnies

/** The torso of a sitting rabbit, from the round rump up to the neck. */
const BUNNY_BODY: readonly Ring[] = [
  { y: 0.05, z: -0.2, rx: 0.02, ry: 0.02 },
  { y: 0.07, z: -0.19, rx: 0.11, ry: 0.09 },
  { y: 0.12, z: -0.15, rx: 0.17, ry: 0.13 },
  { y: 0.18, z: -0.08, rx: 0.185, ry: 0.15 },
  { y: 0.25, z: -0.01, rx: 0.16, ry: 0.14 },
  { y: 0.31, z: 0.05, rx: 0.12, ry: 0.11 },
  { y: 0.36, z: 0.08, rx: 0.09, ry: 0.085 },
  { y: 0.4, z: 0.1, rx: 0.02, ry: 0.02 },
];

export interface BunnyLook {
  readonly fur: string;
  readonly belly: string;
  readonly scarf: string;
  /** A knit hat colour, or null for bare ears. */
  readonly hat: string | null;
  /** The VIP wears a golden crown and a purple cape. */
  readonly crown?: boolean;
}

const FURS: readonly (readonly [string, string])[] = [
  ['#f4ece2', '#fffaf3'],
  ['#d8bfa0', '#f5e7d4'],
  ['#c9cdd8', '#eef0f5'],
  ['#b99a7f', '#ead8c6'],
  ['#fbfbfb', '#ffffff'],
  ['#e8cfc4', '#fbeee8'],
  ['#a9a3a0', '#e3dedb'],
];
const SCARVES = ['#e0457b', '#3d8fe0', '#3fa65a', '#e89a1c', '#8a5cc7', '#1f9e95', '#d94a3a'];
const HATS = ['#e0457b', '#3d8fe0', '#f4b740', '#3fa65a'];

/** A varied, stable look for bunny number `index`. */
export function bunnyLook(index: number, crown = false): BunnyLook {
  const [fur, belly] = FURS[(index * 3) % FURS.length];
  return {
    fur,
    belly,
    scarf: SCARVES[(index * 5 + 2) % SCARVES.length],
    hat: index % 3 === 1 ? HATS[index % HATS.length] : null,
    crown,
  };
}

/**
 * A sitting rabbit, about 0.86 tall to the ear tips, facing +z: a pear-shaped body with big
 * haunches, long hind feet, small forepaws, a round head with cheeks, tall ears that bounce,
 * a fluffy tail, and a scarf (plus a knit hat or the VIP's crown).
 */
export class Bunny {
  readonly root = new Group();
  /** Everything above the feet: it squashes and stretches on a hop. */
  readonly body = new Group();
  readonly head = new Group();
  readonly ears: readonly Object3D[];
  /** The right forepaw, which waves. */
  readonly paw = new Group();
  readonly look: BunnyLook;

  constructor(kit: Kit, look: BunnyLook) {
    this.look = look;
    const key = `${look.fur}|${look.belly}|${look.scarf}|${look.hat}|${!!look.crown}`;
    // Each part is baked into one vertex-coloured mesh, shared by every bunny with the same look.
    const body = kit.bake(`bunny-body|${key}`, () => {
      const fur = kit.mat(look.fur);
      const belly = kit.mat(look.belly);
      const scarf = kit.mat(look.scarf);
      const parts = new Group();
      const knot = new Mesh(kit.scarf, scarf);
      knot.position.set(0, 0.355, 0.075);
      knot.rotation.x = Math.PI / 2 - 0.4;
      parts.add(
        new Mesh(kit.bunnyBody, fur),
        kit.blob(belly, 0.1, 0.12, 0.07, 0, 0.24, 0.07),
        // Haunches: the strong back legs folded under the body.
        kit.blob(fur, 0.085, 0.11, 0.135, -0.115, 0.12, -0.06),
        kit.blob(fur, 0.085, 0.11, 0.135, 0.115, 0.12, -0.06),
        kit.blob(kit.mat('#ffffff'), 0.065, 0.06, 0.06, 0, 0.13, -0.21),
        // The left foreleg, slim and straight down to a small paw.
        kit.rod(
          fur,
          new Vector3(-0.06, 0.25, 0.07),
          new Vector3(-0.055, 0.04, 0.115),
          0.033,
          0.026,
        ),
        kit.blob(fur, 0.034, 0.024, 0.045, -0.055, 0.025, 0.125),
        // A knitted scarf with one end hanging down the chest.
        knot,
        kit.blob(scarf, 0.032, 0.075, 0.016, 0.05, 0.29, 0.15),
      );
      // The VIP's purple cape over the back.
      if (look.crown) parts.add(kit.blob(kit.mat('#7950b0'), 0.15, 0.17, 0.05, 0, 0.24, -0.1));
      return parts;
    });
    body.castShadow = true;
    this.body.add(body);
    // Long hind feet flat on the ground, toes forward.
    this.root.add(
      kit.bake(`bunny-feet|${look.fur}`, () => {
        const fur = kit.mat(look.fur);
        return new Group().add(
          kit.blob(fur, 0.05, 0.028, 0.12, -0.12, 0.028, 0.02),
          kit.blob(fur, 0.05, 0.028, 0.12, 0.12, 0.028, 0.02),
        );
      }),
    );
    this.paw.position.set(0.06, 0.25, 0.07);
    this.paw.add(
      kit.bake(`bunny-paw|${look.fur}`, () => {
        const fur = kit.mat(look.fur);
        return new Group().add(
          kit.rod(fur, new Vector3(0, 0, 0), new Vector3(-0.005, -0.21, 0.045), 0.033, 0.026),
          kit.blob(fur, 0.034, 0.024, 0.045, -0.005, -0.225, 0.055),
        );
      }),
    );
    this.body.add(this.paw);

    // The head: round skull, cheeks and muzzle, a pink nose, bright eyes, and a knit hat.
    this.head.position.set(0, 0.44, 0.12);
    this.head.add(
      kit.bake(`bunny-head|${key}`, () => {
        const fur = kit.mat(look.fur);
        const belly = kit.mat(look.belly);
        const dark = kit.mat('#2a2030');
        const white = kit.mat('#ffffff');
        const parts = new Group().add(
          kit.blob(fur, 0.118, 0.105, 0.125, 0, 0.01, 0.02),
          kit.blob(belly, 0.052, 0.042, 0.05, -0.034, -0.03, 0.11),
          kit.blob(belly, 0.052, 0.042, 0.05, 0.034, -0.03, 0.11),
          kit.blob(kit.mat('#f2a5b8'), 0.022, 0.016, 0.016, 0, -0.005, 0.15),
        );
        for (const side of [-1, 1])
          parts.add(
            kit.blob(dark, 0.024, 0.027, 0.02, side * 0.072, 0.03, 0.09),
            kit.blob(white, 0.008, 0.008, 0.006, side * 0.072 + 0.008, 0.041, 0.104),
          );
        if (look.hat && !look.crown) {
          const hat = new Mesh(kit.hemisphere, kit.mat(look.hat));
          hat.scale.set(0.112, 0.085, 0.118);
          hat.position.set(0, 0.065, 0.0);
          const brim = new Mesh(kit.brim, white);
          brim.scale.set(1.12, 1.15, 1);
          brim.rotation.x = Math.PI / 2;
          brim.position.set(0, 0.07, 0.0);
          parts.add(hat, brim, kit.blob(white, 0.035, 0.035, 0.035, 0, 0.16, -0.02));
        }
        return parts;
      }),
    );
    const ears: Object3D[] = [];
    for (const side of [-1, 1]) {
      const ear = new Group();
      ear.position.set(side * 0.045, 0.08, -0.01);
      ear.rotation.set(-0.22, 0, -side * 0.16);
      ear.add(
        kit.bake(`bunny-ear|${look.fur}`, () => {
          const outer = new Mesh(kit.ear, kit.mat(look.fur));
          outer.scale.set(0.042, 0.15, 0.022);
          const inner = new Mesh(kit.ear, kit.mat('#f2a5b8'));
          inner.scale.set(0.026, 0.125, 0.012);
          inner.position.set(0, 0.025, 0.012);
          return new Group().add(outer, inner);
        }),
      );
      ears.push(ear);
      this.head.add(ear);
    }
    this.ears = ears;
    this.body.add(this.head);

    if (look.crown) {
      // The VIP's golden crown stays shiny, so it is not baked.
      const gold = kit.mat(GOLDEN, {
        metalness: 0.7,
        roughness: 0.25,
        emissive: '#7a5200',
        emissiveIntensity: 0.5,
      });
      const crown = new Group();
      crown.position.set(0, 0.1, 0);
      crown.scale.setScalar(1.7);
      crown.add(new Mesh(kit.crown, gold));
      for (let point = 0; point < 5; point++) {
        const angle = (point / 5) * Math.PI * 2 + Math.PI / 2;
        const spike = new Mesh(kit.cone, gold);
        spike.scale.set(0.02, 0.055, 0.02);
        spike.position.set(Math.cos(angle) * 0.072, 0.055, Math.sin(angle) * 0.072);
        crown.add(spike);
      }
      crown.add(
        kit.blob(
          kit.mat('#e0457b', { emissive: '#e0457b', emissiveIntensity: 0.4 }),
          0.018,
          0.018,
          0.012,
          0,
          0.01,
          0.078,
        ),
      );
      this.head.add(crown);
    }
    this.root.add(this.body);
  }
}

// ---------------------------------------------------------------------------------------------
// Gusti the goat

const GOAT_BODY: readonly Ring[] = [
  { y: 0.8, z: -0.5, rx: 0.05, ry: 0.05 },
  { y: 0.8, z: -0.46, rx: 0.19, ry: 0.19 },
  { y: 0.79, z: -0.32, rx: 0.25, ry: 0.26 },
  { y: 0.78, z: -0.06, rx: 0.26, ry: 0.27 },
  { y: 0.8, z: 0.18, rx: 0.24, ry: 0.27 },
  { y: 0.85, z: 0.34, rx: 0.19, ry: 0.22 },
  { y: 0.9, z: 0.43, rx: 0.1, ry: 0.11 },
  { y: 0.92, z: 0.46, rx: 0.03, ry: 0.03 },
];
const GOAT_NECK: readonly Ring[] = [
  { y: 0.84, z: 0.26, rx: 0.12, ry: 0.15 },
  { y: 0.98, z: 0.38, rx: 0.11, ry: 0.13 },
  { y: 1.12, z: 0.47, rx: 0.09, ry: 0.1 },
  { y: 1.2, z: 0.51, rx: 0.03, ry: 0.03 },
];
/** The goat's long face, from the poll down to the soft muzzle. */
const GOAT_HEAD: readonly Ring[] = [
  { y: 0.07, z: -0.08, rx: 0.03, ry: 0.03 },
  { y: 0.06, z: -0.05, rx: 0.105, ry: 0.1 },
  { y: 0.02, z: 0.04, rx: 0.1, ry: 0.095 },
  { y: -0.05, z: 0.14, rx: 0.075, ry: 0.075 },
  { y: -0.11, z: 0.22, rx: 0.062, ry: 0.06 },
  { y: -0.14, z: 0.26, rx: 0.02, ry: 0.02 },
];

/** One leg: a hip or shoulder pivot, a knee or hock pivot, and a hoof. */
interface Leg {
  readonly hip: Group;
  readonly knee: Group;
}

/**
 * Gusti, the mountain goat who runs the gondola: a deep barrel body, four jointed legs with
 * dark hooves, a long face with a beard, swept-back horns and a navy conductor's cap.
 * About 1.45 tall to the cap, facing +z.
 */
export class Goat {
  readonly root = new Group();
  readonly body = new Group();
  readonly head = new Group();
  readonly legs: readonly Leg[];
  /** The front right leg: it waves cabins off and taps empty seats. */
  readonly waveLeg: Leg;

  constructor(kit: Kit) {
    const coat = kit.mat('#f4efe7');
    const saddle = kit.mat('#d6c8b4');
    const hoof = kit.mat('#3b3030', { roughness: 0.5 });
    const horn = kit.mat('#b9a27f', { roughness: 0.5 });
    const torso = new Mesh(kit.goatBody, coat);
    torso.castShadow = true;
    const neck = new Mesh(kit.goatNeck, coat);
    neck.castShadow = true;
    this.body.add(
      torso,
      neck,
      kit.blob(saddle, 0.2, 0.08, 0.3, 0, 1.0, -0.1),
      kit.blob(coat, 0.05, 0.09, 0.04, 0, 0.95, -0.5),
    );

    // Head: long face, amber eyes, floppy ears, horns, beard and the conductor's cap.
    this.head.position.set(0, 1.2, 0.52);
    const face = new Mesh(kit.goatHead, coat);
    face.castShadow = true;
    this.head.add(face, kit.blob(kit.mat('#c9a19a'), 0.055, 0.04, 0.03, 0, -0.13, 0.25));
    const amber = kit.mat('#d99a2b', { roughness: 0.3 });
    const pupil = kit.mat('#1d1712');
    for (const side of [-1, 1]) {
      const eye = kit.blob(amber, 0.03, 0.028, 0.03, side * 0.088, 0.03, 0.05);
      eye.add(kit.blob(pupil, 0.9, 0.35, 0.5, side * 0.35, 0, 0.6));
      const ear = kit.blob(coat, 0.11, 0.032, 0.05, side * 0.14, 0.04, -0.03);
      ear.rotation.z = side * -0.45;
      const curl = new Mesh(kit.horn, horn);
      curl.position.set(side * 0.06, 0.12, -0.02);
      curl.rotation.set(0, Math.PI / 2, Math.PI * 0.45);
      this.head.add(eye, ear, curl);
    }
    const beard = new Mesh(kit.cone, kit.mat('#e6ddd0'));
    beard.scale.set(0.04, 0.17, 0.04);
    beard.rotation.x = Math.PI;
    beard.position.set(0, -0.22, 0.17);
    this.head.add(beard);
    const navy = kit.mat('#263a7a', { roughness: 0.6 });
    const cap = new Mesh(kit.cylinder, navy);
    cap.scale.set(0.125, 0.09, 0.13);
    cap.position.set(0, 0.15, 0.0);
    const crownTop = new Mesh(kit.cylinder, navy);
    crownTop.scale.set(0.145, 0.03, 0.15);
    crownTop.position.set(0, 0.2, -0.005);
    const visor = kit.blob(kit.mat('#1a2550', { roughness: 0.3 }), 0.11, 0.014, 0.08, 0, 0.11, 0.1);
    const band = new Mesh(kit.capBand, kit.mat('#ffd23f', { metalness: 0.5, roughness: 0.3 }));
    band.rotation.x = Math.PI / 2;
    band.position.set(0, 0.13, 0);
    band.scale.set(1, 1.03, 1);
    const badge = kit.blob(
      kit.mat('#ffd23f', { metalness: 0.6, roughness: 0.3 }),
      0.022,
      0.022,
      0.01,
      0,
      0.16,
      0.13,
    );
    this.head.add(cap, crownTop, visor, band, badge);
    this.body.add(this.head);

    // Four legs with knees and hooves.
    const legs: Leg[] = [];
    for (const [x, z] of [
      [-0.15, 0.28],
      [0.15, 0.28],
      [-0.15, -0.32],
      [0.15, -0.32],
    ]) {
      const hip = new Group();
      hip.position.set(x, 0.66, z);
      hip.add(
        kit.blob(coat, 0.075, 0.12, 0.09, 0, -0.04, 0),
        kit.rod(coat, new Vector3(0, 0, 0), new Vector3(0, -0.3, 0), 0.06, 0.045),
      );
      const knee = new Group();
      knee.position.set(0, -0.3, 0);
      const toe = new Mesh(kit.cylinder, hoof);
      toe.position.set(0, -0.32, 0.01);
      toe.scale.set(0.042, 0.06, 0.05);
      knee.add(kit.rod(coat, new Vector3(0, 0, 0), new Vector3(0, -0.3, 0), 0.042, 0.035), toe);
      hip.add(knee);
      this.body.add(hip);
      legs.push({ hip, knee });
    }
    this.legs = legs;
    this.waveLeg = legs[1];
    this.root.add(this.body);
  }
}

// ---------------------------------------------------------------------------------------------
// The cabin

/** Cabin size in its own units: it hangs from its grip, `height + hanger` above its floor. */
export const CABIN = {
  width: 2.5,
  height: 2.1,
  depth: 1.3,
  hanger: 0.85,
  seat: 0.45,
  /** Scale of a seated bunny inside a full-size cabin. */
  rider: 0.72,
} as const;

const TOP_ROW_Y = 1.02;
const BOTTOM_ROW_Y = 0.27;

/** Where seat `index` (0–4 the upper row, 5–9 the lower row) is, in cabin units. */
export function seatSpot(index: number): Vector3 {
  const row = index < 5 ? 0 : 1;
  const column = index % 5;
  return new Vector3(
    (column - 2) * CABIN.seat,
    row === 0 ? TOP_ROW_Y + 0.06 : BOTTOM_ROW_Y + 0.06,
    row === 0 ? -0.3 : 0.12,
  );
}

export interface CabinOptions {
  readonly color: string;
}

/**
 * A rounded gondola cabin hanging from its grip on the cable: coloured shell and roof, glass
 * front with two sliding doors, and two benches of five seats inside, the upper row pink and
 * the lower row blue with a clear gap between them, like a ten-frame. A tag above the roof
 * shows "10" or a count; it can turn golden, wear golden edges, a snow tarp or big-cabin flags.
 */
export class Cabin {
  /** The grip point on the cable; position this. */
  readonly root = new Group();
  /** The cabin under its hanger: it swings. */
  readonly body = new Group();
  /** Where each seated bunny sits, as children of the body. */
  readonly seats: readonly Group[];
  readonly label = new TextLabel('', {
    fill: '#ffffff',
    border: '#16264f',
    width: 224,
    height: 160,
    radius: 0.35,
  });
  readonly tag: Sprite;
  private readonly kit: Kit;
  private readonly shell: Mesh;
  private readonly roof: Mesh;
  private readonly floor: Mesh;
  private readonly seatMeshes: Mesh[] = [];
  private readonly sideWalls: Mesh[] = [];
  private readonly doors: readonly Group[];
  private readonly tarp: Group;
  private readonly flags: Group;
  private readonly sparkles: Mesh[] = [];
  private readonly bell: Mesh;
  private color: string;
  private golden = false;
  private fresh = false;
  /** 0 open, 1 shut. */
  private doorShut = 1;

  constructor(kit: Kit, options: CabinOptions) {
    this.kit = kit;
    this.color = options.color;
    const { width, height, depth, hanger } = CABIN;
    this.body.position.y = -(height + hanger);
    const paint = kit.mat(options.color, { roughness: 0.45 });
    // The shell is the back half: a rounded wall the seats stand against.
    this.shell = new Mesh(kit.cabinShell, paint);
    this.shell.scale.set(1, 1, 0.2);
    this.shell.position.set(0, (height - 0.5) / 2 + 0.25, -depth / 2 + 0.13);
    this.shell.castShadow = true;
    this.floor = new Mesh(kit.cabinFloor, paint);
    this.floor.position.set(0, 0.13, 0);
    this.floor.castShadow = true;
    this.roof = new Mesh(kit.cabinRoof, paint);
    this.roof.position.set(0, height - 0.12, 0);
    this.roof.castShadow = true;
    const dome = new Mesh(kit.hemisphere, paint);
    dome.scale.set(width * 0.36, 0.22, depth * 0.42);
    dome.position.set(0, height + 0.02, 0);
    this.body.add(this.shell, this.floor, this.roof, dome);

    // Corner pillars, so the open front still reads as a cabin.
    const white = kit.mat('#f7f7f2', { roughness: 0.5 });
    for (const x of [-1, 1])
      for (const z of [-1, 1]) {
        const post = new Mesh(kit.cylinder, z > 0 ? paint : white);
        post.scale.set(0.07, height - 0.3, 0.07);
        post.position.set(x * (width / 2 - 0.08), height / 2, z * (depth / 2 - 0.08));
        this.body.add(post);
      }
    // Side walls with a round window each, so the cabin reads as a closed gondola.
    const glassSide = kit.mat('#bfe6ff', {
      roughness: 0.1,
      metalness: 0.1,
      emissive: '#5aa9d6',
      emissiveIntensity: 0.15,
    });
    for (const side of [-1, 1]) {
      const wall = new Mesh(kit.cabinShell, paint);
      wall.rotation.y = Math.PI / 2;
      wall.scale.set(depth / width, 1, 0.1);
      wall.position.set(side * (width / 2 - 0.04), (height - 0.5) / 2 + 0.25, 0);
      wall.castShadow = true;
      const pane = kit.blob(glassSide, 0.02, 0.32, 0.34, side * (width / 2 + 0.03), 1.3, 0);
      this.sideWalls.push(wall);
      this.body.add(wall, pane);
    }

    // Benches: the upper row sits high at the back, the lower row low at the front.
    const bench = kit.mat('#8b5a2b', { roughness: 0.8 });
    const upper = new Mesh(kit.cabinBench, bench);
    upper.scale.set(1, 4.6, 1);
    upper.position.set(0, TOP_ROW_Y - 0.38, -0.3);
    const lower = new Mesh(kit.cabinBench, bench);
    lower.position.set(0, BOTTOM_ROW_Y - 0.02, 0.12);
    this.body.add(upper, lower);
    const seats: Group[] = [];
    for (let index = 0; index < 10; index++) {
      const spot = seatSpot(index);
      const cushion = new Mesh(kit.cabinSeat, this.seatMaterial(index, false));
      cushion.position.set(spot.x, spot.y - 0.04, spot.z);
      this.seatMeshes.push(cushion);
      const anchor = new Group();
      anchor.position.copy(spot);
      anchor.position.z += 0.02;
      this.body.add(cushion, anchor);
      seats.push(anchor);
    }
    this.seats = seats;

    // Glass doors across the front that slide apart to let bunnies in.
    const glass = kit.mat('#dff3ff', { transparent: true, opacity: 0.16, roughness: 0.05 });
    const doors: Group[] = [];
    for (const side of [-1, 1]) {
      const door = new Group();
      const leaf = new Group();
      const pane = new Mesh(kit.cabinDoor, glass);
      const frame = new Mesh(kit.cabinDoor, paint);
      frame.scale.set(1.0, 0.06, 1.4);
      frame.position.y = -(height - 0.62) / 2;
      const top = frame.clone();
      top.position.y = (height - 0.62) / 2;
      const edge = new Mesh(kit.cylinder, paint);
      edge.scale.set(0.035, height - 0.62, 0.035);
      edge.position.x = -side * (width / 4 - 0.04);
      leaf.add(pane, frame, top, edge);
      // The leaf hangs from the cabin's outer corner and folds toward it to open.
      leaf.position.x = -side * (width / 4 - 0.03);
      door.add(leaf);
      door.position.set(side * (width / 2 - 0.06), height / 2 + 0.06, depth / 2 + 0.01);
      doors.push(door);
      this.body.add(door);
    }
    this.doors = doors;

    // The hanger arm and the grip that clamps the cable.
    const steel = kit.mat('#5d6675', { metalness: 0.6, roughness: 0.4 });
    this.body.add(
      kit.rod(
        steel,
        new Vector3(0, height + 0.1, 0),
        new Vector3(0, height + hanger - 0.12, 0),
        0.06,
      ),
      kit.rod(
        steel,
        new Vector3(0, height + hanger - 0.14, 0),
        new Vector3(0.18, height + hanger, 0),
        0.05,
      ),
    );
    const grip = new Mesh(kit.cylinder, kit.mat('#3a4250', { metalness: 0.5, roughness: 0.4 }));
    grip.scale.set(0.16, 0.12, 0.16);
    grip.rotation.x = Math.PI / 2;
    this.root.add(grip);

    // The tag: "10" for a full cabin, or the count where the bunnies are hidden.
    this.tag = new Sprite(
      new SpriteMaterial({
        map: this.label.texture,
        transparent: true,
        depthWrite: false,
        depthTest: false,
      }),
    );
    this.tag.scale.set(0.95, 0.68, 1);
    this.tag.position.set(-0.75, height + 0.42, depth / 2);
    this.tag.renderOrder = 20;
    this.tag.visible = false;
    this.body.add(this.tag);

    // A snow tarp over the front: the bunnies hide, the tag still counts them.
    this.tarp = new Group();
    const cloth = new Mesh(kit.tarp, kit.mat('#f6fbff', { roughness: 0.95 }));
    cloth.position.set(0, height / 2 + 0.04, depth / 2 + 0.06);
    const rope = kit.mat('#b98a5a');
    for (const x of [-0.7, 0, 0.7]) {
      const tie = new Mesh(kit.cylinder, rope);
      tie.scale.set(0.025, height - 0.62, 0.025);
      tie.position.set(x, height / 2 + 0.04, depth / 2 + 0.15);
      this.tarp.add(tie);
    }
    for (const [x, y, s] of [
      [-0.5, 1.6, 0.16],
      [0.4, 1.35, 0.12],
      [0.1, 0.8, 0.14],
      [-0.75, 0.55, 0.1],
    ])
      this.tarp.add(kit.blob(kit.mat('#ffffff'), s, s * 0.6, 0.05, x, y, depth / 2 + 0.16));
    this.tarp.add(cloth);
    this.tarp.visible = false;
    this.body.add(this.tarp);

    // Big-cabin bunting along the roof, and a golden bell for the express.
    this.flags = new Group();
    const flagColors = ['#e0457b', '#ffd23f', '#3d8fe0', '#3fa65a', '#8a5cc7'];
    for (let index = 0; index < 9; index++) {
      const flag = new Mesh(kit.cone, kit.mat(flagColors[index % flagColors.length]));
      flag.scale.set(0.1, 0.2, 0.02);
      flag.rotation.z = Math.PI;
      const x = -width / 2 + 0.12 + (index * (width - 0.24)) / 8;
      flag.position.set(x, height - 0.38 - Math.sin((index / 8) * Math.PI) * 0.1, depth / 2 + 0.1);
      this.flags.add(flag);
    }
    const star = new Mesh(
      kit.sparkle,
      kit.mat('#ffd23f', { emissive: '#ffb800', emissiveIntensity: 0.6 }),
    );
    star.scale.set(0.16, 0.2, 0.06);
    star.position.set(0.55, height + 0.3, 0.2);
    this.flags.add(star);
    this.flags.visible = false;
    this.body.add(this.flags);
    this.bell = new Mesh(
      kit.hemisphere,
      kit.mat(GOLDEN, { metalness: 0.8, roughness: 0.2, emissive: '#7a5200' }),
    );
    this.bell.scale.set(0.14, -0.2, 0.14);
    this.bell.position.set(0.5, height + 0.42, 0);
    this.bell.visible = false;
    this.body.add(this.bell);
    for (let index = 0; index < 7; index++) {
      const glint = new Mesh(
        kit.sparkle,
        kit.mat('#fff6bf', { emissive: '#ffe066', emissiveIntensity: 1 }),
      );
      glint.scale.setScalar(0.07);
      glint.visible = false;
      this.body.add(glint);
      this.sparkles.push(glint);
    }
    this.root.add(this.body);
  }

  private seatMaterial(index: number, glow: boolean) {
    const color = index < 5 ? SEAT_FIRST : SEAT_SECOND;
    return glow
      ? this.kit.mat('#fff3b0', { emissive: '#ffc400', emissiveIntensity: 1.4 })
      : this.kit.mat(color, { roughness: 0.9 });
  }

  /** Shows the tag text, or hides the tag for ''. */
  setTag(text: string, screenSize = 0) {
    this.label.update(text);
    this.tag.visible = text !== '';
    this.tag.material.sizeAttenuation = screenSize === 0;
    if (screenSize) this.tag.scale.set(screenSize * 1.4, screenSize, 1);
    else this.tag.scale.set(0.95, 0.68, 1);
    this.tag.material.needsUpdate = true;
  }

  setColor(color: string) {
    this.color = color;
    this.paint();
  }

  /** The golden express: the whole cabin turns gold, with a bell and sparkles. */
  setGolden(on: boolean) {
    if (on === this.golden) return;
    this.golden = on;
    this.bell.visible = on;
    for (const glint of this.sparkles) glint.visible = on;
    this.paint();
  }

  /** Golden edges on roof and floor: this full cabin just left. */
  setFresh(on: boolean) {
    if (on === this.fresh) return;
    this.fresh = on;
    this.paint();
  }

  setTarp(on: boolean) {
    this.tarp.visible = on;
  }

  setBig(on: boolean) {
    this.flags.visible = on;
  }

  /** Makes the empty seats (from `filled` on) glow, or stops the glow. */
  glowSeats(filled: number, on: boolean) {
    this.seatMeshes.forEach((seat, index) => {
      seat.material = this.seatMaterial(index, on && index >= filled);
    });
  }

  /** Slides the doors: 0 wide open, 1 shut. A jam holds them part-way and rattles them. */
  setDoor(shut: number, rattle = 0) {
    this.doorShut = shut;
    const open = 1 - shut;
    this.doors.forEach((door, index) => {
      const side = index ? 1 : -1;
      door.scale.x = Math.max(0.12, 1 - open * 0.88);
      door.position.x = side * (CABIN.width / 2 - 0.06) + rattle * side;
    });
  }

  get door() {
    return this.doorShut;
  }

  /** Spins the express sparkles round the cabin. */
  animate(t: number, calm: boolean) {
    if (!this.golden) return;
    this.sparkles.forEach((glint, index) => {
      const angle = (calm ? 0 : t * 1.6) + (index / this.sparkles.length) * Math.PI * 2;
      glint.position.set(
        Math.cos(angle) * (CABIN.width * 0.62),
        CABIN.height * 0.55 + Math.sin(angle * 2 + index) * 0.5,
        Math.sin(angle) * (CABIN.depth * 0.9),
      );
      glint.rotation.y = angle * 2;
    });
  }

  private paint() {
    const kit = this.kit;
    const body = this.golden
      ? kit.mat(GOLDEN, {
          metalness: 0.55,
          roughness: 0.25,
          emissive: '#6b4500',
          emissiveIntensity: 0.35,
        })
      : kit.mat(this.color, { roughness: 0.45 });
    const edge =
      this.fresh || this.golden
        ? kit.mat('#ffcf33', {
            metalness: 0.6,
            roughness: 0.25,
            emissive: '#b37a00',
            emissiveIntensity: 0.6,
          })
        : body;
    this.shell.material = body;
    for (const wall of this.sideWalls) wall.material = body;
    this.roof.material = edge;
    this.floor.material = edge;
  }

  /** Frees what is the cabin's own: its tag texture and sprite material. */
  dispose() {
    this.root.removeFromParent();
    this.label.texture.dispose();
    this.tag.material.dispose();
    this.root.traverse((object) => {
      // Rods are built per cabin; everything else is the kit's.
      if (
        object instanceof Mesh &&
        object.geometry instanceof CylinderGeometry &&
        object.geometry !== this.kit.cylinder
      )
        object.geometry.dispose();
    });
  }
}

/** Frees a bunny's or goat's own rods; the rest belongs to the kit. */
export function disposeFigure(root: Object3D, kit: Kit) {
  root.removeFromParent();
  root.traverse((object) => {
    if (
      object instanceof Mesh &&
      object.geometry instanceof CylinderGeometry &&
      object.geometry !== kit.cylinder
    )
      object.geometry.dispose();
  });
}
