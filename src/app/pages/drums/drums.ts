import { DOCUMENT } from '@angular/common';
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
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { CompletionService } from '../../core/completion';
import { LocaleService } from '../../core/locale';
import { MessageKey } from '../../core/messages';
import { ProgressService } from '../../core/progress';
import { GameHeader } from '../../shared/game-header';
import { Icon } from '../../shared/icon';
import { ThreeStage, WorldLoader } from '../../shared/three/three-stage';
import { HatcheryStore } from '../hatchery/hatchery-store';
import { CALIBRATION_KEY } from './drum-calibration';
import { DrumChart } from './drum-chart';
import { DrumDemo } from './drum-demo';
import { countGuidedAnswer, GUIDE_IDLE_MS, GUIDED_ANSWERS, guidedAnswers } from './drum-guide';
import { BAND, DrumFrame, FrameMushroom, MAX_LAYERS, stepLabel } from './drum-frame';
import { DrumIntro } from './drum-intro';
import { drumText, DrumMessageKey } from './drum-messages';
import { DrumOutcome, DrumResult } from './drum-outcome';
import { DrumPath } from './drum-path';
import {
  beatSeconds,
  buildRound,
  choicesFor,
  drumStage,
  drumStages,
  drumStars,
  DrumTempo,
  FREE_BPM,
  GRACE_SECONDS,
  greyedOut,
  isMastered,
  parseDrumTempo,
  ruleFor,
  ruleRun,
  TOTAL_STAGES,
  VERSES,
  verseQuestions,
} from './drum-patterns';
import {
  answer,
  asking,
  DrumEvent,
  DrumPlay,
  landedIn,
  shift,
  skip,
  startPlay,
  tick,
} from './drum-round';
import { DrumScores } from './drum-scores';
import { DrumSounds } from './drum-sounds';

const TEMPO_KEY = 'feenland.drums-tempo.v1';
/** How often the round is moved on; the clock, not this interval, decides every time. */
const TICK_MS = 40;
/** Pom drums his final roll this long before the finish card. */
const FINALE_MS = 2200;
const BAND_KEYS: readonly DrumMessageKey[] = [
  'bandDrums',
  'bandBass',
  'bandFlute',
  'bandBells',
  'bandChoir',
];

/** One answered question, for the verse summaries and the finish card. */
interface Answered {
  readonly index: number;
  readonly firstTry: boolean;
}

@Component({
  selector: 'app-drums',
  imports: [Icon, GameHeader, ThreeStage, DrumPath, DrumChart, DrumIntro, DrumOutcome, DrumDemo],
  providers: [DrumSounds],
  templateUrl: './drums.html',
  styleUrls: ['./drums.css', './drums-play.css'],
  host: {
    '(document:keydown)': 'onKey($event)',
    '(document:visibilitychange)': 'visibilityChanged()',
  },
})
export class Drums {
  protected readonly i = inject(LocaleService);
  private readonly p = inject(ProgressService);
  private readonly hatchery = inject(HatcheryStore);
  private readonly completion = inject(CompletionService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  protected readonly sounds = inject(DrumSounds);
  protected readonly scores = inject(DrumScores);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap);

  protected readonly total = TOTAL_STAGES;
  protected readonly stage = computed(
    () => drumStage(this.params()?.get('id')) ?? drumStage('drums-1')!,
  );
  protected readonly levelId = computed(() => `drums-${this.stage().stage}`);
  protected readonly position = computed(() => drumStages.indexOf(this.stage()) + 1);
  protected readonly nextLink = computed(() => {
    const next = drumStages[this.position()];
    return next ? ['/adventure', `drums-${next.stage}`] : null;
  });
  protected readonly rows = computed(() => Math.ceil(Math.max(100, this.stage().max) / 10));

  protected readonly tempo = signal<DrumTempo>(this.readTempo());
  protected readonly timed = computed(() => this.tempo() !== 'free');
  protected readonly started = linkedSignal<boolean>(() => {
    this.stage();
    return false;
  });
  protected readonly play = signal<DrumPlay | null>(null);
  protected readonly round = signal(0);
  protected readonly paused = signal(false);
  protected readonly finale = signal(false);
  protected readonly result = signal<DrumResult | null>(null);
  protected readonly status = signal('');
  protected readonly answered = signal<readonly Answered[]>([]);
  /** The button tapped last on this question, and whether it was right. */
  protected readonly tapped = signal<{ index: number; value: number; right: boolean } | null>(null);
  /** The answer buttons hop to show where to tap: the first few drums, and after a wait. */
  protected readonly guide = signal(false);
  /** Wrong buttons tapped on this question: they grey out. */
  protected readonly wrongs = signal<readonly number[]>([]);
  /** The beat grid the song is on; pauses shift it. */
  private readonly origin = signal(0);

