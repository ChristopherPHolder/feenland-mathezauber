import { Component, computed, input } from '@angular/core';
import { BakeryFrame, cookieColor } from './bakery-frame';
import { fitTray, trayGeometry, trayRegion } from './tray-geometry';

/**
 * The bakery drawn flat: the wall with the oven, menu board and shop window, Bruno and the
 * customer, and the tray with its cookies, gaps, knife and pieces, laid out exactly where the
 * 3D tray sits. It is the scene wherever 3D is missing, and the picture on the intro.
 * Decorative only: the game's controls and live text carry the same information.
 */
@Component({
  selector: 'app-bakery-tray',
  styleUrl: './bakery-tray.css',
  host: { '[class.is-baked]': "frame().phase === 'baked'" },
  template: `<svg [attr.viewBox]="'0 0 ' + size().width + ' ' + size().height" aria-hidden="true">
    <rect class="wall" [attr.width]="size().width" [attr.height]="size().height" />
    <g [attr.transform]="backdrop().transform">
      <rect class="board-frame" x="8" y="10" width="76" height="76" rx="6" />
      @for (square of squares(); track $index) {
        <circle
          class="square"
          [class.filled]="square.filled"
          [attr.cx]="square.x"
          [attr.cy]="square.y"
          r="2.6"
        />
      }
      <g class="oven" [class.golden]="frame().golden" [class.hot]="frame().timer !== null">
        <rect x="110" y="6" width="100" height="84" rx="12" />
        <rect class="oven-window" x="124" y="26" width="72" height="44" rx="10" />
        @if (frame().timer !== null) {
          <circle class="timer-track" cx="160" cy="16" r="7" />
          <circle
            class="timer-fill"
            cx="160"
            cy="16"
            r="7"
            pathLength="100"
            [attr.stroke-dasharray]="(1 - (frame().timer ?? 0)) * 100 + ' 100'"
          />
        }
      </g>
      <g class="shop">
        <rect class="shop-window" x="236" y="10" width="78" height="76" rx="8" />
        @for (treat of treats(); track $index) {
          <circle class="treat" [attr.cx]="treat.x" [attr.cy]="treat.y" r="7" />
        }
      </g>
    </g>
    <g class="bear" [attr.transform]="bear().transform">
      <circle class="bear-ear" cx="-20" cy="-22" r="10" />
      <circle class="bear-ear" cx="20" cy="-22" r="10" />
      <ellipse class="bear-body" cx="0" cy="34" rx="30" ry="26" />
      <rect class="apron" x="-16" y="22" width="32" height="34" rx="8" />
      <circle class="bear-head" cx="0" cy="0" r="25" />
      <ellipse class="snout" cx="0" cy="8" rx="11" ry="8" />
      <ellipse class="nose" cx="0" cy="4" rx="4.5" ry="3" />
      <circle class="eye" cx="-9" cy="-5" r="3" />
      <circle class="eye" cx="9" cy="-5" r="3" />
      <path class="hat" d="M-18 -22h36v-8c8-2 10-14 0-16-3-8-15-8-18-2-3-6-15-6-18 2-10 2-8 14 0 16z" />
    </g>
    <g class="customer" [attr.transform]="guest().transform" [attr.data-kind]="guestKind()">
      <circle class="guest-ear" cx="-14" cy="-20" r="8" />
      <circle class="guest-ear" cx="14" cy="-20" r="8" />
      <circle class="guest-head" cx="0" cy="0" r="20" />
      <circle class="eye" cx="-7" cy="-3" r="2.6" />
      <circle class="eye" cx="7" cy="-3" r="2.6" />
      <ellipse class="nose" cx="0" cy="6" rx="3.5" ry="2.5" />
    </g>
    <g [attr.transform]="'translate(' + fit().x + ' ' + fit().y + ') scale(' + fit().scale + ')'">
      @for (rect of geometry().pieceRects; track $index; let index = $index) {
        <rect
          class="dough"
          [class.active]="frame().phase === 'pieces' && frame().active === index"
          [class.named]="frame().values[index] !== null && frame().values[index] !== undefined"
          [class.twin]="twinPieces().has(index)"
          [attr.x]="rect.x"
          [attr.y]="rect.y"
          [attr.width]="rect.width"
          [attr.height]="rect.height"
          rx="0.32"
        />
      }
      @for (line of sugarLines(); track $index) {
        <line
          class="sugar"
          [attr.x1]="line.x1"
          [attr.y1]="line.y1"
          [attr.x2]="line.x2"
          [attr.y2]="line.y2"
        />
      }
      @if (showCookies()) {
        @for (cookie of cookies(); track cookie.key) {
          <g
            class="cookie"
            [class.ghost]="cookie.ghost"
            [class.pulse]="cookie.pulse"
            [style.--delay]="cookie.delay + 's'"
            [attr.transform]="'translate(' + cookie.x + ' ' + cookie.y + ')'"
          >
            <circle r="0.4" [attr.fill]="cookie.ghost ? null : color()" />
            @if (!cookie.ghost) {
              <circle class="chip" cx="-0.14" cy="-0.1" r="0.07" />
              <circle class="chip" cx="0.15" cy="0.02" r="0.06" />
              <circle class="chip" cx="-0.02" cy="0.17" r="0.06" />
            }
          </g>
        }
      } @else {
        @for (line of gridLines(); track $index) {
          <line
            class="grid"
            [attr.x1]="line.x1"
            [attr.y1]="line.y1"
            [attr.x2]="line.x2"
            [attr.y2]="line.y2"
          />
        }
      }
      @for (gap of guideLines(); track $index) {
        <line
          class="guide"
          [attr.x1]="gap.x1"
          [attr.y1]="gap.y1"
          [attr.x2]="gap.x2"
          [attr.y2]="gap.y2"
        />
      }
      @if (knife(); as knife) {
        <g class="knife">
          <line class="blade" [attr.x1]="knife.x1" [attr.y1]="knife.y1" [attr.x2]="knife.x2" [attr.y2]="knife.y2" />
          <rect
            class="handle"
            [attr.x]="knife.hx - 0.55"
            [attr.y]="knife.hy - 0.55"
            width="1.1"
            height="1.1"
            rx="0.3"
          />
        </g>
      }
    </g>
  </svg>`,
})
export class BakeryTray {
  readonly frame = input.required<BakeryFrame>();
  readonly size = input<{ width: number; height: number }>({ width: 400, height: 320 });

