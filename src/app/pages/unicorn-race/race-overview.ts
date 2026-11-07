import { Component, computed, input } from '@angular/core';
import { RacerId, RacerState, standings, TRACK_LENGTH } from './race';
import { RacerArt } from './racer-art';
/**
 * The bird's-eye strip above the track: one line from the start to the castle with every
 * racer's marker on it, and the standings leader first. Reads at a glance who is where.
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
          class="marker"
          [class.me]="marker.id === 'player'"
          [class.done]="marker.done"
          [style.--p]="marker.fraction"
          [style.--row]="marker.row"
        >
          <app-racer [kind]="marker.id" />
        </span>
      }
    </div>
    <ol class="standings" [attr.aria-label]="title()">
      @for (entry of order(); track entry.id) {
        <li [class.me]="entry.id === 'player'" [class]="'entry is-' + entry.id">
          <span class="pos">{{ placeLabels()[entry.place] }}</span>
          <app-racer class="mini" [kind]="entry.id" aria-hidden="true" />
          <span class="name">{{ names()[entry.id] }}</span>
          <span class="sr-only">, {{ labels()[entry.id] }}</span>
        </li>
      }
    </ol>
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: 6px 10px;
      padding: 6px 10px;
      border-radius: var(--radius-button);
      background: rgba(255, 255, 255, 0.78);
      box-shadow: var(--shadow-rest);
      backdrop-filter: blur(6px);
    }
    .rail {
      position: relative;
      height: 46px;
      margin: 0 22px 0 6px;
    }
    .line {
      position: absolute;
      left: 0;
      right: 0;
      top: 50%;
      height: 6px;
      margin-top: -3px;
      border-radius: 3px;
      background: linear-gradient(90deg, #ff8fb8, #ffd36b, #7ddf9b, #7cc7ff, #b79bff);
      opacity: 0.8;
    }
    .flag {
      position: absolute;
      right: -18px;
      top: 4px;
      width: 16px;
      height: 14px;
      background:
        repeating-conic-gradient(#26224a 0 25%, #fff 0 50%) 0 0 / 8px 8px,
        #fff;
      border: 1px solid #26224a;
      border-radius: 2px;
    }
    .flag::after {
      content: '';
      position: absolute;
      left: -2px;
      top: -1px;
      width: 2px;
      height: 38px;
      background: #26224a;
    }
    .marker {
      position: absolute;
      left: calc(var(--p) * 100%);
      top: calc(50% + (var(--row) - 1.5) * 9px);
      width: 36px;
      height: 26px;
      margin: -13px 0 0 -18px;
      transition: left 0.12s linear;
    }
    .marker app-racer {
      display: block;
      width: 36px;
      height: 26px;
      filter: drop-shadow(0 1px 1px rgba(38, 34, 74, 0.35));
    }
    .marker.me {
      z-index: 2;
      width: 44px;
      height: 32px;
      margin: -16px 0 0 -22px;
    }
    .marker.me app-racer {
      width: 44px;
      height: 32px;
    }
    .marker.done {
      opacity: 0.7;
    }
    .standings {
      display: flex;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .entry {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 8px 3px 4px;
      border-radius: 999px;
      background: var(--paper-veil);
      font-size: 13px;
      font-weight: 600;
      color: #26224a;
      white-space: nowrap;
    }
    .entry.me {
      background: #4b3a70;
      color: #fff;
    }
    .mini {
      display: block;
      width: 26px;
      height: 19px;
    }
    .pos {
      display: inline-grid;
      place-items: center;
      min-width: 22px;
      height: 22px;
      padding: 0 4px;
      border-radius: 999px;
      background: #fff;
      color: #4b3a70;
      font-size: 12px;
    }
    .entry.is-cloud .pos {
      background: #dccbff;
    }
    .entry.is-mint .pos {
      background: #cdf3dd;
    }
    .entry.is-peach .pos {
      background: #ffd8bb;
    }
    .entry.is-player .pos {
      background: #ffd36b;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
    @media (max-width: 560px) {
      :host {
        grid-template-columns: minmax(0, 1fr);
      }
      .standings {
        justify-content: space-between;
      }
      .entry {
        padding: 2px 6px 2px 3px;
        font-size: 12px;
      }
      .name {
        display: none;
      }
      .entry.me .name {
        display: inline;
      }
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
  readonly names = input.required<Readonly<Record<RacerId, string>>>();
  /** Spoken description per racer (name and how far along it is). */
  readonly labels = input.required<Readonly<Record<RacerId, string>>>();
  readonly placeLabels = input.required<Readonly<Record<1 | 2 | 3 | 4, string>>>();
  readonly title = input.required<string>();
  protected readonly markers = computed(() =>
    this.racers().map((racer, row) => ({
      id: racer.id,
      row,
      fraction: Math.min(1, racer.position / TRACK_LENGTH),
      done: racer.finishedAt !== undefined,
    })),
  );
  protected readonly order = computed(() => standings({ racers: this.racers() }));
}
