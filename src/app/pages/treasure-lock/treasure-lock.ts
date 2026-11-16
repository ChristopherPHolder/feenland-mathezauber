import { DOCUMENT } from '@angular/common';
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
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CompletionService } from '../../core/completion';
import { LocaleService } from '../../core/locale';
import { MessageKey } from '../../core/messages';
import { ProgressService } from '../../core/progress';
import { GameHeader } from '../../shared/game-header';
import { Icon } from '@feenland/ui';
import { ThreeStage, WorldLoader } from '../../shared/three/three-stage';
import { HatcheryStore } from '../hatchery/hatchery-store';
import { LockDial } from './lock-dial';
import { LockFrame } from './lock-frame';
import { lockText, LockMessageKey } from './lock-messages';
import { LockReward, RewardKind } from './lock-reward';
import {
  cast,
  chestCoins,
  createRound,
  FEVER_STREAK,
  hourglassSeconds,
  isMastered,
  LOCK_PACES,
  LockPace,
  LockPuzzle,
  lockPosition,
  lockStage,
  lockStages,
  lockStars,
  parseLockPace,
  ROUND_LENGTH,
  roundStars,
  Spell,
  spellText,
  TOTAL_STAGES,
  unsplittable,
} from './lock-puzzles';
import { LockScores } from './lock-scores';
import { LockSounds } from './lock-sounds';

interface Round {
  readonly locks: readonly LockPuzzle[];
  readonly index: number;
  readonly value: number;
  /** Every hop cast on this lock, thorns included: this is what the keys count. */
  readonly hops: readonly Spell[];
  /** The hops since the start number, as the trail under the dial shows them. */
  readonly trail: readonly Spell[];
  /** Golden keys won per opened lock. */
  readonly keys: readonly number[];
  readonly score: number;
  /** Coins the last opened chest paid, for the reward card. */
  readonly gain: number;
  readonly streak: number;
  readonly gemTaken: boolean;
  readonly crystal: 'none' | 'shining' | 'faded';
  readonly phase: 'ready' | 'bouncing' | 'opened' | 'complete';
  readonly pricks: number;
  readonly gems: number;
  readonly hopCount: number;
}

type Status = 'ready' | 'thorn' | 'gem' | 'sand' | 'fever' | 'opened';

const PACE_KEY = 'feenland.treasure-lock-pace.v1';
const BOUNCE_DELAY = 480;
const OPEN_DELAY = 2600;

@Component({
  selector: 'app-treasure-lock',
  imports: [RouterLink, Icon, GameHeader, ThreeStage, LockDial, LockReward],
  providers: [LockSounds],
  templateUrl: './treasure-lock.html',
  styleUrls: ['./treasure-lock.css', './treasure-lock-play.css'],
  host: {
    '(document:keydown)': 'onKey($event)',
    '(document:visibilitychange)': 'visibilityChanged()',
  },
})
export class TreasureLock {
  protected readonly i = inject(LocaleService);
  private readonly p = inject(ProgressService);
  private readonly hatchery = inject(HatcheryStore);
  private readonly completion = inject(CompletionService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  protected readonly sounds = inject(LockSounds);
  protected readonly scores = inject(LockScores);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap);

  protected readonly total = TOTAL_STAGES;
  protected readonly roundLength = ROUND_LENGTH;
  protected readonly stage = computed(
    () => lockStage(this.params()?.get('id')) ?? lockStage('treasure-lock-1')!,
  );
  protected readonly levelId = computed(() => `treasure-lock-${this.stage().stage}`);
  /** The level's place in the list, which is the number the child sees. */
  protected readonly position = computed(() => lockPosition(this.stage()));
  protected readonly levelLinks = lockStages.map((stage, index) => ({
    stage: stage.stage,
    position: index + 1,
    route: ['/adventure', `treasure-lock-${stage.stage}`],
  }));
  protected readonly nextLink = computed(() => {
    const next = lockStages[this.position()];
    return next ? ['/adventure', `treasure-lock-${next.stage}`] : null;
  });

