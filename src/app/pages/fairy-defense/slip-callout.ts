import { Component, input } from '@angular/core';

export type SlipKind =
  'wrong' | 'time' | 'heart' | 'cheer' | 'shield' | 'wave' | 'practice' | 'boss';

/**
 * A big speech bubble over the battlefield: who is coming at the start of a wave, a cheer for a
 * right spell, or what went wrong after a slip (a wrong spell, the ring running out, a lost heart), never the answer. Screen readers already hear the full
 * message from the live region, so the bubble itself is hidden from them.
 */
@Component({
  selector: 'app-slip-callout',
  template: `<span class="bubble">{{ text() }}</span>`,
  host: {
    'aria-hidden': 'true',
    '[class.is-heart]': "kind() === 'heart'",
    '[class.is-time]': "kind() === 'time'",
    '[class.is-cheer]': "kind() === 'cheer' || kind() === 'shield'",
    '[class.is-go]': "kind() === 'wave' || kind() === 'practice'",
    '[class.is-boss]': "kind() === 'boss'",
  },
  styles: `
    :host {
      position: absolute;
      z-index: 6;
      inset-inline: 12px;
      bottom: clamp(14px, 4vmin, 32px);
      display: flex;
      justify-content: center;
      pointer-events: none;
    }
    .bubble {
      max-width: 100%;
      padding: 0.45em 1.1em;
      border: 3px solid #fffaf0;
      border-radius: 999px;
      background: #7a2350;
      color: #fff;
      font-size: clamp(1.15rem, 0.8rem + 2.2vmin, 1.9rem);
      font-weight: 700;
      line-height: 1.2;
      text-align: center;
      box-shadow: 0 6px 18px #2a0d1f66;
      animation: slip-pop 380ms cubic-bezier(0.3, 1.6, 0.5, 1) both;
    }
    :host(.is-time) .bubble {
      background: #8a4300;
    }
    :host(.is-cheer) .bubble {
      background: #146b4a;
      animation-name: slip-pop, cheer-bounce;
      animation-duration: 380ms, 600ms;
      animation-delay: 0s, 380ms;
    }
    :host(.is-go) .bubble {
      background: #ffd95e;
      color: #152f4a;
    }
    :host(.is-boss) .bubble {
      background: #4b2a8a;
      animation-name: slip-pop, slip-shake;
      animation-duration: 380ms, 420ms;
      animation-delay: 0s, 380ms;
    }
    :host(.is-heart) .bubble {
      background: #a3122f;
      animation-name: slip-pop, slip-shake;
      animation-duration: 380ms, 420ms;
      animation-delay: 0s, 380ms;
    }
    @keyframes slip-pop {
      from {
        transform: scale(0.4) translateY(30%);
        opacity: 0;
      }
    }
    @keyframes cheer-bounce {
      40% {
        transform: translateY(-10px) scale(1.06);
      }
    }
    @keyframes slip-shake {
      25% {
        transform: translateX(-6px) rotate(-2deg);
      }
      75% {
        transform: translateX(6px) rotate(2deg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .bubble {
        animation: none;
      }
    }
  `,
})
export class SlipCallout {
  readonly kind = input.required<SlipKind>();
  readonly text = input.required<string>();
}
