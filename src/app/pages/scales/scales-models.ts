import {
  BoxGeometry,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Group,
  LatheGeometry,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  Vector2,
} from 'three';
import { TextLabel } from '../../shared/three/labels';
import type { PanThing } from './scales-frame';
import type { ItemId } from './scales-levels';

/**
 * Shared geometries, materials and label textures for Bramble's kitchen. Things on the pans
 * come and go every line, so they are built from these and only removed from the scene, never
 * disposed one by one; `dispose()` frees them all when the world goes.
 */
export class Kit {
  private readonly geometries = new Map<string, BufferGeometry>();
  private readonly materials = new Map<string, Material>();
  private readonly labels = new Map<string, TextLabel>();

  geometry<G extends BufferGeometry>(key: string, make: () => G): G {
    let geometry = this.geometries.get(key);
    if (!geometry) this.geometries.set(key, (geometry = make()));
    return geometry as G;
  }

  /** A standard material of one colour, shared by everything of that colour. */
  paint(color: string, options: { metal?: number; rough?: number; emissive?: string } = {}) {
    const key = `${color}|${options.metal ?? 0}|${options.rough ?? 0.75}|${options.emissive ?? ''}`;
    let material = this.materials.get(key);
    if (!material)
      this.materials.set(
        key,
        (material = new MeshStandardMaterial({
          color,
          metalness: options.metal ?? 0,
          roughness: options.rough ?? 0.75,
          ...(options.emissive ? { emissive: options.emissive, emissiveIntensity: 0.25 } : {}),
        })),
      );
    return material;
  }

  /** A flat label material showing `text`, for a weight's face or a tag above an ingredient. */
  label(text: string, fill = '#fff7e6', ink = '#2e1d05', border = '#8a6421') {
    const key = `label|${text}|${fill}|${ink}`;
    let material = this.materials.get(key);
    if (!material) {
      let label = this.labels.get(key);
      if (!label)
        this.labels.set(
          key,
          (label = new TextLabel(text, {
            fill,
            ink,
            border,
            width: 256,
            height: 128,
            radius: 0.3,
          })),
        );
      this.materials.set(
        key,
        (material = new MeshBasicMaterial({ map: label.texture, transparent: true })),
      );
    }
    return material;
  }

  dispose() {
    for (const geometry of this.geometries.values()) geometry.dispose();
    for (const material of this.materials.values()) material.dispose();
    for (const label of this.labels.values()) label.texture.dispose();
  }
}

const BRASS = { metal: 0.65, rough: 0.32 } as const;

/** A sack's outline, turned round: wide body, narrow neck, a frilly top. */
const SACK_PROFILE = [
  [0.01, 0],
  [0.42, 0.02],
  [0.5, 0.25],
  [0.46, 0.6],
  [0.26, 0.82],
  [0.2, 0.86],
  [0.3, 0.98],
  [0.01, 0.96],
].map(([x, y]) => new Vector2(x, y));
/** A bowl's outline. */
const BOWL_PROFILE = [
  [0.01, 0],
  [0.3, 0.02],
  [0.48, 0.2],
  [0.52, 0.42],
  [0.48, 0.42],
  [0.44, 0.24],
  [0.01, 0.08],
].map(([x, y]) => new Vector2(x, y));

function mesh(geometry: BufferGeometry, material: Material, x = 0, y = 0, z = 0) {
  const part = new Mesh(geometry, material);
  part.position.set(x, y, z);
  part.castShadow = true;
  return part;
}

