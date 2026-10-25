import { DOCUMENT } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CompletionService } from '../../core/completion';
import { LocaleService } from '../../core/locale';
import { Icon } from '../../shared/icon';
import { GameAudio } from '../fairy-defense/game-audio';
import { PlaytestStore } from '../fairy-defense/playtest-store';
import { Comparison, createRound, Pond, ponds, Relation, ROUND_SIZE, starsFor } from './compare';
import { Croc } from './croc';
import { CrocMessageKey, crocText } from './crocodile-messages';
import { CrocodileStore } from './crocodile-store';
import { NumberAid } from './number-aid';
export const CROCODILE_LEVEL_ID = 'hungry-crocodile';
type Phase = 'ready' | 'wrong' | 'correct' | 'complete';
@Component({
  selector: 'app-crocodile',
  imports: [RouterLink, Icon, Croc, NumberAid],
  providers: [GameAudio],
  templateUrl: './crocodile.component.html',
  styleUrl: './crocodile.component.css',
  host: { '(document:keydown)': 'onKey($event)' },
})
export class CrocodileComponent {
  protected readonly i = inject(LocaleService);
  protected readonly store = inject(CrocodileStore);
  protected readonly audio = inject(GameAudio);
  protected readonly sound = inject(PlaytestStore);
  private readonly completion = inject(CompletionService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  protected readonly ponds = ponds;
  protected readonly total = ROUND_SIZE;
  protected readonly steps = Array.from({ length: ROUND_SIZE }, (_, index) => index);
  protected readonly starSlots = [1, 2, 3];
  protected readonly chapterLink = ['/worlds', 'numbers', 'chapters', 'compare-numbers'];
  protected readonly pond = signal<Pond | null>(null);
  protected readonly round = signal<readonly Comparison[]>([]);
  protected readonly index = signal(0);
  protected readonly phase = signal<Phase>('ready');
  protected readonly attempts = signal(0);
  protected readonly firstTry = signal(0);
  protected readonly streak = signal(0);
  protected readonly bestStreak = signal(0);
  protected readonly helpVisible = signal(false);
  protected readonly chosen = signal<Relation | null>(null);
  protected readonly recorded = signal(false);
  protected readonly question = computed(() => this.round()[this.index()]);
  protected readonly stars = computed(() => starsFor(this.firstTry()));
  protected readonly soundOn = computed(() => this.sound.audio().effects);
  protected readonly nextPond = computed(() => {
    const next = ponds.find((entry) => entry.number === (this.pond()?.number ?? 0) + 1);
    return next && this.store.isOpen(next.number) ? next : undefined;
  });
  /** Kiki looks at the bigger side once the answer is known, otherwise waits with a closed mouth. */
  protected readonly facing = computed<'left' | 'right' | 'equal'>(() => {
    const answer = this.question()?.answer;
    if (this.phase() !== 'correct' && this.phase() !== 'complete') return 'equal';
    return answer === '>' ? 'left' : answer === '<' ? 'right' : 'equal';
  });
  protected readonly mood = computed<'idle' | 'chomp' | 'happy' | 'oops'>(() => {
    const phase = this.phase();
    if (phase === 'complete') return 'happy';
    if (phase === 'wrong') return 'oops';
    if (phase === 'correct') return this.question()?.answer === '=' ? 'happy' : 'chomp';
    return 'idle';
  });
  protected readonly hintText = computed(() => {
    const pond = this.pond();
    const question = this.question();
    if (!pond || !question) return '';
    if (pond.kind === 'big') return this.t('hintTens');
    const calculations = [question.left, question.right]
      .filter((side) => /[+−]/.test(side.text))
      .map((side) => this.t('hintCompute', { expr: side.text, value: side.value }));
    return calculations.length ? calculations.join(' ') : this.t('hintCount');
  });
  protected readonly message = computed(() => {
    const question = this.question();
    if (!question) return '';
    const values = { a: question.left.text, b: question.right.text };
    switch (this.phase()) {
      case 'correct':
        return this.t(
          question.answer === '>' ? 'eatLeft' : question.answer === '<' ? 'eatRight' : 'same',
          values,
        );
      case 'wrong':
        return this.t('wrong');
      case 'complete':
        return (
          this.t('roundDone') + ' ' + this.t('firstTry', { n: this.firstTry(), total: ROUND_SIZE })
        );
      default: {
        const asked = this.helpVisible() && this.pond()?.kind !== 'pond';
        const hint = this.attempts() || asked ? ' ' + this.hintText() : '';
        return (this.attempts() ? this.t('wrong') : this.t('prompt', values)) + hint;
      }
    }
  });
  private readonly firstAnswer = viewChild<ElementRef<HTMLButtonElement>>('firstAnswer');
  private readonly outcome = viewChild<ElementRef<HTMLElement>>('outcome');
  private timer?: ReturnType<typeof setTimeout>;
  constructor() {
    effect(() => this.audio.updateVoice(this.i.locale()));
    inject(DestroyRef).onDestroy(() => this.clearTimer());
  }
  protected t(key: CrocMessageKey, values: Record<string, number | string> = {}) {
    return crocText(this.i.locale(), key, values);
  }
  protected start(pond: Pond) {
    if (!this.store.isOpen(pond.number)) return;
    this.clearTimer();
    this.pond.set(pond);
    this.round.set(createRound(pond));
    this.index.set(0);
    this.attempts.set(0);
    this.firstTry.set(0);
    this.streak.set(0);
    this.bestStreak.set(0);
    this.chosen.set(null);
    this.recorded.set(false);
    this.helpVisible.set(pond.kind === 'pond');
    this.phase.set('ready');
    this.audio.start();
    this.audio.speak(this.message());
    this.focusAnswers();
  }
  protected choose(relation: Relation) {
    const question = this.question();
    if (!this.pond() || this.phase() !== 'ready' || !question) return;
    this.chosen.set(relation);
    if (relation === question.answer) {
      if (this.attempts() === 0) this.firstTry.update((count) => count + 1);
      this.streak.update((count) => count + 1);
      this.bestStreak.update((best) => Math.max(best, this.streak()));
      this.phase.set('correct');
      this.audio.effect('correct');
      this.audio.speak(this.message());
      this.schedule(() => this.next(), 1500);
      return;
    }
    this.attempts.update((count) => count + 1);
    this.streak.set(0);
    this.helpVisible.set(true);
    this.phase.set('wrong');
    this.audio.effect('wrong');
    this.schedule(() => {
      this.phase.set('ready');
      this.chosen.set(null);
      this.audio.speak(this.message());
      this.focusAnswers();
    }, 900);
  }
  protected help() {
    this.helpVisible.set(true);
    this.audio.speak(this.hintText());
  }
  protected showPonds() {
    this.clearTimer();
    this.pond.set(null);
    this.phase.set('ready');
    this.audio.pause();
  }
  protected toggleSound() {
    const on = !this.sound.audio().effects;
    if (this.sound.audio().effects !== on) this.sound.toggle('effects');
    if (this.sound.audio().music !== on) this.sound.toggle('music');
    this.audio.sync();
  }
  protected celebrate() {
    if (this.recorded()) void this.router.navigate(['/complete', CROCODILE_LEVEL_ID]);
  }
  protected onKey(event: KeyboardEvent) {
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || !this.pond()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.showPonds();
      return;
    }
    const relation: Relation | undefined =
      event.key === 'ArrowLeft' || event.key === '>'
        ? '>'
        : event.key === 'ArrowRight' || event.key === '<'
          ? '<'
          : event.key === 'ArrowDown' || event.key === '='
            ? '='
            : undefined;
    if (!relation) return;
    event.preventDefault();
    this.choose(relation);
  }
  private next() {
    const pond = this.pond();
    if (!pond) return;
    if (this.index() + 1 >= ROUND_SIZE) {
      this.finish(pond);
      return;
    }
    this.index.update((index) => index + 1);
    this.attempts.set(0);
    this.chosen.set(null);
    this.helpVisible.set(pond.kind === 'pond');
    this.phase.set('ready');
    this.audio.speak(this.message());
    this.focusAnswers();
  }
  private finish(pond: Pond) {
    this.phase.set('complete');
    this.audio.effect('complete');
    const stars = this.stars();
    this.store.record(pond.number, stars, this.bestStreak());
    this.recorded.set(
      stars > 0 &&
        this.completion.finish({
          levelId: CROCODILE_LEVEL_ID,
          source: 'practice',
          completed: true,
          mastered: this.store.mastered(),
          stars,
        }),
    );
    this.audio.speak(this.message());
    requestAnimationFrame(() => this.outcome()?.nativeElement.focus({ preventScroll: true }));
  }
  private schedule(action: () => void, delay: number) {
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.timer = undefined;
      action();
    }, delay);
  }
  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }
  private focusAnswers() {
    if (!this.document.defaultView) return;
    requestAnimationFrame(() => this.firstAnswer()?.nativeElement.focus({ preventScroll: true }));
  }
}
