import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ProgressService } from '../../core/progress';
import { HatcheryStore } from '../hatchery/hatchery-store';
import { drumTranslations } from './drum-messages';
import { DrumPlay } from './drum-round';
import { DrumScores } from './drum-scores';
import { Drums } from './drums';

const en = drumTranslations.en;

interface Internals {
  play: Signal<DrumPlay | null>;
  ask: Signal<number | null>;
}

function setup(id: string) {
  TestBed.configureTestingModule({
    imports: [Drums],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id })) } },
    ],
  });
  const fixture = TestBed.createComponent(Drums);
  fixture.detectChanges();
  return fixture;
}

const element = (fixture: ComponentFixture<Drums>) => fixture.nativeElement as HTMLElement;
const internals = (fixture: ComponentFixture<Drums>) =>
  fixture.componentInstance as unknown as Internals;

function start(fixture: ComponentFixture<Drums>) {
  element(fixture).querySelector<HTMLButtonElement>('.start-dock button')!.click();
  fixture.detectChanges();
}

/** Lets the clock run, so hops land and the next question comes. */
function wait(fixture: ComponentFixture<Drums>, ms: number) {
  vi.advanceTimersByTime(ms);
  fixture.detectChanges();
}

function untilAsked(fixture: ComponentFixture<Drums>) {
  for (let step = 0; step < 200 && internals(fixture).ask() === null; step++) wait(fixture, 50);
  const index = internals(fixture).ask();
  if (index === null) throw new Error('no question came');
  return internals(fixture).play()!.mushrooms[index].value;
}

function buttons(fixture: ComponentFixture<Drums>) {
  return [...element(fixture).querySelectorAll<HTMLButtonElement>('button.answer')];
}

function press(fixture: ComponentFixture<Drums>, value: number) {
  const button = buttons(fixture).find(
    (b) => b.textContent!.replace(/^\d/, '').trim() === `${value}`,
  );
  if (!button) throw new Error(`no button ${value}`);
  button.click();
  fixture.detectChanges();
}

const status = (fixture: ComponentFixture<Drums>) =>
  element(fixture).querySelector('.status')!.textContent!;

