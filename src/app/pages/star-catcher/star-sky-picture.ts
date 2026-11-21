import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  Shape,
  ShapeGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Texture,
  Vector3,
} from 'three';
import { constellation, Constellation, ConstellationId } from './star-constellations';

/** A line takes this long to draw from one star to the next. */
const EDGE = 0.35;
/** Finishing the picture lights the stars still dark one after another, this far apart. */
const STEP = 0.1;
/** Then a glint runs round the whole outline, one line after another. */
const TRACE = 0.07;
/** How long a glint or a pop lasts. */
const GLINT = 0.5;

const NEVER = Number.POSITIVE_INFINITY;
const LONG_AGO = -100;

const easeOut = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;
/** 0, up to 1 and back to 0 over GLINT seconds after 0. */
const glint = (age: number) => (age > 0 && age < GLINT ? Math.sin((age / GLINT) * Math.PI) : 0);
/** A star clicking into place: swells, then settles with a little springy wobble. */
const pop = (age: number) => {
  if (age < 0 || age > 1.2) return 0;
  if (age < 0.1) return (age / 0.1) * 0.9;
  const settle = age - 0.1;
  return 0.9 * Math.exp(-settle * 6) * Math.cos(settle * 13);
};

export interface PictureTextures {
  readonly star: Texture;
  /** Soft across its height: the glow of a line. */
  readonly beam: Texture;
  /** A soft round glow. */
  readonly soft: Texture;
}

/**
 * One constellation in the sky: its stars, glowing lines between them and, once finished, the
 * picture they make lit softly from within. Lines draw in from the last star to the new one;
 * finishing the picture lights any dark stars in turn, closes the outline, runs a glint round
 * it and lights the picture. Faint ones (the collection) are drawn whole and quiet.
 */
export class SkyPicture {
  readonly group = new Group();
  /** How many stars the picture has. */
  readonly count: number;
  private readonly shape: Constellation;
  private readonly dots: Sprite[];
  private readonly lines: Mesh;
  private readonly position: Float32Array;
  private readonly tint: Float32Array;
  private readonly base = new Color();
  private readonly fill?: Mesh;
  private readonly halo?: Sprite;
  private readonly litAt: Float64Array;
  private readonly edgeAt: Float64Array;
  private lit = 0;
  private complete = false;
  private traceAt = LONG_AGO;
  private revealAt = NEVER;
  /** Lines only need rewriting while something moves, or after a resize. */
  private busyUntil = LONG_AGO;
  private dirty = true;
  private dot = 0.5;

