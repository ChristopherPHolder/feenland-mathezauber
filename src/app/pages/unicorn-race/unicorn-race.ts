import {
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  linkedSignal,
  signal,
  untracked,
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
  gapTo,
  inFinalStretch,
  isMastered,
  isRainbow,
  LINEUP,
  Pace,
  paces,
  playerPlace,
  RaceState,
  racer,
  RacerId,
  racerIds,
  raceStars,
  tick,
} from './race';
import { raceText, RaceMessageKey } from './race-messages';
import {
  cupTracks,
  HeatNumber,
  heatNumbers,
  heats,
  RaceCup,
  raceCups,
  RaceLevel,
  RaceMode,
  RaceQuestion,
  raceQuestion,
  RaceStage,
  raceTrack,
  RaceTrack,
  raceTracks,
  Sky,
  stageFor,
  TOTAL_HEATS,
  TOTAL_STAGES,
} from './race-questions';
import { RaceOverview } from './race-overview';
import { RaceScene } from './race-scene';
import { RaceSounds } from './race-sounds';
import { RacerArt } from './racer-art';
import { Cup, cupFor, Outfit, OUTFIT_CUP, outfits, RaceStore } from './race-store';
import type { Course } from './race-world';
type Phase = 'intro' | 'countdown' | 'racing' | 'finished';
type Feedback =
  | { readonly kind: 'idle' }
  | { readonly kind: 'gallop' }
  | { readonly kind: 'rainbow'; readonly streak: number }
  | { readonly kind: 'wrong' }
  | { readonly kind: 'wrongAgain' }
  | { readonly kind: 'stretch' };
export const TICK_MS = 100;
const COUNT_MS = 800;
const FEEDBACK_MS = 900;
const FINISH_HOLD_MS = 1300;
const LOCK_MS = 350;
const CUP_EMBLEM: Readonly<Record<RaceCup, string>> = {
  meadow: '🌸',
  sky: '☁️',
  star: '🌙',
  castle: '🏰',
  rainbow: '🌈',
};
const OUTFIT_EMBLEM: Readonly<Record<Outfit, string>> = {
  wreath: '🌸',
  wings: '🕊️',
  tiara: '✨',
  crown: '👑',
  cape: '🌈',
};
const MODE_EMBLEM: Readonly<Record<RaceMode, string>> = { race: '🏁', chase: '🗝️', shadow: '👻' };
/**
 * The unicorn race: Lumi gallops to the rainbow castle through four cups of three races.
 * Everyone runs the whole time; right answers speed Lumi up, wrong ones make her stumble. A
 * plain race is against three friends, a chase means catching Storm and the stolen key, and a
 * shadow race means beating Lumi's own best time.
 */
