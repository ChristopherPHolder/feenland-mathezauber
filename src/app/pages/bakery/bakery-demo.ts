import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { LocaleService } from '../../core/locale';
import { bakeryText, BakeryMessageKey } from './bakery-messages';
import type { TrickCard } from './bakery-order';

/** How the film shows a level: cut it, add a ghost row, turn it round, or count the rows. */
export type DemoKind = 'cut' | 'ghost' | 'turn' | 'read';

interface Step {
  readonly caption: BakeryMessageKey;
  readonly ms: number;
}

const GAP = 14;
const R = 5;
const SPLIT = 12;
const X0 = 14;
const Y0 = 14;

/** The film's steps for each kind of level, in order. */
export function demoSteps(kind: DemoKind, pieces: number): readonly Step[] {
  const rest = { caption: 'demoOrder', ms: 900 } as const;
  const total = { caption: 'demoTotal', ms: 1700 } as const;
  const baked = { caption: 'demoBaked', ms: 2200 } as const;
  if (kind === 'read') return [rest, { caption: 'demoRows', ms: 2600 }, total, baked];
  if (kind === 'turn')
    return [
      rest,
      { caption: 'demoTurn', ms: 1700 },
      { caption: 'demoRows', ms: 2400 },
      total,
      baked,
    ];
  if (kind === 'ghost')
    return [
      rest,
      { caption: 'demoGhost', ms: 1600 },
      { caption: 'demoFull', ms: 1600 },
      { caption: 'demoNibble', ms: 1700 },
      total,
      baked,
    ];
  return [
    rest,
    { caption: 'demoKnife', ms: 1700 },
    { caption: 'demoCut', ms: 1500 },
    ...Array.from({ length: pieces }, () => ({ caption: 'demoPiece' as const, ms: 1500 })),
    total,
    baked,
  ];
}

/**
 * A tiny "how to bake" film in the bakery's own pieces, with made-up numbers that are never the
 * order on screen: the knife slides to the glowing gap, the tray splits, a finger taps each
 * piece's number and then the total, and the tray is baked. Ghost-row levels add a row and let
 * the dragon nibble it; the first levels count rows or turn the tray. It plays once by itself
 * and then waits on the last picture; the button plays it again or pauses it.
 */
@Component({
  selector: 'app-bakery-demo',
  template: `
    <div class="film" [attr.data-kind]="kind()" aria-hidden="true">
      <svg [attr.viewBox]="'0 0 ' + box().width + ' ' + box().height">
        <g class="tray" [class.turning]="turned()">
          @for (piece of pieces(); track $index) {
            <rect
              class="dough"
              [class.done]="baked()"
              [attr.x]="piece.x"
              [attr.y]="piece.y"
              [attr.width]="piece.width"
              [attr.height]="piece.height"
              rx="6"
            />
          }
          @for (dot of dots(); track $index) {
            <circle
              [attr.cx]="dot.x"
              [attr.cy]="dot.y"
              [attr.r]="R"
              [class.ghost]="dot.ghost"
              [class.gone]="dot.gone"
              [class.lit]="dot.lit"
              [class.baked]="baked()"
              [style.--d]="dot.delay + 's'"
            />
          }
          @if (knife(); as knife) {
            <g class="knife" [style.transform]="'translateY(' + knife.y + 'px)'">
              <line [attr.x1]="X0 - 8" [attr.x2]="knife.x2" y1="0" y2="0" />
              <rect [attr.x]="X0 - 22" y="-5" width="16" height="10" rx="4" />
            </g>
          }
          @if (glow(); as glow) {
            <line
              class="glow"
              [attr.x1]="X0 - 4"
              [attr.x2]="glow.x2"
              [attr.y1]="glow.y"
              [attr.y2]="glow.y"
            />
          }
        </g>
        @for (line of lines(); track $index) {
          <text class="line" [class.answer]="line.answer" [attr.x]="textX()" [attr.y]="line.y">
            {{ line.text }}
          </text>
        }
        @if (finger(); as finger) {
          <path
            class="finger"
            [style.transform]="'translate(' + finger.x + 'px, ' + finger.y + 'px) scale(0.55)'"
            d="M15 25V7a4.5 4.5 0 0 1 9 0v13l9.5 2.2A5 5 0 0 1 37 27.6L35 40a9 9 0 0 1-9 7.5h-8.6a9 9 0 0 1-7.3-3.8L4 35.4a4 4 0 0 1 6-5.2l5 4.3z"
          />
        }
      </svg>
    </div>
    <div class="controls">
      <ol class="steps" aria-hidden="true">
        @for (n of numbers(); track n) {
          <li [class.on]="step() === n" [class.done]="step() > n">{{ n }}</li>
        }
      </ol>
      <button
        type="button"
        class="replay"
        [attr.aria-label]="t(playing() ? 'demoPause' : 'demoReplay')"
        [title]="t(playing() ? 'demoPause' : 'demoReplay')"
        (click)="toggle()"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          @if (playing()) {
            <path d="M8 5v14M16 5v14" />
          } @else {
            <path d="M7 4v16l13-8z" />
          }
        </svg>
      </button>
    </div>
    <p class="caption" aria-hidden="true">{{ t(steps()[step()].caption) }}</p>
    <p class="sr-only">{{ t('demoSummary') }}</p>
  `,
  styleUrl: './bakery-demo.css',
})
export class BakeryDemo {
  private readonly i = inject(LocaleService);
  readonly card = input.required<TrickCard>();
  readonly kind = input<DemoKind>('cut');

