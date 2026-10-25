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
import { DOCUMENT } from '@angular/common';
import { LocaleService } from '../../core/locale';
import { MessageKey } from '../../core/messages';
import { ProgressService } from '../../core/progress';
import { Icon } from '../../shared/icon';
import { GameAudio } from '../fairy-defense/game-audio';
import { PlaytestStore } from '../fairy-defense/playtest-store';
import {
  BrickId,
  DUST_EVERY,
  fillOrder,
  FREEZE_MS,
  gemsFor,
  generateWorld,
  Hint,
  hintFor,
  isFast,
  isMissing,
  levels,
  MAX_DUST,
  Pace,
  paces,
  ratingFor,
  sameBrick,
  trollSeconds,
  valueOf,
  Wall,
  WallLevel,
  WALLS_PER_WORLD,
} from './number-wall';
import { NumberWallStore } from './number-wall-store';
import { WallScene } from './wall-scene';
import { wallText } from './wall-text';
type Feedback =
  | { readonly kind: 'idle' }
  | { readonly kind: 'correct'; readonly value: number; readonly streak: number }
  | { readonly kind: 'wrong' }
  | { readonly kind: 'hint'; readonly hint: Hint; readonly dust?: boolean }
  | { readonly kind: 'shown'; readonly value: number; readonly hint: Hint }
  | { readonly kind: 'troll' }
  | {
      readonly kind: 'built';
      readonly gems: number;
      readonly fast: boolean;
      readonly perfect: boolean;
      readonly explanation?: string;
    };
