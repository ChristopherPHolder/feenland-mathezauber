import { DOCUMENT } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
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
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CompletionService } from '../../core/completion';
import { LocaleService } from '../../core/locale';
import { MessageKey } from '../../core/messages';
import { ProgressService } from '../../core/progress';
import { GameHeader } from '../../shared/game-header';
import { Icon } from '../../shared/icon';
import {
  Comparison,
  ComparisonQuestion,
  comparisonStage,
  createComparisonRound,
  isMastered,
  ROUND_LENGTH,
  roundStars,
  Side,
  TOTAL_STAGES,
} from './comparison';
import { BUBBLE_PACES, BubblePace, readBubblePace, saveBubblePace } from './bubble-pace';
import { CrocodileArt } from './crocodile-art';
import { crocodileText, CrocodileMessageKey } from './crocodile-messages';
import {
  comboFor,
  earnedHats,
  goldenSnacks,
  Hat,
  quickBonus,
  snackKind,
  snackPoints,
} from './crocodile-score';
import { CrocodileScores } from './crocodile-scores';
import { CrocodileSounds } from './crocodile-sounds';
import { HatWardrobe } from './hat-wardrobe';
import { Heron } from './heron';
import { PondScene } from './pond-scene';
interface Round {
  readonly questions: readonly ComparisonQuestion[];
  readonly golden: ReadonlySet<number>;
  readonly index: number;
  readonly mistakes: number;
  readonly stolen: number;
  readonly streak: number;
  readonly attempts: number;
  readonly score: number;
  readonly phase: 'ready' | 'chomping' | 'stolen' | 'complete';
  readonly chosen: Comparison | null;
}
interface HeronFlight {
  readonly target: 'left' | 'right' | 'center';
  readonly duration: number;
  readonly state: 'flying' | 'stole' | 'shooed';
  readonly paused: boolean;
}
type Banner = 'comboOn' | 'frenzy' | 'goldenSnack' | 'bossSnack' | 'heronComing' | 'quick';
const CHOMP_DELAY = 1400;
const BANNER_DELAY = 1800;
const BOSS_EXTRA = 3000;
@Component({
  selector: 'app-crocodile-game',
  imports: [RouterLink, Icon, GameHeader, CrocodileArt, PondScene, HatWardrobe, Heron],
  providers: [CrocodileSounds],
  templateUrl: './crocodile-game.html',
  styleUrls: [
    './crocodile-game.css',
    './crocodile-motion.css',
    './crocodile-responsive.css',
    './crocodile-heron.css',
  ],
  host: {
    '(document:keydown)': 'onKey($event)',
    '(document:visibilitychange)': 'visibilityChanged()',
  },
})
export class CrocodileGame {
  protected readonly i = inject(LocaleService);
  private readonly p = inject(ProgressService);
  private readonly completion = inject(CompletionService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  protected readonly sounds = inject(CrocodileSounds);
  protected readonly scores = inject(CrocodileScores);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap);
  protected readonly total = TOTAL_STAGES;
  protected readonly roundLength = ROUND_LENGTH;
  protected readonly stage = computed(() => comparisonStage(this.params()?.get('id')));
  protected readonly levelId = computed(() => `crocodile-${this.stage()?.stage ?? 1}`);
  protected readonly round = linkedSignal<Round>(() => this.fresh());
  protected readonly started = linkedSignal<boolean>(() => {
    this.stage();
    return false;
  });
  /** The pace sets how fast the heron flies; "off" is the calm pond with no heron at all. */
  protected readonly paces = BUBBLE_PACES;
  protected readonly pace = signal<BubblePace>(readBubblePace());
  protected readonly timed = computed(() => this.pace() !== 'off');
  protected readonly selectedPace = computed(() =>
    this.paces.find((pace) => pace.id === this.pace())!,
  );
  protected readonly heron = signal<HeronFlight | null>(null);
  protected readonly saveFailed = signal(false);
  protected readonly wrongPick = signal<Comparison | null>(null);
  /** The choice a child hovers or focuses: Kiki turns toward it before they commit. */
  protected readonly peek = signal<Comparison | null>(null);
  protected readonly banner = signal<Banner | null>(null);
  protected readonly floats = signal<readonly { id: number; points: number }[]>([]);
  protected readonly newHat = signal<Hat | null>(null);
  protected readonly newBest = signal(false);
  protected readonly choices: readonly Comparison[] = ['>', '=', '<'];
  protected readonly pose = computed(
    () => this.round().chosen ?? (this.round().phase === 'ready' ? this.peek() : null),
  );
  protected readonly question = computed(
    () => this.round().questions[Math.min(this.round().index, ROUND_LENGTH - 1)],
  );
  protected readonly snacks = Array.from({ length: ROUND_LENGTH }, (_, index) => index);
  protected readonly stars = computed(() => roundStars(this.round().mistakes));
  protected readonly starSlots = [1, 2, 3];
  protected readonly kind = computed(() => snackKind(this.round().index, this.round().golden));
  protected readonly combo = computed(() => comboFor(this.round().streak));
  protected readonly frenzy = computed(() => this.combo() === 3);
  /** Kiki wears the newest hat she has earned; the wardrobe shows the whole collection. */
  protected readonly ownedHats = computed(() => earnedHats(this.p.progress()));
  protected readonly hat = computed(() => this.ownedHats().at(-1)?.id ?? 'none');
  protected readonly bestKey = computed(() =>
    this.timed() ? this.levelId() + '/race' : this.levelId(),
  );
  protected readonly best = computed(() => this.scores.best()[this.bestKey()] ?? 0);
  protected readonly needsMaths = computed(() => {
    const question = this.question();
    return question.left.text.includes(' ') || question.right.text.includes(' ');
  });
  /** Seconds per snack from the chosen pace, in milliseconds; the big fish gets a little extra. */
  protected readonly flightTime = computed(() => {
    const pace = this.selectedPace();
    const seconds = this.needsMaths() ? pace.mathsSeconds : pace.seconds;
    return seconds * 1000 + (this.kind() === 'boss' ? BOSS_EXTRA : 0);
  });
  protected readonly showHint = computed(() => this.round().attempts > 0);
  protected readonly nextLink = computed(() => {
    const stage = this.stage();
    return stage && stage.stage < TOTAL_STAGES
      ? ['/adventure', `crocodile-${stage.stage + 1}`]
      : null;
  });
  /** Every crocodile level is one tap away from the intro, in any order. */
  protected readonly levelLinks = Array.from({ length: TOTAL_STAGES }, (_, index) => ({
    stage: index + 1,
    route: ['/adventure', `crocodile-${index + 1}`],
  }));
  protected readonly message = computed(() => {
    const round = this.round();
    const { left, right, answer } = this.question();
    if (round.phase === 'stolen') return this.t('stolen');
    if (round.phase === 'chomping') {
      const points = this.floats().at(-1)?.points ?? 0;
      const praise =
        answer === '='
          ? this.t('correctEqual', { value: left.value, left: left.text, right: right.text })
          : this.t('correctBigger', {
              big: answer === '>' ? left.value : right.value,
              small: answer === '>' ? right.value : left.value,
              left: left.text,
              sign: answer,
              right: right.text,
            });
      const shoo = this.heron()?.state === 'shooed' ? ' ' + this.t('shoo') : '';
      return praise + ' ' + this.t('points', { n: points }) + shoo;
    }
    if (this.wrongPick()) return this.t(answer === '=' ? 'wrongEqual' : 'wrong');
    if (round.attempts > 0) return this.t('hint', { left: left.value, right: right.value });
    const callout = this.banner();
    const prompt = this.t(this.needsMaths() ? 'computeFirst' : 'question');
    return callout === 'goldenSnack' || callout === 'bossSnack' || callout === 'heronComing'
      ? this.t(callout) + ' ' + prompt
      : prompt;
  });
  private readonly outcome = viewChild<ElementRef<HTMLElement>>('outcome');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private timer?: ReturnType<typeof setTimeout>;
  private shake?: ReturnType<typeof setTimeout>;
  private bannerTimer?: ReturnType<typeof setTimeout>;
  private heronTimer?: ReturnType<typeof setTimeout>;
  private heronDue = 0;
  private heronRemaining = 0;
  private floatId = 0;
  constructor() {
    effect(() => {
      if (this.started()) this.p.explore('numbers');
    });
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.timer);
      clearTimeout(this.shake);
      clearTimeout(this.bannerTimer);
      clearTimeout(this.heronTimer);
    });
  }
  protected t(key: CrocodileMessageKey, values: Record<string, string | number> = {}) {
    return crocodileText(this.i.locale(), key, { total: ROUND_LENGTH, ...values });
  }
  protected levelKey(stage: number) {
    return `crocodile${stage}` as MessageKey;
  }
  protected helpKey(stage: number) {
    return `crocodile${stage}Help` as MessageKey;
  }
  protected tokens(side: Side): readonly string[] {
    return side.text.split(' ');
  }
  protected label(choice: Comparison) {
    return this.t(choice === '>' ? 'eatsLeft' : choice === '<' ? 'eatsRight' : 'full');
  }
  protected peekAt(choice: Comparison | null) {
    this.peek.set(choice);
  }
  protected selectPace(pace: BubblePace) {
    this.pace.set(pace);
    saveBubblePace(pace);
    if (!this.started()) return;
    if (pace === 'off') this.stopHeron();
    else if (!this.heron() && this.round().phase === 'ready') this.launchHeron();
    requestAnimationFrame(() =>
      this.host.nativeElement
        .querySelector<HTMLElement>('.choices')
        ?.focus({ preventScroll: true }),
    );
  }
  protected play() {
    clearTimeout(this.timer);
    clearTimeout(this.bannerTimer);
    this.stopHeron();
    this.round.set(this.fresh());
    this.saveFailed.set(false);
    this.wrongPick.set(null);
    this.banner.set(null);
    this.floats.set([]);
    this.newHat.set(null);
    this.newBest.set(false);
    this.started.set(true);
    this.sounds.play('start');
    if (this.timed()) this.callout('heronComing');
    this.launchHeron();
    requestAnimationFrame(() =>
      this.host.nativeElement
        .querySelector<HTMLElement>('.choices')
        ?.focus({ preventScroll: true }),
    );
  }
  /** Tapping a lily pad feeds Kiki that side; tapping Kiki herself says both sides are the same. */
  protected tap(where: 'left' | 'right' | 'center') {
    this.choose(where === 'left' ? '>' : where === 'right' ? '<' : '=');
  }
  protected choose(choice: Comparison) {
    const round = this.round();
    if (!this.started() || round.phase !== 'ready') return;
    if (choice !== this.question().answer) {
      this.round.set({
        ...round,
        attempts: round.attempts + 1,
        mistakes: round.mistakes + (round.attempts === 0 ? 1 : 0),
        streak: 0,
      });
      this.wrongPick.set(choice);
      this.sounds.play('wrong');
      clearTimeout(this.shake);
      this.shake = setTimeout(() => this.wrongPick.set(null), 900);
      return;
    }
    this.wrongPick.set(null);
    // Only a first-try snack keeps the combo growing; a corrected one still scores base points.
    const streak = round.attempts === 0 ? round.streak + 1 : 0;
    const bonus = this.shooHeron();
    const points = snackPoints(this.kind(), streak) + bonus;
    this.round.set({
      ...round,
      phase: 'chomping',
      chosen: choice,
      streak,
      score: round.score + points,
    });
    this.floats.update((floats) => [...floats, { id: ++this.floatId, points }]);
    this.sounds.play(choice === '=' ? 'splash' : 'chomp');
    if (streak === 6) this.callout('frenzy');
    else if (streak === 3) this.callout('comboOn');
    else if (bonus >= 15) this.callout('quick');
    else if (this.kind() === 'golden') this.sounds.play('golden');
    this.timer = setTimeout(() => this.advance(), CHOMP_DELAY);
  }
  private callout(banner: Banner) {
    this.banner.set(banner);
    this.sounds.play(
      banner === 'frenzy'
        ? 'frenzy'
        : banner === 'comboOn' || banner === 'quick'
          ? 'combo'
          : banner === 'goldenSnack'
            ? 'golden'
            : banner === 'heronComing'
              ? 'swoop'
              : 'boss',
    );
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => this.banner.set(null), BANNER_DELAY);
  }
  private launchHeron() {
    if (!this.timed() || this.round().phase !== 'ready') return;
    const answer = this.question().answer;
    const duration = this.flightTime();
    this.heron.set({
      target: answer === '>' ? 'left' : answer === '<' ? 'right' : 'center',
      duration,
      state: 'flying',
      paused: false,
    });
    this.heronRemaining = duration;
    this.armHeron();
  }
  private armHeron() {
    this.heronDue = Date.now() + this.heronRemaining;
    this.heronTimer = setTimeout(() => this.steal(), this.heronRemaining);
  }
  /** Returns the quick bonus for beating the heron, or 0 when it is not racing. */
  private shooHeron(): number {
    const heron = this.heron();
    if (!heron || heron.state !== 'flying') return 0;
    clearTimeout(this.heronTimer);
    const remaining = Math.max(0, this.heronDue - Date.now()) / heron.duration;
    this.heron.set({ ...heron, state: 'shooed', paused: false });
    this.sounds.play('shoo');
    return quickBonus(remaining);
  }
  private steal() {
    const round = this.round();
    const heron = this.heron();
    if (round.phase !== 'ready' || !heron) return;
    this.wrongPick.set(null);
    this.peek.set(null);
    this.heron.set({ ...heron, state: 'stole', paused: false });
    this.round.set({
      ...round,
      phase: 'stolen',
      mistakes: round.mistakes + (round.attempts === 0 ? 1 : 0),
      stolen: round.stolen + 1,
      streak: 0,
    });
    this.sounds.play('steal');
    this.timer = setTimeout(() => this.advance(), CHOMP_DELAY);
  }
  private stopHeron() {
    clearTimeout(this.heronTimer);
    this.heronTimer = undefined;
    this.heron.set(null);
  }
  protected visibilityChanged() {
    const heron = this.heron();
    if (!heron || heron.state !== 'flying' || this.round().phase !== 'ready') return;
    if (this.document.hidden && !heron.paused) {
      clearTimeout(this.heronTimer);
      this.heronRemaining = Math.max(0, this.heronDue - Date.now());
      this.heron.set({ ...heron, paused: true });
    } else if (!this.document.hidden && heron.paused) {
      this.heron.set({ ...heron, paused: false });
      this.armHeron();
    }
  }
  private advance() {
    const round = this.round();
    this.floats.set([]);
    this.peek.set(null);
    this.stopHeron();
    if (round.index + 1 < ROUND_LENGTH) {
      const index = round.index + 1;
      this.round.set({ ...round, index, attempts: 0, phase: 'ready', chosen: null });
      const kind = snackKind(index, round.golden);
      if (kind === 'boss') this.callout('bossSnack');
      else if (kind === 'golden') this.callout('goldenSnack');
      this.launchHeron();
      return;
    }
    const hatsBefore = this.ownedHats();
    this.round.set({ ...round, phase: 'complete' });
    this.saveFailed.set(!this.record());
    this.newBest.set(this.scores.record(this.bestKey(), round.score));
    const unlocked = this.ownedHats().find((hat) => !hatsBefore.includes(hat)) ?? null;
    this.newHat.set(unlocked);
    this.sounds.play(unlocked ? 'hat' : 'win');
    requestAnimationFrame(() => this.outcome()?.nativeElement.focus({ preventScroll: true }));
  }
  private record() {
    const mistakes = this.round().mistakes;
    return this.completion.finish({
      levelId: this.levelId(),
      completed: true,
      mastered: isMastered(mistakes),
      stars: roundStars(mistakes),
    });
  }
  protected celebrate() {
    if (this.completion.result()?.levelId === this.levelId() || this.record())
      void this.router.navigate(['/complete', this.levelId()]);
    else this.saveFailed.set(true);
  }
  protected onKey(event: KeyboardEvent) {
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || !this.started()) return;
    const choice = {
      ArrowLeft: '>',
      ArrowRight: '<',
      ArrowDown: '=',
      '<': '<',
      '>': '>',
      '=': '=',
    }[event.key] as Comparison | undefined;
    if (!choice) return;
    event.preventDefault();
    this.choose(choice);
  }
  private fresh(): Round {
    const stage = this.stage();
    return {
      questions: stage
        ? createComparisonRound(stage)
        : Array<ComparisonQuestion>(ROUND_LENGTH).fill({
            left: { text: '1', value: 1 },
            right: { text: '2', value: 2 },
            answer: '<',
          }),
      golden: goldenSnacks(),
      index: 0,
      mistakes: 0,
      stolen: 0,
      streak: 0,
      attempts: 0,
      score: 0,
      phase: 'ready',
      chosen: null,
    };
  }
}
