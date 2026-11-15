/** A picture in the night sky that a round of caught stars draws, one point per star. */
export interface Constellation {
  readonly id: ConstellationId;
  /** Points in a unit box, x to the right and y downwards, in the order stars light them. */
  readonly points: readonly (readonly [number, number])[];
  /** Join the last point back to the first once the picture is finished. */
  readonly closed: boolean;
}

export type ConstellationId =
  | 'heart'
  | 'castle'
  | 'fish'
  | 'crown'
  | 'cat'
  | 'rocket'
  | 'unicorn'
  | 'butterfly'
  | 'dragon'
  | 'boat'
  | 'moon'
  | 'tree';

/**
 * One constellation per level, easiest first. Each caught star lights the next point and draws
 * a line to the one before; finishing the round lights any points left over and closes the
 * picture, so a round of 11 or 13 stars always ends with the whole drawing.
 */
export const CONSTELLATIONS: readonly Constellation[] = [
  {
    id: 'heart',
    closed: true,
    points: [
      [0.5, 0.92],
      [0.3, 0.74],
      [0.12, 0.54],
      [0.06, 0.34],
      [0.14, 0.15],
      [0.32, 0.07],
      [0.5, 0.24],
      [0.68, 0.07],
      [0.86, 0.15],
      [0.94, 0.34],
      [0.88, 0.54],
      [0.7, 0.74],
    ],
  },
  {
    id: 'castle',
    closed: true,
    points: [
      [0.1, 0.94],
      [0.1, 0.42],
      [0.2, 0.16],
      [0.3, 0.42],
      [0.42, 0.42],
      [0.5, 0.06],
      [0.58, 0.42],
      [0.7, 0.42],
      [0.8, 0.16],
      [0.9, 0.42],
      [0.9, 0.94],
      [0.5, 0.94],
    ],
  },
  {
    id: 'fish',
    closed: true,
    points: [
      [0.04, 0.5],
      [0.18, 0.3],
      [0.38, 0.2],
      [0.58, 0.22],
      [0.74, 0.36],
      [0.94, 0.16],
      [0.88, 0.5],
      [0.94, 0.84],
      [0.74, 0.64],
      [0.58, 0.78],
      [0.38, 0.8],
      [0.18, 0.7],
    ],
  },
  {
    id: 'crown',
    closed: true,
    points: [
      [0.1, 0.86],
      [0.08, 0.56],
      [0.06, 0.28],
      [0.18, 0.43],
      [0.3, 0.56],
      [0.4, 0.33],
      [0.5, 0.1],
      [0.6, 0.33],
      [0.7, 0.56],
      [0.82, 0.43],
      [0.94, 0.28],
      [0.92, 0.56],
      [0.9, 0.86],
    ],
  },
  {
    id: 'cat',
    closed: true,
    points: [
      [0.22, 0.9],
      [0.1, 0.66],
      [0.1, 0.4],
      [0.14, 0.08],
      [0.36, 0.28],
      [0.5, 0.26],
      [0.64, 0.28],
      [0.86, 0.08],
      [0.9, 0.4],
      [0.9, 0.66],
      [0.78, 0.9],
      [0.5, 0.97],
    ],
  },
  {
    id: 'rocket',
    closed: true,
    points: [
      [0.5, 0.03],
      [0.63, 0.2],
      [0.67, 0.45],
      [0.67, 0.68],
      [0.85, 0.9],
      [0.6, 0.83],
      [0.5, 0.97],
      [0.4, 0.83],
      [0.15, 0.9],
      [0.33, 0.68],
      [0.33, 0.45],
      [0.37, 0.2],
    ],
  },
  {
    id: 'unicorn',
    closed: true,
    points: [
      [0.3, 0.02],
      [0.44, 0.3],
      [0.26, 0.44],
      [0.08, 0.62],
      [0.13, 0.75],
      [0.32, 0.73],
      [0.44, 0.85],
      [0.5, 0.98],
      [0.88, 0.98],
      [0.82, 0.62],
      [0.72, 0.36],
      [0.62, 0.16],
      [0.52, 0.28],
    ],
  },
  {
    id: 'butterfly',
    closed: true,
    points: [
      [0.5, 0.3],
      [0.28, 0.06],
      [0.06, 0.18],
      [0.14, 0.48],
      [0.1, 0.82],
      [0.32, 0.9],
      [0.5, 0.6],
      [0.68, 0.9],
      [0.9, 0.82],
      [0.86, 0.48],
      [0.94, 0.18],
      [0.72, 0.06],
    ],
  },
  {
    id: 'dragon',
    closed: true,
    points: [
      [0.04, 0.5],
      [0.18, 0.4],
      [0.3, 0.48],
      [0.42, 0.12],
      [0.52, 0.42],
      [0.68, 0.06],
      [0.66, 0.45],
      [0.84, 0.5],
      [0.98, 0.36],
      [0.9, 0.62],
      [0.7, 0.7],
      [0.44, 0.72],
      [0.22, 0.6],
    ],
  },
  {
    id: 'boat',
    closed: true,
    points: [
      [0.25, 0.86],
      [0.08, 0.62],
      [0.3, 0.62],
      [0.47, 0.62],
      [0.47, 0.32],
      [0.47, 0.06],
      [0.66, 0.3],
      [0.84, 0.52],
      [0.53, 0.52],
      [0.53, 0.62],
      [0.92, 0.62],
      [0.75, 0.86],
    ],
  },
  {
    id: 'moon',
    closed: true,
    points: [
      [0.62, 0.06],
      [0.38, 0.08],
      [0.18, 0.22],
      [0.07, 0.45],
      [0.12, 0.7],
      [0.3, 0.88],
      [0.55, 0.95],
      [0.76, 0.86],
      [0.55, 0.76],
      [0.42, 0.56],
      [0.43, 0.34],
      [0.52, 0.17],
    ],
  },
  {
    id: 'tree',
    closed: true,
    points: [
      [0.5, 0.03],
      [0.72, 0.33],
      [0.6, 0.33],
      [0.86, 0.66],
      [0.56, 0.66],
      [0.56, 0.96],
      [0.44, 0.96],
      [0.44, 0.66],
      [0.14, 0.66],
      [0.4, 0.33],
      [0.28, 0.33],
    ],
  },
];

export function constellation(id: ConstellationId): Constellation {
  return CONSTELLATIONS.find((item) => item.id === id)!;
}

/** The lines to draw once `lit` points are lit; the closing line only when it is complete. */
export function constellationEdges(
  shape: Constellation,
  lit: number,
  complete: boolean,
): readonly (readonly [number, number])[] {
  const count = complete ? shape.points.length : Math.min(lit, shape.points.length);
  const edges: [number, number][] = [];
  for (let index = 1; index < count; index++) edges.push([index - 1, index]);
  if (complete && shape.closed) edges.push([shape.points.length - 1, 0]);
  return edges;
}