const TICK_MS = 100;
@Component({
  selector: 'app-number-wall',
  imports: [RouterLink, Icon, WallScene],
  providers: [GameAudio],
  templateUrl: './number-wall.component.html',
  styleUrl: './number-wall.component.css',
  host: {
    '(document:keydown)': 'onKey($event)',
    '(document:visibilitychange)': 'visibilityChanged()',
  },
})
export class NumberWallComponent {
  protected readonly i = inject(LocaleService);
  protected readonly store = inject(NumberWallStore);
  protected readonly sound = inject(PlaytestStore);
  private readonly audio = inject(GameAudio);
  private readonly progress = inject(ProgressService);
  private readonly document = inject(DOCUMENT);
  protected readonly levels = levels;
  protected readonly paces = paces;
  protected readonly stars = [1, 2, 3] as const;
  protected readonly total = WALLS_PER_WORLD;
  protected readonly maxDust = MAX_DUST;
  protected readonly phase = signal<'intro' | 'playing' | 'summary'>('intro');
  protected readonly level = signal<WallLevel>(1);
  protected readonly walls = signal<readonly Wall[]>([]);
  protected readonly wallIndex = signal(0);
  protected readonly wall = computed(() => this.walls()[this.wallIndex()]);
  protected readonly filled = signal<readonly BrickId[]>([]);
  protected readonly golden = signal<readonly BrickId[]>([]);
  protected readonly selected = signal<BrickId | undefined>(undefined);
  protected readonly entry = signal('');
  protected readonly feedback = signal<Feedback>({ kind: 'idle' });
  protected readonly misses = signal(0);
  protected readonly streak = signal(0);
  protected readonly firstTry = signal(0);
  protected readonly gems = signal(0);
  protected readonly gemPop = signal(false);
  protected readonly dust = signal(0);
  protected readonly wobbling = signal(false);
  protected readonly justFilled = signal<BrickId | undefined>(undefined);
  protected readonly trollProgress = signal<number | undefined>(undefined);
  protected readonly frozenMs = signal(0);
  protected readonly trollBump = signal(false);
  protected readonly rating = signal<1 | 2 | 3>(1);
  private wallMisses = 0;
  private brickMissed = false;
  private tick?: ReturnType<typeof setInterval>;
  private timers: ReturnType<typeof setTimeout>[] = [];
  protected readonly pace = computed(() => this.store.save().pace);
  protected readonly timed = computed(() => this.pace() !== 'relaxed');
  protected readonly built = computed(() => this.feedback().kind === 'built');
  protected readonly wallsDone = computed(() => this.wallIndex() + (this.built() ? 1 : 0));
  protected readonly combo = computed(() => (this.streak() >= DUST_EVERY ? this.streak() : 0));
  protected readonly trollAsleep = computed(() => this.frozenMs() > 0);
  protected readonly canShow = computed(() => this.misses() >= 3 && !this.built());
  protected readonly canDust = computed(
    () => this.dust() > 0 && !this.built() && !this.trollAsleep() && !!this.selected(),
  );
  protected readonly soundOn = computed(() => this.sound.audio().effects);
  protected readonly status = computed(() => {
    const feedback = this.feedback();
    switch (feedback.kind) {
      case 'idle':
        return this.entry()
          ? this.t('wallEntry', { n: this.entry() })
          : this.wall()?.missing.length === 1
            ? this.t('wallEntryEmpty')
            : this.t('wallChoose');
      case 'correct':
        return (
          this.t('wallCorrect', { n: feedback.value }) +
          (feedback.streak > 0 && feedback.streak % 5 === 0
            ? ' ' + this.t('wallComboBig', { n: feedback.streak })
            : feedback.streak > 0 && feedback.streak % DUST_EVERY === 0
              ? ' ' + this.t('wallDustEarned')
              : '')
        );
      case 'wrong':
        return this.t('wallWrong');
      case 'hint':
        return (
          (feedback.dust ? this.t('wallTrollFrozen') + ' ' : '') + this.hintText(feedback.hint)
        );
      case 'shown':
        return this.shownText(feedback.value, feedback.hint);
      case 'troll':
        return this.t('wallTrollArrived');
      case 'built':
        return [
          feedback.explanation,
          this.t('wallBuilt'),
          this.t('wallGemsWon', { n: feedback.gems }),
          feedback.fast ? this.t('wallFast') : '',
          feedback.perfect ? this.t('wallPerfect') : '',
        ]
          .filter(Boolean)
          .join(' ');
    }
  });
  protected readonly numberLine = computed(() => {
    const feedback = this.feedback();
    const hint = feedback.kind === 'hint' || feedback.kind === 'shown' ? feedback.hint : undefined;
    if (hint?.kind !== 'complete' || hint.target - hint.known > 12) return undefined;
    return {
      from: hint.known,
      to: hint.target,
      steps: Array.from({ length: hint.target - hint.known }, (_, index) => hint.known + index + 1),
    };
  });
  private readonly nextButton = viewChild<ElementRef<HTMLButtonElement>>('nextButton');
  private readonly summaryPanel = viewChild<ElementRef<HTMLElement>>('summary');
  private readonly scene = viewChild(WallScene, { read: ElementRef<HTMLElement> });
  constructor() {
    effect(() => this.audio.updateVoice(this.i.locale()));
    effect(() => {
      if (this.built()) this.nextButton()?.nativeElement.focus();
    });
    effect(() => {
      if (this.phase() === 'summary') this.summaryPanel()?.nativeElement.focus();
    });
    inject(DestroyRef).onDestroy(() => this.stopTroll());
  }
  protected t(key: MessageKey, params: Record<string, string | number> = {}): string {
    return wallText(this.i, key, params);
  }
  protected levelTitle(level: WallLevel): MessageKey {
    return `wallLevel${level}` as MessageKey;
  }
  protected levelHelp(level: WallLevel): MessageKey {
    return `wallLevel${level}Help` as MessageKey;
  }
  protected paceLabel(pace: Pace): MessageKey {
    return `wallPace${pace[0]!.toUpperCase()}${pace.slice(1)}` as MessageKey;
  }
  protected choosePace(pace: Pace) {
    this.store.setPace(pace);
  }
  protected start(level: WallLevel) {
    if (!this.store.unlocked(level)) return;
    this.audio.start();
    this.level.set(level);
    this.walls.set(generateWorld(level));
    this.wallIndex.set(0);
    this.firstTry.set(0);
    this.gems.set(0);
    this.dust.set(0);
    this.streak.set(0);
    this.phase.set('playing');
    this.beginWall();
  }
  private beginWall() {
    const wall = this.wall();
    this.filled.set([]);
    this.golden.set([]);
    this.selected.set(wall ? fillOrder(wall)[0] : undefined);
    this.entry.set('');
    this.misses.set(0);
    this.feedback.set({ kind: 'idle' });
    this.justFilled.set(undefined);
    this.wallMisses = 0;
    this.brickMissed = false;
    this.frozenMs.set(0);
    this.trollProgress.set(wall && trollSeconds(this.pace(), wall.missing.length) ? 0 : undefined);
    this.startTroll();
    this.scene()?.nativeElement.focus({ preventScroll: true });
  }
  private startTroll() {
    this.stopTroll();
    const wall = this.wall();
    const seconds = wall && trollSeconds(this.pace(), wall.missing.length);
    if (!seconds || this.built() || this.phase() !== 'playing') return;
    this.tick = setInterval(() => {
      if (this.frozenMs() > 0) {
        this.frozenMs.update((ms) => Math.max(0, ms - TICK_MS));
        return;
      }
      const next = (this.trollProgress() ?? 0) + TICK_MS / 1000 / seconds;
      if (next >= 1) this.trollArrives();
      else this.trollProgress.set(next);
    }, TICK_MS);
  }
  private stopTroll() {
    if (this.tick) clearInterval(this.tick);
    this.tick = undefined;
  }
  private trollArrives() {
    this.trollProgress.set(0);
    this.gems.update((gems) => Math.max(0, gems - 1));
    this.feedback.set({ kind: 'troll' });
    this.audio.effect('damage');
    this.flash(this.trollBump, 700);
  }
  protected visibilityChanged() {
    if (this.document.hidden) this.stopTroll();
    else this.startTroll();
  }
  private flash(flag: { set(value: boolean): void }, ms: number) {
    flag.set(true);
    this.timers.push(setTimeout(() => flag.set(false), ms));
  }
  protected select(brick: BrickId) {
    const wall = this.wall();
    if (!wall || this.built() || !isMissing(wall, brick) || this.isFilled(brick)) return;
    if (this.selected() && sameBrick(this.selected()!, brick)) return;
    this.selected.set(brick);
    this.entry.set('');
    this.misses.set(0);
    this.brickMissed = false;
    this.feedback.set({ kind: 'idle' });
  }
  private isFilled(brick: BrickId): boolean {
    return this.filled().some((f) => sameBrick(f, brick));
  }
  protected type(digit: string) {
    if (this.built() || !this.selected() || this.entry().length >= 2) return;
    const entry = (this.entry() + digit).replace(/^0(?=\d)/, '');
    this.entry.set(entry);
    const kind = this.feedback().kind;
    if (kind === 'wrong' || kind === 'correct' || kind === 'troll')
      this.feedback.set({ kind: 'idle' });
    if (entry.length === 2) this.check();
  }
  protected erase() {
    if (this.built()) return;
    this.entry.update((entry) => entry.slice(0, -1));
  }
  protected check() {
    const wall = this.wall();
    const brick = this.selected();
    if (!wall || !brick || this.built() || this.entry() === '') return;
    const answer = valueOf(wall, brick);
    if (Number(this.entry()) === answer) {
      this.place(brick, answer, !this.brickMissed);
      return;
    }
    this.audio.effect('wrong');
    this.misses.update((count) => count + 1);
    this.brickMissed = true;
    this.wallMisses++;
    this.streak.set(0);
    this.entry.set('');
    this.feedback.set(
      this.misses() >= 2
        ? { kind: 'hint', hint: hintFor(wall, brick, this.filled()) }
        : { kind: 'wrong' },
    );
    this.flash(this.wobbling, 500);
  }
  protected showMe() {
    const wall = this.wall();
    const brick = this.selected();
    if (!wall || !brick || !this.canShow()) return;
    this.place(brick, valueOf(wall, brick), false, hintFor(wall, brick, this.filled()));
  }
  protected useDust() {
    const wall = this.wall();
    const brick = this.selected();
    if (!wall || !brick || !this.canDust()) return;
    this.dust.update((count) => count - 1);
    if (this.timed()) this.frozenMs.set(FREEZE_MS);
    this.feedback.set({ kind: 'hint', hint: hintFor(wall, brick, this.filled()), dust: true });
    this.audio.effect('cast');
  }
  private place(brick: BrickId, value: number, firstTry: boolean, shown?: Hint) {
    const wall = this.wall()!;
    this.filled.update((filled) => [...filled, brick]);
    this.justFilled.set(brick);
    this.entry.set('');
    this.misses.set(0);
    this.brickMissed = false;
    if (firstTry) {
      this.firstTry.update((count) => count + 1);
      this.streak.update((count) => count + 1);
      this.store.recordStreak(this.streak());
      if (this.streak() % DUST_EVERY === 0)
        this.dust.update((count) => Math.min(MAX_DUST, count + 1));
      if (this.streak() >= DUST_EVERY) this.golden.update((golden) => [...golden, brick]);
    }
    const remaining = fillOrder(wall).filter((id) => !this.isFilled(id));
    if (remaining.length) {
      this.selected.set(remaining[0]);
      this.feedback.set(
        shown
          ? { kind: 'shown', value, hint: shown }
          : { kind: 'correct', value, streak: firstTry ? this.streak() : 0 },
      );
      this.audio.effect('correct');
      return;
    }
    this.stopTroll();
    const outcome = { misses: this.wallMisses, trollProgress: this.trollProgress() };
    const gems = gemsFor(outcome);
    this.gems.update((total) => total + gems);
    this.flash(this.gemPop, 700);
    this.selected.set(undefined);
    this.feedback.set({
      kind: 'built',
      gems,
      fast: isFast(outcome),
      perfect: this.wallMisses === 0,
      ...(shown ? { explanation: this.shownText(value, shown) } : {}),
    });
    this.audio.effect('complete');
  }
  protected next() {
    if (!this.built()) return;
    if (this.wallIndex() + 1 < this.walls().length) {
      this.wallIndex.update((index) => index + 1);
      this.beginWall();
      return;
    }
    this.finishWorld();
  }
  private finishWorld() {
    const level = this.level();
    const rating = ratingFor(this.gems(), this.timed());
    this.rating.set(rating);
    this.store.recordWorld(level, rating, this.gems());
    const starred = this.store.starredLevels();
    this.progress.record({
      levelId: 'number-wall',
      source: 'practice',
      completed: true,
      mastered: starred === levels.length,
      stars: Math.min(3, starred),
    });
    this.trollProgress.set(undefined);
    this.phase.set('summary');
  }
  protected nextLevel(): WallLevel | undefined {
    const level = this.level();
    return level < 4 ? ((level + 1) as WallLevel) : undefined;
  }
  protected chooseLevel() {
    this.phase.set('intro');
  }
  protected toggleSound() {
    const on = !this.soundOn();
    if (this.sound.audio().effects !== on) this.sound.toggle('effects');
    if (this.sound.audio().music !== on) this.sound.toggle('music');
    this.audio.sync();
  }
  protected onKey(event: KeyboardEvent) {
    if (this.phase() !== 'playing' || event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
    if (/^\d$/.test(event.key)) {
      this.type(event.key);
      event.preventDefault();
    } else if (event.key === 'Backspace') {
      this.erase();
      event.preventDefault();
    } else if (event.key === 'Enter') {
      if (this.built()) this.next();
      else if (this.entry()) this.check();
      else return;
      event.preventDefault();
    }
  }
  private hintText(hint: Hint): string {
    switch (hint.kind) {
      case 'add':
        return this.t('wallHintAdd', { a: hint.left, b: hint.right });
      case 'complete':
        return this.t('wallHintComplete', { a: hint.known, t: hint.target });
      case 'fillOther':
        return this.t('wallHintOther');
    }
  }
  private shownText(value: number, hint: Hint): string {
    if (hint.kind === 'add')
      return this.t('wallShown', { n: value, a: hint.left, b: hint.right, t: hint.sum });
    if (hint.kind === 'complete')
      return this.t('wallShown', { n: value, a: hint.known, b: value, t: hint.target });
    return this.t('wallCorrect', { n: value });
  }
}
