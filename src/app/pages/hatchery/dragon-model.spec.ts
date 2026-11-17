import { describe, expect, it } from 'vite-plus/test';
import { Box3, Mesh, Vector3 } from 'three';
import { DragonModel } from './dragon-model';
import { DRAGONS, GRAND } from './dragons';

const meshes = (model: DragonModel) => {
  let count = 0;
  model.root.traverse((object) => {
    if (object instanceof Mesh) count++;
  });
  return count;
};

const size = (model: DragonModel) => new Box3().setFromObject(model.root).getSize(new Vector3());

describe('dragon forms', () => {
  it('builds and animates every form of every dragon', () => {
    for (const dragon of DRAGONS)
      for (let stage = 0; stage <= GRAND; stage++) {
        const model = new DragonModel(dragon, stage);
        model.cheer(0);
        model.update(0.3, true, false);
        model.update(2, true, true);
        expect(meshes(model)).toBeGreaterThan(20);
      }
  });

  it('gives each form its own body, not just a bigger one', () => {
    for (const dragon of DRAGONS) {
      const [baby, young, grand] = [0, 1, 2].map((stage) => new DragonModel(dragon, stage));
      expect(new Set([meshes(baby), meshes(young), meshes(grand)]).size).toBe(3);
      // The young form stands taller on its own legs; the final form stands taller still.
      expect(size(young).y).toBeGreaterThan(size(baby).y);
      expect(size(grand).y).toBeGreaterThan(size(young).y);
    }
  });
});
