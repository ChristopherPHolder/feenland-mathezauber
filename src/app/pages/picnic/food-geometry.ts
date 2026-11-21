import { roundFood, type Food } from './picnic-levels';

/** One piece of a drawn food: its SVG path, its middle (for jam and labels), and its jam. */
export interface PiecePath {
  readonly d: string;
  readonly x: number;
  readonly y: number;
  readonly jam: boolean;
}

/** The SVG box each food is drawn in. Round foods are square; bars and ribbons are long. */
export function foodBox(food: Food): { width: number; height: number } {
  if (roundFood(food)) return { width: 100, height: 100 };
  return food === 'ribbon' ? { width: 120, height: 16 } : { width: 120, height: 34 };
}

const R = 44;
const C = 50;
/** How far apart cut pieces sit, in drawing units. */
const GAP = 2.2;

const point = (turn: number, radius: number, shift = { x: 0, y: 0 }) => {
  const angle = turn * Math.PI * 2 - Math.PI / 2;
  return {
    x: C + shift.x + Math.cos(angle) * radius,
    y: C + shift.y + Math.sin(angle) * radius,
  };
};
const f = (n: number) => Math.round(n * 100) / 100;

/**
 * Pieces of a food, `sizes` as shares of the whole: wedges from the top clockwise for a round
 * food, slices from the left for a strip. With `apart`, pieces part a little along their middle.
 */
export function piecePaths(
  food: Food,
  sizes: readonly number[],
  shaded: readonly boolean[] = [],
  apart = false,
): PiecePath[] {
  const total = sizes.reduce((a, b) => a + b, 0) || 1;
  let start = 0;
  if (roundFood(food)) {
    if (sizes.length < 2)
      return [
        {
          d: `M${C - R} ${C}a${R} ${R} 0 1 0 ${2 * R} 0a${R} ${R} 0 1 0 ${-2 * R} 0z`,
          x: C,
          y: C,
          jam: !!shaded[0],
        },
      ];
    return sizes.map((size, index) => {
      const share = size / total;
      const middle = start + share / 2;
      const away = point(middle, apart ? GAP : 0);
      const shift = { x: away.x - C, y: away.y - C };
      const a = point(start, R, shift);
      const b = point(start + share, R, shift);
      const label = point(middle, R * (share > 0.3 ? 0.42 : 0.62), shift);
      start += share;
      return {
        d: `M${f(C + shift.x)} ${f(C + shift.y)}L${f(a.x)} ${f(a.y)}A${R} ${R} 0 ${share > 0.5 ? 1 : 0} 1 ${f(b.x)} ${f(b.y)}z`,
        x: f(label.x),
        y: f(label.y),
        jam: !!shaded[index],
      };
    });
  }
  const box = foodBox(food);
  const inner = box.width - 8;
  const gaps = apart ? (sizes.length - 1) * GAP : 0;
  let x = 4;
  return sizes.map((size, index) => {
    const width = ((inner - gaps) * size) / total;
    const piece = {
      d: `M${f(x)} 3h${f(width)}v${box.height - 6}h${f(-width)}z`,
      x: f(x + width / 2),
      y: box.height / 2,
      jam: !!shaded[index],
    };
    x += width + (apart ? GAP : 0);
    return piece;
  });
}

/** Where each cut mark sits on the food, in percent of the drawing's box (for tap targets). */
export function markSpot(food: Food, mark: number, ticks = 12): { left: number; top: number } {
  if (roundFood(food)) {
    const p = point(mark / ticks, R + 1);
    return { left: p.x, top: p.y };
  }
  const box = foodBox(food);
  return { left: ((4 + ((box.width - 8) * mark) / ticks) / box.width) * 100, top: 50 };
}
