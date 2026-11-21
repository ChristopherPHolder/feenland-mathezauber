import { DOCUMENT } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CoachDialog, DragonFace, Icon, RewardBurst, StarRating } from '@feenland/ui';
import { CompletionService } from '../../core/completion';
import { guideCounter } from '../../core/guide-counter';
import { LocaleService } from '../../core/locale';
import { MessageKey } from '../../core/messages';
import { ProgressService } from '../../core/progress';
import { GameHeader } from '../../shared/game-header';
import { ThreeStage, WorldLoader } from '../../shared/three/three-stage';
import { DragonPortraits } from '../hatchery/dragon-portraits';
import { Dragon, DragonElement, dragonById, DRAGONS } from '../hatchery/dragons';
import { HatcheryStore } from '../hatchery/hatchery-store';
import {
  answer,
  charge,
  chargeSeconds,
  Duel,
  DUEL_PACES,
  DuelPace,
  duelSprite,
  duelStars,
  EGG_BONUS,
  HEARTS,
  parseDuelPace,
  SPRITES,
  startDuel,
  TOTAL_DUELS,
} from './duel';
import { DuelArena } from './duel-arena';
import { DuelDemo } from './duel-demo';
import { ArenaFrame, skyFor } from './duel-frame';
import { ATTACK_COLORS } from './duel-looks';
import { duelText, DuelMessageKey } from './duel-messages';
import { DuelQuestion, shownSum } from './duel-questions';
import { DuelSounds } from './duel-sounds';

const PACE_KEY = 'feenland.duel-pace.v1';
/** Right answers on a device before the "tap one of these" hop only comes back after a wait. */
const GUIDED_ANSWERS = 3;
const guide = guideCounter('feenland.duel-guided.v1');
/** The charge ticks this often while a duel runs. */
const TICK_MS = 100;
/** After a right answer the answered sum stays a moment while the attack flies. */
const LOCK_MS = 750;
/** The beaten sprite pops and the reward shows before the result panel. */
const WIN_MS = 2600;
const NAP_MS = 1800;
/** How long a callout stays over the arena. */
const CALLOUT_MS = 1500;
/** Waiting this long without a tap makes the answers show they want a tap again. */
const IDLE_GUIDE = 6000;
/** Wrong tries on one sum before the dragon whispers the sprite's trick. */
const TIP_AFTER = 2;

type Phase = 'intro' | 'fighting' | 'finished';

interface Callout {
  readonly id: number;
  /** `gone` once it has faded: the words stay for the status line only. */
  readonly kind: 'hit' | 'big' | 'giggle' | 'zap' | 'gone';
  readonly text: string;
}

const ATTACKS: Readonly<Record<DragonElement, DuelMessageKey>> = {
  fire: 'fireAttack',
  water: 'waterAttack',
  leaf: 'leafAttack',
  star: 'starAttack',
  cloud: 'cloudAttack',
  rainbow: 'rainbowAttack',
};
const ELEMENT_WORDS: Readonly<Record<DragonElement, DuelMessageKey>> = {
  fire: 'fireWord',
  water: 'waterWord',
  leaf: 'leafWord',
  star: 'starWord',
  cloud: 'cloudWord',
  rainbow: 'rainbowWord',
};
const PACE_LABELS: Readonly<Record<DuelPace, DuelMessageKey>> = {
  off: 'paceOff',
  relaxed: 'paceRelaxed',
  normal: 'paceNormal',
  fast: 'paceFast',
};

/**
 * Dragon Duels: the child's own dragon against a cheeky sprite. Each right answer is an
 * attack, a quick first try is a critical hit, a dragon of the sprite's weak element hits
 * harder, and the sprite charges a zap while the child thinks (unless they chose no zaps).
 */
@Component({
  selector: 'app-dragon-duel',
  imports: [
    RouterLink,
    GameHeader,
    Icon,
    StarRating,
    DragonFace,
    RewardBurst,
    CoachDialog,
    ThreeStage,
    DuelArena,
    DuelDemo,
  ],
  providers: [DuelSounds],
  templateUrl: './dragon-duel.html',
  styleUrls: ['./dragon-duel.css', './dragon-duel-play.css'],
  host: { '(document:visibilitychange)': 'visibilityChanged()' },
})
export class DragonDuel {
  protected readonly i = inject(LocaleService);
  protected readonly hatchery = inject(HatcheryStore);
  protected readonly portraits = inject(DragonPortraits);
  protected readonly sounds = inject(DuelSounds);
  private readonly p = inject(ProgressService);
  private readonly completion = inject(CompletionService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap);

