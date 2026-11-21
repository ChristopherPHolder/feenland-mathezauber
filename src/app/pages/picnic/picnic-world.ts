import {
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  RepeatWrapping,
  Shape,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
} from 'three';
import { approach, easeOutBack, EventCounter, smooth } from '../../shared/three/motion';
import { disposeTree, Stage } from '../../shared/three/stage';
import type { StateWorld } from '../../shared/three/three-stage';
import { ball, Critter, paint } from './picnic-critters';
import type { FoodOnBlanket, PicnicFrame } from './picnic-frame';
import type { FriendKind } from './picnic-friends';

const FOV = 38;
/** The main blanket, centred on the origin. */
const BLANKET = { width: 6.4, depth: 4.2 };
/** Where the guests sit (behind the blanket) and their plates. */
const GUEST_Z = -2.45;
const PLATE_Z = -1.55;
/** The back blanket where the friends who joined the picnic stay. */
const BACK = { x: 0, z: -4.6, width: 7.4, depth: 1.5 };
const MAX_BERRIES = 64;
const SERVE_TIME = 0.8;
const ANT_COUNT = 6;
const ANT_START = new Vector3(7.5, 0, 2.6);
const ANT_END = new Vector3(3.35, 0, 1.2);

/** A flat wedge from `start` to `end` (shares of a turn, clockwise from the far side). */
function wedgeShape(radius: number, start: number, end: number) {
  const shape = new Shape();
  shape.moveTo(0, 0);
  const steps = Math.max(2, Math.ceil((end - start) * 48));
  for (let i = 0; i <= steps; i++) {
    const turn = start + ((end - start) * i) / steps;
    const angle = turn * Math.PI * 2;
    // Shape space: x right, y away from the child (becomes -z once laid flat).
    shape.lineTo(Math.sin(angle) * radius, Math.cos(angle) * radius);
  }
  shape.lineTo(0, 0);
  return shape;
}

function checkerTexture(a: string, b: string, squares: number) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const g = canvas.getContext('2d')!;
  const step = 128 / squares;
  for (let y = 0; y < squares; y++)
    for (let x = 0; x < squares; x++) {
      g.fillStyle = (x + y) % 2 ? a : b;
      g.fillRect(x * step, y * step, step, step);
    }
  // Soft stripes across the light squares, like a woven cloth.
  g.fillStyle = '#ffffff22';
  for (let y = 0; y < 128; y += 4) g.fillRect(0, y, 128, 1);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  return texture;
}

interface Piece {
  readonly mesh: Object3D;
  readonly home: Vector3;
  readonly plate: Vector3 | null;
}

interface Heart {
  readonly mesh: Mesh;
  readonly born: number;
  readonly drift: number;
}

/**
 * The picnic in 3D: a sunny meadow with trees, a checked blanket in the middle with the share
 * on it (a pie or cake in wedges, a honey bar or ribbon in slices, or the berry basket), the
 * guests sitting behind it with their plates, the ant line marching in from the right, the
 * golden spoon during a streak, and the friends who joined the picnic on a blanket at the back.
 * It only draws: the game decides everything and hands it a `PicnicFrame`.
 */
export class PicnicWorld extends Stage implements StateWorld<PicnicFrame> {
  private frame?: PicnicFrame;
  private shareIndex = -1;
  private foodKey = '';
  private guestKey = '';
  private joinedKey = '';
  private readonly foods = new Group();
  private pieces: Piece[] = [];
  private readonly covers = new Group();
  private readonly guests = new Group();
  private critters: Critter[] = [];
  private readonly plates = new Group();
  private plateSpots: Vector3[] = [];
  private readonly joined = new Group();
  private joinedCritters: Critter[] = [];
  private readonly basket = new Group();
  private readonly basketBerries: InstancedMesh;
  private readonly plateBerries: InstancedMesh;
  private readonly ants = new Group();
  private readonly antList: Group[] = [];
  private readonly crumb: Mesh;
  private crumbAt = -10;
  private readonly spoon = new Group();
  private spoonShow = 0;
  private readonly hearts: Heart[] = [];
  private readonly heartGeometry: ExtrudeGeometry;
  private readonly heartMaterial: MeshStandardMaterial;
  private servedAt = -10;
  private munchAt = -10;
  private frownAt = -10;
  private readonly rights = new EventCounter();
  private readonly wrongs = new EventCounter();
  private readonly cuts = new EventCounter();
  private cutAt = -10;
  private readonly dummy = new Object3D();
  private readonly probe = new Vector3();

