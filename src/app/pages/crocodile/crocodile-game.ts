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
import { CrocodileArt } from './crocodile-art';
import { crocodileText, CrocodileMessageKey } from './crocodile-messages';
import { comboFor, earnedHats, goldenSnacks, Hat, snackKind, snackPoints } from './crocodile-score';
import { CrocodileScores } from './crocodile-scores';
import { CrocodileSounds } from './crocodile-sounds';
import { HatWardrobe } from './hat-wardrobe';
import { PondScene } from './pond-scene';
interface Round {
  readonly questions: readonly ComparisonQuestion[];
  readonly golden: ReadonlySet<number>;
  readonly index: number;
  readonly mistakes: number;
  readonly streak: number;
  readonly attempts: number;
  readonly score: number;
  readonly phase: 'ready' | 'chomping' | 'complete';
  readonly chosen: Comparison | null;
}
type Banner = 'comboOn' | 'frenzy' | 'goldenSnack' | 'bossSnack';
const CHOMP_DELAY = 1400;
const BANNER_DELAY = 1800;
@Component({
  selector: 'app-crocodile-game',
  imports: [RouterLink, Icon, CrocodileArt, PondScene, HatWardrobe],
  providers: [CrocodileSounds],
  templateUrl: './crocodile-game.html',
  styleUrls: ['./crocodile-game.css', './crocodile-motion.css'],
  host: { '(document:keydown)': 'onKey($event)' },
})
export class CrocodileGame {
  protected readonly i = inject(LocaleService);
  private readonly p = inject(ProgressService);
  private readonly completion = inject(CompletionService);
  private readonly router = inject(Router);
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
  protected readonly best = computed(() => this.scores.best()[this.levelId()] ?? 0);
  protected readonly needsMaths = computed(() => {
    const question = this.question();
    return question.left.text.includes(' ') || question.right.text.includes(' ');
  });
  protected readonly showHint = computed(() => this.round().attempts > 0);
  protected readonly nextLink = computed(() => {
    const stage = this.stage();
    return stage && stage.stage < TOTAL_STAGES
      ? ['/adventure', `crocodile-${stage.stage + 1}`]
      : null;
  });
  protected readonly chapterLink = ['/worlds', 'numbers', 'chapters', 'compare-crocodile'];
  protected readonly message = computed(() => {
    const round = this.round();
    const { left, right, answer } = this.question();
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
      return praise + ' ' + this.t('points', { n: points });
    }
    if (this.wrongPick()) return this.t(answer === '=' ? 'wrongEqual' : 'wrong');
    if (round.attempts > 0) return this.t('hint', { left: left.value, right: right.value });
    const callout = this.banner();
    const prompt = this.t(this.needsMaths() ? 'computeFirst' : 'question');
    return callout === 'goldenSnack' || callout === 'bossSnack'
      ? this.t(callout) + ' ' + prompt
      : prompt;
  });
  private readonly outcome = viewChild<ElementRef<HTMLElement>>('outcome');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private timer?: ReturnType<typeof setTimeout>;
  private shake?: ReturnType<typeof setTimeout>;
  private bannerTimer?: ReturnType<typeof setTimeout>;
  private floatId = 0;
  constructor() {
    effect(() => {
      if (this.started()) this.p.explore('numbers');
    });
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.timer);
      clearTimeout(this.shake);
      clearTimeout(this.bannerTimer);
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
  protected play() {
    clearTimeout(this.timer);
    clearTimeout(this.bannerTimer);
    this.round.set(this.fresh());
    this.saveFailed.set(false);
    this.wrongPick.set(null);
    this.banner.set(null);
    this.floats.set([]);
    this.newHat.set(null);
    this.newBest.set(false);
    this.started.set(true);
    this.sounds.play('start');
    requestAnimationFrame(() =>
      this.host.nativeElement
        .querySelector<HTMLButtonElement>('.choice')
        ?.focus({ preventScroll: true }),
    );
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
    const points = snackPoints(this.kind(), streak);
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
    else if (this.kind() === 'golden') this.sounds.play('golden');
    this.timer = setTimeout(() => this.advance(), CHOMP_DELAY);
  }
  private callout(banner: Banner) {
    this.banner.set(banner);
    this.sounds.play(
      banner === 'frenzy'
        ? 'frenzy'
        : banner === 'comboOn'
          ? 'combo'
          : banner === 'goldenSnack'
            ? 'golden'
            : 'boss',
    );
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => this.banner.set(null), BANNER_DELAY);
  }
  private advance() {
    const round = this.round();
    this.floats.set([]);
    this.peek.set(null);
    if (round.index + 1 < ROUND_LENGTH) {
      const index = round.index + 1;
      this.round.set({ ...round, index, attempts: 0, phase: 'ready', chosen: null });
      const kind = snackKind(index, round.golden);
      if (kind === 'boss') this.callout('bossSnack');
      else if (kind === 'golden') this.callout('goldenSnack');
      return;
    }
    const hatsBefore = this.ownedHats();
    this.round.set({ ...round, phase: 'complete' });
    this.saveFailed.set(!this.record());
    this.newBest.set(this.scores.record(this.levelId(), round.score));
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
      streak: 0,
      attempts: 0,
      score: 0,
      phase: 'ready',
      chosen: null,
    };
  }
}
