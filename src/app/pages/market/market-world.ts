import {
  BackSide,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Euler,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  PointLight,
  RepeatWrapping,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
} from 'three';
import {
  approach,
  bounce,
  clamp01,
  easeOut,
  easeOutBack,
  EventCounter,
  shake,
  smooth,
} from '../../shared/three/motion';
import { Stage } from '../../shared/three/stage';
import type { StateWorld } from '../../shared/three/three-stage';
import { MarketFrame, MONEY_LOOK } from './market-frame';
import { GOOD_IDS, GoodId } from './market-levels';
import {
  buildGood,
  buildLumi,
  buildMoney,
  buildOlli,
  buildPriceTag,
  Kit,
  Lumi,
  moneyWidth,
  Olli,
  PriceTag,
  roundedBox,
} from './market-models';
import { Denomination } from './market-money';

/** The counter's top surface. */
const TOP = 1.07;
/** Where things stand on the counter. */
const GOOD_AT = new Vector3(1.0, TOP, 0.36);
const TAG_AT = new Vector3(1.68, TOP, 0.42);
const TILL_AT = new Vector3(-1.72, TOP, 0.3);
const TRAY_AT = new Vector3(-0.42, TOP, 0.42);
const OLLI_AT = new Vector3(-0.45, 0.22, -0.62);
const LUMI_AT = new Vector3(2.55, 0.78, 0.78);
/** The tray's inner size, in its own plane, and how far it leans back. */
const TRAY_W = 2.05;
const TRAY_H = 0.64;
const TRAY_LEAN = -0.95;
/** The hollow tree: its wall is a cylinder round this centre. */
const TREE_CENTRE = new Vector3(0, 0, 1.2);
const TREE_RADIUS = 4.6;

/** Where treats sit in Lumi's basket, most visible first. */
const BASKET_SLOTS: readonly (readonly [number, number, number])[] = [
  [0.0, 0.06, 0.08],
  [-0.1, 0.03, 0.01],
  [0.1, 0.03, 0.01],
  [-0.05, 0.05, -0.07],
  [0.06, 0.05, -0.07],
  [0.0, 0.02, -0.02],
];

/**
 * The pay animation, in seconds after the till is asked to ring. The page can wait for
 * `PAY_SECONDS.landed` before it shows the reward card.
 */
export const PAY_SECONDS = {
  /** The coins slide off the tray into the till. */
  coinsGone: 0.6,
  /** The drawer pops open with a ring. */
  ring: 0.35,
  /** The treat starts its hop into the basket (or back to the shelf). */
  lift: 0.5,
  /** It lands; Lumi does a little hop. */
  landed: 1.2,
  /** Everything has settled. */
  done: 1.55,
} as const;

/** Tray pieces: where each coin or note sits in the tray's plane, wrapping into two rows. */
export function trayLayout(values: readonly Denomination[]): {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
}[] {
  if (!values.length) return [];
  const gap = 0.05;
  const room = TRAY_W - 0.14;
  for (let scale = 1; ; scale *= 0.88) {
    const rows: number[][] = [[]];
    let width = 0;
    values.forEach((value, index) => {
      const w = moneyWidth(value) * scale;
      if (width + w > room && rows.at(-1)!.length) {
        rows.push([]);
        width = 0;
      }
      rows.at(-1)!.push(index);
      width += w + gap * scale;
    });
    if (rows.length <= 2 || scale < 0.4) {
      const places: { x: number; y: number; scale: number }[] = [];
      const rowY = rows.length === 1 ? [TRAY_H / 2] : [TRAY_H * 0.71, TRAY_H * 0.29];
      rows.forEach((row, r) => {
        const total =
          row.reduce((sum, i) => sum + moneyWidth(values[i]) * scale, 0) +
          gap * scale * (row.length - 1);
        let x = -total / 2;
        for (const i of row) {
          const w = moneyWidth(values[i]) * scale;
          places[i] = { x: x + w / 2, y: rowY[Math.min(r, 1)], scale };
          x += w + gap * scale;
        }
      });
      return places;
    }
  }
}

interface TrayPiece {
  readonly value: Denomination;
  readonly mesh: Group;
  /** When it dropped onto the tray; −∞ for pieces that were simply there. */
  readonly born: number;
}

interface Flight {
  readonly object: Object3D;
  readonly from: Vector3;
  readonly to: Vector3;
  readonly scaleFrom: number;
  readonly scaleTo: number;
  readonly start: number;
  readonly end: number;
  readonly lift: number;
}

const SKY_STOPS = [
  { at: 0, top: '#7ec8f2', bottom: '#dff3ff', sun: '#fff2a8', hill: '#7bbf6a' },
  { at: 0.55, top: '#f4a35a', bottom: '#ffe0a8', sun: '#ffb347', hill: '#6a9e57' },
  { at: 1, top: '#3b2d6b', bottom: '#b0607a', sun: '#ff6b5a', hill: '#3d4f4a' },
];

