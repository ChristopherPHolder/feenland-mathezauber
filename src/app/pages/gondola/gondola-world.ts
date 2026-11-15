import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Fog,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Points,
  PointsMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Texture,
  TorusGeometry,
  Vector3,
} from 'three';
import { TextLabel } from '../../shared/three/labels';
import { easeOut, EventCounter, shake, smooth } from '../../shared/three/motion';
import { Stage } from '../../shared/three/stage';
import type { StateWorld } from '../../shared/three/three-stage';
import { CABIN_COLORS, GondolaFrame, sceneLayout, SceneLayout } from './gondola-frame';
import { Bunny, bunnyLook, Cabin, disposeFigure, Goat, Kit } from './gondola-models';

// ---------------------------------------------------------------------------------------------
// Where things are. x runs right, y up, z toward the camera; the platform deck is at y = 0.

/** The grip of the boarding cabin at the station. */
const STATION = new Vector3(-1.7, 3.2, -0.1);
/** Where the cable leaves the station and where it reaches the summit. */
const CABLE_BEND = new Vector3(0.9, 3.5, -1.6);
const SUMMIT = new Vector3(9.5, 9.6, -20);
/** A second bay behind the queue, for the express and for cabins going down. */
const BAY = new Vector3(1.6, 3.2, -1.05);
const BAY_SCALE = 0.82;
/** The way down to the valley, off to the front left. */
const DOWN_WAY = [new Vector3(-0.3, 3.0, 1.6), new Vector3(-5.2, 2.0, 3.8), new Vector3(-14, 0.2, 7.5)];
const DOWN_FROM_STATION = [new Vector3(-4.6, 2.6, 1.3), new Vector3(-14, 0.2, 7.5)];
/** Cabins come in from the valley side, or from the right behind the queue. */
const IN_FROM_VALLEY = [new Vector3(-7.5, 2.1, 3.0), new Vector3(-4.2, 2.7, 1.1)];
const IN_FROM_RIGHT = new Vector3(9.5, 3.4, -1.05);
/** Compact full cabins: on the cable, and parked on the rack behind the queue. */
const UP_SCALE = 0.52;
const RACK_SCALE = 0.33;
/** The queue on the platform, left to right, and the gap the split handle opens. */
const QUEUE_Z = 1.1;
const QUEUE_X = 0.35;
const QUEUE_STEP = 0.58;
const SPLIT_GAP = 0.62;
const WALKER = 1.0;
const GOAT_AT = new Vector3(-4.2, 0, 0.85);
const COCOA_AT = new Vector3(5.95, 0, 0.6);
const TAG_SCREEN = 0.05;
const HOP_TIME = 0.5;

/** The ground: flat round the station, then a snowy slope rising to the summit. */
function groundHeight(x: number, z: number): number {
  const back = Math.max(0, -z - 3.2);
  let h = back * 0.36 + Math.max(0, x) * 0.05 * Math.min(1, back / 4);
  h += Math.sin(x * 0.35 + z * 0.12) * 0.7 * Math.min(1, back / 6);
  h += Math.cos(x * 0.18 - z * 0.3) * 0.5 * Math.min(1, back / 8);
  // Ridges on both sides frame the cable's valley.
  h += Math.max(0, Math.abs(x - 5 - (-z * 0.2)) - 8) * 0.55 * Math.min(1, back / 5);
  // The summit plateau where the village stands.
  const summit = Math.hypot(x - SUMMIT.x, z - SUMMIT.z);
  if (summit < 7) h = h * smooth(summit / 7) + (SUMMIT.y - 2.2) * (1 - smooth(summit / 7));
  return h;
}

function canvasTexture(draw: (c: CanvasRenderingContext2D, size: number) => void, size = 64) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  draw(canvas.getContext('2d')!, size);
  return new CanvasTexture(canvas);
}

const glowTexture = () =>
  canvasTexture((c, s) => {
    const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,240,180,1)');
    g.addColorStop(0.35, 'rgba(255,200,90,0.55)');
    g.addColorStop(1, 'rgba(255,200,90,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, s, s);
  });
const flakeTexture = () =>
  canvasTexture((c, s) => {
    const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.8)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, s, s);
  }, 32);

// ---------------------------------------------------------------------------------------------
// Moving parts

interface Hop {
  readonly start: number;
  readonly duration: number;
  readonly height: number;
  from?: Vector3;
  fromScale?: number;
  /** A bump goes to the door and comes back home. */
  readonly bump?: Vector3;
}

interface Rider {
  readonly bunny: Bunny;
  /** A seat in a cabin, or a spot on the platform. */
  home: { cabin: CabinEntity; seat: number } | { spot: Vector3 };
  hop: Hop | null;
  /** Bunnies who hopped off or on with the express wave and wear a "−1" or "+1". */
  wave: boolean;
  sign?: { sprite: Sprite; label: TextLabel };
}

interface Route {
  readonly points: readonly Vector3[];
  readonly start: number;
  readonly duration: number;
  readonly remove: boolean;
  readonly scaleTo?: number;
}

interface CabinEntity {
  readonly cabin: Cabin;
  scale: number;
  route: Route | null;
  /** When the cabin last started or stopped, for its swing. */
  swingAt: number;
  /** Shut target for the doors, and when it was asked. */
  doorTo: number;
  doorAt: number;
  jamAt: number;
  /** Seats filled before the glow starts (help). */
  filled: number;
  pulse: boolean;
  shakeAt: number;
}

interface Particle {
  readonly mesh: Mesh;
  readonly velocity: Vector3;
  readonly born: number;
  readonly life: number;
  readonly spin: number;
  readonly grow: number;
  readonly gravity: number;
}

interface Timer {
  readonly at: number;
  readonly run: () => void;
}

type SignView = { group: Group; label: TextLabel; sprite: Sprite };

/**
 * The Mountain Gondola in 3D: a snowy mountain, a wooden station with Gusti the goat, the
 * boarding cabin big in front with its two rows of five seats, the queue of bunnies split by
 * the child's handle, full "10" cabins on the cable up to a summit village that grows, lanterns
 * that light up turn by turn, a snow cloud drifting in with the pace, and the cocoa mug.
 *
 * It only draws the game's `GondolaFrame`: each turn is laid out from `sceneLayout`, and the
 * move, mistakes and cheers play once when their counters go up.
 */