  // Materials for the food, shared by every piece.
  private readonly crust = paint('#d99a4e', { roughness: 0.75 });
  private readonly filling = paint('#f4c77d', { roughness: 0.7 });
  private readonly jam = paint('#e2526e', { roughness: 0.35 });
  private readonly sponge = paint('#fff1d6', { roughness: 0.8 });
  private readonly frosting = paint('#fbd3e2', { roughness: 0.5 });
  private readonly honey = paint('#f6c24a', { roughness: 0.35, metalness: 0.05 });
  private readonly honeySide = paint('#d8962a', { roughness: 0.5 });
  private readonly ribbon = paint('#7fc4ef', { roughness: 0.5 });
  private readonly ribbonJam = paint('#b06ad9', { roughness: 0.5 });
  private readonly cloth = paint('#8fbfea', { roughness: 0.9 });
  private readonly plateMaterial = paint('#ffffff', { roughness: 0.4 });
  private readonly cherry = paint('#d81e45', { roughness: 0.25 });

  constructor(canvas: HTMLCanvasElement, host: HTMLElement) {
    super(canvas, host, { fov: FOV, background: '#bfe6ff', shadows: true });
    this.fill.intensity = 1.5;
    this.sun.intensity = 2.2;
    this.sun.position.set(-4, 12, 7);
    this.sun.shadow.camera.left = -9;
    this.sun.shadow.camera.right = 9;
    this.sun.shadow.camera.top = 9;
    this.sun.shadow.camera.bottom = -9;

    this.buildMeadow();
    // The blanket.
    const blanket = new Mesh(
      new PlaneGeometry(BLANKET.width, BLANKET.depth),
      new MeshStandardMaterial({ map: checkerTexture('#e2526e', '#fff7f0', 8), roughness: 1 }),
    );
    (blanket.material.map as CanvasTexture).repeat.set(2, 1.3);
    blanket.rotation.x = -Math.PI / 2;
    blanket.position.y = 0.01;
    blanket.receiveShadow = true;
    const back = new Mesh(
      new PlaneGeometry(BACK.width, BACK.depth),
      new MeshStandardMaterial({ map: checkerTexture('#6fae5b', '#fff7e0', 8), roughness: 1 }),
    );
    (back.material.map as CanvasTexture).repeat.set(3, 0.6);
    back.rotation.x = -Math.PI / 2;
    back.position.set(BACK.x, 0.01, BACK.z);
    back.receiveShadow = true;
    this.scene.add(blanket, back, this.foods, this.covers, this.guests, this.plates, this.joined);

    // The berry basket and the berries, instanced.
    const weave = paint('#d9a35b', { roughness: 0.9 });
    const tub = new Mesh(new CylinderGeometry(0.75, 0.6, 0.55, 24, 1, true), weave);
    tub.position.y = 0.28;
    tub.castShadow = true;
    const bottom = new Mesh(new CircleGeometry(0.6, 24), weave);
    bottom.rotation.x = -Math.PI / 2;
    bottom.position.y = 0.02;
    const arc = new Shape();
    arc.absarc(0, 0, 0.75, 0, Math.PI, false);
    arc.absarc(0, 0, 0.68, Math.PI, 0, true);
    const handle = new Mesh(
      new ExtrudeGeometry(arc, { depth: 0.06, bevelEnabled: false }),
      paint('#9b6a35', { roughness: 0.9 }),
    );
    handle.position.set(0, 0.5, -0.03);
    this.basket.add(tub, bottom, handle);
    this.basket.position.set(0, 0, 0.5);
    this.scene.add(this.basket);
    const berry = new SphereGeometry(0.075, 10, 8);
    const berryPaint = paint('#c4234a', { roughness: 0.3 });
    this.basketBerries = new InstancedMesh(berry, berryPaint, MAX_BERRIES);
    this.plateBerries = new InstancedMesh(berry, berryPaint, MAX_BERRIES);
    this.basketBerries.castShadow = this.plateBerries.castShadow = true;
    this.scene.add(this.basketBerries, this.plateBerries);

    // The ant line, and the crumb the leader carries off when it arrives.
    const antPaint = paint('#2b1d14', { roughness: 0.4 });
    for (let i = 0; i < ANT_COUNT; i++) {
      const ant = new Group();
      ant.add(ball(antPaint, 0.06, -0.09, 0.07, 0, [1.2, 1, 1], 8));
      ant.add(ball(antPaint, 0.045, 0, 0.07, 0, [1, 1, 1], 8));
      ant.add(ball(antPaint, 0.055, 0.08, 0.08, 0, [1, 1, 1], 8));
      for (const side of [-1, 1])
        for (const at of [-0.04, 0, 0.04]) {
          const leg = new Mesh(new BoxGeometry(0.01, 0.01, 0.14), antPaint);
          leg.position.set(at, 0.04, side * 0.05);
          ant.add(leg);
        }
      ant.scale.setScalar(1.5);
      this.antList.push(ant);
      this.ants.add(ant);
    }
    this.crumb = new Mesh(new BoxGeometry(0.14, 0.08, 0.12), this.filling);
    this.crumb.position.set(0, 0.24, 0);
    this.antList[0].add(this.crumb);
    this.scene.add(this.ants);

    // The golden spoon.
    const gold = paint('#ffd23f', {
      metalness: 0.7,
      roughness: 0.25,
      emissive: '#7a5200',
      emissiveIntensity: 0.3,
    });
    const bowl = ball(gold, 0.28, 0, 0, 0, [0.8, 0.25, 1.1], 18);
    const stem = new Mesh(new CylinderGeometry(0.05, 0.07, 1.1, 10), gold);
    stem.rotation.x = Math.PI / 2;
    stem.position.z = 0.75;
    this.spoon.add(bowl, stem);
    this.spoon.position.set(0, 2.4, -0.4);
    this.spoon.visible = false;
    this.scene.add(this.spoon);

    // Hearts that float up from happy friends.
    const heart = new Shape();
    heart.moveTo(0, -0.12);
    heart.bezierCurveTo(-0.22, 0.02, -0.12, 0.18, 0, 0.08);
    heart.bezierCurveTo(0.12, 0.18, 0.22, 0.02, 0, -0.12);
    this.heartGeometry = new ExtrudeGeometry(heart, { depth: 0.05, bevelEnabled: false });
    this.heartMaterial = paint('#ff5c86', { emissive: '#ff2f6a', emissiveIntensity: 0.35 });
  }

