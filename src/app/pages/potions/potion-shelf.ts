import { Component, computed, input } from '@angular/core';
import { liquid, PotionFrame, shelfSpot } from './potion-frame';

/**
 * The cauldron drawn flat: Olli, the cauldron with its potion number and the bottles on the
 * shelf. It is the picture on the intro and outcome, and the scene wherever 3D is missing.
 * Decorative only: the game's buttons and live text carry the same information.
 */
@Component({
  selector: 'app-potion-shelf',
  template: `<svg viewBox="0 0 360 270" aria-hidden="true">
    <ellipse class="glow" cx="180" cy="128" rx="120" ry="70" />
    <g class="owl">
      <path class="perch" d="M26 160h62" />
      <ellipse class="owl-body" cx="57" cy="132" rx="22" ry="27" />
      <path class="owl-ear" d="M38 112l4-14 9 9zM76 112l-4-14-9 9z" />
      <circle class="owl-eye" cx="48" cy="122" r="8" />
      <circle class="owl-eye" cx="66" cy="122" r="8" />
      <circle class="owl-pupil" cx="49" cy="123" r="3.5" />
      <circle class="owl-pupil" cx="65" cy="123" r="3.5" />
      <path class="owl-beak" d="M54 129h6l-3 6z" />
      <path class="owl-belly" d="M46 142q11 12 22 0" />
    </g>
    <g class="cauldron" [class.brewed]="frame().brewed" [class.fizzing]="frame().fizzing">
      <path class="fire" d="M150 196q8-24 14-6q6-22 16-2q8-22 16 0q6-18 14 8z" />
      <path class="pot" d="M112 104h136q4 70-40 84h-56q-44-14-40-84z" />
      <ellipse class="rim" cx="180" cy="104" rx="72" ry="14" />
      <ellipse class="brew" [class.fever]="frame().fever" cx="180" cy="104" rx="62" ry="10" />
      <circle class="bubble" cx="160" cy="98" r="5" />
      <circle class="bubble" cx="196" cy="96" r="4" />
      <circle class="bubble" cx="182" cy="90" r="3" />
    </g>
    <g class="sign">
      <rect x="146" y="22" width="68" height="46" rx="14" />
      <text x="180" y="47">{{ frame().target }}</text>
      @if (frame().sparkle === 'shining') {
        <path class="sparkle" d="m224 18 4 10 10 4-10 4-4 10-4-10-10-4 10-4z" />
      }
    </g>
    <path class="shelf" d="M14 252h332" />
    @for (bottle of frame().brewed ? [] : spots(); track bottle.id) {
      <g
        class="bottle"
        [class.picked]="bottle.id === frame().picked"
        [attr.transform]="
          'translate(' + bottle.x + ' ' + (bottle.id === frame().picked ? 200 : 214) + ')'
        "
      >
        <path class="glass" d="M-7-34h14v14q20 8 20 26a27 27 0 0 1-54 0q0-18 20-26z" />
        <path class="liquid" [attr.fill]="bottle.color" d="M-24 4h48a24 22 0 0 1-48 0z" />
        <rect class="cork" x="-8" y="-42" width="16" height="9" rx="3" />
        <rect class="tag" x="-19" y="-14" width="38" height="24" rx="8" />
        <text y="-1">{{ bottle.value }}</text>
      </g>
    }
  </svg>`,
  styleUrl: './potion-shelf.css',
})
export class PotionShelf {
  readonly frame = input.required<PotionFrame>();
  protected readonly spots = computed(() => {
    const bottles = this.frame().bottles;
    return bottles.map((bottle, index) => ({
      ...bottle,
      x: 30 + 300 * shelfSpot(index, bottles.length),
      color: liquid(bottle.id),
    }));
  });
}