  protected readonly R = R;
  protected readonly X0 = X0;
  protected readonly step = signal(0);
  protected readonly playing = signal(false);
  private timer?: ReturnType<typeof setTimeout>;

  /** The rows of each piece the film cuts into; the ghost and read films keep one tray. */
  private readonly parts = computed(() => {
    const { rows, parts } = this.card();
    return this.kind() === 'cut' && parts.length > 1 && parts.every((p) => p > 0) ? parts : [rows];
  });
  protected readonly steps = computed(() => demoSteps(this.kind(), this.parts().length));
  protected readonly numbers = computed(() =>
    this.steps()
      .map((_, index) => index)
      .slice(1),
  );
  private readonly name = computed(() => this.steps()[this.step()].caption);
  private readonly at = (caption: BakeryMessageKey) =>
    this.steps().findIndex((step) => step.caption === caption);
  protected readonly baked = computed(() => this.name() === 'demoBaked');
  protected readonly turned = computed(
    () => this.kind() === 'turn' && this.step() >= this.at('demoTurn'),
  );
  /** Rows and columns as the tray lies now: the turn film swaps them. */
  private readonly shape = computed(() => {
    const { rows, cols } = this.card();
    return this.turned() ? { rows: cols, cols: rows } : { rows, cols };
  });
  private readonly split = computed(
    () => this.kind() === 'cut' && this.step() >= this.at('demoCut'),
  );
  private readonly ghostShown = computed(
    () => this.kind() === 'ghost' && this.step() >= this.at('demoGhost'),
  );
  private readonly nibbled = computed(
    () => this.kind() === 'ghost' && this.step() >= this.at('demoNibble'),
  );

  /** Where each row's dots sit, with the pieces pulled apart after the cut. */
  private readonly rowY = computed(() => {
    const parts = this.parts();
    const ys: number[] = [];
    let y = Y0;
    parts.forEach((part, index) => {
      for (let row = 0; row < part; row++) ys.push(y + row * GAP);
      y += part * GAP + (this.split() && index < parts.length - 1 ? SPLIT : 0);
    });
    if (this.kind() === 'turn')
      return Array.from({ length: this.shape().rows }, (_, r) => Y0 + r * GAP);
    if (this.kind() === 'ghost') ys.push(Y0 + ys.length * GAP);
    return ys;
  });
  protected readonly dots = computed(() => {
    const { cols } = this.shape();
    const rows = this.rowY();
    const ghostRow = this.kind() === 'ghost' ? rows.length - 1 : -1;
    const counting = this.name() === 'demoRows';
    return rows.flatMap((y, row) =>
      Array.from({ length: cols }, (_, col) => ({
        x: X0 + col * GAP,
        y,
        ghost: row === ghostRow,
        gone: row === ghostRow && (!this.ghostShown() || this.nibbled()),
        lit: counting,
        delay: row * 0.45,
      })),
    );
  });
  protected readonly pieces = computed(() => {
    const { cols } = this.shape();
    const rows = this.rowY();
    const width = cols * GAP + 6;
    if (!this.split()) {
      const ghostOff = this.kind() === 'ghost' && (!this.ghostShown() || this.nibbled());
      const last = ghostOff ? rows.length - 2 : rows.length - 1;
      return [
        { x: X0 - GAP / 2 - 3, y: Y0 - GAP / 2 - 3, width, height: rows[last] - rows[0] + GAP + 6 },
      ];
    }
    let start = 0;
    return this.parts().map((part) => {
      const top = rows[start];
      const bottom = rows[start + part - 1];
      start += part;
      return { x: X0 - GAP / 2 - 3, y: top - GAP / 2 - 3, width, height: bottom - top + GAP + 6 };
    });
  });
  /** Just big enough for the tray at its tallest (turned, split or with a ghost row) and the sums. */
  protected readonly box = computed(() => {
    const { rows, cols } = this.card();
    const tall = Math.max(
      rows + (this.kind() === 'ghost' ? 1 : 0),
      this.kind() === 'turn' ? cols : 0,
    );
    const split = (this.parts().length - 1) * SPLIT;
    const sums = Y0 + 6 + 4 * 22;
    return { width: this.textX() + 112, height: Math.max(Y0 + tall * GAP + split, sums) };
  });
  /** The sums start just right of the tray at its widest (turned, the rows lie across). */
  protected readonly textX = computed(() => {
    const { rows, cols } = this.card();
    return X0 + (this.kind() === 'turn' ? Math.max(rows, cols) : cols) * GAP + 22;
  });

