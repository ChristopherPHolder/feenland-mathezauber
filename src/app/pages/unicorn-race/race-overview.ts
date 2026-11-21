import { Component, computed, input } from '@angular/core';
import { RacerId, RacerState, standings } from './race';
import { RacerArt } from './racer-art';
import { Horse, LUMI } from './horse';
/** The least room between two badges on the rail, as a share of its length. */
const BADGE_GAP = 0.09;
/**
 * Keeps badges from sitting on top of each other. Takes positions along the rail (0 to 1)
 * from last place to first and nudges them apart, never changing their order and never
 * leaving the rail, so four ponies on the start line or on the finish line stand side by side.
 */
export function spreadBadges(sorted: readonly number[], gap = BADGE_GAP): number[] {
  const shown: number[] = [];
  sorted.forEach((value, index) =>
    shown.push(index ? Math.max(value, shown[index - 1] + gap) : value),
  );
  let limit = 1;
  for (let index = shown.length - 1; index >= 0; index--) {
    shown[index] = Math.min(shown[index], limit);
    limit = shown[index] - gap;
  }
  return shown;
}
/**
 * The progress rail above the track: one line from the start to the flag with a round badge
 * per racer on it, Lumi's the biggest. Once the race is running each badge carries its place,
 * so who is ahead reads at a glance without covering the track.
 */
@Component({
  selector: 'app-race-overview',
  imports: [RacerArt],
  template: `
    <div class="rail" aria-hidden="true">
      <span class="line"></span>
      <span class="flag"></span>
      @for (marker of markers(); track marker.id) {
        <span
          [class]="'marker is-' + marker.id"
          [class.me]="marker.id === 'player'"
          [style.--p]="marker.shown"
          [style.z-index]="marker.layer"
        >
          <app-racer [kind]="marker.id" [horse]="horse()" bust />
          @if (started()) {
            <span class="place">{{ marker.place }}</span>
          }
        </span>
      }
    </div>
    <ol class="standings" [attr.aria-label]="title()">
      @for (entry of order(); track entry.id) {
        <li class="entry">
          @if (started()) {
            <span class="pos">{{ placeLabels()[entry.place] }}</span>
          }
          <span class="name">{{ names()[entry.id] }}</span
          ><span>, {{ labels()[entry.id] }}</span>
        </li>
      }
    </ol>
  `,
  styles: `
    :host {
      display: block;
      container-type: inline-size;
      padding: 3px 4px 7px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.62);
      box-shadow: var(--shadow-rest);
    }
    .rail {
      position: relative;
      height: clamp(36px, 9.5cqi, 48px);
      margin: 0 clamp(56px, 13.5cqi, 74px) 0 clamp(22px, 5.5cqi, 32px);
    }
    .line {
      position: absolute;
      left: -12px;
      right: clamp(-38px, -7.5cqi, -28px);
      top: 50%;
      height: 10px;
      translate: 0 -50%;
      border-radius: 5px;
      background: linear-gradient(90deg, #ff8fb8, #ffd36b, #7ddf9b, #7cc7ff, #b79bff);
      box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.7);
    }
    .flag {
      position: absolute;
      left: calc(100% + clamp(30px, 8cqi, 40px));
      top: 50%;
      width: 16px;
      height: 13px;
      translate: 0 -100%;
      background:
        repeating-conic-gradient(#26224a 0 25%, #fff 0 50%) 0 0 / 8px 8px,
        #fff;
      border: 1px solid #26224a;
      border-radius: 2px;
    }
    .flag::after {
      content: '';
      position: absolute;
      left: -3px;
      top: -2px;
      width: 2px;
      height: 26px;
      border-radius: 1px;
      background: #26224a;
    }
    .marker {
      --size: clamp(24px, 6.6cqi, 34px);
      --ring: #b9a3ef;
      position: absolute;
      left: calc(var(--p) * 100%);
      top: 50%;
      width: var(--size);
      height: var(--size);
      translate: -50% -50%;
      border-radius: 50%;
      background: #fff;
      box-shadow:
        0 0 0 2.5px var(--ring),
        0 2px 4px rgba(38, 34, 74, 0.3);
      transition: left 0.12s linear;
    }
    .marker app-racer {
      display: block;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      overflow: hidden;
    }
    .marker.me {
      --size: clamp(30px, 8.4cqi, 44px);
      --ring: #ffc94d;
      box-shadow:
        0 0 0 3px var(--ring),
        0 0 0 4.5px #4b3a70,
        0 2px 5px rgba(38, 34, 74, 0.35);
    }
    .marker.is-mint {
      --ring: #7fcf9f;
    }
    .marker.is-peach {
      --ring: #f0b48e;
    }
    .marker.is-storm {
      --ring: #6b739e;
    }
    .marker.is-shadow {
      --ring: #b09cf2;
    }
    .place {
      position: absolute;
      left: 50%;
      bottom: -8px;
      translate: -50% 0;
      min-width: 16px;
      height: 16px;
      padding: 0 3px;
      border-radius: 999px;
      background: #4b3a70;
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      line-height: 16px;
      text-align: center;
      box-shadow: 0 0 0 1.5px #fff;
    }
    .marker.me .place {
      background: #ffd36b;
      color: #4b3a70;
    }
    /* The standings are read out; the rail shows the same thing to the eye. */
    .standings {
      position: absolute;
      width: 1px;
      height: 1px;
      margin: 0;
      padding: 0;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
      list-style: none;
    }
    @media (prefers-reduced-motion: reduce) {
      .marker {
        transition: none;
      }
    }
  `,
})
export class RaceOverview {
  readonly racers = input.required<readonly RacerState[]>();
  /** Track units from start to finish. */
  readonly length = input.required<number>();
  readonly names = input.required<Readonly<Record<RacerId, string>>>();
  /** Spoken description per racer (name and how far along it is). */
  readonly labels = input.required<Readonly<Record<RacerId, string>>>();
  readonly placeLabels = input.required<Readonly<Record<1 | 2 | 3 | 4, string>>>();
  readonly title = input.required<string>();
  /** False on the start line, where everyone is level and a place would mean nothing. */
  readonly started = input(false);
  /** The child's horse, so its badge and its shadow's look like it. */
  readonly horse = input<Horse>(LUMI);
  protected readonly order = computed(() => standings({ racers: this.racers() }));
  protected readonly markers = computed(() => {
    const racers = this.racers();
    // Last place first, so the badges are spread in the order they run.
    const trailing = [...this.order()].reverse();
    const shown = spreadBadges(
      trailing.map((entry) =>
        Math.min(1, racers.find((racer) => racer.id === entry.id)!.position / this.length()),
      ),
    );
    return trailing.map((entry, index) => ({
      id: entry.id,
      place: entry.place,
      shown: shown[index],
      // Lumi always on top, then whoever is further ahead.
      layer: entry.id === 'player' ? 9 : index + 1,
    }));
  });
}
