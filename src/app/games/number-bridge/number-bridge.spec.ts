import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NumberBridge } from './number-bridge';
import { FIRST_ROUND, bridgePlan } from './bridge-math';

describe('number bridge practice', () => {
  let fixture: ComponentFixture<NumberBridge>;
  let root: HTMLElement;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NumberBridge],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(NumberBridge);
    root = fixture.nativeElement;
    await fixture.whenStable();
    await click('Gemeinsam üben');
  });

  async function click(text: string) {
    const button = Array.from(root.querySelectorAll('button')).find((element) =>
      element.textContent?.includes(text),
    );
    expect(button, `button ${text}`).toBeTruthy();
    button!.click();
    await fixture.whenStable();
  }

  async function answer(value: string) {
    const input = root.querySelector<HTMLInputElement>('#answer')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
  }

  it('keeps wrong and empty answers on the current step, then teaches both hops before the missing number', async () => {
    await answer('');
    expect(root.querySelector('#feedback')?.textContent).toContain('ganze Zahl');
    await answer('9');
    expect(root.querySelector('label')?.textContent).toContain('7 bis 10');
    expect(root.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('0');
    await answer('3');
    expect(root.querySelector('label')?.textContent).toContain('10 bis 16');
    await answer('6');
    expect(root.querySelector('label')?.textContent).toContain('Lücke');
    await answer('9');
    expect(root.querySelector('.success-card')?.textContent).toContain('3 + 6 = 9');
    expect(root.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('1');
    expect(root.querySelector('form')).toBeNull();
  });

  it('completes a mixed session, offers help in independent practice, and restarts a fresh round', async () => {
    for (let i = 0; i < FIRST_ROUND.length; i++) {
      const plan = bridgePlan(FIRST_ROUND[i]);
      if (i < 4) for (const hop of plan.hops) await answer(String(hop));
      if (i === 4) {
        expect(root.querySelector('.coach')).toBeNull();
        await click('Zeig mir');
        for (const hop of plan.hops) await answer(String(hop));
      }
      await answer(String(plan.answer));
      expect(root.querySelector('.success-card')).toBeTruthy();
      await click(i === 7 ? 'Meine Entdeckungen' : 'Nächste Aufgabe');
    }
    expect(root.querySelector('h1')?.textContent).toContain('8 Aufgaben.');
    await click('Noch eine Runde');
    expect(root.querySelector('.session-bar')?.textContent).toContain('Aufgabe 1 von 8');
    expect(root.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('0');
  });
});