  constructor(
    readonly id: ConstellationId,
    readonly faint: boolean,
    textures: PictureTextures,
  ) {
    this.shape = constellation(id);
    const count = (this.count = this.shape.points.length);
    this.litAt = new Float64Array(count).fill(faint ? LONG_AGO : NEVER);
    this.edgeAt = new Float64Array(count).fill(faint ? LONG_AGO : NEVER);
    if (faint) {
      this.lit = count;
      this.complete = true;
      if (!this.shape.closed) this.edgeAt[count - 1] = NEVER;
    }
    this.dots = this.shape.points.map(() => {
      const sprite = new Sprite(
        new SpriteMaterial({
          map: textures.star,
          transparent: true,
          depthWrite: false,
          opacity: faint ? 0.5 : 0.45,
        }),
      );
      sprite.renderOrder = 4;
      this.group.add(sprite);
      return sprite;
    });

    // One quad per line, joined by the closing line; collapsed quads draw nothing.
    this.position = new Float32Array(count * 4 * 3);
    this.tint = new Float32Array(count * 4 * 3);
    const uv = new Float32Array(count * 4 * 2);
    const index: number[] = [];
    for (let edge = 0; edge < count; edge++) {
      uv.set([0, 0, 0, 1, 1, 1, 1, 0], edge * 8);
      const v = edge * 4;
      // Counter-clockwise, so the quads face the camera.
      index.push(v, v + 2, v + 1, v, v + 3, v + 2);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(this.position, 3));
    geometry.setAttribute('color', new BufferAttribute(this.tint, 3));
    geometry.setAttribute('uv', new BufferAttribute(uv, 2));
    geometry.setIndex(index);
    this.base.set(faint ? '#7f93d8' : '#bfe0ff');
    this.lines = new Mesh(
      geometry,
      new MeshBasicMaterial({
        map: textures.beam,
        vertexColors: true,
        transparent: true,
        opacity: faint ? 0.55 : 1,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 3;
    this.group.add(this.lines);

    if (!faint) {
      const outline = new Shape();
      this.shape.points.forEach(([x, y], at) =>
        at ? outline.lineTo(x - 0.5, 0.5 - y) : outline.moveTo(x - 0.5, 0.5 - y),
      );
      outline.closePath();
      const filled = new ShapeGeometry(outline);
      const uvs = filled.getAttribute('uv') as BufferAttribute;
      for (let at = 0; at < uvs.count; at++) uvs.setXY(at, uvs.getX(at) + 0.5, uvs.getY(at) + 0.5);
      this.fill = new Mesh(
        filled,
        new MeshBasicMaterial({
          map: textures.soft,
          color: '#d4c2ff',
          transparent: true,
          opacity: 0,
          blending: AdditiveBlending,
          depthWrite: false,
        }),
      );
      this.fill.renderOrder = 2;
      this.halo = new Sprite(
        new SpriteMaterial({
          map: textures.soft,
          color: '#8b7dff',
          transparent: true,
          opacity: 0,
          blending: AdditiveBlending,
          depthWrite: false,
        }),
      );
      this.halo.renderOrder = 1;
      this.group.add(this.halo, this.fill);
    }
  }

  /** `unit` is the picture's size and `dot` a lit star's, both in the group's units. */
  layout(unit: number, dot: number) {
    this.dot = dot;
    this.shape.points.forEach(([x, y], index) =>
      this.dots[index].position.set((x - 0.5) * unit, (0.5 - y) * unit, 0),
    );
    this.fill?.scale.set(unit, unit, 1);
    this.halo?.scale.setScalar(unit * 1.7);
    this.dirty = true;
  }

  /** Where star `index` sits, in world space. */
  pointWorld(index: number, target: Vector3) {
    return this.dots[Math.min(index, this.dots.length - 1)].getWorldPosition(target);
  }

  /**
   * Shows `lit` stars, and the whole picture once `complete`. With `animate` new stars pop and
   * their lines draw in from `t`; without it (a rebuilt world) they are simply there.
   */
  sync(lit: number, complete: boolean, t: number, animate: boolean) {
    if (this.faint) return;
    const count = this.dots.length;
    lit = Math.min(lit, count);
    if (lit < this.lit || (this.complete && !complete)) {
      // A new round: start dark.
      this.litAt.fill(NEVER);
      this.edgeAt.fill(NEVER);
      this.lit = 0;
      this.complete = false;
      this.traceAt = LONG_AGO;
      this.revealAt = NEVER;
      animate = false;
    }
    const at = animate ? t : LONG_AGO;
    for (let index = this.lit; index < lit; index++) {
      this.litAt[index] = at;
      if (index > 0) this.edgeAt[index - 1] = at;
    }
    this.lit = lit;
    if (complete && !this.complete) {
      let step = 0;
      for (let index = lit; index < count; index++, step++) {
        this.litAt[index] = animate ? t + step * STEP : LONG_AGO;
        if (index > 0) this.edgeAt[index - 1] = animate ? t + step * STEP : LONG_AGO;
      }
      const closing = animate ? t + step * STEP : LONG_AGO;
      if (this.shape.closed) this.edgeAt[count - 1] = closing;
      this.traceAt = animate ? closing + EDGE * 0.6 : LONG_AGO;
      this.revealAt = animate ? closing + EDGE : LONG_AGO;
      this.lit = count;
      this.complete = true;
    }
    if (animate) this.busyUntil = Math.max(this.busyUntil, this.traceAt + count * TRACE, t) + 1.2;
    this.dirty = true;
  }

  update(t: number, calm: boolean) {
    const count = this.dots.length;
    for (let index = 0; index < count; index++) {
      const sprite = this.dots[index];
      const age = t - this.litAt[index];
      const on = age >= 0;
      let scale = on ? this.dot : this.dot * 0.6;
      if (!this.faint) {
        scale *= 1 + pop(age) + 0.7 * glint(t - this.traceAt - index * TRACE);
        if (on && !calm) scale *= 1 + 0.08 * Math.sin(t * 3 + index);
      }
      sprite.scale.setScalar(scale);
      sprite.material.opacity = on ? 1 : 0.45;
    }

    if (this.fill && this.halo) {
      const shown = easeOut((t - this.revealAt) / 0.9);
      const breathe = calm ? 1 : 0.88 + 0.12 * Math.sin(t * 1.6);
      (this.fill.material as MeshBasicMaterial).opacity = 0.42 * shown * breathe;
      this.halo.material.opacity = 0.5 * shown * breathe + 0.6 * glint(t - this.revealAt);
      this.fill.visible = this.halo.visible = shown > 0;
    }

    if (!this.dirty && t > this.busyUntil) return;
    this.dirty = false;
    const width = this.dot * (this.faint ? 0.22 : 0.3);
    const position = this.position;
    const tint = this.tint;
    for (let edge = 0; edge < count; edge++) {
      const a = this.dots[edge].position;
      const b = this.dots[(edge + 1) % count].position;
      const progress = easeOut((t - this.edgeAt[edge]) / EDGE);
      const ex = a.x + (b.x - a.x) * progress;
      const ey = a.y + (b.y - a.y) * progress;
      const length = Math.hypot(ex - a.x, ey - a.y) || 1;
      const nx = (-(ey - a.y) / length) * width;
      const ny = ((ex - a.x) / length) * width;
      const p = edge * 12;
      position[p] = a.x - nx;
      position[p + 1] = a.y - ny;
      position[p + 3] = a.x + nx;
      position[p + 4] = a.y + ny;
      position[p + 6] = ex + nx;
      position[p + 7] = ey + ny;
      position[p + 9] = ex - nx;
      position[p + 10] = ey - ny;
      for (let corner = 0; corner < 4; corner++) position[p + corner * 3 + 2] = -0.01;
      // Bright while it draws, and as the glint passes.
      const boost = 1 + 0.8 * (1 - progress) + 1.4 * glint(t - this.traceAt - edge * TRACE);
      for (let corner = 0; corner < 4; corner++) {
        tint[p + corner * 3] = this.base.r * boost;
        tint[p + corner * 3 + 1] = this.base.g * boost;
        tint[p + corner * 3 + 2] = this.base.b * boost;
      }
    }
    const geometry = this.lines.geometry;
    geometry.getAttribute('position').needsUpdate = true;
    geometry.getAttribute('color').needsUpdate = true;
  }

  dispose() {
    this.group.removeFromParent();
    for (const dot of this.dots) dot.material.dispose();
    this.lines.geometry.dispose();
    (this.lines.material as MeshBasicMaterial).dispose();
    if (this.fill) {
      this.fill.geometry.dispose();
      (this.fill.material as MeshBasicMaterial).dispose();
    }
    this.halo?.material.dispose();
  }
}

/** A line's glow: clear at both long edges, bright along the middle. */
export function beamTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 32;
  const c = canvas.getContext('2d')!;
  const g = c.createLinearGradient(0, 0, 0, 32);
  g.addColorStop(0, '#ffffff00');
  g.addColorStop(0.32, '#ffffff55');
  g.addColorStop(0.5, '#ffffffff');
  g.addColorStop(0.68, '#ffffff55');
  g.addColorStop(1, '#ffffff00');
  c.fillStyle = g;
  c.fillRect(0, 0, 4, 32);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** A soft round glow, white in the middle. */
export function softTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const c = canvas.getContext('2d')!;
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, '#ffffffff');
  g.addColorStop(0.45, '#ffffff88');
  g.addColorStop(1, '#ffffff00');
  c.fillStyle = g;
  c.fillRect(0, 0, 64, 64);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