  protected readonly round = linkedSignal<Round>(() => this.fresh());
  protected readonly started = linkedSignal<boolean>(() => {
    this.stage();
    return false;
  });
  protected readonly paces = LOCK_PACES;
  protected readonly pace = signal<LockPace>(this.readPace());
  protected readonly timed = computed(() => this.pace() !== 'off');
  protected readonly secondsLeft = signal(0);
  protected readonly status = signal<Status>('ready');
  protected readonly saveFailed = signal(false);
  protected readonly newBest = signal(false);

  protected readonly lock = computed(() => {
    const round = this.round();
    return round.locks[Math.min(round.index, ROUND_LENGTH - 1)];
  });
  protected readonly big = computed(() => this.round().index === ROUND_LENGTH - 1);
  /** How much sand is left in the hourglass, from 1 down to 0. */
  protected readonly sandShare = computed(() => {
    const seconds = hourglassSeconds(this.pace(), this.lock().par);
    return seconds ? Math.min(1, this.secondsLeft() / seconds) : 0;
  });
  protected readonly fever = computed(() => this.round().streak >= FEVER_STREAK);
  protected readonly chests = Array.from({ length: ROUND_LENGTH }, (_, index) => index);
  protected readonly keySlots = [1, 2, 3];
  protected readonly stars = computed(() => roundStars(this.round().keys));
  protected readonly keysWon = computed(() => this.round().keys.reduce((sum, n) => sum + n, 0));
  protected readonly best = computed(() => this.scores.best()[this.levelId()] ?? 0);
  /** Pip sits on an odd number and the lock has a halving spell: say why ÷2 is greyed out. */
  protected readonly halveNote = computed(() => {
    const round = this.round();
    const halving = this.lock().spells.find((spell) => unsplittable(round.value, spell));
    return halving && round.phase === 'ready' ? this.t('cannotHalve', { n: round.value }) : '';
  });
  /** After a few extra hops Pip reminds the child of the level's trick, never of the answer. */
  protected readonly showHint = computed(() => {
    const round = this.round();
    return round.phase === 'ready' && round.hops.length >= this.lock().par + 2;
  });
  /** What the reward card over the dial shows while a chest stands open. */
  protected readonly reward = computed(() => {
    const round = this.round();
    if (round.phase !== 'opened') return null;
    const keys = round.keys.at(-1) ?? 1;
    const kind: RewardKind = this.big()
      ? 'big'
      : this.status() === 'fever'
        ? 'fever'
        : keys === 3
          ? 'perfect'
          : 'opened';
    const cheers = {
      big: 'rewardBig',
      fever: 'rewardFever',
      perfect: 'rewardPerfect',
      opened: 'rewardOpened',
    } as const;
    return {
      kind,
      keys,
      cheer: this.t(cheers[kind]),
      coins: this.t('rewardCoins', { n: this.i.format(round.gain) }),
    };
  });
  protected readonly pathText = computed(() =>
    [this.lock().start, ...this.round().trail.map(spellText)].join(' '),
  );
  protected readonly frame = computed<LockFrame>(() => {
    const round = this.round();
    const lock = this.lock();
    return {
      lock: round.index,
      max: lock.max,
      start: lock.start,
      target: lock.target,
      value: round.value,
      thorns: lock.thorns,
      gem: round.gemTaken ? null : lock.gem,
      opened: round.phase === 'opened' || round.phase === 'complete',
      big: this.big(),
      fever: this.fever(),
      crystal: round.crystal,
      hops: round.hopCount,
      pricks: round.pricks,
      gems: round.gems,
    };
  });
  protected readonly loadWorld: WorldLoader<LockFrame> = () =>
    import('./lock-world').then((m) => m.LockWorld);

  private readonly outcome = viewChild<ElementRef<HTMLElement>>('outcome');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private timer?: ReturnType<typeof setTimeout>;
  private tick?: ReturnType<typeof setInterval>;
  private sandDue = 0;
  private sandRemaining = 0;

