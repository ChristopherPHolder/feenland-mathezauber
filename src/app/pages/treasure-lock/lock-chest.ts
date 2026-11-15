import {
  BoxGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  PlaneGeometry,
  Texture,
} from 'three';

/** The parts of the treasure chest a world animates or recolours. */
export interface ChestModel {
  readonly chest: Group;
  /** Hinged at the back edge: rotate `x` negative to open. */
  readonly lid: Group;
  readonly lidMesh: Mesh;
  readonly crystal: Mesh;
  readonly bodyMaterial: MeshStandardMaterial;
  readonly lidMaterial: MeshStandardMaterial;
}

/**
 * Builds the wooden treasure chest from the treasure lock: a box body with a gold band, a
 * rounded lid that hinges open with a crystal on top, and a keyhole plate showing `plate`.
 * It depends on Three.js alone, so the loading scene can share it with the game's world.
 */
export function buildChest(plate: Texture, segments = 24): ChestModel {
  const bodyMaterial = new MeshStandardMaterial({ color: '#a8623a', roughness: 0.7 });
  const lidMaterial = new MeshStandardMaterial({
    color: '#a8623a',
    roughness: 0.7,
    side: DoubleSide,
  });
  const body = new Mesh(new BoxGeometry(1.5, 0.8, 1), bodyMaterial);
  body.position.y = 0.4;
  body.castShadow = true;
  const band = new Mesh(
    new BoxGeometry(1.54, 0.12, 1.04),
    new MeshStandardMaterial({ color: '#e8b44c', metalness: 0.6, roughness: 0.4 }),
  );
  band.position.y = 0.62;
  const lidMesh = new Mesh(
    new CylinderGeometry(0.5, 0.5, 1.5, segments, 1, false, 0, Math.PI),
    lidMaterial,
  );
  lidMesh.rotation.z = Math.PI / 2;
  lidMesh.position.z = 0.5;
  lidMesh.castShadow = true;
  const crystal = new Mesh(
    new OctahedronGeometry(0.18),
    new MeshStandardMaterial({
      color: '#ff9ad5',
      emissive: '#c2187a',
      emissiveIntensity: 0.8,
      transparent: true,
    }),
  );
  crystal.position.set(0, 0.62, 0.5);
  const lid = new Group();
  lid.add(lidMesh, crystal);
  lid.position.set(0, 0.8, -0.5);
  const keyhole = new Mesh(
    new PlaneGeometry(0.66, 0.44),
    new MeshBasicMaterial({ map: plate, transparent: true }),
  );
  keyhole.position.set(0, 0.42, 0.51);
  const chest = new Group();
  chest.add(body, band, lid, keyhole);
  return { chest, lid, lidMesh, crystal, bodyMaterial, lidMaterial };
}
