import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StateWorld, ThreeStage, WorldLoader } from './three-stage';

const made: FakeWorld[] = [];
class FakeWorld implements StateWorld<number> {
  states: number[] = [];
  disposed = false;
  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly host: HTMLElement,
  ) {
    made.push(this);
  }
  setState(state: number) {
    this.states.push(state);
  }
  dispose() {
    this.disposed = true;
  }
}

@Component({
  imports: [ThreeStage],
  template: `<app-three-stage [world]="load" [state]="value()"
    ><p class="flat">2D scene</p></app-three-stage
  >`,
})
class Harness {
  readonly value = signal(1);
  readonly load: WorldLoader<number> = async () => FakeWorld;
}

describe('ThreeStage', () => {
  afterEach(() => {
    made.length = 0;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('keeps the 2D fallback where WebGL is missing', async () => {
    const fixture = TestBed.createComponent(Harness);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.flat')?.textContent).toBe('2D scene');
    expect(fixture.nativeElement.querySelector('canvas').getAttribute('aria-hidden')).toBe('true');
    expect(made).toHaveLength(0);
  });

  it('builds the world, feeds it state and disposes it', async () => {
    vi.stubGlobal('WebGL2RenderingContext', class {});
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as RenderingContext);
    const fixture = TestBed.createComponent(Harness);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(made).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('.flat')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-three-stage').classList).toContain('is-3d');
    fixture.componentInstance.value.set(2);
    fixture.detectChanges();
    expect(made[0]!.states).toEqual([1, 2]);
    fixture.destroy();
    expect(made[0]!.disposed).toBe(true);
  });
});
