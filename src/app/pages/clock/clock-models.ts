import {
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  LatheGeometry,
  Material,
  Mesh,
  MeshStandardMaterial,
  MeshStandardMaterialParameters,
  Object3D,
  Shape,
  SphereGeometry,
  Vector2,
} from 'three';
import { Critter } from './clock-frame';

/**
 * Shared geometries and materials for the Clock Tower worlds, so every creature and gear reuses
 * the same few buffers. Parts are made from spheres, cones and lathes in the app's soft style.
 */
export class Kit {
  readonly ball = new SphereGeometry(1, 20, 14);
  readonly small = new SphereGeometry(1, 10, 8);
  readonly cone = new ConeGeometry(1, 1, 12);
  readonly cylinder = new CylinderGeometry(1, 1, 1, 16);
  readonly box = new BoxGeometry(1, 1, 1);
  readonly disc = new CircleGeometry(1, 48);
  readonly bell = new LatheGeometry(
    [
      [0, 0.02],
      [0.1, 0.02],
      [0.16, -0.04],
      [0.19, -0.2],
      [0.22, -0.34],
      [0.3, -0.42],
      [0.3, -0.45],
      [0, -0.45],
    ].map(([x, y]) => new Vector2(x, y)),
    28,
  );
  readonly wing = wingGeometry();
  private readonly materials = new Map<string, MeshStandardMaterial>();
  private readonly gears = new Map<number, BufferGeometry>();

  mat(color: string, extra: MeshStandardMaterialParameters = {}): MeshStandardMaterial {
    const key = `${color}|${JSON.stringify(extra)}`;
    let material = this.materials.get(key);
    if (!material) {
      material = new MeshStandardMaterial({ color, roughness: 0.7, ...extra });
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

  /** A flat gear with `teeth` teeth, radius 1, extruded a little. */
  gear(teeth: number): BufferGeometry {
    let geometry = this.gears.get(teeth);
    if (!geometry) {
      const shape = new Shape();
      const steps = teeth * 4;
      for (let index = 0; index <= steps; index++) {
        const angle = (index / steps) * Math.PI * 2;
        const r = index % 4 < 2 ? 1 : 0.84;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        if (index === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
      }
      const hole = new Shape();
      hole.absarc(0, 0, 0.22, 0, Math.PI * 2, true);
      shape.holes.push(hole);
      geometry = new ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: false, curveSegments: 6 });
      this.gears.set(teeth, geometry);
    }
    return geometry;
  }

  dispose() {
    for (const geometry of [
      this.ball,
      this.small,
      this.cone,
      this.cylinder,
      this.box,
      this.disc,
      this.bell,
      this.wing,
    ])
      geometry.dispose();
    for (const geometry of this.gears.values()) geometry.dispose();
    for (const material of this.materials.values()) material.dispose();
  }
}

function wingGeometry(): BufferGeometry {
  const shape = new Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(0.5, 0.35, 1, 0.1);
  shape.quadraticCurveTo(0.8, -0.05, 0.9, -0.25);
  shape.quadraticCurveTo(0.5, -0.1, 0, -0.15);
  shape.lineTo(0, 0);
  return new ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false, curveSegments: 8 });
}

/** One balcony friend: body, head, eyes and the bits that make it who it is. */
export class CritterModel {
  readonly root = new Group();
  /** Leans and bobs; wings and ears hang off it. */
  readonly body = new Group();
  readonly wings: Object3D[] = [];

