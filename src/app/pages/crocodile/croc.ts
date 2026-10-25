import { Component, input } from '@angular/core';
/** Kiki, the friendly crocodile. Facing shows which side she wants to eat. */
@Component({
  selector: 'app-croc',
  template: `<svg
    viewBox="0 0 130 90"
    [class.flip]="facing() === 'left'"
    [class.open]="facing() !== 'equal' && mood() !== 'oops'"
    [class.chomp]="mood() === 'chomp'"
    [class.happy]="mood() === 'happy'"
    [class.oops]="mood() === 'oops'"
    aria-hidden="true"
  >
    <path class="skin" d="M3 60c6-12 16-18 29-14l0 24c-13 4-23-2-29-10z" />
    <circle class="scale" cx="14" cy="52" r="3" />
    <ellipse class="skin" cx="40" cy="60" rx="24" ry="16" />
    <circle class="scale" cx="30" cy="47" r="3.5" />
    <circle class="scale" cx="42" cy="45" r="3.5" />
    <ellipse class="belly" cx="42" cy="66" rx="16" ry="8" />
    <ellipse class="foot" cx="28" cy="76" rx="8" ry="4" />
    <ellipse class="foot" cx="50" cy="76" rx="8" ry="4" />
    <g class="jaw upper">
      <path class="skin" d="M56 44c6-4 50-6 66 2 4 2 4 6 0 8l-66 4z" />
      <path class="teeth" d="M72 56l3 5 3-5 3 5 3-5 3 5 3-5 3 5 3-5 3 5 3-5" />
      <circle class="eye" cx="70" cy="40" r="7" />
      <circle class="pupil" cx="72" cy="40" r="3" />
      <circle class="nostril" cx="116" cy="48" r="1.6" />
    </g>
    <g class="jaw lower">
      <path class="skin dark" d="M56 58l66-4c4 0 5 5 1 7-16 8-60 8-67 4z" />
      <path class="smile" d="M90 60q10 6 24 2" />
    </g>
    <g class="hearts">
      <path d="M100 28c2-4 8-3 8 1 0 3-5 6-8 8-3-2-8-5-8-8 0-4 6-5 8-1z" />
      <path d="M84 20c1.5-3 6-2 6 1 0 2-4 4-6 6-2-2-6-4-6-6 0-3 4.5-4 6-1z" />
    </g>
  </svg>`,
  styles: `
    :host {
      display: block;
      width: 100%;
    }
    svg {
      display: block;
      width: 100%;
      height: auto;
      overflow: visible;
    }
    svg.flip {
      transform: scaleX(-1);
    }
    .skin {
      fill: #5fae5c;
      stroke: #2d6b36;
      stroke-width: 2;
      stroke-linejoin: round;
    }
    .skin.dark {
      fill: #4e9a4d;
    }
    .scale,
    .foot {
      fill: #3f8a44;
    }
    .belly {
      fill: #d9ec9f;
    }
    .teeth {
      fill: #ffffff;
      stroke: #2d6b36;
      stroke-width: 1.2;
      stroke-linejoin: round;
    }
    .eye {
      fill: #ffffff;
      stroke: #2d6b36;
      stroke-width: 1.5;
    }
    .pupil {
      fill: #172555;
    }
    .nostril {
      fill: #2d6b36;
    }
    .smile {
      fill: none;
      stroke: #2d6b36;
      stroke-width: 1.8;
      stroke-linecap: round;
      opacity: 0;
    }
    .hearts {
      fill: #e0457b;
      opacity: 0;
    }
    .jaw {
      transform-box: view-box;
      transform-origin: 57px 56px;
      transition: transform 0.25s ease-out;
    }
    .open .upper {
      transform: rotate(-26deg);
    }
    .open .lower {
      transform: rotate(22deg);
    }
    .chomp .upper {
      animation: chomp-upper 0.9s ease-in-out;
    }
    .chomp .lower {
      animation: chomp-lower 0.9s ease-in-out;
    }
    .happy .smile,
    .happy .hearts {
      opacity: 1;
    }
    .happy .hearts {
      animation: float 1.2s ease-out;
    }
    .oops {
      animation: wobble 0.5s ease-in-out;
    }
    .oops .pupil {
      transform: translate(-2px, 1px);
    }
    @keyframes chomp-upper {
      0%,
      100% {
        transform: rotate(-26deg);
      }
      35%,
      55% {
        transform: rotate(0deg);
      }
    }
    @keyframes chomp-lower {
      0%,
      100% {
        transform: rotate(22deg);
      }
      35%,
      55% {
        transform: rotate(0deg);
      }
    }
    @keyframes float {
      from {
        transform: translateY(6px);
        opacity: 0;
      }
      to {
        transform: translateY(-4px);
        opacity: 1;
      }
    }
    @keyframes wobble {
      0%,
      100% {
        transform: rotate(0);
      }
      25% {
        transform: rotate(-5deg);
      }
      75% {
        transform: rotate(5deg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .jaw,
      .hearts,
      svg {
        transition: none !important;
        animation: none !important;
      }
    }
  `,
})
export class Croc {
  readonly facing = input<'left' | 'right' | 'equal'>('right');
  readonly mood = input<'idle' | 'chomp' | 'happy' | 'oops'>('idle');
}
