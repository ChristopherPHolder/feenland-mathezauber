import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { practiceLevels } from '../../core/practice';
import { ProgressService } from '../../core/progress';
import { CampaignStore } from './campaign';
import { FairyDefenseComponent } from './fairy-defense.component';
import { GameAudio } from './game-audio';
import { practiceBattle, practiceSpells } from './practice-battle';
import { advance, cast, resolveSpell } from './battle';

describe('tower defense math progression', () => {
  it('resolves all stage equations and rejects wrong spells at each difficulty', () => {
    for (const level of practiceLevels)
      for (const difficulty of ['easy', 'medium', 'hard'] as const) {
        let state = practiceBattle(level.practice!, difficulty);
        for (let index = 0; index < 8; index++) {
          const question = state.wave.encounters[state.encounter].question!;
          const spells = practiceSpells(question.answer);
          expect(new Set(spells).size).toBe(5);
          expect(spells).toContain(question.answer);
          expect(spells.every((spell) => spell >= 0 && spell <= 30)).toBe(true);
          const wrong = spells.find((spell) => spell !== question.answer)!;
          expect(resolveSpell(cast(state, wrong)).phase).toBe('wrong');
          state = advance(resolveSpell(cast(state, question.answer)));
        }
        expect(state.phase).toBe('complete');
      }
  });
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function () {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function () {
      this.open = false;
    };
    vi.useFakeTimers();
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [FairyDefenseComponent],
      providers: [provideRouter([])],
    });
    TestBed.overrideComponent(FairyDefenseComponent, {
      set: {
        providers: [
          {
            provide: GameAudio,
            useValue: {
              start: vi.fn(),
              pause: vi.fn(),
              sync: vi.fn(),
              effect: vi.fn(),
              speak: vi.fn(),
              updateVoice: vi.fn(),
              canSpeak: () => false,
            },
          },
        ],
      },
    });
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });
  it('records a completed subtraction stage without changing the making-ten campaign', () => {
    localStorage.setItem(
      'feenland.practice-options',
      JSON.stringify({ difficulty: 'hard', pace: 'quick' }),
    );
    const fixture = TestBed.createComponent(FairyDefenseComponent);
    fixture.componentRef.setInput('practiceConfig', practiceLevels[7].practice);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Stage 8 / 9');
    expect(element.querySelector<HTMLInputElement>('input[value="hard"]')!.checked).toBe(true);
    element.querySelector<HTMLButtonElement>('.start-curtain button')!.click();
    fixture.detectChanges();
    for (let n = 0; n < 8; n++) {
      const equation = element.querySelector('.math-prompt')!.textContent!;
      const values = equation.match(/\d+/g)!.map(Number);
      const answer = values[0] + values[1];
      element
        .querySelector<HTMLButtonElement>(`button[aria-label="Cast spell ${answer}"]`)!
        .click();
      fixture.detectChanges();
      vi.advanceTimersByTime(2650);
      fixture.detectChanges();
    }
    expect(TestBed.inject(ProgressService).progress().mastered).toContain('practice-30-8');
    expect(TestBed.inject(CampaignStore).state().results).toEqual([]);
  });
});