  constructor(kit: Kit, look: Critter) {
    const fur = kit.mat(look.body, { roughness: 0.85 });
    const accent = kit.mat(look.accent, { roughness: 0.6 });
    const white = kit.mat('#ffffff', { roughness: 0.4 });
    const ink = kit.mat('#2a2350', { roughness: 0.3 });
    const glow = kit.mat(look.accent, { emissive: look.accent, emissiveIntensity: 1.4 });
    this.root.add(this.body);
    const round = ['chick', 'owlet', 'owl', 'bird', 'duck', 'hedgehog'].includes(look.shape);
    // One round body; most friends have the head on top of it.
    this.body.add(kit.blob(fur, 0.5, 0.48, 0.44, 0, 0.48, 0));
    const headY = round ? 0.62 : 0.98;
    if (!round) this.body.add(kit.blob(fur, 0.36, 0.34, 0.34, 0, headY, 0.05));
    const eyeY = round ? 0.66 : headY + 0.04;
    const eyeZ = round ? 0.4 : 0.34;
    for (const side of [-1, 1]) {
      this.body.add(kit.blob(white, 0.11, 0.12, 0.06, side * 0.14, eyeY, eyeZ));
      this.body.add(kit.blob(ink, 0.06, 0.07, 0.04, side * 0.14, eyeY, eyeZ + 0.04));
    }
    const face = round ? 0.5 : headY - 0.08;
    switch (look.shape) {
      case 'chick':
      case 'owlet':
      case 'owl':
      case 'bird': {
        const beak = new Mesh(kit.cone, accent);
        beak.scale.set(0.07, 0.14, 0.07);
        beak.rotation.x = Math.PI / 2 + 0.3;
        beak.position.set(0, face + 0.04, 0.46);
        this.body.add(beak);
        if (look.shape !== 'chick') this.addWings(kit, fur, 0.36, 0.42);
        if (look.shape === 'owlet' || look.shape === 'owl') {
          for (const side of [-1, 1]) {
            const tuft = new Mesh(kit.cone, fur);
            tuft.scale.set(0.09, 0.22, 0.09);
            tuft.position.set(side * 0.24, 0.98, 0);
            tuft.rotation.z = -side * 0.4;
            this.body.add(tuft);
          }
          this.body.add(kit.blob(accent, 0.28, 0.26, 0.12, 0, 0.36, 0.36));
        }
        if (look.shape === 'chick') {
          const comb = new Mesh(kit.cone, accent);
          comb.scale.set(0.08, 0.16, 0.08);
          comb.position.set(0, 0.98, 0.05);
          this.body.add(comb);
        }
        break;
      }
      case 'duck': {
        this.body.add(kit.blob(accent, 0.16, 0.06, 0.16, 0, face, 0.46));
        this.addWings(kit, fur, 0.34, 0.4);
        break;
      }
      case 'mouse':
      case 'bunny':
      case 'cat': {
        for (const side of [-1, 1]) {
          if (look.shape === 'mouse') {
            const ear = kit.blob(fur, 0.17, 0.17, 0.05, side * 0.3, headY + 0.3, 0);
            ear.add(kit.blob(accent, 0.7, 0.7, 0.5, 0, 0, 0.6));
            this.body.add(ear);
          } else if (look.shape === 'bunny') {
            const ear = kit.blob(fur, 0.08, 0.3, 0.06, side * 0.14, headY + 0.48, 0);
            ear.rotation.z = -side * 0.15;
            ear.add(kit.blob(accent, 0.6, 0.8, 0.5, 0, 0, 0.6));
            this.body.add(ear);
          } else {
            const ear = new Mesh(kit.cone, fur);
            ear.scale.set(0.13, 0.22, 0.08);
            ear.position.set(side * 0.2, headY + 0.32, 0);
            ear.rotation.z = -side * 0.25;
            this.body.add(ear);
          }
        }
        this.body.add(kit.blob(accent, 0.05, 0.04, 0.04, 0, headY - 0.04, 0.38));
        if (look.shape === 'cat') {
          const tail = kit.blob(fur, 0.07, 0.36, 0.07, 0.42, 0.42, -0.2);
          tail.rotation.z = -0.7;
          this.body.add(tail);
        }
        break;
      }
      case 'hedgehog': {
        for (let index = 0; index < 14; index++) {
          const spike = new Mesh(kit.cone, kit.mat('#5a3a26'));
          const angle = -1.2 + (index % 7) * 0.4;
          const ring = index < 7 ? 0.95 : 0.6;
          spike.scale.set(0.07, 0.24, 0.07);
          spike.position.set(
            Math.sin(angle) * 0.42 * ring,
            0.5 + Math.cos(angle) * 0.38,
            -0.12 - (index < 7 ? 0 : 0.18),
          );
          spike.rotation.set(-0.5, 0, -angle);
          this.body.add(spike);
        }
        this.body.add(kit.blob(accent, 0.24, 0.22, 0.12, 0, 0.42, 0.36));
        this.body.add(kit.blob(ink, 0.05, 0.05, 0.05, 0, 0.5, 0.5));
        break;
      }
      case 'frog': {
        for (const side of [-1, 1])
          this.body.add(kit.blob(fur, 0.16, 0.16, 0.14, side * 0.16, 0.86, 0.1));
        this.body.add(kit.blob(accent, 0.3, 0.2, 0.16, 0, 0.36, 0.32));
        break;
      }
      case 'dragon': {
        this.addWings(kit, accent, 0.3, 0.62);
        for (const side of [-1, 1]) {
          const horn = new Mesh(kit.cone, accent);
          horn.scale.set(0.06, 0.18, 0.06);
          horn.position.set(side * 0.16, headY + 0.34, -0.02);
          this.body.add(horn);
        }
        this.body.add(kit.blob(accent, 0.24, 0.22, 0.1, 0, 0.42, 0.36));
        break;
      }
      case 'firefly': {
        this.addWings(kit, kit.mat('#dff3ff', { transparent: true, opacity: 0.7 }), 0.3, 0.68);
        this.body.add(kit.blob(glow, 0.3, 0.26, 0.26, 0, 0.24, -0.22));
        for (const side of [-1, 1]) {
          const antenna = kit.blob(ink, 0.025, 0.2, 0.025, side * 0.12, 1.28, 0.05);
          antenna.rotation.z = -side * 0.3;
          this.body.add(antenna);
        }
        break;
      }
      case 'bat': {
        this.addWings(kit, kit.mat('#3e3158'), 0.38, 0.6, 1.4);
        for (const side of [-1, 1]) {
          const ear = new Mesh(kit.cone, fur);
          ear.scale.set(0.11, 0.24, 0.08);
          ear.position.set(side * 0.2, headY + 0.32, 0);
          this.body.add(ear);
        }
        break;
      }
    }
  }

