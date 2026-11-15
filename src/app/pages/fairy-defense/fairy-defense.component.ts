import { HatcheryStore } from '../hatchery/hatchery-store';
import { form, FormField } from '@angular/forms/signals';
import {
  Difficulty,
  localQuestion,
  Pace,
  PracticeConfig,
  practiceLevels,
} from '../../core/practice';
import type { Level } from '../../core/catalog';
import type { MessageKey } from '../../core/messages';
import { practiceBattle, practiceSpells, withCampaignMath } from './practice-battle';
import { WavePathComponent } from './wave-path/wave-path.component';
import { CampaignStore, waveStars } from './campaign';
import { WaveReward } from './wave-reward';
import { TOTAL_WAVES } from './waves';
import { CompletionService } from '../../core/completion';
import { Router } from '@angular/router';
import { GamePause } from './game-pause';
import { SpellBar } from './spell-bar';
import { BattleScene } from './battle-scene';
import { DOCUMENT } from '@angular/common';
import {
  Component,
  input,
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
import { GameHeader } from '../../shared/game-header';
import { Icon } from '../../shared/icon';
import { advance, Battle, cast, freshBattle, resolveSpell, revealHint, timeOut } from './battle';
import { FuseTimer } from './fuse-timer';
import { SlipCallout, SlipKind } from './slip-callout';
import { LostProgress } from './lost-progress';
import { ruleHint } from './rule-hint';
import { GameAudio } from './game-audio';
import { gameText, GameMessageKey } from './game-messages';
import { AudioSettings, PlaytestStore } from './playtest-store';
@Component({
  selector: 'app-fairy-defense',
  imports: [
    FormField,
    BattleScene,
    SpellBar,
    GamePause,
    WavePathComponent,
    RouterLink,
    Icon,
    GameHeader,
    WaveReward,
    FuseTimer,
    SlipCallout,
    LostProgress,
  ],
  providers: [GameAudio],
  templateUrl: './fairy-defense.component.html',
  styleUrl: './fairy-defense.component.css',
  host: {
    '[class.playing]': 'playing()',
    '(document:visibilitychange)': 'visibilityChanged()',
    '(document:keydown)': 'onKey($event)',
  },
})
export class FairyDefenseComponent {
  readonly practiceConfig = input<PracticeConfig>();
  protected readonly mathRange = signal('30');
  protected readonly stages = practiceLevels;
  /** The stage cards in their topics, in path order: Tens and ones, Adding, … */
  protected readonly stageTopics = practiceLevels.reduce<
    { readonly group: MessageKey; readonly levels: Level[] }[]
  >((topics, level) => {
    const group = level.group ?? 'practicePath';
    const last = topics.at(-1);
    if (last?.group === group) last.levels.push(level);
    else topics.push({ group, levels: [level] });
    return topics;
  }, []);
  protected readonly chosenStage = signal('');
  protected readonly training = computed(
    () =>
      this.practiceConfig() ??
      practiceLevels.find((level) => level.id === this.chosenStage())?.practice,
  );
  protected readonly settingsModel = signal<{ difficulty: Difficulty; pace: Pace }>({
    difficulty: 'medium',
    pace: 'relaxed',
  });
  protected readonly settings = form(this.settingsModel);
  protected readonly difficulties = ['easy', 'medium', 'hard'] as const;
  protected readonly paces = ['relaxed', 'steady', 'quick'] as const;
  /** Seconds a monster waits for a spell at this pace. */
  protected readonly thinkingTotal = computed(() =>
    this.settingsModel().pace === 'quick' ? 20 : 45,
  );
  protected readonly thinkingTime = signal(45);
  /** What each bubble says; a right spell rotates through a few cheers so they stay fresh. */
  protected readonly calloutText: Record<SlipKind, readonly GameMessageKey[]> = {
    wrong: ['slipWrong'],
    time: ['slipTime'],
    heart: ['slipHeart'],
    cheer: ['cheerFriend', 'cheerSparkle', 'cheerBrilliant'],
    shield: ['cheerShield'],
    wave: ['goWave'],
    practice: ['goPractice'],
    boss: ['goBoss'],
  };
  /** The bubble over the battlefield after a spell; the id restarts its pop for a new one. */
  protected readonly slip = signal<{ kind: SlipKind; id: number } | null>(null);
  private slipTimer?: ReturnType<typeof setTimeout>;
  /** The last slip was the ring running out, not a wrong spell. */
  private readonly timedOut = signal(false);
  /** How close the thinking timer is to running out, for the scene: 0 without a timer. */
  protected readonly pressure = computed(() => {
    const pace = this.settingsModel().pace;
    if (pace === 'relaxed') return 0;
    return 1 - this.thinkingTime() / this.thinkingTotal();
  });
  protected readonly spells = computed(() => {
    const question = this.encounter()?.question;
    return question ? practiceSpells(question.answer) : this.battle().wave.spells;
  });
  protected readonly equation = computed(() => {
    const question = this.encounter()?.question;
    return question ? this.question(question.text) : `${this.encounter().energy} + ? = 10`;
  });
  /** "Half of" and the division sign in the child's language. */
  protected question(text: string): string {
    return localQuestion(text, { halfOf: this.i.t('halfOf'), divide: this.i.t('divide') });
  }

  protected readonly i = inject(LocaleService);
  protected readonly campaign = inject(CampaignStore);
  private readonly completion = inject(CompletionService);
  private readonly hatchery = inject(HatcheryStore);
  private readonly router = inject(Router);
  protected readonly store = inject(PlaytestStore);
  protected readonly audio = inject(GameAudio);
  private readonly document = inject(DOCUMENT);
  protected readonly battle = signal(freshBattle(this.campaign.nextWave()));
  protected readonly started = signal(false);
  protected readonly paused = signal(false);
  protected readonly playing = computed(
    () => this.started() && this.battle().phase !== 'lost' && this.battle().phase !== 'complete',
  );
  protected readonly hasPlayed = signal(this.store.read('tutorial-seen') === 'true');
  protected readonly fullExplanation = signal(!this.hasPlayed());
  private readonly instructionOverride = signal<'full' | 'short' | null>(null);
  protected readonly encounter = computed(
    () => this.battle().wave.encounters[this.battle().encounter],
  );
  /** Stars for the wave just won, from the gems in the pouch. */
  protected readonly earnedStars = computed(() =>
    waveStars(this.battle().wave.encounters.length, this.battle().gems),
  );
  protected readonly dots = Array.from({ length: 10 }, (_, index) => index);
  /** Where the games hub lands when leaving: this game's section, or the practice stage. */
  protected readonly gamesAnchor = computed(() => {
    const training = this.training();
    return training ? (training.id ?? `practice-30-${training.stage}`) : 'friends-of-ten';
  });
  private readonly dialog = viewChild.required(GamePause);
  private readonly spellBar = viewChild(SpellBar);
  private readonly outcome = viewChild<ElementRef<HTMLElement>>('outcome');
  private timer?: ReturnType<typeof setTimeout>;
  private due = 0;
  private remaining = 0;
  private pending?: () => void;
  private returnFocus?: HTMLElement;
  /** After a slip on a missing-number question: how to work it out, never the number itself. */
  protected readonly ruleHintText = computed(() => {
    const state = this.battle();
    const question = this.encounter()?.question;
    if (!question || state.phase === 'transforming' || !(state.mistakes > 0 || state.damaged))
      return null;
    const hint = ruleHint(question.text);
    return hint ? this.t(hint.key, hint.values) : null;
  });
  protected readonly message = computed(() => {
    const state = this.battle();
    if (this.timedOut() && (state.phase === 'wrong' || state.phase === 'ready'))
      return this.t(state.damaged && !this.encounter().question ? 'damage' : 'timeUp');
    if (this.encounter()?.question)
      return (
        this.equation() +
        (state.phase === 'wrong'
          ? '. ' + this.i.t('tryAgain') + (this.ruleHintText() ? ' ' + this.ruleHintText() : '')
          : state.phase === 'transforming'
            ? '. ' + this.i.t('correctAnswer')
            : '')
      );
    if (state.phase === 'complete') return this.t('completeText');
    if (state.phase === 'lost') return this.t('retryText');
    if (state.phase === 'transforming')
      return this.t(
        state.wave.boss && state.encounter < state.wave.encounters.length - 1
          ? 'shieldBroken'
          : 'correct',
        { n: this.encounter().energy, s: state.spell ?? 0 },
      );
    const instruction = this.instructionOverride();
    if (instruction) return this.t(instruction, { n: this.encounter().energy });
    if (state.damaged) return this.t('damage');
    if (state.phase === 'wrong' || state.mistakes > 0) return this.t('wrong');
    return (
      (state.wave.boss && state.encounter === 0
        ? this.t('bossIntro') + '. '
        : state.wave.assistance === 'assisted' && !state.hintVisible
          ? this.t('assistStage') + '. '
          : '') +
      this.t(this.fullExplanation() ? 'full' : state.hintVisible ? 'short' : 'prompt', {
        n: this.encounter().energy,
      })
    );
  });
  constructor() {
    try {
      const range = this.document.defaultView?.localStorage.getItem('feenland.campaign-math');
      if (range === '10' || range === '30' || range === '100') this.mathRange.set(range);
      const saved: unknown = JSON.parse(
        this.document.defaultView?.localStorage.getItem('feenland.practice-options') ?? 'null',
      );
      if (saved && typeof saved === 'object' && 'difficulty' in saved && 'pace' in saved) {
        const { difficulty, pace } = saved;
        if (
          (difficulty === 'easy' || difficulty === 'medium' || difficulty === 'hard') &&
          (pace === 'relaxed' || pace === 'steady' || pace === 'quick')
        )
          this.settingsModel.set({ difficulty, pace });
      }
    } catch {
      /* Defaults remain usable. */
    }
    effect(() => {
      const options = this.settingsModel();
      const range = this.mathRange();
      try {
        this.document.defaultView?.localStorage.setItem(
          'feenland.practice-options',
          JSON.stringify(options),
        );
        this.document.defaultView?.localStorage.setItem('feenland.campaign-math', range);
      } catch {
        /* Settings remain in memory. */
      }
    });
    effect((cleanup) => {
      if (
        !this.started() ||
        this.paused() ||
        this.battle().phase !== 'ready' ||
        this.settingsModel().pace === 'relaxed'
      )
        return;
      const timer = setInterval(() => {
        const left = Math.max(0, this.thinkingTime() - 1);
        this.thinkingTime.set(left);
        if (left === 0) this.runOutOfTime();
      }, 1000);
      cleanup(() => clearInterval(timer));
    });
    effect(() => {
      this.audio.updateVoice(this.i.locale());
    });
    inject(DestroyRef).onDestroy(() => {
      this.clearTurn();
      clearTimeout(this.slipTimer);
      this.dialog().close();
    });
  }
  protected t(key: GameMessageKey, values: Record<string, number> = {}) {
    return gameText(this.i.locale(), key, values);
  }
  protected play(number = this.campaign.nextWave()) {
    if (!this.training() && (number < 1 || number > TOTAL_WAVES || !Number.isInteger(number)))
      return;
    this.clearTurn();
    this.showSlip(null);
    this.instructionOverride.set(null);
    this.timedOut.set(false);
    const training = this.training();
    let fresh = training
      ? practiceBattle(training, this.settingsModel().difficulty)
      : freshBattle(number);
    const difficulty = this.settingsModel().difficulty;
    if (!training && this.mathRange() !== '10')
      fresh = withCampaignMath(fresh, this.mathRange() === '100' ? 100 : 30, difficulty);
    this.battle.set(
      !training && difficulty !== 'medium'
        ? {
            ...fresh,
            wave: { ...fresh.wave, assistance: difficulty === 'easy' ? 'guided' : 'independent' },
            hintVisible: difficulty === 'easy',
            helpUsed: difficulty === 'easy',
          }
        : fresh,
    );
    this.thinkingTime.set(this.thinkingTotal());
    this.started.set(true);
    this.fullExplanation.set(number === 1 && !this.hasPlayed());
    this.hasPlayed.set(true);
    this.store.write('tutorial-seen', 'true');
    this.audio.start();
    this.audio.speak(this.message());
    this.showSlip(training ? 'practice' : this.battle().wave.boss ? 'boss' : 'wave');
    this.focusSpells();
  }
  /** A picture card is a play button: one tap picks the game and starts it. */
  protected chooseStage(id: string) {
    this.chosenStage.set(id);
    this.play(this.campaign.nextWave());
  }
  protected castSpell(spell: number) {
    if (!this.started() || this.paused()) return;
    const next = cast(this.battle(), spell);
    if (next === this.battle()) return;
    this.instructionOverride.set(null);
    this.timedOut.set(false);
    this.showSlip(null);
    this.battle.set(next);
    this.fullExplanation.set(false);
    this.audio.effect('cast');
    this.schedule(() => {
      this.instructionOverride.set(null);
      const resolved = resolveSpell(this.battle());
      this.battle.set(resolved);
      this.settle(resolved);
    }, 550);
  }
  /** The ring ran out: the monster takes one step, like one wrong spell, and the ring refills. */
  private runOutOfTime() {
    if (!this.started() || this.paused()) return;
    const next = timeOut(this.battle());
    if (next === this.battle()) return;
    this.instructionOverride.set(null);
    this.timedOut.set(true);
    this.fullExplanation.set(false);
    this.battle.set(next);
    this.settle(next);
  }
  /** Sound, speech and the next step after a spell or the ring has been decided. */
  private settle(resolved: Battle) {
    if (resolved.phase === 'transforming') this.hatchery.warm();
    this.audio.effect(
      resolved.phase === 'lost' || resolved.damaged
        ? 'damage'
        : resolved.phase === 'transforming'
          ? 'correct'
          : 'wrong',
    );
    this.audio.speak(this.message());
    if (resolved.phase === 'transforming')
      this.showSlip(
        resolved.wave.boss && resolved.encounter < resolved.wave.encounters.length - 1
          ? 'shield'
          : 'cheer',
      );
    else if (resolved.phase !== 'lost')
      this.showSlip(resolved.damaged ? 'heart' : this.timedOut() ? 'time' : 'wrong');
    if (resolved.phase === 'lost') {
      this.focusOutcome();
      return;
    }
    this.schedule(
      () => {
        this.battle.update((state) => advance(state));
        this.thinkingTime.set(this.thinkingTotal());
        if (this.battle().phase === 'complete') {
          this.audio.effect('complete');
          const state = this.battle();
          if (!this.training())
            this.campaign.complete({
              wave: state.wave.number,
              independent: state.independent.filter(Boolean).length,
              stars: this.earnedStars(),
            });
          this.audio.speak(this.t('complete', { n: state.wave.number }) + ' ' + this.t('restored'));
          if (this.training() || this.campaign.finished()) this.recordCompletion();
          this.focusOutcome();
        } else {
          if (resolved.phase === 'transforming') this.audio.speak(this.message());
          this.focusSpells();
        }
      },
      // A run-out ring holds a little longer, so the child sees the monster's step.
      resolved.phase === 'transforming' ? 2100 : this.timedOut() ? 1400 : 750,
    );
  }
  private showSlip(kind: SlipKind | null) {
    clearTimeout(this.slipTimer);
    this.slip.set(kind ? { kind, id: (this.slip()?.id ?? 0) + 1 } : null);
    if (kind)
      this.slipTimer = setTimeout(
        () => this.slip.set(null),
        kind === 'heart' || kind === 'boss' ? 2600 : 1900,
      );
  }
  protected help(full = false) {
    if (this.battle().phase !== 'ready') return;
    this.battle.update(revealHint);
    this.instructionOverride.set(full ? 'full' : 'short');
    this.audio.speak(this.message());
    this.focusSpells();
  }
  protected explainInPause() {
    if (this.battle().phase !== 'ready') return;
    this.battle.update(revealHint);
    this.instructionOverride.set('full');
    this.audio.speak(this.message(), true);
  }
  protected replayInPause() {
    this.audio.speak(this.message(), true);
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
    this.play(this.battle().wave.number);
  }
  protected showWaves() {
    this.resume();
    this.clearTurn();
    this.started.set(false);
    this.audio.pause();
  }
  private recordCompletion() {
    const training = this.training();
    if (training)
      return this.completion.finish({
        levelId: training.id ?? `practice-30-${training.stage}`,
        completed: true,
        mastered: true,
      });
    const stars = this.campaign.stars();
    return (
      stars > 0 &&
      this.completion.finish({
        levelId: 'defend-fairy-castle',
        completed: true,
        mastered: stars >= 2,
        stars,
      })
    );
  }
  protected celebrate() {
    if (this.recordCompletion())
      void this.router.navigate([
        '/complete',
        this.training()
          ? (this.training()!.id ?? `practice-30-${this.training()!.stage}`)
          : 'defend-fairy-castle',
      ]);
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
    if (this.encounter().question && /^[1-5]$/.test(event.key)) {
      event.preventDefault();
      this.castSpell(this.spells()[Number(event.key) - 1]);
      return;
    }
    if (
      !this.encounter().question &&
      /^[0-9]$/.test(event.key) &&
      !(event.target instanceof HTMLSelectElement)
    ) {
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