/** An ingredient about one unit wide and tall, standing on y = 0. */
export function makeItem(kit: Kit, id: ItemId): Group {
  const group = new Group();
  const sphere = kit.geometry('sphere', () => new SphereGeometry(0.5, 20, 14));
  const ball = kit.geometry('ball', () => new SphereGeometry(0.5, 12, 8));
  const sack = kit.geometry('sack', () => new LatheGeometry(SACK_PROFILE, 18));
  const bowl = kit.geometry('bowl', () => new LatheGeometry(BOWL_PROFILE, 20));
  const cylinder = kit.geometry('cylinder', () => new CylinderGeometry(0.5, 0.5, 1, 20));
  const add = (part: Mesh, sx = 1, sy = 1, sz = 1) => {
    part.scale.set(sx, sy, sz);
    group.add(part);
    return part;
  };
  switch (id) {
    case 'pumpkin': {
      const skin = kit.paint('#ec8a25', { rough: 0.6 });
      for (let rib = 0; rib < 6; rib++) {
        const angle = (rib / 6) * Math.PI * 2;
        add(
          mesh(sphere, skin, Math.cos(angle) * 0.17, 0.36, Math.sin(angle) * 0.17),
          0.62,
          0.72,
          0.62,
        ).rotation.y = -angle;
      }
      add(mesh(cylinder, kit.paint('#5f7a2c'), 0, 0.76, 0), 0.08, 0.16, 0.08).rotation.z = 0.3;
      break;
    }
    case 'melon':
      add(mesh(sphere, kit.paint('#4f8f33', { rough: 0.45 }), 0, 0.33, 0), 1, 0.66, 0.72);
      add(mesh(sphere, kit.paint('#7dbb55', { rough: 0.45 }), 0, 0.33, 0), 1.01, 0.4, 0.73);
      break;
    case 'cabbage':
      add(mesh(sphere, kit.paint('#7fb65c'), 0, 0.42, 0), 0.84, 0.84, 0.84);
      for (const side of [-1, 1])
        add(mesh(sphere, kit.paint('#a6d483'), side * 0.28, 0.38, 0.08), 0.42, 0.7, 0.6);
      add(mesh(sphere, kit.paint('#c4e6a5'), 0, 0.52, 0.3), 0.38, 0.38, 0.2);
      break;
    case 'potatoes':
    case 'flour':
    case 'salt': {
      const color = id === 'potatoes' ? '#b08a5a' : id === 'flour' ? '#f2ead9' : '#b98ee0';
      add(mesh(sack, kit.paint(color, { rough: 0.95 })), 1, id === 'salt' ? 0.85 : 1, 1);
      if (id === 'flour') add(mesh(cylinder, kit.paint('#5b8fd1'), 0, 0.42, 0), 0.98, 0.12, 0.98);
      if (id === 'potatoes')
        for (const x of [-0.16, 0.14])
          add(mesh(sphere, kit.paint('#c49a64'), x, 0.96, 0.02), 0.26, 0.18, 0.2);
      if (id === 'salt')
        add(
          mesh(sphere, kit.paint('#fff6bf', { emissive: '#fff6bf' }), 0, 0.5, 0.4),
          0.14,
          0.14,
          0.06,
        );
      break;
    }
    case 'carrots': {
      const orange = kit.paint('#ef7d23');
      const cone = kit.geometry('cone', () => new ConeGeometry(0.12, 0.9, 12));
      [-0.22, 0, 0.22].forEach((x, index) => {
        const carrot = add(mesh(cone, orange, x, 0.12 + index * 0.02, index * 0.05));
        carrot.rotation.z = Math.PI / 2 + (index - 1) * 0.15;
        const leaf = add(
          mesh(cone, kit.paint('#5b9a35'), x - 0.5, 0.14, index * 0.05),
          0.6,
          0.35,
          0.6,
        );
        leaf.rotation.z = -Math.PI / 2;
      });
      break;
    }
    case 'apples':
      add(mesh(cylinder, kit.paint('#a9773f', { rough: 0.95 }), 0, 0.2, 0), 1, 0.4, 0.7);
      for (const [x, z] of [
        [-0.22, 0],
        [0.2, -0.05],
        [0, 0.12],
        [0.02, -0.14],
      ])
        add(mesh(ball, kit.paint('#d6372f', { rough: 0.4 }), x, 0.48, z), 0.34, 0.32, 0.34);
      break;
    case 'cheese':
      add(mesh(cylinder, kit.paint('#e9b130', { rough: 0.6 }), 0, 0.22, 0), 1, 0.44, 1);
      add(mesh(ball, kit.paint('#c98f1c'), -0.2, 0.3, 0.42), 0.1, 0.1, 0.05);
      add(mesh(ball, kit.paint('#c98f1c'), 0.15, 0.18, 0.44), 0.08, 0.08, 0.04);
      break;
    case 'butter': {
      const box = kit.geometry('box', () => new BoxGeometry(1, 1, 1));
      add(mesh(box, kit.paint('#f7dc6f', { rough: 0.5 }), 0, 0.22, 0), 0.9, 0.42, 0.5);
      add(mesh(box, kit.paint('#f3efe2'), 0, 0.1, 0), 0.94, 0.2, 0.54);
      break;
    }
    case 'berries':
    case 'nuts': {
      add(mesh(bowl, kit.paint('#f1e7d6', { rough: 0.5 })), 1, 1, 1);
      const color = id === 'berries' ? '#4b4fa6' : '#9c6a3a';
      for (const [x, z] of [
        [-0.16, 0],
        [0.14, -0.06],
        [0, 0.14],
        [0.04, -0.16],
        [-0.04, 0.02],
      ])
        add(mesh(ball, kit.paint(color, { rough: 0.4 }), x, 0.38, z), 0.22, 0.2, 0.22);
      break;
    }
    case 'honey':
      add(mesh(cylinder, kit.paint('#e3a018', { rough: 0.3 }), 0, 0.36, 0), 0.62, 0.72, 0.62);
      add(mesh(cylinder, kit.paint('#c46a2b'), 0, 0.76, 0), 0.66, 0.12, 0.66);
      add(mesh(cylinder, kit.paint('#fff3c4'), 0, 0.36, 0), 0.63, 0.26, 0.63);
      break;
    case 'pillow':
      add(mesh(sphere, kit.paint('#f4f1fb', { rough: 0.95 }), 0, 0.2, 0), 1.1, 0.42, 0.8);
      break;
    case 'rock': {
      const stone = kit.geometry('rock', () => new DodecahedronGeometry(0.5, 0));
      add(mesh(stone, kit.paint('#7d8590', { rough: 0.9 }), 0, 0.3, 0), 0.9, 0.62, 0.8);
      break;
    }
    case 'water':
    case 'milk':
    case 'juice': {
      const color = id === 'water' ? '#7fc4ef' : id === 'milk' ? '#fbfaf5' : '#c2357a';
      add(mesh(cylinder, kit.paint(color, { rough: 0.2 }), 0, 0.4, 0), 0.6, 0.8, 0.6);
      break;
    }
  }
  return group;
}

