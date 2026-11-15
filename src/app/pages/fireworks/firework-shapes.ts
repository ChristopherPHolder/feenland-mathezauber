/**
 * The shapes in the firework book: one per level. They are drawn as decorative bursts of sparks
 * along an outline (in the grand finale, the show and the book), never as something to count.
 */
export const BOOK_SHAPES = [
  'ring',
  'heart',
  'star',
  'flower',
  'moon',
  'clover',
  'butterfly',
  'diamond',
  'spiral',
  'crown',
  'snowflake',
  'sun',
] as const;

export type BookShape = (typeof BOOK_SHAPES)[number];

export interface ShapePoint {
  readonly x: number;
  readonly y: number;
  /** 0–1 along the outline, for rainbow colouring and staggered sparkle. */
  readonly t: number;
}

const TAU = Math.PI * 2;

/** A point on the shape's outline at `t` in [0, 1), inside roughly [-1, 1] on both axes. */
function at(shape: BookShape, t: number): [number, number] {
  const a = t * TAU;
  switch (shape) {
    case 'ring':
      return [Math.cos(a), Math.sin(a)];
    case 'heart': {
      const x = 16 * Math.sin(a) ** 3;
      const y = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a);
      return [x / 17, y / 17 + 0.1];
    }
    case 'star': {
      const r = 0.45 + 0.55 * Math.abs(Math.cos((5 * a) / 2)) ** 1.6;
      return [r * Math.sin(a), r * Math.cos(a)];
    }
    case 'flower': {
      const r = 0.55 + 0.45 * Math.abs(Math.cos(3 * a));
      return [r * Math.cos(a), r * Math.sin(a)];
    }
    case 'moon': {
      // The outer arc of a crescent, then the inner arc back.
      if (t < 0.6) {
        const b = -Math.PI * 0.75 + (t / 0.6) * Math.PI * 1.5;
        return [Math.cos(b + Math.PI / 2) * -1, Math.sin(b + Math.PI / 2)];
      }
      const b = Math.PI * 0.75 - ((t - 0.6) / 0.4) * Math.PI * 1.5;
      return [0.45 - Math.cos(b + Math.PI / 2) * -0.75, Math.sin(b + Math.PI / 2) * 0.75];
    }
    case 'clover': {
      const r = Math.abs(Math.cos(2 * a)) * 0.9 + 0.1;
      return [r * Math.cos(a), r * Math.sin(a)];
    }
    case 'butterfly': {
      const r = Math.exp(Math.sin(a)) - 2 * Math.cos(4 * a);
      return [(r * Math.cos(a)) / 3, (r * Math.sin(a)) / 3 - 0.2];
    }
    case 'diamond': {
      const r = 1 / (Math.abs(Math.cos(a)) * 1.25 + Math.abs(Math.sin(a)));
      return [r * Math.cos(a), r * Math.sin(a)];
    }
    case 'spiral': {
      const r = 0.12 + 0.88 * t;
      const b = t * TAU * 2.2;
      return [r * Math.cos(b), r * Math.sin(b)];
    }
    case 'crown': {
      // Five points along the top, a flat band below.
      const corners: [number, number][] = [
        [-1, -0.6],
        [-1, 0.7],
        [-0.55, 0.15],
        [-0.25, 0.85],
        [0, 0.2],
        [0.25, 0.85],
        [0.55, 0.15],
        [1, 0.7],
        [1, -0.6],
        [-1, -0.6],
      ];
      const scaled = t * (corners.length - 1);
      const i = Math.min(corners.length - 2, Math.floor(scaled));
      const f = scaled - i;
      return [
        corners[i][0] + (corners[i + 1][0] - corners[i][0]) * f,
        corners[i][1] + (corners[i + 1][1] - corners[i][1]) * f,
      ];
    }
    case 'snowflake': {
      // Six spokes, out and back.
      const spoke = Math.floor(t * 6);
      const along = 1 - Math.abs((t * 6 - spoke) * 2 - 1);
      const b = (spoke / 6) * TAU + Math.PI / 2;
      return [Math.cos(b) * along, Math.sin(b) * along];
    }
    case 'sun': {
      const r = 0.7 + (Math.cos(12 * a) > 0.6 ? 0.3 : 0);
      return [r * Math.cos(a), r * Math.sin(a)];
    }
  }
}

/** `count` sparks spread evenly along a shape's outline. */
export function shapePoints(shape: BookShape, count: number): ShapePoint[] {
  return Array.from({ length: count }, (_, i) => {
    const t = i / count;
    const [x, y] = at(shape, t);
    return { x, y, t };
  });
}

/** An SVG path through the shape's outline, in a 100 × 100 box, for the book and the 2D sky. */
export function shapePath(shape: BookShape, count = 72): string {
  const points = shapePoints(shape, count).map(
    ({ x, y }) => `${(50 + x * 44).toFixed(1)} ${(50 - y * 44).toFixed(1)}`,
  );
  return `M${points.join('L')}${shape === 'spiral' || shape === 'snowflake' ? '' : 'Z'}`;
}
