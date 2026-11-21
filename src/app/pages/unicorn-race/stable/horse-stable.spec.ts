import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vite-plus/test';
import { LocaleService } from '../../../core/locale';
import { RaceSounds } from '../race-sounds';
import { RaceStore } from '../race-store';
import { UnicornRace } from '../unicorn-race';

describe('the Stable', () => {
  const sounds = { play: vi.fn(), toggle: vi.fn(), unlock: vi.fn(), enabled: true };
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [UnicornRace],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ id: 'unicorn-race-1' })) },
        },
      ],
    });
    TestBed.overrideComponent(UnicornRace, {
      set: { providers: [{ provide: RaceSounds, useValue: sounds }] },
    });
  });
  afterEach(() => TestBed.resetTestingModule());

  function setup(locale: 'en' | 'de' = 'en') {
    const fixture = TestBed.createComponent(UnicornRace);
    TestBed.inject(LocaleService).select(locale);
    fixture.detectChanges();
    TestBed.tick();
    const element = fixture.nativeElement as HTMLElement;
    const store = TestBed.inject(RaceStore);
    const find = <T extends HTMLElement>(selector: string) => {
      const found = element.querySelector<T>(selector);
      expect(found, selector).toBeTruthy();
      return found!;
    };
    const tab = (name: string) => {
      const button = [...element.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(
        (candidate) => candidate.textContent?.includes(name),
      );
      expect(button, name).toBeTruthy();
      button!.click();
      fixture.detectChanges();
    };
    const choose = (group: string, index: number) => {
      const radio = element.querySelectorAll<HTMLInputElement>(`input[name="horse-${group}"]`)[
        index
      ];
      radio.click();
      fixture.detectChanges();
    };
    const press = (selector: string) => {
      find<HTMLButtonElement>(selector).click();
      fixture.detectChanges();
    };
    return { fixture, element, store, find, tab, choose, press };
  }

  it('opens by itself on the first visit, with Lumi ready, and only that once', () => {
    const { element, store, find, press } = setup();
    expect(find('app-horse-stable')).toBeTruthy();
    expect(element.querySelector('.intro')).toBeNull();
    expect(document.activeElement?.id).toBe('stable-title');
    expect(find('.tag').textContent).toContain('Lumi');
    expect(find<HTMLInputElement>('#horse-name').placeholder).toBe('Lumi');
    press('.done');
    expect(element.querySelector('app-horse-stable')).toBeNull();
    expect(find('.intro')).toBeTruthy();
    expect(store.save().stableSeen).toBe(true);
    expect(JSON.parse(localStorage.getItem('feenland.unicorn-race.v1')!).stableSeen).toBe(true);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [UnicornRace],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ id: 'unicorn-race-1' })) },
        },
      ],
    });
    const again = TestBed.createComponent(UnicornRace);
    again.detectChanges();
    expect((again.nativeElement as HTMLElement).querySelector('.intro')).toBeTruthy();
  });

  it('changes and saves each part the moment it is tapped', () => {
    const { store, tab, choose, find, element } = setup();
    tab('Horn & wings');
    const kinds = [...element.querySelectorAll('.kind-name')].map((name) => name.textContent);
    expect(kinds).toEqual(['Unicorn', 'Pegasus', 'Winged unicorn', 'Pony']);
    choose('kind', 2);
    expect(store.save().horse.kind).toBe('alicorn');
    expect(find('.flat app-racer .wing')).toBeTruthy();
    expect(find('.flat app-racer .horn')).toBeTruthy();
    tab('Coat');
    expect(element.querySelectorAll('input[name="horse-coat"]')).toHaveLength(10);
    expect(find('.swatch:has(:checked)').textContent).toContain('Snow white');
    choose('coat', 9);
    expect(store.save().horse.coat).toBe('midnight');
    expect(find('.swatch:has(:checked)').textContent).toContain('Midnight');
    expect(find<HTMLElement>('.flat app-racer').style.getPropertyValue('--coat')).toBe('#48437a');
    tab('Mane');
    choose('mane', 2);
    expect(store.save().horse.mane).toBe('ocean');
    expect(JSON.parse(localStorage.getItem('feenland.unicorn-race.v1')!).horse).toEqual({
      name: '',
      kind: 'alicorn',
      coat: 'midnight',
      mane: 'ocean',
      marking: 'none',
      horn: 'gold',
    });
  });

  it('adds markings and a horn colour, and keeps the horn row in place for a pony', () => {
    const { store, tab, choose, find, element } = setup();
    tab('Markings');
    const names = [...element.querySelectorAll('.kind-name')].map((name) => name.textContent);
    expect(names).toEqual(['None', 'Star', 'Blaze', 'Socks', 'Spots']);
    choose('marking', 2);
    expect(store.save().horse.marking).toBe('blaze');
    expect(find('.flat app-racer .blaze')).toBeTruthy();
    choose('marking', 3);
    const flat = find<HTMLElement>('.flat app-racer');
    expect(flat.style.getPropertyValue('--sock-near')).toMatch(/^url\(#racer-sock-\d+-near\)$/);
    expect(flat.querySelector('linearGradient')).toBeTruthy();
    tab('Horn & wings');
    expect(find('.horns-title').textContent).toContain('Horn colour');
    choose('horn', 3);
    expect(store.save().horse.horn).toBe('crystal');
    expect(flat.style.getPropertyValue('--horn')).toBe('#c4f4ff');
    choose('kind', 3);
    expect(find('.horns').classList).toContain('is-hidden');
    expect(element.querySelector<HTMLInputElement>('input[name="horse-horn"]')!.disabled).toBe(
      true,
    );
    // The horn colour is kept for when the horn comes back.
    expect(store.save().horse.horn).toBe('crystal');
  });

  it('dresses the horse in earned keepsakes and shows how to earn the rest', () => {
    const { store, tab, find, fixture, element } = setup();
    store.recordRace(1, 1, 'gold', 10, 50000);
    store.recordRace(2, 1, 'gold', 10, 50000);
    store.recordRace(3, 1, 'gold', 10, 50000);
    tab('Dress up');
    const dresses = [...element.querySelectorAll('.dress')];
    expect(dresses).toHaveLength(6);
    expect(dresses[0].textContent).toContain('Just Lumi');
    expect(element.querySelectorAll('.dress.locked')).toHaveLength(4);
    expect(find('.dress.locked').textContent).toContain('Cloud wings: finish the Sky Cup');
    expect(find<HTMLInputElement>('.dress.locked input').disabled).toBe(true);
    element.querySelectorAll<HTMLInputElement>('input[name="horse-outfit"]')[1].click();
    fixture.detectChanges();
    expect(store.save().outfit).toBe('wreath');
    expect(find('.flat app-racer .wreath')).toBeTruthy();
  });

  it('names the horse by typing or with one tap on an idea', () => {
    const { store, find, fixture, press, element } = setup();
    const field = find<HTMLInputElement>('#horse-name');
    expect(element.querySelector('label[for="horse-name"]')?.textContent).toContain(
      'What is your horse called?',
    );
    field.value = 'Star ';
    field.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    // The space being typed stays in the field; the save keeps the tidy name.
    expect(field.value).toBe('Star ');
    expect(store.save().horse.name).toBe('Star');
    field.value = 'Star Dust';
    field.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(find('.tag').textContent).toContain('Star Dust');
    const ideas = () =>
      [...element.querySelectorAll('.idea:not(.more)')].map((idea) => idea.textContent?.trim());
    expect(ideas()).toEqual(['Star', 'Daisy', 'Comet', 'Bella', 'Sunny']);
    press('.idea.more');
    expect(ideas()).toEqual(['Pebbles', 'Twinkle', 'Maple', 'Rosie', 'Blaze']);
    press('.idea:not(.more)');
    expect(store.save().horse.name).toBe('Pebbles');
    expect(field.value).toBe('Pebbles');
    expect(find('.idea[aria-pressed="true"]').textContent).toContain('Pebbles');
    // Clearing the name brings Lumi back.
    field.value = '';
    field.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(find('.tag').textContent).toContain('Lumi');
  });

  it('surprises with a new look but keeps the name', () => {
    const { store, press } = setup();
    store.setHorse({ ...store.save().horse, name: 'Pip' });
    const before = store.save().horse;
    press('.surprise');
    const after = store.save().horse;
    expect(after.name).toBe('Pip');
    expect(
      after.kind !== before.kind || after.coat !== before.coat || after.mane !== before.mane,
    ).toBe(true);
  });

  it('moves between tabs with the arrow keys', () => {
    const { element, fixture, find } = setup();
    const tabs = () => [...element.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    expect(find('[role="tabpanel"]').getAttribute('aria-labelledby')).toBe('stable-tab-name');
    tabs()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    fixture.detectChanges();
    expect(tabs()[5].getAttribute('aria-selected')).toBe('true');
    expect(tabs()[5].tabIndex).toBe(0);
    expect(tabs()[0].tabIndex).toBe(-1);
    expect(document.activeElement).toBe(tabs()[5]);
    expect(find('[role="tabpanel"]').getAttribute('aria-labelledby')).toBe('stable-tab-dress');
    tabs()[5].dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    fixture.detectChanges();
    expect(tabs()[0].getAttribute('aria-selected')).toBe('true');
  });

  it('opens from the horse in the lineup and hands focus back to it on Done', async () => {
    const { store, element, fixture, press, find } = setup('de');
    press('.done');
    store.setHorse({ ...store.save().horse, name: 'Keks' });
    fixture.detectChanges();
    const edit = find<HTMLButtonElement>('.lineup button.is-lumi');
    expect(edit.getAttribute('aria-label')).toBe('Keks ändern');
    edit.click();
    fixture.detectChanges();
    expect(find('app-horse-stable')).toBeTruthy();
    expect(find('.tab[aria-selected="true"]').textContent).toContain('Name');
    expect(find('.done').textContent).toContain('Fertig');
    press('.done');
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(document.activeElement).toBe(element.querySelector('.lineup button.is-lumi'));
  });
});