/** A thing for a pan: an ingredient, a brass weight, a mystery box or a sack, with its label. */
export function makeThing(kit: Kit, thing: PanThing): Group {
  const group = new Group();
  const plane = kit.geometry('plane', () => new PlaneGeometry(1, 0.5));
  switch (thing.kind) {
    case 'item': {
      group.add(makeItem(kit, thing.item!));
      if (thing.label) {
        const tag = new Mesh(plane, kit.label(thing.label));
        tag.position.set(0, 0.42, 0.62);
        tag.scale.setScalar(0.9);
        group.add(tag);
      }
      break;
    }
    case 'weight': {
      const body = kit.geometry('weight', () => new CylinderGeometry(0.36, 0.5, 0.78, 24));
      const knob = kit.geometry('knob', () => new SphereGeometry(0.16, 12, 8));
      const brass = kit.paint('#c9a24a', BRASS);
      group.add(mesh(body, brass, 0, 0.39, 0), mesh(knob, brass, 0, 0.84, 0));
      const face = new Mesh(plane, kit.label(thing.label, '#fff7e6', '#2e1d05', '#c9a24a'));
      face.position.set(0, 0.4, 0.47);
      face.scale.setScalar(0.86);
      group.add(face);
      break;
    }
    case 'mystery': {
      const box = kit.geometry('box', () => new BoxGeometry(1, 1, 1));
      group.add(mesh(box, kit.paint('#8b5fc0', { rough: 0.6 }), 0, 0.46, 0));
      group.children[0].scale.set(0.92, 0.92, 0.92);
      const face = new Mesh(plane, kit.label('?', '#8b5fc0', '#fff6bf', '#4b2c78'));
      face.position.set(0, 0.46, 0.47);
      face.scale.set(0.8, 1.4, 1);
      group.add(face);
      break;
    }
    case 'sack': {
      const sack = kit.geometry('sack', () => new LatheGeometry(SACK_PROFILE, 18));
      group.add(mesh(sack, kit.paint('#c79a5e', { rough: 0.95 })));
      const face = new Mesh(plane, kit.label(thing.label, '#f3e2c2', '#2e1d05', '#8b6a40'));
      face.position.set(0, 0.42, 0.5);
      face.scale.setScalar(0.8);
      group.add(face);
      break;
    }
  }
  return group;
}

/** A pouring jug about one unit tall: a glass body, a spout and a handle. */
export function makeJug(kit: Kit): Group {
  const group = new Group();
  const glass = kit.geometry('jug', () => new CylinderGeometry(0.34, 0.4, 1, 20, 1, true));
  const bottom = kit.geometry('jug-bottom', () => new CylinderGeometry(0.4, 0.4, 0.04, 20));
  const material = kit.paint('#dff1fb', { rough: 0.15 });
  group.add(mesh(glass, material, 0, 0.5, 0), mesh(bottom, material, 0, 0.02, 0));
  const spout = kit.geometry('spout', () => new ConeGeometry(0.12, 0.26, 10, 1, true));
  const lip = mesh(spout, material, 0.38, 0.92, 0);
  lip.rotation.z = -Math.PI / 2.4;
  const handle = kit.geometry('handle', () => new BoxGeometry(0.08, 0.6, 0.08));
  group.add(lip, mesh(handle, kit.paint('#4d7f9e'), -0.46, 0.56, 0));
  const water = kit.geometry('jug-water', () => new CylinderGeometry(0.33, 0.39, 0.6, 20));
  group.add(mesh(water, kit.paint('#5fb2e6', { rough: 0.15 }), 0, 0.32, 0));
  return group;
}
