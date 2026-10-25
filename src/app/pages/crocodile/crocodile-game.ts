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
  TOTAL_STAGES,
} from './comparison';
import { CrocodileArt } from './crocodile-art';
import { crocodileText, CrocodileMessageKey } from './crocodile-messages';
import { CrocodileSounds } from './crocodile-sounds';
interface Round {
  readonly questions: readonly ComparisonQuestion[];
  readonly index: number;
  readonly mistakes: number;
  readonly streak: number;
  readonly attempts: number;
  readonly phase: 'ready' | 'chomping' | 'complete';
  readonly chosen: Comparison | null;
}
const CHOMP_DELAY = 1400;
@Component({
  selector: 'app-crocodile-game',
  imports: [RouterLink, Icon, CrocodileArt],
  providers: [CrocodileSounds],
  templateUrl: './crocodile-game.html',
  styleUrl: './crocodile-game.css',
  host: { '(document:keydown)': 'onKey($event)' },
})
export class CrocodileGame {
  protected readonly i = inject(LocaleService);
  private readonly p = inject(ProgressService);
  private readonly completion = inject(CompletionService);
  private readonly router = inject(Router);
  protected readonly sounds = inject(CrocodileSounds);
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
  protected readonly choices: readonly Comparison[] = ['>', '=', '<'];
  protected readonly question = computed(
    () => this.round().questions[Math.min(this.round().index, ROUND_LENGTH - 1)],
  );
  protected readonly snacks = Array.from({ length: ROUND_LENGTH }, (_, index) => index);
  protected readonly stars = computed(() => roundStars(this.round().mistakes));
  protected readonly starSlots = [1, 2, 3];
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
    if (round.phase === 'chomping')
      return answer === '='
        ? this.t('correctEqual', { value: left.value, left: left.text, right: right.text })
        : this.t('correctBigger', {
            big: answer === '>' ? left.value : right.value,
            small: answer === '>' ? right.value : left.value,
            left: left.text,
            sign: answer,
            right: right.text,
          });
    if (this.wrongPick()) return this.t(answer === '=' ? 'wrongEqual' : 'wrong');
    if (round.attempts > 0) return this.t('hint', { left: left.value, right: right.value });
    return this.t(this.needsMaths() ? 'computeFirst' : 'question');
  });
  private readonly outcome = viewChild<ElementRef<HTMLElement>>('outcome');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private timer?: ReturnType<typeof setTimeout>;
  private shake?: ReturnType<typeof setTimeout>;
  constructor() {
    effect(() => {
      if (this.started()) this.p.explore('numbers');
    });
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.timer);
      clearTimeout(this.shake);
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
  protected label(choice: Comparison) {
    return this.t(choice === '>' ? 'eatsLeft' : choice === '<' ? 'eatsRight' : 'full');
  }
  protected play() {
    clearTimeout(this.timer);
    this.round.set(this.fresh());
    this.saveFailed.set(false);
    this.wrongPick.set(null);
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
    this.round.set({ ...round, phase: 'chomping', chosen: choice, streak: round.streak + 1 });
    this.sounds.play('chomp');
    this.timer = setTimeout(() => this.advance(), CHOMP_DELAY);
  }
  private advance() {
    const round = this.round();
    if (round.index + 1 < ROUND_LENGTH) {
      this.round.set({
        ...round,
        index: round.index + 1,
        attempts: 0,
        phase: 'ready',
        chosen: null,
      });
      return;
    }
    this.round.set({ ...round, phase: 'complete' });
    this.sounds.play('win');
    this.saveFailed.set(!this.record());
    requestAnimationFrame(() => this.outcome()?.nativeElement.focus({ preventScroll: true }));
  }
  private record() {
    const mistakes = this.round().mistakes;
    return this.completion.finish({
      levelId: this.levelId(),
      source: 'practice',
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
      index: 0,
      mistakes: 0,
      streak: 0,
      attempts: 0,
      phase: 'ready',
      chosen: null,
    };
  }
}
