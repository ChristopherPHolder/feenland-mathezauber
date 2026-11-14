import { Component, inject, input } from '@angular/core';
import { LocaleService } from '../../core/locale';
import { CrocodileArt } from './crocodile-art';
import { crocodileText } from './crocodile-messages';
import { RuleHint } from './rule-hints';

/**
 * The rule card Kiki holds up after a wrong pick: a little picture of the rule with made-up piles,
 * never the numbers on screen, and one sentence. The child still does the maths.
 */
@Component({
  selector: 'app-rule-hint',
  imports: [CrocodileArt],
  template: `<span class="picture" aria-hidden="true" [attr.data-rule]="rule()">
      @switch (rule()) {
        @case ('ruleCountUp') {
          <svg viewBox="0 0 96 56" class="steps">
            <rect x="6" y="40" width="14" height="10" rx="3" />
            <rect x="26" y="32" width="14" height="18" rx="3" />
            <rect x="46" y="22" width="14" height="28" rx="3" />
            <rect x="66" y="10" width="14" height="40" rx="3" />
            <path d="M8 30 Q40 6 84 4" class="arrow" />
            <path d="M76 0 l9 4 -8 6" class="arrow" />
          </svg>
        }
        @case ('ruleWorkOut') {
          <span class="slate">?</span>
          <span class="croc"><app-crocodile kind="waiting" /></span>
          <span class="slate">?</span>
        }
        @case ('ruleTimes') {
          <svg viewBox="0 0 96 56" class="hops">
            <path d="M4 46 H92" class="line" />
            <path d="M8 44 Q22 14 36 44 M36 44 Q50 14 64 44 M64 44 Q78 14 92 44" class="arrow" />
            <circle cx="8" cy="46" r="4" />
            <circle cx="36" cy="46" r="4" />
            <circle cx="64" cy="46" r="4" />
            <circle cx="92" cy="46" r="4" />
          </svg>
        }
        @case ('ruleTens') {
          <svg viewBox="0 0 34 56" class="pile">
            <rect x="4" y="6" width="9" height="44" rx="3" class="ten" />
            <circle cx="24" cy="44" r="4.5" />
            <circle cx="24" cy="32" r="4.5" />
          </svg>
          <span class="croc"><app-crocodile facing="right" /></span>
          <svg viewBox="0 0 34 56" class="pile">
            <rect x="4" y="6" width="9" height="44" rx="3" class="ten" />
            <rect x="19" y="6" width="9" height="44" rx="3" class="ten" />
          </svg>
        }
        @default {
          <svg viewBox="0 0 34 56" class="pile">
            <circle cx="17" cy="44" r="6" />
            <circle cx="17" cy="30" r="6" />
          </svg>
          <span class="croc"><app-crocodile facing="right" /></span>
          <svg viewBox="0 0 34 56" class="pile">
            <circle cx="9" cy="44" r="6" />
            <circle cx="25" cy="44" r="6" />
            <circle cx="9" cy="30" r="6" />
            <circle cx="25" cy="30" r="6" />
            <circle cx="9" cy="16" r="6" />
            <circle cx="25" cy="16" r="6" />
          </svg>
        }
      }
    </span>
    <span class="words">
      <strong>{{ text('tryAgain') }}</strong>
      {{ text(rule()) }}
    </span>`,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: 12px;
      text-align: start;
      animation: rule-in 320ms cubic-bezier(0.2, 0.9, 0.3, 1.3);
    }
    .picture {
      flex: none;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      gap: 2px;
      width: 112px;
      height: 56px;
      padding: 4px 6px;
      border-radius: 12px;
      background: #fff;
      box-shadow: inset 0 0 0 2px #cfe1d4;
    }
    svg {
      height: 100%;
      fill: #f2a23a;
      stroke: #8a5200;
      stroke-width: 1.5;
    }
    .pile {
      width: 24px;
    }
    .steps,
    .hops {
      width: 100%;
    }
    .ten {
      fill: #5aa6d6;
      stroke: #1f5f8b;
    }
    .arrow,
    .line {
      fill: none;
      stroke: var(--pink-deep);
      stroke-width: 3;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .line {
      stroke: #8aa59a;
    }
    .croc {
      flex: 1;
      align-self: center;
      min-width: 0;
      max-width: 52px;
    }
    .slate {
      display: grid;
      place-items: center;
      align-self: center;
      width: 28px;
      height: 32px;
      border-radius: 8px;
      background: #eef6f0;
      box-shadow: inset 0 0 0 2px #2f8f5b;
      color: #1f6b43;
      font-weight: 700;
      font-size: 18px;
    }
    .words strong {
      display: block;
      color: var(--pink-deep);
    }
    @media (max-width: 420px) {
      :host {
        gap: 8px;
      }
      .picture {
        width: 84px;
        height: 44px;
      }
      .croc {
        max-width: 40px;
      }
      .slate {
        width: 22px;
        height: 26px;
        font-size: 15px;
      }
    }
    @media (min-width: 700px) and (min-height: 700px) {
      :host {
        gap: 16px;
      }
      .picture {
        width: 156px;
        height: 76px;
      }
      .pile {
        width: 32px;
      }
      .croc {
        max-width: 72px;
      }
      .slate {
        width: 38px;
        height: 44px;
        font-size: 24px;
      }
    }
    @keyframes rule-in {
      from {
        transform: scale(0.85);
        opacity: 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      :host {
        animation: none;
      }
    }
  `,
})
export class RuleHintCard {
  readonly rule = input.required<RuleHint>();
  private readonly i = inject(LocaleService);
  protected text(key: RuleHint | 'tryAgain') {
    return crocodileText(this.i.locale(), key);
  }
}