function skyAt(sunset: number) {
  const a = sunset <= 0.55 ? SKY_STOPS[0] : SKY_STOPS[1];
  const b = sunset <= 0.55 ? SKY_STOPS[1] : SKY_STOPS[2];
  const t = clamp01((sunset - a.at) / (b.at - a.at));
  const mix = (x: string, y: string) => '#' + new Color(x).lerp(new Color(y), t).getHexString();
  return {
    top: mix(a.top, b.top),
    bottom: mix(a.bottom, b.bottom),
    sun: mix(a.sun, b.sun),
    hill: mix(a.hill, b.hill),
  };
}

/** Warm vertical wood grain for the inside of the hollow tree. */
function barkTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const c = canvas.getContext('2d')!;
  c.fillStyle = '#b07a4a';
  c.fillRect(0, 0, 256, 64);
  const shades = ['#9c6a3e', '#c08a58', '#a87344', '#8f5f37'];
  for (let x = 0; x < 256; x += 6) {
    c.fillStyle = shades[(x * 7) % shades.length];
    c.globalAlpha = 0.55;
    c.fillRect(x, 0, 3 + ((x * 13) % 4), 64);
  }
  c.globalAlpha = 1;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.repeat.set(5, 1);
  return texture;
}

/**
 * The Fairy Market in 3D: the inside of a hollow tree with a wooden counter, Olli the otter
 * behind it with his brass till, Lumi floating at the end with her basket, shelves of treats,
 * a round window whose sky turns to sunset, lanterns that glow gold for Lucky Shopper and
 * Lumi's own little shelf filling up with everything she ever bought.
 *
 * It only draws the frame: the treat with its price tag, the coins on the tray, and short
 * scenes for each event (a coin drops in, the till rings and the treat hops into the basket,
 * Olli shakes his head kindly, everyone cheers at the end). Every control stays in the DOM.
 */
export class MarketWorld extends Stage implements StateWorld<MarketFrame> {
  private readonly kit = new Kit();
  private readonly olli: Olli;
  private readonly lumi: Lumi;
  private readonly tag: PriceTag;
  private readonly tray = new Group();
  private readonly till = new Group();
  private readonly drawer: Mesh;
  private readonly bell: Mesh;
  private readonly sky: CanvasTexture;
  private readonly lanterns: MeshStandardMaterial;
  private readonly lights: InstancedMesh;
  private readonly warm = new PointLight('#ffcf85', 1.4, 9, 1.5);
  private readonly shelfSlots: Vector3[] = [];
  private readonly lumiShelf = new Group();
  private readonly sparkles = new Group();
  private readonly confetti: InstancedMesh;
  private readonly confettiSeeds: {
    x: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    spin: number;
  }[] = [];
  private readonly probe = new Vector3();
  private readonly euler = new Euler();
  private readonly matrix = new Matrix4();
  private readonly frameBox: Vector3[];

  private frame?: MarketFrame;
  private pieces: TrayPiece[] = [];
  private paying: { mesh: Group; from: Vector3 }[] = [];
  private counterGood: Group | null = null;
  private goodKey = '';
  private popAt = -10;
  private paidTurn = -1;
  private flights: Flight[] = [];
  private basketKey = '';
  private shelfCount = -1;
  private skyKey = -1;
  private golden = false;
  private glow = 0;
  private payAt = -10;
  private payOutcome: MarketFrame['outcome'] = 'none';
  private slipAt = -10;
  private cheerAt = -10;
  private readonly payCount = new EventCounter();
  private readonly coinCount = new EventCounter();
  private readonly slipCount = new EventCounter();
  private readonly cheerCount = new EventCounter();