  setState(frame: PicnicFrame) {
    const first = !this.frame;
    this.frame = frame;
    if (frame.share !== this.shareIndex) {
      this.shareIndex = frame.share;
      this.servedAt = -10;
      this.crumbAt = -10;
    }
    const guestKey = frame.guests.join(',');
    if (guestKey !== this.guestKey) {
      this.guestKey = guestKey;
      this.buildGuests(frame.guests);
    }
    const joinedKey = frame.joined.join(',');
    if (joinedKey !== this.joinedKey) {
      this.joinedKey = joinedKey;
      this.buildJoined(frame.joined);
    }
    const foodKey = JSON.stringify(frame.foods) + frame.share;
    if (foodKey !== this.foodKey) {
      this.foodKey = foodKey;
      this.buildFoods(frame.foods);
    }
    if (frame.served && this.servedAt < 0) this.servedAt = this.elapsed;
    if (frame.crumbGone && this.crumbAt < 0) this.crumbAt = this.elapsed;
    const rights = this.rights.take(frame.rights);
    const wrongs = this.wrongs.take(frame.wrongs);
    const cuts = this.cuts.take(frame.cuts);
    if (!first) {
      if (rights) {
        this.munchAt = this.elapsed + SERVE_TIME * 0.7;
        this.burstHearts();
      }
      if (wrongs) this.frownAt = this.elapsed;
      if (cuts) this.cutAt = this.elapsed;
    }
    this.layoutBerries();
    if (frame.finished) this.burstHearts();
    this.draw();
  }

  // ---- Building ---------------------------------------------------------------------------------

