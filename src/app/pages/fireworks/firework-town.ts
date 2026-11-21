import {
  BoxGeometry,
  Color,
  ConeGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three';

/** A small seeded random, so the town looks the same on every visit. */
export function seededRandom(seed: number) {
  let a = seed;
  return () => {
    a = (a * 16807) % 2147483647;
    return (a - 1) / 2147483646;
  };
}

interface Placement {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  turn: number;
}

/** One instanced mesh for every copy of a part, so the whole town costs a handful of draws. */
function instanced(
  geometry: BoxGeometry | ConeGeometry | PlaneGeometry | SphereGeometry,
  material: MeshStandardMaterial | MeshBasicMaterial,
  places: readonly Placement[],
  colors?: readonly string[],
) {
  const mesh = new InstancedMesh(geometry, material, places.length);
  const matrix = new Matrix4();
  const position = new Vector3();
  const turn = new Quaternion();
  const scale = new Vector3();
  const up = new Vector3(0, 1, 0);
  const color = new Color();
  places.forEach((place, index) => {
    position.set(place.x, place.y, place.z);
    turn.setFromAxisAngle(up, place.turn);
    scale.set(place.sx, place.sy, place.sz);
    mesh.setMatrixAt(index, matrix.compose(position, turn, scale));
    if (colors) mesh.setColorAt(index, color.set(colors[index % colors.length]));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.frustumCulled = false;
  return mesh;
}

const place = (x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, turn = 0): Placement => ({
  x,
  y,
  z,
  sx,
  sy,
  sz,
  turn,
});

/**
 * The far shore: low hills, a row of little houses with lit windows and a string of coloured
 * lanterns. Houses, roofs, windows and lanterns are each one instanced mesh.
 */
export function buildTown(): Group {
  const random = seededRandom(11);
  const town = new Group();
  const hills = new Mesh(
    new SphereGeometry(1, 24, 12),
    new MeshStandardMaterial({ color: '#2a2152', roughness: 1 }),
  );
  hills.scale.set(60, 0.75, 2);
  hills.position.set(0, -0.6, -4.5);
  town.add(hills);

  const houses: Placement[] = [];
  const roofs: Placement[] = [];
  const windows: Placement[] = [];
  for (let x = -26; x < 26;) {
    const w = 0.45 + random() * 0.5;
    const h = 0.3 + random() * 0.4;
    houses.push(place(x + w / 2, -0.45 + h / 2, -4, w, h, 0.6));
    const tall = 0.45 + random() * 0.3;
    roofs.push(place(x + w / 2, -0.45 + h + tall * 0.3, -4, w * 0.95, tall, 0.6, Math.PI / 4));
    const lights = 1 + Math.floor(random() * 2);
    for (let i = 0; i < lights; i++)
      windows.push(place(x + (w * (i + 1)) / (lights + 1), -0.45 + h * 0.55, -3.69));
    x += w + 0.15 + random() * (Math.abs(x) < 4 ? 0.3 : 1.4);
  }
  town.add(
    instanced(
      new BoxGeometry(1, 1, 1),
      new MeshStandardMaterial({ color: '#3a2d63', roughness: 0.9 }),
      houses,
    ),
    instanced(
      new ConeGeometry(0.75, 0.6, 4),
      new MeshStandardMaterial({ color: '#2b2050', roughness: 0.9 }),
      roofs,
    ),
    instanced(new PlaneGeometry(0.12, 0.16), new MeshBasicMaterial({ color: '#ffcf7a' }), windows),
  );

  // A string of lanterns over the far shore.
  const lamps: Placement[] = [];
  for (let x = -24; x <= 24; x += 0.55) {
    const sag = ((x % 3.3) + 3.3) % 3.3;
    lamps.push(place(x, 0.68 - Math.sin((sag / 3.3) * Math.PI) * 0.18, -3.3));
  }
  const lanternColors = ['#ffb347', '#ff9ccf', '#8fd3ff', '#ffe066', '#b7f0a0'];
  const start = Math.round(-24 / 0.55 + 100);
  town.add(
    instanced(
      new SphereGeometry(0.07, 10, 8),
      new MeshBasicMaterial({ color: '#ffffff' }),
      lamps,
      lamps.map((_, index) => lanternColors[(start + index) % 5]),
    ),
  );
  return town;
}
