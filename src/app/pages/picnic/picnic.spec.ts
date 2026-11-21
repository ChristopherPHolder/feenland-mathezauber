import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { HatcheryStore } from '../hatchery/hatchery-store';
import { frac } from './fractions';
import { Task } from './picnic-levels';
import { fractionWords, picnicTranslations } from './picnic-messages';
import { segments } from './picnic';
import { startTask, TaskState } from './picnic-task';

const en = picnicTranslations.en;

interface Internals {
  round: WritableSignal<{ tasks: readonly Task[]; state: TaskState }>;
}

async function setup(id: string) {
  const { Picnic } = await import('./picnic');
  TestBed.configureTestingModule({
    imports: [Picnic],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id })) } },
    ],
  });
  const fixture = TestBed.createComponent(Picnic);
  fixture.detectChanges();
  return fixture;
}

type Fixture = ComponentFixture<unknown>;
const el = (fixture: Fixture) => fixture.nativeElement as HTMLElement;

function start(fixture: Fixture) {
  el(fixture).querySelector<HTMLButtonElement>('.start-dock button')!.click();
  fixture.detectChanges();
}

/** Puts a known share first in the round. */
function useTask(fixture: Fixture, task: Task) {
  const component = fixture.componentInstance as unknown as Internals;
  component.round.update((round) => ({
    ...round,
    tasks: [task, ...round.tasks.slice(1)],
    state: startTask(task),
  }));
  fixture.detectChanges();
}

function click(fixture: Fixture, selector: string, index = 0) {
  const button = el(fixture).querySelectorAll<HTMLButtonElement>(selector)[index];
  if (!button) throw new Error(`No ${selector} #${index}`);
  button.click();
  fixture.detectChanges();
}

/** The status line as a screen reader hears it: fractions as words, not digits. */
function status(fixture: Fixture) {
  const line = el(fixture).querySelector('.status')!.cloneNode(true) as HTMLElement;
  line.querySelectorAll('[aria-hidden="true"]').forEach((node) => node.remove());
  return line.textContent!.replace(/\s+/g, ' ').trim();
}

