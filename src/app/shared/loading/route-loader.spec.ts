import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LocaleService } from '../../core/locale';
import { translations } from '../../core/messages';
import { StateWorld, WorldLoader } from '../three/three-stage';
import { ANNOUNCE_DELAY, RouteLoader } from './route-loader';

const made: FakeScene[] = [];
class FakeScene implements StateWorld<null> {
  states: null[] = [];
  disposed = false;
  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly host: HTMLElement,
  ) {
    made.push(this);
  }
  setState(state: null) {
    this.states.push(state);
  }
  dispose() {
    this.disposed = true;
  }
}

@Component({
  imports: [RouteLoader],
  template: `<app-route-loader [tone]="tone()" [scene]="scene()" />`,
})
class Harness {
  readonly tone = signal('castle');
  readonly scene = signal<WorldLoader<null> | undefined>(undefined);
}

async function mount(scene?: WorldLoader<null>) {
  const fixture = TestBed.createComponent(Harness);
  fixture.componentInstance.scene.set(scene);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return {
    fixture,
    loader: fixture.nativeElement.querySelector('app-route-loader') as HTMLElement,
  };
}

describe('RouteLoader', () => {
  beforeEach(() => localStorage.setItem('feenland.locale', 'en'));
  afterEach(() => {
    made.length = 0;
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('tells screen readers once, in the child’s language, that the page is loading', async () => {
    const fixture = TestBed.createComponent(Harness);
    fixture.detectChanges();
    await fixture.whenStable();
    const status = () => fixture.nativeElement.querySelectorAll('[role="status"]');
    expect(status()).toHaveLength(1);
    // The pill shows at once but is hidden from screen readers; the status fills a moment later.
    const pill = fixture.nativeElement.querySelector('.label');
    expect(pill.getAttribute('aria-hidden')).toBe('true');
    expect(pill.textContent.trim()).toBe(translations.en.loading);
    expect(status()[0].textContent.trim()).toBe('');
    await new Promise((resolve) => setTimeout(resolve, ANNOUNCE_DELAY + 20));
    fixture.detectChanges();
    expect(status()[0].textContent.trim()).toBe(translations.en.loading);
    TestBed.inject(LocaleService).select('fr');
    fixture.detectChanges();
    expect(status()[0].textContent.trim()).toBe(translations.fr.loading);
  });

  it('paints only the CSS star in the game’s colours when there is no scene', async () => {
    const { fixture, loader } = await mount();
    expect(loader.dataset['tone']).toBe('castle');
    expect(loader.querySelector('canvas')).toBeNull();
    expect(loader.querySelector('.art')?.getAttribute('aria-hidden')).toBe('true');
    fixture.componentInstance.tone.set('pond');
    fixture.detectChanges();
    expect(loader.dataset['tone']).toBe('pond');
  });

  it('keeps the CSS star where WebGL is missing, without loading the scene', async () => {
    const load = vi.fn(async () => FakeScene);
    const { loader } = await mount(load);
    expect(loader.querySelector('canvas')?.getAttribute('aria-hidden')).toBe('true');
    expect(load).not.toHaveBeenCalled();
    expect(loader.classList).not.toContain('is-3d');
  });

  it('fades a working scene in, gives it one state and disposes it', async () => {
    vi.stubGlobal('WebGL2RenderingContext', class {});
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as RenderingContext);
    const { fixture, loader } = await mount(async () => FakeScene);
    expect(made).toHaveLength(1);
    expect(made[0]!.canvas).toBe(loader.querySelector('canvas'));
    expect(made[0]!.host).toBe(loader);
    expect(made[0]!.states).toEqual([null]);
    expect(loader.classList).toContain('is-3d');
    fixture.destroy();
    expect(made[0]!.disposed).toBe(true);
  });

  it('stays on the CSS star when the scene fails to load', async () => {
    vi.stubGlobal('WebGL2RenderingContext', class {});
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as RenderingContext);
    const { loader } = await mount(() => Promise.reject(new Error('offline')));
    expect(loader.classList).not.toContain('is-3d');
    expect(loader.querySelector('.art')).toBeTruthy();
  });
});