  protected readonly mushrooms = computed(() => this.play()?.mushrooms ?? []);
  protected readonly ask = computed(() => {
    const play = this.play();
    return play ? asking(play) : null;
  });
  /** The question the buttons are for: the one asked, or the next one coming. */
  protected readonly question = computed(() => {
    const play = this.play();
    if (!play) return null;
    // While Pom jumps to an answered drum, its buttons stay up with the right one marked.
    if (play.hop && !play.mushrooms[play.hop.to].given) return play.hop.to;
    for (let index = (play.hop?.to ?? play.at) + 1; index < play.mushrooms.length; index++)
      if (!play.mushrooms[index].given) return index;
    return null;
  });
  protected readonly choices = computed(() => {
    const index = this.question();
    const mushrooms = this.mushrooms();
    if (index === null) return [];
    return choicesFor(
      mushrooms[index],
      mushrooms[index - 1].value,
      this.stage().choices,
      this.i.locale(),
    );
  });
  protected readonly greyed = computed(() => {
    const play = this.play();
    const index = this.ask();
    if (!play || index === null) return [];
    const mushroom = play.mushrooms[index];
    return greyedOut(this.choices(), mushroom.value, play.misses, mushroom.seed);
  });
  protected readonly verse = computed(() => {
    const play = this.play();
    if (!play) return 0;
    const index = Math.min(play.mushrooms.length - 1, (play.hop?.to ?? play.at) + 1);
    return play.phase === 'banner'
      ? play.mushrooms[index].verse
      : play.mushrooms[play.hop?.to ?? play.at].verse;
  });
  /** A verse title, or the hops Pom shows by himself before a verse's first question. */
  protected readonly canSkip = computed(() => {
    const play = this.play();
    if (!play || this.paused()) return false;
    if (play.phase === 'banner') return true;
    const next = play.mushrooms[(play.hop?.to ?? play.at) + 1];
    return play.phase === 'auto' && !!next && next.verse !== 2 && next.given;
  });
  protected readonly verseSlots = [0, 1, 2, 3];
  protected readonly bandSlots = BAND.map((layer, index) => ({ layer, index }));
  protected readonly layers = computed(() => this.play()?.stats.layers ?? 1);
  protected readonly points = computed(() => this.play()?.stats.points ?? 0);
  /** "Drum 4 of 10" in the current verse. */
  protected readonly drumCount = computed(() => {
    const play = this.play();
    const index = this.question();
    if (!play || index === null) return null;
    const verse = play.mushrooms[index].verse;
    const inVerse = play.mushrooms.filter((m) => m.verse === verse && !m.given);
    return { n: inVerse.indexOf(play.mushrooms[index]) + 1, total: inVerse.length };
  });
  /** The run of numbers leading to the question, as the prompt shows it: "7, 17, 27, ?". */
  protected readonly prompt = computed(() => {
    const play = this.play();
    const index = this.question();
    if (!play || index === null) return null;
    const mushrooms = play.mushrooms;
    const target = mushrooms[index];
    let first = index;
    while (first > 0 && !mushrooms[first].fresh) first--;
    const shown = mushrooms.slice(Math.max(first, index - 3), index).map((m) => m.value);
    const before = !!target.before;
    const parts = before ? ['?', ...shown.reverse().map(String)] : [...shown.map(String), '?'];
    const step = before ? -target.step : target.step;
    const size = Math.abs(step) as 1 | 2 | 3 | 4 | 5 | 10;
    const way = step > 0 ? 'on' : 'back';
    return {
      parts,
      before,
      current: mushrooms[index - 1].value,
      step: this.t(`${way}${size}` as DrumMessageKey),
    };
  });
  /** After a first miss, the step; after a second, the rule card told with other numbers. */
  protected readonly help = computed(() => {
    const play = this.play();
    const index = this.ask();
    if (!play || index === null || play.misses === 0) return null;
    const mushroom = play.mushrooms[index];
    const previous = play.mushrooms[index - 1].value;
    const step = stepLabel(mushroom.step);
    if (play.misses === 1) return { step: this.t('hintStep', { step }), rule: null };
    const rule = ruleFor(previous, mushroom.value);
    const run = ruleRun(rule, previous, mushroom.value);
    const key = `rule${rule[0].toUpperCase()}${rule.slice(1)}` as DrumMessageKey;
    return {
      step: this.t('hintStep', { step }),
      rule: this.t(key, {
        run: run.map((n) => this.i.format(n)).join(', '),
        first: this.i.format(run[0]),
        last: this.i.format(run[run.length - 1]),
      }),
    };
  });
  /** The verse title shown while a new verse counts in. */
  protected readonly banner = computed(() => {
    const play = this.play();
    if (!play || play.phase !== 'banner') return null;
    const verse = this.verse();
    const firstIndex = play.mushrooms.findIndex((m) => m.verse === verse);
    const spec = verse < VERSES ? this.stage().verses[verse] : null;
    const done = verse > 0 ? this.verseScore(verse - 1) : null;
    return {
      title: verse === VERSES ? this.t('soloTitle') : this.t('verseTitle', { n: verse + 1 }),
      help:
        verse === VERSES
          ? this.t('soloHelp')
          : spec?.kind === 'call'
            ? this.t('verseCall')
            : this.t('versePath', { n: this.i.format(play.mushrooms[firstIndex].value) }),
      done: done && verse <= VERSES ? { verse, ...done } : null,
    };
  });
  /** Hundred chart cells: this verse bright, earlier verses faint. */
  protected readonly chart = computed(() => {
    const play = this.play();
    if (!play) return { lit: [], faded: [], mark: null };
    const verse = play.mushrooms[play.at].verse;
    const lit = landedIn(play, verse);
    const faded = Array.from({ length: verse }, (_, v) => landedIn(play, v)).flat();
    return { lit, faded, mark: play.mushrooms[play.at].value };
  });
  protected readonly chartLabel = computed(() => {
    const lit = this.chart().lit.filter((value) => value >= 1);
    return lit.length
      ? this.t('chartLit', { list: lit.map((n) => this.i.format(n)).join(', ') })
      : this.t('chartEmpty');
  });
  private readonly framed = computed<readonly FrameMushroom[]>(() =>
    this.mushrooms().map((m) => ({
      value: m.value,
      given: m.given,
      fresh: m.fresh,
      step: m.step,
      solo: m.verse === VERSES,
    })),
  );
  protected readonly frame = computed<DrumFrame>(() => {
    const play = this.play();
    const mushrooms = this.framed();
    if (!play) return this.idleFrame();
    const ask = this.ask();
    const paused = this.paused();
    const index = ask ?? play.at;
    return {
      round: this.round(),
      mushrooms,
      at: play.at,
      hop: play.hop,
      ask,
      ring:
        play.timed && ask !== null && !play.held
          ? { start: play.askedAt, end: play.landing }
          : null,
      beat:
        play.timed && !paused && !play.held ? { origin: this.origin(), period: play.beat } : null,
      now: this.sounds.now,
      waiting: play.waiting,
      held: play.held,
      stepHint: ask !== null && play.misses > 0 ? stepLabel(play.mushrooms[index].step) : null,
      layers: play.stats.layers,
      hits: play.stats.hits,
      bonks: play.stats.bonks,
      solo: play.mushrooms[index]?.verse === VERSES,
      finished: play.phase === 'done',
      paused,
    };
  });
  protected readonly loadWorld: WorldLoader<DrumFrame> = () =>
    import('./drum-world').then((m) => m.DrumWorld);