  private buildMeadow() {
    const grass = new Mesh(new CircleGeometry(30, 48), paint('#8fd16a', { roughness: 1 }));
    grass.rotation.x = -Math.PI / 2;
    grass.receiveShadow = true;
    this.scene.add(grass);
    const hill = ball(paint('#79c25a', { roughness: 1 }), 12, 0, -9, -22, [1.6, 1, 0.6], 32);
    hill.castShadow = false;
    this.scene.add(hill);
    const trunk = paint('#8a5a34');
    const leaves = [paint('#4f9d3e'), paint('#62b14a'), paint('#3f8a3a')];
    const trees: [number, number, number][] = [
      [-8.5, -7, 1.3],
      [-5.5, -9, 1],
      [6.5, -8, 1.2],
      [9.5, -5.5, 1],
      [-10, -2, 0.9],
      [10.5, -1, 0.8],
    ];
    trees.forEach(([x, z, size], index) => {
      const tree = new Group();
      const stem = new Mesh(new CylinderGeometry(0.18, 0.25, 1.6, 8), trunk);
      stem.position.y = 0.8;
      stem.castShadow = true;
      tree.add(stem);
      if (index % 2) {
        const cone = new Mesh(new ConeGeometry(1.1, 2.6, 10), leaves[index % 3]);
        cone.position.y = 2.6;
        cone.castShadow = true;
        tree.add(cone);
      } else {
        tree.add(ball(leaves[index % 3], 1.2, 0, 2.5, 0, [1, 0.9, 1], 14));
        tree.add(ball(leaves[(index + 1) % 3], 0.8, 0.7, 2.1, 0.3, [1, 1, 1], 12));
      }
      tree.scale.setScalar(size);
      tree.position.set(x, 0, z);
      this.scene.add(tree);
    });
    // Flowers dotted over the meadow.
    const petals = ['#ffffff', '#ffd23f', '#ff9ccf', '#b9a3e3'].map((c) =>
      paint(c, { roughness: 0.6 }),
    );
    const flower = new SphereGeometry(0.09, 8, 6);
    for (let i = 0; i < 46; i++) {
      const angle = i * 2.39996;
      const radius = 4.2 + ((i * 37) % 70) / 10;
      const x = Math.cos(angle) * radius * 1.3;
      const z = Math.sin(angle) * radius * 0.8;
      if (z > 3) continue;
      const mesh = new Mesh(flower, petals[i % petals.length]);
      mesh.position.set(x, 0.08, z);
      this.scene.add(mesh);
    }
  }

  private buildGuests(kinds: readonly FriendKind[]) {
    this.clear(this.guests, true);
    this.clear(this.plates);
    this.critters = [];
    this.plateSpots = [];
    const count = kinds.length;
    const span = Math.min(BLANKET.width - 0.6, 0.95 * Math.max(1, count - 1));
    const scale = count > 8 ? 0.72 : count > 6 ? 0.85 : 1;
    kinds.forEach((kind, index) => {
      const x = count === 1 ? 0 : -span / 2 + (span * index) / (count - 1);
      // A gentle arc: the ends sit a little closer.
      const bend = count > 2 ? Math.abs(x / (span / 2 || 1)) ** 2 * 0.45 : 0;
      const critter = new Critter(kind, index);
      critter.root.position.set(x, 0, GUEST_Z + bend);
      critter.root.rotation.y = -x * 0.08;
      critter.root.scale.setScalar(scale);
      this.critters.push(critter);
      this.guests.add(critter.root);
      const plate = new Mesh(
        new CylinderGeometry(0.36 * scale + 0.04, 0.3 * scale, 0.05, 24),
        this.plateMaterial,
      );
      const spot = new Vector3(x, 0.03, PLATE_Z + bend);
      plate.position.copy(spot);
      plate.receiveShadow = true;
      this.plates.add(plate);
      this.plateSpots.push(spot);
    });
  }

  private buildJoined(kinds: readonly FriendKind[]) {
    this.clear(this.joined, true);
    this.joinedCritters = kinds.map((kind, index) => {
      const critter = new Critter(kind, index + 20);
      const x = BACK.x - (BACK.width - 1) / 2 + ((BACK.width - 1) * (index + 0.5)) / 12;
      critter.root.position.set(x, 0, BACK.z);
      critter.root.scale.setScalar(0.62);
      this.joined.add(critter.root);
      return critter;
    });
  }

