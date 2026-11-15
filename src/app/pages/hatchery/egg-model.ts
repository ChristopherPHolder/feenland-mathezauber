import {
  CanvasTexture,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
} from 'three';
import { RAINBOW } from './dragon-model';
import type { Dragon } from './dragons';

// Three.js only: the hatchery world and the hatchery's loading scene both build from here.

export const EGG_HEIGHT = 1.15;
const EGG_WIDTH = 0.44;
export const SPLIT = 0.56;

/** The widest point sits below the middle, so the egg is round at the bottom and taller on top. */
const WIDEST = 0.42;
function eggRadius(s: number): number {
  const d = s < WIDEST ? (WIDEST - s) / WIDEST : (s - WIDEST) / (1 - WIDEST);
  return EGG_WIDTH * Math.sqrt(Math.max(0, 1 - d * d));
}

function eggProfile(from: number, to: number, rows: number): Vector2[] {
  const points: Vector2[] = [];
  for (let i = 0; i <= rows; i++) {
    const s = from + ((to - from) * i) / rows;
    points.push(new Vector2(Math.max(0.0001, eggRadius(s)), s * EGG_HEIGHT));
  }
  return points;
}

/** Paints the shell: soft spots, and zigzag cracks along the split once it is tapped. */
function paintShell(
  texture: CanvasTexture,
  egg: Dragon,
  cracks: number,
  half: 'top' | 'bottom',
): void {
  const canvas = texture.image as HTMLCanvasElement;
  const context = canvas.getContext('2d');
  if (!context) return;
  const { width, height } = canvas;
  context.fillStyle = egg.shell;
  context.fillRect(0, 0, width, height);
  // Spots seeded from the dragon id, so an egg always looks the same.
  let seed = [...egg.id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const random = () => ((seed = (seed * 16807) % 2147483647) % 1000) / 1000;
  context.fillStyle = egg.spots;
  for (let i = 0; i < 26; i++) {
    const x = random() * width;
    const y = random() * height;
    const r = 6 + random() * 16;
    context.globalAlpha = 0.55 + random() * 0.35;
    if (egg.starlight) {
      drawStar(context, x, y, r * 0.8);
    } else {
      context.beginPath();
      context.ellipse(x, y, r, r * 0.8, random() * 3, 0, Math.PI * 2);
      context.fill();
    }
  }
  if (egg.element === 'rainbow') {
    RAINBOW.forEach((color, index) => {
      context.fillStyle = color;
      context.globalAlpha = 0.5;
      context.fillRect(0, height * 0.42 + index * 9, width, 7);
    });
  }
  context.globalAlpha = 1;
  context.strokeStyle = '#4a3a2a';
  drawCrack(context, cracks, half);
  texture.needsUpdate = true;
}

/**
 * The crack runs round the egg at the split, with branches that grow on each tap. Lathe texture
 * rows run bottom to top and canvases top to bottom: the split is the canvas top on the lower
 * half and the canvas bottom on the upper half.
 */
function drawCrack(
  context: CanvasRenderingContext2D,
  cracks: number,
  half: 'top' | 'bottom',
  lineWidth = 7,
) {
  if (cracks <= 0) return;
  const { width, height } = context.canvas;
  context.lineWidth = lineWidth;
  context.lineJoin = 'round';
  const edge = half === 'bottom' ? 4 : height - 4;
  const inward = half === 'bottom' ? 1 : -1;
  const reach = Math.min(1, cracks / 3);
  context.beginPath();
  for (let x = 0; x <= width * reach; x += width / 24) {
    const y = edge + inward * ((x / (width / 24)) % 2 ? 26 : 4);
    if (x) context.lineTo(x, y);
    else context.moveTo(x, y);
  }
  context.stroke();
  for (let i = 0; i < cracks * 3; i++) {
    const x = ((i * 0.37) % 1) * width * reach;
    context.beginPath();
    context.moveTo(x, edge);
    context.lineTo(x + 14, edge + inward * (40 + (i % 3) * 22));
    context.stroke();
  }
}

function drawStar(context: CanvasRenderingContext2D, x: number, y: number, r: number) {
  context.beginPath();
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 ? r * 0.45 : r;
    const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
    context.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
  }
  context.closePath();
  context.fill();
}

function shellTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export interface EggOptions {
  /** Segments round the egg and rows up each half: fewer for small, quick scenes. */
  readonly segments?: number;
  readonly rows?: number;
  readonly shadows?: boolean;
}