  constructor() {
    effect(() => {
      if (this.started()) this.p.explore('tens');
    });
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.timer);
      clearInterval(this.tick);
    });
  }

  protected t(key: LockMessageKey, values: Record<string, string | number> = {}) {
    return lockText(this.i.locale(), key, values);
  }
  protected levelKey(stage: number) {
    return `lock${stage}` as MessageKey;
  }
  protected spellText = spellText;
  protected canCast(spell: Spell) {
    return cast(this.round().value, spell, this.lock().max) !== null;
  }
  /** Why a spell is greyed out, for its tooltip. */
  protected blockedText(spell: Spell) {
    if (this.canCast(spell)) return '';
    const value = this.round().value;
    return unsplittable(value, spell) ? this.t('cannotHalve', { n: value }) : this.t('tooFar');
  }
  protected paceSeconds(pace: LockPace) {
    return hourglassSeconds(pace, Math.round((this.stage().par[0] + this.stage().par[1]) / 2));
  }

  protected selectPace(pace: LockPace) {
    this.pace.set(pace);
    try {
      this.document.defaultView?.localStorage.setItem(PACE_KEY, pace);
    } catch {
      /* The pace stays for this visit. */
    }
    if (!this.started()) return;
    if (pace === 'off') {
      this.stopSand();
      if (this.round().crystal === 'shining') this.round.update((r) => ({ ...r, crystal: 'none' }));
    }
  }

  protected play() {
    clearTimeout(this.timer);
    this.stopSand();
    this.round.set(this.fresh());
    this.status.set('ready');
    this.saveFailed.set(false);
    this.newBest.set(false);
    this.started.set(true);
    this.sounds.play('start');
    this.startSand();
    this.focusSpells();
  }

  protected hop(spell: Spell) {
    const round = this.round();
    if (!this.started() || round.phase !== 'ready') return;
    const next = cast(round.value, spell, this.lock().max);
    if (next === null) return;
    const lock = this.lock();
    const hops = [...round.hops, spell];
    if (lock.thorns.includes(next)) {
      // Pip lands on the thorn, says ouch and hops back to where it was.
      this.round.set({
        ...round,
        value: next,
        hops,
        phase: 'bouncing',
        hopCount: round.hopCount + 1,
        pricks: round.pricks + 1,
      });
      this.status.set('thorn');
      this.sounds.play('thorn');
      this.timer = setTimeout(() => {
        this.round.update((r) => ({ ...r, value: round.value, phase: 'ready' }));
      }, BOUNCE_DELAY);
      return;
    }
    const gem = !round.gemTaken && lock.gem === next;
    const updated: Round = {
      ...round,
      value: next,
      hops,
      trail: [...round.trail, spell],
      hopCount: round.hopCount + 1,
      gemTaken: round.gemTaken || gem,
      gems: round.gems + (gem ? 1 : 0),
    };
    if (next === lock.target) {
      this.open(updated);
      return;
    }
    this.round.set(updated);
    this.status.set(gem ? 'gem' : 'ready');
    this.sounds.play(gem ? 'gem' : 'hop');
  }

  protected restart() {
    const round = this.round();
    if (round.phase !== 'ready' || round.value === this.lock().start) return;
    this.round.set({ ...round, value: this.lock().start, trail: [], hopCount: round.hopCount + 1 });
    this.status.set('ready');
  }

  private open(round: Round) {
    this.stopSand();
    const lock = this.lock();
    const stars = lockStars(round.hops.length, lock.par);
    const streak = stars === 3 ? round.streak + 1 : 0;
    const crystal = round.crystal === 'shining';
    const coins = chestCoins({
      stars,
      gem: round.gemTaken,
      crystal,
      streak,
      big: this.big(),
    });
    this.round.set({
      ...round,
      phase: 'opened',
      keys: [...round.keys, stars],
      streak,
      score: round.score + coins,
      gain: coins,
    });
    this.hatchery.warm();
    this.status.set(streak === FEVER_STREAK ? 'fever' : 'opened');
    this.sounds.reward(streak === FEVER_STREAK ? 'fever' : stars === 3 ? 'perfect' : 'open', stars);
    this.timer = setTimeout(() => this.advance(), OPEN_DELAY);
  }

  /** Moves on to the next chest now instead of waiting. */
  protected advance() {
    clearTimeout(this.timer);
    const round = this.round();
    if (round.phase !== 'opened') return;
    if (round.index + 1 < ROUND_LENGTH) {
      const index = round.index + 1;
      this.round.set({
        ...round,
        index,
        value: round.locks[index].start,
        hops: [],
        trail: [],
        gemTaken: false,
        crystal: 'none',
        phase: 'ready',
      });
      this.status.set('ready');
      this.startSand();
      this.focusSpells();
      return;
    }
    this.round.set({ ...round, phase: 'complete' });
    this.saveFailed.set(!this.record());
    this.newBest.set(this.scores.record(this.levelId(), round.score));
    this.sounds.play('win');
    requestAnimationFrame(() => this.outcome()?.nativeElement.focus({ preventScroll: true }));
  }

  private startSand() {
    const seconds = hourglassSeconds(this.pace(), this.lock().par);
    if (!seconds) return;
    this.round.update((round) => ({ ...round, crystal: 'shining' }));
    this.sandRemaining = seconds * 1000;
    this.armSand();
  }

  private armSand() {
    clearInterval(this.tick);
    this.sandDue = Date.now() + this.sandRemaining;
    const count = () => {
      const left = Math.max(0, this.sandDue - Date.now());
      this.secondsLeft.set(Math.ceil(left / 1000));
      if (left > 0) return;
      this.stopSand();
      this.round.update((round) => ({ ...round, crystal: 'faded' }));
      this.status.set('sand');
      this.sounds.play('sand');
    };
    count();
    this.tick = setInterval(count, 250);
  }

  private stopSand() {
    clearInterval(this.tick);
    this.tick = undefined;
  }

  protected visibilityChanged() {
    if (this.round().crystal !== 'shining' || this.round().phase === 'complete') return;
    if (this.document.hidden && this.tick) {
      this.sandRemaining = Math.max(0, this.sandDue - Date.now());
      this.stopSand();
    } else if (!this.document.hidden && !this.tick && this.round().phase !== 'opened') {
      this.armSand();
    }
  }

  private record() {
    const keys = this.round().keys;
    return this.completion.finish({
      levelId: this.levelId(),
      completed: true,
      mastered: isMastered(keys),
      stars: roundStars(keys),
    });
  }

  protected celebrate() {
    if (this.completion.result()?.levelId === this.levelId() || this.record())
      void this.router.navigate(['/complete', this.levelId()]);
    else this.saveFailed.set(true);
  }

  /** Number keys 1–4 cast the spells in order; 0 sends Pip back to the start. */
  protected onKey(event: KeyboardEvent) {
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || !this.started()) return;
    if (this.round().phase === 'complete') return;
    if (event.key === '0') {
      event.preventDefault();
      this.restart();
      return;
    }
    const spell = this.lock().spells[Number(event.key) - 1];
    if (!spell) return;
    event.preventDefault();
    this.hop(spell);
  }

  protected statusText() {
    const round = this.round();
    const lock = this.lock();
    switch (this.status()) {
      case 'thorn':
        return this.t('thorn');
      case 'gem':
        return this.t('gem');
      case 'sand':
        return this.t('sandOut');
      case 'fever':
      case 'opened': {
        const hops = round.hops.length;
        const text =
          hops <= lock.par
            ? this.t('perfect', { n: hops })
            : this.t('opened', { n: hops, par: lock.par });
        return this.status() === 'fever' ? `${text} ${this.t('fever')}` : text;
      }
      default:
        return this.t('ready');
    }
  }

  private focusSpells() {
    requestAnimationFrame(() =>
      this.host.nativeElement.querySelector<HTMLElement>('.spell:not([disabled])')?.focus({
        preventScroll: true,
      }),
    );
  }

  private readPace(): LockPace {
    try {
      return parseLockPace(this.document.defaultView?.localStorage.getItem(PACE_KEY));
    } catch {
      return 'off';
    }
  }

  private fresh(): Round {
    const locks = createRound(this.stage());
    return {
      locks,
      index: 0,
      value: locks[0].start,
      hops: [],
      trail: [],
      keys: [],
      score: 0,
      gain: 0,
      streak: 0,
      gemTaken: false,
      crystal: 'none',
      phase: 'ready',
      pricks: 0,
      gems: 0,
      hopCount: 0,
    };
  }
}
