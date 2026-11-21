import { BufferGeometry, Material, Matrix4, Mesh, Object3D } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Bakes the meshes that hang directly off `root` (and meshes nested inside them) into one mesh
 * per material, so a character drawn from many little parts costs a few draw calls. Child
 * groups are left alone: they are the parts that move (a head, an arm, a tail) and get merged
 * on their own. Sprites and lights are kept as they are. Returns the parts' old geometries, for
 * the caller to free once every model is merged (several models may share one).
 */
export function mergeByMaterial(root: Object3D) {
  const byMaterial = new Map<Material, BufferGeometry[]>();
  const order: Material[] = [];
  const meshes: Mesh[] = [];
  const local = new Matrix4();

  const collect = (object: Object3D, parent: Matrix4) => {
    object.updateMatrix();
    const matrix = new Matrix4().multiplyMatrices(parent, object.matrix);
    if (object instanceof Mesh && !Array.isArray(object.material)) {
      const material = object.material as Material;
      const geometry = (object.geometry as BufferGeometry).clone().applyMatrix4(matrix);
      // Indexed and non-indexed parts cannot merge; make them all non-indexed.
      const flat = geometry.index ? geometry.toNonIndexed() : geometry;
      if (flat !== geometry) geometry.dispose();
      for (const name of Object.keys(flat.attributes))
        if (name !== 'position' && name !== 'normal' && name !== 'uv') flat.deleteAttribute(name);
      if (!byMaterial.has(material)) {
        byMaterial.set(material, []);
        order.push(material);
      }
      byMaterial.get(material)!.push(flat);
      meshes.push(object);
      for (const child of object.children) if (child instanceof Mesh) collect(child, matrix);
    }
  };
  for (const child of [...root.children])
    if (child instanceof Mesh) collect(child, local.identity());

  const used = new Set<BufferGeometry>();
  for (const mesh of meshes) {
    used.add(mesh.geometry as BufferGeometry);
    mesh.removeFromParent();
  }
  for (const material of order) {
    const parts = byMaterial.get(material)!;
    const merged = mergeGeometries(parts, false);
    for (const part of parts) part.dispose();
    if (merged) root.add(new Mesh(merged, material));
  }
  return used;
}