describe('the mushroom drums', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('offers twelve levels and free play first, then plays a whole song to three stars', () => {
    const fixture = setup('drums-4');
    expect(element(fixture).textContent).toContain('Level 4 of 12');
    expect(element(fixture).querySelectorAll('.level-pill').length).toBe(12);
    expect(element(fixture).querySelector('app-drum-demo')!.textContent).toContain('How to play');
    const free = element(fixture).querySelector<HTMLInputElement>('input[value="free"]')!;
    expect(free.checked).toBe(true);
    const warm = vi.spyOn(TestBed.inject(HatcheryStore), 'warm');
    start(fixture);
    expect(TestBed.inject(ProgressService).progress().explored).toContain('numbers');
    expect(element(fixture).querySelector('.banner h2')!.textContent).toContain('Verse 1');
    let answers = 0;
    while (internals(fixture).play()!.phase !== 'done') {
      const value = untilAsked(fixture);
      press(fixture, value);
      answers++;
      wait(fixture, 600);
      if (internals(fixture).play()!.phase === 'done') break;
      // Run on through the next title or the band's hops.
      if (internals(fixture).ask() === null) {
        for (let step = 0; step < 100; step++) {
          if (internals(fixture).ask() !== null || internals(fixture).play()!.phase === 'done')
            break;
          wait(fixture, 50);
        }
      }
    }
    wait(fixture, 2500);
    const outcome = element(fixture).querySelector('app-drum-outcome')!;
    expect(outcome.querySelector('h2')!.textContent).toContain(en.perfect);
    expect(outcome.querySelectorAll('.star.earned').length).toBe(3);
    expect(warm).toHaveBeenCalledTimes(answers);
    const progress = TestBed.inject(ProgressService).progress();
    expect(progress.stars?.['drums-4']).toBe(3);
    expect(progress.mastered).toContain('drums-4');
    expect(TestBed.inject(DrumScores).best()['drums-4']).toBeGreaterThan(0);
    expect(TestBed.inject(DrumScores).gallery()['drums-4'].step).toBe(10);
  });

  it('skips the title and demo, shows the run so far, and answers with number keys', () => {
    const fixture = setup('drums-1');
    start(fixture);
    element(fixture).querySelector<HTMLButtonElement>('.skip')!.click();
    fixture.detectChanges();
    expect(internals(fixture).ask()).toBe(3);
    const sequence = [...element(fixture).querySelectorAll('.sequence span')].map((span) =>
      span.textContent!.trim(),
    );
    expect(sequence).toEqual(['0', '10', '20', '?']);
    expect(element(fixture).querySelector('.step-name')!.textContent).toContain(en.on10);
    expect(status(fixture)).toContain('20. What comes next?');
    // A newcomer's buttons hop together, so no single one is pointed at.
    expect(element(fixture).querySelector('.answers.is-guide')).not.toBeNull();
    const index = buttons(fixture).findIndex((b) => b.textContent!.includes('30'));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: String(index + 1) }));
    fixture.detectChanges();
    expect(status(fixture)).toContain('Yes, 30!');
  });

  it('helps after a miss without giving the answer away, and never blocks the song', () => {
    const fixture = setup('drums-4');
    start(fixture);
    element(fixture).querySelector<HTMLButtonElement>('.skip')!.click();
    fixture.detectChanges();
    const right = untilAsked(fixture);
    const wrong = buttons(fixture)
      .map((b) => Number(b.textContent!.replace(/^\d/, '').trim()))
      .filter((value) => value !== right);
    press(fixture, wrong[0]);
    expect(status(fixture)).toContain(`Not ${wrong[0]}.`);
    expect(element(fixture).querySelector('.step-hint')!.textContent).toContain('+10');
    expect(element(fixture).querySelector('.rule-card')).toBeNull();
    press(fixture, wrong[1]);
    const card = element(fixture).querySelector('.rule-card')!.textContent!;
    expect(card).toContain('tens');
    expect(card).not.toContain(String(right));
    // Tapped wrong buttons grey out; from the third miss one more greys out each time.
    press(fixture, wrong[2]);
    const out = buttons(fixture).filter((b) => b.classList.contains('out'));
    expect(out.length).toBe(3);
    expect(buttons(fixture).length - out.length).toBeGreaterThanOrEqual(1);
    press(fixture, right);
    expect(status(fixture)).toContain(`Yes, ${right}!`);
  });

  it('lets Pom wait for a late answer on a beat, and pauses with Space', () => {
    localStorage.setItem('feenland.drums-tempo.v1', 'quick');
    const fixture = setup('drums-2');
    start(fixture);
    expect(element(fixture).querySelector('.beat-dots')!.classList.contains('off')).toBe(false);
    untilAsked(fixture);
    wait(fixture, 2600);
    expect(internals(fixture).play()!.waiting).toBe(true);
    expect(status(fixture)).toContain(en.late);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    fixture.detectChanges();
    const dialog = element(fixture).querySelector<HTMLDialogElement>('.pause-dialog')!;
    expect(dialog.open).toBe(true);
    wait(fixture, 10_000);
    dialog.querySelector<HTMLButtonElement>('.primary')!.click();
    fixture.detectChanges();
    expect(dialog.open).toBe(false);
    const right = internals(fixture).play()!.mushrooms[internals(fixture).ask()!].value;
    press(fixture, right);
    expect(status(fixture)).toContain(`Yes, ${right}!`);
    expect(status(fixture)).not.toContain('On the beat');
  });

  it('writes German traps into the buttons', () => {
    localStorage.setItem('feenland.locale', 'de');
    const fixture = setup('drums-4');
    expect(element(fixture).querySelector('h1')!.textContent).toContain('Die Pilztrommeln');
    start(fixture);
    element(fixture).querySelector<HTMLButtonElement>('.skip')!.click();
    fixture.detectChanges();
    const play = internals(fixture).play()!;
    const right = play.mushrooms[internals(fixture).ask()!].value;
    const values = buttons(fixture).map((b) => Number(b.textContent!.replace(/^\d/, '').trim()));
    const swapped = (right % 10) * 10 + Math.floor(right / 10);
    if (right % 10 !== 0 && swapped !== right) expect(values).toContain(swapped);
  });
});
