import { Component, computed, inject, input, output } from '@angular/core';
import { LocaleService } from '../../core/locale';
import {
  BrickId,
  isMissing,
  parentOf,
  sameBrick,
  valueOf,
  Wall,
  WALLS_PER_WORLD,
} from './number-wall';
import { wallText } from './wall-text';
/** The castle scene: bricks, the fairy, the growing towers and the approaching troll. */
@Component({
  selector: 'app-wall-scene',
  templateUrl: './wall-scene.html',
  styleUrl: './wall-scene.css',
  host: {
    '[class.celebrating]': 'built()',
    '[style.--built]': 'wallsDone()',
    '[style.--p]': 'trollProgress() ?? 0',
  },
})
export class WallScene {
  readonly wall = input.required<Wall>();
  readonly filled = input<readonly BrickId[]>([]);
  readonly golden = input<readonly BrickId[]>([]);
  readonly selected = input<BrickId | undefined>(undefined);
  readonly justFilled = input<BrickId | undefined>(undefined);
  readonly entry = input('');
  readonly wobbling = input(false);
  readonly built = input(false);
  readonly wallsDone = input(0);
  readonly trollProgress = input<number | undefined>(undefined);
  readonly trollAsleep = input(false);
  readonly trollBump = input(false);
  readonly select = output<BrickId>();
  protected readonly i = inject(LocaleService);
  protected readonly total = WALLS_PER_WORLD;
  protected readonly rows = computed(() =>
    this.wall()
      .rows.map((row, rowIndex) => ({ rowIndex, cols: row.map((_, col) => col) }))
      .reverse(),
  );
  protected readonly confetti = ['✦', '★', '✦', '✧', '★', '✦'];
  /** The left brick of the pair that makes (or completes) the glowing brick. */
  private readonly pair = computed<BrickId | undefined>(() => {
    const brick = this.selected();
    if (!brick) return undefined;
    if (brick.row > 0) return { row: brick.row - 1, col: brick.col };
    const above = parentOf(this.wall(), brick);
    return above && { row: 0, col: Math.min(brick.col, above.sibling.col) };
  });
  /** A plus sign sits between the two bricks a child should add right now. */
  protected plusBefore(brick: BrickId): boolean {
    const pair = this.pair();
    return !!pair && pair.row === brick.row && pair.col + 1 === brick.col;
  }
  protected readonly trollPercent = computed(() => Math.round((this.trollProgress() ?? 0) * 100));
  protected isOpen(brick: BrickId): boolean {
    return isMissing(this.wall(), brick) && !this.isFilled(brick);
  }
  protected isFilled(brick: BrickId): boolean {
    return this.filled().some((f) => sameBrick(f, brick));
  }
  protected isGolden(brick: BrickId): boolean {
    return this.golden().some((g) => sameBrick(g, brick));
  }
  protected isSelected(brick: BrickId): boolean {
    const selected = this.selected();
    return !!selected && sameBrick(selected, brick);
  }
  protected isJustFilled(brick: BrickId): boolean {
    const just = this.justFilled();
    return !!just && sameBrick(just, brick);
  }
  protected value(brick: BrickId): number {
    return valueOf(this.wall(), brick);
  }
  protected emptyLabel(brick: BrickId): string {
    return (
      wallText(this.i, 'wallBrickEmpty', {
        r: this.wall().rows.length - brick.row,
        c: brick.col + 1,
      }) +
      (this.isSelected(brick) && this.entry()
        ? ' · ' + wallText(this.i, 'wallEntry', { n: this.entry() })
        : '')
    );
  }
  protected t(key: Parameters<typeof wallText>[1], params?: Record<string, string | number>) {
    return wallText(this.i, key, params);
  }
}