  private readonly pauseDialog = viewChild<ElementRef<HTMLDialogElement>>('pauseDialog');
  private readonly beatDots = viewChild<ElementRef<HTMLElement>>('beatDots');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private ticker?: ReturnType<typeof setInterval>;
  private finaleTimer?: ReturnType<typeof setTimeout>;
  private frameHandle = 0;
  private guideTimer?: ReturnType<typeof setTimeout>;
  private pausedAt = 0;

  constructor() {
    effect(() => {
      if (this.started()) this.p.explore('numbers');
    });
    // A new level (from the strip or the finish card) goes back to its intro.
    effect(() => {
      this.stage();
      untracked(() => this.stop());
    });
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  protected t(key: DrumMessageKey, values: Record<string, string | number> = {}) {
    return drumText(this.i.locale(), key, values);
  }
  protected levelKey(stage: number) {
    return `drums${stage}` as MessageKey;
  }
  protected bandName(index: number) {
    return this.t(BAND_KEYS[index]);
  }

  protected selectTempo(tempo: DrumTempo) {
    this.tempo.set(tempo);
    try {
      this.document.defaultView?.localStorage.setItem(TEMPO_KEY, tempo);
    } catch {
      /* The tempo stays for this visit. */
    }
  }

  protected begin() {
    this.stop();
    this.sounds.unlock();
    const stage = this.stage();
    const timed = this.timed();
    const beat = timed ? beatSeconds(this.tempo()) : 60 / FREE_BPM;
    const now = this.sounds.now();
    const step = startPlay(buildRound(stage), { timed, beat, grace: this.grace() }, now);
    this.round.update((n) => n + 1);
    this.answered.set([]);
    this.tapped.set(null);
    this.result.set(null);
    this.finale.set(false);
    this.paused.set(false);
    this.started.set(true);
    this.play.set(step.play);
    this.sounds.play('start');
    this.sounds.setLayers(1);
    this.apply(step.events);
    this.ticker = setInterval(() => this.advance(), TICK_MS);
    this.watchBeat();
    this.focusAnswers();
  }

  /** Moves the round on to the clock's time. */
  private advance() {
    const play = this.play();
    if (!play || this.paused()) return;
    const step = tick(play, this.sounds.now());
    if (step.play !== play) this.play.set(step.play);
    this.apply(step.events);
  }

  protected choose(value: number) {
    const play = this.play();
    const index = this.ask();
    if (!play || index === null || this.paused() || this.greyed().includes(value)) return;
    const step = answer(play, value, this.sounds.now());
    this.play.set(step.play);
    this.apply(step.events);
  }

  protected skipIntro() {
    const play = this.play();
    if (!play || this.paused()) return;
    const step = skip(play, this.sounds.now());
    if (step.play === play) return;
    this.play.set(step.play);
    this.apply(step.events);
    this.focusAnswers();
  }

  /** Plays the sounds and words for what just happened. */
  private apply(events: readonly DrumEvent[]) {
    const play = this.play();
    if (!play) return;
    for (const event of events) {
      switch (event.kind) {
        case 'regrid':
          this.origin.set(event.origin);
          this.sounds.song({ level: this.stage().stage, origin: event.origin, period: play.beat });
          break;
        case 'banner':
          this.sounds.play(event.verse === VERSES ? 'solo' : 'verse', event.from);
          if (play.timed) this.sounds.countIn(event.from, play.beat);
          this.status.set(this.bannerText(event.verse));
          break;
        case 'hop':
          this.sounds.hit(play.mushrooms[event.to].value, event.land);
          break;
        case 'land':
          this.tapped.set(null);
          break;
        case 'ask': {
          const mushroom = play.mushrooms[event.index];
          const previous = this.i.format(play.mushrooms[event.index - 1].value);
          this.wrongs.set([]);
          this.armGuide();
          this.status.set(
            mushroom.before ? this.t('askBefore', { n: previous }) : this.t('ask', { n: previous }),
          );
          this.focusAnswers();
          break;
        }
        case 'right': {
          const value = play.mushrooms[event.index].value;
          this.tapped.set({ index: event.index, value, right: true });
          this.answered.update((list) => [
            ...list,
            { index: event.index, firstTry: event.firstTry },
          ]);
          this.hatchery.warm();
          clearTimeout(this.guideTimer);
          this.guide.set(false);
          if (guidedAnswers() < GUIDED_ANSWERS) countGuidedAnswer();
          this.sounds.roll(false);
          this.sounds.hold(false);
          this.status.set(
            this.t(event.onBeat ? 'rightBeat' : 'right', { n: this.i.format(value) }),
          );
          break;
        }
        case 'wrong':
          this.tapped.set({ index: event.index, value: event.value, right: false });
          this.wrongs.update((list) => [...list, event.value]);
          this.sounds.play('bonk');
          this.sounds.roll(false);
          if (play.timed) this.sounds.hold(true);
          this.status.set(this.t('wrong', { n: this.i.format(event.value) }));
          break;
        case 'late':
          this.sounds.roll(true);
          this.status.set(this.t('late'));
          break;
        case 'layer': {
          this.sounds.setLayers(event.layers);
          this.sounds.play(event.up ? 'layerUp' : 'layerDown');
          const name = this.bandName(event.up ? event.layers - 1 : event.layers);
          const line =
            event.up && event.layers === MAX_LAYERS
              ? this.t('fullBand')
              : this.t(event.up ? 'layerUp' : 'layerDown', { name });
          this.status.update((text) => `${text} ${line}`);
          break;
        }
        case 'done':
          this.finish();
          break;
      }
    }
  }

  private finish() {
    clearInterval(this.ticker);
    this.ticker = undefined;
    this.finale.set(true);
    this.sounds.roll(false);
    this.sounds.stopSong();
    this.sounds.play('win');
    this.status.set(this.t('done'));
    this.finaleTimer = setTimeout(() => this.complete(), FINALE_MS);
  }

  private complete() {
    const play = this.play();
    if (!play) return;
    cancelAnimationFrame(this.frameHandle);
    const questions = verseQuestions(play.mushrooms);
    const stars = drumStars(play.stats.firstTry, questions);
    const pathCells = play.mushrooms
      .filter((m) => m.verse < 2)
      .map((m) => m.value)
      .filter((value) => value >= 1 && value <= this.rows() * 10);
    const first = play.mushrooms[0];
    const picture = {
      cells: [...new Set(pathCells)],
      step: play.mushrooms[1].step,
      start: first.value,
    };
    const saved = this.completion.finish({
      levelId: this.levelId(),
      completed: true,
      mastered: isMastered(this.stage(), stars),
      stars,
    });
    const newBest = this.scores.record(this.levelId(), this.tempo(), play.stats.points, picture);
    this.result.set({
      stars,
      points: play.stats.points,
      best: this.scores.bestFor(this.levelId(), this.tempo()),
      newBest,
      bestStreak: play.stats.bestStreak,
      onBeat: play.stats.onBeat,
      timed: play.timed,
      firstTry: play.stats.firstTry,
      questions,
      picture,
      saveFailed: !saved,
    });
    this.finale.set(false);
  }

  protected celebrate() {
    const result = this.result();
    if (!result) return;
    if (
      this.completion.result()?.levelId === this.levelId() ||
      this.completion.finish({
        levelId: this.levelId(),
        completed: true,
        mastered: isMastered(this.stage(), result.stars),
        stars: result.stars,
      })
    )
      void this.router.navigate(['/complete', this.levelId()]);
    else this.result.set({ ...result, saveFailed: true });
  }

  protected pause() {
    if (!this.play() || this.paused() || this.result() || this.finale()) return;
    this.paused.set(true);
    this.pausedAt = this.sounds.now();
    this.sounds.pause();
    this.showDialog(true);
  }

  protected resume() {
    if (!this.paused()) return;
    this.showDialog(false);
    this.sounds.resume();
    const delta = this.sounds.now() - this.pausedAt;
    const play = this.play();
    this.paused.set(false);
    if (play) {
      this.play.set(shift(play, delta));
      const origin = this.origin() + delta;
      this.origin.set(origin);
      this.sounds.song({ level: this.stage().stage, origin, period: play.beat });
      if (play.held) this.sounds.hold(true);
    }
    this.focusAnswers();
  }

  protected restart() {
    this.showDialog(false);
    this.paused.set(false);
    this.begin();
  }

  protected toIntro() {
    this.showDialog(false);
    this.stop();
  }

  /** Escape on the pause dialog plays on rather than leaving it half-closed. */
  protected dialogCancel(event: Event) {
    event.preventDefault();
    this.resume();
  }

  protected visibilityChanged() {
    if (this.document.hidden) this.pause();
  }

  /** Keys 1–4 answer, Space or P pauses and plays on. */
  protected onKey(event: KeyboardEvent) {
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('input, textarea, select')) return;
    if (!this.started() || this.result()) return;
    if (event.key === ' ' || event.key.toLowerCase() === 'p') {
      // Space on a focused button presses it; only take it when it is not on one.
      if (event.key === ' ' && target?.closest('button, a')) return;
      event.preventDefault();
      if (this.paused()) this.resume();
      else this.pause();
      return;
    }
    if (this.paused()) return;
    const choice = this.choices()[Number(event.key) - 1];
    if (choice === undefined) return;
    event.preventDefault();
    this.choose(choice);
  }

