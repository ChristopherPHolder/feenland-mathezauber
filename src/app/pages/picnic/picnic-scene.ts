import { Component, computed, input } from '@angular/core';
import { PicnicFace } from './picnic-face';
import { PicnicFood } from './picnic-food';
import type { PicnicFrame } from './picnic-frame';

/**
 * The flat picnic: the meadow, the blanket with the guests behind it, the food in the middle,
 * the ant line marching in from the right and the friends who joined on a little back blanket.
 * It is what devices without WebGL (and the tests) see in place of the 3D picnic.
 */
@Component({
  selector: 'app-picnic-scene',
  imports: [PicnicFace, PicnicFood],
  host: {
    'aria-hidden': 'true',
    '[class.golden]': 'frame().golden',
    '[class.served]': 'frame().served',
    '[class.finished]': 'frame().finished',
  },
  template: `
    <div class="sky"></div>
    <div class="hill"></div>
    @if (frame().joined.length) {
      <div class="joined">
        @for (friend of frame().joined; track friend) {
          <app-picnic-face [kind]="friend" />
        }
      </div>
    }
    <div class="guests">
      @for (guest of frame().guests; track $index) {
        <app-picnic-face [kind]="guest" [class.munch]="frame().served" [style.--i]="$index" />
      }
    </div>
    <div class="blanket">
      <div class="foods">
        @for (food of frame().foods; track $index) {
          @if (food.covered) {
            <span class="cloth"></span>
          } @else {
            <app-picnic-food
              class="food"
              [class.strip]="food.food === 'bar' || food.food === 'ribbon'"
              [food]="food.food"
              [sizes]="food.sizes"
              [shaded]="food.shaded"
              [apart]="frame().served"
            />
          }
        }
        @if (frame().berries; as berries) {
          <svg class="basket" viewBox="0 0 60 40">
            <path d="M4 14h52l-6 24H10z" />
            @for (b of berryDots(); track $index) {
              <circle [attr.cx]="b.x" [attr.cy]="b.y" r="3" />
            }
          </svg>
        }
      </div>
    </div>
    @if (frame().ants !== null) {
      <div class="ants" [style.--walk]="frame().ants">
        @for (ant of antSlots; track ant) {
          <svg class="ant" viewBox="0 0 20 12" [style.--i]="ant">
            <circle cx="4" cy="7" r="3" />
            <circle cx="10" cy="7" r="2.4" />
            <circle cx="15.5" cy="6" r="3" />
            @if (ant === 0 && frame().crumbGone) {
              <rect class="crumb" x="12" y="-1" width="6" height="4" rx="1" />
            }
          </svg>
        }
      </div>
    }
    @if (frame().golden) {
      <svg class="spoon" viewBox="0 0 24 60">
        <ellipse cx="12" cy="12" rx="10" ry="12" />
        <rect x="9" y="22" width="6" height="36" rx="3" />
      </svg>
    }
    @if (frame().served) {
      <div class="hearts">
        @for (h of [0, 1, 2]; track h) {
          <span class="heart" [style.--i]="h">♥</span>
        }
      </div>
    }
  `,
  styleUrl: './picnic-scene.css',
})
export class PicnicScene {
  readonly frame = input.required<PicnicFrame>();
  protected readonly antSlots = [0, 1, 2, 3, 4];
  protected readonly berryDots = computed(() => {
    const left = Math.min(30, this.frame().berries?.basket ?? 0);
    return Array.from({ length: left }, (_, index) => ({
      x: 10 + (index % 10) * 4.4,
      y: 32 - Math.floor(index / 10) * 6,
    }));
  });
}