  protected readonly sprite = computed(() => duelSprite(this.params()?.get('id')) ?? SPRITES[0]);
  protected readonly levelId = computed(() => `dragon-duel-${this.sprite().stage}`);
  protected readonly total = TOTAL_DUELS;
  protected readonly heartSlots = Array.from({ length: HEARTS }, (_, index) => index + 1);
  protected readonly levelLinks = SPRITES.map((sprite) => ({
    stage: sprite.stage,
    route: ['/adventure', `dragon-duel-${sprite.stage}`],
  }));
  protected readonly nextLink = computed(() => {
    const stage = this.sprite().stage;
    return stage < TOTAL_DUELS ? ['/adventure', `dragon-duel-${stage + 1}`] : null;
  });
  protected readonly paces = DUEL_PACES;
  protected readonly pace = signal<DuelPace>(this.readPace());
  protected readonly timed = computed(() => this.pace() !== 'off');

  /** Hatched dragons in book order; a guest Ember helps until the first egg hatches. */
  protected readonly team = computed(() => {
    const hatched = this.hatchery.hatchery().hatched;
    const found = DRAGONS.filter((dragon) => hatched.includes(dragon.id));
    return found.length ? found : [dragonById('ember')!];
  });
  protected readonly guest = computed(() => !this.hatchery.hatchery().hatched.length);
  private readonly picked = signal<string | null>(null);
  protected readonly dragon = computed<Dragon>(() => {
    const team = this.team();
    const favorite = this.hatchery.hatchery().favorite;
    return (
      team.find((dragon) => dragon.id === this.picked()) ??
      team.find((dragon) => dragon.id === favorite) ??
      team[0]
    );
  });
  protected readonly form = computed(() => this.hatchery.stage(this.dragon()));

  protected readonly phase = linkedSignal<Phase>(() => {
    this.sprite();
    return 'intro';
  });
  protected readonly duel = signal<Duel>(startDuel(SPRITES[0], 'fire'));
  /** The sum just answered right, shown while the attack flies. */
  protected readonly answered = signal<{ question: DuelQuestion; value: number } | null>(null);
  protected readonly callout = signal<Callout | null>(null);
  protected readonly stars = signal(0);
  protected readonly saveFailed = signal(false);
  protected readonly coachOpen = signal(false);
  /** Wrong tries on the sum on screen. */
  private readonly tries = signal(0);
  private readonly learning = signal(guide.count() < GUIDED_ANSWERS);
  private readonly idle = signal(false);

  protected readonly fighting = computed(
    () => this.phase() === 'fighting' && this.duel().phase === 'fighting',
  );
  protected readonly question = computed(() => this.answered()?.question ?? this.duel().question);
  protected readonly sum = computed(() => shownSum(this.question().text));
  protected readonly showTip = computed(() => this.fighting() && this.tries() >= TIP_AFTER);
  /** The answers hop to say "tap one of these": always while learning, else after a wait. */
  protected readonly guideOn = computed(
    () =>
      this.fighting() && !this.answered() && !this.coachOpen() && (this.learning() || this.idle()),
  );
  protected readonly energyShare = computed(() => this.duel().energy / this.sprite().energy);
  protected readonly reward = computed(() => {
    const duel = this.duel();
    if (duel.phase !== 'won' || this.phase() === 'intro') return null;
    const stars = this.stars();
    const badges = [this.t('badgeEgg', { n: EGG_BONUS })];
    if (duel.hearts === HEARTS && this.timed()) badges.push(this.t('badgeHearts'));
    if (duel.criticals > 1) badges.push(this.t('badgeCriticals', { n: duel.criticals }));
    return {
      kind: stars === 3 ? ('golden' as const) : ('plain' as const),
      cheer: this.t(stars === 3 ? 'rewardPerfect' : 'rewardWin'),
      points: this.t('rewardStars', { n: stars }),
      badges,
    };
  });

