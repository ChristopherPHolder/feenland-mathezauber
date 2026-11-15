import {
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector2,
} from 'three';

/** Height of the potion's surface inside the cauldron. */
export const SURFACE_Y = 1.55;
export const BREW_COLOR = '#8a5cc7';

export interface Cauldron {
  readonly group: Group;
  /** The potion surface; its colour and glow show what is brewing. */
  readonly brew: MeshStandardMaterial;
  readonly bubbles: readonly Mesh[];
  readonly flames: readonly Mesh[];
}

/** Olli's cauldron: a round iron pot on three legs over a fire, with a bubbling potion. */
export function buildCauldron(): Cauldron {
  const group = new Group();
  const profile = [
    [0, 0.25],
    [0.7, 0.3],
    [1.15, 0.6],
    [1.38, 1.0],
    [1.3, 1.45],
    [1.2, 1.62],
    [1.3, 1.7],
  ].map(([x, y]) => new Vector2(x, y));
  const iron = new MeshStandardMaterial({
    color: '#2d2a3e',
    metalness: 0.5,
    roughness: 0.55,
    side: DoubleSide,
  });
  const pot = new Mesh(new LatheGeometry(profile, 48), iron);
  pot.castShadow = true;
  const rim = new Mesh(
    new TorusGeometry(1.27, 0.09, 12, 48),
    new MeshStandardMaterial({ color: '#4a4560', metalness: 0.6, roughness: 0.4 }),
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 1.7;
  const brew = new MeshStandardMaterial({
    color: BREW_COLOR,
    emissive: BREW_COLOR,
    emissiveIntensity: 0.6,
    roughness: 0.3,
  });
  const surface = new Mesh(new CircleGeometry(1.2, 48), brew);
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = SURFACE_Y;
  group.add(pot, rim, surface);
  const leg = new CylinderGeometry(0.1, 0.07, 0.5);
  for (let index = 0; index < 3; index++) {
    const angle = (index / 3) * Math.PI * 2 + 0.5;
    const mesh = new Mesh(leg, iron);
    mesh.position.set(Math.cos(angle) * 0.75, 0.2, Math.sin(angle) * 0.75);
    group.add(mesh);
  }
  const flame = new MeshStandardMaterial({
    color: '#ff9a3d',
    emissive: '#ff5a00',
    emissiveIntensity: 1.2,
  });
  const flameShape = new ConeGeometry(0.16, 0.5, 10);
  const flames = Array.from({ length: 5 }, (_, index) => {
    const mesh = new Mesh(flameShape, flame);
    mesh.position.set((index - 2) * 0.22, 0.2, ((index % 2) - 0.5) * 0.2);
    return mesh;
  });
  const bubbleMaterial = new MeshStandardMaterial({
    color: '#d9c6ff',
    emissive: '#7a52c7',
    emissiveIntensity: 0.5,
    transparent: true,
    opacity: 0.9,
  });
  const bubbleShape = new SphereGeometry(0.1, 12, 8);
  const bubbles = Array.from({ length: 9 }, () => new Mesh(bubbleShape, bubbleMaterial));
  group.add(...flames, ...bubbles);
  return { group, brew, bubbles, flames };
}

/** Bubbles rise from the potion and pop; flames flicker. Under calm motion a few rest still. */
export function bubble(cauldron: Cauldron, t: number, speed: number, calm: boolean) {
  const count = cauldron.bubbles.length;
  cauldron.bubbles.forEach((mesh, index) => {
    const phase = calm ? 0.5 : (t * speed + index / count) % 1;
    const angle = index * 2.4;
    const radius = 0.25 + (index % 3) * 0.28;
    mesh.position.set(Math.cos(angle) * radius, SURFACE_Y + phase * 0.35, Math.sin(angle) * radius);
    mesh.scale.setScalar(calm ? 0.8 : 0.5 + phase * 0.9);
    mesh.visible = calm ? index % 3 === 0 : phase < 0.92;
  });
  cauldron.flames.forEach((mesh, index) => {
    mesh.scale.y = calm ? 1 : 0.8 + Math.sin(t * 11 + index * 1.7) * 0.25;
  });
}
