import { GamePause } from './game-pause';
import { SpellBar } from './spell-bar';
import { BattleScene } from './battle-scene';
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
import { RouterLink } from '@angular/router';
import { LocaleService } from '../../core/locale';
import { Icon } from '../../shared/icon';
import { advance, cast, freshBattle, resolveSpell, WAVE_ONE } from './battle';
import { GameAudio } from './game-audio';
import { gameText, GameMessageKey } from './game-messages';
import { AudioSettings, PlaytestStore } from './playtest-store';
@Component({
  selector: 'app-fairy-defense',
  imports: [BattleScene, SpellBar, GamePause, RouterLink, Icon],
  providers: [GameAudio],
  templateUrl: './fairy-defense.component.html',
  styleUrl: './fairy-defense.component.css',
  host: {
    '(document:visibilitychange)': 'visibilityChanged()',
    '(document:keydown)': 'onKey($event)',
  },
})
export class FairyDefenseComponent {
  protected readonly i = inject(LocaleService);
  protected readonly store = inject(PlaytestStore);
  protected readonly audio = inject(GameAudio);
  private readonly document = inject(DOCUMENT);
  protected readonly battle = signal(freshBattle());
  protected readonly started = signal(false);
  protected readonly paused = signal(false);
  protected readonly hasPlayed = signal(this.store.read('tutorial-seen') === 'true');
  protected readonly fullExplanation = signal(!this.hasPlayed());
  private readonly instructionOverride = signal<'full' | 'short' | null>(null);
  protected readonly encounter = computed(() => WAVE_ONE[this.battle().encounter]);
  protected readonly dots = Array.from({ length: 10 }, (_, index) => index);
  protected readonly chapterLink = ['/worlds', 'numbers', 'chapters', 'friends-of-ten'];
  private readonly dialog = viewChild.required(GamePause);
  private readonly spellBar = viewChild(SpellBar);
  private readonly outcome = viewChild<ElementRef<HTMLElement>>('outcome');
  private timer?: ReturnType<typeof setTimeout>;
  private due = 0;
  private remaining = 0;
  private pending?: () => void;
  private returnFocus?: HTMLElement;
  protected readonly message = computed(() => {
    const state = this.battle();
    if (state.phase === 'complete') return this.t('completeText');
    if (state.phase === 'lost') return this.t('retryText');
    if (state.phase === 'transforming')
      return this.t('correct', { n: this.encounter().energy, s: state.spell ?? 0 });
    const instruction = this.instructionOverride();
    if (instruction) return this.t(instruction, { n: this.encounter().energy });
    if (state.damaged) return this.t('damage');
    if (state.phase === 'wrong' || state.mistakes > 0) return this.t('wrong');
    return this.t(this.fullExplanation() ? 'full' : 'short', { n: this.encounter().energy });
  });
  constructor() {
    effect(() => {
      this.audio.updateVoice(this.i.locale());
    });
    inject(DestroyRef).onDestroy(() => {
      this.clearTurn();
      this.dialog().close();
    });
  }
  protected t(key: GameMessageKey, values: Record<string, number> = {}) {
    return gameText(this.i.locale(), key, values);
  }
  protected play() {
    this.clearTurn();
    this.instructionOverride.set(null);
    this.battle.set(freshBattle());
    this.started.set(true);
    this.fullExplanation.set(!this.hasPlayed());
    this.hasPlayed.set(true);
    this.store.write('tutorial-seen', 'true');
    this.store.write('checkpoint', JSON.stringify({ version: 1, wave: 1 }));
    this.audio.start();
    this.audio.speak(this.message());
    this.focusSpells();
  }
  protected castSpell(spell: number) {
    if (!this.started() || this.paused()) return;
    const next = cast(this.battle(), spell);
    if (next === this.battle()) return;
    this.instructionOverride.set(null);
    this.battle.set(next);
    this.fullExplanation.set(false);
    this.audio.effect('cast');
    this.schedule(() => {
      this.instructionOverride.set(null);
      const resolved = resolveSpell(this.battle());
      this.battle.set(resolved);
      this.audio.effect(
        resolved.phase === 'lost' || resolved.damaged
          ? 'damage'
          : resolved.phase === 'transforming'
            ? 'correct'
            : 'wrong',
      );
      this.audio.speak(this.message());
      if (resolved.phase === 'lost') {
        this.focusOutcome();
        return;
      }
      this.schedule(
        () => {
          this.battle.update((state) => advance(state));
          if (this.battle().phase === 'complete') {
            this.audio.effect('complete');
            this.audio.speak(this.t('complete') + ' ' + this.t('restored'));
            this.store.write('checkpoint', JSON.stringify({ version: 1, wave: 1, tried: true }));
            this.focusOutcome();
          } else {
            if (resolved.phase === 'transforming')
              this.audio.speak(this.t('prompt', { n: this.encounter().energy }));
            this.focusSpells();
          }
        },
        resolved.phase === 'transforming' ? 2100 : 750,
      );
    }, 550);
  }
  protected help(full = false) {
    this.instructionOverride.set(full ? 'full' : 'short');
    this.audio.speak(this.message());
  }
  protected replaySpeech() {
    this.audio.speak(this.message());
  }
  protected toggleSound(key: keyof AudioSettings) {
    this.store.toggle(key);
    this.audio.sync();
  }
  protected openPause() {
    if (this.paused()) return;
    this.returnFocus =
      this.document.activeElement instanceof HTMLElement ? this.document.activeElement : undefined;
    this.paused.set(true);
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
      this.remaining = Math.max(0, this.due - Date.now());
    }
    this.audio.pause();
    this.dialog().open();
  }
  protected resume() {
    this.dialog().close();
    this.paused.set(false);
    if (this.started()) this.audio.start();
    if (this.pending) this.armTimer();
    this.returnFocus?.focus();
  }
  protected restart() {
    this.resume();
    this.play();
  }
  protected visibilityChanged() {
    if (this.document.hidden && this.started() && !this.paused()) this.openPause();
  }
  protected onKey(event: KeyboardEvent) {
    if (
      event.repeat ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      this.paused() ||
      !this.started()
    )
      return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.openPause();
      return;
    }
    if (/^[1-5]$/.test(event.key) && !(event.target instanceof HTMLSelectElement)) {
      event.preventDefault();
      this.castSpell(Number(event.key));
    }
  }
  private schedule(action: () => void, delay: number) {
    this.pending = action;
    this.remaining = delay;
    this.armTimer();
  }
  private armTimer() {
    this.due = Date.now() + this.remaining;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      const action = this.pending;
      this.pending = undefined;
      action?.();
    }, this.remaining);
  }
  private clearTurn() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.pending = undefined;
  }
  private focusSpells() {
    requestAnimationFrame(() => this.spellBar()?.focus());
  }
  private focusOutcome() {
    requestAnimationFrame(() => this.outcome()?.nativeElement.focus({ preventScroll: true }));
  }
}