describe('Picnic', () => {
  afterEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it('opens on a level card with the film, the ant choice and twelve levels', async () => {
    const fixture = await setup('picnic-1');
    const host = el(fixture);
    expect(host.querySelectorAll('.level-pill')).toHaveLength(12);
    expect(host.querySelector('.level-pill[aria-current="page"]')!.textContent!.trim()).toBe('1');
    expect(host.querySelector('app-picnic-demo')).not.toBeNull();
    expect(host.querySelectorAll('.pace-choice input')).toHaveLength(4);
    expect(host.querySelectorAll('.friend-row li')).toHaveLength(12);
  });

  it('cuts a pie fairly in halves and munches', async () => {
    const fixture = await setup('picnic-1');
    start(fixture);
    useTask(fixture, { kind: 'cut', food: 'pie', parts: 2, preset: [] });
    const warm = vi.spyOn(TestBed.inject(HatcheryStore), 'warm');
    const marks = el(fixture).querySelectorAll<HTMLButtonElement>('.mark');
    expect(marks).toHaveLength(11);
    expect(el(fixture).querySelector<HTMLButtonElement>('.share-button')!.disabled).toBe(true);
    // An uneven cut first: the help shows the pieces side by side, never where to cut.
    click(fixture, '.mark', 4);
    expect(marks[4].getAttribute('aria-pressed')).toBe('true');
    click(fixture, '.share-button');
    expect(el(fixture).querySelector('.hint')!.textContent).toContain('same size');
    expect(el(fixture).querySelectorAll('.side-by-side path')).toHaveLength(2);
    // Take that cut away and cut opposite the top.
    click(fixture, '.mark', 4);
    click(fixture, '.mark', 5);
    click(fixture, '.share-button');
    expect(status(fixture)).toContain('one half');
    expect(warm).toHaveBeenCalledTimes(1);
    expect(el(fixture).querySelector('ui-reward-burst')).not.toBeNull();
  });

  it('names a share with stacked fractions that screen readers hear as words', async () => {
    const fixture = await setup('picnic-5');
    start(fixture);
    useTask(fixture, {
      kind: 'name',
      food: 'pie',
      share: frac(3, 4),
      choices: [frac(1, 4), frac(3, 4), frac(3, 5), frac(2, 4)],
    });
    const choices = [...el(fixture).querySelectorAll<HTMLButtonElement>('.fraction-choice')];
    expect(choices.map((b) => b.querySelector('.words')!.textContent)).toEqual([
      'one quarter',
      'three quarters',
      'three fifths',
      'two quarters',
    ]);
    expect(choices[1].querySelector('.n')!.textContent).toBe('3');
    expect(choices[1].querySelector('.d')!.textContent).toBe('4');
    // Three fifths miscounts the pieces: the help is about the bottom number.
    click(fixture, '.fraction-choice', 2);
    expect(el(fixture).querySelector('.hint')!.textContent).toContain('bottom number');
    expect(choices[2].disabled).toBe(true);
    click(fixture, '.fraction-choice', 1);
    expect(status(fixture)).toContain('three quarters');
  });

  it('asks the child to finish "more friends, so each slice is …" after a slip', async () => {
    const fixture = await setup('picnic-7');
    start(fixture);
    useTask(fixture, {
      kind: 'compare',
      food: 'pie',
      left: frac(1, 3),
      right: frac(1, 6),
      covered: false,
      same: false,
    });
    click(fixture, '.blanket-choice', 1);
    expect(el(fixture).querySelector('.hint')!.textContent).toContain(en.helpMoreFriends);
    const thought = el(fixture).querySelectorAll<HTMLButtonElement>('.finish-thought button');
    thought[1].click();
    fixture.detectChanges();
    expect(el(fixture).querySelector('.thought')!.textContent).toContain(en.moreRight);
    click(fixture, '.blanket-choice', 0);
    expect(status(fixture)).toContain('one third is more than one sixth');
  });

  it('deals berries in handfuls, then asks for the share of the group', async () => {
    const fixture = await setup('picnic-11');
    start(fixture);
    useTask(fixture, {
      kind: 'deal',
      share: frac(3, 4),
      total: 12,
      handfuls: [1, 2],
      choices: [3, 8, 9, 10],
    });
    expect(el(fixture).querySelectorAll('.plate')).toHaveLength(4);
    expect(el(fixture).querySelectorAll('.plate.later')).toHaveLength(1);
    click(fixture, '.handful', 1);
    expect(el(fixture).querySelector<HTMLButtonElement>('.handful:nth-child(2)')!.disabled).toBe(
      true,
    );
    click(fixture, '.handful', 0);
    expect(el(fixture).querySelectorAll('.number-choice')).toHaveLength(4);
    click(fixture, '.number-choice', 0);
    expect(el(fixture).querySelector('.hint')!.textContent).toContain('for later');
    click(fixture, '.number-choice', 2);
    expect(status(fixture)).toContain('three quarters of 12 is 9');
  });

  it('lets the ants take only the crumb when they arrive', async () => {
    vi.useFakeTimers();
    localStorage.setItem('feenland.picnic-pace.v1', 'fast');
    const fixture = await setup('picnic-4');
    start(fixture);
    expect(el(fixture).querySelector('.ant-chip')).not.toBeNull();
    vi.advanceTimersByTime(60_000);
    fixture.detectChanges();
    expect(status(fixture)).toContain('crumb');
    expect(el(fixture).querySelector('.ant-chip.arrived')).not.toBeNull();
  });

  it('opens the film from ? and holds the ants while it is open', async () => {
    const fixture = await setup('picnic-2');
    start(fixture);
    click(fixture, '.help');
    expect(el(fixture).querySelector('ui-coach-dialog app-picnic-demo')).not.toBeNull();
    click(fixture, 'ui-coach-dialog .button.primary');
    expect(el(fixture).querySelector('ui-coach-dialog')).toBeNull();
  });
});

describe('segments', () => {
  it('puts stacked fractions where the message has {f} and {g}', () => {
    const words = (f: { n: number; d: number }) => fractionWords('de', f);
    expect(
      segments('Ja! {f} ist mehr als {g}.', {}, { f: frac(1, 3), g: frac(1, 6) }, words),
    ).toEqual([
      { text: 'Ja! ' },
      { fraction: frac(1, 3), words: 'ein Drittel' },
      { text: ' ist mehr als ' },
      { fraction: frac(1, 6), words: 'ein Sechstel' },
      { text: '.' },
    ]);
  });

  it('says fractions aloud in every language', () => {
    expect(fractionWords('en', frac(3, 4))).toBe('three quarters');
    expect(fractionWords('de', frac(2, 3))).toBe('zwei Drittel');
    expect(fractionWords('es', frac(1, 2))).toBe('un medio');
    expect(fractionWords('fr', frac(3, 4))).toBe('trois quarts');
    expect(fractionWords('fr', frac(1, 3))).toBe('un tiers');
  });
});
