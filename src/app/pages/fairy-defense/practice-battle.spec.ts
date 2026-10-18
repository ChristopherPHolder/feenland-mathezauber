import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { practiceLevels } from '../../core/practice';
import { ProgressService } from '../../core/progress';
import { CampaignStore } from './campaign';
import { FairyDefenseComponent } from './fairy-defense.component';
import { GameAudio } from './game-audio';
import { practiceBattle, practiceSpells, withCampaignMath } from './practice-battle';
import { advance, cast, resolveSpell, freshBattle } from './battle';

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
  it('keeps all twenty campaign waves playable with harder maths and larger answers', () => {
    for (const max of [30, 100] as const)
      for (const difficulty of ['easy', 'medium', 'hard'] as const)
        for (let wave = 1; wave <= 20; wave++) {
          const original = freshBattle(wave);
          let state = withCampaignMath(original, max, difficulty);
          expect(state.wave.boss).toBe(original.wave.boss);
          expect(state.wave.encounters.length).toBe(original.wave.encounters.length);
          expect(state.wave.encounters[0].question!.text).toContain('+');
          expect(state.wave.encounters[1].question!.text).toContain('−');
          const crossing = state.wave.encounters[0].question!;
          const operands = crossing.text
            .replace('□', String(crossing.answer))
            .match(/\d+/g)!
            .map(Number);
          expect((operands[0] % 10) + (operands[1] % 10)).toBeGreaterThanOrEqual(10);
          for (const encounter of state.wave.encounters) {
            const question = encounter.question!;
            expect(question.answer).toBeLessThanOrEqual(max);
            expect(practiceSpells(question.answer)).toContain(question.answer);
            state = advance(resolveSpell(cast(state, question.answer)));
          }
          expect(state.phase).toBe('complete');
        }
    for (let answer = 31; answer <= 100; answer++) {
      expect(practiceSpells(answer)).toContain(answer);
      expect(new Set(practiceSpells(answer)).size).toBe(5);
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
  it('remembers campaign complexity and accepts keyboard answers for mixed sums', () => {
    const fixture = TestBed.createComponent(FairyDefenseComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const select = element.querySelector<HTMLSelectElement>('#campaign-math')!;
    expect(select.value).toBe('30');
    select.value = '100';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(localStorage.getItem('feenland.campaign-math')).toBe('100');
    element.querySelector<HTMLButtonElement>('.start-curtain button')!.click();
    fixture.detectChanges();
    expect(element.querySelector('.ten-frame')).toBeNull();
    const equation = element.querySelector('.math-prompt')!.textContent!;
    expect(equation).toContain('□');
    const values = equation.match(/\d+/g)!.map(Number);
    const answer =
      equation.includes('−') && equation.trim().startsWith('□')
        ? values[0] + values[1]
        : Math.abs(values[0] - values[1]);
    const spells = [...element.querySelectorAll<HTMLButtonElement>('.spell')];
    const position = spells.findIndex(
      (button) => button.getAttribute('aria-label') === `Cast spell ${answer}`,
    );
    expect(position).toBeGreaterThanOrEqual(0);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: String(position + 1) }));
    fixture.detectChanges();
    vi.advanceTimersByTime(550);
    fixture.detectChanges();
    expect(element.querySelector('.monster-position.transforming')).not.toBeNull();
    fixture.destroy();
    const restored = TestBed.createComponent(FairyDefenseComponent);
    restored.detectChanges();
    expect(
      (restored.nativeElement as HTMLElement).querySelector<HTMLSelectElement>('#campaign-math')!
        .value,
    ).toBe('100');
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
