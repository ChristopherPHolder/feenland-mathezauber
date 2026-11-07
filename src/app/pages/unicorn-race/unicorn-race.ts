import {
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  linkedSignal,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CompletionService } from '../../core/completion';
import { LocaleService } from '../../core/locale';
import { MessageKey } from '../../core/messages';
import { ProgressService } from '../../core/progress';
import { GameHeader } from '../../shared/game-header';
import { Icon } from '../../shared/icon';
import {
  answer,
  createRace,
  finalSparkles,
  isMastered,
  isRainbow,
  Pace,
  paces,
  playerPlace,
  RaceState,
  racer,
  RacerId,
  racerIds,
  raceStars,
  tick,
  TRACK_LENGTH,
} from './race';
import { raceText, RaceMessageKey } from './race-messages';
import {
  RaceLevel,
  raceLevels,
  RaceQuestion,
  raceQuestion,
  raceStage,
  TOTAL_STAGES,
} from './race-questions';
import { RaceScene } from './race-scene';
import { RaceSounds } from './race-sounds';
import { RacerArt } from './racer-art';
import { Cup, cupFor, RaceStore } from './race-store';
type Phase = 'intro' | 'countdown' | 'racing' | 'finished';
type Feedback =
  | { readonly kind: 'idle' }
  | { readonly kind: 'gallop' }
  | { readonly kind: 'rainbow'; readonly streak: number }
  | { readonly kind: 'wrong' }
  | { readonly kind: 'wrongAgain' };
export const TICK_MS = 100;
const COUNT_MS = 800;
const FEEDBACK_MS = 900;
const FINISH_HOLD_MS = 1300;
const LOCK_MS = 350;
/**
 * The unicorn race: Lumi gallops against three friends to the rainbow castle. Right answers
 * speed her up, wrong ones make her stumble, and where she finishes decides the stars.
 */
