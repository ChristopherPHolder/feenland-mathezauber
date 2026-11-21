import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  Color,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Points,
  PointsMaterial,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
} from 'three';
import { TextLabel } from '../../shared/three/labels';
import { approach, clamp01, easeOut, EventCounter, shake, smooth } from '../../shared/three/motion';
import { Stage } from '../../shared/three/stage';
import type { StateWorld } from '../../shared/three/three-stage';
import {
  BRONZE,
  ClockFrame,
  CRITTERS,
  DIAL,
  dialRadius,
  FACE,
  GOLD,
  INK,
  skyAt,
} from './clock-frame';
import type { EventId } from './clock-levels';
import { CritterModel, Kit, PipModel } from './clock-models';
import { handAngles } from './clock-time';

const FOV = 38;
const DEG = Math.PI / 180;
/** Where the balcony friends stand, left to right, two rows. */
const BALCONY_Y = -1.38;
const FRIEND_SCALE = 0.2;
/** Where a woken creature starts its flight up to the balcony. */
const FLIGHT_FROM = new Vector3(-3.8, -3.4, -2.5);
const FLIGHT_SECONDS = 1.5;
const DAY_FILL = new Color('#dfe9ff');
const NIGHT_FILL = new Color('#8a8fe0');

/** Friend `index` of `count` on the balcony floor. */
export function balconySpot(index: number, count: number) {
  const slots = Math.max(count, 7);
  const x = -1.5 + ((index + 0.5) / slots) * 3;
  return new Vector3(x, BALCONY_Y, 0.42 + (index % 2) * 0.24);
}

/**
 * Where a flight stands `t` seconds after the ring: an arc up from below the village to the
 * balcony spot, with a little loop of height in the middle. Returns the share done too.
 */
export function flightPoint(t: number, to: Vector3, out = new Vector3()) {
  const share = clamp01(t / FLIGHT_SECONDS);
  const ease = easeOut(share);
  out.lerpVectors(FLIGHT_FROM, to, ease);
  out.y += Math.sin(share * Math.PI) * 1.4;
  return { point: out, share };
}

interface Friend {
  readonly id: EventId;
  readonly model: CritterModel;
  /** Seconds since it set off, or -1 once it has landed. */
  flying: number;
  phase: number;
}

/**
 * The top of the Clock Tower in 3D: the big face with real hands that sweep to where the frame
 * says, gears turning behind a round glass window, a bronze bell that swings on every right time,
 * Pip on her perch, the balcony where woken creatures come to live, and the village below with
 * windows that light up as events happen. The sky follows the time on the clock: dawn, day,
 * sunset, stars. The camera puts the face exactly where `DIAL` says, so the DOM hand handles
 * sit on it. It only draws; the game decides.
 */
export class ClockWorld extends Stage implements StateWorld<ClockFrame> {
  private readonly kit = new Kit();
  private frame?: ClockFrame;
  private readonly face = new Group();
  private readonly hourHand = new Group();
  private readonly minuteHand = new Group();
  private readonly hourMaterial: MeshStandardMaterial;
  private readonly lights: Mesh[] = [];
  private readonly lightMaterials: MeshStandardMaterial[] = [];
  private readonly glow: Mesh;
  private readonly bell = new Group();
  private readonly gears: Mesh[] = [];
  private readonly pip: PipModel;
  private readonly friends = new Map<EventId, Friend>();
  private readonly windows: MeshStandardMaterial[] = [];
  private readonly skyCanvas = document.createElement('canvas');
  private readonly skyTexture: CanvasTexture;
  private readonly stars: Points;
  private readonly sunDisc: Mesh;
  private readonly moonDisc: Mesh;
  private readonly sparks: Points;
  private readonly sparkSeeds: Vector3[] = [];
  private skyKey = '';
  private hourAngle = 0;
  private minuteAngle = 0;
  private ringAt = -10;
  private wobbleAt = -10;
  private moveAt = -10;
  private lastDial = -1;
  private readonly rings = new EventCounter();
  private readonly wobbles = new EventCounter();
  private readonly probe = new Vector3();

