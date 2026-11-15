import { Component, computed, inject, input, model } from '@angular/core';
import { LocaleService } from '../../core/locale';
import type { MessageKey } from '../../core/messages';
import type { Difficulty, Pace } from '../../core/practice';
import { gameText, GameMessageKey } from './game-messages';

export interface CastleOptions {
  readonly difficulty: Difficulty;
  readonly pace: Pace;
}

/**
 * The castle's settings as picture cards, like the walls' troll speed and the crocodile's
 * paces: which numbers the waves use, how much help there is, and how fast the monsters come.
 */
@Component({
  selector: 'app-castle-settings',
  templateUrl: './castle-settings.html',
  styleUrl: './castle-settings.css',
  host: { 'aria-labelledby': 'castle-settings-title', role: 'region' },
})
export class CastleSettings {
  protected readonly i = inject(LocaleService);
  /** The twenty waves are chosen, so their numbers can be picked too; stages bring their own. */
  readonly waves = input(false);
  readonly range = model.required<string>();
  readonly options = model.required<CastleOptions>();
  /** A short name for each card; the example sum comes from the longer label. */
  protected readonly ranges: readonly { value: string; label: MessageKey; name: GameMessageKey }[] =
    [
      { value: '10', label: 'mathTen', name: 'numbersTen' },
      { value: '30', label: 'mathThirty', name: 'numbersThirty' },
      { value: '100', label: 'mathHundred', name: 'numbersHundred' },
    ];
  protected readonly difficulties: readonly {
    value: Difficulty;
    picture: string;
    detail: GameMessageKey;
  }[] = [
    { value: 'easy', picture: '🧚', detail: 'easyDetail' },
    { value: 'medium', picture: '🪄', detail: 'mediumDetail' },
    { value: 'hard', picture: '🐉', detail: 'hardDetail' },
  ];
  /** A picture per monster speed: asleep, on its way, racing. */
  protected readonly paces: readonly { value: Pace; picture: string }[] = [
    { value: 'relaxed', picture: '😴' },
    { value: 'steady', picture: '⏳' },
    { value: 'quick', picture: '⚡' },
  ];
  protected readonly timed = computed(() => this.options().pace !== 'relaxed');

  /** "Relaxed · no timer" as a name and a detail line. */
  protected parts(key: MessageKey): string[] {
    return this.i.t(key).split(' · ');
  }
  protected t(key: GameMessageKey) {
    return gameText(this.i.locale(), key);
  }
  protected chooseDifficulty(difficulty: Difficulty) {
    this.options.update((options) => ({ ...options, difficulty }));
  }
  protected choosePace(pace: Pace) {
    this.options.update((options) => ({ ...options, pace }));
  }
}
