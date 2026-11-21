import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  DoubleSide,
  Group,
  Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  OctahedronGeometry,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import type { SpriteId } from './duel';
import { SPRITE_LOOKS } from './duel-looks';

export function paint(
  color: string,
  extra: Partial<ConstructorParameters<typeof MeshStandardMaterial>[0]> = {},
) {
  return new MeshStandardMaterial({ color, roughness: 0.55, ...extra });
}

export function ball(
  material: Material,
  r: number,
  x: number,
  y: number,
  z: number,
  scale: readonly [number, number, number] = [1, 1, 1],
) {
  const mesh = new Mesh(new SphereGeometry(r, 22, 16), material);
  mesh.position.set(x, y, z);
  mesh.scale.set(scale[0], scale[1], scale[2]);
  mesh.castShadow = true;
  return mesh;
}

const INK = '#2a2148';

/** Sprites stand a little bigger than a hatchling; Grumble, the boss, bigger still. */
export function spriteScale(id: SpriteId): number {
  return id === 'grumble' ? 1.55 : 1.2;
}

/**
 * A round, cheeky sprite. All eight share a face (big eyes, slanted brows, a grin with one
 * tooth) and little arms, and each gets its own body and crown: a pebble with moss, a water
 * drop, a thorny bush, a whirl of wind, an ember with flame hair, a moth with wings, an icy
 * wisp and Grumble the storm cloud. About 1.2 units tall, facing +z.
 */
export class SpriteModel {
  readonly root = new Group();
  /** Squashes, tilts and swells; the root carries position and turn. */
  readonly body = new Group();
  /** Glows white on a hit and gold while charging. */
  readonly skin: MeshStandardMaterial;
  /** Parts that sway or flap in `update`. */
  private readonly wings: Object3D[] = [];
  private readonly spin: Object3D[] = [];
  private readonly eyes: Object3D[] = [];
  readonly floats: boolean;

  constructor(readonly id: SpriteId) {
    const look = SPRITE_LOOKS[id];
    this.floats = look.floats;
    this.skin = paint(look.body, {
      emissive: '#ffe27a',
      emissiveIntensity: 0,
      transparent: id === 'puddle' || id === 'frost',
      opacity: id === 'puddle' ? 0.9 : id === 'frost' ? 0.92 : 1,
      roughness: id === 'puddle' || id === 'frost' ? 0.2 : 0.6,
      flatShading: id === 'pebble',
    });
    const belly = paint(look.belly);
    const trim = paint(look.trim);
    this.root.add(this.body);
    this.buildBody(id, belly, trim);
    this.buildFace(id);
    this.root.scale.setScalar(spriteScale(id));
  }

  private add(...objects: Object3D[]) {
    this.body.add(...objects);
  }

