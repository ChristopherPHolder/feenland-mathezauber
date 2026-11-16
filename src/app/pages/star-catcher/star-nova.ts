import {
  CanvasTexture,
  CapsuleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PointLight,
  SRGBColorSpace,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector2,
} from 'three';

/** Nova's height from her shoes to the top of her bun, before scaling. */
export const NOVA_HEIGHT = 1.45;
/** How high the hoop of her lantern net sits above her shoes, before scaling. */
export const HOOP_Y = 2.05;
/** The hoop's radius, before scaling. */
export const HOOP_RADIUS = 0.3;

export interface Nova {
  /** Stand this on the bridge: her shoes are at its origin, the hoop straight above it. */
  readonly group: Group;
  /** Everything but the shadow: spin it for a golden star, tip it for a shrug. */
  readonly body: Group;
  readonly head: Group;
  /** Upper and lower wing on each side; flutter them about their y axis. */
  readonly wings: readonly Mesh[];
  /** Shoulder pivots, left then right. The right arm holds the net's pole. */
  readonly arms: readonly Group[];
  /** The glowing lantern inside the net. */
  readonly lantern: MeshStandardMaterial;
  readonly hoopMaterial: MeshStandardMaterial;
  readonly light: PointLight;
  /** The centre of the net's hoop: where a caught star drops in. */
  readonly hoop: Object3D;
}

const SKIN = '#f6d2b8';
const HAIR = '#e0823f';
const DRESS = '#b48be8';
const TRIM = '#3fc1c9';
const GOLD = '#ffcf4a';

/** Shape of one wing, pointing out to the right from the shoulder blade. */
function wingShape(length: number, width: number, lift: number) {
  const shape = new Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(length * 0.3, width * 0.9 + lift, length * 0.95, width + lift, length, lift);
  shape.bezierCurveTo(length * 0.9, -width * 0.5 + lift, length * 0.35, -width * 0.45, 0, 0);
  return new ShapeGeometry(shape, 18);
}

/**
 * Nova, the star-keeper fairy: a small girl with copper hair in a bun, a lilac dress with a teal
 * bodice, gauzy wings, and a lantern net held up on a golden pole so a star can drop into it.
 * Used by the game's night sky and by its loading scene.
 */
