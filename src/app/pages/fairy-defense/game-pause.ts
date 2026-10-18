import { Component, ElementRef, inject, input, output, viewChild } from '@angular/core';
import { LocaleService } from '../../core/locale';
import { AudioSettings, PlaytestStore } from './playtest-store';
import { gameText, GameMessageKey } from './game-messages';
import { RouterLink } from '@angular/router';
@Component({
  selector: 'app-game-pause',
  imports: [RouterLink],
  templateUrl: './game-pause.html',
  styleUrl: './game-pause.css',
})
export class GamePause {
  readonly started = input(false);
  readonly instruction = input('');
  readonly extraInstruction = input('');
  readonly canExplain = input(false);
  readonly canSpeak = input(false);
  readonly explain = output();
  readonly replay = output();
  readonly resume = output();
  readonly restart = output();
  readonly chooseWave = output();
  readonly toggleSound = output<keyof AudioSettings>();
  protected readonly i = inject(LocaleService);
  protected readonly store = inject(PlaytestStore);
  protected readonly soundKeys: readonly (keyof AudioSettings)[] = ['music', 'effects', 'speech'];
  protected readonly chapterLink = ['/worlds', 'numbers', 'chapters', 'friends-of-ten'];
  protected readonly languages = [
    { id: 'en', name: 'English' },
    { id: 'de', name: 'Deutsch' },
    { id: 'es', name: 'Español' },
    { id: 'fr', name: 'Français' },
  ] as const;
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  open() {
    this.dialog().nativeElement.showModal();
  }
  close() {
    this.dialog().nativeElement.close();
  }
  protected cancel(event: Event) {
    event.preventDefault();
    this.resume.emit();
  }
  protected selectLanguage(value: string) {
    const locale = this.languages.find((language) => language.id === value)?.id;
    if (locale) this.i.select(locale);
  }
  protected t(key: GameMessageKey) {
    return gameText(this.i.locale(), key);
  }
}
