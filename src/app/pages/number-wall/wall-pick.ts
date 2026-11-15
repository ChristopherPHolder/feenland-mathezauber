import { Component, computed, inject, input, output } from '@angular/core';
import { LocaleService } from '../../core/locale';
import { BrickId, isMissing, sameBrick, valueOf, Wall } from './number-wall';
import { BrickRect } from './wall-frame';
import { wallText } from './wall-text';

/**
 * Lies over the 3D castle and keeps it usable without the canvas: a real, transparent button
 * over every open brick (keyboard, screen readers and taps all land on it), an invisible
 * label over every brick that already shows its number, and the troll's progress.
 */
@Component({
  selector: 'app-wall-pick',
  template: `
    @for (spot of spots(); track spot.key) {
      @if (spot.open) {
        <button
          type="button"
          class="spot open"
          [class.selected]="spot.selected"
          [style.left.%]="spot.rect.x"
          [style.top.%]="spot.rect.y"
          [style.width.%]="spot.rect.w"
          [style.height.%]="spot.rect.h"
          [attr.data-row]="spot.rect.row"
          [attr.data-col]="spot.rect.col"
          [attr.aria-pressed]="spot.selected"
          [attr.aria-label]="spot.label"
          (click)="select.emit({ row: spot.rect.row, col: spot.rect.col })"
        ></button>
      } @else {
        <span
          class="spot"
          role="img"
          [style.left.%]="spot.rect.x"
          [style.top.%]="spot.rect.y"
          [style.width.%]="spot.rect.w"
          [style.height.%]="spot.rect.h"
          [attr.aria-label]="spot.label"
        ></span>
      }
    }
    @if (trollProgress() !== undefined) {
      <div
        class="troll-meter"
        role="progressbar"
        [attr.aria-valuemin]="0"
        [attr.aria-valuemax]="100"
        [attr.aria-valuenow]="trollPercent()"
        [attr.aria-label]="t('wallTrollLabel')"
      ></div>
    }
  `,
  styles: `
    :host {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
    .spot {
      position: absolute;
      min-width: 44px;
      min-height: 44px;
      translate: -50% -50%;
      border-radius: 14%;
    }
    button.spot {
      pointer-events: auto;
      margin: 0;
      padding: 0;
      border: 0;
      background: transparent;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    button.spot:focus-visible {
      outline: 4px solid var(--focus);
      outline-offset: 3px;
      box-shadow: 0 0 0 9px #ffffffd9;
    }
    .troll-meter {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    }
  `,
})
export class WallPick {
  readonly wall = input.required<Wall>();
  readonly build = input.required<number>();
  readonly rects = input<readonly BrickRect[]>([]);
  readonly filled = input<readonly BrickId[]>([]);
  readonly selected = input<BrickId | undefined>(undefined);
  readonly entry = input('');
  readonly trollProgress = input<number | undefined>(undefined);
  readonly select = output<BrickId>();
  protected readonly i = inject(LocaleService);

  /** Only rects drawn for the wall on screen: a stale set from the last wall never shows. */
  protected readonly spots = computed(() => {
    const wall = this.wall();
    const selected = this.selected();
    return (
      this.rects()
        .filter(
          (rect) => rect.build === this.build() && wall.rows[rect.row]?.[rect.col] !== undefined,
        )
        .map((rect) => {
          const brick = { row: rect.row, col: rect.col };
          const open = isMissing(wall, brick) && !this.filled().some((f) => sameBrick(f, brick));
          const isSelected = open && !!selected && sameBrick(selected, brick);
          const label = open
            ? this.t('wallBrickEmpty', { r: wall.rows.length - brick.row, c: brick.col + 1 }) +
              (isSelected && this.entry() ? ' · ' + this.t('wallEntry', { n: this.entry() }) : '')
            : this.t('wallBrickValue', { n: valueOf(wall, brick) });
          return { key: `${rect.row}-${rect.col}`, rect, open, selected: isSelected, label };
        })
        // Read top row first, like the wall is built up.
        .sort((a, b) => b.rect.row - a.rect.row || a.rect.col - b.rect.col)
    );
  });
  protected readonly trollPercent = computed(() => Math.round((this.trollProgress() ?? 0) * 100));

  protected t(key: Parameters<typeof wallText>[1], params?: Record<string, string | number>) {
    return wallText(this.i, key, params);
  }
}
