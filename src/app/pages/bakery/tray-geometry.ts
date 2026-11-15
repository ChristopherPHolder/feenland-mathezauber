import type { CutDir } from './bakery-levels';

/**
 * Where everything on a tray sits, in cookie units (one cookie cell is 1 × 1, x to the right,
 * y down). The 3D world, the flat fallback and the DOM layer of knife and piece targets all
 * read the same geometry, so a tap lands on the gap the child sees, in 3D or flat.
 */

/** The extra space after every fifth row and column, so a 5 × 5 block reads at a glance. */
export const FIVE_GAP = 0.42;
/** The margin of dough around the cookies. */
export const PAD = 0.42;
/** How far the pieces slide apart at a cut. */
export const SPLIT = 0.9;

export interface Piece {
  readonly rows: number;
  readonly cols: number;
  /** First row and column of the piece on the tray. */
  readonly row: number;
  readonly col: number;
}

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface TrayGeometry {
  readonly rows: number;
  readonly cols: number;
  readonly width: number;
  readonly height: number;
  /** Centre of every column and row, the ghost line included. */
  readonly colX: readonly number[];
  readonly rowY: readonly number[];
  /** The gap line before row k (k = 1 … rows − 1) sits at rowGaps[k − 1]. */
  readonly rowGaps: readonly number[];
  readonly colGaps: readonly number[];
  readonly pieces: readonly Piece[];
  /** Each piece's dough, with a little margin around its cookies. */
  readonly pieceRects: readonly Rect[];
  /** The ghost row (or column) Bruno adds to make a friendly ten. */
  readonly ghost: CutDir | null;
}

export interface TrayShape {
  readonly rows: number;
  readonly cols: number;
  readonly dir?: CutDir | null;
  readonly cuts?: readonly number[];
  readonly ghost?: CutDir | null;
}

/** The pieces a set of cuts makes: cut `k` goes between line k − 1 and line k. */
export function cutPieces(rows: number, cols: number, dir: CutDir | null, cuts: readonly number[]) {
  const size = dir === 'cols' ? cols : rows;
  const edges = [0, ...[...cuts].sort((a, b) => a - b), size];
  const pieces: Piece[] = [];
  for (let index = 0; index < edges.length - 1; index++) {
    const start = edges[index];
    const part = edges[index + 1] - start;
    pieces.push(
      dir === 'cols'
        ? { rows, cols: part, row: 0, col: start }
        : { rows: part, cols, row: start, col: 0 },
    );
  }
  return pieces;
}

function centres(count: number, cuts: readonly number[]) {
  return Array.from(
    { length: count },
    (_, index) =>
      PAD +
      index +
      0.5 +
      FIVE_GAP * Math.floor(index / 5) +
      SPLIT * cuts.filter((cut) => cut <= index).length,
  );
}

export function trayGeometry(shape: TrayShape): TrayGeometry {
  const { rows, cols } = shape;
  const dir = shape.dir ?? null;
  const cuts = shape.cuts ?? [];
  const ghost = shape.ghost ?? null;
  const colX = centres(cols + (ghost === 'cols' ? 1 : 0), dir === 'cols' ? cuts : []);
  const rowY = centres(rows + (ghost === 'rows' ? 1 : 0), dir === 'rows' ? cuts : []);
  const gaps = (at: readonly number[], count: number) =>
    Array.from({ length: count - 1 }, (_, index) => (at[index] + at[index + 1]) / 2);
  const pieces = cutPieces(rows, cols, dir, cuts);
  const margin = PAD * 0.7;
  const pieceRects = pieces.map((piece) => {
    const left = colX[piece.col] - 0.5 - margin;
    const top = rowY[piece.row] - 0.5 - margin;
    return {
      x: left,
      y: top,
      width: colX[piece.col + piece.cols - 1] + 0.5 + margin - left,
      height: rowY[piece.row + piece.rows - 1] + 0.5 + margin - top,
    };
  });
  return {
    rows,
    cols,
    width: colX[colX.length - 1] + 0.5 + PAD,
    height: rowY[rowY.length - 1] + 0.5 + PAD,
    colX,
    rowY,
    rowGaps: gaps(rowY, rows),
    colGaps: gaps(colX, cols),
    pieces,
    pieceRects,
    ghost,
  };
}

/** Where the tray may sit on the board, as shares of its width and height. */
export interface Region {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

/** Boards wider than this keep Bruno and the customer beside the tray instead of above it. */
export const WIDE_BOARD = 1.3;

export function trayRegion(width: number, height: number): Region {
  return width / height > WIDE_BOARD
    ? { left: 0.21, right: 0.21, top: 0.1, bottom: 0.04 }
    : { left: 0.04, right: 0.04, top: 0.22, bottom: 0.035 };
}

/** Where the tray sits on a board of `width` × `height` pixels, and pixels per cookie unit. */
export interface TrayFit extends Rect {
  readonly scale: number;
}

export function fitTray(width: number, height: number, geometry: TrayGeometry): TrayFit {
  const region = trayRegion(width, height);
  const room = {
    x: width * region.left,
    y: height * region.top,
    width: width * (1 - region.left - region.right),
    height: height * (1 - region.top - region.bottom),
  };
  // A small tray never grows past the size of a seven-cookie tray, so cookies stay cookie sized.
  const scale = Math.min(
    room.width / geometry.width,
    room.height / geometry.height,
    Math.min(room.width, room.height) / 7,
  );
  const trayWidth = geometry.width * scale;
  const trayHeight = geometry.height * scale;
  return {
    x: room.x + (room.width - trayWidth) / 2,
    y: room.y + (room.height - trayHeight) / 2,
    width: trayWidth,
    height: trayHeight,
    scale,
  };
}

/** The gap nearest to a point in tray units, in one direction or whichever is closer. */
export function nearestGap(
  geometry: TrayGeometry,
  x: number,
  y: number,
  dir: CutDir | null = null,
): { dir: CutDir; at: number; distance: number } | null {
  const closest = (gaps: readonly number[], value: number) =>
    gaps.reduce<{ at: number; distance: number } | null>((best, gap, index) => {
      const distance = Math.abs(gap - value);
      return !best || distance < best.distance ? { at: index + 1, distance } : best;
    }, null);
  const row = dir === 'cols' ? null : closest(geometry.rowGaps, y);
  const col = dir === 'rows' ? null : closest(geometry.colGaps, x);
  if (row && (!col || row.distance <= col.distance)) return { dir: 'rows', ...row };
  return col ? { dir: 'cols', ...col } : null;
}

/** The piece under a point in tray units, if any. */
export function pieceAt(geometry: TrayGeometry, x: number, y: number): number {
  return geometry.pieceRects.findIndex(
    (rect) => x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height,
  );
}