  private buildBody(id: SpriteId, belly: MeshStandardMaterial, trim: MeshStandardMaterial) {
    const skin = this.skin;
    // Feet for the ones that stand, a soft tuft underneath for the ones that float.
    const standing = !this.floats;
    if (standing)
      for (const side of [-1, 1])
        this.add(ball(skin, 0.13, side * 0.2, 0.08, 0.06, [1, 0.55, 1.35]));
    switch (id) {
      case 'pebble': {
        const stone = new Mesh(new DodecahedronGeometry(0.48, 1), skin);
        stone.position.y = 0.55;
        stone.scale.set(1.05, 0.95, 0.9);
        stone.castShadow = true;
        this.add(stone);
        this.add(ball(belly, 0.3, 0, 0.45, 0.26, [1, 0.9, 0.5]));
        // Moss on top and two pebbles riding on it.
        this.add(ball(trim, 0.26, 0.04, 0.95, -0.02, [1.3, 0.45, 1.1]));
        const rock = paint('#8a7d6e', { flatShading: true });
        for (const [x, z, r] of [
          [-0.18, 0.06, 0.09],
          [0.22, -0.08, 0.11],
        ]) {
          const pebble = new Mesh(new DodecahedronGeometry(r), rock);
          pebble.position.set(x, 1.04, z);
          this.add(pebble);
        }
        break;
      }
      case 'puddle': {
        // A water drop: a round bottom with a point on top.
        this.add(ball(skin, 0.46, 0, 0.5, 0, [1, 0.95, 0.95]));
        const tip = new Mesh(new ConeGeometry(0.33, 0.6, 24), skin);
        tip.position.y = 1.1;
        this.add(tip);
        this.add(ball(belly, 0.28, 0, 0.42, 0.25, [1, 0.9, 0.5]));
        const ripple = new Mesh(
          new TorusGeometry(0.5, 0.03, 8, 40),
          paint('#cdf1ff', { transparent: true, opacity: 0.8 }),
        );
        ripple.rotation.x = Math.PI / 2;
        ripple.position.y = 0.03;
        this.add(ripple);
        break;
      }
      case 'bramble': {
        this.add(ball(skin, 0.47, 0, 0.55, 0, [1.08, 1, 0.95]));
        this.add(ball(belly, 0.3, 0, 0.45, 0.25, [1, 0.9, 0.5]));
        const thorn = paint('#3f6b2a');
        for (let i = 0; i < 9; i++) {
          const angle = (i / 8) * Math.PI - Math.PI / 2;
          const spike = new Mesh(new ConeGeometry(0.055, 0.24, 8), thorn);
          spike.position.set(Math.sin(angle) * 0.42, 0.6 + Math.cos(angle) * 0.42, -0.08);
          spike.rotation.z = -angle;
          this.add(spike);
        }
        // Two leaf ears and a berry.
        for (const side of [-1, 1]) {
          const leaf = ball(
            paint('#8cc95e', { side: DoubleSide }),
            0.16,
            side * 0.42,
            0.9,
            0,
            [1.4, 0.5, 0.2],
          );
          leaf.rotation.z = side * 0.6;
          this.add(leaf);
          this.wings.push(leaf);
        }
        this.add(ball(trim, 0.09, 0.18, 1.02, 0.12));
        break;
      }
      case 'gusty': {
        // A round cloud with puffy cheeks, a wisp of wind on top and a curl for a tail.
        this.add(ball(skin, 0.44, 0, 0.6, 0));
        for (const side of [-1, 1]) this.add(ball(skin, 0.26, side * 0.4, 0.46, -0.04));
        this.add(ball(skin, 0.18, 0.12, 1.02, -0.06));
        const wisp = new Mesh(
          new TorusGeometry(0.16, 0.045, 8, 24, Math.PI * 1.4),
          paint(SPRITE_LOOKS.gusty.trim),
        );
        wisp.position.set(-0.08, 1.06, -0.02);
        wisp.rotation.z = 0.6;
        this.add(wisp);
        this.add(ball(belly, 0.26, 0, 0.5, 0.24, [1, 0.9, 0.5]));
        const swirl = new Group();
        const curl = paint(SPRITE_LOOKS.gusty.trim, { transparent: true, opacity: 0.85 });
        for (const [r, y] of [
          [0.36, 0.15],
          [0.24, 0.02],
        ]) {
          const ring = new Mesh(new TorusGeometry(r, 0.035, 8, 32, Math.PI * 1.5), curl);
          ring.rotation.x = Math.PI / 2;
          ring.position.y = y;
          swirl.add(ring);
        }
        this.add(swirl);
        this.spin.push(swirl);
        break;
      }
      case 'cinder': {
        this.add(ball(skin, 0.45, 0, 0.55, 0, [1, 1.05, 0.95]));
        this.add(ball(belly, 0.29, 0, 0.45, 0.24, [1, 0.9, 0.5]));
        const flame = paint('#ffb347', { emissive: '#ff7a2f', emissiveIntensity: 0.7 });
        const core = paint('#ffe066', { emissive: '#ffd43f', emissiveIntensity: 0.8 });
        for (const [x, h, tilt] of [
          [-0.22, 0.3, 0.35],
          [0, 0.46, 0],
          [0.22, 0.32, -0.35],
        ]) {
          const tongue = new Mesh(new ConeGeometry(0.13, h, 14), flame);
          tongue.position.set(x, 0.98 + h / 2 - 0.08, -0.04);
          tongue.rotation.z = tilt;
          const inner = new Mesh(new ConeGeometry(0.06, h * 0.6, 10), core);
          inner.position.set(x, 0.96 + h * 0.3, 0.04);
          inner.rotation.z = tilt;
          this.add(tongue, inner);
          this.wings.push(tongue);
        }
        break;
      }
      case 'moth': {
        this.add(ball(skin, 0.36, 0, 0.62, 0, [1, 1.15, 0.95]));
        this.add(ball(belly, 0.24, 0, 0.52, 0.2, [1, 1, 0.5]));
        // A fluffy tuft on its head.
        this.add(ball(paint('#f4efff', { roughness: 0.95 }), 0.2, 0, 0.98, -0.06, [1.3, 0.6, 1]));
        const wing = paint(SPRITE_LOOKS.moth.trim, {
          side: DoubleSide,
          transparent: true,
          opacity: 0.9,
        });
        const dot = paint('#ffe27a', { emissive: '#ffe27a', emissiveIntensity: 0.5 });
        for (const side of [-1, 1]) {
          const hinge = new Group();
          hinge.position.set(side * 0.2, 0.75, -0.12);
          const upper = ball(wing, 0.4, side * 0.38, 0.12, 0, [1, 1.15, 0.06]);
          const lower = ball(wing, 0.26, side * 0.28, -0.3, 0, [1, 1.1, 0.06]);
          const spot = ball(dot, 0.08, side * 0.44, 0.16, 0.03, [1, 1, 0.3]);
          hinge.add(upper, lower, spot);
          this.add(hinge);
          this.wings.push(hinge);
          const antenna = new Mesh(new CylinderGeometry(0.014, 0.014, 0.36, 6), paint(INK));
          antenna.position.set(side * 0.12, 1.12, 0.02);
          antenna.rotation.z = side * -0.45;
          this.add(antenna, ball(dot, 0.05, side * 0.2, 1.28, 0.02));
        }
        break;
      }
      case 'frost': {
        this.add(ball(skin, 0.42, 0, 0.6, 0, [1, 1.1, 0.95]));
        this.add(ball(belly, 0.26, 0, 0.5, 0.24, [1, 0.9, 0.5]));
        // A wispy tail curling under it.
        this.add(ball(skin, 0.24, 0.06, 0.22, -0.05, [1, 0.8, 1]));
        this.add(ball(skin, 0.14, 0.16, 0.06, -0.1));
        const ice = paint(SPRITE_LOOKS.frost.trim, {
          roughness: 0.1,
          transparent: true,
          opacity: 0.9,
          emissive: '#bfefff',
          emissiveIntensity: 0.25,
        });
        for (let i = 0; i < 5; i++) {
          const angle = (i / 4) * 1.6 - 0.8;
          const crystal = new Mesh(new OctahedronGeometry(0.11), ice);
          crystal.scale.set(0.55, 1.8, 0.55);
          crystal.position.set(Math.sin(angle) * 0.34, 1.0 + Math.cos(angle) * 0.1, -0.02);
          crystal.rotation.z = -angle * 0.8;
          this.add(crystal);
        }
        const flake = new Mesh(new OctahedronGeometry(0.07), ice);
        flake.position.set(-0.5, 0.95, 0.1);
        this.add(flake);
        this.spin.push(flake);
        break;
      }
      case 'grumble': {
        // A storm cloud with a cross face, a lightning bolt and a rumble of dark puffs.
        const cloud = paint('#7c7fa6', { roughness: 0.9 });
        this.add(ball(skin, 0.46, 0, 0.62, 0));
        for (const [x, y, r] of [
          [-0.42, 0.74, 0.28],
          [0.42, 0.76, 0.3],
          [-0.2, 1.0, 0.27],
          [0.18, 1.04, 0.3],
          [0, 0.36, 0.3],
        ])
          this.add(ball(cloud, r, x, y, -0.1));
        this.add(ball(belly, 0.27, 0, 0.5, 0.26, [1, 0.85, 0.5]));
        const bolt = paint(SPRITE_LOOKS.grumble.trim, {
          emissive: '#ffd43f',
          emissiveIntensity: 0.9,
        });
        const zig = new Group();
        for (const [y, tilt] of [
          [0.16, 0.5],
          [-0.06, -0.5],
          [-0.26, 0.5],
        ]) {
          const piece = new Mesh(new BoxGeometry(0.07, 0.26, 0.05), bolt);
          piece.position.set(tilt * 0.08, y, 0);
          piece.rotation.z = tilt;
          zig.add(piece);
        }
        zig.position.set(0.5, 0.3, 0.05);
        this.add(zig);
        this.wings.push(zig);
        break;
      }
    }
    // Little arms.
    for (const side of [-1, 1]) {
      const arm = ball(skin, 0.085, side * 0.45, 0.48, 0.1, [1, 1.45, 1]);
      arm.rotation.z = side * 0.5;
      this.add(arm);
    }
  }

