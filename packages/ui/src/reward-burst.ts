import { Component, input } from '@angular/core';

/** When the first tag pops into the card, and the gap to the next one, in seconds. */
const TAG_START = 0.35;
const TAG_STEP = 0.22;

/** Where the sparkles burst over the board, in percent, with their own little delay. */
const SPARKLES = [
  [18, 22, 0],
  [80, 18, 0.12],
  [12, 58, 0.24],
  [88, 52, 0.06],
  [30, 10, 0.3],
  [68, 8, 0.18],
  [50, 34, 0.42],
  [24, 40, 0.36],
  [76, 36, 0.48],
] as const;

/**
 * The burst over a game board after a win: a warm glow, sparkles, and a card with the cheer, a
 * tag for each bonus and the points won. It only shows; the game decides what it says. Screen
 * readers hear the same news from the game's status line, so it stays hidden from them.
 *
 * `tone` colours the card: `big` for a finale, `golden` during a streak. `delay` (seconds) holds
 * the burst back while a 3D scene plays its own move first.
 */
@Component({
  selector: 'ui-reward-burst',
  host: {
    'aria-hidden': 'true',
    '[class.is-big]': "tone() === 'big'",
    '[class.is-golden]': "tone() === 'golden'",
    '[style.--pour]': "delay() + 's'",
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
      @if (tags().length) {
        <ul class="tags">
          @for (tag of tags(); track tag) {
            <li class="tag" [style.--at]="tagAt($index) + 's'">{{ tag }}</li>
          }
        </ul>
      }
      <span class="gain" [style.--at]="tagAt(tags().length) + 's'">{{ points() }}</span>
    </div>
  `,
  styles: `
    :host {
      position: absolute;
      inset: 0;
      z-index: 2;
      display: grid;
      justify-items: center;
      align-items: end;
      padding: 0 6% 5%;
      pointer-events: none;
      container-type: inline-size;
    }
    .glow {
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at 50% 45%, #ffe9887a, #ffd23f26 45%, transparent 70%);
    }
    .sparkle {
      position: absolute;
      width: 22px;
      height: 22px;
      margin: -11px 0 0 -11px;
      background: #fff6bf;
      clip-path: polygon(50% 0, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0 50%, 39% 39%);
      opacity: 0;
    }
    .card {
      position: relative;
      display: grid;
      justify-items: center;
      gap: 2px;
      min-width: min(64%, 260px);
      max-width: 100%;
      padding: 10px 22px 12px;
      border: 3px solid var(--gold-deep);
      border-radius: 22px;
      background: linear-gradient(180deg, var(--paper), var(--warm-ground));
      color: var(--ink);
      box-shadow:
        0 6px 0 #8a5a00,
        0 12px 28px #0006;
      text-align: center;
    }
    .rays {
      position: absolute;
      inset: -60% -30%;
      z-index: -1;
      background: repeating-conic-gradient(#ffd23f66 0 10deg, transparent 10deg 30deg);
      mask-image: radial-gradient(circle, #000 25%, transparent 65%);
    }
    .cheer {
      font-size: clamp(22px, 7cqi, 34px);
      line-height: 1.1;
      color: var(--amber-ink);
    }
    :host(.is-big) .cheer {
      color: var(--pink-deep);
    }
    .tags {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 4px 6px;
      margin: 2px 0;
      padding: 0;
      list-style: none;
    }
    .tag {
      padding: 2px 10px;
      border-radius: var(--radius-pill);
      background: var(--sun);
      color: var(--ink);
      font-size: clamp(13px, 3.6cqi, 16px);
      font-weight: 600;
    }
    :host(.is-golden) .card {
      border-color: #e0a800;
      background: linear-gradient(180deg, #fff6c2, #ffd95a);
    }
    .gain {
      font-size: clamp(17px, 5cqi, 24px);
      font-weight: 600;
      color: var(--amber-ink);
      font-variant-numeric: tabular-nums;
    }
    @media (prefers-reduced-motion: no-preference) {
      .glow {
        animation: glow 1.4s ease-out both;
        animation-delay: var(--pour);
      }
      .sparkle {
        animation: sparkle 0.9s ease-out both;
        animation-delay: calc(var(--pour) + var(--at));
      }
      .card {
        animation: card-pop 0.5s cubic-bezier(0.3, 1.6, 0.5, 1) both;
        animation-delay: var(--pour);
      }
      .rays {
        animation: rays 6s linear infinite;
      }
      .tag {
        animation: key-pop 0.45s cubic-bezier(0.3, 1.8, 0.5, 1) both;
        animation-delay: calc(var(--pour) + var(--at));
      }
      .gain {
        animation: gain-rise 0.5s cubic-bezier(0.3, 1.5, 0.5, 1) both;
        animation-delay: calc(var(--pour) + var(--at));
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
        transform: translateY(30px) scale(0.4);
      }
    }
    @keyframes rays {
      to {
        transform: rotate(1turn);
      }
    }
    @keyframes key-pop {
      from {
        opacity: 0;
        transform: translateY(-14px) scale(0.2) rotate(-40deg);
      }
    }
    @keyframes gain-rise {
      from {
        opacity: 0;
        transform: translateY(14px) scale(0.6);
      }
    }
    :host-context(.calm-motion) :is(.glow, .sparkle, .card, .rays, .tag, .gain) {
      animation: none;
    }
  `,
})
export class RewardBurst {
  readonly cheer = input.required<string>();
  /** Bonus names, already worded: "First try", "Before the ants". */
  readonly tags = input<readonly string[]>([]);
  /** The points line, already worded, like "+30 points". */
  readonly points = input.required<string>();
  readonly tone = input<'plain' | 'big' | 'golden'>('plain');
  /** Seconds to wait before bursting, while a 3D scene finishes its own move. */
  readonly delay = input(0);

  protected readonly sparkles = SPARKLES;
  protected tagAt(index: number) {
    return TAG_START + index * TAG_STEP;
  }
}
