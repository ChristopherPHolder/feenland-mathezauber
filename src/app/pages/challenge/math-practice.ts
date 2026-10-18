import {
  afterRenderEffect,
  ElementRef,
  viewChild,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { form, FormField } from '@angular/forms/signals';
import { LocaleService } from '../../core/locale';
import { createRound, Difficulty, Pace, PracticeConfig, Question } from '../../core/practice';
@Component({
  selector: 'app-math-practice',
  imports: [FormField],
  template: `
    <p>
      {{ i.t('stage') }} {{ config().stage }} / 9 · {{ i.t(config().skill) }} · {{ i.t('upTo') }}
      {{ config().max }}
    </p>
    @if (!started()) {
      <p class="example">{{ config().example }}</p>
      <div class="preferences">
        <fieldset>
          <legend>{{ i.t('difficulty') }}</legend>
          @for (option of difficulties; track option) {
            <label
              ><input type="radio" [value]="option" [formField]="settings.difficulty" />
              {{ i.t(option) }}</label
            >
          }
        </fieldset>
        <fieldset>
          <legend>{{ i.t('pace') }}</legend>
          @for (option of paces; track option) {
            <label
              ><input type="radio" [value]="option" [formField]="settings.pace" />
              {{ i.t(option) }}</label
            >
          }
        </fieldset>
      </div>
      <p>{{ i.t('paceHelp') }}</p>
      <button class="button primary" (click)="start()">{{ i.t('startRound') }}</button>
    } @else if (done()) {
      <h2 #doneHeading tabindex="-1">{{ i.t('roundDone') }}</h2>
      <p>{{ i.t('completedLabel') }}: {{ questions().length }} / {{ questions().length }}</p>
      <button class="button primary" (click)="completed.emit()">{{ i.t('continue') }}</button>
    } @else {
      <p>
        {{ i.t('questionLabel') }} {{ index() + 1 }} / {{ questions().length }} ·
        {{ i.t(options().difficulty) }} · {{ i.t(options().pace) }}
      </p>
      @if (options().pace !== 'relaxed') {
        <p role="timer" [attr.aria-label]="i.t('pace')">{{ remaining() }} s</p>
        <button class="button secondary" (click)="paused.set(!paused())">
          {{ i.t(paused() ? 'resume' : 'pause') }}
        </button>
      }
      @if (!paused()) {
        <h2 class="equation">{{ current()?.text }}</h2>
        <form (submit)="check(); $event.preventDefault()">
          <label for="answer">{{ i.t('answerLabel') }}</label>
          <input
            id="answer"
            #answerInput
            type="text"
            inputmode="numeric"
            autocomplete="off"
            [formField]="answerForm.answer"
            [readOnly]="correct()"
          />
          <button class="button primary" type="submit" [disabled]="correct()">
            {{ i.t('checkAnswer') }}
          </button>
        </form>
        <p role="status">{{ feedback() ? i.t(correct() ? 'correctAnswer' : 'tryAgain') : '' }}</p>
        @if (remaining() === 0 && options().pace !== 'relaxed' && !correct()) {
          <p role="status">{{ i.t('timeHelp') }}</p>
        }
        @if (correct()) {
          <button #nextButton class="button primary" (click)="next()">
            {{ i.t('nextQuestion') }}
          </button>
        }
      }
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .preferences {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 24px;
    }
    fieldset {
      border: 1px solid #4c6079;
      border-radius: 16px;
      padding: 16px;
      min-width: 0;
    }
    legend {
      font-weight: 600;
      padding: 0 8px;
    }
    fieldset label {
      display: flex;
      gap: 12px;
      align-items: center;
      min-height: 48px;
    }
    input[type='radio'] {
      width: 22px;
      height: 22px;
      accent-color: #c91860;
    }
    .equation,
    .example {
      font-size: clamp(26px, 5vw, 40px);
      font-variant-numeric: tabular-nums;
    }
    form {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      align-items: center;
    }
    form label {
      width: 100%;
    }
    #answer {
      width: 110px;
      min-height: 56px;
      padding: 8px;
      font: inherit;
      font-size: 24px;
      border: 2px solid #4c6079;
      border-radius: 12px;
      color: #172555;
      background: white;
    }
    button {
      margin: 12px 0;
    }
    [role='status'] {
      min-height: 26px;
    }
  `,
})
export class MathPractice {
  readonly config = input.required<PracticeConfig>();
  readonly completed = output<void>();
  protected readonly i = inject(LocaleService);
  private readonly document = inject(DOCUMENT);
  protected readonly difficulties = ['easy', 'medium', 'hard'] as const;
  protected readonly paces = ['relaxed', 'steady', 'quick'] as const;
  protected readonly options = signal<{ difficulty: Difficulty; pace: Pace }>(this.restore());
  protected readonly settings = form(this.options);
  protected readonly answer = signal({ answer: '' });
  protected readonly answerForm = form(this.answer);
  protected readonly questions = signal<readonly Question[]>([]);
  protected readonly index = signal(0);
  protected readonly started = signal(false);
  protected readonly paused = signal(false);
  protected readonly remaining = signal(0);
  protected readonly correct = signal(false);
  protected readonly feedback = signal(false);
  protected readonly done = computed(
    () => this.started() && this.index() >= this.questions().length,
  );
  protected readonly current = computed(() => this.questions()[this.index()]);
  private readonly answerInput = viewChild<ElementRef<HTMLInputElement>>('answerInput');
  private readonly nextButton = viewChild<ElementRef<HTMLButtonElement>>('nextButton');
  private readonly doneHeading = viewChild<ElementRef<HTMLElement>>('doneHeading');
  constructor() {
    afterRenderEffect(() => {
      this.index();
      const target = this.done()
        ? this.doneHeading()
        : this.correct()
          ? this.nextButton()
          : this.answerInput();
      target?.nativeElement.focus();
    });
    effect(() => {
      const options = this.options();
      try {
        this.document.defaultView?.localStorage.setItem(
          'feenland.practice-options',
          JSON.stringify(options),
        );
      } catch {
        /* Preferences still work in memory. */
      }
    });
    effect((cleanup) => {
      if (
        !this.started() ||
        this.done() ||
        this.paused() ||
        this.correct() ||
        this.options().pace === 'relaxed'
      )
        return;
      const timer = setInterval(() => this.remaining.update((n) => Math.max(0, n - 1)), 1000);
      cleanup(() => clearInterval(timer));
    });
  }
  protected start() {
    this.questions.set(createRound(this.config(), this.options().difficulty));
    this.index.set(0);
    this.resetQuestion();
    this.started.set(true);
  }
  protected check() {
    if (this.correct() || this.paused()) return;
    const raw = this.answer().answer.trim();
    this.correct.set(/^\d+$/.test(raw) && Number(raw) === this.current()?.answer);
    this.feedback.set(true);
  }
  protected next() {
    if (!this.correct()) return;
    this.index.update((n) => n + 1);
    this.resetQuestion();
  }
  private resetQuestion() {
    this.answer.set({ answer: '' });
    this.correct.set(false);
    this.feedback.set(false);
    this.remaining.set(this.options().pace === 'quick' ? 20 : 45);
  }
  private restore(): { difficulty: Difficulty; pace: Pace } {
    try {
      const value: unknown = JSON.parse(
        this.document.defaultView?.localStorage.getItem('feenland.practice-options') ?? 'null',
      );
      if (value && typeof value === 'object' && 'difficulty' in value && 'pace' in value) {
        const { difficulty, pace } = value;
        if (
          (difficulty === 'easy' || difficulty === 'medium' || difficulty === 'hard') &&
          (pace === 'relaxed' || pace === 'steady' || pace === 'quick')
        )
          return { difficulty, pace };
      }
    } catch {
      /* Use defaults for unavailable or invalid storage. */
    }
    return { difficulty: 'medium', pace: 'relaxed' };
  }
}