  protected readonly geometry = computed(() => {
    const frame = this.frame();
    return trayGeometry(frame);
  });
  protected readonly fit = computed(() =>
    fitTray(this.size().width, this.size().height, this.geometry()),
  );
  protected readonly color = computed(() => cookieColor(this.frame()));
  protected readonly showCookies = computed(
    () => this.frame().look !== 'area' || this.frame().cookies,
  );

  /** The oven, menu board and shop window across the top, or beside a wide board's tray. */
  protected readonly backdrop = computed(() => {
    const { width, height } = this.size();
    const wide = width / height > 1.3;
    const room = wide ? height * 0.3 : height * trayRegion(width, height).top;
    const scale = Math.min((width * (wide ? 0.6 : 0.96)) / 320, (room * 0.92) / 96);
    const x = (width - 320 * scale) / 2;
    return { transform: `translate(${x} ${wide ? 4 : 2}) scale(${scale})` };
  });
  protected readonly bear = computed(() => this.side(-1));
  protected readonly guest = computed(() => this.side(1));
  protected readonly guestKind = computed(() =>
    this.frame().customer.startsWith('dragon') ? 'dragon' : this.frame().customer,
  );

  protected readonly squares = computed(() =>
    this.frame().board.map((value, index) => ({
      x: 13 + (index % 10) * 7.4,
      y: 15 + Math.floor(index / 10) * 7.4,
      filled: value > 0,
    })),
  );
  protected readonly treats = computed(() =>
    Array.from({ length: Math.min(12, this.frame().treats) }, (_, index) => ({
      x: 248 + (index % 4) * 18,
      y: 74 - Math.floor(index / 4) * 22,
    })),
  );

  protected readonly twinPieces = computed(() => {
    const pieces = this.geometry().pieces;
    const twins = new Set<number>();
    pieces.forEach((piece, index) => {
      if (
        pieces.some(
          (other, at) => at !== index && other.rows === piece.rows && other.cols === piece.cols,
        )
      )
        twins.add(index);
    });
    return pieces.length > 1 ? twins : new Set<number>();
  });

