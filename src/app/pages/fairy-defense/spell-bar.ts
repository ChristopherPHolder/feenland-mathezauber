import { NgOptimizedImage } from '@angular/common';
import { Component, ElementRef, inject, input, output, viewChild } from '@angular/core';
import { LocaleService } from '../../core/locale';
import { gameText, GameMessageKey } from './game-messages';
@Component({
  selector: 'app-spell-bar',
  imports: [NgOptimizedImage],
  templateUrl: './spell-bar.html',
  styleUrl: './spell-bar.css',
})
export class SpellBar {
  readonly locked = input(false);
  readonly selected = input<number | null>(null);
  readonly castSpell = output<number>();
  readonly spells = input<readonly number[]>([1, 2, 3, 4, 5]);
  protected readonly quantities = Array.from({ length: 10 }, (_, index) => index);
  protected readonly i = inject(LocaleService);
  private readonly primarySpell = viewChild<ElementRef<HTMLButtonElement>>('primarySpell');
  focus() {
    this.primarySpell()?.nativeElement.focus({ preventScroll: true });
  }
  protected t(key: GameMessageKey, values: Record<string, number> = {}) {
    return gameText(this.i.locale(), key, values);
  }
}
