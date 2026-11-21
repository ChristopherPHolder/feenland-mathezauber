import { Component, input } from '@angular/core';

export type RewardBurstKind = 'plain' | 'golden' | 'big';

/** Where the sparkles burst on the board, in percent, with their own little delay. */
const SPARKLES = [
  [16, 20, 0],
  [82, 16, 0.12],
  [10, 56, 0.24],
  [90, 50, 0.06],
  [30, 10, 0.3],
  [68, 8, 0.18],
  [50, 30, 0.42],
  [22, 38, 0.36],
  [78, 34, 0.48],
] as const;

/**
 * The burst over a game board after a right answer: a glow, sparkles, and a card with the
 * cheer, the points won and a badge for each bonus. Golden and big turns get a gold card.
 * `wait` holds it back while a 3D scene plays its own moment first. A game tints the plain
 * card with `--burst-edge`, `--burst-ground`, `--burst-shadow` and `--burst-cheer`.
 *
 * It only shows. Screen readers hear the same news from the game's status line, so the
 * burst stays hidden from them.
 */
@Component({
  selector: 'ui-reward-burst',
  host: {
    'aria-hidden': 'true',
    '[class.is-golden]': "kind() === 'golden'",
    '[class.is-big]': "kind() === 'big'",
    '[style.--wait]': "wait() + 's'",
  },
  template: `
    <span class="glow"></span>
    @for (sparkle of sparkles; track $index) {
      <span
        class="sparkle"
        [style.left.%]="sparkle[0]"
        [style.top.%]="sparkle[1]"
        [style.--at]="sparkle[2] + 's'"
      ></span>
    }
    <div class="card">
      <span class="rays"></span>
      <strong class="cheer">{{ cheer() }}</strong>
      <span class="gain">{{ points() }}</span>
      @if (badges().length) {
        <span class="badges">
          @for (badge of badges(); track badge) {
            <span class="badge" [style.--at]="0.5 + $index * 0.15 + 's'">{{ badge }}</span>
          }
        </span>
      }
    </div>
  `,
  styles: `
    :host {
      position: absolute;
      inset: 0;
      z-index: 2;
      display: grid;
      justify-items: center;
      align-items: start;
      padding: 4% 6% 0;
      pointer-events: none;
      container-type: inline-size;
    }
    .glow {
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at 50% 30%, #fff6c47a, #ffd23f22 45%, transparent 70%);
    }
    .sparkle {
      position: absolute;
      width: 20px;
      height: 20px;
      margin: -10px 0 0 -10px;
      background: var(--paper);
      clip-path: polygon(50% 0, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0 50%, 39% 39%);
      opacity: 0;
    }
    .card {
      position: relative;
      display: grid;
      justify-items: center;
      gap: 2px;
      min-width: min(60%, 240px);
      max-width: 100%;
      padding: 8px 20px 10px;
      border: 3px solid var(--burst-edge, var(--sky-deep));
      border-radius: 22px;
      background: linear-gradient(180deg, var(--paper), var(--burst-ground, #e6f3ff));
      color: var(--ink);
      box-shadow:
        0 6px 0 var(--burst-shadow, #16467a),
        0 12px 28px #0005;
      text-align: center;
    }
    :host(.is-golden) .card,
    :host(.is-big) .card {
      border-color: var(--gold-deep);
      background: linear-gradient(180deg, var(--paper), var(--warm-ground));
      box-shadow:
        0 6px 0 #8a5a00,
        0 12px 28px #0006;
    }
    .rays {
      position: absolute;
      inset: -60% -30%;
      z-index: -1;
      background: repeating-conic-gradient(#ffffff88 0 10deg, transparent 10deg 30deg);
      mask-image: radial-gradient(circle, #000 25%, transparent 65%);
    }
    :host(.is-golden) .rays,
    :host(.is-big) .rays {
      background: repeating-conic-gradient(#ffd23f66 0 10deg, transparent 10deg 30deg);
    }
    .cheer {
      font-size: clamp(20px, 6.5cqi, 32px);
      line-height: 1.1;
      color: var(--burst-cheer, var(--sky-deep));
    }
    :host(.is-golden) .cheer,
    :host(.is-big) .cheer {
      color: var(--amber-ink);
    }
    .gain {
      font-size: clamp(17px, 5cqi, 24px);
      font-weight: 600;
      color: var(--amber-ink);
      font-variant-numeric: tabular-nums;
    }
    .badges {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 4px;
      margin-top: 2px;
    }
    .badge {
      padding: 2px 10px;
      border-radius: var(--radius-pill);
      background: var(--success-ground);
      color: var(--success-strong);
      font-size: clamp(14px, 4cqi, 18px);
      font-weight: 600;
    }

    @media (prefers-reduced-motion: no-preference) {
      .glow {
        animation: glow 1.4s ease-out both;
        animation-delay: var(--wait);
      }
      .sparkle {
        animation: sparkle 0.9s ease-out both;
        animation-delay: calc(var(--wait) + var(--at));
      }
      .card {
        animation: card-pop 0.5s cubic-bezier(0.3, 1.6, 0.5, 1) both;
        animation-delay: var(--wait);
      }
      .rays {
        animation: rays 6s linear infinite;
      }
      .badge {
        animation: badge-pop 0.4s cubic-bezier(0.3, 1.6, 0.5, 1) both;
        animation-delay: calc(var(--wait) + var(--at));
      }
    }
    @keyframes glow {
      from {
        opacity: 0;
      }
      20% {
        opacity: 1;
      }
      to {
        opacity: 0.35;
      }
    }
    @keyframes sparkle {
      from {
        opacity: 0;
        transform: scale(0.2) rotate(0deg);
      }
      35% {
        opacity: 1;
        transform: scale(1.3) rotate(45deg);
      }
      to {
        opacity: 0;
        transform: scale(0.6) rotate(90deg);
      }
    }
    @keyframes card-pop {
      from {
        opacity: 0;
        transform: translateY(-24px) scale(0.4);
      }
    }
    @keyframes rays {
      to {
        transform: rotate(1turn);
      }
    }
    @keyframes badge-pop {
      from {
        opacity: 0;
        transform: scale(0.3);
      }
    }
    :host-context(.calm-motion) .glow,
    :host-context(.calm-motion) .sparkle,
    :host-context(.calm-motion) .card,
    :host-context(.calm-motion) .rays,
    :host-context(.calm-motion) .badge {
      animation: none;
    }
  `,
})
export class RewardBurst {
  readonly kind = input<RewardBurstKind>('plain');
  readonly cheer = input.required<string>();
  /** The points line, already worded, like "+35 points". */
  readonly points = input.required<string>();
  /** Short bonus lines, already worded. */
  readonly badges = input<readonly string[]>([]);
  /** Seconds to wait before the burst shows. */
  readonly wait = input(0);
  protected readonly sparkles = SPARKLES;
}