  protected readonly cookies = computed(() => {
    const frame = this.frame();
    const geometry = this.geometry();
    const ghostShown = frame.ghost && frame.ghostValue === null;
    const pulse = frame.pulses ? frame.pulse : null;
    const out: { key: string; x: number; y: number; ghost: boolean; pulse: boolean; delay: number }[] = [];
    geometry.rowY.forEach((y, row) =>
      geometry.colX.forEach((x, col) => {
        const ghost = (frame.ghost === 'rows' && row === frame.rows) || (frame.ghost === 'cols' && col === frame.cols);
        if (ghost && !ghostShown) return;
        const piece = geometry.pieces.findIndex(
          (p) => row >= p.row && row < p.row + p.rows && col >= p.col && col < p.col + p.cols,
        );
        const inPulse =
          !!pulse &&
          (pulse.kind === 'pieces' ||
            (pulse.kind === 'ghost' && ghost) ||
            (pulse.kind === 'row' && row === 0) ||
            (pulse.kind === 'rows' && (piece === pulse.piece || frame.cuts.length === 0)));
        const local = piece >= 0 ? row - geometry.pieces[piece].row : row;
        out.push({
          key: `${row}-${col}-${frame.pulses}`,
          x,
          y,
          ghost,
          pulse: inPulse,
          delay: pulse?.kind === 'rows' ? local * 0.32 : 0,
        });
      }),
    );
    return out;
  });

  /** Sugar lines under every fifth row and column: a dotted line, not just a colour. */
  protected readonly sugarLines = computed(() => {
    const g = this.geometry();
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let row = 5; row < g.rowY.length; row += 5)
      lines.push({ x1: 0.25, x2: g.width - 0.25, y1: (g.rowY[row - 1] + g.rowY[row]) / 2, y2: (g.rowY[row - 1] + g.rowY[row]) / 2 });
    for (let col = 5; col < g.colX.length; col += 5)
      lines.push({ y1: 0.25, y2: g.height - 0.25, x1: (g.colX[col - 1] + g.colX[col]) / 2, x2: (g.colX[col - 1] + g.colX[col]) / 2 });
    return lines;
  });

  /** The area model: faint lines between every row and column instead of cookies. */
  protected readonly gridLines = computed(() => {
    const g = this.geometry();
    return [
      ...g.rowGaps.map((y) => ({ x1: 0.3, x2: g.width - 0.3, y1: y, y2: y })),
      ...g.colGaps.map((x) => ({ y1: 0.3, y2: g.height - 0.3, x1: x, x2: x })),
    ];
  });

  protected readonly guideLines = computed(() => {
    const frame = this.frame();
    const g = this.geometry();
    if (!frame.guide || frame.phase !== 'cut') return [];
    return frame.guide.gaps.map((at) => this.gapLine(frame.guide!.dir, at, g));
  });

  protected readonly knife = computed(() => {
    const frame = this.frame();
    if (frame.phase !== 'cut' || !frame.knife) return null;
    const line = this.gapLine(frame.knife.dir, frame.knife.at, this.geometry());
    return {
      ...line,
      hx: frame.knife.dir === 'rows' ? line.x1 : line.x1,
      hy: frame.knife.dir === 'rows' ? line.y1 : line.y1,
    };
  });

  private gapLine(dir: 'rows' | 'cols', at: number, g: ReturnType<typeof trayGeometry>) {
    if (dir === 'rows') {
      const y = g.rowGaps[at - 1] ?? 0;
      return { x1: 0.1, x2: g.width - 0.1, y1: y, y2: y };
    }
    const x = g.colGaps[at - 1] ?? 0;
    return { y1: 0.1, y2: g.height - 0.1, x1: x, x2: x };
  }

  /** Bruno stands to the left of the tray and the customer to the right, or above on a tall board. */
  private side(side: -1 | 1) {
    const { width, height } = this.size();
    const fit = this.fit();
    const wide = width / height > 1.3;
    const scale = Math.max(0.5, Math.min(1.4, (wide ? fit.x : fit.y) / 110));
    const x = wide
      ? side < 0
        ? fit.x / 2
        : fit.x + fit.width + (width - fit.x - fit.width) / 2
      : side < 0
        ? width * 0.1
        : width * 0.9;
    const y = wide ? height * 0.62 : Math.max(30 * scale, fit.y - 58 * scale);
    return { transform: `translate(${x} ${y}) scale(${scale})` };
  }
}