/** An egg in two halves, so the top can pop off when it hatches. */
export class EggModel {
  readonly root = new Group();
  readonly top = new Group();
  readonly bottom = new Group();
  private readonly topTexture = shellTexture();
  private readonly bottomTexture = shellTexture();
  readonly shellMaterial: MeshStandardMaterial[];
  constructor(
    readonly dragon: Dragon,
    { segments = 48, rows = 24, shadows = true }: EggOptions = {},
  ) {
    const top = new MeshStandardMaterial({ map: this.topTexture, roughness: 0.45 });
    const bottom = new MeshStandardMaterial({ map: this.bottomTexture, roughness: 0.45 });
    this.shellMaterial = [top, bottom];
    const lower = new Mesh(new LatheGeometry(eggProfile(0, SPLIT, rows), segments), bottom);
    const upper = new Mesh(new LatheGeometry(eggProfile(SPLIT, 1, rows), segments), top);
    for (const mesh of [lower, upper]) {
      mesh.castShadow = shadows;
      mesh.receiveShadow = shadows;
    }
    // Pivot the top on the split so it can tip off like a lid.
    const splitY = SPLIT * EGG_HEIGHT;
    upper.position.y = -splitY;
    this.top.position.y = splitY;
    this.top.add(upper);
    this.bottom.add(lower);
    // Jagged teeth on the broken rim, only shown once the egg has opened.
    const rim = eggRadius(SPLIT);
    const teeth = new Group();
    teeth.name = 'teeth';
    teeth.visible = false;
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const tooth = new Mesh(new ConeGeometry(0.06, 0.12, 4), bottom);
      tooth.position.set(Math.cos(angle) * rim * 0.96, splitY + 0.05, Math.sin(angle) * rim * 0.96);
      teeth.add(tooth);
    }
    this.bottom.add(teeth);
    this.root.add(this.bottom, this.top);
    this.setCracks(0);
  }
  setCracks(cracks: number) {
    paintShell(this.topTexture, this.dragon, cracks, 'top');
    paintShell(this.bottomTexture, this.dragon, cracks, 'bottom');
  }
  /** Lets light shine out of the cracks: drive it with `emissiveIntensity` on `shellMaterial`. */
  glowCracks(cracks: number, color: string) {
    for (const [index, material] of this.shellMaterial.entries()) {
      const glow = shellTexture();
      const context = (glow.image as HTMLCanvasElement).getContext('2d');
      if (context) {
        context.fillStyle = '#000';
        context.fillRect(0, 0, context.canvas.width, context.canvas.height);
        context.strokeStyle = '#fff';
        context.shadowColor = '#fff';
        context.shadowBlur = 6;
        // Thinner than the painted crack, so the light shines from inside its dark edges.
        drawCrack(context, cracks, index ? 'bottom' : 'top', 3);
      }
      material.emissive.set(color);
      material.emissiveMap = glow;
      material.needsUpdate = true;
    }
  }
  open() {
    const teeth = this.bottom.getObjectByName('teeth');
    if (teeth) teeth.visible = true;
  }
}

export interface NestOptions {
  /** A lighter nest with fewer twigs, for small, quick scenes. */
  readonly lite?: boolean;
  readonly shadows?: boolean;
}

/** A straw nest: a squashed ring, a floor and twigs poking out of the rim. */
export function buildNest({ lite = false, shadows = true }: NestOptions = {}): Group {
  const nest = new Group();
  const straw = ['#c99a5b', '#b5844a', '#dcb377'].map(
    (color) => new MeshStandardMaterial({ color, roughness: 1 }),
  );
  const bowl = new Mesh(new TorusGeometry(0.5, 0.17, lite ? 10 : 14, lite ? 28 : 40), straw[0]);
  bowl.rotation.x = -Math.PI / 2;
  bowl.position.y = 0.12;
  bowl.scale.z = 0.8;
  bowl.castShadow = bowl.receiveShadow = shadows;
  nest.add(bowl);
  const floor = new Mesh(new CircleGeometry(0.52, lite ? 20 : 32), straw[1]);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.05;
  floor.receiveShadow = shadows;
  nest.add(floor);
  // Twigs sticking out of the rim.
  const twigs = lite ? 18 : 26;
  for (let i = 0; i < twigs; i++) {
    const angle = (i / twigs) * Math.PI * 2;
    const twig = new Mesh(
      new CylinderGeometry(0.014, 0.014, 0.42, lite ? 4 : 5, 1, lite),
      straw[i % 3],
    );
    twig.position.set(Math.cos(angle) * 0.52, 0.16 + (i % 2) * 0.05, Math.sin(angle) * 0.52);
    twig.rotation.set(Math.PI / 2 + (i % 3) * 0.15, 0, angle + 0.6);
    twig.castShadow = shadows;
    nest.add(twig);
  }
  return nest;
}