export function buildNova(): Nova {
  const group = new Group();
  const body = new Group();
  group.add(body);

  const skin = new MeshStandardMaterial({ color: SKIN, roughness: 0.7 });
  const hair = new MeshStandardMaterial({ color: HAIR, roughness: 0.6 });
  const dress = new MeshStandardMaterial({
    color: DRESS,
    side: DoubleSide,
    roughness: 0.55,
    emissive: '#3b2470',
    emissiveIntensity: 0.35,
  });
  const trim = new MeshStandardMaterial({
    color: TRIM,
    roughness: 0.5,
    emissive: '#0d4f55',
    emissiveIntensity: 0.4,
  });
  const dark = new MeshStandardMaterial({ color: '#2a1a3a', roughness: 0.4 });
  const blush = new MeshBasicMaterial({ color: '#ff9fb2', transparent: true, opacity: 0.7 });

  // Legs and little shoes.
  for (const side of [-1, 1]) {
    const leg = new Mesh(new CylinderGeometry(0.032, 0.028, 0.42, 10), skin);
    leg.position.set(side * 0.065, 0.23, 0);
    const shoe = new Mesh(new SphereGeometry(0.055, 12, 8), trim);
    shoe.scale.set(0.9, 0.6, 1.4);
    shoe.position.set(side * 0.065, 0.03, 0.025);
    body.add(leg, shoe);
  }

  // A bell-shaped dress from the waist to just above the knees, with a teal hem.
  const profile = [
    new Vector2(0.001, 0.8),
    new Vector2(0.095, 0.8),
    new Vector2(0.12, 0.7),
    new Vector2(0.17, 0.58),
    new Vector2(0.25, 0.46),
    new Vector2(0.3, 0.39),
    new Vector2(0.29, 0.37),
  ];
  const skirt = new Mesh(new LatheGeometry(profile, 28), dress);
  skirt.castShadow = true;
  const hem = new Mesh(new TorusGeometry(0.296, 0.012, 6, 32), trim);
  hem.rotation.x = Math.PI / 2;
  hem.position.y = 0.385;
  // Bodice and a little collar.
  const bodice = new Mesh(new CylinderGeometry(0.085, 0.1, 0.22, 16), trim);
  bodice.position.y = 0.9;
  const neck = new Mesh(new CylinderGeometry(0.03, 0.035, 0.07, 10), skin);
  neck.position.y = 1.03;
  body.add(skirt, hem, bodice, neck);

  // Head: face, eyes, rosy cheeks, copper hair with a fringe and a bun.
  const head = new Group();
  head.position.y = 1.18;
  const face = new Mesh(new SphereGeometry(0.15, 24, 18), skin);
  face.scale.set(1, 1.05, 0.98);
  const back = new Mesh(new SphereGeometry(0.162, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.62), hair);
  back.rotation.x = -0.5;
  back.position.set(0, 0.012, -0.012);
  const fringe = new Mesh(
    new SphereGeometry(0.158, 20, 10, Math.PI * 0.15, Math.PI * 0.7, 0, Math.PI * 0.3),
    hair,
  );
  fringe.position.y = 0.02;
  const bun = new Mesh(new SphereGeometry(0.075, 16, 12), hair);
  bun.position.set(0, 0.16, -0.06);
  head.add(face, back, fringe, bun);
  for (const side of [-1, 1]) {
    const eye = new Mesh(new SphereGeometry(0.024, 10, 8), dark);
    eye.scale.set(0.85, 1.15, 0.6);
    eye.position.set(side * 0.055, -0.005, 0.138);
    const cheek = new Mesh(new SphereGeometry(0.026, 10, 8), blush);
    cheek.scale.set(1.2, 0.7, 0.4);
    cheek.position.set(side * 0.085, -0.05, 0.12);
    head.add(eye, cheek);
  }
  const smile = new Mesh(new TorusGeometry(0.03, 0.007, 6, 12, Math.PI), dark);
  smile.rotation.z = Math.PI;
  smile.position.set(0, -0.06, 0.142);
  head.add(smile);
  body.add(head);

  // Arms on shoulder pivots, hanging down by default.
  const arms: Group[] = [];
  for (const side of [-1, 1]) {
    const shoulder = new Group();
    shoulder.position.set(side * 0.11, 0.98, 0);
    const arm = new Mesh(new CapsuleGeometry(0.026, 0.26, 4, 10), skin);
    arm.position.y = -0.15;
    const hand = new Mesh(new SphereGeometry(0.035, 10, 8), skin);
    hand.position.y = -0.31;
    shoulder.add(arm, hand);
    shoulder.rotation.z = side * 0.25;
    arms.push(shoulder);
    body.add(shoulder);
  }
  // The right arm reaches up to hold the pole.
  arms[1].rotation.z = 2.55;
  arms[1].rotation.x = -0.15;

  // Wings: gauzy, two on each side, on the back.
  const wingMaterial = new MeshStandardMaterial({
    color: '#cdeeff',
    emissive: '#7fb8ff',
    emissiveIntensity: 0.6,
    transparent: true,
    opacity: 0.5,
    side: DoubleSide,
    depthWrite: false,
    roughness: 0.2,
  });
  const upper = wingShape(0.42, 0.26, 0.18);
  const lower = wingShape(0.3, 0.14, -0.12);
  const wings: Mesh[] = [];
  for (const side of [-1, 1]) {
    for (const geometry of [upper, lower]) {
      const wing = new Mesh(geometry, wingMaterial);
      wing.position.set(side * 0.03, 0.9, -0.09);
      wing.scale.x = side;
      wing.rotation.y = side * 0.5;
      wings.push(wing);
      body.add(wing);
    }
  }

  // The lantern net: a golden pole up to a hoop, a soft net, and a lantern glowing inside.
  const goldMaterial = new MeshStandardMaterial({
    color: GOLD,
    metalness: 0.5,
    roughness: 0.35,
    emissive: '#8a5a00',
    emissiveIntensity: 0.5,
  });
  const hoopMaterial = new MeshStandardMaterial({
    color: GOLD,
    metalness: 0.4,
    roughness: 0.3,
    emissive: '#ffb020',
    emissiveIntensity: 0.6,
  });
  const poleBottom = { x: 0.3, y: 1.18 };
  const poleTop = { x: HOOP_RADIUS, y: HOOP_Y };
  const pole = new Mesh(
    new CylinderGeometry(0.016, 0.02, poleTop.y - poleBottom.y + 0.1, 8),
    goldMaterial,
  );
  pole.position.set((poleBottom.x + poleTop.x) / 2, (poleBottom.y + poleTop.y) / 2 - 0.05, 0.04);
  const hoopRing = new Mesh(new TorusGeometry(HOOP_RADIUS, 0.024, 10, 36), hoopMaterial);
  hoopRing.rotation.x = Math.PI / 2;
  hoopRing.position.set(0, HOOP_Y, 0.04);
  const netMaterial = new MeshStandardMaterial({
    color: '#f2f6ff',
    transparent: true,
    opacity: 0.22,
    side: DoubleSide,
    depthWrite: false,
  });
  const netLines = new MeshBasicMaterial({
    color: '#ffffff',
    wireframe: true,
    transparent: true,
    opacity: 0.35,
  });
  const netGeometry = new ConeGeometry(HOOP_RADIUS * 0.96, 0.34, 14, 3, true);
  const net = new Mesh(netGeometry, netMaterial);
  net.rotation.x = Math.PI;
  net.position.set(0, HOOP_Y - 0.17, 0.04);
  const mesh = new Mesh(netGeometry, netLines);
  mesh.rotation.x = Math.PI;
  mesh.position.copy(net.position);
  const lantern = new MeshStandardMaterial({
    color: '#fff3c4',
    emissive: '#ffcc55',
    emissiveIntensity: 1.4,
  });
  const glow = new Mesh(new SphereGeometry(0.07, 16, 12), lantern);
  glow.position.set(0, HOOP_Y - 0.24, 0.04);
  const light = new PointLight('#ffd27a', 2.5, 5, 1.6);
  light.position.copy(glow.position);
  const hoop = new Object3D();
  hoop.position.set(0, HOOP_Y, 0.04);
  body.add(pole, hoopRing, net, mesh, glow, light, hoop);

  return { group, body, head, wings, arms, lantern, hoopMaterial, light, hoop };
}

