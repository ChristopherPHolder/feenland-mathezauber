import { Component, input } from '@angular/core';

/** The three colours a dragon face is painted in. */
export interface DragonFaceColors {
  readonly body: string;
  readonly belly: string;
  readonly accent: string;
}

/**
 * A flat, decorative dragon face in the given colours. `form` 0 has little horn nubs, 1 longer
 * horns and 2 or more a second, swept-back pair.
 */
@Component({
  selector: 'ui-dragon-face',
  template: `<svg viewBox="0 0 40 40" aria-hidden="true">
    @if (form() >= grand) {
      <path d="M8 17 0 9l9 2zM32 17l8-8-9 2z" [attr.fill]="colors().accent" />
    }
    <path [attr.d]="horns[form()] ?? horns[0]" [attr.fill]="colors().accent" />
    <circle cx="20" cy="22" r="15" [attr.fill]="colors().body" />
    <ellipse cx="20" cy="29" rx="9" ry="6" [attr.fill]="colors().belly" />
    <circle cx="14" cy="19" r="4.4" fill="#fffefc" />
    <circle cx="26" cy="19" r="4.4" fill="#fffefc" />
    <circle cx="14.4" cy="19.6" r="2.7" fill="#2a2148" />
    <circle cx="26.4" cy="19.6" r="2.7" fill="#2a2148" />
    <circle cx="13.4" cy="18.2" r="0.9" fill="#fffefc" />
    <circle cx="25.4" cy="18.2" r="0.9" fill="#fffefc" />
    <circle cx="17.6" cy="27.4" r="0.9" fill="#2a2148" />
    <circle cx="22.4" cy="27.4" r="0.9" fill="#2a2148" />
    <ellipse cx="8.6" cy="25" rx="2.4" ry="1.5" fill="#ff9fbf" opacity="0.8" />
    <ellipse cx="31.4" cy="25" rx="2.4" ry="1.5" fill="#ff9fbf" opacity="0.8" />
  </svg>`,
  styles: `
    :host {
      display: inline-block;
      width: 1.8em;
      height: 1.8em;
    }
    svg {
      width: 100%;
      height: 100%;
      display: block;
      overflow: visible;
    }
  `,
})
export class DragonFace {
  readonly colors = input.required<DragonFaceColors>();
  readonly form = input(0);
  protected readonly grand = 2;
  /** Little horn nubs on a baby, longer ones on the young form, swept-back ones on the final. */
  protected readonly horns = [
    'M10 13 7 3l9 6zM30 13l3-10-9 6z',
    'M10 12 5-2l11 9zM30 12l5-14-11 9z',
    'M11 11 2-4l13 10zM29 11l9-15-13 10z',
  ];
}