  constructor(canvas: HTMLCanvasElement, host: HTMLElement) {
    super(canvas, host, { fov: 34, background: '#3a2416' });
    const kit = this.kit;
    this.sun.position.set(-3, 8, 7);
    this.fill.intensity = 1.35;
    this.warm.position.set(0.4, 3.2, 1.2);
    this.scene.add(this.warm);

    // The hollow tree: a curved wall of warm grain, a plank floor and a round rug.
    const bark = barkTexture();
    const wall = new Mesh(
      new CylinderGeometry(
        TREE_RADIUS,
        TREE_RADIUS,
        7,
        40,
        1,
        true,
        Math.PI * 0.32,
        Math.PI * 1.36,
      ),
      new MeshStandardMaterial({ map: bark, side: BackSide, roughness: 0.9 }),
    );
    wall.position.set(TREE_CENTRE.x, 3.2, TREE_CENTRE.z);
    const floor = new Mesh(
      new CircleGeometry(TREE_RADIUS, 40),
      kit.mat('#9a6638', { roughness: 0.95 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.copy(TREE_CENTRE);
    const rug = new Mesh(new CircleGeometry(1.3, 32), kit.mat('#d98fa6'));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0.6, 0.01, 2.3);
    rug.scale.set(1.5, 1, 1);
    this.scene.add(wall, floor, rug);

    // The round window with its sky, top left on the wall.
    const skyCanvas = document.createElement('canvas');
    skyCanvas.width = skyCanvas.height = 256;
    this.sky = new CanvasTexture(skyCanvas);
    this.sky.colorSpace = SRGBColorSpace;
    const windowAt = this.onWall(-2.35, 2.95, 0.04);
    const pane = new Mesh(new CircleGeometry(0.64, 40), new MeshBasicMaterial({ map: this.sky }));
    pane.position.copy(windowAt.position);
    pane.rotation.y = windowAt.angle;
    const frameWood = kit.mat('#6b4226');
    const ring = new Mesh(new TorusGeometry(0.66, 0.08, 10, 40), frameWood);
    ring.position.copy(pane.position);
    ring.rotation.y = windowAt.angle;
    this.scene.add(pane, ring);
    for (const turn of [0, Math.PI / 2]) {
      const bar = new Mesh(new PlaneGeometry(1.3, 0.05), frameWood);
      bar.position
        .copy(pane.position)
        .add(new Vector3(0, 0, 0.01).applyAxisAngle(new Vector3(0, 1, 0), windowAt.angle));
      bar.rotation.set(0, windowAt.angle, turn);
      this.scene.add(bar);
    }

    // Shelves of treats on the back wall, and Lumi's own shelf under the window.
    const plank = roundedBox(2.4, 0.08, 0.42, 0.03);
    const shelfWood = kit.mat('#c08a58');
    const stock: GoodId[] = [
      'honey',
      'teddy',
      'apple',
      'book',
      'cupcake',
      'ball',
      'flower',
      'wand',
      'kite',
      'cookie',
      'ribbon',
      'dragon',
    ];
    let stocked = 0;
    for (const [x, width, count] of [
      [0.55, 2.4, 4],
      [3.0, 1.3, 2],
    ] as const) {
      const at = this.onWall(x, 0, 0.25);
      for (const y of [1.75, 2.5, 3.25]) {
        const board = new Mesh(
          width === 2.4 ? plank : roundedBox(width, 0.08, 0.42, 0.03),
          shelfWood,
        );
        board.position.copy(at.position).setY(y);
        board.rotation.y = at.angle;
        this.scene.add(board);
        for (let slot = 0; slot < count; slot++) {
          const along = (slot - (count - 1) / 2) * (width / count);
          const place = new Vector3(along, y + 0.04, 0.05)
            .applyAxisAngle(new Vector3(0, 1, 0), at.angle)
            .add(new Vector3(at.position.x, 0, at.position.z));
          if (y === 3.25 && slot === count - 1 && x === 0.55) {
            // Olli's spare spot: put-back treats go here.
            this.shelfSlots.push(place);
            continue;
          }
          const good = buildGood(kit, stock[stocked++ % stock.length]);
          good.scale.setScalar(0.75);
          good.position.copy(place);
          good.rotation.y = at.angle;
          this.scene.add(good);
        }
      }
    }
    const lumiAt = this.onWall(-2.35, 0, 0.25);
    for (const y of [1.45, 1.92]) {
      const board = new Mesh(roundedBox(1.5, 0.07, 0.36, 0.03), kit.mat('#d9a066'));
      board.position.copy(lumiAt.position).setY(y);
      board.rotation.y = lumiAt.angle;
      this.scene.add(board);
    }
    this.lumiShelf.position.set(lumiAt.position.x, 0, lumiAt.position.z);
    this.lumiShelf.rotation.y = lumiAt.angle;
    this.scene.add(this.lumiShelf);

    // A string of fairy lights along the top and two hanging lanterns.
    const bulbs = 26;
    this.lights = new InstancedMesh(kit.smallBall, new MeshBasicMaterial(), bulbs);
    for (let index = 0; index < bulbs; index++) {
      const t = index / (bulbs - 1);
      const x = -3.4 + t * 7;
      const y = 3.95 - Math.sin(t * Math.PI) * 0.45 + Math.sin(t * Math.PI * 4) * 0.08;
      this.matrix
        .makeScale(0.055, 0.055, 0.055)
        .setPosition(x, y, -0.6 - Math.sin(t * Math.PI) * 0.6);
      this.lights.setMatrixAt(index, this.matrix);
    }
    this.scene.add(this.lights);
    this.lanterns = new MeshStandardMaterial({
      color: '#fff3c4',
      emissive: '#ffcf6a',
      emissiveIntensity: 0.6,
      roughness: 0.4,
    });
    const brass = kit.mat('#c99a3a', { metalness: 0.5, roughness: 0.35 });
    for (const x of [-1.35, 1.75]) {
      const lantern = new Group();
      lantern.position.set(x, 3.3, 0.2);
      lantern.add(
        kit.rod(brass, new Vector3(0, 0.25, 0), new Vector3(0, 1.4, 0), 0.012),
        kit.can(this.lanterns, 0.13, 0.26, 0, 0, 0),
        kit.can(brass, 0.16, 0.05, 0, 0.15, 0),
        kit.can(brass, 0.15, 0.04, 0, -0.14, 0),
      );
      const cap = new Mesh(kit.cone, brass);
      cap.scale.set(0.15, 0.12, 0.15);
      cap.position.y = 0.22;
      lantern.add(cap);
      this.scene.add(lantern);
    }

    // Olli stands behind the counter.
    this.olli = buildOlli(kit);
    this.olli.root.position.copy(OLLI_AT);
    this.scene.add(this.olli.root);

    // The counter: a warm wooden front with panels and a lighter top.
    const counter = new Group();
    const front = new Mesh(roundedBox(4.4, 1.0, 0.9, 0.08), kit.mat('#a8693a'));
    front.position.set(0, 0.5, 0.35);
    const top = new Mesh(roundedBox(4.62, 0.1, 1.04, 0.05), kit.mat('#dba56a'));
    top.position.set(0, TOP - 0.05, 0.35);
    counter.add(front, top);
    for (const x of [-1.5, 0, 1.5]) {
      const panel = new Mesh(roundedBox(1.2, 0.62, 0.04, 0.08), kit.mat('#93582e'));
      panel.position.set(x, 0.5, 0.81);
      counter.add(panel);
      const leaf = kit.blob(kit.mat('#6fbf7f'), 0.12, 0.06, 0.02, x, 0.5, 0.84);
      leaf.rotation.z = 0.5;
      counter.add(leaf);
    }
    this.scene.add(counter);

    // The brass till with a drawer that pops and a bell.
    this.till.position.copy(TILL_AT);
    const tillBrass = kit.mat('#d6a640', { metalness: 0.55, roughness: 0.3 });
    const box = new Mesh(roundedBox(0.66, 0.4, 0.52, 0.06), tillBrass);
    box.position.y = 0.32;
    const screen = new Mesh(roundedBox(0.5, 0.2, 0.06, 0.03), kit.mat('#7a4a1e'));
    screen.position.set(0, 0.6, -0.12);
    screen.rotation.x = -0.4;
    this.drawer = new Mesh(
      roundedBox(0.6, 0.12, 0.46, 0.03),
      kit.mat('#b9852c', { metalness: 0.5, roughness: 0.35 }),
    );
    this.drawer.position.set(0, 0.07, 0.02);
    this.bell = new Mesh(kit.hemisphere, kit.mat('#f6c945', { metalness: 0.6, roughness: 0.25 }));
    this.bell.scale.setScalar(0.08);
    this.bell.position.set(0.2, 0.52, 0.12);
    this.till.add(box, screen, this.drawer, this.bell);
    for (let key = 0; key < 6; key++) {
      const button = kit.can(
        kit.mat(key % 2 ? '#fff1d6' : '#f4c9d4'),
        0.035,
        0.03,
        -0.16 + (key % 3) * 0.12,
        0.53,
        0.04 + Math.floor(key / 3) * 0.1,
      );
      this.till.add(button);
    }
    this.scene.add(this.till);

    // The tray leans back toward Olli so the coins face the child.
    this.tray.position.copy(TRAY_AT);
    this.tray.rotation.x = TRAY_LEAN;
    const trayBoard = new Mesh(
      roundedBox(TRAY_W + 0.12, TRAY_H + 0.1, 0.06, 0.08),
      kit.mat('#c98d55'),
    );
    trayBoard.position.set(0, TRAY_H / 2, -0.04);
    const felt = new Mesh(
      roundedBox(TRAY_W, TRAY_H - 0.04, 0.02, 0.06),
      kit.mat('#3f7d5a', { roughness: 1 }),
    );
    felt.position.set(0, TRAY_H / 2, 0);
    const lip = new Mesh(roundedBox(TRAY_W + 0.16, 0.08, 0.14, 0.03), kit.mat('#a8693a'));
    lip.position.set(0, 0.0, 0.04);
    this.tray.add(trayBoard, felt, lip);
    this.scene.add(this.tray);

    // The price tag on its hook.
    this.tag = buildPriceTag(kit);
    this.tag.root.position.copy(TAG_AT);
    this.scene.add(this.tag.root);

    // Lumi floats at the end of the counter with her basket.
    this.lumi = buildLumi(kit);
    this.lumi.root.position.copy(LUMI_AT);
    this.lumi.root.rotation.y = -0.45;
    this.scene.add(this.lumi.root);

    // The big buy's sparkle ring round the treat.
    const ring2 = new Mesh(
      new TorusGeometry(0.42, 0.025, 8, 40),
      kit.mat('#ffd34d', { emissive: '#ffb300', emissiveIntensity: 0.8 }),
    );
    ring2.rotation.x = Math.PI / 2;
    this.sparkles.add(ring2);
    for (let index = 0; index < 6; index++) {
      const star = new Mesh(
        kit.sparkle,
        kit.mat(index % 2 ? '#ffe6a0' : '#f27aa8', {
          emissive: index % 2 ? '#ffcc33' : '#ff6fa8',
          emissiveIntensity: 0.7,
        }),
      );
      star.scale.set(0.05, 0.08, 0.05);
      this.sparkles.add(star);
    }
    this.sparkles.position.copy(GOOD_AT);
    this.sparkles.visible = false;
    this.scene.add(this.sparkles);

    // Confetti for the end of the round.
    const confettiCount = 48;
    this.confetti = new InstancedMesh(
      new PlaneGeometry(0.07, 0.11),
      new MeshBasicMaterial({ side: DoubleSide }),
      confettiCount,
    );
    const palette = ['#e0457b', '#ffd34d', '#3d8fe0', '#4fae55', '#ff9fb2', '#8a5cc7'];
    let seed = 7;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let index = 0; index < confettiCount; index++) {
      this.confetti.setColorAt(index, new Color(palette[index % palette.length]));
      this.confettiSeeds.push({
        x: -2.4 + rand() * 5.4,
        z: -0.2 + rand() * 1.6,
        vx: (rand() - 0.5) * 0.8,
        vy: 1.5 + rand() * 1.5,
        vz: (rand() - 0.5) * 0.4,
        spin: 3 + rand() * 6,
      });
    }
    this.confetti.visible = false;
    this.scene.add(this.confetti);

    this.paintLights(false);
    this.paintSky(0);
    this.frameBox = [
      new Vector3(-2.1, 0.45, 0.8),
      new Vector3(-0.5, 2.7, -0.6),
      new Vector3(-2.35, 2.2, 0.5),
      // Lumi's side: placed in `layout`, closer in on narrow screens.
      new Vector3(),
      new Vector3(),
    ];
  }

  setState(frame: MarketFrame) {
    const now = this.elapsed;
    const previous = this.frame;
    this.frame = frame;
    const shopping = frame.phase === 'shop';

    if (this.payCount.take(frame.pays)) this.startPay(frame, now);
    const dropped = this.coinCount.take(frame.coins) > 0;
    if (this.slipCount.take(frame.slips)) this.slipAt = now;
    if (this.cheerCount.take(frame.cheers)) this.startCheer(now);

    // A new treat on the counter for a new turn (or a new level card).
    const key = `${frame.turn}|${frame.good}|${frame.big}|${frame.phase === 'intro' || frame.phase === 'complete'}`;
    const paidThisTurn = this.paidTurn === frame.turn && frame.phase !== 'intro';
    if (key !== this.goodKey && !(paidThisTurn && previous?.turn === frame.turn)) {
      this.goodKey = key;
      this.placeGood(frame.good, frame.big, previous ? Math.max(now, this.payAt + 0.95) : -10);
      if (previous && previous.turn !== frame.turn) this.paidTurn = -1;
    }
    this.tag.setText(frame.priceText, frame.big);
    this.tag.root.visible = !!frame.priceText && !!this.counterGood;
    this.sparkles.visible = frame.big && !!this.counterGood;

    // Coins on the tray: only while shopping, never after this turn's purchase went through.
    this.syncTray(
      shopping && this.paidTurn !== frame.turn ? frame.tray : [],
      dropped ? now : -Infinity,
    );

    this.syncBasket();
    if (frame.shelf !== this.shelfCount) this.fillShelf(frame.shelf);
    if (frame.golden !== this.golden) this.paintLights(frame.golden);
    this.golden = frame.golden;
    if (Math.abs(frame.sunset - this.skyKey) > 0.004) this.paintSky(frame.sunset);
    this.draw();
  }

  /** Where a point on the tree's wall is, `inset` toward the room, and which way it faces. */
  private onWall(x: number, y: number, inset: number) {
    const dz = Math.sqrt(TREE_RADIUS ** 2 - (x - TREE_CENTRE.x) ** 2);
    const z = TREE_CENTRE.z - dz;
    const angle = Math.atan2(TREE_CENTRE.x - x, TREE_CENTRE.z - z);
    const position = new Vector3(x, y, z).add(
      new Vector3(Math.sin(angle), 0, Math.cos(angle)).multiplyScalar(inset),
    );
    return { position, angle };
  }

  private placeGood(id: GoodId, big: boolean, popAt: number) {
    if (this.counterGood) this.counterGood.removeFromParent();
    const good = buildGood(this.kit, id);
    good.position.copy(GOOD_AT);
    good.userData['size'] = big ? 1.5 : 1.15;
    good.scale.setScalar(popAt < 0 ? good.userData['size'] : 0.001);
    this.scene.add(good);
    this.counterGood = good;
    this.popAt = popAt;
  }

  private startPay(frame: MarketFrame, now: number) {
    this.payAt = now;
    this.payOutcome = frame.outcome;
    this.paidTurn = frame.turn;
    // The coins on the tray go into the till.
    for (const piece of this.pieces)
      this.paying.push({ mesh: piece.mesh, from: piece.mesh.position.clone() });
    this.pieces = [];
    const good = this.counterGood;
    this.counterGood = null;
    this.tag.root.visible = false;
    this.sparkles.visible = false;
    if (!good) return;
    const from = good.position.clone();
    const size = good.scale.x;
    if (frame.outcome === 'putBack') {
      this.flights.push({
        object: good,
        from,
        to: this.shelfSlots[0].clone(),
        scaleFrom: size,
        scaleTo: 0.0,
        start: now + 0.25,
        end: now + PAY_SECONDS.landed,
        lift: 0.9,
      });
      return;
    }
    const to = new Vector3();
    this.lumi.basketItems.getWorldPosition(to);
    to.y += 0.08;
    this.flights.push({
      object: good,
      from,
      to,
      scaleFrom: size,
      scaleTo: 0.4,
      start: now + PAY_SECONDS.lift,
      end: now + PAY_SECONDS.landed,
      lift: 0.9,
    });
  }

  private startCheer(now: number) {
    this.cheerAt = now;
    this.confetti.visible = !this.calm;
  }

  private syncTray(values: readonly Denomination[], born: number) {
    const same =
      values.length === this.pieces.length &&
      values.every((value, index) => this.pieces[index].value === value);
    if (same) return;
    // Keep the pieces still on the tray, so they glide to their new places; add the rest.
    const unused = [...this.pieces];
    const grew = values.length > this.pieces.length;
    const next = values.map((value): TrayPiece => {
      const keep = unused.findIndex((piece) => piece.value === value);
      if (keep >= 0) return unused.splice(keep, 1)[0];
      const mesh = buildMoney(this.kit, value);
      this.tray.add(mesh);
      return { value, mesh, born: grew ? born : -Infinity };
    });
    for (const piece of unused) piece.mesh.removeFromParent();
    const places = trayLayout(values);
    next.forEach((piece, index) => {
      const place = places[index];
      piece.mesh.userData['target'] = new Vector3(place.x, place.y, 0.04);
      piece.mesh.userData['scale'] = place.scale;
      if (piece.born !== -Infinity || !piece.mesh.userData['placed']) {
        piece.mesh.position.set(place.x, place.y, 0.04);
        piece.mesh.scale.setScalar(place.scale);
        piece.mesh.userData['placed'] = true;
      }
    });
    this.pieces = next;
  }

  /** Lumi's basket shows the treats bought this round, once they have landed. */
  private syncBasket() {
    const frame = this.frame;
    if (!frame) return;
    const flying = this.flights.some(
      (flight) => flight.to.y > 1 && flight.scaleTo > 0 && this.elapsed < flight.end,
    );
    const shown = frame.basket
      .slice(0, Math.max(0, frame.basket.length - (flying ? 1 : 0)))
      .slice(-6);
    const key = shown.join(',');
    if (key === this.basketKey) return;
    this.basketKey = key;
    const items = this.lumi.basketItems;
    for (const child of [...items.children]) child.removeFromParent();
    // The newest treat sits on top at the front; older ones settle behind it.
    [...shown].reverse().forEach((id, index) => {
      const good = buildGood(this.kit, id);
      const [x, y, z] = BASKET_SLOTS[index];
      good.scale.setScalar(0.4);
      good.position.set(x, y, z);
      good.rotation.y = 0.45;
      items.add(good);
    });
  }

  private fillShelf(count: number) {
    this.shelfCount = count;
    for (const child of [...this.lumiShelf.children]) child.removeFromParent();
    GOOD_IDS.slice(0, Math.max(0, Math.min(12, count))).forEach((id, index) => {
      const good = buildGood(this.kit, id);
      const row = Math.floor(index / 6);
      good.scale.setScalar(0.38);
      good.position.set(-0.6 + (index % 6) * 0.24, (row ? 1.45 : 1.92) + 0.04, 0.03);
      this.lumiShelf.add(good);
    });
  }

  private paintLights(golden: boolean) {
    const colors = golden ? ['#ffd34d', '#ffe9a0'] : ['#ff9fb2', '#ffd34d', '#8fd0ff', '#b8f0b0'];
    const color = new Color();
    for (let index = 0; index < this.lights.count; index++)
      this.lights.setColorAt(index, color.set(colors[index % colors.length]));
    this.lights.instanceColor!.needsUpdate = true;
    // Lucky Shopper's golden coins: every coin and note metal glows a little.
    for (const look of Object.values(MONEY_LOOK))
      for (const tone of [look.rim, look.fill]) {
        const metal = this.kit.mat(tone, { metalness: 0.45, roughness: 0.35 });
        metal.emissive.set(golden ? '#ffb300' : '#000000');
        metal.emissiveIntensity = golden ? 0.35 : 0;
      }
  }

  private paintSky(sunset: number) {
    this.skyKey = sunset;
    const canvas = this.sky.image as HTMLCanvasElement;
    const c = canvas.getContext('2d')!;
    const look = skyAt(sunset);
    const gradient = c.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, look.top);
    gradient.addColorStop(1, look.bottom);
    c.fillStyle = gradient;
    c.fillRect(0, 0, 256, 256);
    // The sun sinks from high in the window to behind the hills.
    const sunY = 70 + sunset * 170;
    c.fillStyle = look.sun;
    c.globalAlpha = 0.35;
    c.beginPath();
    c.arc(150, sunY, 46, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 1;
    c.beginPath();
    c.arc(150, sunY, 30, 0, Math.PI * 2);
    c.fill();
    if (sunset > 0.75) {
      c.fillStyle = '#fff6d0';
      c.globalAlpha = (sunset - 0.75) * 4;
      for (const [x, y] of [
        [50, 50],
        [90, 30],
        [200, 60],
        [120, 80],
        [220, 30],
      ])
        c.fillRect(x, y, 3, 3);
      c.globalAlpha = 1;
    }
    c.fillStyle = look.hill;
    c.beginPath();
    c.moveTo(0, 256);
    c.lineTo(0, 200);
    c.quadraticCurveTo(70, 160, 140, 198);
    c.quadraticCurveTo(200, 175, 256, 190);
    c.lineTo(256, 256);
    c.fill();
    this.sky.needsUpdate = true;
    // The room's light follows the sun outside.
    this.sun.color.set(skyAt(sunset).sun).lerp(new Color('#fff6e0'), 1 - sunset * 0.6);
    this.sun.intensity = 2.3 - sunset * 0.9;
  }

  protected override layout(aspect: number) {
    this.camera.clearViewOffset();
    super.layout(aspect);
    const { width, height } = this;
    // On narrow boards Lumi floats in front of the counter's end, so the shop can come closer.
    const narrow = aspect < 1.45;
    this.lumi.root.position.x = narrow ? 2.05 : LUMI_AT.x;
    this.lumi.root.position.z = narrow ? 1.2 : LUMI_AT.z;
    const right = this.lumi.root.position.x + 0.42;
    this.frameBox[3].set(right, 0.45, this.lumi.root.position.z);
    this.frameBox[4].set(right, 2.25, this.lumi.root.position.z);
    const room = { x: width * 0.97, y: height * 0.92 };
    let distance = 5;
    let box = this.aim(distance);
    while ((box.right - box.left > room.x || box.bottom - box.top > room.y) && distance < 60) {
      distance *= 1.03;
      box = this.aim(distance);
    }
    const dx = (box.left + box.right) / 2 - width / 2;
    // Sit the counter near the bottom: spare room goes to the shelves and lanterns above.
    const dy = box.bottom - height * 0.97;
    this.camera.setViewOffset(width, height, dx, dy, width, height);
  }

  private aim(distance: number) {
    const camera = this.camera;
    const pitch = (10 * Math.PI) / 180;
    camera.position.set(0.3, 1.5 + Math.sin(pitch) * distance, 0.3 + Math.cos(pitch) * distance);
    camera.lookAt(0.3, 1.5, 0.3);
    camera.updateMatrixWorld();
    const box = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
    for (const point of this.frameBox) {
      const { x, y } = this.probe.copy(point).project(camera);
      const px = ((x + 1) / 2) * this.width;
      const py = ((1 - y) / 2) * this.height;
      box.left = Math.min(box.left, px);
      box.right = Math.max(box.right, px);
      box.top = Math.min(box.top, py);
      box.bottom = Math.max(box.bottom, py);
    }
    return box;
  }

  protected update(dt: number, t: number) {
    const calm = this.calm;
    const pay = t - this.payAt;
    const slip = t - this.slipAt;
    const cheer = t - this.cheerAt;

    // Olli: a gentle bob, reaching for the till, a kind head shake, arms up to cheer.
    const olli = this.olli;
    olli.body.position.y = calm ? 0 : Math.sin(t * 1.7) * 0.02;
    let reachTill = 0;
    let reachGood = 0;
    if (pay >= 0 && pay < 0.9 && this.payOutcome !== 'putBack')
      reachTill = Math.sin(clamp01(pay / 0.9) * Math.PI);
    if (pay >= 0 && pay < 1.2 && this.payOutcome === 'putBack')
      reachGood = Math.sin(clamp01(pay / 1.2) * Math.PI);
    const cheering = cheer >= 0 && cheer < 2.4 ? Math.sin(clamp01(cheer / 2.4) * Math.PI) : 0;
    const wave = calm ? 0 : Math.sin(t * 9) * 0.25 * cheering;
    olli.arms[0].rotation.z = -0.22 - reachTill * 0.9 - cheering * 2.3 + wave;
    olli.arms[0].rotation.x = -reachTill * 0.6;
    olli.arms[1].rotation.z = 0.22 + reachGood * 2.2 + cheering * 2.3 - wave;
    olli.arms[1].rotation.x = -reachGood * 0.3;
    olli.head.rotation.y = shake(t, this.slipAt, 0.9, 0.35) + (calm ? 0 : Math.sin(t * 0.6) * 0.06);
    olli.head.rotation.z =
      slip >= 0 && slip < 0.9
        ? 0.1 * Math.sin(clamp01(slip / 0.9) * Math.PI)
        : calm
          ? 0
          : Math.sin(t * 0.9) * 0.03;
    if (cheering && !calm) olli.body.position.y += Math.abs(Math.sin(cheer * 6)) * 0.08 * cheering;

    // Lumi: floating, wings fluttering, a hop when a treat lands, a spin for the cheer.
    const lumi = this.lumi;
    const hop =
      this.payOutcome === 'bought' && pay > PAY_SECONDS.landed && pay < PAY_SECONDS.done
        ? Math.sin(((pay - PAY_SECONDS.landed) / (PAY_SECONDS.done - PAY_SECONDS.landed)) * Math.PI)
        : 0;
    lumi.root.position.y =
      LUMI_AT.y + (calm ? 0 : Math.sin(t * 2.1) * 0.05) + hop * 0.22 + cheering * 0.15;
    lumi.body.rotation.y =
      cheer >= 0 && cheer < 1.2 && !calm ? smooth(cheer / 1.2) * Math.PI * 2 : 0;
    lumi.head.rotation.z = calm ? 0 : Math.sin(t * 1.3) * 0.06;
    lumi.arms[1].rotation.z = 0.25 + cheering * 2.4 + (calm ? 0 : Math.sin(t * 8) * 0.2 * cheering);
    const flap = calm ? 0 : Math.sin(t * 16) * 0.35;
    lumi.wings.forEach((wing, index) => {
      const side = index < 2 ? -1 : 1;
      wing.rotation.y = side * (0.55 + flap);
    });

    // The tray: new coins drop in, pieces glide to their places, and wobble on a slip.
    for (const piece of this.pieces) {
      const target = piece.mesh.userData['target'] as Vector3 | undefined;
      if (!target) continue;
      const age = t - piece.born;
      const mesh = piece.mesh;
      mesh.position.x = approach(mesh.position.x, target.x, 14, dt);
      mesh.position.y = approach(mesh.position.y, target.y, 14, dt);
      mesh.position.z = !calm && age < 0.4 ? target.z + (1 - bounce(age / 0.4)) * 0.6 : target.z;
      const scale = piece.mesh.userData['scale'] as number;
      mesh.scale.setScalar(approach(mesh.scale.x, scale, 14, dt));
      mesh.rotation.z = calm ? 0 : shake(t, this.slipAt, 0.6, 0.18);
    }
    // Paid coins slide into the till and vanish.
    if (this.paying.length) {
      const till = this.tray.worldToLocal(this.till.localToWorld(new Vector3(0, 0.35, 0.1)));
      const p = clamp01(pay / PAY_SECONDS.coinsGone);
      for (const piece of this.paying) {
        piece.mesh.position.lerpVectors(piece.from, till, smooth(p));
        piece.mesh.scale.setScalar(Math.max(0.001, 1 - p * 0.8));
      }
      if (p >= 1) {
        for (const piece of this.paying) piece.mesh.removeFromParent();
        this.paying = [];
      }
    }
    // The till: the drawer pops out with a ring.
    const ring = this.payOutcome === 'putBack' ? -1 : pay - PAY_SECONDS.ring;
    const drawer = ring >= 0 && ring < 0.6 ? Math.sin(clamp01(ring / 0.6) * Math.PI) : 0;
    this.drawer.position.z = 0.02 + drawer * 0.26;
    this.bell.scale.setScalar(0.08 * (1 + drawer * 0.4));
    this.till.rotation.z = calm ? 0 : shake(t, this.payAt + PAY_SECONDS.ring, 0.35, 0.03);

    // Treats in flight: into the basket or back to the shelf.
    if (this.flights.length) {
      this.flights = this.flights.filter((flight) => {
        const p = clamp01((t - flight.start) / (flight.end - flight.start));
        const k = easeOut(p);
        flight.object.position.lerpVectors(flight.from, flight.to, k);
        flight.object.position.y += Math.sin(p * Math.PI) * flight.lift;
        flight.object.scale.setScalar(
          Math.max(0.001, flight.scaleFrom + (flight.scaleTo - flight.scaleFrom) * k),
        );
        flight.object.rotation.y = calm ? 0 : p * Math.PI * 2;
        if (t < flight.end) return true;
        flight.object.removeFromParent();
        return false;
      });
      this.syncBasket();
    }

    // The new treat pops onto the counter; the big buy turns in its sparkle ring.
    const good = this.counterGood;
    if (good) {
      const size = good.userData['size'] as number;
      const pop = t - this.popAt;
      good.scale.setScalar(
        pop < 0
          ? 0.001
          : pop < 0.45 && !calm
            ? Math.max(0.001, easeOutBack(pop / 0.45) * size)
            : size,
      );
      good.rotation.y = calm ? 0 : Math.sin(t * 0.8) * 0.15;
      good.position.y = GOOD_AT.y + shake(t, this.slipAt, 0.5, 0.04);
      this.tag.root.visible = pop >= 0 && !!this.frame?.priceText;
      this.sparkles.visible = !!this.frame?.big && pop >= 0;
    }
    this.tag.card.rotation.z = calm
      ? 0
      : Math.sin(t * 1.4) * 0.05 + shake(t, this.slipAt, 0.8, 0.2);
    if (this.sparkles.visible) {
      this.sparkles.rotation.y = calm ? 0 : t * 0.8;
      this.sparkles.children.forEach((star, index) => {
        if (!index) return;
        const angle = (index / 6) * Math.PI * 2;
        star.position.set(
          Math.cos(angle) * 0.42,
          0.12 + (calm ? 0 : Math.sin(t * 3 + index) * 0.08),
          Math.sin(angle) * 0.42,
        );
      });
    }

    // Lucky Shopper: the lanterns warm up gold; they glow a little more as the sun goes down.
    const sunset = this.frame?.sunset ?? 0;
    this.glow = approach(this.glow, this.golden ? 1 : 0, 4, dt);
    this.lanterns.emissiveIntensity =
      0.6 + sunset * 0.7 + this.glow * 1.6 + (calm ? 0 : Math.sin(t * 5) * 0.08 * this.glow);
    this.lanterns.emissive.set(this.glow > 0.5 ? '#ffb300' : '#ffcf6a');
    this.warm.intensity = 1.2 + sunset * 1.2 + this.glow * 1.4;

    // Confetti falls for the cheer.
    if (this.confetti.visible) {
      if (cheer > 2.6) this.confetti.visible = false;
      else
        this.confettiSeeds.forEach((seed, index) => {
          const age = Math.max(0, cheer);
          const x = seed.x + seed.vx * age;
          const y = 4.2 + seed.vy * age * 0.4 - age * age * 0.9;
          const z = seed.z + seed.vz * age;
          this.matrix.makeRotationFromEuler(
            this.euler.set(age * seed.spin, age * seed.spin * 0.7, 0),
          );
          this.matrix.setPosition(x, y, z);
          this.confetti.setMatrixAt(index, this.matrix);
        });
      this.confetti.instanceMatrix.needsUpdate = true;
    }
  }

  override dispose() {
    super.dispose();
    this.kit.dispose();
  }
}
