import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Home } from './home';
import { orderFor, total } from './garden-math';

describe('unicorn garden game', () => {
  let fixture: ComponentFixture<Home>;
  let root: HTMLElement;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(Home);
    root = fixture.nativeElement;
    await fixture.whenStable();
  });
  async function click(text: string) {
    const button = Array.from(root.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === text,
    );
    expect(button, text).toBeTruthy();
    button!.click();
    await fixture.whenStable();
  }
  async function solve(answer: number) {
    await click(String(answer));
    root.querySelector<HTMLButtonElement>('.primary')!.click();
    await fixture.whenStable();
  }
  it('offers counting help after a wrong answer without awarding a sticker or advancing', async () => {
    expect(root.querySelector<HTMLButtonElement>('.primary')!.disabled).toBe(true);
    await solve(4);
    expect(root.querySelector('[role="status"]')?.textContent).toContain('try again');
    expect(root.querySelectorAll('.earned')).toHaveLength(0);
    expect(root.querySelectorAll('.berry-token small')).toHaveLength(5);
    expect(root.querySelector('.order-count')?.textContent).toContain('1 of 5');
    await solve(5);
    expect(root.querySelectorAll('.earned')).toHaveLength(1);
    expect(document.activeElement?.textContent).toContain('Next treat');
    root.querySelector<HTMLButtonElement>('.primary')!.click();
    await fixture.whenStable();
    expect(document.activeElement?.classList.contains('answer')).toBe(true);
  });
  it('completes five orders, awards five stickers, then restarts a different visit', async () => {
    for (let i = 0; i < 5; i++) {
      await solve(total(orderFor('little', i, 0)));
      root.querySelector<HTMLButtonElement>('.primary')!.click();
      await fixture.whenStable();
    }
    expect(root.querySelector('#order-title')?.textContent).toContain('You made Luna’s day!');
    expect(root.querySelectorAll('.earned')).toHaveLength(5);
    root.querySelector<HTMLButtonElement>('.primary')!.click();
    await fixture.whenStable();
    expect(root.querySelectorAll('.earned')).toHaveLength(0);
    expect(root.querySelector('.equation')?.textContent).toContain('4');
  });
  it('resets the visit when changing to numbers up to 20', async () => {
    await solve(5);
    const select = root.querySelector<HTMLSelectElement>('select')!;
    select.value = 'big';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(root.querySelectorAll('.earned')).toHaveLength(0);
    expect(root.querySelector('.equation')?.textContent).toContain('8');
    await solve(13);
    expect(root.querySelectorAll('.earned')).toHaveLength(1);
  });
});
