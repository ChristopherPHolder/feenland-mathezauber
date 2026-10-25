import { Component, input } from '@angular/core';
/** Purely decorative pond life behind the numbers: ripples, bubbles, reeds, fish and the big fish. */
@Component({
  selector: 'app-pond-scene',
  template: `<span class="ripple r1"></span>
    <span class="ripple r2"></span>
    <span class="ripple r3"></span>
    <span class="bubble b1"></span>
    <span class="bubble b2"></span>
    <span class="bubble b3"></span>
    <span class="reed reed-left"></span>
    <span class="reed reed-right"></span>
    @if (boss()) {
      <svg class="big-fish" viewBox="0 0 120 60">
        <path d="M10 30 L34 12 L34 48z" />
        <ellipse cx="68" cy="30" rx="40" ry="22" />
        <circle cx="88" cy="24" r="4" fill="#fff" />
        <circle cx="89" cy="24" r="2" fill="#172555" />
        <path d="M56 12 Q68 2 80 12" fill="none" stroke="#1f5fa8" stroke-width="4" />
      </svg>
    }
    <span class="fishy f1"></span>
    <span class="fishy f2"></span>`,
  host: { 'aria-hidden': 'true' },
  styles: `
    :host {
      position: absolute;
      inset: 0;
      display: block;
      pointer-events: none;
      overflow: hidden;
    }
    .ripple {
      position: absolute;
      border: 2px solid #ffffff66;
      border-radius: 50%;
      width: 120px;
      height: 36px;
      animation: ripple 5s ease-out infinite;
    }
    .r1 {
      left: 8%;
      top: 70%;
    }
    .r2 {
      left: 60%;
      top: 14%;
      animation-delay: 1.6s;
    }
    .r3 {
      left: 38%;
      top: 80%;
      animation-delay: 3.2s;
    }
    .bubble {
      position: absolute;
      bottom: -20px;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #ffffff88;
      animation: rise 6s linear infinite;
    }
    .b1 {
      left: 20%;
    }
    .b2 {
      left: 50%;
      width: 8px;
      height: 8px;
      animation-delay: 2s;
    }
    .b3 {
      left: 78%;
      animation-delay: 4s;
    }
    .reed {
      position: absolute;
      bottom: -4px;
      width: 8px;
      height: 64px;
      border-radius: 8px 8px 0 0;
      background: #3a8f55;
      transform-origin: bottom;
      animation: sway 4s ease-in-out infinite;
    }
    .reed-left {
      left: 14px;
    }
    .reed-right {
      right: 22px;
      height: 48px;
      animation-delay: 1s;
    }
    .fishy {
      position: absolute;
      width: 26px;
      height: 14px;
      border-radius: 60% 40% 40% 60%;
      background: #f08a24aa;
      animation: swim-by 14s linear infinite;
    }
    .fishy::after {
      content: '';
      position: absolute;
      right: -8px;
      top: 1px;
      border-left: 9px solid #f08a24aa;
      border-top: 6px solid transparent;
      border-bottom: 6px solid transparent;
    }
    .f1 {
      top: 12%;
    }
    .f2 {
      top: 86%;
      animation-delay: 7s;
      animation-duration: 18s;
    }
    .big-fish {
      position: absolute;
      width: 180px;
      height: 90px;
      right: -40px;
      top: 10%;
      fill: #2b78c7;
      opacity: 0.55;
      animation: big-swim 9s ease-in-out infinite;
    }
    @keyframes ripple {
      0% {
        transform: scale(0.3);
        opacity: 0.9;
      }
      100% {
        transform: scale(1.6);
        opacity: 0;
      }
    }
    @keyframes rise {
      0% {
        transform: translateY(0);
        opacity: 0;
      }
      10% {
        opacity: 1;
      }
      100% {
        transform: translateY(-320px);
        opacity: 0;
      }
    }
    @keyframes sway {
      0%,
      100% {
        transform: rotate(-5deg);
      }
      50% {
        transform: rotate(5deg);
      }
    }
    @keyframes swim-by {
      0% {
        left: -40px;
      }
      100% {
        left: 110%;
      }
    }
    @keyframes big-swim {
      0%,
      100% {
        transform: translate(0, 0);
      }
      50% {
        transform: translate(-60px, 10px);
      }
    }
    @media (max-width: 640px) {
      .reed {
        display: none;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      * {
        animation: none !important;
      }
    }
  `,
})
export class PondScene {
  readonly boss = input(false);
}