  protected readonly frame = computed<ArenaFrame>(() => {
    const duel = this.duel();
    const hit = duel.lastHit;
    const sprite = this.sprite();
    return {
      dragon: this.dragon(),
      form: this.form(),
      sprite: sprite.id,
      sky: skyFor(sprite.stage),
      phase: this.phase() === 'intro' ? 'intro' : duel.phase,
      charge: duel.charge,
      hits: duel.hits,
      zaps: duel.zaps,
      giggles: duel.giggles,
      big: !!hit && (hit.critical || hit.weakSpot),
    };
  });
  protected readonly loadWorld: WorldLoader<ArenaFrame> = () =>
    import('./duel-world').then((m) => m.DuelWorld);

  private readonly outcome = viewChild<ElementRef<HTMLElement>>('outcome');
  private shownAt = 0;
  private calloutId = 0;
  private tick?: ReturnType<typeof setInterval>;
  private idleTimer?: ReturnType<typeof setTimeout>;
  private timers: ReturnType<typeof setTimeout>[] = [];

  constructor() {
    this.portraits.load();
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  protected t(key: DuelMessageKey, values: Record<string, string | number> = {}) {
    return duelText(this.i.locale(), key, values);
  }
  protected spriteName(stage = this.sprite().stage) {
    return this.i.t(`duel${stage}` as MessageKey);
  }
  protected spriteHelp() {
    return this.i.t(`duel${this.sprite().stage}Help` as MessageKey);
  }
  protected dragonName(dragon = this.dragon()) {
    return this.hatchery.name(dragon);
  }
  protected elementWord(element: DragonElement) {
    return this.t(ELEMENT_WORDS[element]);
  }
  protected elementColor(element: DragonElement) {
    return ATTACK_COLORS[element][0];
  }
  protected paceLabel(pace: DuelPace) {
    return this.t(PACE_LABELS[pace]);
  }
  protected paceSeconds(pace: DuelPace) {
    return chargeSeconds(pace, this.sprite());
  }
  protected tip() {
    return this.t(`tip${this.sprite().stage}` as DuelMessageKey);
  }
  /** The sum for screen readers, with the hidden number read as a pause. */
  protected spoken() {
    return this.t('question', { q: this.question().text.replace('?', '…') });
  }

  protected pick(dragon: Dragon) {
    this.picked.set(dragon.id);
  }

  protected selectPace(pace: DuelPace) {
    this.pace.set(pace);
    try {
      this.document.defaultView?.localStorage.setItem(PACE_KEY, pace);
    } catch {
      /* The pace stays for this visit. */
    }
  }

  protected start() {
    this.stop();
    this.duel.set(startDuel(this.sprite(), this.dragon().element));
    this.phase.set('fighting');
    this.answered.set(null);
    this.callout.set(null);
    this.tries.set(0);
    this.stars.set(0);
    this.saveFailed.set(false);
    this.coachOpen.set(false);
    this.shownAt = Date.now();
    this.p.explore('tens');
    this.sounds.play('start');
    this.tick = setInterval(() => this.onTick(), TICK_MS);
    this.armIdle();
    this.focusAnswers();
  }

  protected choose(value: number) {
    if (!this.fighting() || this.answered() || this.coachOpen()) return;
    const before = this.duel();
    const seconds = (Date.now() - this.shownAt) / 1000;
    const next = answer(before, value, seconds, this.pace());
    if (next === before) return;
    this.duel.set(next);
    this.armIdle();
    if (next.hits > before.hits) {
      this.hit(before, next, value);
      return;
    }
    this.tries.update((n) => n + 1);
    if (next.zaps > before.zaps) this.zapped(next);
    else {
      this.say('giggle', this.t('giggle'));
      this.sounds.play('giggle');
    }
    this.focusAnswers();
  }

  private hit(before: Duel, next: Duel, value: number) {
    this.hatchery.warm();
    if (this.learning()) this.learning.set(guide.add() < GUIDED_ANSWERS);
    const hit = next.lastHit!;
    const words = [this.t(ATTACKS[this.dragon().element])];
    if (hit.critical) words.push(this.t('critical'));
    if (hit.weakSpot) words.push(this.t('weakHit'));
    const big = hit.critical || hit.weakSpot;
    this.say(big ? 'big' : 'hit', words.join(' '));
    this.sounds.play(big ? 'critical' : 'attack');
    this.answered.set({ question: before.question, value });
    this.tries.set(0);
    if (next.phase === 'won') {
      this.win();
      return;
    }
    this.later(() => {
      this.answered.set(null);
      this.shownAt = Date.now();
      this.armIdle();
      this.focusAnswers();
    }, LOCK_MS);
  }

  private onTick() {
    if (!this.fighting() || this.answered() || this.coachOpen()) return;
    if (this.document.visibilityState === 'hidden') return;
    const before = this.duel();
    const next = charge(before, TICK_MS / 1000, this.pace());
    if (next === before) return;
    this.duel.set(next);
    if (next.zaps > before.zaps) this.zapped(next);
  }

  private zapped(next: Duel) {
    this.say('zap', this.t('zapped', { name: this.dragonName() }));
    this.sounds.play(next.phase === 'napping' ? 'nap' : 'zap');
    if (next.phase === 'napping') {
      this.stopClock();
      this.later(() => this.finish(), NAP_MS);
    }
  }

  private win() {
    this.stopClock();
    this.stars.set(duelStars(this.duel()));
    this.hatchery.warm(EGG_BONUS);
    this.saveFailed.set(!this.record());
    this.later(() => this.sounds.play('win'), 600);
    this.later(() => this.finish(), WIN_MS);
  }

  private finish() {
    this.answered.set(null);
    this.phase.set('finished');
    requestAnimationFrame(() => this.outcome()?.nativeElement.focus({ preventScroll: true }));
  }

  private record() {
    const stars = this.stars();
    return this.completion.finish({
      levelId: this.levelId(),
      completed: true,
      mastered: stars === 3,
      stars,
    });
  }

  protected celebrate() {
    if (this.completion.result()?.levelId === this.levelId() || this.record())
      void this.router.navigate(['/complete', this.levelId()]);
    else this.saveFailed.set(true);
  }

  protected backToIntro() {
    this.stop();
    this.phase.set('intro');
  }

  /** Opens "how to duel"; the sprite holds its charge until the child closes it. */
  protected openCoach() {
    if (!this.fighting() || this.coachOpen()) return;
    clearTimeout(this.idleTimer);
    this.idle.set(false);
    this.coachOpen.set(true);
  }

  protected closeCoach() {
    if (!this.coachOpen()) return;
    this.coachOpen.set(false);
    this.armIdle();
    requestAnimationFrame(() =>
      this.host.nativeElement.querySelector<HTMLElement>('.help')?.focus({ preventScroll: true }),
    );
  }

  protected visibilityChanged() {
    // The charge only ticks while the page shows; nothing else needs doing.
    if (this.document.hidden) clearTimeout(this.idleTimer);
    else if (this.fighting()) this.armIdle();
  }

  /** Shows a callout over the arena for a moment; the status line keeps the words. */
  private say(kind: Callout['kind'], text: string) {
    const id = ++this.calloutId;
    this.callout.set({ id, kind, text });
    this.later(() => {
      if (this.callout()?.id === id) this.callout.set({ id, kind: 'gone', text });
    }, CALLOUT_MS);
  }

  private armIdle() {
    clearTimeout(this.idleTimer);
    this.idle.set(false);
    this.idleTimer = setTimeout(() => this.idle.set(true), IDLE_GUIDE);
  }

  private focusAnswers() {
    requestAnimationFrame(() => {
      const active = this.document.activeElement;
      if (
        active &&
        active !== this.document.body &&
        this.host.nativeElement.contains(active) &&
        !(active as HTMLButtonElement).disabled
      )
        return;
      this.host.nativeElement
        .querySelector<HTMLElement>('.answer:not([disabled])')
        ?.focus({ preventScroll: true });
    });
  }

  private later(callback: () => void, ms: number) {
    this.timers.push(setTimeout(callback, ms));
  }

  private stopClock() {
    clearInterval(this.tick);
    this.tick = undefined;
    clearTimeout(this.idleTimer);
    this.idle.set(false);
  }

  private stop() {
    this.stopClock();
    for (const timer of this.timers) clearTimeout(timer);
    this.timers = [];
  }

  private readPace(): DuelPace {
    try {
      return parseDuelPace(this.document.defaultView?.localStorage.getItem(PACE_KEY));
    } catch {
      return 'off';
    }
  }
}