  constructor(canvas: HTMLCanvasElement, host: HTMLElement) {
    super(canvas, host, { fov: FOV });
    const kit = this.kit;
    this.sun.position.set(-3, 6, 8);
    this.fill.intensity = 1.5;

    // Sky: a gradient plane far behind, with stars, a sun and a moon.
    this.skyCanvas.width = 4;
    this.skyCanvas.height = 256;
    this.skyTexture = new CanvasTexture(this.skyCanvas);
    this.skyTexture.colorSpace = SRGBColorSpace;
    const sky = new Mesh(
      new PlaneGeometry(120, 80),
      new MeshBasicMaterial({ map: this.skyTexture, depthWrite: false }),
    );
    sky.position.set(0, 4, -40);
    this.scene.add(sky);
    const starPositions: number[] = [];
    for (let index = 0; index < 160; index++)
      starPositions.push((Math.random() - 0.5) * 90, -2 + Math.random() * 40, -38);
    const starGeometry = new BufferGeometry();
    starGeometry.setAttribute('position', new Float32BufferAttribute(starPositions, 3));
    this.stars = new Points(
      starGeometry,
      new PointsMaterial({ color: '#fff6c4', size: 0.28, transparent: true, opacity: 0 }),
    );
    this.scene.add(this.stars);
    this.sunDisc = new Mesh(kit.disc, new MeshBasicMaterial({ color: '#ffe27a' }));
    this.sunDisc.scale.setScalar(2.2);
    this.moonDisc = new Mesh(kit.disc, new MeshBasicMaterial({ color: '#f4f0ff' }));
    this.moonDisc.scale.setScalar(1.8);
    this.scene.add(this.sunDisc, this.moonDisc);

    this.buildVillage();
    this.buildTower();
    this.hourMaterial = kit.mat(INK, { emissive: '#e2467c', emissiveIntensity: 0 });
    this.buildFace();
    this.glow = new Mesh(
      new TorusGeometry(1.06, 0.07, 12, 64),
      new MeshBasicMaterial({
        color: GOLD,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.glow.position.z = 0.02;
    this.face.add(this.glow);
    this.buildBell();
    this.pip = new PipModel(kit);
    this.pip.root.scale.setScalar(0.42);
    this.pip.root.position.set(1.42, -0.42, 0.25);
    this.pip.root.rotation.y = -0.35;
    this.scene.add(this.pip.root);
    const perch = new Mesh(kit.cylinder, kit.mat('#8a5a3c'));
    perch.scale.set(0.04, 0.7, 0.04);
    perch.rotation.z = Math.PI / 2;
    perch.position.set(1.3, -0.44, 0.25);
    this.scene.add(perch);

    // Sparkles for a right time: a little burst around the bell and the face.
    const sparkPositions = new Float32Array(60 * 3);
    for (let index = 0; index < 60; index++)
      this.sparkSeeds.push(
        new Vector3(
          Math.random() - 0.5,
          Math.random() * 0.8 + 0.2,
          Math.random() - 0.5,
        ).normalize(),
      );
    const sparkGeometry = new BufferGeometry();
    sparkGeometry.setAttribute('position', new Float32BufferAttribute(sparkPositions, 3));
    this.sparks = new Points(
      sparkGeometry,
      new PointsMaterial({
        color: GOLD,
        size: 0.09,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.scene.add(this.sparks);
  }

  setState(frame: ClockFrame) {
    const first = !this.frame;
    this.frame = frame;
    const rings = this.rings.take(frame.rings);
    const wobbles = this.wobbles.take(frame.wobbles);
    if (rings) this.ringAt = this.elapsed;
    if (wobbles) this.wobbleAt = this.elapsed;
    if (frame.dial !== this.lastDial) {
      if (this.lastDial >= 0) this.moveAt = this.elapsed;
      this.lastDial = frame.dial;
    }
    const angles = handAngles(frame.dial);
    if (first) {
      this.hourAngle = angles.hour;
      this.minuteAngle = angles.minute;
    }
    this.syncFriends(frame, first);
    this.paintSky(frame.sky);
    this.windows.forEach((material, index) => {
      const lit = index < frame.lights || frame.complete;
      material.emissiveIntensity = lit ? 1.2 : 0;
      material.color.set(lit ? '#ffd84a' : '#5a5560');
    });
  }

  protected override layout(aspect: number) {
    this.camera.clearViewOffset();
    super.layout(aspect);
    const { width, height } = this;
    // The face (radius 1) must come out exactly as big as `dialRadius` says.
    const radiusPx = dialRadius(width, height);
    const distance = 1 / (radiusPx / (height / 2)) / Math.tan((FOV / 2) * DEG);
    this.camera.position.set(0, 0, distance);
    this.camera.lookAt(0, 0, 0);
    this.camera.setViewOffset(
      width,
      height,
      width * (0.5 - DIAL.cx),
      height * (0.5 - DIAL.cy),
      width,
      height,
    );
    this.camera.updateProjectionMatrix();
  }

  protected update(dt: number, t: number) {
    const frame = this.frame;
    if (!frame) return;
    const calm = this.calm;
    // Hands: sweep the short way to the target.
    const target = handAngles(frame.dial);
    this.minuteAngle = sweep(this.minuteAngle, target.minute, calm ? 1e3 : 12, dt);
    this.hourAngle = sweep(this.hourAngle, target.hour, calm ? 1e3 : 12, dt);
    this.minuteHand.rotation.z = -this.minuteAngle * DEG;
    this.hourHand.rotation.z = -this.hourAngle * DEG;

    // Help: the short hand glows and pulses, or the five-minute lights chase round and round.
    const pulse = frame.help === 'hour' ? 0.6 + Math.sin(t * 7) * 0.5 : 0;
    this.hourMaterial.emissiveIntensity = Math.max(0, pulse);
    this.hourHand.scale.setScalar(
      frame.help === 'hour' && !calm ? 1 + Math.max(0, Math.sin(t * 7)) * 0.08 : 1,
    );
    const lit = frame.help === 'fives' ? Math.floor(t * 5) % 12 : -1;
    this.lightMaterials.forEach((material, index) => {
      const on = frame.help === 'fives' && (calm || index === lit);
      material.emissiveIntensity = approach(material.emissiveIntensity, on ? 1.6 : 0, 18, dt);
    });

    // Golden Hour: the face glows.
    const glow = this.glow.material as MeshBasicMaterial;
    glow.opacity = approach(
      glow.opacity,
      frame.golden ? 0.38 + (calm ? 0 : Math.sin(t * 3) * 0.12) : 0,
      6,
      dt,
    );

    // A wrong time: the face wobbles; a right one: the bell swings and sparkles fly.
    this.face.rotation.z = calm ? 0 : shake(t, this.wobbleAt, 0.5, 0.05);
    const ringAge = t - this.ringAt;
    this.bell.rotation.z =
      ringAge < 2.4 && !calm ? Math.sin(ringAge * 9) * 0.5 * Math.exp(-ringAge * 1.6) : 0;
    this.updateSparks(ringAge, calm);

    // Gears turn a little all the time and hurry while the hands move.
    const hurry = t - this.moveAt < 0.5 ? 6 : 1;
    if (!calm)
      this.gears.forEach((gear, index) => {
        gear.rotation.z += dt * (index % 2 ? -0.5 : 0.62) * hurry * (index === 1 ? 1.5 : 1);
      });

    // Pip blinks, hops on a ring and shakes her head on a wobble.
    const blink = calm ? 0 : t % 4.2 > 4.05 ? 1 : 0;
    for (const lid of this.pip.lids) lid.scale.y = blink ? 1 : 0.001;
    const hop = ringAge < 0.6 && !calm ? Math.sin((ringAge / 0.6) * Math.PI) * 0.18 : 0;
    this.pip.root.position.y = -0.42 + hop;
    this.pip.head.rotation.z = calm
      ? 0
      : shake(t, this.wobbleAt, 0.6, 0.25) + Math.sin(t * 0.8) * 0.06;
    for (const [index, wing] of this.pip.wings.entries())
      wing.rotation.z =
        (index ? -1 : 1) * (hop ? 0.8 : 0.05 + (calm ? 0 : Math.sin(t * 1.3) * 0.04));

    this.updateFriends(dt, t, calm);
  }

  // ---- Building ----------------------------------------------------------------------------

  private buildTower() {
    const kit = this.kit;
    const stone = kit.mat('#e8d3b4', { roughness: 0.95 });
    const trim = kit.mat('#b99a72', { roughness: 0.9 });
    const tower = new Mesh(kit.box, stone);
    tower.scale.set(2.7, 9, 1.4);
    tower.position.set(0, -3.4, -0.8);
    this.scene.add(tower);
    // A cornice above the face and stone bands.
    for (const [y, w] of [
      [1.22, 3.0],
      [1.38, 2.86],
      [-1.2, 2.9],
    ] as const) {
      const band = new Mesh(kit.box, trim);
      band.scale.set(w, 0.12, 1.6);
      band.position.set(0, y, -0.75);
      this.scene.add(band);
    }
    const roof = new Mesh(kit.cone, kit.mat('#7a5ac0', { roughness: 0.6 }));
    roof.scale.set(2.1, 2.2, 2.1);
    roof.rotation.y = Math.PI / 4;
    roof.position.set(0, 2.55, -0.8);
    this.scene.add(roof);
    // The round glass window with the gears behind it.
    const window = new Group();
    window.position.set(0, -2.1, 0.06);
    const frameRing = new Mesh(
      new TorusGeometry(0.46, 0.06, 10, 40),
      kit.mat(BRONZE, { metalness: 0.6, roughness: 0.35 }),
    );
    window.add(frameRing);
    const back = new Mesh(kit.disc, kit.mat('#3a2d4f'));
    back.scale.setScalar(0.46);
    back.position.z = -0.12;
    window.add(back);
    const brass = kit.mat('#d9a441', { metalness: 0.7, roughness: 0.3 });
    const copper = kit.mat('#b86d3a', { metalness: 0.6, roughness: 0.35 });
    for (const [x, y, r, teeth, material] of [
      [-0.14, 0.08, 0.24, 12, brass],
      [0.2, -0.06, 0.16, 9, copper],
      [0.06, -0.3, 0.12, 8, brass],
    ] as const) {
      const gear = new Mesh(kit.gear(teeth), material);
      gear.scale.set(r, r, 0.4);
      gear.position.set(x, y, -0.1);
      window.add(gear);
      this.gears.push(gear);
    }
    const glass = new Mesh(
      kit.disc,
      new MeshStandardMaterial({
        color: '#cfe8ff',
        transparent: true,
        opacity: 0.18,
        roughness: 0.05,
        metalness: 0.2,
      }),
    );
    glass.scale.setScalar(0.44);
    glass.position.z = 0.02;
    window.add(glass);
    this.scene.add(window);
    // The balcony: a floor, posts and a rail in front of the tower.
    const wood = kit.mat('#9c7a52', { roughness: 0.8 });
    const floor = new Mesh(kit.box, wood);
    floor.scale.set(3.5, 0.1, 0.8);
    floor.position.set(0, BALCONY_Y - 0.05, 0.45);
    this.scene.add(floor);
    const rail = new Mesh(kit.cylinder, wood);
    rail.scale.set(0.035, 3.5, 0.035);
    rail.rotation.z = Math.PI / 2;
    rail.position.set(0, BALCONY_Y + 0.3, 0.84);
    this.scene.add(rail);
    const posts = new InstancedMesh(kit.cylinder, wood, 11);
    const matrix = new Matrix4();
    for (let index = 0; index < 11; index++) {
      matrix.makeScale(0.025, 0.3, 0.025).setPosition(-1.7 + index * 0.34, BALCONY_Y + 0.15, 0.84);
      posts.setMatrixAt(index, matrix);
    }
    this.scene.add(posts);
  }

  private buildFace() {
    const kit = this.kit;
    this.scene.add(this.face);
    const rim = new Mesh(
      new TorusGeometry(0.97, 0.06, 12, 72),
      kit.mat(BRONZE, { metalness: 0.6, roughness: 0.35 }),
    );
    this.face.add(rim);
    const back = new Mesh(kit.disc, kit.mat('#a8763a', { metalness: 0.4 }));
    back.scale.setScalar(1.02);
    back.position.z = -0.02;
    this.face.add(back);
    const dial = new Mesh(kit.disc, kit.mat(FACE, { roughness: 0.9 }));
    dial.scale.setScalar(0.94);
    this.face.add(dial);
    // Minute ticks: long ones on every five.
    const ticks = new InstancedMesh(kit.box, kit.mat(INK), 60);
    const matrix = new Matrix4();
    const rotation = new Matrix4();
    for (let index = 0; index < 60; index++) {
      const five = index % 5 === 0;
      rotation.makeRotationZ(-index * 6 * DEG);
      matrix.makeScale(five ? 0.03 : 0.012, five ? 0.09 : 0.05, 0.01);
      matrix.setPosition(0, five ? 0.84 : 0.865, 0.01);
      ticks.setMatrixAt(index, rotation.clone().multiply(matrix));
    }
    this.face.add(ticks);
    // Numbers and the five-minute lights beside them.
    for (let n = 1; n <= 12; n++) {
      const angle = n * 30 * DEG;
      const label = new TextLabel(String(n), { ink: INK, width: 128, height: 128 });
      const plane = new Mesh(
        new PlaneGeometry(0.2, 0.2),
        new MeshBasicMaterial({ map: label.texture, transparent: true, depthWrite: false }),
      );
      plane.position.set(Math.sin(angle) * 0.68, Math.cos(angle) * 0.68, 0.015);
      this.face.add(plane);
      const material = new MeshStandardMaterial({
        color: '#fff3c4',
        emissive: GOLD,
        emissiveIntensity: 0,
      });
      const light = new Mesh(kit.small, material);
      light.scale.setScalar(0.045);
      light.position.set(Math.sin(angle) * 0.93, Math.cos(angle) * 0.93, 0.03);
      this.face.add(light);
      this.lights.push(light);
      this.lightMaterials.push(material);
    }
    // The hands: the short one wide, the long one thin, both tapered.
    const hour = new Mesh(handGeometry(0.52, 0.07), this.hourMaterial);
    hour.position.z = 0.04;
    this.hourHand.add(hour);
    const minute = new Mesh(handGeometry(0.8, 0.045), kit.mat('#3d3470'));
    minute.position.z = 0.06;
    this.minuteHand.add(minute);
    this.face.add(this.hourHand, this.minuteHand);
    const pin = new Mesh(kit.cylinder, kit.mat(GOLD, { metalness: 0.6, roughness: 0.3 }));
    pin.scale.set(0.06, 0.04, 0.06);
    pin.rotation.x = Math.PI / 2;
    pin.position.z = 0.09;
    this.face.add(pin);
  }

  private buildBell() {
    const kit = this.kit;
    const wood = kit.mat('#8a5a3c', { roughness: 0.8 });
    const beam = new Mesh(kit.box, wood);
    beam.scale.set(0.8, 0.08, 0.1);
    beam.position.set(-1.32, 0.86, 0.1);
    this.scene.add(beam);
    const post = new Mesh(kit.box, wood);
    post.scale.set(0.08, 0.5, 0.1);
    post.position.set(-1.0, 0.62, 0.1);
    this.scene.add(post);
    this.bell.position.set(-1.46, 0.82, 0.1);
    const body = new Mesh(kit.bell, kit.mat(BRONZE, { metalness: 0.75, roughness: 0.3 }));
    body.scale.setScalar(1.1);
    this.bell.add(body);
    const clapper = kit.blob(kit.mat('#5a3a26'), 0.06, 0.06, 0.06, 0, -0.5, 0);
    this.bell.add(clapper);
    this.scene.add(this.bell);
  }

  private buildVillage() {
    const kit = this.kit;
    const grass = kit.mat('#4f7d5a', { roughness: 1 });
    for (const [x, y, z, rx, ry] of [
      [-10, -7.4, -16, 12, 3],
      [10, -7.2, -16, 12, 3.2],
      [0, -8.4, -20, 20, 3],
    ] as const)
      this.scene.add(kit.blob(grass, rx, ry, 4, x, y, z));
    const roofs = ['#e2467c', '#3d8fe0', '#e89a1c', '#3fa65a', '#8a5cc7', '#1f9e95'];
    const walls = kit.mat('#f4e6cf', { roughness: 0.9 });
    const spots = [
      [-6.2, -4.7, -14],
      [-8.1, -4.95, -14.5],
      [-4.6, -5.2, -13],
      [6.3, -4.7, -14],
      [8.2, -4.9, -14.5],
      [4.7, -5.2, -13],
      [-10, -5.0, -15],
      [10, -5.0, -15],
      [-7.2, -5.6, -12.5],
    ];
    for (const [index, [x, y, z]] of spots.entries()) {
      const house = new Group();
      house.position.set(x, y, z);
      const wall = new Mesh(kit.box, walls);
      wall.scale.set(1.2, 0.9, 0.9);
      house.add(wall);
      const roof = new Mesh(kit.cone, kit.mat(roofs[index % roofs.length]));
      roof.scale.set(0.95, 0.7, 0.95);
      roof.rotation.y = Math.PI / 4;
      roof.position.y = 0.8;
      house.add(roof);
      const material = new MeshStandardMaterial({
        color: '#5a5560',
        emissive: '#ffcf33',
        emissiveIntensity: 0,
      });
      const pane = new Mesh(new PlaneGeometry(0.36, 0.3), material);
      pane.position.set(0, 0.02, 0.46);
      house.add(pane);
      this.windows.push(material);
      this.scene.add(house);
    }
  }

  // ---- Sky, friends, sparkles --------------------------------------------------------------

  private paintSky(time: number) {
    const sky = skyAt(time);
    const key = `${sky.top}${sky.horizon}${sky.stars.toFixed(2)}`;
    if (key === this.skyKey) return;
    this.skyKey = key;
    const context = this.skyCanvas.getContext('2d');
    if (context) {
      const gradient = context.createLinearGradient(0, 0, 0, 256);
      gradient.addColorStop(0, sky.top);
      gradient.addColorStop(0.75, sky.horizon);
      gradient.addColorStop(1, sky.horizon);
      context.fillStyle = gradient;
      context.fillRect(0, 0, 4, 256);
      this.skyTexture.needsUpdate = true;
    }
    (this.stars.material as PointsMaterial).opacity = sky.stars;
    // The sun climbs over the day; the moon shows at night.
    const hours = (((time % 1440) + 1440) % 1440) / 60;
    const day = clamp01((hours - 5.5) / 14);
    this.sunDisc.visible = hours > 5.5 && hours < 20;
    this.sunDisc.position.set(-14 + day * 28, 4 + Math.sin(day * Math.PI) * 9, -36);
    this.moonDisc.visible = sky.stars > 0.3;
    this.moonDisc.position.set(12, 12, -36);
    // Night turns the light blue and soft; the face stays easy to read.
    const night = sky.stars;
    this.fill.color.copy(DAY_FILL).lerp(NIGHT_FILL, night);
    this.fill.intensity = 1.6 - night * 0.4;
    this.sun.intensity = 2.4 - night * 1.2;
  }

  private syncFriends(frame: ClockFrame, first: boolean) {
    for (const id of frame.friends) {
      if (this.friends.has(id)) continue;
      const model = new CritterModel(this.kit, CRITTERS[id]);
      model.root.scale.setScalar(FRIEND_SCALE);
      const flying = !first && id === frame.arriving ? 0 : -1;
      this.friends.set(id, { id, model, flying, phase: Math.random() * 6 });
      this.scene.add(model.root);
    }
    const count = frame.friends.length;
    frame.friends.forEach((id, index) => {
      const friend = this.friends.get(id)!;
      if (friend.flying < 0) friend.model.root.position.copy(balconySpot(index, count));
    });
  }

  private updateFriends(dt: number, t: number, calm: boolean) {
    const frame = this.frame!;
    const count = frame.friends.length;
    frame.friends.forEach((id, index) => {
      const friend = this.friends.get(id);
      if (!friend) return;
      const spot = balconySpot(index, count);
      const root = friend.model.root;
      if (friend.flying >= 0) {
        friend.flying += dt;
        const { share } = flightPoint(calm ? FLIGHT_SECONDS : friend.flying, spot, root.position);
        for (const [side, wing] of friend.model.wings.entries())
          wing.rotation.y = (side ? -1 : 1) * Math.sin(t * 30) * 0.7;
        root.rotation.y = (1 - share) * 0.8;
        if (share >= 1) friend.flying = -1;
        return;
      }
      root.position.x = approach(root.position.x, spot.x, 6, dt);
      root.position.z = approach(root.position.z, spot.z, 6, dt);
      root.position.y = spot.y;
      root.rotation.y = 0;
      // A happy little bounce when the bell rings, a gentle sway otherwise.
      const ringAge = t - this.ringAt;
      const cheer = ringAge < 0.8 && !calm ? Math.abs(Math.sin(ringAge * 8 + index)) * 0.06 : 0;
      root.position.y = spot.y + cheer;
      friend.model.body.rotation.z = calm ? 0 : Math.sin(t * 1.6 + friend.phase) * 0.08;
      for (const [side, wing] of friend.model.wings.entries())
        wing.rotation.y =
          (side ? -1 : 1) * (calm ? 0.2 : 0.2 + Math.sin(t * 2 + friend.phase) * 0.1);
    });
  }

  private updateSparks(age: number, calm: boolean) {
    const material = this.sparks.material as PointsMaterial;
    if (age > 1.4 || calm) {
      material.opacity = 0;
      return;
    }
    const share = smooth(age / 1.4);
    material.opacity = 1 - share;
    const positions = this.sparks.geometry.getAttribute('position');
    for (const [index, seed] of this.sparkSeeds.entries()) {
      const origin = index % 2 ? this.probe.set(-1.46, 0.4, 0.3) : this.probe.set(0, 0.2, 0.3);
      const reach = 0.3 + share * (index % 2 ? 0.8 : 1.4);
      positions.setXYZ(
        index,
        origin.x + seed.x * reach,
        origin.y + seed.y * reach - share * 0.3,
        origin.z + seed.z * 0.4,
      );
    }
    positions.needsUpdate = true;
  }

  override dispose() {
    super.dispose();
    this.kit.dispose();
  }
}

/** Moves an angle toward a target the short way round, in degrees. */
function sweep(current: number, target: number, rate: number, dt: number) {
  let delta = (target - current) % 360;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return approach(current, current + delta, rate, dt);
}

/** A tapered hand pointing up from the centre, with a short tail. */
function handGeometry(length: number, width: number) {
  const geometry = new BufferGeometry();
  const tail = length * 0.18;
  const vertices = [
    -width,
    -tail,
    0,
    width,
    -tail,
    0,
    width * 0.35,
    length,
    0,
    -width,
    -tail,
    0,
    width * 0.35,
    length,
    0,
    -width * 0.35,
    length,
    0,
  ];
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
}