  protected toggleSound() {
    this.sounds.toggle();
    if (this.sounds.enabled) this.sounds.unlock();
  }

  /** Opens or closes the pause dialog; old browsers without a modal dialog get the attribute. */
  private showDialog(open: boolean) {
    const dialog = this.pauseDialog()?.nativeElement;
    if (!dialog) return;
    if (open && typeof dialog.showModal === 'function') dialog.showModal();
    else if (!open && typeof dialog.close === 'function') dialog.close();
    else dialog.toggleAttribute('open', open);
  }

  private verseScore(verse: number) {
    const play = this.play();
    if (!play) return null;
    const total = play.mushrooms.filter((m) => m.verse === verse && !m.given).length;
    const first = this.answered().filter(
      (entry) => entry.firstTry && play.mushrooms[entry.index].verse === verse,
    ).length;
    return { first, total };
  }

  private bannerText(verse: number) {
    return verse === VERSES
      ? `${this.t('soloTitle')} ${this.t('soloHelp')}`
      : this.t('verseTitle', { n: verse + 1 });
  }

  /**
   * Lights the beat dots from the same clock the music uses, without change detection: the
   * visual twin of the beat for children playing with the sound off.
   */
  private watchBeat() {
    cancelAnimationFrame(this.frameHandle);
    const step = () => {
      const play = this.play();
      const dots = this.beatDots()?.nativeElement;
      if (dots && play) {
        const live = play.timed && !this.paused() && !play.held;
        const beat = live
          ? Math.floor((this.sounds.now() - this.origin()) / play.beat + 1e-3) % 4
          : -1;
        const value = String(beat < 0 ? -1 : (beat + 4) % 4);
        if (dots.dataset['beat'] !== value) dots.dataset['beat'] = value;
      }
      this.frameHandle = requestAnimationFrame(step);
    };
    this.frameHandle = requestAnimationFrame(step);
  }