  private buildFoods(foods: readonly FoodOnBlanket[]) {
    this.clear(this.foods);
    this.clear(this.covers);
    this.pieces = [];
    const spread = foods.length > 1 ? 1.65 : 0;
    foods.forEach((food, foodIndex) => {
      const centre = new Vector3(foods.length > 1 ? (foodIndex ? spread : -spread) : 0, 0, 0.45);
      if (food.covered) {
        const dome = ball(this.cloth, 0.95, centre.x, 0, centre.z, [1, 0.75, 1], 24);
        this.covers.add(dome);
        return;
      }
      const made =
        food.food === 'pie' || food.food === 'cake'
          ? this.roundPieces(food, centre, foods.length > 1 ? 0.85 : 1.15)
          : this.stripPieces(food, centre, foods.length > 1 ? 2.5 : 4.2);
      for (const piece of made) {
        this.foods.add(piece.mesh);
        this.pieces.push(piece);
      }
    });
    // Pieces go to the plates in order once served (a comparison stays on its blankets).
    if (foods.length === 1)
      this.pieces = this.pieces.map((piece, index) => ({
        ...piece,
        plate: this.plateSpots[index] ?? null,
      }));
  }

  private roundPieces(food: FoodOnBlanket, centre: Vector3, radius: number): Piece[] {
    const cake = food.food === 'cake';
    const height = cake ? 0.42 : 0.2;
    const total = food.sizes.reduce((a, b) => a + b, 0) || 1;
    const cut = food.sizes.length > 1;
    let start = 0;
    return food.sizes.map((size, index) => {
      const share = size / total;
      const middle = (start + share / 2) * Math.PI * 2;
      const geometry = new ExtrudeGeometry(
        cut
          ? wedgeShape(radius, start, start + share)
          : (() => {
              const s = new Shape();
              s.absarc(0, 0, radius, 0, Math.PI * 2, false);
              return s;
            })(),
        {
          depth: height,
          bevelEnabled: true,
          bevelThickness: 0.03,
          bevelSize: 0.03,
          bevelSegments: 2,
          curveSegments: 36,
        },
      );
      geometry.rotateX(-Math.PI / 2);
      const top: Material = food.shaded[index] ? this.jam : cake ? this.frosting : this.filling;
      const side: Material = cake ? this.sponge : this.crust;
      const mesh = new Mesh(geometry, [top, side]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const group = new Group();
      group.add(mesh);
      if (cake && !cut)
        for (const [x, z] of [
          [0, -0.4],
          [-0.35, 0.25],
          [0.35, 0.25],
        ])
          group.add(ball(this.cherry, 0.09, x, height + 0.1, z, [1, 1, 1], 10));
      const away = cut ? 0.07 : 0;
      const home = new Vector3(
        centre.x + Math.sin(middle) * away,
        0.05,
        centre.z - Math.cos(middle) * away,
      );
      group.position.copy(home);
      start += share;
      return { mesh: group, home, plate: null };
    });
  }

  private stripPieces(food: FoodOnBlanket, centre: Vector3, length: number): Piece[] {
    const ribbon = food.food === 'ribbon';
    const depth = ribbon ? 0.34 : 0.9;
    const height = ribbon ? 0.05 : 0.28;
    const total = food.sizes.reduce((a, b) => a + b, 0) || 1;
    const gap = food.sizes.length > 1 ? 0.07 : 0;
    const usable = length - gap * (food.sizes.length - 1);
    let x = centre.x - length / 2;
    return food.sizes.map((size, index) => {
      const width = (usable * size) / total;
      const jam = food.shaded[index];
      const top = ribbon ? (jam ? this.ribbonJam : this.ribbon) : jam ? this.jam : this.honey;
      const side = ribbon ? top : this.honeySide;
      const mesh = new Mesh(new BoxGeometry(width, height, depth), [
        side,
        side,
        top,
        side,
        side,
        side,
      ]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const home = new Vector3(x + width / 2, 0.05 + height / 2, centre.z);
      mesh.position.copy(home);
      x += width + gap;
      return { mesh, home, plate: null };
    });
  }

  /** Puts the berries in the basket and on the plates, rows of five on each plate. */
  private layoutBerries() {
    const berries = this.frame?.berries;
    this.basket.visible = !!berries;
    let index = 0;
    if (berries) {
      for (let i = 0; i < Math.min(berries.basket, MAX_BERRIES); i++, index++) {
        const ring = Math.floor(i / 12);
        const angle = i * 2.4;
        const radius = 0.15 + ((i * 7) % 5) * 0.1;
        this.dummy.position.set(
          this.basket.position.x + Math.cos(angle) * radius,
          0.45 + ring * 0.07,
          this.basket.position.z + Math.sin(angle) * radius * 0.9,
        );
        this.dummy.updateMatrix();
        this.basketBerries.setMatrixAt(i, this.dummy.matrix);
      }
    }
    this.basketBerries.count = index;
    this.basketBerries.instanceMatrix.needsUpdate = true;
    let onPlates = 0;
    if (berries)
      berries.plates.forEach((count, plate) => {
        const spot = this.plateSpots[plate];
        if (!spot) return;
        for (let i = 0; i < count && onPlates < MAX_BERRIES; i++, onPlates++) {
          const row = Math.floor(i / 5);
          this.dummy.position.set(
            spot.x - 0.2 + (i % 5) * 0.1,
            0.1 + Math.floor(row / 3) * 0.1,
            spot.z - 0.1 + (row % 3) * 0.1,
          );
          this.dummy.updateMatrix();
          this.plateBerries.setMatrixAt(onPlates, this.dummy.matrix);
        }
      });
    this.plateBerries.count = onPlates;
    this.plateBerries.instanceMatrix.needsUpdate = true;
  }

  private burstHearts() {
    if (this.calm) return;
    const spots = this.critters.length ? this.critters : this.joinedCritters;
    spots.slice(0, 8).forEach((critter, index) => {
      const mesh = new Mesh(this.heartGeometry, this.heartMaterial);
      mesh.position.copy(critter.root.position).add(new Vector3(0, 1.3, 0.2));
      this.scene.add(mesh);
      this.hearts.push({
        mesh,
        born: this.elapsed + index * 0.12 + SERVE_TIME * 0.6,
        drift: (index % 3) - 1,
      });
    });
  }

  /**
   * Empties a group. Friends own their materials and are freed whole; food, plates and covers
   * share this world's materials, so only their shapes are freed.
   */
  private clear(group: Group, own = false) {
    for (const child of [...group.children]) {
      group.remove(child);
      if (own) disposeTree(child);
      else
        child.traverse((object) => {
          if (object instanceof Mesh) object.geometry.dispose();
        });
    }
  }

  // ---- Camera -----------------------------------------------------------------------------------

  protected override layout(aspect: number) {
    this.camera.clearViewOffset();
    super.layout(aspect);
    // Pull back until the blanket, the guests' heads and the back blanket all fit.
    const points = [
      new Vector3(-BLANKET.width / 2, 0, BLANKET.depth / 2),
      new Vector3(BLANKET.width / 2, 0, BLANKET.depth / 2),
      new Vector3(-BLANKET.width / 2 - 0.2, 1.4, GUEST_Z),
      new Vector3(BLANKET.width / 2 + 0.2, 1.4, GUEST_Z),
      new Vector3(-BACK.width / 2 + 0.6, 0.9, BACK.z),
      new Vector3(BACK.width / 2 - 0.6, 0.9, BACK.z),
    ];
    // Wide boxes look across the meadow; tall ones look down more and keep the sky in view.
    const pitch = aspect > 1.6 ? 0.62 : aspect < 1 ? 0.6 : 0.72;
    let distance = 6;
    for (let tries = 0; tries < 80; tries++) {
      this.aim(distance, pitch);
      const fits = points.every((point) => {
        const p = this.probe.copy(point).project(this.camera);
        return Math.abs(p.x) < 0.94 && p.y < 0.92 && p.y > -0.95;
      });
      if (fits) break;
      distance *= 1.05;
    }
    // A tall box has room to spare above and below: centre the picnic in it, a touch low so
    // the trees and the sky show above the friends.
    let top = -Infinity;
    let bottom = Infinity;
    for (const point of points) {
      const p = this.probe.copy(point).project(this.camera);
      top = Math.max(top, p.y);
      bottom = Math.min(bottom, p.y);
    }
    const middle = (top + bottom) / 2 + 0.08;
    const { width, height } = this;
    this.camera.setViewOffset(width, height, 0, (-middle * height) / 2, width, height);
  }

  private aim(distance: number, pitch: number) {
    this.camera.position.set(0, 0.2 + Math.sin(pitch) * distance, 0.2 + Math.cos(pitch) * distance);
    this.camera.lookAt(0, 0.35, -0.9);
    this.camera.updateMatrixWorld();
  }

  // ---- Every frame ------------------------------------------------------------------------------

  protected update(dt: number, t: number) {
    const frame = this.frame;
    if (!frame) return;
    const calm = this.calm;
    // Pieces: parted while cutting, carried to the plates once served.
    const served = this.servedAt >= 0 ? smooth((t - this.servedAt) / SERVE_TIME) : 0;
    const cutPop = t - this.cutAt < 0.3 ? Math.sin(((t - this.cutAt) / 0.3) * Math.PI) * 0.05 : 0;
    this.pieces.forEach((piece, index) => {
      const lift = served > 0 && served < 1 && piece.plate ? Math.sin(served * Math.PI) * 0.8 : 0;
      const target = piece.plate && served > 0 ? piece.plate : piece.home;
      const from = piece.home;
      const s = piece.plate ? served : 0;
      piece.mesh.position.set(
        from.x + (target.x - from.x) * s,
        from.y + (target.y - from.y) * s + lift + cutPop,
        from.z + (target.z - from.z) * s,
      );
      const shrink = piece.plate ? 1 - s * 0.35 : 1;
      piece.mesh.scale.setScalar(shrink);
      // A slip makes the pieces wobble.
      const frown = t - this.frownAt;
      piece.mesh.rotation.z =
        frown < 0.8 && !calm ? Math.sin(frown * 30 + index) * 0.06 * (1 - frown / 0.8) : 0;
    });
    // Friends.
    const mood = {
      calm,
      munchAt: this.munchAt,
      frownAt: this.frownAt,
      dancing: frame.finished && !calm,
    };
    this.critters.forEach((critter) => critter.update(t, mood));
    for (const critter of this.joinedCritters)
      critter.update(t, { calm, munchAt: -10, frownAt: -10, dancing: frame.finished && !calm });
    // Plates wobble at a slip.
    const frown = t - this.frownAt;
    this.plates.children.forEach((plate, index) => {
      plate.rotation.z =
        frown < 0.8 && !calm ? Math.sin(frown * 26 + index) * 0.12 * (1 - frown / 0.8) : 0;
    });
    // The ant line.
    this.layoutAnts(t, frame.ants, calm);
    // The golden spoon.
    this.spoonShow = approach(this.spoonShow, frame.golden ? 1 : 0, 6, dt);
    this.spoon.visible = this.spoonShow > 0.02;
    this.spoon.scale.setScalar(Math.max(0.001, easeOutBack(this.spoonShow)));
    this.spoon.rotation.set(0.4, calm ? 0.6 : t * 1.4, 0.3);
    this.spoon.position.y = 2.4 + (calm ? 0 : Math.sin(t * 2) * 0.12);
    // Hearts float up and fade.
    for (let i = this.hearts.length - 1; i >= 0; i--) {
      const heart = this.hearts[i];
      const age = t - heart.born;
      heart.mesh.visible = age >= 0;
      if (age < 0) continue;
      heart.mesh.position.y += dt * 0.9;
      heart.mesh.position.x += Math.sin(age * 4) * dt * 0.3 * heart.drift;
      heart.mesh.scale.setScalar(Math.min(1, age * 4) * (1 - Math.max(0, age - 1.1) / 0.5));
      heart.mesh.rotation.y = Math.sin(age * 3) * 0.5;
      if (age > 1.6) {
        this.scene.remove(heart.mesh);
        this.hearts.splice(i, 1);
      }
    }
  }

  private layoutAnts(t: number, walk: number | null, calm: boolean) {
    this.ants.visible = walk !== null;
    if (walk === null) return;
    const gone = this.crumbAt >= 0 ? t - this.crumbAt : -1;
    this.crumb.visible = gone >= 0;
    this.antList.forEach((ant, index) => {
      // The line walks toward the blanket; once there, the leader turns and carries a crumb away.
      const behind = index * 0.32;
      const along = Math.max(0, Math.min(1, walk)) * ANT_START.distanceTo(ANT_END) - behind;
      const direction = this.probe.copy(ANT_END).sub(ANT_START).normalize();
      let x = ANT_START.x + direction.x * along;
      let z = ANT_START.z + direction.z * along;
      let heading = Math.atan2(-direction.z, direction.x);
      if (gone >= 0 && index === 0) {
        const back = Math.min(gone * 0.6, 4);
        x = ANT_END.x - direction.x * back + 0.2;
        z = ANT_END.z - direction.z * back + 0.25;
        heading += Math.PI;
      }
      const wiggle = calm ? 0 : Math.sin(t * 18 + index) * 0.02;
      ant.position.set(x, 0.01 + Math.abs(wiggle), z + wiggle);
      ant.rotation.y = heading;
    });
  }

  override dispose() {
    this.heartGeometry.dispose();
    this.heartMaterial.dispose();
    super.dispose();
  }
}
