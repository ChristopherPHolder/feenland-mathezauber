import { Component, input } from '@angular/core';

export type FlickPose = 'stand' | 'light' | 'peek' | 'duck' | 'cheer';

/**
 * Flick the fox, the fireworks-maker, drawn flat: a sitting fox with a long snout, big ears, a
 * white chest, a bushy white-tipped tail, goggles pushed up and a scarf. Decorative only.
 */
@Component({
  selector: 'app-flick',
  template: `<svg viewBox="0 0 120 120" aria-hidden="true">
    <g class="fox" [attr.data-pose]="pose()">
      <path class="tail" d="M70 96c22 6 40-6 42-26 1-10-6-14-10-6-4 9-12 16-32 20z" />
      <path class="tail-tip" d="M102 64c4-8 11-4 10 6-1 6-4 11-8 14 2-7 1-14-2-20z" />
      <path class="body" d="M44 106c-6-20 0-44 18-50 16 4 22 26 18 50z" />
      <path class="chest" d="M54 104c-3-14 0-30 9-38 7 8 9 24 6 38z" />
      <path class="leg" d="M50 106v-14m26 14v-14" />
      <path class="paw" d="M45 107h10m16 0h10" />
      <g class="arm">
        <path class="limb" d="M74 72c8 2 14-2 18-8" />
        @if (pose() === 'cheer' || pose() === 'light') {
          <path class="stick" d="M92 64l6-14" />
          <circle class="sparkle" cx="98" cy="48" r="5" />
        }
        @if (pose() === 'peek') {
          <rect
            class="scope"
            x="78"
            y="30"
            width="22"
            height="8"
            rx="3"
            transform="rotate(-25 78 34)"
          />
        }
      </g>
      <g class="head">
        <path class="ear" d="M44 30 40 4l18 18zM74 26l12-22 2 26z" />
        <path class="ear-in" d="M45 26 43 11l9 10zM77 23l7-13 1 15z" />
        <path
          class="face"
          d="M38 34c4-10 14-14 24-14s20 6 22 16c2 10-6 16-14 18l-22 6c-8-4-12-14-10-26z"
        />
        <path class="snout" d="M40 42c-8 2-18 6-24 12 8 4 20 4 28 0z" />
        <path class="cheek" d="M46 52c6 4 16 4 24-2-4 8-14 12-22 8z" />
        <circle class="nose" cx="17" cy="54" r="3.5" />
        <circle class="eye" cx="48" cy="38" r="3.2" />
        <path class="goggles" d="M48 24h22" />
        <circle class="lens" cx="52" cy="24" r="5" />
        <circle class="lens" cx="66" cy="24" r="5" />
      </g>
      <path class="scarf" d="M46 58c10 6 24 6 32-2l2 8c-8 6-24 8-34 2z" />
      <path class="scarf-end" d="M74 62l8 16 6-4-6-14z" />
    </g>
  </svg>`,
  styles: `
    :host {
      display: block;
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
      overflow: visible;
    }
    .tail,
    .body,
    .face,
    .ear,
    .snout {
      fill: #e8792f;
    }
    .tail-tip,
    .chest,
    .cheek,
    .ear-in {
      fill: #fff4e6;
    }
    .ear-in {
      fill: #5a2d1a;
    }
    .leg,
    .paw,
    .limb {
      fill: none;
      stroke: #3b2016;
      stroke-width: 5;
      stroke-linecap: round;
    }
    .limb {
      stroke: #e8792f;
      stroke-width: 6;
    }
    .nose,
    .eye {
      fill: #23140f;
    }
    .goggles {
      stroke: #6b4a2e;
      stroke-width: 3;
    }
    .lens {
      fill: #9fe3ff;
      stroke: #6b4a2e;
      stroke-width: 2.5;
    }
    .scarf,
    .scarf-end {
      fill: #4aa3df;
    }
    .stick {
      stroke: #8a6a4a;
      stroke-width: 3;
      stroke-linecap: round;
    }
    .sparkle {
      fill: #ffe27a;
      filter: drop-shadow(0 0 4px #ffd45c);
    }
    .scope {
      fill: #c9a24a;
      stroke: #6b4a2e;
      stroke-width: 2;
    }
    .fox {
      transform-origin: 60px 110px;
      transform-box: view-box;
    }
    .fox[data-pose='duck'] {
      transform: scale(1.04, 0.9);
    }
    .fox[data-pose='cheer'] .arm {
      transform: rotate(-18deg);
      transform-origin: 74px 72px;
      transform-box: view-box;
    }
  `,
})
export class Flick {
  readonly pose = input<FlickPose>('stand');
}
