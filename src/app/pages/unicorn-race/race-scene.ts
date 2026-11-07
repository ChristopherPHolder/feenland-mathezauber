import { Component, computed, input } from '@angular/core';
import { RacerId, RacerState, TRACK_LENGTH } from './race';
import { RacerArt } from './racer-art';
/**
 * The race track: four cloud lanes across a fairyland sky, the rainbow castle at the finish,
 * and the racers moving along their lanes. Purely presentational; the page owns the race.
 */
@Component({
  selector: 'app-race-scene',
  imports: [RacerArt],
  templateUrl: './race-scene.html',
  styleUrls: ['./race-scene.css', './race-scene-motion.css'],
  host: {
    '[class.running]': 'running()',
    '[class.finished]': 'finished()',
    '[class.rainbow]': 'rainbow()',
    '[class.stumbling]': 'stumbling()',
    '[class.boost]': 'boost()',
    '[class.counting]': 'countdown() !== null',
    '[style.--speed]': 'speed()',
  },
})
export class RaceScene {
  readonly racers = input.required<readonly RacerState[]>();
  readonly names = input.required<Readonly<Record<RacerId, string>>>();
  /** Spoken description per racer (name and how far along it is). */
  readonly labels = input.required<Readonly<Record<RacerId, string>>>();
  readonly running = input(false);
  readonly stumbling = input(false);
  readonly rainbow = input(false);
  readonly finished = input(false);
  readonly countdown = input<string | null>(null);
  /** A short lunge right after a correct answer. */
  readonly boost = input(false);
  /** Lumi's current speed (0–8); the scenery scrolls faster with it. */
  readonly speed = input(0);
  protected readonly clouds = [0, 1, 2, 3, 4];
  protected readonly flowers = Array.from({ length: 14 }, (_, index) => index);
  protected readonly confetti = Array.from({ length: 16 }, (_, index) => index);
  protected readonly lanes = computed(() =>
    this.racers().map((racer) => ({
      ...racer,
      fraction: Math.min(1, racer.position / TRACK_LENGTH),
      percent: Math.round((100 * racer.position) / TRACK_LENGTH),
      moving:
        this.running() && racer.finishedAt === undefined && (racer.dash > 0 || racer.speed > 0),
    })),
  );
}