export class GondolaWorld extends Stage implements StateWorld<GondolaFrame> {
  private readonly kit = new Kit();
  private frame?: GondolaFrame;
  private turn = -1;
  private moved = false;
  private remainderUp = false;
  private readonly riders: Rider[] = [];
  private readonly cabins: CabinEntity[] = [];
  /** The cabin at the station (boarding, opened or remainder), if any. */
  private station: CabinEntity | null = null;
  /** Full cabins up the cable, oldest first, and parked on the rack. */
  private up: CabinEntity[] = [];
  private rack: CabinEntity[] = [];
  private queue: Rider[] = [];
  private readonly timers: Timer[] = [];
  private readonly particles: Particle[] = [];
  private readonly signs: SignView[] = [];
  private queueSign: SignView | null = null;
  private ticketSign: SignView | null = null;
  private readonly hops = new EventCounter();
  private readonly bounces = new EventCounter();
  private readonly jams = new EventCounter();
  private readonly cheers = new EventCounter();
  private readonly slips = new EventCounter();
  private readonly colds = new EventCounter();
  private readonly goat: Goat;
  private waveAt = -10;
  private tapAt = -10;
  private shrugAt = -10;
  private shiverAt = -10;
  private cheerAt = -10;
  private readonly rackFrame = new Group();
  private readonly cloud = new Group();
  private readonly cloudPuffs: Mesh[] = [];
  private readonly cloudMaterial = new MeshStandardMaterial({ color: '#ffffff', roughness: 1, transparent: true, opacity: 0.95 });
  private cloudShare = 0;
  private readonly cocoa = new Group();
  private readonly mug: MeshStandardMaterial;
  private readonly steam: Mesh[] = [];
  private readonly steamMaterial = new MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, roughness: 1 });
  private readonly lanterns: { light: MeshStandardMaterial; glow: Sprite }[] = [];
  private readonly buildings: Group[] = [];
  private readonly snow: Points;
  private readonly snowSpeed: Float32Array;
  private readonly glow = glowTexture();
  private readonly flake = flakeTexture();
  private readonly puffGeometry = new SphereGeometry(0.22, 12, 8);
  private readonly confettiGeometry = new PlaneGeometry(0.24, 0.16);
  private readonly cloudWhite = new Color('#ffffff');
  private readonly cloudGrey = new Color('#7d889e');
  private readonly temp = new Vector3();
  private readonly temp2 = new Vector3();
  private readonly probe = new Vector3();

  constructor(canvas: HTMLCanvasElement, host: HTMLElement) {
    super(canvas, host, { shadows: true, fov: 38, background: '#bfe3fb' });
    this.scene.fog = new Fog('#d9eefc', 34, 95);
    this.fill.intensity = 1.35;
    this.sun.intensity = 2.6;
    this.sun.position.set(-6, 14, 10);
    this.sun.shadow.camera.left = -9;
    this.sun.shadow.camera.right = 9;
    this.sun.shadow.camera.top = 8;
    this.sun.shadow.camera.bottom = -6;
    this.sun.shadow.camera.far = 40;
    this.buildSky();
    this.buildMountain();
    this.buildStation();
    this.goat = new Goat(this.kit);
    this.goat.root.position.copy(GOAT_AT);
    this.goat.root.rotation.y = 0.65;
    this.goat.root.scale.setScalar(1.08);
    this.scene.add(this.goat.root);
    this.buildLanterns();
    this.buildVillage();
    this.mug = this.buildCocoa();
    this.buildCloud();
    const { points, speeds } = this.buildSnow();
    this.snow = points;
    this.snowSpeed = speeds;
  }

  // -------------------------------------------------------------------------------------------
  // State

  setState(frame: GondolaFrame) {
    const previous = this.frame;
    this.frame = frame;
    const layout = sceneLayout(frame);
    // A new turn, a swapped sum ("Swap the groups"), "Show the bunnies" or the tarp: lay it out again.
    const reshaped =
      !previous ||
      previous.kind !== frame.kind ||
      previous.tens !== frame.tens ||
      previous.cabin !== frame.cabin ||
      previous.groupTens !== frame.groupTens ||
      previous.group !== frame.group;
    if (
      frame.turn !== this.turn ||
      reshaped ||
      previous.representation !== frame.representation ||
      previous.tarp !== frame.tarp
    ) {
      // A new turn (or a mounted world): lay it out as it stands, without replaying anything.
      const animate = previous !== undefined && frame.turn !== this.turn;
      this.turn = frame.turn;
      this.build(frame, layout, animate);
      this.syncCounters(frame);
    } else {
      if (!this.moved && layout.moved) this.playMove(frame);
      else if (!layout.moved) this.placeQueue(frame, false);
      this.react(frame);
    }
    this.dress(frame);
    for (let index = 0; index < this.lanterns.length; index++) {
      const lit = index < frame.lanterns;
      this.lanterns[index].light.emissiveIntensity = lit ? 1.6 : 0;
      this.lanterns[index].glow.visible = lit;
    }
    this.buildings.forEach((building, index) => (building.visible = index < frame.village));
    this.cocoa.visible = frame.cocoa !== 'none';
    this.mug.color.set(frame.cocoa === 'cold' ? '#9cc7e8' : '#e0457b');
    this.draw();
  }

  private syncCounters(frame: GondolaFrame) {
    this.hops.take(frame.hops);
    this.bounces.take(frame.bounces);
    this.jams.take(frame.jams);
    this.cheers.take(frame.cheers);
    this.slips.take(frame.slips);
    this.colds.take(frame.colds);
  }

  /** Mistakes, cheers and cold cocoa: each plays once when its counter goes up. */
  private react(frame: GondolaFrame) {
    this.hops.take(frame.hops);
    if (this.bounces.take(frame.bounces)) this.bounce(frame, true);
    if (this.jams.take(frame.jams)) this.bounce(frame, false);
    if (this.cheers.take(frame.cheers)) this.cheer(frame);
    if (this.slips.take(frame.slips)) this.shrugAt = this.elapsed;
    if (this.colds.take(frame.colds)) this.shiverAt = this.elapsed;
  }

  /** Looks that follow the frame directly: golden express, big cabin, tarp, help. */
  private dress(frame: GondolaFrame) {
    const station = this.station;
    if (station) {
      station.cabin.setGolden(frame.golden);
      station.cabin.setBig(frame.big);
      const glow = frame.help === 'seats' && frame.kind === 'add' && !this.moved;
      station.filled = frame.cabin;
      station.cabin.glowSeats(frame.cabin, glow);
    }
    const pulse = frame.help === 'pulse';
    for (const entity of this.cabins) entity.pulse = false;
    if (pulse) {
      if (station) station.pulse = true;
      for (const entity of this.up) if (frame.kind === 'add') entity.pulse = true;
    }
  }

  // -------------------------------------------------------------------------------------------
  // Building a turn

  private clearTurn() {
    this.timers.length = 0;
    for (const rider of [...this.riders]) this.dropRider(rider);
    for (const entity of [...this.cabins]) this.dropCabin(entity);
    for (const sign of this.signs) this.dropSign(sign);
    this.signs.length = 0;
    this.queueSign = null;
    this.ticketSign = null;
    this.station = null;
    this.up = [];
    this.rack = [];
    this.queue = [];
  }

  private build(frame: GondolaFrame, layout: SceneLayout, animate: boolean) {
    this.clearTurn();
    this.moved = layout.moved;
    this.remainderUp = false;
    const showBunnies = frame.representation !== 'numbers';
    const ridersInCompact = frame.representation === 'bunnies';
    const colorBase = frame.turn * 2;

    // Full cabins up the cable, oldest highest; this turn's ones wear golden edges.
    for (let index = 0; index < layout.up; index++) {
      const entity = this.addCabin(CABIN_COLORS[(index + 3) % CABIN_COLORS.length], UP_SCALE);
      entity.cabin.setTag('10', TAG_SCREEN);
      entity.cabin.setFresh(index >= layout.up - layout.freshUp);
      if (ridersInCompact) this.fillCabin(entity, 10, false);
      this.up.push(entity);
    }
    // The rack: full cabins standing by. For taking away the first full cabin is at the station.
    const racked = frame.kind === 'sub' && !layout.moved ? Math.max(0, layout.parked - 1) : layout.parked;
    for (let index = 0; index < racked; index++) this.addRack(index, ridersInCompact);

    const tarp = frame.tarp;
    const tagFor = (n: number) => (frame.representation === 'numbers' || tarp ? String(n) : '');
    const stationCabin = (count: number, color: string, door: number) => {
      const entity = this.addCabin(color, 1);
      this.place(entity, STATION);
      entity.cabin.setDoor(door);
      entity.doorTo = door;
      entity.cabin.setTarp(tarp);
      entity.cabin.setTag(tagFor(count));
      if (showBunnies && !tarp) this.fillCabin(entity, count, false);
      this.station = entity;
      return entity;
    };

    if (frame.kind === 'add') {
      if (!layout.moved) {
        const entity = stationCabin(layout.boarding ?? 0, CABIN_COLORS[colorBase % CABIN_COLORS.length], 0);
        if (animate) this.arrive(entity, IN_FROM_VALLEY, 0);
        this.makeQueue(frame, layout.waiting, frame.vip);
        this.placeQueue(frame, true);
      } else {
        const remainder = layout.boarding ?? 0;
        const solved = frame.phase === 'solved' || frame.phase === 'complete';
        if (frame.move === 'express') {
          stationCabin(remainder, CABIN_COLORS[colorBase % CABIN_COLORS.length], 1);
          this.addWavers(layout.hopped, -1);
        } else if (!solved) {
          stationCabin(remainder, CABIN_COLORS[(colorBase + 1) % CABIN_COLORS.length], 1);
        } else {
          const entity = this.addCabin(CABIN_COLORS[(colorBase + 1) % CABIN_COLORS.length], UP_SCALE);
          entity.cabin.setTag(String(remainder), TAG_SCREEN);
          if (ridersInCompact) this.fillCabin(entity, remainder, false);
          this.up.push(entity);
          this.remainderUp = true;
        }
      }
    } else {
      if (!layout.moved) {
        const entity = stationCabin(10, CABIN_COLORS[colorBase % CABIN_COLORS.length], 1);
        entity.cabin.setTag(frame.representation === 'numbers' || tarp ? '10' : '');
        if (animate) this.arrive(entity, IN_FROM_VALLEY, 0);
        this.makeQueue(frame, layout.loose, frame.vip);
        this.placeQueue(frame, true);
        this.ticketSign = this.addSign(`↓ ${layout.ticket}`, new Vector3(5.2, 0, 1.45), '#e8f4ff');
      } else {
        if (layout.opened !== null)
          stationCabin(layout.opened, CABIN_COLORS[colorBase % CABIN_COLORS.length], 1);
        this.makeQueue(frame, layout.loose, frame.vip);
        this.placeQueue(frame, true);
        if (frame.move === 'express') this.markWavers(layout.hopped, 1);
      }
    }
    this.up.forEach((entity, index) => this.place(entity, this.upSpot(index, this.up.length)));
    this.rackFrame.visible = this.rack.length > 0;
  }

  /** Sends cabins up the cable; the ones already up move on, so the newest is nearest. */
  private departUp(leaving: readonly CabinEntity[], duration: number) {
    this.up.push(...leaving);
    const total = this.up.length;
    this.up.forEach((entity, index) => {
      const spot = this.upSpot(index, total);
      if (leaving.includes(entity)) this.send(entity, [CABLE_BEND, spot], duration, false, UP_SCALE);
      else this.send(entity, [spot], duration);
    });
  }

  private addCabin(color: string, scale: number): CabinEntity {
    const cabin = new Cabin(this.kit, { color });
    cabin.root.scale.setScalar(scale);
    cabin.setDoor(1);
    this.scene.add(cabin.root);
    const entity: CabinEntity = {
      cabin,
      scale,
      route: null,
      swingAt: -10,
      doorTo: 1,
      doorAt: -10,
      jamAt: -10,
      filled: 0,
      pulse: false,
      shakeAt: -10,
    };
    this.cabins.push(entity);
    return entity;
  }

  private addRack(index: number, riders: boolean) {
    const entity = this.addCabin(CABIN_COLORS[(index + 1) % CABIN_COLORS.length], RACK_SCALE);
    this.place(entity, this.rackSpot(index));
    entity.cabin.setTag('10', TAG_SCREEN * 0.8);
    if (riders) this.fillCabin(entity, 10, false);
    this.rack.push(entity);
    return entity;
  }

  private place(entity: CabinEntity, spot: Vector3) {
    entity.cabin.root.position.copy(spot);
    entity.route = null;
  }

  /** Cabin `index` of `total` up the cable: the oldest highest, the newest just out of the station. */
  private upSpot(index: number, total: number) {
    const u = Math.min(0.9, 0.09 + (total - 1 - index) * 0.072);
    return new Vector3().lerpVectors(CABLE_BEND, SUMMIT, u);
  }

  private rackSpot(index: number) {
    const row = Math.floor(index / 5);
    return new Vector3(3.0 + (index % 5) * 0.84, 2.0 + row * 1.12, -1.95 - row * 0.2);
  }

  /** Seats `count` bunnies in a cabin at once. */
  private fillCabin(entity: CabinEntity, count: number, crownLast: boolean) {
    for (let seat = 0; seat < count; seat++) {
      const rider = this.addRider(seat + this.riders.length, crownLast && seat === count - 1);
      this.seat(rider, entity, seat);
    }
  }

  private addRider(index: number, crown = false): Rider {
    const bunny = new Bunny(this.kit, bunnyLook(index, crown));
    this.scene.add(bunny.root);
    const rider: Rider = { bunny, home: { spot: new Vector3() }, hop: null, wave: false };
    this.riders.push(rider);
    return rider;
  }

  /** Puts a rider in a seat now. */
  private seat(rider: Rider, entity: CabinEntity, seat: number) {
    rider.home = { cabin: entity, seat };
    rider.hop = null;
    const anchor = entity.cabin.seats[seat];
    anchor.add(rider.bunny.root);
    rider.bunny.root.position.set(0, 0, 0);
    rider.bunny.root.scale.setScalar(0.72);
    rider.bunny.root.rotation.set(0, 0, 0);
  }

  private makeQueue(frame: GondolaFrame, count: number, vip: boolean) {
    this.queue = [];
    if (frame.representation === 'numbers') {
      if (count > 0) this.queueSign = this.addSign(String(count), new Vector3(1.9, 0, QUEUE_Z), '#fff1cb');
      return;
    }
    for (let index = 0; index < count; index++) {
      const rider = this.addRider(40 + index, vip && index === count - 1);
      rider.home = { spot: new Vector3() };
      this.scene.attach(rider.bunny.root);
      rider.bunny.root.scale.setScalar(WALKER);
      this.queue.push(rider);
    }
  }

  /** Lines the queue up along the platform, with the split gap after `frame.split` bunnies. */
  private placeQueue(frame: GondolaFrame, now: boolean) {
    this.queue.forEach((rider, index) => {
      if (!('spot' in rider.home)) return;
      const gap = frame.split > 0 && index >= frame.split ? SPLIT_GAP : 0;
      const spot = rider.home.spot.set(QUEUE_X + index * QUEUE_STEP + gap, 0, QUEUE_Z + (index % 2) * 0.08);
      if (now && !rider.hop) {
        rider.bunny.root.position.copy(spot);
        rider.bunny.root.rotation.y = -0.25;
      }
    });
  }

  /** Express wavers: bunnies who hopped off (adding) stand on the platform with "−1". */
  private addWavers(count: number, sign: -1 | 1) {
    const riders: Rider[] = [];
    for (let index = 0; index < count; index++) {
      const rider = this.addRider(70 + index);
      rider.home = { spot: new Vector3(QUEUE_X + 0.2 + index * 0.6, 0, QUEUE_Z + 0.2) };
      rider.bunny.root.position.copy(rider.home.spot);
      rider.bunny.root.scale.setScalar(WALKER);
      riders.push(rider);
    }
    this.markWavers(riders.length, sign, riders);
    return riders;
  }

  /** Marks the last `count` of the queue (or the given riders) as express wavers. */
  private markWavers(count: number, sign: -1 | 1, riders: Rider[] = this.queue.slice(-count)) {
    for (const rider of riders.slice(-count)) {
      rider.wave = true;
      const label = new TextLabel(sign < 0 ? '−1' : '+1', {
        fill: sign < 0 ? '#ffe3ee' : '#dfefe3',
        border: sign < 0 ? '#a3124a' : '#326a3a',
        width: 160,
        height: 120,
        radius: 0.4,
      });
      const sprite = new Sprite(new SpriteMaterial({ map: label.texture, transparent: true, depthWrite: false }));
      sprite.scale.set(0.5, 0.375, 1);
      sprite.position.set(0, 1.25, 0);
      rider.bunny.root.add(sprite);
      rider.sign = { sprite, label };
    }
  }

  private addSign(text: string, at: Vector3, fill: string): SignView {
    const group = new Group();
    const wood = this.kit.mat('#8b5a2b', { roughness: 0.85 });
    group.add(this.kit.rod(wood, new Vector3(0, 0, 0), new Vector3(0, 0.95, 0), 0.05));
    const label = new TextLabel(text, { fill, border: '#8b5a2b', width: 224, height: 160, radius: 0.25 });
    const sprite = new Sprite(new SpriteMaterial({ map: label.texture, transparent: true }));
    sprite.scale.set(0.95, 0.68, 1);
    sprite.position.y = 1.2;
    group.add(sprite);
    group.position.copy(at);
    this.scene.add(group);
    const view = { group, label, sprite };
    this.signs.push(view);
    return view;
  }

  private dropSign(sign: SignView) {
    sign.group.removeFromParent();
    sign.label.texture.dispose();
    sign.sprite.material.dispose();
    sign.group.traverse((object) => {
      if (object instanceof Mesh && object.geometry instanceof CylinderGeometry) object.geometry.dispose();
    });
  }

  private dropRider(rider: Rider) {
    const index = this.riders.indexOf(rider);
    if (index >= 0) this.riders.splice(index, 1);
    if (rider.sign) {
      rider.sign.label.texture.dispose();
      rider.sign.sprite.material.dispose();
    }
    disposeFigure(rider.bunny.root, this.kit);
  }

  private dropCabin(entity: CabinEntity) {
    for (const rider of [...this.riders])
      if ('cabin' in rider.home && rider.home.cabin === entity) this.dropRider(rider);
    const index = this.cabins.indexOf(entity);
    if (index >= 0) this.cabins.splice(index, 1);
    entity.cabin.dispose();
  }

  // -------------------------------------------------------------------------------------------
  // Scripted moves

  private later(delay: number, run: () => void) {
    this.timers.push({ at: this.elapsed + delay, run });
  }

  /** Sends a cabin along a path of points, from where it is now. */
  private send(entity: CabinEntity, points: readonly Vector3[], duration: number, remove = false, scaleTo?: number) {
    entity.route = {
      points: [entity.cabin.root.position.clone(), ...points],
      start: this.elapsed,
      duration,
      remove,
      scaleTo,
    };
    entity.swingAt = this.elapsed;
  }

  /** A cabin glides in to where it already stands, from off to one side. */
  private arrive(entity: CabinEntity, from: readonly Vector3[], delay: number) {
    const target = entity.cabin.root.position.clone();
    entity.cabin.root.position.copy(from[0]);
    entity.route = { points: [...from, target], start: this.elapsed + delay, duration: 0.9, remove: false };
    entity.swingAt = this.elapsed + delay;
  }

  /** A rider hops in a little arc to its new home. */
  private hopTo(rider: Rider, home: Rider['home'], delay: number, height = 0.6) {
    rider.home = home;
    rider.hop = { start: this.elapsed + delay, duration: HOP_TIME, height };
  }

  private door(entity: CabinEntity, shut: number, delay = 0) {
    this.later(delay, () => {
      entity.doorTo = shut;
      entity.doorAt = this.elapsed;
    });
  }

  private playMove(frame: GondolaFrame) {
    this.moved = true;
    const layout = sceneLayout(frame);
    if (this.ticketSign) {
      this.dropSign(this.ticketSign);
      this.signs.splice(this.signs.indexOf(this.ticketSign), 1);
      this.ticketSign = null;
    }
    if (frame.kind === 'add' && frame.move === 'express') this.playExpressUp(frame, layout);
    else if (frame.kind === 'add') this.playFill(frame, layout);
    else if (frame.move === 'express') this.playExpressDown(frame, layout);
    else this.playDown(frame, layout);
  }

  /** 8 + 5: two hop in, the full cabin leaves as a "10", the other three take the next one. */
  private playFill(frame: GondolaFrame, layout: SceneLayout) {
    const main = this.station;
    const fill = 10 - frame.cabin;
    const showBunnies = frame.representation !== 'numbers' && !frame.tarp;
    const firsts = this.queue.slice(0, fill);
    const rest = this.queue.slice(fill);
    this.queue = [];
    if (main) {
      firsts.forEach((rider, index) =>
        showBunnies ? this.hopTo(rider, { cabin: main, seat: frame.cabin + index }, index * 0.05) : this.vanish(rider, index * 0.05),
      );
      this.door(main, 1, 0.6);
      this.later(0.75, () => {
        this.sparkle(this.temp.copy(STATION).add(this.temp2.set(0, -1.7, 0.8)), '#fff6bf');
        main.cabin.setTag('10');
        main.cabin.setFresh(true);
        this.waveAt = this.elapsed;
      });
      this.later(1.0, () => {
        for (const entity of this.rack) entity.cabin.setFresh(true);
        this.departUp([...this.rack, main], 1.6);
        this.rack = [];
        this.rackFrame.visible = false;
        main.cabin.setTag('10', TAG_SCREEN);
      });
    }
    if (this.queueSign) this.fadeSign(this.queueSign, 0.6);
    // The next cabin comes up from the valley for the rest.
    this.later(1.25, () => {
      const next = this.addCabin(CABIN_COLORS[(frame.turn * 2 + 1) % CABIN_COLORS.length], 1);
      this.place(next, STATION);
      next.cabin.setDoor(0);
      next.doorTo = 0;
      next.cabin.setTarp(frame.tarp);
      next.cabin.setTag(frame.representation === 'numbers' || frame.tarp ? String(layout.boarding ?? 0) : '');
      this.arrive(next, IN_FROM_VALLEY, 0);
      this.station = next;
      this.dress(frame);
      rest.forEach((rider, index) =>
        showBunnies ? this.hopTo(rider, { cabin: next, seat: index }, 0.85 + index * 0.05) : this.vanish(rider, 0.85),
      );
      this.door(next, 1, 1.5);
    });
  }

  /** 34 + 9 the express way: a full cabin goes up, then one bunny hops back off. */
  private playExpressUp(frame: GondolaFrame, layout: SceneLayout) {
    const express = this.addCabin('#d94a3a', BAY_SCALE);
    this.place(express, BAY);
    express.cabin.setDoor(0);
    express.doorTo = 0;
    express.cabin.setGolden(frame.golden);
    this.arrive(express, [IN_FROM_RIGHT], 0);
    const showBunnies = frame.representation !== 'numbers';
    // The express comes with the bunnies who will hop off already aboard: it leaves full.
    const hoppers: Rider[] = [];
    for (let index = 0; index < layout.hopped; index++) {
      const rider = this.addRider(80 + index);
      this.seat(rider, express, 9 - index);
      hoppers.push(rider);
    }
    const boarders = this.queue;
    this.queue = [];
    boarders.forEach((rider, index) =>
      showBunnies ? this.hopTo(rider, { cabin: express, seat: index }, 0.95 + index * 0.04) : this.vanish(rider, 0.9),
    );
    if (this.queueSign) this.fadeSign(this.queueSign, 0.9);
    this.later(1.55, () => express.cabin.setTag('10'));
    this.door(express, 1, 1.55);
    this.later(1.85, () => {
      express.doorTo = 0;
      express.doorAt = this.elapsed;
      hoppers.forEach((rider, index) => {
        this.scene.attach(rider.bunny.root);
        this.hopTo(rider, { spot: new Vector3(QUEUE_X + 0.2 + index * 0.6, 0, QUEUE_Z + 0.2) }, index * 0.1, 0.9);
      });
      this.markWavers(hoppers.length, -1, hoppers);
    });
    this.door(express, 1, 2.35);
    this.later(2.6, () => {
      this.waveAt = this.elapsed;
      express.cabin.setFresh(true);
      express.cabin.setTag('10', TAG_SCREEN);
      for (const entity of this.rack) entity.cabin.setFresh(true);
      this.departUp([...this.rack, express], 1.7);
      this.rack = [];
      this.rackFrame.visible = false;
    });
  }

  /** 13 − 5: the loose bunnies ride down first, then two leave the full cabin. */
  private playDown(frame: GondolaFrame, layout: SceneLayout) {
    const main = this.station;
    const showBunnies = frame.representation !== 'numbers' && !frame.tarp;
    const down = this.addCabin(CABIN_COLORS[(frame.turn * 2 + 1) % CABIN_COLORS.length], BAY_SCALE);
    this.place(down, BAY);
    down.cabin.setDoor(0);
    down.doorTo = 0;
    this.arrive(down, [IN_FROM_RIGHT], 0);
    const takeTen = frame.move === 'takeTen';
    const loose = takeTen ? [] : this.queue;
    if (!takeTen) {
      this.queue = [];
      loose.forEach((rider, index) =>
        frame.representation !== 'numbers'
          ? this.hopTo(rider, { cabin: down, seat: index }, 0.9 + index * 0.05)
          : this.vanish(rider, 0.9),
      );
      if (this.queueSign) this.fadeSign(this.queueSign, 0.9);
    }
    // Then the rest leave the full cabin from its last seats, so it still reads as a ten-frame.
    const fromCabin = takeTen ? frame.group : frame.group - frame.cabin;
    if (main) {
      this.door(main, 0, takeTen ? 0.7 : 1.4);
      const leavers = this.riders.filter(
        (rider) => 'cabin' in rider.home && rider.home.cabin === main && rider.home.seat >= 10 - fromCabin,
      );
      this.later(takeTen ? 0.95 : 1.6, () => {
        leavers.forEach((rider, index) => {
          this.scene.attach(rider.bunny.root);
          this.hopTo(rider, { cabin: down, seat: loose.length + index }, index * 0.05, 0.9);
        });
        main.cabin.setTag(frame.representation === 'numbers' || frame.tarp ? String(layout.opened ?? 0) : '');
        if (!showBunnies) main.shakeAt = this.elapsed;
      });
      this.door(main, 1, takeTen ? 1.6 : 2.3);
    }
    this.door(down, 1, takeTen ? 1.7 : 2.4);
    this.later(takeTen ? 2.0 : 2.7, () => {
      this.waveAt = this.elapsed;
      this.send(down, DOWN_WAY, 1.8, true);
      // The tens that go down whole ride along.
      const goingDown = this.rack.slice(0, frame.groupTens);
      this.rack = this.rack.slice(frame.groupTens);
      goingDown.forEach((entity) => this.send(entity, DOWN_WAY, 1.9, true));
    });
  }

  /** 63 − 9 the express way: a full cabin goes down, then one bunny hops back on. */
  private playExpressDown(frame: GondolaFrame, layout: SceneLayout) {
    const main = this.station;
    this.station = null;
    const hoppers: Rider[] = [];
    if (main) {
      this.door(main, 0, 0.1);
      this.later(0.45, () => {
        for (let index = 0; index < layout.hopped; index++) {
          const rider = this.addRider(90 + index);
          rider.bunny.root.position.copy(STATION).add(this.temp.set(0.6 - index * 0.4, -2.4, 0.6));
          rider.bunny.root.scale.setScalar(WALKER);
          const spot = new Vector3(QUEUE_X + (this.queue.length + index) * QUEUE_STEP, 0, QUEUE_Z);
          this.hopTo(rider, { spot }, 0, 0.9);
          hoppers.push(rider);
          this.queue.push(rider);
        }
        this.markWavers(hoppers.length, 1, hoppers);
        if (this.queueSign) this.queueSign.label.update(String(layout.loose));
      });
      this.door(main, 1, 0.9);
      this.later(1.2, () => {
        this.waveAt = this.elapsed;
        main.cabin.setTag('10');
        this.send(main, DOWN_FROM_STATION, 1.8, true);
      });
    }
    const extra = frame.expressCabins - 1;
    const goingDown = this.rack.slice(0, extra);
    this.rack = this.rack.slice(extra);
    this.later(1.4, () => goingDown.forEach((entity) => this.send(entity, DOWN_WAY, 1.9, true)));
  }

  /** In the numbers view the queue is a sign; bunnies that are not drawn just fade away. */
  private vanish(rider: Rider, delay: number) {
    this.later(delay, () => this.dropRider(rider));
  }

  private fadeSign(sign: SignView, delay: number) {
    this.later(delay, () => {
      const index = this.signs.indexOf(sign);
      if (index >= 0) this.signs.splice(index, 1);
      this.dropSign(sign);
      if (this.queueSign === sign) this.queueSign = null;
    });
  }

  /** A wrong split: the split part hops to the door and back; extras bounce off, or the door jams. */
  private bounce(frame: GondolaFrame, tooMany: boolean) {
    const main = this.station;
    if (!main) return;
    const fill = frame.kind === 'add' ? 10 - frame.cabin : frame.cabin;
    const door = this.temp.copy(STATION).add(this.temp2.set(0.2, -2.6, 1.0)).clone();
    this.queue.slice(0, frame.split).forEach((rider, index) => {
      const extra = index >= fill;
      rider.hop = {
        start: this.elapsed + index * 0.04,
        duration: extra && tooMany ? 1.0 : 0.8,
        height: extra && tooMany ? 1.5 : 0.5,
        bump: door.clone().add(this.temp2.set(index * 0.12, 0, 0)),
      };
    });
    if (tooMany) {
      main.shakeAt = this.elapsed + 0.35;
      this.later(0.4, () => this.puff(door));
    } else {
      main.jamAt = this.elapsed + 0.3;
      this.tapAt = this.elapsed;
    }
  }

  private cheer(frame: GondolaFrame) {
    this.cheerAt = this.elapsed;
    const at = this.temp.copy(STATION).add(this.temp2.set(0.5, 0, 0.5)).clone();
    this.confetti(at, frame.big ? 56 : 36);
    this.waveAt = this.elapsed;
    // Adding: the cabin with the rest rides up too, so both are up the mountain.
    if (frame.kind === 'add' && this.station && !this.remainderUp) {
      const last = this.station;
      this.remainderUp = true;
      this.station = null;
      this.later(0.9, () => {
        last.cabin.setTag(String(sceneLayout(frame).boarding ?? 0), TAG_SCREEN);
        this.departUp([last], 1.7);
      });
    }
  }

  // -------------------------------------------------------------------------------------------
  // Effects

  private sparkle(at: Vector3, color: string) {
    const material = this.kit.mat(color, { emissive: color, emissiveIntensity: 1 });
    for (let index = 0; index < 12; index++) {
      const mesh = new Mesh(this.kit.sparkle, material);
      mesh.scale.setScalar(0.08);
      mesh.position.copy(at);
      const angle = (index / 12) * Math.PI * 2;
      this.particles.push({
        mesh,
        velocity: new Vector3(Math.cos(angle) * 1.6, 1.2 + Math.sin(angle) * 1.2, 0.6),
        born: this.elapsed,
        life: 0.8,
        spin: 8,
        grow: 0,
        gravity: 1,
      });
      this.scene.add(mesh);
    }
  }

  private puff(at: Vector3) {
    for (let index = 0; index < 8; index++) {
      const mesh = new Mesh(this.puffGeometry, new MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.85 }));
      const angle = (index / 8) * Math.PI * 2;
      mesh.position.copy(at).add(this.temp2.set(Math.cos(angle) * 0.2, 0.3, Math.sin(angle) * 0.2));
      this.particles.push({
        mesh,
        velocity: new Vector3(Math.cos(angle) * 0.9, 0.8, Math.sin(angle) * 0.6),
        born: this.elapsed,
        life: 0.9,
        spin: 0,
        grow: 1.6,
        gravity: -0.5,
      });
      this.scene.add(mesh);
    }
  }

  private confetti(at: Vector3, count: number) {
    const colors = ['#e0457b', '#ffd23f', '#3d8fe0', '#3fa65a', '#8a5cc7', '#ff9a3c'];
    for (let index = 0; index < count; index++) {
      const color = colors[index % colors.length];
      const mesh = new Mesh(this.confettiGeometry, this.kit.mat(color, { emissive: color, emissiveIntensity: 0.3, side: DoubleSide }));
      mesh.position.copy(at);
      const angle = (index / count) * Math.PI * 2;
      const speed = 1.6 + (index % 4) * 0.5;
      this.particles.push({
        mesh,
        velocity: new Vector3(Math.cos(angle) * speed, 4.5 + (index % 5) * 0.5, Math.sin(angle) * speed * 0.6),
        born: this.elapsed,
        life: 2.2,
        spin: 6 + (index % 7),
        grow: 0,
        gravity: 5,
      });
      this.scene.add(mesh);
    }
  }

  // -------------------------------------------------------------------------------------------
  // Frame loop

  protected override layout(aspect: number) {
    this.camera.clearViewOffset();
    super.layout(aspect);
    const { width, height } = this;
    // Pull back until the platform, Gusti, the cocoa and the summit all fit, then centre them.
    const room = { x: width * 0.98, y: height * 0.98 };
    let distance = 9;
    let box = this.aim(distance, aspect);
    while ((box.right - box.left > room.x || box.bottom - box.top > room.y) && distance < 90) {
      distance *= 1.03;
      box = this.aim(distance, aspect);
    }
    const dx = (box.left + box.right) / 2 - width / 2;
    const dy = (box.top + box.bottom) / 2 - height / 2;
    this.camera.setViewOffset(width, height, dx, dy, width, height);
  }

  /** Puts the camera `distance` from the station and returns the framed points' box in pixels. */
  private aim(distance: number, aspect: number) {
    const camera = this.camera;
    // Wide boxes look along the platform; tall ones look up more to show the mountain.
    const pitch = aspect < 1.1 ? 0.2 : 0.17;
    const yaw = -0.1;
    const target = this.temp.set(1.4, aspect < 1.1 ? 2.6 : 2.0, -1.2);
    camera.position.set(
      target.x + Math.sin(yaw) * Math.cos(pitch) * distance,
      target.y + Math.sin(pitch) * distance,
      target.z + Math.cos(yaw) * Math.cos(pitch) * distance,
    );
    camera.lookAt(target);
    camera.updateMatrixWorld();
    const points = aspect < 1.1 ? FRAME_TALL : aspect < 1.65 ? FRAME_WIDE : FRAME_SIDEWAYS;
    const box = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
    for (const point of points) {
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
    const frame = this.frame;
    if (!frame) return;
    const calm = this.calm;
    // Scripted steps whose time has come.
    for (let index = 0; index < this.timers.length; ) {
      if (this.timers[index].at <= t) {
        const [timer] = this.timers.splice(index, 1);
        timer.run();
      } else index++;
    }
    this.moveCabins(t, calm);
    this.moveRiders(dt, t, calm);
    this.moveGoat(t, calm, frame);
    this.moveParticles(dt, t);
    this.moveWeather(dt, t, calm, frame);
  }

  private moveCabins(t: number, calm: boolean) {
    for (const entity of [...this.cabins]) {
      const root = entity.cabin.root;
      const route = entity.route;
      if (route && t >= route.start) {
        const progress = Math.min(1, (t - route.start) / route.duration);
        this.along(route.points, smooth(progress), root.position);
        if (route.scaleTo !== undefined) {
          const scale = entity.scale + (route.scaleTo - entity.scale) * easeOut(progress);
          root.scale.setScalar(scale);
        }
        if (progress >= 1) {
          if (route.scaleTo !== undefined) entity.scale = route.scaleTo;
          entity.route = null;
          entity.swingAt = t;
          if (route.remove) {
            this.dropCabin(entity);
            continue;
          }
        }
      }
      // A swing that dies away after starting and stopping, and a gentle sway on the cable.
      const since = t - entity.swingAt;
      const swing = since >= 0 && since < 3 ? Math.sin(since * 5) * 0.12 * Math.exp(-since * 1.4) : 0;
      const sway = calm ? 0 : Math.sin(t * 0.9 + root.position.x) * 0.012;
      entity.cabin.body.rotation.z = swing + sway + shake(t, entity.shakeAt, 0.6, 0.08);
      const pulse = entity.pulse ? 1 + Math.max(0, Math.sin(t * 5)) * 0.06 : 1;
      entity.cabin.body.scale.setScalar(pulse);
      // Doors slide over a third of a second; a jam rattles them half shut.
      const doorAge = (t - entity.doorAt) / 0.35;
      const from = entity.doorTo === 1 ? 0 : 1;
      let shut = entity.doorAt < 0 ? entity.doorTo : from + (entity.doorTo - from) * smooth(doorAge);
      let rattle = 0;
      const jam = t - entity.jamAt;
      if (jam >= 0 && jam < 1.1) {
        shut = 0.55 + Math.sin(jam * 30) * 0.08;
        rattle = Math.sin(jam * 40) * 0.015;
        if (jam > 1.0) shut = entity.doorTo;
      }
      if (shut !== entity.cabin.door || rattle) entity.cabin.setDoor(shut, rattle);
      const glow = this.frame?.help === 'seats' && entity === this.station && !this.moved;
      if (glow && this.frame?.kind === 'add')
        entity.cabin.glowSeats(entity.filled, calm || Math.sin(t * 6) > -0.3);
      entity.cabin.animate(t, calm);
    }
  }

  /** The point a share `u` of the way along a path of points. */
  private along(points: readonly Vector3[], u: number, out: Vector3) {
    let total = 0;
    for (let index = 1; index < points.length; index++) total += points[index].distanceTo(points[index - 1]);
    let left = u * total;
    for (let index = 1; index < points.length; index++) {
      const length = points[index].distanceTo(points[index - 1]);
      if (left <= length || index === points.length - 1) {
        return out.lerpVectors(points[index - 1], points[index], length ? Math.min(1, left / length) : 1);
      }
      left -= length;
    }
    return out.copy(points[points.length - 1]);
  }

  private moveRiders(dt: number, t: number, calm: boolean) {
    const cheer = t - this.cheerAt;
    const shiver = t - this.shiverAt;
    for (const rider of [...this.riders]) {
      const { bunny } = rider;
      const hop = rider.hop;
      if (hop && t >= hop.start) {
        const progress = Math.min(1, (t - hop.start) / hop.duration);
        if (hop.bump) {
          // To the door and straight back home.
          const home = 'spot' in rider.home ? rider.home.spot : null;
          if (!home) {
            rider.hop = null;
            continue;
          }
          const there = progress < 0.5 ? progress * 2 : 2 - progress * 2;
          bunny.root.position.lerpVectors(home, hop.bump, smooth(there));
          bunny.root.position.y += Math.sin(progress * Math.PI * 2) ** 2 * hop.height * 0.5 + Math.sin(progress * Math.PI) * 0.2;
          if (progress >= 1) {
            rider.hop = null;
            bunny.root.position.copy(home);
          }
        } else {
          if (!hop.from) {
            if (bunny.root.parent !== this.scene) this.scene.attach(bunny.root);
            hop.from = bunny.root.position.clone();
            hop.fromScale = bunny.root.scale.x;
          }
          const target = this.homePosition(rider, this.temp);
          const scale = 'cabin' in rider.home ? 0.72 * rider.home.cabin.cabin.root.scale.x : WALKER;
          bunny.root.position.lerpVectors(hop.from, target, smooth(progress));
          bunny.root.position.y += Math.sin(progress * Math.PI) * hop.height;
          bunny.root.scale.setScalar(hop.fromScale! + (scale - hop.fromScale!) * progress);
          bunny.root.rotation.y = 0;
          // Squash before take-off and on landing, stretch in the air.
          const stretch = 1 + Math.sin(progress * Math.PI) * 0.18;
          bunny.body.scale.set(1 / Math.sqrt(stretch), stretch, 1 / Math.sqrt(stretch));
          if (progress >= 1) {
            rider.hop = null;
            bunny.body.scale.setScalar(1);
            if ('cabin' in rider.home) this.seat(rider, rider.home.cabin, rider.home.seat);
          }
        }
      }
      // Standing riders slide to their spot when the split handle opens or closes the gap.
      if (!rider.hop && 'spot' in rider.home && bunny.root.parent === this.scene) {
        const spot = rider.home.spot;
        const rate = Math.min(1, dt * 12);
        bunny.root.position.x += (spot.x - bunny.root.position.x) * rate;
        bunny.root.position.z += (spot.z - bunny.root.position.z) * rate;
      }
      // Ears bounce while hopping and when cheering; riders cheer from the windows.
      const ears = hop && t >= hop.start ? Math.sin((t - hop.start) * 18) * 0.35 : 0;
      const idle = calm ? 0 : Math.sin(t * 2.2 + bunny.look.fur.length + rider.bunny.root.id) * 0.06;
      const happy = cheer >= 0 && cheer < 1.4 ? Math.sin(cheer * 14) * 0.3 * (1 - cheer / 1.4) : 0;
      bunny.ears[0].rotation.x = -0.22 + ears + idle + happy;
      bunny.ears[1].rotation.x = -0.22 - ears * 0.8 + idle * 0.7 + happy;
      if (!rider.hop) {
        const jump = cheer >= 0 && cheer < 1.2 ? Math.abs(Math.sin(cheer * 9)) * 0.12 * (1 - cheer / 1.2) : 0;
        bunny.body.position.y = jump;
        bunny.body.position.x = shiver >= 0 && shiver < 1.6 ? Math.sin(shiver * 70) * 0.012 : 0;
      }
      // Wavers wave their paw; everyone waves at the cheer.
      const waving = rider.wave || (cheer >= 0 && cheer < 1.4);
      bunny.paw.rotation.x = waving ? -2.3 : 0;
      bunny.paw.rotation.z = waving && !calm ? Math.sin(t * 10) * 0.4 : 0;
      if (rider.sign) rider.sign.sprite.position.y = 1.25 + (calm ? 0 : Math.sin(t * 3) * 0.05);
    }
  }

  private homePosition(rider: Rider, out: Vector3) {
    if ('spot' in rider.home) return out.copy(rider.home.spot);
    return rider.home.cabin.cabin.seats[rider.home.seat].getWorldPosition(out);
  }

  private moveGoat(t: number, calm: boolean, frame: GondolaFrame) {
    const goat = this.goat;
    const dancing = frame.phase === 'complete';
    const wave = t - this.waveAt;
    const tap = t - this.tapAt;
    const shrug = t - this.shrugAt;
    const leg = goat.waveLeg;
    goat.body.position.y = calm ? 0 : Math.sin(t * 1.8) * 0.008;
    goat.body.rotation.set(0, 0, 0);
    goat.head.rotation.set(0, calm ? 0 : Math.sin(t * 0.5) * 0.2, 0);
    leg.hip.rotation.set(0, 0, 0);
    leg.knee.rotation.set(0, 0, 0);
    for (const other of goat.legs) {
      other.hip.rotation.x = 0;
      other.knee.rotation.x = 0;
    }
    if (dancing) {
      const beat = calm ? 0 : t * 6;
      goat.body.position.y = Math.abs(Math.sin(beat)) * 0.18;
      goat.body.rotation.y = Math.sin(beat / 2) * 0.4;
      goat.head.rotation.z = Math.sin(beat) * 0.25;
      goat.legs.forEach((item, index) => (item.hip.rotation.x = Math.sin(beat + index * Math.PI) * 0.4));
      leg.hip.rotation.x = -1.8;
      leg.hip.rotation.z = Math.sin(beat) * 0.4;
    } else if (shrug >= 0 && shrug < 1.1) {
      const amount = Math.sin((shrug / 1.1) * Math.PI);
      goat.head.rotation.z = amount * 0.35;
      goat.head.rotation.x = amount * 0.15;
      goat.body.rotation.z = amount * 0.05;
      goat.legs[0].hip.rotation.x = -amount * 0.4;
      leg.hip.rotation.x = -amount * 0.4;
    } else if (tap >= 0 && tap < 1.4) {
      // Gusti points at the empty seats and taps twice.
      const lift = smooth(Math.min(1, tap * 4)) * (1 - smooth((tap - 1.1) * 3.3));
      leg.hip.rotation.x = -1.2 * lift + Math.max(0, Math.sin(tap * 12)) * 0.25 * lift;
      leg.knee.rotation.x = 0.4 * lift;
      goat.head.rotation.y = 0.5 * lift;
    } else if (wave >= 0 && wave < 1.6) {
      const lift = smooth(Math.min(1, wave * 4)) * (1 - smooth((wave - 1.3) * 3.3));
      leg.hip.rotation.x = -2.0 * lift;
      leg.hip.rotation.z = calm ? 0 : Math.sin(wave * 12) * 0.35 * lift;
      leg.knee.rotation.x = -0.3 * lift;
    }
  }

  private moveParticles(dt: number, t: number) {
    for (let index = this.particles.length - 1; index >= 0; index--) {
      const particle = this.particles[index];
      const age = t - particle.born;
      if (age > particle.life) {
        particle.mesh.removeFromParent();
        if (particle.grow) (particle.mesh.material as MeshStandardMaterial).dispose();
        this.particles.splice(index, 1);
        continue;
      }
      particle.velocity.y -= particle.gravity * dt;
      particle.mesh.position.addScaledVector(particle.velocity, dt);
      particle.mesh.rotation.x += particle.spin * dt;
      particle.mesh.rotation.y += particle.spin * 0.7 * dt;
      if (particle.grow) {
        particle.mesh.scale.setScalar(1 + age * particle.grow);
        (particle.mesh.material as MeshStandardMaterial).opacity = 0.85 * (1 - age / particle.life);
      }
    }
  }

  private moveWeather(dt: number, t: number, calm: boolean, frame: GondolaFrame) {
    // The snow cloud drifts in from the right, grows and darkens as the pace runs out.
    this.cloudShare += (frame.cloud - this.cloudShare) * Math.min(1, dt * 3);
    const share = this.cloudShare;
    this.cloud.visible = frame.cocoa !== 'none' || frame.cloud > 0;
    this.cloud.position.set(11 - share * 8.6, 7.6 - share * 2.0, -5 + share * 4.6);
    this.cloud.scale.setScalar(0.75 + share * 0.65);
    this.cloudMaterial.color.lerpColors(this.cloudWhite, this.cloudGrey, share * share);
    this.cloudPuffs.forEach((puff, index) => {
      puff.position.y = puff.userData['y'] + (calm ? 0 : Math.sin(t * 0.8 + index) * 0.06);
    });
    // Steam curls up from the warm cocoa; cold cocoa has none.
    const warm = frame.cocoa === 'warm';
    this.steam.forEach((puff, index) => {
      puff.visible = warm;
      if (!warm) return;
      const cycle = ((calm ? 0.4 : t * 0.6) + index / this.steam.length) % 1;
      puff.position.set(Math.sin(cycle * 6 + index) * 0.06, 0.62 + cycle * 0.7, 0);
      puff.scale.setScalar(0.06 + cycle * 0.08);
      (puff.material as MeshStandardMaterial).opacity = 0.55 * (1 - cycle);
    });
    // Snowflakes drift down and wrap round; heavier under a cloud that has arrived.
    const positions = this.snow.geometry.getAttribute('position');
    const array = positions.array as Float32Array;
    const speed = calm ? 0.15 : 0.6 + (share >= 0.99 ? 0.6 : 0);
    for (let index = 0; index < this.snowSpeed.length; index++) {
      const y = index * 3 + 1;
      array[y] -= this.snowSpeed[index] * speed * dt;
      array[y - 1] += (calm ? 0 : Math.sin(t + index) * 0.15) * dt;
      if (array[y] < -0.2) array[y] += 12;
    }
    positions.needsUpdate = true;
    for (const lantern of this.lanterns)
      if (lantern.glow.visible) lantern.glow.material.opacity = calm ? 0.8 : 0.7 + Math.sin(t * 3 + lantern.glow.id) * 0.12;
  }

  // -------------------------------------------------------------------------------------------
  // The world around

  private buildSky() {
    const geometry = new SphereGeometry(120, 32, 16);
    const colors: number[] = [];
    const top = new Color('#62aef0');
    const low = new Color('#eaf6ff');
    const position = geometry.getAttribute('position');
    const mixed = new Color();
    for (let index = 0; index < position.count; index++) {
      const y = position.getY(index) / 120;
      mixed.lerpColors(low, top, smooth(Math.max(0, y) * 1.6));
      colors.push(mixed.r, mixed.g, mixed.b);
    }
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    const sky = new Mesh(geometry, new MeshBasicMaterial({ vertexColors: true, side: BackSide, fog: false }));
    this.scene.add(sky);
    // Far peaks behind the mountain, pale blue in the haze.
    const peaks = new MeshStandardMaterial({ color: '#c9dcf0', roughness: 1, flatShading: true });
    const caps = new MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true });
    for (const [x, z, r, h] of [
      [-22, -55, 14, 22],
      [0, -62, 16, 26],
      [26, -58, 15, 24],
      [45, -45, 12, 18],
      [-40, -40, 12, 16],
    ]) {
      const peak = new Mesh(new ConeGeometry(r, h, 7), peaks);
      peak.position.set(x, h / 2 - 2, z);
      const cap = new Mesh(new ConeGeometry(r * 0.4, h * 0.4, 7), caps);
      cap.position.set(x, h - 2 - h * 0.2 + 0.05, z);
      this.scene.add(peak, cap);
    }
  }

  private buildMountain() {
    const size = 80;
    const geometry = new PlaneGeometry(size, size, 96, 96);
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(4, 0, -22);
    const position = geometry.getAttribute('position');
    const colors: number[] = [];
    const snow = new Color('#f7fbff');
    const shade = new Color('#cfe0f2');
    const mixed = new Color();
    for (let index = 0; index < position.count; index++) {
      const x = position.getX(index);
      const z = position.getZ(index);
      const h = groundHeight(x, z) - 0.02;
      position.setY(index, h);
      const ripple = (Math.sin(x * 1.3) * Math.cos(z * 1.1) + 1) / 2;
      mixed.lerpColors(snow, shade, Math.min(1, ripple * 0.35 + Math.max(0, -z - 4) * 0.012));
      colors.push(mixed.r, mixed.g, mixed.b);
    }
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    const ground = new Mesh(geometry, new MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Pine trees with snow on their branches, scattered up the slopes but off the cable's line.
    const spots: [number, number, number][] = [];
    let seed = 7;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let index = 0; index < 220 && spots.length < 90; index++) {
      const x = -24 + random() * 52;
      const z = -40 + random() * 36;
      const cable = Math.abs(x - (CABLE_BEND.x + ((SUMMIT.x - CABLE_BEND.x) * (CABLE_BEND.z - z)) / (CABLE_BEND.z - SUMMIT.z)));
      if (cable < 2.6 || (z > -4.5 && x > -7 && x < 9)) continue;
      if (Math.hypot(x - SUMMIT.x, z - SUMMIT.z) < 9.5) continue;
      spots.push([x, z, 0.8 + random() * 0.7]);
    }
    // A few big trees framing the station.
    spots.push([-7.4, -1.5, 1.6], [-8.6, 1.2, 1.9], [8.8, -2.2, 1.5], [9.6, 0.6, 1.8], [-6.2, -4, 1.3]);
    const trunk = new InstancedMesh(new CylinderGeometry(0.1, 0.14, 0.7, 6), this.kit.mat('#6b4426'), spots.length);
    const tiers = [0, 1, 2].map(
      (tier) => new InstancedMesh(new ConeGeometry(0.95 - tier * 0.25, 1.1, 9), this.kit.mat(tier === 1 ? '#2f6b45' : '#285e3d'), spots.length),
    );
    const caps = [0, 1, 2].map(
      (tier) => new InstancedMesh(new ConeGeometry(0.72 - tier * 0.2, 0.45, 9), this.kit.mat('#ffffff', { roughness: 1 }), spots.length),
    );
    const matrix = new Matrix4();
    spots.forEach(([x, z, s], index) => {
      const y = groundHeight(x, z);
      matrix.makeScale(s, s, s).setPosition(x, y + 0.35 * s, z);
      trunk.setMatrixAt(index, matrix);
      for (let tier = 0; tier < 3; tier++) {
        matrix.makeScale(s, s, s).setPosition(x, y + (0.95 + tier * 0.62) * s, z);
        tiers[tier].setMatrixAt(index, matrix);
        matrix.makeScale(s, s, s).setPosition(x, y + (1.32 + tier * 0.62) * s, z);
        caps[tier].setMatrixAt(index, matrix);
      }
    });
    for (const mesh of [trunk, ...tiers, ...caps]) {
      mesh.castShadow = true;
      this.scene.add(mesh);
    }
  }

  private buildStation() {
    const kit = this.kit;
    const plank = kit.mat('#b07a45', { roughness: 0.85 });
    const plankDark = kit.mat('#9a6638', { roughness: 0.85 });
    const beam = kit.mat('#7a4f2a', { roughness: 0.85 });
    // A wooden deck of planks, with a dark front edge.
    const width = 12.4;
    for (let index = 0; index < 9; index++) {
      const geometry = new PlaneGeometry(width, 0.5);
      geometry.rotateX(-Math.PI / 2);
      const strip = new Mesh(geometry, index % 2 ? plank : plankDark);
      strip.position.set(0.8, 0.001, 2.0 - index * 0.5);
      strip.receiveShadow = true;
      this.scene.add(strip);
    }
    const front = new Mesh(new PlaneGeometry(width, 0.6), beam);
    front.position.set(0.8, -0.3, 2.25);
    const base = new Mesh(new PlaneGeometry(width, 4.6), kit.mat('#6e4a2b'));
    base.rotation.x = -Math.PI / 2;
    base.position.set(0.8, -0.6, 0);
    this.scene.add(front, base);
    // Posts and a roof beam over the boarding bay, with the big bull wheel turning the cable.
    for (const x of [-3.4, 0.0]) {
      this.scene.add(kit.rod(beam, new Vector3(x, 0, -0.95), new Vector3(x, 4.1, -0.95), 0.12));
    }
    this.scene.add(kit.rod(beam, new Vector3(-3.6, 4.0, -0.95), new Vector3(0.2, 4.0, -0.95), 0.13));
    const roof = new Mesh(new ConeGeometry(2.9, 0.9, 4), kit.mat('#b8423a', { roughness: 0.7 }));
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1, 1, 0.6);
    roof.position.set(-1.7, 4.55, -0.95);
    const roofSnow = new Mesh(new ConeGeometry(2.5, 0.42, 4), kit.mat('#ffffff', { roughness: 1 }));
    roofSnow.rotation.y = Math.PI / 4;
    roofSnow.scale.set(1, 1, 0.6);
    roofSnow.position.set(-1.7, 4.88, -0.95);
    const wheel = new Mesh(new TorusGeometry(0.6, 0.07, 8, 28), kit.mat('#d94a3a', { metalness: 0.3, roughness: 0.5 }));
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(-1.7, 3.3, -0.65);
    this.scene.add(roof, roofSnow, wheel);
    // The cable: up to the summit, and down to the valley.
    const steel = kit.mat('#4a5260', { metalness: 0.5, roughness: 0.45 });
    const upPoints = [STATION, CABLE_BEND, SUMMIT];
    for (let index = 1; index < upPoints.length; index++)
      this.scene.add(kit.rod(steel, upPoints[index - 1], upPoints[index], 0.025));
    const down = [STATION, ...DOWN_FROM_STATION];
    for (let index = 1; index < down.length; index++)
      this.scene.add(kit.rod(steel, down[index - 1], down[index], 0.025));
    // Pylons along the cable.
    for (const u of [0.32, 0.62]) {
      const top = new Vector3().lerpVectors(CABLE_BEND, SUMMIT, u);
      const ground = groundHeight(top.x, top.z);
      const pylon = kit.mat('#7c8796', { metalness: 0.4, roughness: 0.5 });
      this.scene.add(
        kit.rod(pylon, new Vector3(top.x, ground, top.z), new Vector3(top.x, top.y + 0.3, top.z), 0.16, 0.1),
        kit.rod(pylon, new Vector3(top.x - 0.8, top.y + 0.3, top.z), new Vector3(top.x + 0.8, top.y + 0.3, top.z), 0.07),
      );
    }
    // The rack behind the queue, where full cabins wait; it only shows when it holds some.
    this.scene.add(this.rackFrame);
    this.rackFrame.add(
      kit.rod(beam, new Vector3(2.6, 0, -2.1), new Vector3(2.6, 3.3, -2.1), 0.08),
      kit.rod(beam, new Vector3(7.2, 0, -2.1), new Vector3(7.2, 3.3, -2.1), 0.08),
      kit.rod(steel, new Vector3(2.5, 2.0, -1.95), new Vector3(7.3, 2.0, -1.95), 0.03),
      kit.rod(steel, new Vector3(2.5, 3.12, -2.15), new Vector3(7.3, 3.12, -2.15), 0.03),
    );
    // A railing along the back of the deck.
    for (let x = -4.5; x <= 6.5; x += 1.1)
      this.scene.add(kit.rod(beam, new Vector3(x, 0, -2.3), new Vector3(x, 0.6, -2.3), 0.04));
    this.scene.add(kit.rod(beam, new Vector3(-4.6, 0.6, -2.3), new Vector3(6.6, 0.6, -2.3), 0.04));
    // Snow banks at the deck's ends.
    const bank = kit.mat('#ffffff', { roughness: 1 });
    this.scene.add(kit.blob(bank, 1.4, 0.45, 1.0, -6.4, 0.0, 1.0), kit.blob(bank, 1.6, 0.5, 1.2, 7.8, 0, 1.2));
  }

  private buildLanterns() {
    for (let index = 0; index < 10; index++) {
      const u = 0.2 + index * 0.068;
      const along = new Vector3().lerpVectors(CABLE_BEND, SUMMIT, u);
      const x = along.x + 1.6 + Math.sin(index * 1.7) * 0.4;
      const z = along.z;
      const y = groundHeight(x, z);
      const post = this.kit.rod(this.kit.mat('#3b3030'), new Vector3(x, y, z), new Vector3(x, y + 1.1, z), 0.05);
      const light = new MeshStandardMaterial({ color: '#ffe9a8', emissive: '#ffb53d', emissiveIntensity: 0 });
      const lamp = new Mesh(this.kit.smallBall, light);
      lamp.scale.setScalar(0.17);
      lamp.position.set(x, y + 1.2, z);
      const glow = new Sprite(new SpriteMaterial({ map: this.glow, blending: AdditiveBlending, transparent: true, depthWrite: false }));
      glow.scale.setScalar(1.0);
      glow.position.copy(lamp.position);
      glow.visible = false;
      this.scene.add(post, lamp, glow);
      this.lanterns.push({ light, glow });
    }
  }

  /** Twelve summit buildings, one per finished level: they stay once earned. */
  private buildVillage() {
    const kit = this.kit;
    const at = (dx: number, dz: number) => {
      const x = SUMMIT.x + dx;
      const z = SUMMIT.z + dz;
      const group = new Group();
      group.position.set(x, groundHeight(x, z), z);
      group.scale.setScalar(1.25);
      this.scene.add(group);
      this.buildings.push(group);
      return group;
    };
    const house = (group: Group, wall: string, roof: string, w = 1.4, h = 1.0) => {
      const body = new Mesh(new CylinderGeometry(1, 1, 1, 4), kit.mat(wall));
      body.rotation.y = Math.PI / 4;
      body.scale.set(w * 0.72, h, w * 0.72);
      body.position.y = h / 2;
      const top = new Mesh(new ConeGeometry(w * 0.85, h * 0.8, 4), kit.mat(roof));
      top.rotation.y = Math.PI / 4;
      top.position.y = h + h * 0.4;
      const snowCap = new Mesh(new ConeGeometry(w * 0.7, h * 0.35, 4), kit.mat('#ffffff'));
      snowCap.rotation.y = Math.PI / 4;
      snowCap.position.y = h + h * 0.68;
      const window = kit.blob(kit.mat('#ffe9a8', { emissive: '#ffb53d', emissiveIntensity: 0.8 }), 0.16, 0.18, 0.02, 0, h * 0.55, w * 0.52);
      group.add(body, top, snowCap, window);
    };
    // 1 ski hut
    house(at(-3, 2), '#a8673c', '#b8423a');
    // 2 snow-bunny statue
    {
      const group = at(-0.5, 3);
      const statue = new Bunny(kit, { fur: '#ffffff', belly: '#ffffff', scarf: '#3d8fe0', hat: null });
      statue.root.scale.setScalar(2.2);
      group.add(new Mesh(new CylinderGeometry(0.5, 0.6, 0.4, 12), kit.mat('#b9c6d6')), statue.root);
      statue.root.position.y = 0.4;
    }
    // 3 ice rink
    {
      const group = at(2.5, 3);
      const rink = new Mesh(new CylinderGeometry(1.4, 1.4, 0.06, 28), kit.mat('#bfe6ff', { roughness: 0.1, metalness: 0.2 }));
      const rim = new Mesh(new TorusGeometry(1.4, 0.07, 6, 28), kit.mat('#e0457b'));
      rim.rotation.x = Math.PI / 2;
      group.add(rink, rim);
    }
    // 4 ferris wheel
    {
      const group = at(4.5, -1.5);
      const wheel = new Mesh(new TorusGeometry(1.3, 0.06, 6, 28), kit.mat('#8a5cc7'));
      wheel.position.y = 1.8;
      group.add(
        wheel,
        kit.rod(kit.mat('#5d6675'), new Vector3(-0.6, 0, 0), new Vector3(0, 1.8, 0), 0.06),
        kit.rod(kit.mat('#5d6675'), new Vector3(0.6, 0, 0), new Vector3(0, 1.8, 0), 0.06),
      );
      for (let index = 0; index < 8; index++) {
        const angle = (index / 8) * Math.PI * 2;
        const seat = kit.blob(kit.mat(CABIN_COLORS[index % CABIN_COLORS.length]), 0.16, 0.16, 0.16, Math.cos(angle) * 1.3, 1.8 + Math.sin(angle) * 1.3, 0);
        group.add(seat);
      }
    }
    // 5 bell tower
    {
      const group = at(-4.5, -1);
      house(group, '#f2e3c6', '#3d6fb0', 0.9, 2.4);
      group.add(kit.blob(kit.mat(GOLD), 0.18, 0.2, 0.18, 0, 2.1, 0.5));
    }
    // 6 cocoa stand
    {
      const group = at(0.8, 0.5);
      house(group, '#e89a1c', '#e0457b', 1.1, 0.8);
    }
    // 7 sled hill flags
    {
      const group = at(-2, -3);
      for (let index = 0; index < 4; index++)
        group.add(
          kit.rod(kit.mat('#3b3030'), new Vector3(index * 0.6, 0, 0), new Vector3(index * 0.6, 1.2, 0), 0.03),
          kit.blob(kit.mat(CABIN_COLORS[index]), 0.2, 0.13, 0.02, index * 0.6 + 0.2, 1.08, 0),
        );
    }
    // 8 snowman
    {
      const group = at(2, -3);
      const white = kit.mat('#ffffff');
      group.add(
        kit.blob(white, 0.5, 0.45, 0.5, 0, 0.45, 0),
        kit.blob(white, 0.36, 0.34, 0.36, 0, 1.12, 0),
        kit.blob(white, 0.26, 0.25, 0.26, 0, 1.62, 0),
        kit.blob(kit.mat('#ff8a3d'), 0.05, 0.05, 0.18, 0, 1.6, 0.3),
      );
    }
    // 9 big chalet
    house(at(-6, 2.5), '#c98b52', '#2f6b45', 1.8, 1.3);
    // 10 lit pine
    {
      const group = at(5.8, 2);
      for (let tier = 0; tier < 3; tier++) {
        const cone = new Mesh(new ConeGeometry(0.9 - tier * 0.25, 1.0, 9), kit.mat('#2f6b45'));
        cone.position.y = 0.7 + tier * 0.6;
        group.add(cone);
      }
      group.add(kit.blob(kit.mat(GOLD, { emissive: '#ffb800', emissiveIntensity: 0.8 }), 0.16, 0.16, 0.16, 0, 2.3, 0));
    }
    // 11 observatory
    {
      const group = at(7, -2.5);
      const tower = new Mesh(new CylinderGeometry(0.7, 0.75, 1.1, 16), kit.mat('#e8eef5'));
      tower.position.y = 0.55;
      const dome = new Mesh(new SphereGeometry(0.72, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), kit.mat('#9aa7b8', { metalness: 0.4 }));
      dome.position.y = 1.1;
      group.add(tower, dome);
    }
    // 12 summit flag
    {
      const group = at(0, -5);
      group.add(
        kit.rod(kit.mat('#5d6675'), new Vector3(0, 0, 0), new Vector3(0, 2.8, 0), 0.05),
        kit.blob(kit.mat('#e0457b'), 0.5, 0.3, 0.02, 0.5, 2.5, 0),
      );
    }
    for (const building of this.buildings) building.visible = false;
  }

  private buildCocoa(): MeshStandardMaterial {
    const kit = this.kit;
    const barrel = new Mesh(new CylinderGeometry(0.32, 0.32, 0.6, 16), kit.mat('#8b5a2b'));
    barrel.position.y = 0.3;
    const mug = new MeshStandardMaterial({ color: '#e0457b', roughness: 0.4 });
    const cup = new Mesh(new CylinderGeometry(0.13, 0.11, 0.22, 16), mug);
    cup.position.y = 0.72;
    const handle = new Mesh(new TorusGeometry(0.07, 0.02, 6, 12), mug);
    handle.position.set(0.15, 0.72, 0);
    const drink = new Mesh(new CylinderGeometry(0.115, 0.115, 0.01, 16), kit.mat('#6b3d1f'));
    drink.position.y = 0.82;
    this.cocoa.add(barrel, cup, handle, drink);
    for (let index = 0; index < 4; index++) {
      const puff = new Mesh(this.kit.smallBall, this.steamMaterial.clone());
      this.cocoa.add(puff);
      this.steam.push(puff);
    }
    this.cocoa.position.copy(COCOA_AT);
    this.scene.add(this.cocoa);
    return mug;
  }

  private buildCloud() {
    for (const [x, y, z, s] of [
      [0, 0, 0, 1.0],
      [0.9, 0.2, 0.1, 0.85],
      [-0.9, 0.1, -0.1, 0.8],
      [0.4, 0.6, 0, 0.75],
      [-0.4, 0.55, 0.15, 0.7],
      [1.6, -0.1, 0, 0.6],
      [-1.6, -0.1, 0.05, 0.6],
    ]) {
      const puff = new Mesh(this.kit.ball, this.cloudMaterial);
      puff.scale.set(s, s * 0.8, s * 0.85);
      puff.position.set(x, y, z);
      puff.userData['y'] = y;
      this.cloud.add(puff);
      this.cloudPuffs.push(puff);
    }
    this.cloud.visible = false;
    this.scene.add(this.cloud);
  }

  private buildSnow() {
    const count = 420;
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    let seed = 11;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let index = 0; index < count; index++) {
      positions[index * 3] = -12 + random() * 26;
      positions[index * 3 + 1] = random() * 12;
      positions[index * 3 + 2] = -10 + random() * 16;
      speeds[index] = 0.5 + random() * 0.8;
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    const points = new Points(
      geometry,
      new PointsMaterial({ size: 0.11, map: this.flake, transparent: true, depthWrite: false, opacity: 0.9 }),
    );
    this.scene.add(points);
    return { points, speeds };
  }

  override dispose() {
    this.timers.length = 0;
    for (const rider of [...this.riders]) this.dropRider(rider);
    for (const entity of [...this.cabins]) this.dropCabin(entity);
    for (const sign of this.signs) this.dropSign(sign);
    for (const particle of this.particles) particle.mesh.removeFromParent();
    this.puffGeometry.dispose();
    this.confettiGeometry.dispose();
    this.cloudMaterial.dispose();
    this.steamMaterial.dispose();
    for (const texture of [this.glow, this.flake] as Texture[]) texture.dispose();
    super.dispose();
    this.kit.dispose();
  }
}

