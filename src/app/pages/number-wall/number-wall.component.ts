import { Component, computed, effect, ElementRef, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';
import { LocaleService } from '../../core/locale';
import { MessageKey } from '../../core/messages';
import { ProgressService } from '../../core/progress';
import { Icon } from '../../shared/icon';
import { GameAudio } from '../fairy-defense/game-audio';
import { PlaytestStore } from '../fairy-defense/playtest-store';
import {
  BrickId,
  fillOrder,
  generateWorld,
  Hint,
  hintFor,
  isMissing,
  levels,
  parentOf,
  sameBrick,
  valueOf,
  Wall,
  WallLevel,
  WALLS_PER_WORLD,
} from './number-wall';
import { NumberWallStore } from './number-wall-store';
type Feedback =
  | { readonly kind: 'idle' }
  | { readonly kind: 'correct'; readonly value: number }
  | { readonly kind: 'wrong'; readonly hint: Hint }
  | { readonly kind: 'hint'; readonly hint: Hint }
  | { readonly kind: 'shown'; readonly value: number; readonly hint: Hint }
  | { readonly kind: 'built'; readonly perfect: boolean; readonly explanation?: string };
@Component({
  selector: 'app-number-wall',
  imports: [RouterLink, Icon, NgOptimizedImage],
  providers: [GameAudio],
  templateUrl: './number-wall.component.html',
  styleUrl: './number-wall.component.css',
  host: { '(document:keydown)': 'onKey($event)' },
})
export class NumberWallComponent {
  protected readonly i = inject(LocaleService);
  protected readonly store = inject(NumberWallStore);
  protected readonly sound = inject(PlaytestStore);
  private readonly audio = inject(GameAudio);
  private readonly progress = inject(ProgressService);
  protected readonly levels = levels;
  protected readonly total = WALLS_PER_WORLD;
  protected readonly phase = signal<'intro' | 'playing' | 'summary'>('intro');
  protected readonly level = signal<WallLevel>(1);
  protected readonly walls = signal<readonly Wall[]>([]);
  protected readonly wallIndex = signal(0);
  protected readonly wall = computed(() => this.walls()[this.wallIndex()]);
  protected readonly filled = signal<readonly BrickId[]>([]);
  protected readonly selected = signal<BrickId | undefined>(undefined);
  protected readonly entry = signal('');
  protected readonly feedback = signal<Feedback>({ kind: 'idle' });
  protected readonly misses = signal(0);
  protected readonly streak = signal(0);
  protected readonly firstTry = signal(0);
  protected readonly wobbling = signal(false);
  protected readonly justFilled = signal<BrickId | undefined>(undefined);
  private wallMissed = false;
  private brickMissed = false;
  protected readonly displayRows = computed(() => {
    const wall = this.wall();
    return wall
      ? wall.rows.map((row, rowIndex) => ({ rowIndex, cols: row.map((_, col) => col) })).reverse()
      : [];
  });
  protected readonly built = computed(() => this.feedback().kind === 'built');
  /** The left brick of the pair that makes (or completes) the glowing brick. */
  private readonly pair = computed<BrickId | undefined>(() => {
    const wall = this.wall();
    const brick = this.selected();
    if (!wall || !brick) return undefined;
    if (brick.row > 0) return { row: brick.row - 1, col: brick.col };
    const above = parentOf(wall, brick);
    return above && { row: 0, col: Math.min(brick.col, above.sibling.col) };
  });
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
        return this.t('wallCorrect', { n: feedback.value });
      case 'wrong':
        return this.t('wallWrong') + ' ' + this.hintText(feedback.hint);
      case 'hint':
        return this.hintText(feedback.hint);
      case 'shown':
        return this.shownText(feedback.value, feedback.hint);
      case 'built':
        return (
          (feedback.explanation ? feedback.explanation + ' ' : '') +
          this.t('wallBuilt') +
          (feedback.perfect ? ' ' + this.t('wallPerfect') : '')
        );
    }
  });
  protected readonly numberLine = computed(() => {
    const feedback = this.feedback();
    const hint =
      feedback.kind === 'wrong' || feedback.kind === 'hint' || feedback.kind === 'shown'
        ? feedback.hint
        : undefined;
    if (hint?.kind !== 'complete' || hint.target - hint.known > 12) return undefined;
    return {
      from: hint.known,
      to: hint.target,
      steps: Array.from({ length: hint.target - hint.known }, (_, index) => hint.known + index + 1),
    };
  });
  protected readonly canShow = computed(() => this.misses() >= 3 && !this.built());
  protected readonly soundOn = computed(() => this.sound.audio().effects);
  private readonly nextButton = viewChild<ElementRef<HTMLButtonElement>>('nextButton');
  private readonly summaryPanel = viewChild<ElementRef<HTMLElement>>('summary');
  private readonly scene = viewChild<ElementRef<HTMLElement>>('scene');
  private timer?: ReturnType<typeof setTimeout>;
  constructor() {
    effect(() => this.audio.updateVoice(this.i.locale()));
    effect(() => {
      if (this.built()) this.nextButton()?.nativeElement.focus();
    });
    effect(() => {
      if (this.phase() === 'summary') this.summaryPanel()?.nativeElement.focus();
    });
  }
  protected t(key: MessageKey, params: Record<string, string | number> = {}): string {
    return Object.entries(params).reduce(
      (text, [name, value]) =>
        text.replaceAll(`{${name}}`, typeof value === 'number' ? this.i.format(value) : value),
      this.i.t(key),
    );
  }
  protected levelTitle(level: WallLevel): MessageKey {
    return `wallLevel${level}` as MessageKey;
  }
  protected levelHelp(level: WallLevel): MessageKey {
    return `wallLevel${level}Help` as MessageKey;
  }
  protected start(level: WallLevel) {
    if (!this.store.unlocked(level)) return;
    this.audio.start();
    this.level.set(level);
    this.walls.set(generateWorld(level));
    this.wallIndex.set(0);
    this.firstTry.set(0);
    this.phase.set('playing');
    this.beginWall();
  }
  private beginWall() {
    const wall = this.wall();
    this.filled.set([]);
    this.selected.set(wall ? fillOrder(wall)[0] : undefined);
    this.entry.set('');
    this.misses.set(0);
    this.feedback.set({ kind: 'idle' });
    this.justFilled.set(undefined);
    this.wallMissed = false;
    this.brickMissed = false;
    this.scene()?.nativeElement.focus({ preventScroll: true });
  }
  protected isOpen(brick: BrickId): boolean {
    const wall = this.wall();
    return !!wall && isMissing(wall, brick) && !this.filled().some((f) => sameBrick(f, brick));
  }
  protected isFilled(brick: BrickId): boolean {
    return this.filled().some((f) => sameBrick(f, brick));
  }
  protected isSelected(brick: BrickId): boolean {
    const selected = this.selected();
    return !!selected && sameBrick(selected, brick);
  }
  /** A plus sign sits between the two bricks a child should add right now. */
  protected plusBefore(brick: BrickId): boolean {
    const pair = this.pair();
    return !!pair && pair.row === brick.row && pair.col + 1 === brick.col;
  }
  protected isJustFilled(brick: BrickId): boolean {
    const just = this.justFilled();
    return !!just && sameBrick(just, brick);
  }
  protected value(brick: BrickId): number {
    return valueOf(this.wall()!, brick);
  }
  protected select(brick: BrickId) {
    if (this.built() || !this.isOpen(brick)) return;
    if (!this.isSelected(brick)) {
      this.selected.set(brick);
      this.entry.set('');
      this.misses.set(0);
      this.brickMissed = false;
      this.feedback.set({ kind: 'idle' });
    }
  }
  protected type(digit: string) {
    if (this.built() || !this.selected() || this.entry().length >= 2) return;
    const entry = (this.entry() + digit).replace(/^0(?=\d)/, '');
    this.entry.set(entry);
    if (this.feedback().kind === 'wrong' || this.feedback().kind === 'correct')
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
    this.wallMissed = true;
    this.streak.set(0);
    this.entry.set('');
    const hint = hintFor(wall, brick, this.filled());
    this.feedback.set(this.misses() >= 2 ? { kind: 'hint', hint } : { kind: 'wrong', hint });
    this.wobbling.set(true);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.wobbling.set(false), 500);
  }
  protected showMe() {
    const wall = this.wall();
    const brick = this.selected();
    if (!wall || !brick || !this.canShow()) return;
    this.place(brick, valueOf(wall, brick), false, hintFor(wall, brick, this.filled()));
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
    }
    const remaining = fillOrder(wall).filter((id) => !this.isFilled(id));
    if (remaining.length) {
      this.selected.set(remaining[0]);
      this.feedback.set(shown ? { kind: 'shown', value, hint: shown } : { kind: 'correct', value });
      this.audio.effect('correct');
      return;
    }
    this.selected.set(undefined);
    this.feedback.set({
      kind: 'built',
      perfect: !this.wallMissed,
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
    this.store.earnStar(level);
    const starred = this.store.save().stars.length;
    this.progress.record({
      levelId: 'number-wall',
      completed: true,
      mastered: starred === levels.length,
      stars: Math.min(3, starred),
    });
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