export type GlowKind =
  | 'star'
  | 'gold'
  | 'pink'
  | 'spark'
  | 'puff'
  | 'rays'
  | 'moon'
  | 'trail'
  | 'rainbow';

const STAR_COLORS: Record<'star' | 'gold' | 'pink', readonly [string, string, string]> = {
  star: ['#ffffff', '#fff2a8', '#ffe066'],
  gold: ['#fff8d0', '#ffd23f', '#ff9d00'],
  pink: ['#ffffff', '#ffb3ec', '#ff5fc8'],
};

/**
 * Canvas textures for the night sky's sprites: a five-pointed glowing star in white, gold or
 * pink, a soft sparkle, a grey puff, gold rays, the moon, and the stardust trail (plain or
 * rainbow, bright at the bottom and fading up). Each call draws a new texture.
 */
export function glowTexture(kind: GlowKind): CanvasTexture {
  const canvas = document.createElement('canvas');
  const tall = kind === 'trail' || kind === 'rainbow';
  canvas.width = tall ? 64 : 128;
  canvas.height = tall ? 256 : 128;
  const c = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;
  const mid = w / 2;
  if (kind === 'star' || kind === 'gold' || kind === 'pink') {
    const [core, body, edge] = STAR_COLORS[kind];
    const halo = c.createRadialGradient(mid, mid, 4, mid, mid, mid);
    halo.addColorStop(0, `${body}cc`);
    halo.addColorStop(0.45, `${edge}44`);
    halo.addColorStop(1, `${edge}00`);
    c.fillStyle = halo;
    c.fillRect(0, 0, w, h);
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 15 : 38;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      c.lineTo(mid + Math.cos(a) * r, mid + Math.sin(a) * r);
    }
    c.closePath();
    const fill = c.createRadialGradient(mid, mid - 4, 2, mid, mid, 40);
    fill.addColorStop(0, core);
    fill.addColorStop(0.5, body);
    fill.addColorStop(1, edge);
    c.fillStyle = fill;
    c.fill();
    c.lineJoin = 'round';
    c.lineWidth = 3;
    c.strokeStyle = '#ffffffaa';
    c.stroke();
  } else if (kind === 'spark') {
    const g = c.createRadialGradient(mid, mid, 0, mid, mid, mid);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.25, '#ffffffaa');
    g.addColorStop(1, '#ffffff00');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffffff';
    c.fillRect(mid - 2, 8, 4, h - 16);
    c.fillRect(8, mid - 2, w - 16, 4);
  } else if (kind === 'puff') {
    const g = c.createRadialGradient(mid, mid, 0, mid, mid, mid);
    g.addColorStop(0, '#d8d6e6ee');
    g.addColorStop(0.6, '#b8b6c888');
    g.addColorStop(1, '#b8b6c800');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  } else if (kind === 'rays') {
    c.translate(mid, mid);
    for (let i = 0; i < 12; i++) {
      c.rotate(Math.PI / 6);
      const g = c.createLinearGradient(0, 0, 0, -mid);
      g.addColorStop(0, '#fff3a0ff');
      g.addColorStop(1, '#ffb30000');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(-5, 0);
      c.lineTo(0, -mid);
      c.lineTo(5, 0);
      c.fill();
    }
  } else if (kind === 'moon') {
    const halo = c.createRadialGradient(mid, mid, 20, mid, mid, mid);
    halo.addColorStop(0, '#fff7d640');
    halo.addColorStop(1, '#fff7d600');
    c.fillStyle = halo;
    c.fillRect(0, 0, w, h);
    const disc = c.createRadialGradient(mid - 8, mid - 8, 4, mid, mid, 30);
    disc.addColorStop(0, '#fffdf0');
    disc.addColorStop(1, '#f1e4b0');
    c.fillStyle = disc;
    c.beginPath();
    c.arc(mid, mid, 28, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#e2d39b88';
    for (const [x, y, r] of [
      [-8, -6, 6],
      [9, 4, 4],
      [-2, 12, 3],
    ]) {
      c.beginPath();
      c.arc(mid + x, mid + y, r, 0, Math.PI * 2);
      c.fill();
    }
  } else {
    // A trail: bright at the bottom, where the star is, fading to nothing at the top.
    const g = c.createLinearGradient(0, h, 0, 0);
    if (kind === 'rainbow') {
      g.addColorStop(0, '#ffffffff');
      g.addColorStop(0.15, '#ff7ad9ee');
      g.addColorStop(0.4, '#ffd166aa');
      g.addColorStop(0.65, '#5fe0ff66');
      g.addColorStop(1, '#a37bff00');
    } else {
      g.addColorStop(0, '#ffffffff');
      g.addColorStop(0.2, '#fff2a8cc');
      g.addColorStop(1, '#ffe06600');
    }
    c.fillStyle = g;
    // Taper toward the top.
    c.beginPath();
    c.moveTo(w * 0.2, h);
    c.lineTo(w * 0.8, h);
    c.lineTo(w * 0.56, 0);
    c.lineTo(w * 0.44, 0);
    c.closePath();
    c.fill();
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