@Component({
  selector: 'app-unicorn-race',
  imports: [RouterLink, Icon, GameHeader, RaceScene, RacerArt],
  providers: [RaceSounds],
  templateUrl: './unicorn-race.html',
  styleUrls: ['./unicorn-race.css', './race-intro.css', './race-play.css'],
  host: {
    '[class.playing]': 'phase() !== "intro"',
    '(document:keydown)': 'onKey($event)',
    '(document:visibilitychange)': 'visibilityChanged()',
  },
})
export class UnicornRace {
  protected readonly i = inject(LocaleService);
  protected readonly store = inject(RaceStore);
  protected readonly sounds = inject(RaceSounds);
  private readonly completion = inject(CompletionService);
  private readonly progress = inject(ProgressService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap);
  protected readonly levels = raceLevels;
  protected readonly paces = paces;
  protected readonly racerIds = racerIds;
  protected readonly stars = [1, 2, 3] as const;
  protected readonly total = TOTAL_STAGES;
  protected readonly levelId = computed(() => this.params()?.get('id') ?? 'unicorn-race-1');
  protected readonly stage = computed(() => raceStage(this.levelId()));
  protected readonly level = computed<RaceLevel>(() => this.stage()?.stage ?? 1);
  /** Every route change (next race, level strip) lands back on that race's intro. */
  protected readonly phase = linkedSignal<string, Phase>({
    source: this.levelId,
    computation: () => 'intro',
  });
  protected readonly race = signal<RaceState>(createRace('off', 1));
  protected readonly question = signal<RaceQuestion>({ text: '', answer: 0, choices: [] });
  protected readonly struck = signal<readonly number[]>([]);
  protected readonly feedback = signal<Feedback>({ kind: 'idle' });
  protected readonly countdown = signal<string | null>(null);
  protected readonly announcement = signal('');
  protected readonly finishPlace = signal<1 | 2 | 3 | 4>(4);
  protected readonly newBest = signal(false);
  protected readonly saveFailed = signal(false);
  /** Cups and sparkles could not be stored; stars still were, so the party stays open. */
  protected readonly cupsFailed = signal(false);
  protected readonly sparklePop = signal(false);
  protected readonly placePop = signal(false);
  /** The choice that just lit up green, and the sparkles it earned. */
  protected readonly flashRight = signal<number | null>(null);
  protected readonly gain = signal<number | null>(null);
  protected readonly boost = signal(false);
  protected readonly locked = signal(false);
  /** True from crossing the line until the summary slides in. */
  protected readonly crossed = signal(false);
  private readonly summary = viewChild<ElementRef<HTMLElement>>('summary');
  private readonly answerButtons = viewChildren<ElementRef<HTMLButtonElement>>('answerButton');
  private ticker?: ReturnType<typeof setInterval>;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private lastPlace: 1 | 2 | 3 | 4 = 1;
  private gainBase = 0;
  private gainTimer?: ReturnType<typeof setTimeout>;
  protected readonly gainKey = signal(0);
  protected readonly pace = computed(() => this.store.save().pace);
  protected readonly timed = computed(() => this.pace() !== 'off');
  protected readonly racing = computed(() => this.phase() === 'racing');
  protected readonly rainbow = computed(() => isRainbow(this.race()));
  protected readonly stumbling = computed(() => this.race().stumbleMs > 0);
  protected readonly place = computed(() => playerPlace(this.race()));
  protected readonly playerSpeed = computed(() => racer(this.race(), 'player').speed);
  protected readonly placeKey = computed(() => `place${this.place()}` as RaceMessageKey);
  protected readonly finishStars = computed(() => raceStars(this.finishPlace()));
  protected readonly cup = computed<Cup>(() => cupFor(this.finishPlace()));
  protected readonly sparkles = computed(() =>
    this.phase() === 'finished' ? finalSparkles(this.race()) : this.race().sparkles,
  );
  protected readonly seconds = computed(() => Math.round(this.race().elapsedMs / 1000));
  protected readonly names = computed<Readonly<Record<RacerId, string>>>(() => ({
    player: this.t('racerPlayer'),
    cloud: this.t('racerCloud'),
    mint: this.t('racerMint'),
    peach: this.t('racerPeach'),
  }));
  protected readonly labels = computed<Readonly<Record<RacerId, string>>>(
    () =>
      Object.fromEntries(
        racerIds.map((id) => [
          id,
          this.t('racerAt', {
            name: this.names()[id],
            n: Math.round((100 * racer(this.race(), id).position) / TRACK_LENGTH),
          }),
        ]),
      ) as Record<RacerId, string>,
  );
  protected readonly status = computed(() => {
    const feedback = this.feedback();
    switch (feedback.kind) {
      case 'gallop':
        return this.t('gallop');
      case 'rainbow':
        return this.t('rainbow', { n: feedback.streak });
      case 'wrong':
        return this.t('wrong');
      case 'wrongAgain':
        return this.t('wrongAgain');
      default:
        return this.t('youAre', { place: this.t(this.placeKey()) });
    }
  });
  protected readonly outcomeKey = computed<RaceMessageKey>(() => {
    const place = this.finishPlace();
    return place === 1 ? 'won' : place === 2 ? 'second' : place === 3 ? 'third' : 'fourth';
  });
  protected readonly nextLevel = computed<RaceLevel | undefined>(() =>
    this.level() < TOTAL_STAGES ? ((this.level() + 1) as RaceLevel) : undefined,
  );
  constructor() {
    this.progress.explore('tens');
    inject(DestroyRef).onDestroy(() => this.stopTimers());
    // Leaving a race for another one through the level strip must not keep its clock running.
    effect(() => {
      this.levelId();
      this.stopTimers();
      this.countdown.set(null);
    });
    effect(() => {
      if (this.phase() === 'finished')
        requestAnimationFrame(() => this.summary()?.nativeElement.focus({ preventScroll: true }));
    });
  }
  protected t(key: RaceMessageKey, values: Record<string, string | number> = {}): string {
    const formatted = Object.fromEntries(
      Object.entries(values).map(([name, value]) => [
        name,
        typeof value === 'number' ? this.i.format(value) : value,
      ]),
    );
    return raceText(this.i.locale(), key, { total: TOTAL_STAGES, ...formatted });
  }
  protected levelTitle(level: RaceLevel): MessageKey {
    return `race${level}` as MessageKey;
  }
  protected levelHelp(level: RaceLevel): MessageKey {
    return `race${level}Help` as MessageKey;
  }
  protected paceLabel(pace: Pace): RaceMessageKey {
    return `pace${pace.charAt(0).toUpperCase()}${pace.slice(1)}` as RaceMessageKey;
  }
  protected cupKey(cup: Cup | undefined): RaceMessageKey {
    return cup ? (`cup${cup.charAt(0).toUpperCase()}${cup.slice(1)}` as RaceMessageKey) : 'cupNone';
  }
  protected toSeconds(ms: number): number {
    return Math.round(ms / 1000);
  }
  protected choosePace(pace: Pace) {
    this.store.setPace(pace);
  }
  protected start() {
    this.stopTimers();
    this.sounds.unlock();
    this.race.set(createRace(this.pace(), this.level()));
    this.struck.set([]);
    this.feedback.set({ kind: 'idle' });
    this.announcement.set('');
    this.newBest.set(false);
    this.saveFailed.set(false);
    this.crossed.set(false);
    this.flashRight.set(null);
    this.gain.set(null);
    this.locked.set(false);
    this.boost.set(false);
    this.sparklePop.set(false);
    this.placePop.set(false);
    this.lastPlace = 1;
    this.gainBase = 0;
    this.phase.set('countdown');
    const steps = ['3', '2', '1', this.t('go')];
    steps.forEach((step, index) =>
      this.timers.push(
        setTimeout(() => {
          this.countdown.set(step);
          this.announcement.set(step);
          this.sounds.play(index === steps.length - 1 ? 'go' : 'count');
        }, index * COUNT_MS),
      ),
    );
    this.timers.push(
      setTimeout(
        () => {
          this.countdown.set(null);
          this.nextQuestion();
          this.phase.set('racing');
          if (!this.document.hidden) this.startTicker();
          requestAnimationFrame(() =>
            this.answerButtons()[0]?.nativeElement.focus({ preventScroll: true }),
          );
        },
        steps.length * COUNT_MS + 300,
      ),
    );
  }
  private nextQuestion() {
    const skill = this.stage()?.skill ?? 'plus10';
    this.question.set(raceQuestion(skill, Math.random, this.question().text));
    this.struck.set([]);
  }
  protected choose(value: number) {
    if (
      this.phase() !== 'racing' ||
      this.race().done ||
      this.locked() ||
      this.struck().includes(value)
    )
      return;
    const correct = value === this.question().answer;
    const next = answer(this.race(), correct);
    this.race.set(next);
    if (correct) {
      const rainbow = isRainbow(next);
      this.sounds.play(rainbow ? 'rainbow' : 'gallop');
      this.flashFeedback(rainbow ? { kind: 'rainbow', streak: next.streak } : { kind: 'gallop' });
      this.flash(this.sparklePop, 500);
      this.flash(this.boost, 350);
      // A double tap must not answer the next question blindly.
      this.flash(this.locked, LOCK_MS);
      this.gain.set(next.sparkles - this.gainBase);
      this.gainKey.update((key) => key + 1);
      this.gainBase = next.sparkles;
      clearTimeout(this.gainTimer);
      this.gainTimer = setTimeout(() => this.gain.set(null), 700);
      this.timers.push(this.gainTimer);
      this.flashRight.set(value);
      this.timers.push(setTimeout(() => this.flashRight.set(null), 400));
      this.nextQuestion();
    } else {
      this.sounds.play('stumble');
      this.struck.update((struck) => [...struck, value]);
      this.flashFeedback({ kind: this.struck().length > 1 ? 'wrongAgain' : 'wrong' }, 1600);
      requestAnimationFrame(() => this.focusOpenAnswer());
    }
    if (this.pace() === 'off') this.advanceTurn();
  }
  /** Turn-based races play their steps out right after the answer, then pause again. */
  private advanceTurn() {
    if (this.ticker) return;
    this.startTicker();
    const stop = () => {
      const settled =
        this.race().stumbleMs === 0 && this.race().racers.every((racer) => racer.dash <= 0.001);
      if (settled || this.race().done) this.stopTicker();
      else this.timers.push(setTimeout(stop, TICK_MS));
    };
    this.timers.push(setTimeout(stop, TICK_MS));
  }
  private startTicker() {
    if (this.ticker) return;
    this.ticker = setInterval(() => this.step(), TICK_MS);
  }
  private stopTicker() {
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = undefined;
  }
  private step() {
    const next = tick(this.race(), TICK_MS);
    this.race.set(next);
    const place = playerPlace(next);
    if (place !== this.lastPlace) {
      if (place < this.lastPlace) this.sounds.play('overtake');
      this.lastPlace = place;
      this.flash(this.placePop, 500);
      this.announcement.set(this.t('youAre', { place: this.t(`place${place}` as RaceMessageKey) }));
    }
    if (next.done && !this.crossed()) this.finish();
  }
  private finish() {
    this.stopTimers();
    const place = playerPlace(this.race());
    this.finishPlace.set(place);
    const sparkles = finalSparkles(this.race());
    const level = this.level();
    this.newBest.set(
      this.store.recordRace(
        level,
        cupFor(place),
        sparkles,
        this.timed() ? this.race().elapsedMs : undefined,
      ),
    );
    const recorded = this.completion.finish({
      levelId: this.levelId(),
      completed: true,
      mastered: isMastered(place, level),
      stars: raceStars(place),
    });
    this.saveFailed.set(!recorded);
    this.cupsFailed.set(this.store.saveFailed());
    this.sounds.play(place === 1 ? 'win' : 'finish');
    this.announcement.set(this.t(this.outcomeKey()));
    // Hold on the finish line for a moment: confetti, a cheering castle, then the podium.
    this.crossed.set(true);
    this.countdown.set(this.t('finish'));
    this.timers.push(
      setTimeout(() => {
        this.countdown.set(null);
        this.phase.set('finished');
      }, FINISH_HOLD_MS),
    );
  }
  protected playAgain() {
    this.start();
  }
  protected goTo(level: RaceLevel) {
    void this.router.navigate(['/adventure', `unicorn-race-${level}`]);
  }
  protected chooseRace() {
    this.stopTimers();
    this.countdown.set(null);
    this.phase.set('intro');
  }
  protected celebrate() {
    void this.router.navigate(['/complete', this.levelId()]);
  }
  protected visibilityChanged() {
    if (this.phase() !== 'racing' || !this.timed() || this.race().done) return;
    if (this.document.hidden) this.stopTicker();
    else this.startTicker();
  }
  protected onKey(event: KeyboardEvent) {
    if (event.repeat || this.phase() !== 'racing' || event.metaKey || event.ctrlKey || event.altKey)
      return;
    const target = event.target as HTMLElement | null;
    if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
    const index = Number(event.key) - 1;
    const choice = this.question().choices[index];
    if (/^[1-4]$/.test(event.key) && choice !== undefined) {
      this.choose(choice);
      event.preventDefault();
    }
  }
  private focusOpenAnswer() {
    const buttons = this.answerButtons().map((ref) => ref.nativeElement);
    const active = this.document.activeElement;
    const open =
      buttons.find(
        (button) => button === active && button.getAttribute('aria-disabled') !== 'true',
      ) ?? buttons.find((button) => button.getAttribute('aria-disabled') !== 'true');
    open?.focus({ preventScroll: true });
  }
  private flashFeedback(feedback: Feedback, ms = FEEDBACK_MS) {
    this.feedback.set(feedback);
    this.timers.push(
      setTimeout(() => {
        if (this.feedback() === feedback) this.feedback.set({ kind: 'idle' });
      }, ms),
    );
  }
  private flash(flag: { set(value: boolean): void }, ms: number) {
    flag.set(true);
    this.timers.push(setTimeout(() => flag.set(false), ms));
  }
  private stopTimers() {
    this.stopTicker();
    for (const timer of this.timers) clearTimeout(timer);
    this.timers = [];
  }
}