  private buildFace(id: SpriteId) {
    const ink = paint(INK, { roughness: 0.3 });
    const white = paint('#fffefc', { roughness: 0.2 });
    const y = id === 'moth' ? 0.72 : id === 'puddle' ? 0.62 : 0.68;
    const front = id === 'moth' ? 0.32 : id === 'grumble' ? 0.4 : 0.38;
    for (const side of [-1, 1]) {
      const eye = new Group();
      eye.position.set(side * 0.16, y, front);
      eye.add(ball(white, 0.115, 0, 0, 0, [1, 1.12, 0.6]));
      eye.add(ball(ink, 0.065, side * -0.02, -0.01, 0.06, [1, 1.1, 0.6]));
      eye.add(ball(white, 0.022, side * -0.04, 0.035, 0.1));
      this.eyes.push(eye);
      this.add(eye);
      const brow = new Mesh(new BoxGeometry(0.17, 0.038, 0.04), ink);
      brow.position.set(side * 0.16, y + 0.16, front + 0.02);
      // Grumble frowns; the others look cheeky.
      brow.rotation.z = side * (id === 'grumble' ? 0.4 : -0.3);
      this.add(brow);
    }
    const grin = ball(ink, 0.09, 0, y - 0.19, front + 0.03, [1.35, 0.45, 0.4]);
    this.add(grin, ball(white, 0.026, 0.035, y - 0.22, front + 0.08, [1, 1.2, 0.6]));
    for (const side of [-1, 1])
      this.add(
        ball(
          paint('#ff9fbf', { transparent: true, opacity: 0.7 }),
          0.06,
          side * 0.28,
          y - 0.12,
          front - 0.04,
          [1, 0.6, 0.3],
        ),
      );
  }

  blink(closed: boolean) {
    for (const eye of this.eyes) eye.scale.y = closed ? 0.15 : 1;
  }

  /** Idle motion: wings flap, flames flicker, swirls turn. `calm` holds it still. */
  update(t: number, calm: boolean) {
    const idle = calm ? 0 : 1;
    this.wings.forEach((part, index) => {
      const side = index % 2 ? 1 : -1;
      if (this.id === 'moth') part.rotation.y = side * (0.3 + Math.sin(t * 7) * 0.45 * idle);
      else if (this.id === 'cinder') part.scale.y = 1 + Math.sin(t * 9 + index) * 0.14 * idle;
      else part.rotation.x = Math.sin(t * 3 + index) * 0.2 * idle;
    });
    for (const part of this.spin) part.rotation.y = t * 1.6 * idle;
  }
}