  private addWings(kit: Kit, material: Material, x: number, y: number, size = 0.7) {
    for (const side of [-1, 1]) {
      const pivot = new Group();
      pivot.position.set(side * x, y, -0.05);
      const wing = new Mesh(kit.wing, material);
      wing.scale.set(side * size, size, 1);
      pivot.add(wing);
      this.body.add(pivot);
      this.wings.push(pivot);
    }
  }
}

/** Pip the owl, who keeps the tower clock: a round purple owl with big eyes that blink. */
export class PipModel {
  readonly root = new Group();
  readonly head = new Group();
  readonly lids: Mesh[] = [];
  readonly wings: Object3D[] = [];

  constructor(kit: Kit) {
    const feathers = kit.mat('#8a6bc8', { roughness: 0.85 });
    const belly = kit.mat('#e9dcff', { roughness: 0.9 });
    const white = kit.mat('#ffffff', { roughness: 0.3 });
    const ink = kit.mat('#2a2350', { roughness: 0.3 });
    const beak = kit.mat('#ffb347');
    this.root.add(kit.blob(feathers, 0.5, 0.58, 0.44, 0, 0.58, 0));
    this.root.add(kit.blob(belly, 0.34, 0.4, 0.2, 0, 0.5, 0.3));
    this.head.position.set(0, 1.12, 0);
    this.root.add(this.head);
    this.head.add(kit.blob(feathers, 0.46, 0.4, 0.4, 0, 0, 0));
    for (const side of [-1, 1]) {
      this.head.add(kit.blob(white, 0.17, 0.18, 0.08, side * 0.19, 0.02, 0.33));
      this.head.add(kit.blob(ink, 0.08, 0.09, 0.05, side * 0.19, 0.02, 0.4));
      this.head.add(kit.blob(white, 0.025, 0.025, 0.02, side * 0.19 + 0.03, 0.06, 0.44));
      const lid = kit.blob(feathers, 0.19, 0.2, 0.1, side * 0.19, 0.02, 0.34);
      lid.scale.y = 0.001;
      this.lids.push(lid);
      this.head.add(lid);
      const tuft = new Mesh(kit.cone, feathers);
      tuft.scale.set(0.11, 0.26, 0.1);
      tuft.position.set(side * 0.3, 0.36, 0);
      tuft.rotation.z = -side * 0.45;
      this.head.add(tuft);
      const pivot = new Group();
      pivot.position.set(side * 0.44, 0.78, -0.02);
      const wing = kit.blob(feathers, 0.14, 0.38, 0.26, side * 0.04, -0.28, 0);
      pivot.add(wing);
      this.wings.push(pivot);
      this.root.add(pivot);
      this.root.add(kit.blob(beak, 0.08, 0.04, 0.1, side * 0.14, 0.02, 0.18));
    }
    const nose = new Mesh(kit.cone, beak);
    nose.scale.set(0.07, 0.14, 0.07);
    nose.rotation.x = Math.PI / 2 + 0.4;
    nose.position.set(0, -0.1, 0.42);
    this.head.add(nose);
  }
}
