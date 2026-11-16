import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  OctahedronGeometry,
  PlaneGeometry,
  PointLight,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
} from 'three';
import { approach, easeOutBack, EventCounter, shake, smooth } from '../../shared/three/motion';
import { Stage } from '../../shared/three/stage';
import type { StateWorld } from '../../shared/three/three-stage';
import { DragonModel } from '../hatchery/dragon-model';
import { dragonById, DAY_DRAGONS } from '../hatchery/dragons';
import { Animal, AnimalKind, ball, Bruno, paint } from './bakery-characters';
import { BakeryFrame, cookieColor, dragonCustomer } from './bakery-frame';
import { fitTray, trayGeometry, TrayGeometry, trayRegion, WIDE_BOARD } from './tray-geometry';

const FOV = 36;
/** How far in front of the camera the tray stands, facing it square on. */
const TRAY_DEPTH = 11;
const BACK_DEPTH = 19;
const CAST_DEPTH = 15;
const MAX_COOKIES = 110;
const SLIDE_IN = 0.55;
const INTO_OVEN = 0.9;
const CHOP_TIME = 0.35;

interface Particle {
  readonly mesh: Mesh;
  readonly velocity: Vector3;
  readonly born: number;
  readonly life: number;
  readonly grow: number;
  readonly fall: number;
}