  /** The buttons hop at once for a newcomer, otherwise once the question has waited a while. */
  private armGuide() {
    clearTimeout(this.guideTimer);
    if (guidedAnswers() < GUIDED_ANSWERS) {
      this.guide.set(true);
      return;
    }
    this.guide.set(false);
    this.guideTimer = setTimeout(() => {
      if (this.ask() !== null && !this.paused()) this.guide.set(true);
    }, GUIDE_IDLE_MS);
  }

  private stop() {
    clearTimeout(this.guideTimer);
    this.guide.set(false);
    clearInterval(this.ticker);
    clearTimeout(this.finaleTimer);
    cancelAnimationFrame(this.frameHandle);
    this.ticker = undefined;
    this.sounds.roll(false);
    this.sounds.stopSong();
    this.play.set(null);
    this.paused.set(false);
    this.finale.set(false);
    this.result.set(null);
    this.started.set(false);
  }

  private grace() {
    const calibrated = this.readCalibration();
    return GRACE_SECONDS + (calibrated ?? this.sounds.latency);
  }

  private focusAnswers() {
    requestAnimationFrame(() => {
      const active = this.document.activeElement;
      const host = this.host.nativeElement;
      if (active && active !== this.document.body && host.contains(active)) {
        if (!(active as HTMLButtonElement).disabled && active.closest('.answers, .skip')) return;
        if (!active.closest('.answers') && active.matches('button, a') && !active.closest('.hud'))
          return;
      }
      host.querySelector<HTMLElement>('.answer:not([aria-disabled="true"])')?.focus({
        preventScroll: true,
      });
    });
  }

  private readTempo(): DrumTempo {
    try {
      return parseDrumTempo(this.document.defaultView?.localStorage.getItem(TEMPO_KEY));
    } catch {
      return 'free';
    }
  }

  private readCalibration(): number | null {
    try {
      const value = Number(this.document.defaultView?.localStorage.getItem(CALIBRATION_KEY));
      return Number.isFinite(value) && value > 0 && value < 0.5 ? value : null;
    } catch {
      return null;
    }
  }

  /** Nothing to draw yet: the round has not started. */
  private idleFrame(): DrumFrame {
    return {
      round: 0,
      mushrooms: [],
      at: 0,
      hop: null,
      ask: null,
      ring: null,
      beat: null,
      now: this.sounds.now,
      waiting: false,
      held: false,
      stepHint: null,
      layers: 1,
      hits: 0,
      bonks: 0,
      solo: false,
      finished: false,
      paused: false,
    };
  }
}
