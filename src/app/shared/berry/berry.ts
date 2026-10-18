import { Component } from '@angular/core';

@Component({
  selector: 'app-berry',
  host: { 'aria-hidden': 'true' },
  template: `<svg viewBox="0 0 48 52" fill="none">
    <path d="M7 20C5 35 17 48 24 49c7-1 19-14 17-29-2-14-32-14-34 0Z" fill="#db3965" />
    <path d="m24 17-14-6 10-2 4-8 4 8 10 2-14 6Z" fill="#35845c" />
    <path
      d="m16 24 1 3m13-3 1 3m-8 5 1 3m-8-1 1 3m13-3 1 3m-8 4 1 2"
      stroke="#fff2c6"
      stroke-width="2.4"
      stroke-linecap="round"
    />
  </svg>`,
  styles: `
    :host {
      display: inline-block;
      width: 34px;
      height: 37px;
    }
    svg {
      width: 100%;
      height: 100%;
    }
  `,
})
export class Berry {}
