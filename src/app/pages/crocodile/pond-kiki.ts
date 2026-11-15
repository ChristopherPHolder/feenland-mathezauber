import {
  Color,
  DoubleSide,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  OctahedronGeometry,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import type { HatId } from './crocodile-score';

const GREEN = '#52b36b';
const DARK = '#3a8f55';
const BELLY = '#c7eaa9';
const INK = '#172555';
const PINK = '#e0457b';
const SUN = '#f4b740';
const GOLD_GLOW = new Color('#ffb21f');

const toon = (color: string, extra: Partial<MeshStandardMaterial> = {}) =>
  new MeshStandardMaterial({ color, roughness: 0.62, metalness: 0, ...extra });

function mesh(
  geometry: Mesh['geometry'],
  material: Mesh['material'],
  [x, y, z]: readonly [number, number, number] = [0, 0, 0],
  [sx, sy, sz]: readonly [number, number, number] = [1, 1, 1],
): Mesh {
  const result = new Mesh(geometry, material);
  result.position.set(x, y, z);
  result.scale.set(sx, sy, sz);
  result.castShadow = true;
  return result;
}

/**
 * Kiki, a friendly low-poly crocodile about 2 units long, looking along +z with her back at
 * +y. The world turns, lunges and opens her jaws; this class owns the parts and the small
 * idle life (blinking, paddling, a swaying tail).
 */
export class Kiki {
  readonly root = new Group();
  /** Everything that turns with her heading. */
  readonly body = new Group();
  private readonly head = new Group();
  private readonly upperJaw = new Group();
  private readonly lowerJaw = new Group();
  private readonly tail: Group[] = [];
  private readonly legs: Mesh[] = [];
  private readonly lids: Mesh[] = [];
  private readonly pupils: Mesh[] = [];
  private readonly smile: Mesh;
  private readonly cheeks: Mesh[] = [];
  private readonly hatHolder = new Group();
  private readonly skin = toon(GREEN);
  private readonly ridge = toon(DARK);
  private hatId: HatId | 'none' | null = null;
  private nextBlink = 2;
  /** 0 (shut) to 1 (wide open). */
  jaw = 0;
  /** 0 to 1: a gold glow during a feeding frenzy. */
  glow = 0;

  constructor() {
    const sphere = new SphereGeometry(1, 20, 14);
    const lowSphere = new SphereGeometry(1, 12, 8);
    const cone = new ConeGeometry(1, 1, 6);
    const belly = toon(BELLY);
    const white = toon('#ffffff', { roughness: 0.3 });
    const ink = toon(INK, { roughness: 0.3 });
    const mouth = toon('#e86a8a');
    const blush = toon('#ff9fbf', { transparent: true, opacity: 0.75 });

    // Body: a long, low egg with a row of bumps down the back.
    this.body.add(mesh(sphere, this.skin, [0, 0.06, -0.04], [0.4, 0.26, 0.46]));
    this.body.add(mesh(sphere, belly, [0, -0.04, 0], [0.34, 0.2, 0.4]));
    for (let i = 0; i < 4; i++) {
      const bump = mesh(
        cone,
        this.ridge,
        [0, 0.3 - i * 0.015, 0.16 - i * 0.14],
        [0.06, 0.09, 0.06],
      );
      this.body.add(bump);
    }
    // Four stubby legs that paddle.
    for (const [x, z] of [
      [-0.36, 0.2],
      [0.36, 0.2],
      [-0.34, -0.26],
      [0.34, -0.26],
    ] as const) {
      const leg = mesh(lowSphere, this.skin, [x, -0.02, z], [0.13, 0.08, 0.16]);
      this.legs.push(leg);
      this.body.add(leg);
    }
    // Tail: three tapering pieces chained so the sway ripples down it.
    let parent: Group = this.body;
    let z = -0.42;
    for (let i = 0; i < 3; i++) {
      const piece = new Group();
      piece.position.set(0, i === 0 ? 0.04 : 0, z);
      const width = 0.22 - i * 0.06;
      piece.add(mesh(sphere, this.skin, [0, 0, -0.13], [width, width * 0.7, 0.19]));
      piece.add(mesh(cone, this.ridge, [0, width * 0.62, -0.14], [0.045, 0.07, 0.045]));
      parent.add(piece);
      this.tail.push(piece);
      parent = piece;
      z = -0.24;
    }

    // Head with the eyes on top and a long snout that opens as two jaws.
    this.head.position.set(0, 0.16, 0.4);
    this.body.add(this.head);
    this.head.add(mesh(sphere, this.skin, [0, 0.02, 0], [0.4, 0.27, 0.33]));
    for (const side of [-1, 1]) {
      const eye = new Group();
      eye.position.set(side * 0.17, 0.24, 0.04);
      eye.add(mesh(sphere, this.skin, [0, -0.02, 0], [0.16, 0.15, 0.15]));
      eye.add(mesh(sphere, white, [0, 0.03, 0.04], [0.13, 0.13, 0.12]));
      // The pupils look up and out, toward the camera above the pond, with a white glint.
      const pupil = mesh(sphere, ink, [0, 0.115, 0.115], [0.068, 0.075, 0.035]);
      pupil.rotation.x = -0.8;
      pupil.add(mesh(sphere, white, [0.35, 0.35, 0.8], [0.32, 0.32, 0.32]));
      this.pupils.push(pupil);
      eye.add(pupil);
      // The lid is a green cap that drops over the eye to blink.
      const lid = mesh(sphere, this.skin, [0, 0.12, -0.05], [0.145, 0.04, 0.11]);
      this.lids.push(lid);
      eye.add(lid);
      this.head.add(eye);
      const cheek = mesh(lowSphere, blush, [side * 0.33, -0.01, 0.17], [0.08, 0.055, 0.05]);
      this.cheeks.push(cheek);
      this.head.add(cheek);
    }

    this.upperJaw.position.set(0, 0.02, 0.12);
    this.lowerJaw.position.set(0, -0.04, 0.12);
    this.head.add(this.upperJaw, this.lowerJaw);
    this.upperJaw.add(mesh(sphere, this.skin, [0, 0.0, 0.26], [0.27, 0.11, 0.32]));
    for (const side of [-1, 1])
      this.upperJaw.add(mesh(lowSphere, this.ridge, [side * 0.08, 0.09, 0.5], [0.03, 0.02, 0.03]));
    this.lowerJaw.add(mesh(sphere, belly, [0, -0.02, 0.24], [0.25, 0.08, 0.3]));
    this.lowerJaw.add(mesh(sphere, mouth, [0, 0.035, 0.22], [0.2, 0.025, 0.24]));
    // Teeth along both sides of the upper jaw, and two little front fangs.
    for (const side of [-1, 1])
      for (let i = 0; i < 4; i++) {
        const tooth = mesh(cone, white, [side * 0.21, -0.07, 0.14 + i * 0.1], [0.03, 0.06, 0.03]);
        tooth.rotation.x = Math.PI;
        this.upperJaw.add(tooth);
      }
    for (const side of [-1, 1]) {
      const fang = mesh(cone, white, [side * 0.1, -0.08, 0.53], [0.035, 0.08, 0.035]);
      fang.rotation.x = Math.PI;
      this.upperJaw.add(fang);
    }
    // A smile on the front of the snout, shown while the jaws are shut.
    this.smile = new Mesh(new TorusGeometry(0.15, 0.02, 6, 16, Math.PI * 0.7), ink);
    this.smile.position.set(0, 0.075, 0.44);
    this.smile.rotation.set(-1.0, 0, Math.PI * 1.15);
    this.upperJaw.add(this.smile);

    this.hatHolder.position.set(0, 0.3, -0.08);
    this.head.add(this.hatHolder);
    this.root.add(this.body);
  }

  setHat(id: HatId | 'none') {
    if (id === this.hatId) return;
    this.hatId = id;
    for (const child of [...this.hatHolder.children]) {
      this.hatHolder.remove(child);
      child.traverse((object) => {
        if (object instanceof Mesh) {
          object.geometry.dispose();
          (object.material as MeshStandardMaterial).dispose();
        }
      });
    }
    if (id !== 'none') this.hatHolder.add(makeHat(id));
  }

  /**
   * Idle life for this frame. `calm` holds the paddling and tail sway; blinking stays, since a
   * blink is over in a moment. `look` turns her eyes a little: -1 left, 1 right.
   */
  animate(t: number, dt: number, calm: boolean, swim: number, look: number) {
    const sway = calm ? 0 : Math.sin(t * (2 + swim * 6)) * (0.18 + swim * 0.25);
    this.tail.forEach((piece, index) => (piece.rotation.y = sway * (0.6 + index * 0.35)));
    this.legs.forEach((leg, index) => {
      const phase = t * (3 + swim * 9) + (index % 3 === 0 ? 0 : Math.PI);
      leg.rotation.x = calm ? 0 : Math.sin(phase) * (0.3 + swim * 0.5);
    });
    this.nextBlink -= dt;
    const blinking = this.nextBlink < 0.14;
    if (this.nextBlink < 0) this.nextBlink = 2.4 + ((t * 7.31) % 2.2);
    for (const lid of this.lids) {
      lid.scale.set(blinking ? 0.15 : 0.145, blinking ? 0.13 : 0.04, blinking ? 0.15 : 0.11);
      lid.position.set(0, blinking ? 0.06 : 0.12, blinking ? 0.05 : -0.05);
    }
    for (const pupil of this.pupils) pupil.position.x = look * 0.03;

    const open = this.jaw;
    this.upperJaw.rotation.x = -open * 0.62;
    this.lowerJaw.rotation.x = open * 0.28;
    this.smile.visible = open < 0.08;
    for (const cheek of this.cheeks) cheek.visible = open < 0.5;

    this.skin.emissive.copy(GOLD_GLOW).multiplyScalar(this.glow * (0.32 + 0.12 * Math.sin(t * 8)));
    this.ridge.emissive.copy(this.skin.emissive);
  }
}

/** The hats Kiki earns, built with their brim at the origin. */
function makeHat(id: HatId): Group {
  const hat = new Group();
  const add = (
    geometry: Mesh['geometry'],
    color: string,
    at: readonly [number, number, number],
    scale: readonly [number, number, number] = [1, 1, 1],
    extra: Partial<MeshStandardMaterial> = {},
  ) => {
    const part = mesh(geometry, toon(color, extra), at, scale);
    hat.add(part);
    return part;
  };
  const shiny = { roughness: 0.25, metalness: 0.35 };
  switch (id) {
    case 'party': {
      add(new ConeGeometry(0.16, 0.42, 16), PINK, [0, 0.21, 0]);
      add(new SphereGeometry(0.055, 10, 8), SUN, [0, 0.44, 0]);
      for (let i = 0; i < 3; i++)
        add(new SphereGeometry(0.025, 8, 6), '#ffffff', [
          0.06 - i * 0.05,
          0.1 + i * 0.09,
          0.12 - i * 0.03,
        ]);
      break;
    }
    case 'crown':
    case 'gold': {
      const big = id === 'gold';
      const r = big ? 0.19 : 0.16;
      add(new CylinderGeometry(r, r * 0.95, 0.12, 14, 1, true), SUN, [0, 0.06, 0], [1, 1, 1], {
        ...shiny,
        side: DoubleSide,
      });
      const spikes = big ? 7 : 5;
      for (let i = 0; i < spikes; i++) {
        const angle = (i / spikes) * Math.PI * 2;
        add(
          new ConeGeometry(0.04, big ? 0.16 : 0.12, 6),
          SUN,
          [Math.sin(angle) * r, 0.17, Math.cos(angle) * r],
          [1, 1, 1],
          shiny,
        );
      }
      add(new SphereGeometry(0.035, 10, 8), PINK, [0, 0.06, r]);
      if (big) {
        add(new SphereGeometry(0.03, 10, 8), '#4aa3ff', [r * 0.7, 0.06, r * 0.7]);
        add(new SphereGeometry(0.03, 10, 8), '#4aa3ff', [-r * 0.7, 0.06, r * 0.7]);
      }
      break;
    }
    case 'pirate': {
      add(
        new SphereGeometry(0.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        INK,
        [0, 0, 0],
        [1.25, 0.8, 0.8],
      );
      add(new CylinderGeometry(0.3, 0.3, 0.03, 18), INK, [0, 0.01, 0], [1, 1, 0.55]);
      add(new SphereGeometry(0.045, 10, 8), '#ffffff', [0, 0.1, 0.15]);
      break;
    }
    case 'wizard': {
      add(new CylinderGeometry(0.28, 0.28, 0.03, 18), '#5a4fcf', [0, 0.01, 0]);
      const cone = add(new ConeGeometry(0.17, 0.55, 16), '#5a4fcf', [0, 0.28, 0]);
      cone.rotation.z = 0.12;
      add(new OctahedronGeometry(0.05), SUN, [0.02, 0.24, 0.14], [1, 1, 0.5], shiny);
      break;
    }
    case 'flower': {
      const ring = add(new TorusGeometry(0.17, 0.03, 8, 20), '#3a8f55', [0, 0.02, 0]);
      ring.rotation.x = Math.PI / 2;
      for (let i = 0; i < 7; i++) {
        const angle = (i / 7) * Math.PI * 2;
        add(new SphereGeometry(0.05, 10, 8), i % 2 ? '#ffd166' : '#ff8fb6', [
          Math.sin(angle) * 0.17,
          0.05,
          Math.cos(angle) * 0.17,
        ]);
      }
      break;
    }
    case 'top': {
      add(new CylinderGeometry(0.27, 0.27, 0.03, 18), INK, [0, 0.01, 0]);
      add(new CylinderGeometry(0.15, 0.15, 0.34, 18), INK, [0, 0.18, 0]);
      add(new CylinderGeometry(0.152, 0.152, 0.06, 18), PINK, [0, 0.06, 0]);
      add(new OctahedronGeometry(0.04), SUN, [0, 0.36, 0], [1, 1, 1], shiny);
      break;
    }
  }
  return hat;
}