const GOLD = '#ffd23f';

/** What must stay in view: the deck's front corners, Gusti, the cabin, the rack and the summit. */
const FRAME_WIDE: readonly Vector3[] = [
  new Vector3(-4.7, 0, 2.0),
  new Vector3(6.3, 0, 2.0),
  new Vector3(-4.6, 1.8, 0.9),
  new Vector3(-1.7, 4.6, -0.1),
  new Vector3(SUMMIT.x, SUMMIT.y + 4.5, SUMMIT.z),
];
/** A sideways phone: the platform fills the frame and the cable runs up out of it. */
const FRAME_SIDEWAYS: readonly Vector3[] = [
  new Vector3(-4.6, 0, 1.7),
  new Vector3(6.1, 0, 1.7),
  new Vector3(-4.6, 1.8, 0.9),
  new Vector3(-1.7, 4.9, -0.1),
  new Vector3().lerpVectors(CABLE_BEND, SUMMIT, 0.3),
];
const FRAME_TALL: readonly Vector3[] = [
  new Vector3(-4.6, 0, 2.0),
  new Vector3(5.6, 0, 2.0),
  new Vector3(-4.6, 1.8, 0.9),
  new Vector3(-1.7, 4.6, -0.1),
  new Vector3(SUMMIT.x, SUMMIT.y + 5.5, SUMMIT.z),
];