@Component({
  selector: 'app-unicorn-race',
  imports: [RouterLink, Icon, GameHeader, RaceScene, RaceOverview, RacerArt],
  providers: [RaceSounds],
  templateUrl: './unicorn-race.html',
  styleUrls: ['./unicorn-race.css', './race-intro.css', './race-play.css', './race-themes.css'],
  host: {
    '[class.playing]': 'phase() !== "intro"',
    '[class.is-meadow]': 'cup() === "meadow"',
    '[class.is-sky]': 'cup() === "sky"',
    '[class.is-star]': 'cup() === "star"',
    '[class.is-castle]': 'cup() === "castle"',
    '[class.is-rainbow]': 'cup() === "rainbow"',
    '[class.is-dusk]': 'sky() === "dusk"',
    '[class.is-night]': 'sky() === "night"',
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
  protected readonly cups = raceCups;
  protected readonly heats = heats;
  protected readonly detail = computed(
    () =>
      `${this.t('level', { n: this.level() })} · ${this.i.t(this.levelTitle(this.level()))} · ${this.t('heatLabel', { n: this.heat() })}`,
  );
  protected readonly totalHeats = TOTAL_HEATS;
  protected readonly outfits = outfits;
  protected readonly paces = paces;
  protected readonly stars = [1, 2, 3] as const;
  protected readonly total = TOTAL_STAGES;
  protected readonly levelId = computed(() => this.params()?.get('id') ?? 'unicorn-race-1');
  protected readonly track = computed<RaceTrack>(() => raceTrack(this.levelId()) ?? raceTracks[0]);
  protected readonly level = computed<RaceLevel>(() => this.track().stage);
  /** The heat being run; a new track opens on its first unfinished heat. */
  protected readonly heat = linkedSignal<RaceLevel, HeatNumber>({
    source: this.level,
    computation: (level) => untracked(() => this.store.nextHeat(level)),
  });
  protected readonly stage = computed<RaceStage>(() => stageFor(this.track(), this.heat()));
  protected readonly sky = computed<Sky>(() => this.stage().sky);
  protected readonly cup = computed<RaceCup>(() => this.stage().cup);
  protected readonly mode = computed<RaceMode>(() => this.stage().mode);
  protected readonly lineup = computed<readonly RacerId[]>(() => LINEUP[this.mode()]);
  protected readonly course = computed<Course>(() => ({
    cup: this.cup(),
    length: this.stage().length,
    racers: this.lineup(),
    outfit: this.outfit(),
    sky: this.sky(),
  }));
  protected readonly outfit = computed(() => this.store.save().outfit);
  /** The keepsake just earned by finishing this race's cup, if any. */
  protected readonly newOutfit = signal<Outfit | null>(null);
  /** Rainbow streak pips: how many of the three steps toward a dash are lit. */
  protected readonly pips = computed(() => Math.min(3, this.race().streak));
  /** Every route change (next race, level strip) lands back on that race's intro. */
  protected readonly phase = linkedSignal<string, Phase>({
    source: this.levelId,
    computation: () => 'intro',
  });
  protected readonly race = signal<RaceState>(createRace('normal', stageFor(raceTracks[0], 1)));
  protected readonly question = signal<RaceQuestion>({ text: '', answer: 0, choices: [] });
  protected readonly struck = signal<readonly number[]>([]);
  protected readonly feedback = signal<Feedback>({ kind: 'idle' });
  protected readonly countdown = signal<string | null>(null);
  protected readonly announcement = signal('');
  protected readonly finishPlace = signal<1 | 2 | 3 | 4>(4);
  protected readonly finishStars = signal<1 | 2 | 3>(1);
  protected readonly newBest = signal(false);
  protected readonly saveFailed = signal(false);
  /** Cups and sparkles could not be stored; stars still were, so the party stays open. */
  protected readonly cupsFailed = signal(false);
  protected readonly sparklePop = signal(false);
  protected readonly placePop = signal(false);
  /** The choice that just lit up green, and the sparkles it earned. */
  protected readonly flashRight = signal<number | null>(null);
  protected readonly gain = signal<number | null>(null);
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
  protected readonly racing = computed(() => this.phase() === 'racing');
  protected readonly rainbow = computed(() => isRainbow(this.race()));
  protected readonly stumbling = computed(() => this.race().stumbleMs > 0);
  protected readonly place = computed(() => playerPlace(this.race()));
  protected readonly placeKey = computed(() => `place${this.place()}` as RaceMessageKey);
  protected readonly placeLabels = computed<Readonly<Record<1 | 2 | 3 | 4, string>>>(() => ({
    1: this.t('place1'),
    2: this.t('place2'),
    3: this.t('place3'),
    4: this.t('place4'),
  }));
  protected readonly cupBadge = computed<Cup>(() => cupFor(this.finishPlace()));
  protected readonly sparkles = computed(() =>
    this.phase() === 'finished' ? finalSparkles(this.race()) : this.race().sparkles,
  );
  protected readonly seconds = computed(() => Math.round(this.race().elapsedMs / 1000));
  /** A missing-number question already carries its equals sign. */
  protected readonly equation = computed(() => {
    const text = this.question().text;
    return text.includes('=') ? text : `${text} = ?`;
  });
  protected readonly exampleEquation = computed(() => {
    const text = this.stage().example;
    return text.includes('=') ? text : `${text} = ?`;
  });
  protected readonly questionLabel = computed(() =>
    this.t(this.question().text.includes('=') ? 'missing' : 'question', {
      text: this.question().text,
    }),
  );
  protected readonly names = computed<Readonly<Record<RacerId, string>>>(() => ({
    player: this.t('racerPlayer'),
    cloud: this.t('racerCloud'),
    mint: this.t('racerMint'),
    peach: this.t('racerPeach'),
    storm: this.t('racerStorm'),
    shadow: this.t('racerShadow'),
  }));
  protected readonly labels = computed<Readonly<Record<RacerId, string>>>(
    () =>
      Object.fromEntries(
        racerIds.map((id) => {
          const state = this.race().racers.find((current) => current.id === id);
          return [
            id,
            this.t('racerAt', {
              name: this.names()[id],
              n: Math.round((100 * (state?.position ?? 0)) / this.race().length),
            }),
          ];
        }),
      ) as Record<RacerId, string>,
  );
  /** The chase shows the gap to Storm, the shadow race its time; a plain race needs neither. */
  protected readonly rivalChip = computed(() => {
    const race = this.race();
    if (race.mode === 'chase') {
      const gap = gapTo(race, 'storm');
      return this.t(gap >= 0 ? 'gapAhead' : 'gapBehind', { n: Math.abs(gap) });
    }
    if (race.mode === 'shadow')
      return this.t('shadowTime', { seconds: Math.round((race.shadowMs ?? 0) / 1000) });
    return null;
  });
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
      case 'stretch':
        return this.t('finalStretch');
      default:
        return this.t('youAre', { place: this.t(this.placeKey()) });
    }
  });
  protected readonly introKey = computed<RaceMessageKey>(() =>
    this.mode() === 'chase' ? 'introChase' : this.mode() === 'shadow' ? 'introShadow' : 'intro',
  );
  protected readonly modeRule = computed<RaceMessageKey | null>(() =>
    this.mode() === 'chase'
      ? 'ruleChase'
      : this.mode() === 'shadow'
        ? 'ruleShadow'
        : this.stage().final
          ? 'ruleFinal'
          : null,
  );
  protected readonly outcomeKey = computed<RaceMessageKey>(() => {
    const place = this.finishPlace();
    const mode = this.race().mode;
    if (mode === 'chase') return place === 1 ? 'caught' : 'escaped';
    if (mode === 'shadow') return place === 1 ? 'beatShadow' : 'shadowWon';
    return place === 1 ? 'won' : place === 2 ? 'second' : place === 3 ? 'third' : 'fourth';
  });
  protected readonly nextHeat = computed<HeatNumber | undefined>(() =>
    this.heat() < TOTAL_HEATS ? ((this.heat() + 1) as HeatNumber) : undefined,
  );
  protected readonly nextLevel = computed<RaceLevel | undefined>(() =>
    this.level() < TOTAL_STAGES ? ((this.level() + 1) as RaceLevel) : undefined,
  );
  protected readonly cupsComplete = computed(() => {
    this.store.save();
    return this.store.completedCups();
  });
  private stretchCalled = false;
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
  protected tracksOf(cup: RaceCup): readonly RaceTrack[] {
    return cupTracks(cup);
  }
  protected heatTitle(heat: HeatNumber): RaceMessageKey {
    return `heat${heat}` as RaceMessageKey;
  }
  protected heatMode(heat: HeatNumber): RaceMode {
    return stageFor(this.track(), heat).mode;
  }
  protected heatCup(heat: HeatNumber) {
    this.store.save();
    return this.store.record(this.level(), heat)?.cup;
  }
  protected heatBest(heat: HeatNumber): number | undefined {
    this.store.save();
    return this.store.record(this.level(), heat)?.bestMs;
  }
  protected heatsDone(level: RaceLevel): number {
    this.store.save();
    return this.store.heatsDone(level);
  }
  protected bestCup(level: RaceLevel): Cup | undefined {
    this.store.save();
    return this.store.bestCup(level);
  }
  protected chooseHeat(heat: HeatNumber) {
    this.heat.set(heat);
  }
  protected cupTitle(cup: RaceCup): RaceMessageKey {
    return `cup${cup.charAt(0).toUpperCase()}${cup.slice(1)}` as RaceMessageKey;
  }
  protected cupEmblem(cup: RaceCup): string {
    return CUP_EMBLEM[cup];
  }
  protected modeTitle(mode: RaceMode): RaceMessageKey {
    return `mode${mode.charAt(0).toUpperCase()}${mode.slice(1)}` as RaceMessageKey;
  }
  protected modeEmblem(mode: RaceMode): string {
    return MODE_EMBLEM[mode];
  }
  protected paceLabel(pace: Pace): RaceMessageKey {
    return `pace${pace.charAt(0).toUpperCase()}${pace.slice(1)}` as RaceMessageKey;
  }
  protected outfitName(outfit: Outfit | null): RaceMessageKey {
    return outfit
      ? (`outfit${outfit.charAt(0).toUpperCase()}${outfit.slice(1)}` as RaceMessageKey)
      : 'outfitNone';
  }
  protected outfitEmblem(outfit: Outfit): string {
    return OUTFIT_EMBLEM[outfit];
  }
  protected outfitCup(outfit: Outfit): RaceCup {
    return OUTFIT_CUP[outfit];
  }
  protected outfitEarned(outfit: Outfit): boolean {
    this.store.save();
    return this.store.earned(outfit);
  }
  protected wear(outfit: Outfit | null) {
    this.store.wear(outfit);
  }
  protected starsOf(level: RaceLevel): number {
    return this.progress.progress().stars?.[`unicorn-race-${level}`] ?? 0;
  }
  protected cupKey(cup: Cup | undefined): RaceMessageKey {
    return cup ? (`cup${cup.charAt(0).toUpperCase()}${cup.slice(1)}` as RaceMessageKey) : 'cupNone';
  }
  protected toSeconds(ms: number): number {
    return Math.round(ms / 1000);
  }
  protected example(track: RaceTrack): string {
    return track.example.includes('=') ? track.example : `${track.example} = ?`;
  }
  protected choosePace(pace: Pace) {
    this.store.setPace(pace);
  }
  protected start() {
    this.stopTimers();
    this.sounds.unlock();
    this.race.set(
      createRace(this.pace(), this.stage(), this.store.record(this.level(), this.heat())?.bestMs),
    );
    this.struck.set([]);
    this.feedback.set({ kind: 'idle' });
    this.announcement.set('');
    this.newBest.set(false);
    this.saveFailed.set(false);
    this.crossed.set(false);
    this.flashRight.set(null);
    this.gain.set(null);
    this.locked.set(false);
    this.sparklePop.set(false);
    this.placePop.set(false);
    this.lastPlace = playerPlace(this.race());
    this.gainBase = 0;
    this.newOutfit.set(null);
    this.stretchCalled = false;
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
    this.question.set(raceQuestion(this.stage().skill, Math.random, this.question().text));
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
    if (!this.stretchCalled && !next.done && inFinalStretch(next)) {
      this.stretchCalled = true;
      this.sounds.play('overtake');
      this.flashFeedback({ kind: 'stretch' }, 1400);
      this.announcement.set(this.t('finalStretch'));
    }
    if (next.done && !this.crossed()) this.finish();
  }
  private finish() {
    this.stopTimers();
    const race = this.race();
    const place = playerPlace(race);
    const stars = raceStars(race);
    this.finishPlace.set(place);
    this.finishStars.set(stars);
    const sparkles = finalSparkles(race);
    const level = this.level();
    const cup = this.cup();
    const hadCup = this.store.cupComplete(cup);
    this.newBest.set(
      this.store.recordRace(level, this.heat(), cupFor(place), sparkles, race.elapsedMs),
    );
    if (!hadCup && this.store.cupComplete(cup)) {
      const keepsake = outfits.find((outfit) => OUTFIT_CUP[outfit] === cup) ?? null;
      this.newOutfit.set(keepsake);
      // The new keepsake goes straight on, so the next race shows it off.
      this.store.wear(keepsake);
    }
    const recorded = this.completion.finish({
      levelId: this.levelId(),
      completed: true,
      mastered: isMastered(race),
      stars,
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
  /** The next heat of this track starts straight away; after the last heat, the next track. */
  protected goOn() {
    const heat = this.nextHeat();
    if (heat === undefined) {
      const level = this.nextLevel();
      if (level !== undefined) this.goTo(level);
      return;
    }
    this.heat.set(heat);
    this.start();
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
    if (this.phase() !== 'racing' || this.race().done) return;
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
