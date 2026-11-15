import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LocaleService } from '../../core/locale';
import { BrickId, Wall } from './number-wall';
import { BrickRect, pairFor } from './wall-frame';
import { WallPick } from './wall-pick';

const wall: Wall = {
  level: 4,
  rows: [[3, 4, 5], [7, 9], [16]],
  missing: [
    { row: 0, col: 1 },
    { row: 2, col: 0 },
  ],
};
const rect = (row: number, col: number, build = 1): BrickRect => ({
  build,
  row,
  col,
  x: 20 + col * 30,
  y: 80 - row * 20,
  w: 25,
  h: 15,
});

@Component({
  imports: [WallPick],
  template: `<app-wall-pick
    [wall]="wall"
    [build]="1"
    [rects]="rects()"
    [filled]="filled()"
    [selected]="selected()"
    entry="1"
    [trollProgress]="0.42"
    (select)="picked.set($event)"
  />`,
})
class Harness {
  readonly wall = wall;
  readonly rects = signal<readonly BrickRect[]>([]);
  readonly filled = signal<readonly BrickId[]>([]);
  readonly selected = signal<BrickId | undefined>({ row: 0, col: 1 });
  readonly picked = signal<BrickId | undefined>(undefined);
}

describe('WallPick', () => {
  function setup() {
    const fixture = TestBed.createComponent(Harness);
    TestBed.inject(LocaleService).select('en');
    fixture.componentInstance.rects.set([
      ...wall.rows.flatMap((row, r) => row.map((_, c) => rect(r, c))),
      rect(3, 0, 0),
    ]);
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  it('lays a real button over every open brick and names the others', () => {
    const { element } = setup();
    const buttons = [...element.querySelectorAll<HTMLButtonElement>('button.spot')];
    // Top row first, like the wall reads.
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Empty brick, row 1, brick 1',
      'Empty brick, row 3, brick 2 · Your number: 1',
    ]);
    expect(buttons[1]!.getAttribute('aria-pressed')).toBe('true');
    expect(buttons[1]!.style.left).toBe('50%');
    expect(element.querySelectorAll('span.spot[role="img"]')).toHaveLength(4);
    expect(element.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('42');
  });

  it('ignores bricks drawn for another wall and reports taps', () => {
    const { fixture, element } = setup();
    expect(element.querySelectorAll('.spot')).toHaveLength(6);
    element.querySelector<HTMLButtonElement>('button.spot')!.click();
    expect(fixture.componentInstance.picked()).toEqual({ row: 2, col: 0 });
  });

  it('stops offering a brick once it is filled', () => {
    const { fixture, element } = setup();
    fixture.componentInstance.filled.set([{ row: 0, col: 1 }]);
    fixture.detectChanges();
    expect(element.querySelectorAll('button.spot')).toHaveLength(1);
  });
});

describe('pairFor', () => {
  it('points at the two bricks below, or the neighbour under the same parent', () => {
    expect(pairFor(wall, { row: 2, col: 0 })).toEqual({ row: 1, col: 0 });
    expect(pairFor(wall, { row: 0, col: 1 })).toEqual({ row: 0, col: 1 });
    expect(pairFor(wall, { row: 0, col: 2 })).toEqual({ row: 0, col: 1 });
    expect(pairFor(wall, undefined)).toBeUndefined();
  });
});