function roundedRect(width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  const shape = new Shape();
  const x = -width / 2;
  const y = -height / 2;
  shape.moveTo(x + r, y);
  shape.lineTo(x + width - r, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + r);
  shape.lineTo(x + width, y + height - r);
  shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  shape.lineTo(x + r, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}

/**
 * Bruno's bakery in 3D. The tray stands square on to the camera exactly where the game's tray
 * geometry puts it, so the knife, piece labels and taps in the DOM line up with it. Behind it
 * are the oven with its glowing window and timer ring, the menu board that fills with
 * cookies, the shop window with its treats, Bruno and the customer. It only draws: the game
 * decides everything and hands it a `BakeryFrame`.
 */
export class BakeryWorld extends Stage implements StateWorld<BakeryFrame> {
  private frame?: BakeryFrame;
  private shape?: TrayGeometry;
  private shapeKey = '';
  private order = -1;
  private orderAt = -10;
  /** Where the tray sits now and how big a cookie unit is, in world space. */
  private trayScale = 1;
  private readonly tray = new Group();
  private readonly trayInner = new Group();
  private readonly sheets = new Group();
  private readonly sheetMetal = paint('#b8bec8', { metalness: 0.55, roughness: 0.4 });
  private readonly parchment = paint('#f5e7c6', { roughness: 0.95 });
  private readonly cakePaper = paint('#fbd3e2', { roughness: 0.95 });
  private readonly cookies: InstancedMesh;
  private readonly chips: InstancedMesh;
  private readonly ghosts: InstancedMesh;
  private readonly sugar: InstancedMesh;
  private readonly lines = new Group();
  private readonly guides = new Group();
  private readonly guideMaterial = new MeshBasicMaterial({
    color: '#ffe14d',
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
  });
  private readonly knife = new Group();
  private readonly blade: Mesh;
  private readonly knifeHandle: Mesh;
  private knifeAt = { x: 0, y: 0, angle: 0, ready: false };
  /** Current cookie spots, sliding toward their targets so pieces part and close smoothly. */
  private spots: { x: number; y: number }[] = [];
  private ghostSpots: { x: number; y: number }[] = [];
  private readonly dummy = new Object3D();
  private readonly tint = new Color();

  private readonly oven = new Group();
  private readonly ovenBody: MeshStandardMaterial;
  private readonly ovenWindow: MeshStandardMaterial;
  private readonly ovenLight = new PointLight('#ffb347', 0, 8);
  private readonly ringCanvas = document.createElement('canvas');
  private readonly ringTexture: CanvasTexture;
  private ringShare = -1;
  private readonly menu = new Group();
  private readonly menuCanvas = document.createElement('canvas');
  private readonly menuTexture: CanvasTexture;
  private menuKey = '';
  private readonly shop = new Group();
  private readonly treats = new Group();
  private treatCount = -1;
  private readonly bruno = new Bruno();
  private readonly brunoHolder = new Group();
  private readonly guestHolder = new Group();
  private guest?: Animal | DragonModel;
  private guestKey = '';
  private guestAt = -10;
  private readonly box = new Group();
  private readonly boxLid = new Group();
  private nibbler?: DragonModel;
  private nibblerKey = '';
  private readonly warmLight = new PointLight('#ffd27a', 0, 30);

  private readonly chops = new EventCounter();
  private readonly turns = new EventCounter();
  private readonly rights = new EventCounter();
  private readonly wrongs = new EventCounter();
  private readonly twins = new EventCounter();
  private readonly bakes = new EventCounter();
  private readonly nibbles = new EventCounter();
  private readonly pulses = new EventCounter();
  private chopAt = -10;
  private wrongAt = -10;
  private rightAt = -10;
  private twinAt = -10;
  private bakeAt = -10;
  private nibbleAt = -10;
  private pulseAt = -10;
  private turnAt = -10;
  private readonly particles: Particle[] = [];
  private readonly puff = new SphereGeometry(0.3, 12, 8);
  private readonly spark = new OctahedronGeometry(0.16);
  private readonly crumb = new SphereGeometry(0.09, 6, 5);

  constructor(canvas: HTMLCanvasElement, host: HTMLElement) {
    super(canvas, host, { shadows: false, fov: FOV, background: '#f8dfc0' });
    this.fill.color.set('#fff1dc');
    this.fill.intensity = 1.55;
    this.sun.intensity = 2.1;
    this.sun.position.set(-4, 9, 12);
    this.scene.add(this.warmLight);

    // The back wall, a shelf line and a floor, far behind everything.
    const wall = new Mesh(new PlaneGeometry(200, 120), paint('#f6d9b4', { roughness: 1 }));
    wall.position.set(0, 0, -BACK_DEPTH + 2);
    this.scene.add(wall);
    const wainscot = new Mesh(new PlaneGeometry(200, 6), paint('#e7b98a', { roughness: 1 }));
    wainscot.position.set(0, -4.5, -BACK_DEPTH + 2.05);
    this.scene.add(wainscot);

    // Cookies: a soft dome with three chocolate chips, drawn as instances.
    const dome = new SphereGeometry(0.4, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    dome.rotateX(Math.PI / 2);
    dome.scale(1, 1, 0.42);
    this.cookies = new InstancedMesh(dome, paint('#ffffff', { roughness: 0.8 }), MAX_COOKIES);
    const chip = new SphereGeometry(0.065, 8, 6);
    this.chips = new InstancedMesh(chip, paint('#4a2a12', { roughness: 0.5 }), MAX_COOKIES * 3);
    this.ghosts = new InstancedMesh(
      dome,
      new MeshStandardMaterial({
        color: '#a9d8ff',
        emissive: '#6fb6ff',
        emissiveIntensity: 0.35,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
      }),
      10,
    );
    this.sugar = new InstancedMesh(
      new SphereGeometry(0.05, 6, 4),
      paint('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.3 }),
      240,
    );
    for (const mesh of [this.cookies, this.chips, this.ghosts, this.sugar]) {
      mesh.count = 0;
      mesh.frustumCulled = false;
    }
    this.trayInner.add(
      this.sheets,
      this.lines,
      this.cookies,
      this.chips,
      this.ghosts,
      this.sugar,
      this.guides,
    );
    this.tray.add(this.trayInner);
    this.scene.add(this.tray);

    // A big, friendly baker's knife: a wide rounded blade and a chunky wooden handle.
    const bladeShape = roundedRect(1, 0.34, 0.16);
    this.blade = new Mesh(
      new ExtrudeGeometry(bladeShape, {
        depth: 0.05,
        bevelEnabled: true,
        bevelSize: 0.03,
        bevelThickness: 0.02,
        bevelSegments: 2,
      }),
      paint('#e8edf3', {
        metalness: 0.6,
        roughness: 0.25,
        emissive: '#8aa0b8',
        emissiveIntensity: 0.1,
      }),
    );
    this.knifeHandle = new Mesh(
      new ExtrudeGeometry(roundedRect(1.25, 0.5, 0.24), {
        depth: 0.3,
        bevelEnabled: true,
        bevelSize: 0.06,
        bevelThickness: 0.06,
        bevelSegments: 3,
      }),
      paint('#b8763e', { roughness: 0.7 }),
    );
    const rivet = paint('#f1d48a', { metalness: 0.7, roughness: 0.3 });
    for (const x of [-0.3, 0.3])
      this.knifeHandle.add(ball(rivet, 0.06, x, 0, 0.38, [1, 1, 0.5], 8));
    this.knife.add(this.blade, this.knifeHandle);
    this.trayInner.add(this.knife);

    // The oven: a red-brick body, a dark door with a glowing window, and a timer ring.
    this.ovenBody = paint('#b5523b', { roughness: 0.8 });
    const body = new Mesh(new BoxGeometry(2.6, 2.3, 1.4), this.ovenBody);
    const door = new Mesh(new BoxGeometry(1.9, 1.3, 0.1), paint('#3a2318', { roughness: 0.6 }));
    door.position.set(0, -0.25, 0.72);
    this.ovenWindow = new MeshStandardMaterial({
      color: '#ffcf6b',
      emissive: '#ff9a1f',
      emissiveIntensity: 0.6,
    });
    const window = new Mesh(new PlaneGeometry(1.5, 0.85), this.ovenWindow);
    window.position.set(0, -0.25, 0.78);
    const handleBar = new Mesh(new CylinderGeometry(0.05, 0.05, 1.2, 10), rivet);
    handleBar.rotation.z = Math.PI / 2;
    handleBar.position.set(0, 0.5, 0.82);
    const chimney = new Mesh(new CylinderGeometry(0.22, 0.26, 0.8, 16), paint('#7a3424'));
    chimney.position.set(0.8, 1.5, -0.2);
    this.ringCanvas.width = this.ringCanvas.height = 128;
    this.ringTexture = new CanvasTexture(this.ringCanvas);
    this.ringTexture.colorSpace = SRGBColorSpace;
    const ring = new Mesh(
      new PlaneGeometry(0.62, 0.62),
      new MeshBasicMaterial({ map: this.ringTexture, transparent: true }),
    );
    ring.position.set(0, 0.92, 0.72);
    this.ovenLight.position.set(0, -0.2, 1.6);
    this.oven.add(body, door, window, handleBar, chimney, ring, this.ovenLight);
    this.scene.add(this.oven);

    // The menu board: a chalkboard times-table chart that fills with cookies.
    this.menuCanvas.width = this.menuCanvas.height = 256;
    this.menuTexture = new CanvasTexture(this.menuCanvas);
    this.menuTexture.colorSpace = SRGBColorSpace;
    const frame = new Mesh(new BoxGeometry(2.3, 2.3, 0.12), paint('#9a6a3f'));
    const chalk = new Mesh(
      new PlaneGeometry(2.05, 2.05),
      new MeshBasicMaterial({ map: this.menuTexture }),
    );
    chalk.position.z = 0.07;
    this.menu.add(frame, chalk);
    this.scene.add(this.menu);

    // The shop window: a wooden frame, pale glass and a shelf for the treats.
    const shopFrame = new Mesh(new BoxGeometry(2.4, 2.3, 0.14), paint('#9a6a3f'));
    const glass = new Mesh(
      new PlaneGeometry(2.1, 2),
      paint('#cfe8f5', { roughness: 0.2, emissive: '#bfe3ff', emissiveIntensity: 0.25 }),
    );
    glass.position.z = 0.08;
    const shelf = new Mesh(new BoxGeometry(2.1, 0.08, 0.4), paint('#7a4f2a'));
    shelf.position.set(0, -0.05, 0.25);
    const shelf2 = shelf.clone();
    shelf2.position.y = -0.85;
    this.treats.position.z = 0.3;
    this.shop.add(shopFrame, glass, shelf, shelf2, this.treats);
    this.scene.add(this.shop);

    this.brunoHolder.add(this.bruno.root);
    this.scene.add(this.brunoHolder, this.guestHolder);

    // The customer's cake box: pink with a ribbon; the lid closes with a sparkle.
    const pink = paint('#f7a8c4');
    const boxBody = new Mesh(new BoxGeometry(1, 0.6, 0.8), pink);
    boxBody.position.y = 0.3;
    const lid = new Mesh(new BoxGeometry(1.06, 0.12, 0.86), pink);
    lid.position.set(0, 0.06, 0.43);
    this.boxLid.position.set(0, 0.6, -0.43);
    this.boxLid.add(lid);
    const ribbon = new Mesh(new BoxGeometry(0.14, 0.62, 0.82), paint('#fffdf5'));
    ribbon.position.y = 0.3;
    this.box.add(boxBody, ribbon, this.boxLid);
    this.box.visible = false;
    this.scene.add(this.box);
  }

  setState(frame: BakeryFrame) {
    const first = !this.frame;
    this.frame = frame;
    if (frame.order !== this.order) {
      const fresh = this.order !== -1;
      this.order = frame.order;
      this.orderAt = fresh ? this.elapsed : -10;
      this.spots = [];
      this.ghostSpots = [];
      this.box.visible = false;
    }
    if (this.chops.take(frame.chops)) this.chopAt = this.elapsed;
    if (this.turns.take(frame.turns)) this.turnAt = this.elapsed;
    if (this.rights.take(frame.rights)) this.rightAt = this.elapsed;
    if (this.wrongs.take(frame.wrongs)) {
      this.wrongAt = this.elapsed;
      this.flour();
    }
    if (this.twins.take(frame.twins)) this.twinAt = this.elapsed;
    if (this.bakes.take(frame.bakes)) this.bakeAt = this.elapsed;
    if (this.nibbles.take(frame.nibbles)) this.nibbleAt = this.elapsed;
    if (this.pulses.take(frame.pulses)) this.pulseAt = this.elapsed;
    this.syncShape(frame);
    this.syncGuest(frame);
    this.paintMenu(frame.board);
    this.fillShop(frame.treats);
    if (first) this.layoutScene();
    this.draw();
  }

  protected override layout(aspect: number) {
    super.layout(aspect);
    this.camera.position.set(0, 3.2, 14);
    this.camera.lookAt(0, 1.6, 0);
    this.camera.updateMatrixWorld();
    this.layoutScene();
  }

  /** A point at screen spot (u, v), 0–1 from the top left, `depth` in front of the camera. */
  private anchor(u: number, v: number, depth: number) {
    const half = depth * Math.tan((FOV * Math.PI) / 360);
    const forward = new Vector3();
    this.camera.getWorldDirection(forward);
    const right = new Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
    const up = new Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
    return this.camera.position
      .clone()
      .addScaledVector(forward, depth)
      .addScaledVector(right, (u * 2 - 1) * half * this.camera.aspect)
      .addScaledVector(up, (1 - v * 2) * half);
  }

  /** World size of one screen pixel at `depth`. */
  private pixel(depth: number) {
    return (2 * depth * Math.tan((FOV * Math.PI) / 360)) / this.height;
  }

  /** Places the backdrop, Bruno and the customer around the tray for this board's shape. */
  private layoutScene() {
    if (!this.shape) return;
    const { width, height } = this;
    const fit = fitTray(width, height, this.shape);
    const wide = width / height > WIDE_BOARD;
    const region = trayRegion(width, height);
    const finished = !!this.frame?.finished;
    const place = (
      object: Object3D,
      u: number,
      v: number,
      depth: number,
      px: number,
      size: number,
    ) => {
      object.position.copy(this.anchor(u, v, depth));
      object.quaternion.copy(this.camera.quaternion);
      object.scale.setScalar((px * this.pixel(depth)) / size);
    };
    // The tray, square on to the camera.
    const centre = { u: (fit.x + fit.width / 2) / width, v: (fit.y + fit.height / 2) / height };
    this.tray.position.copy(this.anchor(centre.u, centre.v, TRAY_DEPTH));
    this.tray.quaternion.copy(this.camera.quaternion);
    this.trayScale = fit.scale * this.pixel(TRAY_DEPTH);
    this.tray.scale.setScalar(this.trayScale);

    if (finished) {
      place(this.brunoHolder, 0.5, 0.92, CAST_DEPTH, height * 0.7, 2.6);
      place(this.oven, 0.5, 0.2, BACK_DEPTH, height * 0.3, 2.3);
      place(this.menu, 0.16, 0.3, BACK_DEPTH, Math.min(height * 0.3, width * 0.24), 2.3);
      place(this.shop, 0.84, 0.3, BACK_DEPTH, Math.min(height * 0.3, width * 0.24), 2.3);
      place(this.guestHolder, 0.82, 0.95, CAST_DEPTH, height * 0.36, 1.6);
      return;
    }
    if (wide) {
      const column = width * region.left;
      const item = Math.min(column * 0.85, height * 0.3);
      place(this.oven, region.left / 2, 0.2, BACK_DEPTH, item, 2.3);
      place(this.menu, 1 - region.left / 2, 0.2, BACK_DEPTH, item, 2.3);
      place(this.shop, 0.5, 0.02, BACK_DEPTH, height * 0.12, 2.3);
      const cast = Math.min(height * 0.6, column * 1.4);
      place(this.brunoHolder, region.left / 2, 0.98, CAST_DEPTH, cast, 2.6);
      place(this.guestHolder, 1 - region.left / 2, 0.98, CAST_DEPTH, cast * 0.62, 1.6);
    } else {
      const band = Math.max(40, fit.y);
      const item = Math.min(band * 0.92, width * 0.26);
      place(this.oven, 0.5, (band * 0.5) / height, BACK_DEPTH, item, 2.3);
      place(this.menu, 0.27, (band * 0.5) / height, BACK_DEPTH, item * 0.95, 2.3);
      place(this.shop, 0.73, (band * 0.5) / height, BACK_DEPTH, item * 0.95, 2.3);
      // Bruno and the customer stand behind the counter, peeking over the tray's top edge.
      const cast = Math.min(band * 2.1, width * 0.34);
      place(this.brunoHolder, 0.1, (band + cast * 0.5) / height, CAST_DEPTH, cast, 2.6);
      place(
        this.guestHolder,
        0.9,
        (band + cast * 0.62 * 0.45) / height,
        CAST_DEPTH,
        cast * 0.62,
        1.6,
      );
    }
    this.box.position.copy(
      this.anchor(
        wide ? 1 - region.left / 2 : 0.78,
        wide ? 0.62 : (fit.y * 0.95) / height,
        CAST_DEPTH - 1,
      ),
    );
    this.box.quaternion.copy(this.camera.quaternion);
    this.box.scale.setScalar((Math.min(height, width) * 0.13 * this.pixel(CAST_DEPTH - 1)) / 1);
    this.warmLight.position.copy(this.anchor(0.5, 0.4, TRAY_DEPTH - 3));
  }

  /** Rebuilds the tray's sheets, lines and guides when its shape changes. */
  private syncShape(frame: BakeryFrame) {
    const key = [
      frame.order,
      frame.rows,
      frame.cols,
      frame.dir,
      frame.cuts.join('.'),
      frame.ghost,
      frame.look,
      frame.cookies,
      frame.cake,
    ].join('|');
    const shape = trayGeometry(frame);
    const resized =
      !this.shape || this.shape.width !== shape.width || this.shape.height !== shape.height;
    this.shape = shape;
    if (key !== this.shapeKey) {
      this.shapeKey = key;
      this.buildSheets(frame, shape);
    }
    if (resized) this.layoutScene();
    // Guides: glowing strips along the gaps the trick suggests.
    this.clear(this.guides);
    if (frame.guide && frame.phase === 'cut')
      for (const at of frame.guide.gaps) {
        const strip = new Mesh(
          new PlaneGeometry(
            frame.guide.dir === 'rows' ? shape.width + 0.8 : 0.3,
            frame.guide.dir === 'rows' ? 0.3 : shape.height + 0.8,
          ),
          this.guideMaterial,
        );
        const gap = frame.guide.dir === 'rows' ? shape.rowGaps[at - 1] : shape.colGaps[at - 1];
        strip.position.set(
          frame.guide.dir === 'rows' ? 0 : gap - shape.width / 2,
          frame.guide.dir === 'rows' ? shape.height / 2 - gap : 0,
          0.2,
        );
        this.guides.add(strip);
      }
  }

  private buildSheets(frame: BakeryFrame, shape: TrayGeometry) {
    this.clear(this.sheets);
    this.clear(this.lines);
    const toLocal = (x: number, y: number) => [x - shape.width / 2, shape.height / 2 - y] as const;
    const paper = frame.cake ? this.cakePaper : this.parchment;
    const area = frame.look === 'area' && !frame.cookies;
    const rects = frame.ghost
      ? [{ x: 0, y: 0, width: shape.width, height: shape.height }]
      : shape.pieceRects.length > 1
        ? shape.pieceRects
        : [{ x: 0, y: 0, width: shape.width, height: shape.height }];
    for (const rect of rects) {
      const [cx, cy] = toLocal(rect.x + rect.width / 2, rect.y + rect.height / 2);
      const metal = new Mesh(
        new ExtrudeGeometry(roundedRect(rect.width, rect.height, 0.32), {
          depth: 0.12,
          bevelEnabled: true,
          bevelSize: 0.08,
          bevelThickness: 0.06,
          bevelSegments: 2,
        }),
        this.sheetMetal,
      );
      metal.position.set(cx, cy, -0.2);
      const top = new Mesh(
        new ShapeGeometry(roundedRect(rect.width - 0.25, rect.height - 0.25, 0.22)),
        area ? paint('#e3b06a', { roughness: 0.9 }) : paper,
      );
      top.position.set(cx, cy, area ? 0.04 : -0.0);
      this.sheets.add(metal, top);
      if (area) {
        // The area model: a slab of dough with faint lines between the rows and columns.
        const points: number[] = [];
        const inside = (gaps: readonly number[], lo: number, hi: number) =>
          gaps.filter((g) => g > lo && g < hi);
        for (const g of inside(shape.rowGaps, rect.y + 0.4, rect.y + rect.height - 0.4)) {
          const [, y] = toLocal(0, g);
          points.push(cx - rect.width / 2 + 0.2, y, 0.06, cx + rect.width / 2 - 0.2, y, 0.06);
        }
        for (const g of inside(shape.colGaps, rect.x + 0.4, rect.x + rect.width - 0.4)) {
          const [x] = toLocal(g, 0);
          points.push(x, cy - rect.height / 2 + 0.2, 0.06, x, cy + rect.height / 2 - 0.2, 0.06);
        }
        const geometry = new BufferGeometry();
        geometry.setAttribute('position', new Float32BufferAttribute(points, 3));
        this.lines.add(
          new LineSegments(
            geometry,
            new LineBasicMaterial({ color: '#fff3d6', transparent: true, opacity: 0.7 }),
          ),
        );
      }
    }
    if (frame.look === 'blocks' && !area) {
      // Outlines around each friendly block of up to 5 × 5 cookies.
      const points: number[] = [];
      const edges = (count: number) => {
        const out: [number, number][] = [];
        for (let start = 0; start < count; start += 5)
          out.push([start, Math.min(count, start + 5) - 1]);
        return out;
      };
      for (const piece of shape.pieces)
        for (const [r0, r1] of edges(piece.rows))
          for (const [c0, c1] of edges(piece.cols)) {
            const left = shape.colX[piece.col + c0] - 0.48;
            const right = shape.colX[piece.col + c1] + 0.48;
            const topY = shape.rowY[piece.row + r0] - 0.48;
            const bottom = shape.rowY[piece.row + r1] + 0.48;
            const [l, t] = toLocal(left, topY);
            const [r, b] = toLocal(right, bottom);
            points.push(
              l,
              t,
              0.03,
              r,
              t,
              0.03,
              r,
              t,
              0.03,
              r,
              b,
              0.03,
              r,
              b,
              0.03,
              l,
              b,
              0.03,
              l,
              b,
              0.03,
              l,
              t,
              0.03,
            );
          }
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute(points, 3));
      this.lines.add(new LineSegments(geometry, new LineBasicMaterial({ color: '#c98a45' })));
    }
  }

  private syncGuest(frame: BakeryFrame) {
    if (frame.customer === this.guestKey) return;
    this.guestKey = frame.customer;
    this.guestAt = this.elapsed;
    if (this.guest) {
      this.guestHolder.remove(this.guest.root);
      this.disposeObject(this.guest.root);
    }
    const guest = dragonCustomer(frame.customer);
    if (guest) {
      const dragon = dragonById(guest.id) ?? DAY_DRAGONS[0];
      const model = new DragonModel(dragon, guest.stage);
      // Evolved forms are taller and wider, so they stand a little further into the counter.
      model.root.scale.setScalar([1.45, 1.25, 1.05][guest.stage] ?? 1.45);
      this.guest = model;
    } else {
      this.guest = new Animal(frame.customer as AnimalKind);
    }
    this.guestHolder.add(this.guest.root);
  }

  /** Redraws the chalkboard: a cookie in every square baked, with a star for a clever one. */
  private paintMenu(board: readonly number[]) {
    const key = board.join('');
    if (key === this.menuKey) return;
    this.menuKey = key;
    const c = this.menuCanvas.getContext('2d');
    if (!c) return;
    c.fillStyle = '#33473a';
    c.fillRect(0, 0, 256, 256);
    const cell = 236 / 10;
    for (let index = 0; index < 100; index++) {
      const x = 10 + (index % 10) * cell + cell / 2;
      const y = 10 + Math.floor(index / 10) * cell + cell / 2;
      if (board[index]) {
        c.fillStyle = '#e3a95c';
        c.beginPath();
        c.arc(x, y, cell * 0.42, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#5a3418';
        c.beginPath();
        c.arc(x - 3, y - 2, 1.8, 0, Math.PI * 2);
        c.arc(x + 3, y + 2, 1.8, 0, Math.PI * 2);
        c.fill();
        if (board[index] === 2) {
          c.fillStyle = '#ffe14d';
          c.beginPath();
          c.arc(x + cell * 0.32, y - cell * 0.32, 3.4, 0, Math.PI * 2);
          c.fill();
        }
      } else {
        c.strokeStyle = '#ffffff40';
        c.lineWidth = 1.5;
        c.beginPath();
        c.arc(x, y, cell * 0.3, 0, Math.PI * 2);
        c.stroke();
      }
    }
    this.menuTexture.needsUpdate = true;
  }

  /** One treat in the shop window per bakery level finished: cupcakes, cakes, houses, donuts. */
  private fillShop(count: number) {
    if (count === this.treatCount) return;
    this.treatCount = count;
    this.clear(this.treats);
    for (let index = 0; index < Math.min(12, count); index++) {
      const treat = new Group();
      const kind = index % 4;
      if (kind === 0) {
        const cup = new Mesh(new CylinderGeometry(0.18, 0.13, 0.22, 14), paint('#8fd0e8'));
        treat.add(
          cup,
          ball(paint('#f7a8c4'), 0.2, 0, 0.17, 0, [1, 0.8, 1], 14),
          ball(paint('#e0304d'), 0.06, 0, 0.32, 0, [1, 1, 1], 8),
        );
      } else if (kind === 1) {
        const donut = new Mesh(new TorusGeometry(0.15, 0.08, 10, 18), paint('#f28cb1'));
        donut.position.y = 0.12;
        treat.add(donut);
      } else if (kind === 2) {
        const house = new Mesh(new BoxGeometry(0.34, 0.26, 0.28), paint('#c98a45'));
        house.position.y = 0.13;
        const roof = new Mesh(new CylinderGeometry(0.01, 0.28, 0.2, 4), paint('#fffdf5'));
        roof.position.y = 0.36;
        roof.rotation.y = Math.PI / 4;
        treat.add(house, roof);
      } else {
        const low = new Mesh(new CylinderGeometry(0.22, 0.22, 0.16, 18), paint('#fffdf5'));
        low.position.y = 0.08;
        const high = new Mesh(new CylinderGeometry(0.14, 0.14, 0.14, 18), paint('#f7c6d9'));
        high.position.y = 0.23;
        treat.add(
          low,
          high,
          ball(
            paint('#ffd23f', { emissive: '#ff9a1f', emissiveIntensity: 0.5 }),
            0.04,
            0,
            0.36,
            0,
            [1, 1.6, 1],
            8,
          ),
        );
      }
      treat.position.set(-0.75 + (index % 4) * 0.5, index < 4 ? 0 : index < 8 ? -0.8 : 0.5, 0);
      this.treats.add(treat);
    }
  }

  protected update(dt: number, t: number) {
    const frame = this.frame;
    const shape = this.shape;
    if (!frame || !shape) return;
    const calm = this.calm;

    // The tray slides in for a new order, wobbles at a slip and goes into the oven when baked.
    const arrive = (t - this.orderAt) / SLIDE_IN;
    const intoOven =
      frame.phase === 'baked' && this.bakeAt > this.orderAt
        ? smooth((t - this.bakeAt) / INTO_OVEN)
        : 0;
    const hidden = frame.finished;
    this.tray.visible = !hidden && intoOven < 1;
    this.trayInner.position.x = arrive < 1 ? (1 - smooth(arrive)) * (shape.width * 1.6) : 0;
    this.trayInner.position.y = intoOven * shape.height * 0.6;
    this.trayInner.scale.setScalar(1 - intoOven * 0.75);
    this.trayInner.rotation.z = calm ? 0 : shake(t, this.wrongAt, 0.5, 0.05);
    const turning = t - this.turnAt;
    this.trayInner.rotation.y = turning < 0.5 ? Math.sin((turning / 0.5) * Math.PI) * 0.5 : 0;

    this.updateCookies(frame, shape, t, dt, calm);
    this.updateKnife(frame, shape, t, dt);
    this.guideMaterial.opacity = calm ? 0.75 : 0.5 + Math.sin(t * 4) * 0.3;

    // The oven glows hotter as the timer runs, flares at a bake, and turns gold for the streak.
    const heat = frame.timer === null ? 0.3 : 1 - frame.timer;
    const flare = Math.max(0, 1 - (t - this.bakeAt - INTO_OVEN * 0.6) / 1.2);
    this.ovenWindow.emissive.set(heat > 0.75 ? '#ff6a1a' : '#ff9a1f');
    this.ovenWindow.emissiveIntensity = 0.5 + heat * 0.6 + flare * 1.6;
    this.ovenLight.intensity = flare * 6 + (frame.golden ? 2 : 0);
    this.ovenBody.color.set(frame.golden ? '#e0a800' : '#b5523b');
    this.ovenBody.emissive.set(frame.golden ? '#7a5200' : '#000000');
    this.paintRing(frame.timer);
    this.warmLight.intensity = frame.golden ? 1.4 + (calm ? 0 : Math.sin(t * 3) * 0.3) : 0;
    if (!calm && Math.random() < dt * 1.5) this.steam();

    // Bruno and the customer.
    this.bruno.update(t, {
      calm,
      chopAt: this.chopAt,
      shrugAt: this.wrongAt,
      cheerAt: Math.max(this.rightAt, this.bakeAt),
      dancing: frame.finished,
      worried: frame.timer !== null && frame.timer < 0.25 && !frame.crispy,
    });
    if (frame.finished && !calm && Math.random() < dt * 3) this.flour(true);
    const pop = easeOutBack((t - this.guestAt) / 0.5);
    this.guestHolder.children[0]?.position.set(0, (pop - 1) * 1.2, 0);
    if (this.guest instanceof Animal) this.guest.update(t, calm, this.bakeAt + INTO_OVEN);
    else if (this.guest) {
      if (Math.abs(t - this.bakeAt - INTO_OVEN) < dt) this.guest.cheer(t);
      this.guest.update(t, true, calm);
    }

    // The cake box appears by the customer and its lid closes with a sparkle.
    const boxAge = t - this.bakeAt - INTO_OVEN;
    this.box.visible = frame.phase === 'baked' && boxAge > 0 && !frame.finished;
    if (this.box.visible) {
      this.boxLid.rotation.x = boxAge < 0.5 ? -1.6 * (1 - smooth(boxAge / 0.5)) : 0;
      if (boxAge > 0.5 && boxAge - dt <= 0.5) this.sparkle(this.box.position, 10, 0.6);
    }

    this.updateNibbler(frame, shape, t);
    this.updateParticles(t, dt);
  }

  private updateCookies(
    frame: BakeryFrame,
    shape: TrayGeometry,
    t: number,
    dt: number,
    calm: boolean,
  ) {
    const area = frame.look === 'area' && !frame.cookies;
    const base = new Color(cookieColor(frame));
    const rows = frame.rows;
    const cols = frame.cols;
    const pieceOf = (row: number, col: number) =>
      shape.pieces.findIndex(
        (p) => row >= p.row && row < p.row + p.rows && col >= p.col && col < p.col + p.cols,
      );
    const twins = new Set<number>();
    shape.pieces.forEach((piece, index) => {
      if (
        shape.pieces.some((o, at) => at !== index && o.rows === piece.rows && o.cols === piece.cols)
      )
        twins.add(index);
    });
    let n = 0;
    let chipIndex = 0;
    const pulseAge = t - this.pulseAt;
    const twinAge = t - this.twinAt;
    const rightAge = t - this.rightAt;
    const wrongAge = t - this.wrongAt;
    const rate = calm ? 30 : 9;
    for (let row = 0; row < rows; row++)
      for (let col = 0; col < cols; col++) {
        const tx = shape.colX[col] - shape.width / 2;
        const ty = shape.height / 2 - shape.rowY[row];
        const spot = (this.spots[n] ??= { x: tx, y: ty });
        spot.x = approach(spot.x, tx, rate, dt);
        spot.y = approach(spot.y, ty, rate, dt);
        const piece = pieceOf(row, col);
        const local = piece >= 0 ? row - shape.pieces[piece].row : row;
        let scale = 1;
        this.tint.copy(base);
        if (frame.pulses && pulseAge < 4) {
          const pulse = frame.pulse;
          const hit =
            pulse.kind === 'pieces' ||
            (pulse.kind === 'row' && row === 0) ||
            (pulse.kind === 'rows' && (piece === pulse.piece || frame.cuts.length === 0));
          if (hit) {
            const delay = pulse.kind === 'rows' ? local * 0.32 : 0;
            const age = pulseAge - delay;
            if (age > 0 && age < 0.45) {
              scale += Math.sin((age / 0.45) * Math.PI) * 0.35;
              this.tint.lerp(new Color('#fff3b0'), Math.sin((age / 0.45) * Math.PI) * 0.6);
            }
          }
        }
        if (twins.has(piece) && twinAge < 1.4) {
          const flash = Math.max(0, Math.sin(twinAge * Math.PI * 2.8));
          this.tint.lerp(new Color('#ffe14d'), flash * 0.75);
          scale += flash * 0.12;
        }
        if (piece === frame.active && frame.phase === 'pieces' && wrongAge < 0.9)
          this.tint.lerp(new Color('#ff9ab4'), Math.sin((wrongAge / 0.9) * Math.PI) * 0.6);
        if (
          rightAge < 0.6 &&
          (frame.phase === 'pieces' || frame.phase === 'total' || frame.phase === 'baked')
        )
          scale += Math.sin((rightAge / 0.6) * Math.PI) * 0.08;
        this.dummy.position.set(spot.x, spot.y, 0.02);
        this.dummy.rotation.set(0, 0, ((row * 7 + col * 3) % 5) * 0.3);
        this.dummy.scale.setScalar(area ? 0 : scale);
        this.dummy.updateMatrix();
        this.cookies.setMatrixAt(n, this.dummy.matrix);
        this.cookies.setColorAt(n, this.tint);
        const matrix = this.dummy.matrix;
        for (const [cx, cy] of [
          [-0.15, 0.1],
          [0.14, 0.02],
          [-0.02, -0.17],
        ]) {
          const chip = new Matrix4().makeTranslation(cx, cy, 0.15);
          this.chips.setMatrixAt(chipIndex++, matrix.clone().multiply(chip));
        }
        n++;
      }
    this.cookies.count = n;
    this.chips.count = chipIndex;
    this.cookies.instanceMatrix.needsUpdate = true;
    this.chips.instanceMatrix.needsUpdate = true;
    if (this.cookies.instanceColor) this.cookies.instanceColor.needsUpdate = true;

    // The ghost row: see-through cookies, nibbled away one by one after the full tray is named.
    let g = 0;
    if (frame.ghost) {
      const count = frame.ghost === 'rows' ? cols : rows;
      const nibble = frame.ghostValue !== null ? (t - this.nibbleAt) / 1.6 : -1;
      for (let index = 0; index < count; index++) {
        const row = frame.ghost === 'rows' ? rows : index;
        const col = frame.ghost === 'rows' ? index : cols;
        const gone = nibble >= 0 ? smooth((nibble - index / count) * 3) : 0;
        if (nibble >= 0 && this.nibbleAt < 0) continue;
        if (gone >= 1 || (frame.ghostValue !== null && this.nibbleAt < this.orderAt)) continue;
        const x = shape.colX[col] - shape.width / 2;
        const y = shape.height / 2 - shape.rowY[row];
        if (gone > 0 && gone < 0.2 && !this.ghostSpots[index]) {
          this.ghostSpots[index] = { x, y };
          this.crumbs(x, y);
        }
        this.dummy.position.set(x, y, 0.02);
        this.dummy.rotation.set(0, 0, 0);
        this.dummy.scale.setScalar(Math.max(0.001, 1 - gone));
        this.dummy.updateMatrix();
        this.ghosts.setMatrixAt(g++, this.dummy.matrix);
      }
    }
    this.ghosts.count = g;
    this.ghosts.instanceMatrix.needsUpdate = true;

    // Sugar lines: dotted lines along every fifth gap, so the friendly rows stand out.
    let s = 0;
    const dot = (x: number, y: number) => {
      if (s >= 240) return;
      this.dummy.position.set(x, y, 0.04);
      this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix();
      this.sugar.setMatrixAt(s++, this.dummy.matrix);
    };
    if (!area) {
      for (let row = 5; row < shape.rowY.length; row += 5) {
        const y = shape.height / 2 - (shape.rowY[row - 1] + shape.rowY[row]) / 2;
        for (let x = 0.4; x < shape.width - 0.3; x += 0.32) dot(x - shape.width / 2, y);
      }
      for (let col = 5; col < shape.colX.length; col += 5) {
        const x = (shape.colX[col - 1] + shape.colX[col]) / 2 - shape.width / 2;
        for (let y = 0.4; y < shape.height - 0.3; y += 0.32) dot(x, shape.height / 2 - y);
      }
    }
    this.sugar.count = s;
    this.sugar.instanceMatrix.needsUpdate = true;
  }

  private updateKnife(frame: BakeryFrame, shape: TrayGeometry, t: number, dt: number) {
    const chopping = t - this.chopAt < CHOP_TIME;
    this.knife.visible = frame.phase === 'cut' || chopping;
    if (!this.knife.visible) return;
    const knife = frame.knife ?? { dir: 'rows' as const, at: 1 };
    const rows = knife.dir === 'rows';
    const gap = rows ? (shape.rowGaps[knife.at - 1] ?? 0) : (shape.colGaps[knife.at - 1] ?? 0);
    const length = (rows ? shape.width : shape.height) + 0.2;
    const target = rows
      ? { x: -0.1, y: shape.height / 2 - gap, angle: 0 }
      : { x: gap - shape.width / 2, y: 0.1, angle: -Math.PI / 2 };
    if (!this.knifeAt.ready || this.knifeAt.angle !== target.angle)
      this.knifeAt = { ...target, ready: true };
    this.knifeAt.x = approach(this.knifeAt.x, target.x, 18, dt);
    this.knifeAt.y = approach(this.knifeAt.y, target.y, 18, dt);
    this.blade.scale.set(length, 1, 1);
    this.blade.position.set(0, 0, 0);
    this.knifeHandle.position.set(-length / 2 - 0.62, 0, 0.0);
    this.knife.position.set(this.knifeAt.x, this.knifeAt.y, 0.55);
    this.knife.rotation.set(0, 0, target.angle);
    if (chopping) {
      const age = (t - this.chopAt) / CHOP_TIME;
      this.knife.position.z = 0.55 - Math.sin(age * Math.PI) * 0.5;
      this.knife.rotation.x = Math.sin(age * Math.PI) * 0.25;
    }
  }

  /** A little dragon swoops along the ghost row and nibbles it. */
  private updateNibbler(frame: BakeryFrame, shape: TrayGeometry, t: number) {
    const age = (t - this.nibbleAt) / 1.9;
    const active =
      !!frame.ghost &&
      frame.ghostValue !== null &&
      age >= 0 &&
      age < 1 &&
      this.nibbleAt > this.orderAt;
    // The nibbler is always the little baby form, whatever the customer has evolved into.
    const id = dragonCustomer(frame.customer)?.id ?? DAY_DRAGONS[0].id;
    if (active && (!this.nibbler || this.nibblerKey !== id)) {
      if (this.nibbler) {
        this.nibbler.root.removeFromParent();
        this.disposeObject(this.nibbler.root);
      }
      this.nibbler = new DragonModel(dragonById(id) ?? DAY_DRAGONS[0]);
      this.nibblerKey = id;
      this.trayInner.add(this.nibbler.root);
    }
    if (!this.nibbler) return;
    this.nibbler.root.visible = active;
    if (!active) return;
    const ghostRows = frame.ghost === 'rows';
    const along = -0.2 + age * 1.4;
    const x = ghostRows ? (along - 0.5) * shape.width : shape.width / 2 - shape.colX[0] + 0.3;
    const y = ghostRows
      ? shape.height / 2 - shape.rowY[shape.rowY.length - 1] - 0.4
      : (0.5 - along) * shape.height;
    this.nibbler.root.position.set(
      ghostRows ? x : shape.colX[shape.colX.length - 1] - shape.width / 2,
      y,
      0.9,
    );
    this.nibbler.root.scale.setScalar(1.3);
    this.nibbler.root.rotation.set(0.9, ghostRows ? -0.7 : 0.3, 0);
    this.nibbler.update(t, true, this.calm);
  }

  private paintRing(share: number | null) {
    const value = share === null ? -2 : Math.round(share * 50) / 50;
    if (value === this.ringShare) return;
    this.ringShare = value;
    const c = this.ringCanvas.getContext('2d');
    if (!c) return;
    c.clearRect(0, 0, 128, 128);
    if (share === null) {
      this.ringTexture.needsUpdate = true;
      return;
    }
    c.lineWidth = 16;
    c.strokeStyle = '#ffe9c4';
    c.beginPath();
    c.arc(64, 64, 50, 0, Math.PI * 2);
    c.stroke();
    c.strokeStyle = share < 0.25 ? '#ff4f7b' : '#ff9a1f';
    c.beginPath();
    c.arc(64, 64, 50, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - share));
    c.stroke();
    this.ringTexture.needsUpdate = true;
  }

  // ---- Particles: flour puffs, sparkles, crumbs and steam ----------------------------------

  private emit(mesh: Mesh, velocity: Vector3, life: number, grow: number, fall: number) {
    this.particles.push({ mesh, velocity, born: this.elapsed, life, grow, fall });
    this.scene.add(mesh);
  }

  /** A puff of flour by the tray at a slip, or around Bruno while he dances. */
  private flour(dance = false) {
    if (this.calm && !dance) return;
    const origin = dance ? this.brunoHolder.position.clone() : this.tray.position.clone();
    const spread = dance ? this.brunoHolder.scale.x * 2 : this.trayScale * 5;
    for (let index = 0; index < (dance ? 2 : 7); index++) {
      const mesh = new Mesh(
        this.puff,
        new MeshStandardMaterial({
          color: '#ffffff',
          transparent: true,
          opacity: 0.8,
          depthWrite: false,
        }),
      );
      mesh.position
        .copy(origin)
        .add(
          new Vector3((Math.random() - 0.5) * spread, (Math.random() - 0.3) * spread * 0.6, 0.6),
        );
      mesh.scale.setScalar(this.trayScale * 2.2);
      this.emit(
        mesh,
        new Vector3((Math.random() - 0.5) * 0.8, 0.6 + Math.random() * 0.5, 0),
        1.2,
        1.6,
        0,
      );
    }
  }

  private sparkle(at: Vector3, count: number, size: number) {
    for (let index = 0; index < count; index++) {
      const mesh = new Mesh(
        this.spark,
        new MeshStandardMaterial({
          color: '#fff3a0',
          emissive: '#ffcc33',
          emissiveIntensity: 1,
          transparent: true,
        }),
      );
      mesh.position.copy(at);
      mesh.scale.setScalar(size);
      const angle = (index / count) * Math.PI * 2;
      this.emit(
        mesh,
        new Vector3(Math.cos(angle) * 1.6, Math.sin(angle) * 1.6 + 1, 0.4),
        0.9,
        0,
        0,
      );
    }
  }

  private crumbs(x: number, y: number) {
    const world = this.trayInner.localToWorld(new Vector3(x, y, 0.2));
    for (let index = 0; index < 5; index++) {
      const mesh = new Mesh(this.crumb, paint('#d9a066'));
      mesh.position.copy(world);
      mesh.scale.setScalar(this.trayScale * 1.5);
      this.emit(
        mesh,
        new Vector3((Math.random() - 0.5) * 1.5, Math.random() * 1.5, 0.5),
        0.8,
        0,
        6,
      );
    }
  }

  private steam() {
    const top = this.oven.localToWorld(new Vector3(0.8, 2, -0.2));
    const mesh = new Mesh(
      this.puff,
      new MeshStandardMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      }),
    );
    mesh.position.copy(top);
    mesh.scale.setScalar(this.oven.scale.x * 0.8);
    this.emit(mesh, new Vector3(0.1, 0.7, 0).multiplyScalar(this.oven.scale.x * 2), 2.2, 1.2, 0);
  }

  private updateParticles(t: number, dt: number) {
    for (const particle of [...this.particles]) {
      const age = t - particle.born;
      const material = particle.mesh.material as MeshStandardMaterial;
      if (age > particle.life) {
        particle.mesh.removeFromParent();
        material.dispose();
        this.particles.splice(this.particles.indexOf(particle), 1);
        continue;
      }
      particle.velocity.y -= particle.fall * dt;
      particle.mesh.position.addScaledVector(particle.velocity, dt);
      particle.mesh.rotation.z += dt * 3;
      if (particle.grow) particle.mesh.scale.multiplyScalar(1 + particle.grow * dt);
      if (material.transparent) material.opacity = Math.max(0, (1 - age / particle.life) * 0.8);
    }
  }

  // ---- Clean-up -----------------------------------------------------------------------------

  private clear(group: Group) {
    for (const child of [...group.children]) {
      group.remove(child);
      this.disposeObject(child, true);
    }
  }

  /** Frees an object's own geometry and materials, keeping the shared ones. */
  private disposeObject(root: Object3D, keepShared = false) {
    const shared = new Set<unknown>([
      this.sheetMetal,
      this.parchment,
      this.cakePaper,
      this.guideMaterial,
    ]);
    root.traverse((object) => {
      if (!(object instanceof Mesh || object instanceof LineSegments)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials)
        if (!keepShared || !shared.has(material)) material.dispose();
    });
  }

  override dispose() {
    for (const particle of this.particles) particle.mesh.removeFromParent();
    this.ringTexture.dispose();
    this.menuTexture.dispose();
    super.dispose();
  }
}
