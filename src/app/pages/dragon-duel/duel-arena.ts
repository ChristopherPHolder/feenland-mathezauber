import { Component, computed, input } from '@angular/core';
import { DragonFace } from '@feenland/ui';
import type { ArenaFrame } from './duel-frame';
import { ATTACK_COLORS, SPRITE_LOOKS } from './duel-looks';

/**
 * The flat duel arena, for devices without WebGL and for the tests: the dragon's portrait on
 * the left, the sprite drawn in its colours on the right. Each hit sends a ball of the dragon's
 * element across, each zap flashes a bolt back, a beaten sprite pops away and a lost duel
 * shows the dragon asleep. Decorative only: the game's text says the same.
 */
@Component({
  selector: 'app-duel-arena',
  imports: [DragonFace],
  host: { 'aria-hidden': 'true', '[attr.data-sky]': 'frame().sky' },
  template: `
    <svg class="ground" viewBox="0 0 400 240" preserveAspectRatio="xMidYMax slice">
      <ellipse cx="200" cy="232" rx="260" ry="70" class="grass" />
      <ellipse cx="200" cy="214" rx="150" ry="22" class="path" />
      <circle cx="40" cy="150" r="38" class="tree" />
      <circle cx="360" cy="146" r="42" class="tree" />
      <circle cx="94" cy="140" r="30" class="tree far" />
      <circle cx="304" cy="138" r="30" class="tree far" />
    </svg>
    <div class="dragon" [class.is-napping]="frame().phase === 'napping'">
      @if (picture(); as src) {
        <img [src]="src" width="256" height="256" alt="" />
      } @else {
        <ui-dragon-face [colors]="frame().dragon" [form]="frame().form" />
      }
      @if (frame().phase === 'napping') {
        <span class="zees">z z z</span>
      }
    </div>
    <div
      class="sprite"
      [class.is-gone]="frame().phase === 'won'"
      [class.is-boss]="frame().sprite === 'grumble'"
      [style.--glow]="frame().phase === 'fighting' ? frame().charge : 0"
    >
      @for (hit of [frame().hits]; track hit) {
        <svg viewBox="0 0 100 110" [class.is-hit]="hit > 0">
          <g class="trim" [attr.fill]="look().trim">
            <circle cx="30" cy="22" r="12" />
            <circle cx="50" cy="14" r="14" />
            <circle cx="70" cy="22" r="12" />
          </g>
          <ellipse cx="50" cy="62" rx="40" ry="38" [attr.fill]="look().body" />
          <ellipse cx="50" cy="74" rx="24" ry="18" [attr.fill]="look().belly" />
          <circle cx="37" cy="54" r="9" fill="#fffefc" />
          <circle cx="63" cy="54" r="9" fill="#fffefc" />
          <circle cx="38" cy="56" r="5" fill="#2a2148" />
          <circle cx="62" cy="56" r="5" fill="#2a2148" />
          <path d="M28 40l16 5M72 40l-16 5" stroke="#2a2148" stroke-width="4" />
          <path d="M40 72q10 8 20 0" stroke="#2a2148" stroke-width="4" fill="none" />
        </svg>
      }
    </div>
    @for (hit of [frame().hits]; track hit) {
      @if (hit > 0) {
        <span class="shot" [class.is-big]="frame().big" [style.--shot]="shotColor()"></span>
      }
    }
    @for (zap of [frame().zaps]; track zap) {
      @if (zap > 0) {
        <svg class="bolt" viewBox="0 0 200 40" preserveAspectRatio="none">
          <path d="M196 12 150 26 110 8 70 30 30 10 4 24" />
        </svg>
      }
    }
  `,
  styles: `
    :host {
      position: relative;
      display: block;
      height: 100%;
      min-height: 160px;
      overflow: hidden;
      border-radius: inherit;
      --sky-top: #cfeaff;
      --sky-low: #fdf6ff;
      background: linear-gradient(var(--sky-top), var(--sky-low));
    }
    :host([data-sky='dusk']) {
      --sky-top: #ffb9a3;
      --sky-low: #ffe6c9;
    }
    :host([data-sky='night']) {
      --sky-top: #1d2557;
      --sky-low: #5b4f9a;
    }
    .ground {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
    }
    .grass {
      fill: #8fd28a;
    }
    .path {
      fill: #e9dcb8;
    }
    .tree {
      fill: #5bb860;
    }
    .tree.far {
      fill: #79c46f;
    }
    .dragon,
    .sprite {
      position: absolute;
      bottom: 8%;
      width: 34%;
      aspect-ratio: 1;
      display: grid;
      place-items: end center;
    }
    .dragon {
      left: 8%;
    }
    .dragon img {
      width: 100%;
      height: auto;
      transform: scaleX(-1);
    }
    .dragon ui-dragon-face {
      width: 78%;
      height: 78%;
    }
    .dragon.is-napping {
      transform: rotate(14deg);
      filter: saturate(0.7);
    }
    .zees {
      position: absolute;
      top: 0;
      right: 0;
      color: #5b4a9a;
      font-weight: 600;
      font-size: 22px;
    }
    .sprite {
      right: 8%;
      width: 28%;
    }
    .sprite.is-boss {
      width: 34%;
    }
    .sprite svg {
      width: 100%;
      height: 100%;
      overflow: visible;
      filter: drop-shadow(0 0 calc(var(--glow) * 18px) #ffd43f);
    }
    .sprite.is-gone {
      opacity: 0;
      transform: scale(0.2) rotate(90deg);
      transition:
        opacity 0.6s 0.4s,
        transform 0.6s 0.4s;
    }
    .shot {
      position: absolute;
      left: 34%;
      bottom: 34%;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: radial-gradient(circle, #fffefc, var(--shot) 55%);
      box-shadow: 0 0 14px var(--shot);
      opacity: 0;
    }
    .shot.is-big {
      width: 38px;
      height: 38px;
    }
    .bolt {
      position: absolute;
      left: 32%;
      bottom: 34%;
      width: 40%;
      height: 16%;
      opacity: 0;
    }
    .bolt path {
      fill: none;
      stroke: #ffd43f;
      stroke-width: 5;
      stroke-linejoin: round;
    }
    @media (prefers-reduced-motion: no-preference) {
      .shot {
        animation: fly 0.55s ease-in both;
      }
      .sprite svg.is-hit {
        animation: reel 0.5s 0.5s ease-out;
      }
      .bolt {
        animation: flash 0.5s ease-out both;
      }
    }
    @keyframes fly {
      0% {
        opacity: 1;
        transform: translate(0, 0);
      }
      50% {
        transform: translate(70%, -60%);
      }
      95% {
        opacity: 1;
      }
      100% {
        opacity: 0;
        transform: translate(min(36vw, 420px), 0);
      }
    }
    @keyframes reel {
      30% {
        transform: translateX(10%) rotate(10deg);
      }
      60% {
        transform: translateX(-4%) rotate(-6deg);
      }
    }
    @keyframes flash {
      0%,
      60% {
        opacity: 1;
      }
      100% {
        opacity: 0;
      }
    }
    :host-context(.calm-motion) .shot,
    :host-context(.calm-motion) .sprite svg,
    :host-context(.calm-motion) .bolt {
      animation: none;
    }
  `,
})
export class DuelArena {
  readonly frame = input.required<ArenaFrame>();
  /** The dragon's portrait, when the hatchery has drawn one. */
  readonly picture = input<string | undefined>(undefined);
  protected readonly look = computed(() => SPRITE_LOOKS[this.frame().sprite]);
  protected readonly shotColor = computed(() => ATTACK_COLORS[this.frame().dragon.element][0]);
}
