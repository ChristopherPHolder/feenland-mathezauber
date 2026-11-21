import {
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  PointLight,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three';
import { approach, clamp01, easeOutBack, EventCounter, smooth } from '../../shared/three/motion';
import { Stage } from '../../shared/three/stage';
import type { StateWorld } from '../../shared/three/three-stage';
import { DISHES, PanThing, ScalesFrame, stackPan } from './scales-frame';
import { dialAngle, dialMarks, swing } from './scales-math';
import { Kit, makeItem, makeJug, makeThing } from './scales-models';

/** The beam turns here; its arms reach this far; the pans hang this far below. */
const PIVOT_Y = 3.5;
const ARM = 2.2;
const HANG = 1.45;
/** A pan is 100 layout units wide; this many world units each. */
const PAN_UNIT = 0.023;
/** Where the soup cauldron stands for each view: in front of the balance, beside the others. */
const CAULDRONS: Record<ScalesFrame['mode'], Vector3> = {
  balance: new Vector3(0, 0, 2.5),
  dial: new Vector3(2.3, 0, 1.3),
  pour: new Vector3(2.55, 0, 1.1),
};
const CAULDRON_SCALE = 0.7;
const GIANT = new Vector3(0.9, 0, -4.8);
const POT_X = 0.2;
const POT_HEIGHT = 2.3;
const POT_RADIUS = 0.95;
const DIAL_Y = 1.75;
const DIAL_R = 1.15;

/** Points each view must keep in frame: tall boxes, wide boxes. */
const VIEWS: Record<ScalesFrame['mode'], { tall: Vector3[]; wide: Vector3[] }> = {
  balance: {
    tall: [
      new Vector3(-3.2, 0.5, 0.9),
      new Vector3(3.2, 0.5, 0.9),
      new Vector3(0, 0, 3.1),
      new Vector3(-3.2, 4.6, 0),
      new Vector3(3.2, 4.6, 0),
      new Vector3(GIANT.x, 7.6, GIANT.z),
    ],
    wide: [
      new Vector3(-3.3, 0.5, 0.9),
      new Vector3(3.3, 0.5, 0.9),
      new Vector3(0, 0, 3.1),
      new Vector3(-3.3, 4.8, 0),
      new Vector3(3.3, 4.8, 0),
    ],
  },
  dial: {
    tall: [
      new Vector3(-2.0, 0.2, 0.8),
      new Vector3(2.0, 0.2, 0.8),
      new Vector3(-2.0, 5.0, 0),
      new Vector3(2.0, 5.0, 0),
    ],
    wide: [
      new Vector3(-2.6, 0, 1.6),
      new Vector3(3.2, 0, 1.6),
      new Vector3(-2.6, 5.0, 0),
      new Vector3(3.2, 5.0, 0),
    ],
  },
  pour: {
    tall: [
      new Vector3(-3.2, 0, 1),
      new Vector3(3.2, 0, 1),
      new Vector3(-3.2, 3.2, 0),
      new Vector3(3.2, 3.2, 0),
    ],
    wide: [
      new Vector3(-3.3, 0, 1.2),
      new Vector3(3.3, 0, 1.2),
      new Vector3(-3.3, 3.4, 0),
      new Vector3(3.3, 3.4, 0),
    ],
  },
};

interface Flier {
  readonly mesh: Object3D;
  readonly from: Vector3;
  readonly start: number;
}

/**
 * Bramble's open-air kitchen in 3D: the giant brass balance whose beam swings past level and
 * settles like a real one, the kitchen scale with its needle, the glass pot and jugs, the giant
 * himself steadying the beam, the soup cauldron that fills and glows, and the feast table. It
 * only draws the frame the game gives it; every control stays in the DOM.
 */
export class ScalesWorld extends Stage implements StateWorld<ScalesFrame> {
  private readonly kit = new Kit();
  private frame?: ScalesFrame;
  private readonly temp = new Vector3();
  private readonly look = new Vector3();
  private readonly probe = new Vector3();

  // The balance
  private readonly balance = new Group();
  private readonly beam = new Group();
  private readonly pans: Group[] = [];
  private readonly loads: Group[] = [new Group(), new Group()];
  private panKeys = ['', ''];
  private angle = 0;
  private speed = 0;

  // The kitchen scale
  private readonly kitchenScale = new Group();
  private readonly needle = new Group();
  private readonly dialCanvas = document.createElement('canvas');
  private readonly dialTexture: CanvasTexture;
  private readonly platformLoad = new Group();
  private dialKey = '';
  private needleAngle = -135;
  private needleSpeed = 0;

  // The pot and jugs
  private readonly potRig = new Group();
  private readonly water: Mesh;
  private readonly waterMaterial: MeshStandardMaterial;
  private readonly targetRing: Mesh;
  private readonly lineTag: Mesh;
  private readonly jugs = new Group();
  private jugKey = '';
  private waterLevel = 0;
  private pourStart = -10;

  // Bramble, the cauldron and the feast table
  private readonly giant = new Group();
  private readonly head = new Group();
  private readonly brows: Mesh[] = [];
  private readonly smile: Mesh;
  private readonly oops: Mesh;
  private readonly hand = new Group();
  private readonly arm: Mesh;
  private readonly shoulder = new Vector3(GIANT.x - 1.75, 4.5, GIANT.z);
  private readonly handAt = new Vector3(GIANT.x - 1.3, 2.6, GIANT.z + 1.9);
  private readonly soup: Mesh;
  private readonly soupMaterial: MeshStandardMaterial;
  private readonly bubbles: Mesh[] = [];
  private readonly foam: Mesh[] = [];
  private readonly glow: PointLight;
  private soupLevel = 0;
  private cauldron!: Group;
  private readonly dishes: Group[] = [];
  private readonly fliers: Flier[] = [];
  private readonly splashes: { mesh: Mesh; v: Vector3; start: number }[] = [];

  private readonly cooks = new EventCounter();
  private readonly slips = new EventCounter();
  private readonly adds = new EventCounter();
  private readonly pours = new EventCounter();
  private slipAt = -10;
  private mode: ScalesFrame['mode'] = 'balance';
  private readonly camTarget = new Vector3();
  private readonly camPosition = new Vector3();
  private readonly views = new Map<ScalesFrame['mode'], { position: Vector3; target: Vector3 }>();
  private snapCamera = true;

  constructor(canvas: HTMLCanvasElement, host: HTMLElement) {
    super(canvas, host, { fov: 36, shadows: true });
    this.fill.intensity = 1.5;
    this.sun.position.set(-4, 11, 8);
    this.sun.shadow.camera.left = -8;
    this.sun.shadow.camera.right = 8;
    this.sun.shadow.camera.top = 8;
    this.sun.shadow.camera.bottom = -8;
    this.buildGround();
    this.buildBalance();
    this.dialTexture = new CanvasTexture(this.dialCanvas);
    this.dialTexture.colorSpace = SRGBColorSpace;
    this.buildKitchenScale();
    ({
      water: this.water,
      material: this.waterMaterial,
      ring: this.targetRing,
      tag: this.lineTag,
    } = this.buildPot());
    ({ smile: this.smile, oops: this.oops, arm: this.arm } = this.buildGiant());
    ({ soup: this.soup, material: this.soupMaterial, glow: this.glow } = this.buildCauldron());
    this.buildTable();
  }

  // ---- Building ----------------------------------------------------------------------------

  private buildGround() {
    const grass = new Mesh(
      new CircleGeometry(18, 48),
      new MeshStandardMaterial({ color: '#9fcb72' }),
    );
    grass.rotation.x = -Math.PI / 2;
    grass.receiveShadow = true;
    const patio = new Mesh(
      new CircleGeometry(5.6, 40),
      new MeshStandardMaterial({ color: '#e9d6b0' }),
    );
    patio.rotation.x = -Math.PI / 2;
    patio.position.y = 0.01;
    patio.receiveShadow = true;
    this.scene.add(grass, patio);
    // A few hedges and trees far behind, for depth.
    const leaf = new MeshStandardMaterial({ color: '#6aa84f' });
    const ball = new SphereGeometry(1, 14, 10);
    for (const [x, z, s] of [
      [-7, -7, 1.8],
      [-4.5, -8.5, 1.4],
      [6.5, -7.5, 2],
      [9, -5, 1.5],
      [-9.5, -4, 1.6],
    ]) {
      const bush = new Mesh(ball, leaf);
      bush.position.set(x, s * 0.7, z);
      bush.scale.set(s, s * 0.9, s);
      this.scene.add(bush);
    }
  }

  private buildBalance() {
    const brass = this.kit.paint('#d8ac45', { metal: 0.65, rough: 0.3 });
    const dark = this.kit.paint('#8a6421', { metal: 0.5, rough: 0.4 });
    const base = new Mesh(new CylinderGeometry(0.85, 1.05, 0.28, 32), brass);
    base.position.y = 0.14;
    const step = new Mesh(new CylinderGeometry(0.55, 0.7, 0.2, 32), dark);
    step.position.y = 0.38;
    const column = new Mesh(new CylinderGeometry(0.12, 0.16, PIVOT_Y - 0.4, 16), brass);
    column.position.y = 0.4 + (PIVOT_Y - 0.4) / 2;
    const crown = new Mesh(new ConeGeometry(0.22, 0.5, 16), dark);
    crown.position.y = PIVOT_Y + 0.42;
    const knot = new Mesh(new SphereGeometry(0.2, 16, 12), dark);
    knot.position.y = PIVOT_Y;
    for (const part of [base, step, column, crown, knot]) part.castShadow = true;
    this.balance.add(base, step, column, crown, knot);

    this.beam.position.y = PIVOT_Y;
    const bar = new Mesh(new BoxGeometry(ARM * 2 + 0.3, 0.16, 0.18), brass);
    bar.castShadow = true;
    // A pointer that stands straight up when the beam is level.
    const pointer = new Mesh(new ConeGeometry(0.07, 0.7, 10), dark);
    pointer.position.y = 0.42;
    this.beam.add(bar, pointer);
    const chain = new CylinderGeometry(0.018, 0.018, 1, 6);
    const dish = new LatheGeometry(
      [
        [0.01, 0],
        [0.7, 0.02],
        [0.98, 0.16],
        [1.02, 0.2],
        [0.96, 0.2],
        [0.68, 0.08],
        [0.01, 0.07],
      ].map(([x, y]) => new Vector2(x, y)),
      32,
    );
    [-1, 1].forEach((side, index) => {
      const end = new Mesh(new SphereGeometry(0.13, 12, 8), dark);
      end.position.x = side * (ARM + 0.15);
      this.beam.add(end);
      const pan = new Group();
      pan.position.x = side * ARM;
      for (let k = 0; k < 3; k++) {
        const angle = (k / 3) * Math.PI * 2 + 0.5;
        const foot = new Vector3(Math.cos(angle) * 0.92, -HANG + 0.18, Math.sin(angle) * 0.92);
        const link = new Mesh(chain, dark);
        link.position.copy(foot).multiplyScalar(0.5);
        link.scale.y = foot.length();
        link.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), foot.clone().normalize());
        pan.add(link);
      }
      const plate = new Mesh(dish, brass);
      plate.position.y = -HANG;
      plate.castShadow = true;
      plate.receiveShadow = true;
      this.loads[index].position.y = -HANG + 0.08;
      pan.add(plate, this.loads[index]);
      this.beam.add(pan);
      this.pans.push(pan);
    });
    this.balance.add(this.beam);
    this.scene.add(this.balance);
  }

  private buildKitchenScale() {
    const pink = this.kit.paint('#e2467c', { rough: 0.5 });
    const body = new Mesh(new BoxGeometry(2.9, 3.2, 1.1), pink);
    body.position.y = 1.6;
    body.castShadow = true;
    const top = new Mesh(
      new CylinderGeometry(1.2, 1.1, 0.12, 32),
      this.kit.paint('#d8ac45', { metal: 0.6, rough: 0.3 }),
    );
    top.position.y = 3.27;
    const rim = new Mesh(new TorusGeometry(DIAL_R + 0.06, 0.07, 10, 48), this.kit.paint('#8c1f49'));
    rim.position.set(0, DIAL_Y, 0.57);
    const face = new Mesh(
      new CircleGeometry(DIAL_R, 64),
      new MeshBasicMaterial({ map: this.dialTexture }),
    );
    face.position.set(0, DIAL_Y, 0.56);
    this.needle.position.set(0, DIAL_Y, 0.6);
    const hand = new Mesh(new BoxGeometry(0.05, DIAL_R * 0.86, 0.02), this.kit.paint('#d8343b'));
    hand.position.y = DIAL_R * 0.4;
    const hub = new Mesh(new CylinderGeometry(0.08, 0.08, 0.06, 16), this.kit.paint('#3a2418'));
    hub.rotation.x = Math.PI / 2;
    this.needle.add(hand, hub);
    this.platformLoad.position.y = 3.33;
    this.kitchenScale.add(body, top, rim, face, this.needle, this.platformLoad);
    this.kitchenScale.visible = false;
    this.scene.add(this.kitchenScale);
  }

  private buildPot() {
    const glass = new Mesh(
      new CylinderGeometry(POT_RADIUS, POT_RADIUS * 0.94, POT_HEIGHT, 32, 1, true),
      new MeshStandardMaterial({
        color: '#bfe3f7',
        transparent: true,
        opacity: 0.4,
        roughness: 0.1,
        depthWrite: false,
        side: DoubleSide,
      }),
    );
    glass.position.y = POT_HEIGHT / 2 + 0.06;
    const floor = new Mesh(
      new CylinderGeometry(POT_RADIUS * 0.94, POT_RADIUS * 0.94, 0.06, 32),
      this.kit.paint('#4d7f9e'),
    );
    floor.position.y = 0.03;
    const lip = new Mesh(new TorusGeometry(POT_RADIUS, 0.04, 8, 40), this.kit.paint('#4d7f9e'));
    lip.rotation.x = Math.PI / 2;
    lip.position.y = POT_HEIGHT + 0.06;
    const material = new MeshStandardMaterial({
      color: '#5fb2e6',
      transparent: true,
      opacity: 0.85,
    });
    const water = new Mesh(
      new CylinderGeometry(POT_RADIUS * 0.92, POT_RADIUS * 0.9, 1, 32),
      material,
    );
    water.position.y = 0.06;
    water.scale.y = 0.001;
    const ring = new Mesh(
      new TorusGeometry(POT_RADIUS + 0.03, 0.035, 8, 48),
      this.kit.paint('#e2467c', { emissive: '#e2467c' }),
    );
    ring.rotation.x = Math.PI / 2;
    const tag = new Mesh(new PlaneGeometry(1, 0.5), this.kit.label('…'));
    tag.scale.setScalar(0.95);
    const pot = new Group();
    pot.position.x = POT_X;
    pot.add(water, glass, floor, lip, ring, tag);
    this.potRig.add(pot, this.jugs);
    this.potRig.visible = false;
    this.scene.add(this.potRig);
    return { water, material, ring, tag };
  }

  private buildGiant() {
    const skin = this.kit.paint('#e9b48a', { rough: 0.7 });
    const shirt = this.kit.paint('#5d8a5a', { rough: 0.85 });
    // A round giant: big belly, broad shoulders, a short neck.
    const body = new Mesh(
      new LatheGeometry(
        [
          [0.01, 0],
          [1.7, 0.05],
          [2.15, 1.4],
          [2.2, 2.6],
          [1.95, 4.1],
          [1.3, 4.9],
          [0.6, 5.2],
          [0.01, 5.25],
        ].map(([x, y]) => new Vector2(x, y)),
        32,
      ),
      shirt,
    );
    const apron = new Mesh(
      new LatheGeometry(
        [
          [1.74, 0.1],
          [2.18, 1.4],
          [2.23, 2.6],
          [2.05, 3.5],
        ].map(([x, y]) => new Vector2(x, y)),
        24,
        -0.75,
        1.5,
      ),
      this.kit.paint('#f3efe2'),
    );
    this.head.position.y = 6.35;
    const face = new Mesh(new SphereGeometry(1.25, 28, 20), skin);
    const nose = new Mesh(new SphereGeometry(0.3, 16, 12), this.kit.paint('#d98e6a'));
    nose.position.set(0, 0, 1.22);
    const beard = new Mesh(
      new SphereGeometry(1.15, 24, 16),
      this.kit.paint('#8a5a36', { rough: 0.95 }),
    );
    beard.position.set(0, -1.15, 0.35);
    beard.scale.set(1.05, 0.7, 0.75);
    const hat = new Mesh(new CylinderGeometry(1.0, 1.15, 0.9, 24), this.kit.paint('#5a3f8c'));
    hat.position.y = 1.15;
    const brim = new Mesh(new CylinderGeometry(1.45, 1.45, 0.12, 28), this.kit.paint('#7c5bb5'));
    brim.position.y = 0.75;
    const eye = new SphereGeometry(0.14, 12, 10);
    const ink = this.kit.paint('#2b1a10');
    const brow = new BoxGeometry(0.42, 0.09, 0.08);
    for (const side of [-1, 1]) {
      const pupil = new Mesh(eye, ink);
      pupil.position.set(side * 0.42, 0.28, 1.12);
      const cheek = new Mesh(eye, this.kit.paint('#f19a8a'));
      cheek.scale.set(1.8, 1, 0.6);
      cheek.position.set(side * 0.72, -0.12, 1.0);
      const line = new Mesh(brow, this.kit.paint('#6b4226'));
      line.position.set(side * 0.42, 0.58, 1.1);
      this.brows.push(line);
      this.head.add(pupil, cheek, line);
    }
    const smile = new Mesh(new TorusGeometry(0.3, 0.06, 8, 20, Math.PI), ink);
    smile.rotation.z = Math.PI;
    smile.position.set(0, -0.32, 1.2);
    const oops = new Mesh(new TorusGeometry(0.13, 0.06, 8, 20), ink);
    oops.position.set(0, -0.42, 1.2);
    oops.visible = false;
    this.head.add(face, nose, beard, hat, brim, smile, oops);
    // His left arm rests on his belly; the right one reaches for the beam.
    const sleeve = new CylinderGeometry(0.42, 0.5, 1, 16);
    const rest = new Mesh(sleeve, shirt);
    const from = new Vector3(1.75, 4.5, 0);
    const to = new Vector3(1.1, 2.6, 1.9);
    rest.position.copy(from).add(to).multiplyScalar(0.5);
    rest.scale.y = from.distanceTo(to);
    rest.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), to.clone().sub(from).normalize());
    const restHand = new Mesh(new SphereGeometry(0.55, 18, 14), skin);
    restHand.position.copy(to);
    this.giant.add(body, apron, this.head, rest, restHand);
    this.giant.position.set(GIANT.x, 0, GIANT.z);
    const palm = new Mesh(new SphereGeometry(0.55, 18, 14), skin);
    palm.scale.set(1.1, 0.7, 0.9);
    const thumb = new Mesh(new SphereGeometry(0.22, 12, 8), skin);
    thumb.position.set(0.42, 0.05, 0.3);
    this.hand.add(palm, thumb);
    const arm = new Mesh(sleeve, shirt);
    this.scene.add(this.giant, this.hand, arm);
    return { smile, oops, arm };
  }

  private buildCauldron() {
    const iron = this.kit.paint('#3b3b46', { metal: 0.4, rough: 0.6 });
    const pot = new Mesh(
      new LatheGeometry(
        [
          [0.01, 0],
          [0.6, 0.05],
          [0.95, 0.45],
          [1.0, 0.85],
          [0.9, 1.15],
          [0.98, 1.22],
          [0.86, 1.22],
          [0.8, 1.12],
          [0.01, 1.1],
        ].map(([x, y]) => new Vector2(x, y)),
        32,
      ),
      iron,
    );
    pot.position.y = 0.25;
    pot.castShadow = true;
    const legs = new CylinderGeometry(0.08, 0.06, 0.35, 8);
    const group = new Group();
    for (let k = 0; k < 3; k++) {
      const leg = new Mesh(legs, iron);
      const a = (k / 3) * Math.PI * 2;
      leg.position.set(Math.cos(a) * 0.6, 0.17, Math.sin(a) * 0.6);
      group.add(leg);
    }
    const fire = new Mesh(
      new ConeGeometry(0.45, 0.4, 8),
      this.kit.paint('#ff9a1f', { emissive: '#ff6a00' }),
    );
    fire.position.y = 0.2;
    const material = new MeshStandardMaterial({ color: DISHES[0].color, roughness: 0.4 });
    const soup = new Mesh(new CircleGeometry(0.86, 32), material);
    soup.rotation.x = -Math.PI / 2;
    soup.position.y = 0.9;
    const bubble = new SphereGeometry(0.08, 10, 8);
    for (let k = 0; k < 5; k++) {
      const b = new Mesh(bubble, material);
      this.bubbles.push(b);
      group.add(b);
    }
    const foamMaterial = this.kit.paint('#fff7e6', { rough: 0.9 });
    const puff = new SphereGeometry(0.28, 12, 8);
    for (let k = 0; k < 7; k++) {
      const f = new Mesh(puff, foamMaterial);
      const a = (k / 7) * Math.PI * 2;
      f.position.set(Math.cos(a) * 0.85, 1.42, Math.sin(a) * 0.85);
      f.visible = false;
      this.foam.push(f);
      group.add(f);
    }
    const glow = new PointLight('#ffd23f', 0, 6);
    glow.position.y = 2;
    group.add(pot, fire, soup, glow);
    group.position.copy(CAULDRONS.balance);
    group.scale.setScalar(CAULDRON_SCALE);
    this.cauldron = group;
    this.scene.add(group);
    return { soup, material, glow };
  }

  private buildTable() {
    const wood = this.kit.paint('#a0703c', { rough: 0.85 });
    const table = new Group();
    const top = new Mesh(new BoxGeometry(4.4, 0.16, 1.5), wood);
    top.position.y = 1.15;
    top.castShadow = true;
    table.add(top);
    const leg = new BoxGeometry(0.14, 1.1, 0.14);
    for (const [x, z] of [
      [-2, -0.6],
      [2, -0.6],
      [-2, 0.6],
      [2, 0.6],
    ]) {
      const part = new Mesh(leg, wood);
      part.position.set(x, 0.55, z);
      table.add(part);
    }
    const plate = new CylinderGeometry(0.28, 0.24, 0.05, 20);
    const dome = new SphereGeometry(0.22, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    const china = this.kit.paint('#f7f3ea', { rough: 0.3 });
    for (let index = 0; index < 12; index++) {
      const x = -1.75 + (index % 6) * 0.7;
      const z = index < 6 ? -0.35 : 0.35;
      const dish = new Mesh(plate, china);
      dish.position.set(x, 1.26, z);
      const food = new Group();
      const heap = new Mesh(dome, this.kit.paint(DISHES[index].color, { rough: 0.6 }));
      const cream = new Mesh(dome, this.kit.paint(DISHES[index].top, { rough: 0.6 }));
      cream.scale.set(0.55, 0.5, 0.55);
      cream.position.y = 0.16;
      food.add(heap, cream);
      food.position.set(x, 1.28, z);
      food.visible = false;
      this.dishes.push(food);
      table.add(dish, food);
    }
    table.position.set(-3.6, 0, -3.6);
    table.rotation.y = 0.18;
    this.scene.add(table);
  }

  // ---- State -------------------------------------------------------------------------------

  setState(frame: ScalesFrame) {
    const first = !this.frame;
    const newLine = !first && this.frame!.line !== frame.line;
    this.frame = frame;
    if (frame.mode !== this.mode) {
      this.mode = frame.mode;
      this.layoutCamera();
    }
    this.balance.visible = frame.mode === 'balance';
    this.kitchenScale.visible = frame.mode === 'dial';
    this.potRig.visible = frame.mode === 'pour';
    this.fillPan(0, frame.left, newLine || first);
    this.fillPan(1, frame.right, newLine || first);
    if (frame.dial) this.paintDial(frame);
    if (frame.pot) this.setupPot(frame);
    if (newLine) {
      // A fresh line starts from the beam's resting place for what is on it.
      this.speed = 0;
      this.waterLevel = 0;
      this.needleAngle = -135;
      this.needleSpeed = 0;
    }
    frame.dishes.forEach((cooked, index) => {
      if (this.dishes[index]) this.dishes[index].visible = cooked;
    });
    this.soupMaterial.color.set(frame.soupColor);
    if (this.cooks.take(frame.cooks)) this.launch(frame);
    if (this.slips.take(frame.slips)) this.slipAt = this.elapsed;
    if (this.adds.take(frame.adds)) this.speed += this.calm ? 0 : -0.25;
    if (this.pours.take(frame.pours)) this.pourStart = this.elapsed;
    this.smile.visible = frame.mood !== 'oops';
    this.oops.visible = frame.mood === 'oops';
    if (first || this.calm) this.draw();
  }

  /** Puts the things on one pan, dropping in only the ones the child just added. */
  private fillPan(index: number, things: readonly PanThing[], fresh: boolean) {
    const key = things.map((t) => `${t.kind}:${t.item}:${t.label}:${t.size.toFixed(2)}`).join('|');
    if (key === this.panKeys[index]) return;
    const before = fresh ? 0 : this.loads[index].children.length;
    this.panKeys[index] = key;
    const load = this.loads[index];
    load.clear();
    const placed = stackPan(things);
    things.forEach((thing, at) => {
      const spot = placed[at];
      const object = makeThing(this.kit, thing);
      const w = spot.w * PAN_UNIT;
      const h = spot.h * PAN_UNIT;
      object.scale.set(w, h, Math.min(w, 0.9));
      object.position.set(spot.x * PAN_UNIT, spot.y * PAN_UNIT, (at % 2) * 0.12 - 0.06);
      object.userData['rest'] = object.position.y;
      object.userData['born'] = thing.added && at >= before && !fresh ? this.elapsed : -10;
      load.add(object);
    });
  }

  private paintDial(frame: ScalesFrame) {
    const view = frame.dial!;
    const key = `${view.dial.max}/${view.dial.step}/${view.dial.label}/${view.labels.join(',')}/${view.unit}/${view.item}`;
    if (key === this.dialKey) return;
    this.dialKey = key;
    this.platformLoad.clear();
    const item = makeItem(this.kit, view.item);
    item.scale.setScalar(1.5);
    this.platformLoad.add(item);
    const paint = () => {
      const canvas = this.dialCanvas;
      canvas.width = canvas.height = 512;
      const c = canvas.getContext('2d');
      if (!c) return;
      const mid = 256;
      c.fillStyle = '#fff7e6';
      c.fillRect(0, 0, 512, 512);
      c.lineCap = 'round';
      c.strokeStyle = '#3a2418';
      c.fillStyle = '#3a2418';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      let label = 0;
      for (const mark of dialMarks(view.dial)) {
        const rad = (mark.angle * Math.PI) / 180;
        const outer = 238;
        const inner = mark.labelled ? 196 : mark.half ? 208 : 218;
        c.lineWidth = mark.labelled ? 9 : 5;
        c.beginPath();
        c.moveTo(mid + Math.sin(rad) * inner, mid - Math.cos(rad) * inner);
        c.lineTo(mid + Math.sin(rad) * outer, mid - Math.cos(rad) * outer);
        c.stroke();
        if (mark.labelled) {
          const text = view.labels[label++] ?? '';
          c.font = `600 ${text.length > 3 ? 40 : 48}px Fredoka, system-ui, sans-serif`;
          c.fillText(text, mid + Math.sin(rad) * 152, mid - Math.cos(rad) * 152);
        }
      }
      c.fillStyle = '#8c1f49';
      c.font = '600 54px Fredoka, system-ui, sans-serif';
      c.fillText(view.unit, mid, mid + 110);
      this.dialTexture.needsUpdate = true;
    };
    paint();
    void document.fonts?.ready.then(() => {
      if (this.dialKey === key) {
        paint();
        this.draw();
      }
    });
  }

  private setupPot(frame: ScalesFrame) {
    const pot = frame.pot!;
    const key = `${frame.line}:${pot.capacity}:${pot.target}:${pot.line}:${pot.jugs.map((j) => j.label).join(',')}`;
    if (key === this.jugKey) return;
    this.jugKey = key;
    const height = (pot.target / pot.capacity) * (POT_HEIGHT - 0.1) + 0.06;
    this.targetRing.position.y = height;
    this.lineTag.position.set(0, height + 0.32, POT_RADIUS + 0.05);
    this.lineTag.material = this.kit.label(pot.line, '#fff7e6', '#8c1f49', '#e2467c');
    this.waterMaterial.color.set(
      pot.item === 'milk' ? '#fbfaf5' : pot.item === 'juice' ? '#c2357a' : '#5fb2e6',
    );
    this.jugs.clear();
    const biggest = Math.max(...pot.jugs.map((jug) => jug.amount));
    pot.jugs.forEach((jug, index) => {
      const scale = 0.62 + 0.55 * Math.sqrt(jug.amount / biggest);
      const group = makeJug(this.kit);
      group.scale.setScalar(scale);
      group.position.set(-2.75 + index * 0.85, 0, 0.6 - index * 0.1);
      group.userData['amount'] = jug.amount;
      group.userData['home'] = group.position.clone();
      const tag = new Mesh(
        new PlaneGeometry(1, 0.5),
        this.kit.label(jug.label, '#dff1fb', '#1f4a66', '#4d7f9e'),
      );
      tag.position.set(0, 1.42, 0.1);
      tag.scale.setScalar(0.9 / scale);
      group.add(tag);
      this.jugs.add(group);
    });
  }

  /** The cooked food flies from the scale into the cauldron with a splash. */
  private launch(frame: ScalesFrame) {
    const from = new Vector3();
    if (frame.mode === 'balance') this.loads[0].getWorldPosition(from);
    else if (frame.mode === 'dial') this.platformLoad.getWorldPosition(from);
    else from.set(POT_X, POT_HEIGHT, 0);
    const blob = new Mesh(
      this.kit.geometry('blob', () => new SphereGeometry(0.28, 14, 10)),
      this.kit.paint(frame.soupColor),
    );
    blob.position.copy(from);
    this.scene.add(blob);
    this.fliers.push({ mesh: blob, from, start: this.elapsed });
  }

  // ---- Camera ------------------------------------------------------------------------------

  protected override layout(aspect: number) {
    super.layout(aspect);
    this.views.clear();
    this.layoutCamera();
    this.snapCamera = true;
  }

  private layoutCamera() {
    const view = this.views.get(this.mode) ?? this.fit(this.mode);
    this.views.set(this.mode, view);
    this.camTarget.copy(view.target);
    this.camPosition.copy(view.position);
  }

  /** Pulls the camera back until the view's points fit, then centres them on screen. */
  private fit(mode: ScalesFrame['mode']) {
    const aspect = this.width / this.height;
    const points = aspect < 1.25 ? VIEWS[mode].tall : VIEWS[mode].wide;
    const target = new Vector3();
    for (const point of points) target.add(point);
    target.multiplyScalar(1 / points.length);
    target.z = 0;
    const camera = this.camera.clone();
    const pitch = 0.22;
    let distance = 6;
    const bounds = () => {
      camera.position.set(
        target.x,
        target.y + Math.sin(pitch) * distance,
        Math.cos(pitch) * distance,
      );
      camera.lookAt(target);
      camera.updateMatrixWorld();
      const box = { left: 1, right: -1, top: -1, bottom: 1 };
      for (const point of points) {
        const { x, y } = this.probe.copy(point).project(camera);
        box.left = Math.min(box.left, x);
        box.right = Math.max(box.right, x);
        box.top = Math.max(box.top, y);
        box.bottom = Math.min(box.bottom, y);
      }
      return box;
    };
    for (let pass = 0; pass < 3; pass++) {
      distance = 4;
      let box = bounds();
      while ((box.right - box.left > 1.9 || box.top - box.bottom > 1.86) && distance < 60) {
        distance *= 1.03;
        box = bounds();
      }
      // Move the aim so the framed points sit in the middle.
      const half = distance * Math.tan((camera.fov * Math.PI) / 360);
      target.y += ((box.top + box.bottom) / 2) * half;
      target.x += ((box.left + box.right) / 2) * half * aspect;
    }
    bounds();
    return { position: camera.position.clone(), target };
  }

  // ---- Frame loop --------------------------------------------------------------------------

  protected update(dt: number, t: number) {
    const frame = this.frame;
    if (!frame) return;
    const calm = this.calm;

    // The camera glides to the scale, the dial or the pot.
    const rate = this.snapCamera || calm ? 1e6 : 3;
    this.snapCamera = false;
    this.camera.position.set(
      approach(this.camera.position.x, this.camPosition.x, rate, dt),
      approach(this.camera.position.y, this.camPosition.y, rate, dt),
      approach(this.camera.position.z, this.camPosition.z, rate, dt),
    );
    this.look.set(
      approach(this.look.x, this.camTarget.x, rate, dt),
      approach(this.look.y, this.camTarget.y, rate, dt),
      0,
    );
    this.camera.lookAt(this.look);

    // The beam: a damped spring past level and back, like real brass.
    if (calm) {
      this.angle = frame.tilt;
      this.speed = 0;
    } else
      ({ angle: this.angle, speed: this.speed } = swing(this.angle, this.speed, frame.tilt, dt));
    this.beam.rotation.z = this.angle;
    for (const pan of this.pans) pan.rotation.z = -this.angle;
    for (const load of this.loads)
      for (const thing of load.children) {
        const born = thing.userData['born'] as number;
        const rest = thing.userData['rest'] as number;
        const age = t - born;
        thing.position.y = calm || age > 0.5 ? rest : rest + (1 - easeOutBack(age / 0.5)) * 1.2;
      }

    // The needle swings to its mark with a little overshoot.
    if (frame.dial) {
      const goal = dialAngle(frame.dial.dial, frame.dial.value);
      if (calm) this.needleAngle = goal;
      else
        ({ angle: this.needleAngle, speed: this.needleSpeed } = swing(
          this.needleAngle,
          this.needleSpeed,
          goal,
          dt,
          22,
          4,
        ));
      this.needle.rotation.z = (-this.needleAngle * Math.PI) / 180;
    }

    // The pot fills, and the jug that poured tips over it.
    if (frame.pot) {
      const goal = Math.min(1, frame.pot.filled / frame.pot.capacity);
      this.waterLevel = calm ? goal : approach(this.waterLevel, goal, 4, dt);
      const h = Math.max(0.001, this.waterLevel * (POT_HEIGHT - 0.1));
      this.water.scale.y = h;
      this.water.position.y = 0.06 + h / 2;
      const age = t - this.pourStart;
      for (const jug of this.jugs.children) {
        const home = jug.userData['home'] as Vector3;
        const pouring = jug.userData['amount'] === frame.pot.lastJug && age < 1 && !calm;
        const lift = pouring ? Math.sin(Math.min(1, age) * Math.PI) : 0;
        jug.position.set(
          home.x + (POT_X - 0.9 - home.x) * lift,
          home.y + lift * (POT_HEIGHT - 0.4),
          home.z * (1 - lift),
        );
        jug.rotation.z = -lift * 1.6;
      }
    }

    // Bramble: a slow breath, brows up or knitted, and a hand on the beam while he holds it.
    const breath = calm ? 0 : Math.sin(t * 1.3) * 0.05;
    this.head.position.y = 6.35 + breath;
    const knit = frame.mood === 'oops' ? 0.25 : frame.mood === 'happy' ? -0.12 : 0;
    this.brows.forEach((brow, index) => {
      brow.rotation.z = approach(brow.rotation.z, (index ? -1 : 1) * knit, 8, dt);
    });
    const shake = !calm && t - this.slipAt < 0.6 ? Math.sin((t - this.slipAt) * 40) * 0.06 : 0;
    this.head.rotation.z = shake;
    const holding = frame.held && frame.mode === 'balance';
    const goal = holding
      ? this.temp.set(0, PIVOT_Y + 1.0, 0.1)
      : this.probe.set(GIANT.x - 1.3, 2.6, GIANT.z + 1.9);
    const handRate = calm ? 1e6 : 6;
    this.handAt.set(
      approach(this.handAt.x, goal.x, handRate, dt),
      approach(this.handAt.y, goal.y, handRate, dt),
      approach(this.handAt.z, goal.z, handRate, dt),
    );
    this.hand.position.copy(this.handAt);
    const along = this.probe.copy(this.handAt).sub(this.shoulder);
    this.arm.position.copy(this.shoulder).addScaledVector(along, 0.5);
    this.arm.scale.y = along.length();
    this.arm.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), along.normalize());

    // The cauldron moves aside for the dial and the pot.
    const spot = CAULDRONS[frame.mode];
    this.cauldron.position.set(
      approach(this.cauldron.position.x, spot.x, rate, dt),
      0,
      approach(this.cauldron.position.z, spot.z, rate, dt),
    );

    // The cauldron: it fills a share per line, bubbles, glows gold on a streak, foams over.
    this.soupLevel = calm ? frame.soup : approach(this.soupLevel, frame.soup, 2, dt);
    this.soup.position.y = 0.55 + this.soupLevel * 0.75;
    this.bubbles.forEach((bubble, index) => {
      const phase = (t * 0.8 + index * 0.37) % 1;
      const a = index * 2.1;
      bubble.position.set(
        Math.cos(a) * 0.45,
        this.soup.position.y + (calm ? 0.02 : smooth(phase) * 0.12),
        Math.sin(a) * 0.45,
      );
      bubble.scale.setScalar(calm ? 0.6 : 0.4 + phase * 0.8);
    });
    for (const [index, puff] of this.foam.entries()) {
      puff.visible = frame.bubbling;
      puff.scale.setScalar(calm ? 1 : 0.8 + Math.sin(t * 4 + index) * 0.2);
    }
    this.glow.intensity = approach(this.glow.intensity, frame.golden ? 6 : 0, 3, dt);

    // Food flying into the pot, and the splash.
    for (let index = this.fliers.length - 1; index >= 0; index--) {
      const flier = this.fliers[index];
      const k = clamp01((t - flier.start) / (calm ? 0.01 : 0.9));
      const to = this.probe.copy(this.cauldron.position).setY(1.2 * CAULDRON_SCALE);
      flier.mesh.position.lerpVectors(flier.from, to, k);
      flier.mesh.position.y += Math.sin(k * Math.PI) * 2.2;
      if (k >= 1) {
        this.scene.remove(flier.mesh);
        this.fliers.splice(index, 1);
        if (!calm) this.splash();
      }
    }
    for (let index = this.splashes.length - 1; index >= 0; index--) {
      const drop = this.splashes[index];
      const age = t - drop.start;
      drop.mesh.position.addScaledVector(drop.v, dt);
      drop.v.y -= 9 * dt;
      if (age > 0.8) {
        this.scene.remove(drop.mesh);
        this.splashes.splice(index, 1);
      }
    }
  }

  private splash() {
    const geometry = this.kit.geometry('drop', () => new SphereGeometry(0.07, 8, 6));
    const material = this.soupMaterial;
    for (let k = 0; k < 9; k++) {
      const drop = new Mesh(geometry, material);
      drop.position.copy(this.cauldron.position).setY(1.2 * CAULDRON_SCALE);
      const a = (k / 9) * Math.PI * 2;
      this.scene.add(drop);
      this.splashes.push({
        mesh: drop,
        v: new Vector3(Math.cos(a) * 1.2, 2.6 + (k % 3) * 0.5, Math.sin(a) * 1.2),
        start: this.elapsed,
      });
    }
  }

  override dispose() {
    super.dispose();
    this.kit.dispose();
    this.dialTexture.dispose();
  }
}
