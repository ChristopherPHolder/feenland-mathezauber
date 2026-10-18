import {
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormField, form, maxLength, pattern } from '@angular/forms/signals';
import { NumberHops } from './number-hops/number-hops';
import { FIRST_ROUND, bridgePlan, newRound } from './bridge-math';

@Component({
  selector: 'app-number-bridge',
  imports: [RouterLink, FormField, NumberHops],
  styleUrl: './number-bridge.css',
  templateUrl: './number-bridge.html',
})
export class NumberBridge {
  protected readonly phase = signal<'intro' | 'play' | 'complete'>('intro');
  protected readonly questions = signal([...FIRST_ROUND]);
  protected readonly index = signal(0);
  protected readonly hopIndex = signal(0);
  protected readonly help = signal(false);
  protected readonly solved = signal(false);
  protected readonly message = signal('');
  protected readonly error = signal(false);
  protected readonly answerModel = signal({ answer: '' });
  protected readonly answerForm = form(this.answerModel, (path) => {
    maxLength(path.answer, 2);
    pattern(path.answer, /^\d{0,2}$/);
  });
  protected readonly digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
  protected readonly problem = computed(() => this.questions()[this.index()]);
  protected readonly plan = computed(() => bridgePlan(this.problem()));
  protected readonly guided = computed(() => this.index() < 4 || this.help());
  protected readonly isHop = computed(
    () => this.guided() && this.hopIndex() < this.plan().hops.length,
  );
  protected readonly earned = computed(() => this.index() + (this.solved() ? 1 : 0));
  protected readonly expected = computed(() =>
    this.isHop() ? this.plan().hops[this.hopIndex()] : this.plan().answer,
  );
  protected readonly instruction = computed(() => {
    const p = this.plan();
    if (!this.isHop()) return 'Welche Zahl gehört in die Lücke?';
    if (this.hopIndex() === 0) {
      return p.bridge === null
        ? `Von ${p.start} bis ${p.findLanding ? '?' : p.end}: Wie groß ist der Hüpfer?`
        : `Erst zum Zehner: Wie viel fehlt von ${p.start} bis ${p.bridge}?`;
    }
    return p.findLanding
      ? `Insgesamt hüpfst du ${p.distance} weiter. ${p.hops[0]} hast du geschafft. Wie viel bleibt noch?`
      : `Und weiter: Wie viel fehlt von ${p.bridge} bis ${p.end}?`;
  });
  protected readonly strategy = computed(() => {
    const p = this.plan();
    if (p.findLanding)
      return `Hole die ${this.problem().right} wieder dazu: Starte bei ${p.start} und hüpfe ${p.distance} weiter. Gesucht ist dein Ziel!`;
    if (this.problem().operator === '−')
      return `Wie viel wurde weggenommen? Hüpfe von ${p.start} bis ${p.end}. Zähle die Hüpfer zusammen.`;
    return `Starte bei ${p.start} und hüpfe bis ${p.end}. Die Hüpfer zusammen sind die fehlende Zahl. Beim Plus darfst du die Zahlen tauschen!`;
  });
  private readonly answerInput = viewChild<ElementRef<HTMLInputElement>>('answerInput');
  private readonly nextButton = viewChild<ElementRef<HTMLButtonElement>>('nextButton');
  private readonly title = viewChild<ElementRef<HTMLHeadingElement>>('stageTitle');

  constructor() {
    afterRenderEffect(() => {
      this.phase();
      this.index();
      this.hopIndex();
      if (this.solved()) this.nextButton()?.nativeElement.focus();
      else if (this.answerInput()) this.answerInput()?.nativeElement.focus({ preventScroll: true });
      else this.title()?.nativeElement.focus({ preventScroll: true });
    });
  }

  protected start(shuffle = false) {
    this.questions.set(shuffle ? newRound() : [...FIRST_ROUND]);
    this.index.set(0);
    this.resetQuestion();
    this.phase.set('play');
    this.scrollToQuestion();
  }

  protected showHelp() {
    this.help.set(true);
    this.hopIndex.set(0);
    this.answerModel.set({ answer: '' });
    this.message.set('Wir bauen die Brücke zusammen.');
    this.error.set(false);
    this.answerInput()?.nativeElement.focus({ preventScroll: true });
  }

  protected typeDigit(digit: string) {
    if (this.solved()) return;
    const replace = this.error();
    this.answerModel.update(({ answer }) => ({
      answer: replace ? digit : (answer + digit).slice(0, 2),
    }));
    this.error.set(false);
    this.message.set('');
    this.answerInput()?.nativeElement.focus({ preventScroll: true });
  }

  protected erase() {
    this.answerModel.update(({ answer }) => ({ answer: answer.slice(0, -1) }));
    this.answerInput()?.nativeElement.focus({ preventScroll: true });
  }

  protected check(event: Event) {
    event.preventDefault();
    if (this.solved()) return;
    const answer = this.answerModel().answer.trim();
    if (!/^\d{1,2}$/.test(answer) || Number(answer) > 30) {
      this.error.set(true);
      this.message.set('Gib eine ganze Zahl von 0 bis 30 ein.');
      return;
    }
    if (Number(answer) !== this.expected()) {
      this.error.set(true);
      this.message.set(
        this.isHop()
          ? 'Fast! Schau auf den Start und das Ziel deines Hüpfers.'
          : 'Noch nicht ganz. Du kannst es noch einmal versuchen oder dir die Brücke zeigen lassen.',
      );
      this.answerInput()?.nativeElement.select();
      return;
    }
    this.error.set(false);
    if (this.isHop()) {
      const value = this.expected();
      this.hopIndex.update((step) => step + 1);
      this.answerModel.set({ answer: '' });
      this.message.set(
        `Genau! +${value}. ${this.isHop() ? 'Jetzt kommt der nächste Hüpfer.' : this.plan().findLanding ? 'Wo bist du gelandet?' : 'Zähle jetzt deine Hüpfer zusammen.'}`,
      );
    } else {
      this.solved.set(true);
      this.message.set('Geschafft! Du hast die fehlende Zahl gefunden.');
    }
  }

  protected next() {
    if (!this.solved()) return;
    if (this.index() === this.questions().length - 1) {
      this.phase.set('complete');
    } else {
      this.index.update((index) => index + 1);
      this.resetQuestion();
    }
    this.scrollToQuestion();
  }

  private scrollToQuestion() {
    this.title()?.nativeElement.scrollIntoView?.({ block: 'start' });
  }

  private resetQuestion() {
    this.hopIndex.set(0);
    this.help.set(false);
    this.solved.set(false);
    this.error.set(false);
    this.message.set('');
    this.answerModel.set({ answer: '' });
  }
}
