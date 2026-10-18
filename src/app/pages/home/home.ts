import {
  afterNextRender,
  afterRenderEffect,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MagicIcon, MagicMotif } from '../../shared/magic-icon/magic-icon';
import { NgOptimizedImage } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { StickerAlbum } from '../../shared/sticker-album/sticker-album';
import { Berry } from '../../shared/berry/berry';
import { answerChoices, Level, orderFor, total } from './garden-math';

@Component({
  selector: 'app-home',
  imports: [NgOptimizedImage, RouterLink, Berry, StickerAlbum, MagicIcon],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  protected readonly level = signal<Level>(
    inject(ActivatedRoute).snapshot.data['level'] === 'big' ? 'big' : 'little',
  );
  protected readonly index = signal(0);
  protected readonly visit = signal(0);
  protected readonly selected = signal<number | null>(null);
  protected readonly served = signal(false);
  protected readonly finished = signal(false);
  protected readonly help = signal(false);
  protected readonly feedback = signal('');
  protected readonly readUnavailable = signal(false);
  protected readonly order = computed(() => orderFor(this.level(), this.index(), this.visit()));
  protected readonly choices = computed(() => answerChoices(this.order()));
  protected readonly leftBerries = computed(() =>
    Array.from({ length: this.order().left }, (_, i) => i),
  );
  protected readonly rightBerries = computed(() =>
    Array.from({ length: this.order().right }, (_, i) => i),
  );
  protected readonly earned = computed(() => this.index() + (this.served() ? 1 : 0));
  protected readonly motifs: readonly MagicMotif[] = ['heart', 'flower', 'leaf', 'gem', 'star'];
  protected readonly slots = [0, 1, 2, 3, 4];
  protected readonly stickers = [
    'Berry buddy',
    'Kind chef',
    'Clever counter',
    'Sweet helper',
    'Garden star',
  ];
  private readonly gameTitle = viewChild<ElementRef<HTMLHeadingElement>>('gameTitle');
  private readonly nextButton = viewChild<ElementRef<HTMLButtonElement>>('nextButton');
  private readonly firstAnswer = viewChild<ElementRef<HTMLButtonElement>>('firstAnswer');
  private readonly finishTitle = viewChild<ElementRef<HTMLHeadingElement>>('finishTitle');
  private focusAnswer = false;

  constructor() {
    afterNextRender(() => this.gameTitle()?.nativeElement.focus({ preventScroll: true }));
    afterRenderEffect(() => {
      if (this.finished()) this.finishTitle()?.nativeElement.focus();
      else if (this.served()) this.nextButton()?.nativeElement.focus({ preventScroll: true });
      else if (this.focusAnswer) {
        this.firstAnswer()?.nativeElement.focus({ preventScroll: true });
        this.focusAnswer = false;
      }
    });
  }

  protected choose(answer: number) {
    if (this.served()) return;
    this.selected.set(answer);
    this.feedback.set('');
  }

  protected serve() {
    if (this.selected() === null || this.served()) return;
    if (this.selected() !== total(this.order())) {
      this.feedback.set('A little more stirring! Count the berries and try again.');
      this.help.set(true);
      return;
    }
    this.served.set(true);
    this.feedback.set(
      `Yum! ${this.selected()} berries. You earned the ${this.stickers[this.index()]} sticker!`,
    );
  }

  protected next() {
    if (!this.served()) return;
    if (this.index() === 4) {
      this.finished.set(true);
      return;
    }
    this.index.update((i) => i + 1);
    this.resetOrder();
  }

  protected changeLevel(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    if (value !== 'little' && value !== 'big') return;
    this.level.set(value);
    this.index.set(0);
    this.finished.set(false);
    this.resetOrder();
  }

  protected playAgain() {
    this.visit.update((v) => v + 1);
    this.index.set(0);
    this.finished.set(false);
    this.resetOrder();
  }

  protected readOrder() {
    if (!('speechSynthesis' in window)) {
      this.readUnavailable.set(true);
      return;
    }
    const p = this.order();
    const text = this.finished()
      ? 'You did it! Five treats, five happy moments. Luna is so happy you came!'
      : this.served()
        ? this.feedback()
        : `Help Luna make a berry treat. What is ${p.left} ${p.operator === '+' ? 'plus' : 'minus'} ${p.right}? Choose a number, then press serve.`;
    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = 'en-GB';
    speech.rate = 0.85;
    window.speechSynthesis.speak(speech);
  }

  private resetOrder() {
    this.focusAnswer = true;
    this.selected.set(null);
    this.served.set(false);
    this.help.set(false);
    this.feedback.set('');
  }
}