  private readonly cutGap = computed(() => {
    const parts = this.parts();
    if (parts.length < 2) return null;
    return Y0 + parts[0] * GAP - GAP / 2;
  });
  protected readonly knife = computed(() => {
    const gap = this.cutGap();
    if (this.kind() !== 'cut' || gap === null || this.split()) return null;
    const moving = this.name() === 'demoKnife';
    return { y: moving ? gap : Y0 + GAP / 2, x2: X0 + this.shape().cols * GAP };
  });
  protected readonly glow = computed(() => {
    const gap = this.cutGap();
    if (this.kind() !== 'cut' || gap === null || this.split()) return null;
    return { y: gap, x2: X0 + this.shape().cols * GAP };
  });

  /** The sums written beside the tray, one line per step done. */
  protected readonly lines = computed(() => {
    const { rows, cols } = this.card();
    const step = this.step();
    const out: { text: string; y: number; answer: boolean }[] = [];
    const add = (text: string, answer = false) =>
      out.push({ text, y: Y0 + 6 + out.length * 22, answer });
    const shape = this.shape();
    out.push({ text: `${shape.rows} × ${shape.cols} = ?`, y: Y0 + 6, answer: false });
    const parts = this.parts();
    if (this.kind() === 'cut') {
      parts.forEach((part, index) => {
        if (step >= this.at('demoCut') + index + 1) add(`${part} × ${cols} = ${part * cols}`);
        else if (this.split()) add(`${part} × ${cols} = ?`);
      });
      if (step >= this.at('demoTotal'))
        add(`${parts.map((p) => p * cols).join(' + ')} = ${rows * cols}`, true);
    } else if (this.kind() === 'ghost') {
      if (step >= this.at('demoFull')) add(`${rows + 1} × ${cols} = ${(rows + 1) * cols}`);
      if (step >= this.at('demoTotal'))
        add(`${(rows + 1) * cols} − ${cols} = ${rows * cols}`, true);
    } else {
      if (step >= this.at('demoRows'))
        add(
          Array.from({ length: shape.rows }, (_, r) => (r + 1) * shape.cols)
            .slice(0, 4)
            .join(', ') + (shape.rows > 4 ? ' …' : ''),
        );
      if (step >= this.at('demoTotal')) add(`${shape.rows} × ${shape.cols} = ${rows * cols}`, true);
    }
    return out;
  });

  /** Where the finger points: the knife, a piece's line, the ghost row or the total. */
  protected readonly finger = computed(() => {
    const name = this.name();
    const lines = this.lines();
    if (name === 'demoKnife' || name === 'demoCut') {
      const gap = this.cutGap();
      return gap === null ? null : { x: X0 - 26, y: gap - 4 };
    }
    if (name === 'demoGhost') return { x: X0 + GAP, y: this.rowY().at(-1)! - 4 };
    if (name === 'demoPiece' || name === 'demoFull' || name === 'demoTotal') {
      const line = lines.at(-1)!;
      return { x: this.textX() + 60, y: line.y - 6 };
    }
    return null;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
    afterNextRender(() => this.play());
  }

  protected t(key: BakeryMessageKey) {
    return bakeryText(this.i.locale(), key);
  }

  protected toggle() {
    if (this.playing()) {
      clearTimeout(this.timer);
      this.playing.set(false);
    } else this.play();
  }

  private play() {
    clearTimeout(this.timer);
    const last = this.steps().length - 1;
    if (this.step() === last) this.step.set(0);
    this.playing.set(true);
    const next = () => {
      const step = this.step();
      if (step === last) {
        this.playing.set(false);
        return;
      }
      this.timer = setTimeout(() => {
        this.step.set(step + 1);
        next();
      }, this.steps()[step].ms);
    };
    next();
  }
}
