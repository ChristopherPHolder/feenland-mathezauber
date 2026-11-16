import { Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LocaleService } from '../../core/locale';
import { Icon } from '@feenland/ui';
import { DragonFace } from './dragon-face';
import { DragonPortraits } from './dragon-portraits';
import { DAY_DRAGONS, Dragon, GRAND, STAGES, STARLIGHT_DRAGONS, starlightAwake } from './dragons';
import { EggIcon } from './egg-icon';
import { HatcheryStore } from './hatchery-store';
import { HatcheryMessageKey, hatcheryText } from './hatchery-messages';
import type { NestFrame } from './hatchery-world';
import { ThreeStage, WorldLoader } from '../../shared/three/three-stage';

/** Taps that crack a ready egg open, or help a ready dragon evolve. */
export const CRACK_TAPS = 3;

/**
 * What the panel shows: the egg (or the dragon getting ready to evolve), a hatch, a dragon from
 * the book, or a dragon that has just evolved.
 */
type View = 'home' | 'reveal' | 'dragon' | 'grew';

/**
 * The hatchery: the egg in its nest, warmed by every right answer in every game. A ready egg
 * cracks open after a few taps, and the dragon book keeps every dragon found. Once the book is
 * complete, the same answers help one dragon at a time evolve, from its baby form into a young
 * form and then its final form, each with its own body and name.
 */
@Component({
  selector: 'app-hatchery',
  imports: [NgTemplateOutlet, RouterLink, Icon, EggIcon, DragonFace, ThreeStage],
  templateUrl: './hatchery.html',
  styleUrl: './hatchery.css',
})
export class Hatchery {
  protected readonly store = inject(HatcheryStore);
  protected readonly portraits = inject(DragonPortraits);
  private readonly i = inject(LocaleService);
  protected readonly dayDragons = DAY_DRAGONS;
  protected readonly starlightDragons = STARLIGHT_DRAGONS;
  protected readonly totalDragons = DAY_DRAGONS.length + STARLIGHT_DRAGONS.length;
  protected readonly crackTaps = CRACK_TAPS;
  protected readonly grand = GRAND;
  protected readonly stageDots = STAGES.map((_, index) => index);
  protected readonly view = signal<View>('home');
  protected readonly shown = signal<Dragon | null>(null);
  protected readonly isNew = signal(true);
  protected readonly cracks = signal(0);
  private readonly hatches = signal(0);
  private readonly growths = signal(0);
  /** The form the dragon in the 'grew' view has just reached, and its name before. */
  protected readonly grewTo = signal(0);
  private readonly grewFrom = signal('');
  protected readonly cheers = signal(0);
  protected readonly announcement = signal('');
  private readonly heading = viewChild<ElementRef<HTMLElement>>('dragonHeading');
  private readonly stage = viewChild<ElementRef<HTMLElement>>('stage');

  protected readonly awake = computed(() => starlightAwake(this.store.hatchery()));
  protected readonly found = computed(() => this.store.hatchery().hatched.length);
  /** How full the egg's warmth or the dragon's way to its next form is, from 0 to 1. */
  protected readonly fill = computed(() =>
    this.store.needed() ? this.store.progress() / this.store.needed() : 1,
  );
  /**
   * With the book complete, the nest holds the dragon evolving next (or the favourite once every
   * dragon is in its final form).
   */
  protected readonly homeDragon = computed(() =>
    this.store.growing() ? (this.store.raising() ?? this.store.favorite() ?? null) : null,
  );
  protected readonly frame = computed<NestFrame>(() => {
    const home = this.view() === 'home';
    const dragon = home ? this.homeDragon() : this.shown();
    return {
      view: dragon ? 'dragon' : 'egg',
      egg: this.store.egg(),
      warmth: home ? this.fill() : 0,
      ready: home && this.store.ready(),
      cracks: this.cracks(),
      dragon,
      stage: dragon ? this.store.stage(dragon) : 0,
      hatches: this.hatches(),
      growths: this.growths(),
      cheers: this.cheers(),
    };
  });
  /** Three.js only downloads when the hatchery opens. */
  protected readonly loadWorld: WorldLoader<NestFrame> = () =>
    import('./hatchery-world').then((m) => m.HatcheryWorld);
  protected readonly tapHint = computed(() => {
    const left = CRACK_TAPS - this.cracks();
    const dragon = this.homeDragon();
    if (this.cracks() === 0)
      return dragon ? this.t('tapDragon', { name: this.name(dragon) }) : this.t('tapEgg');
    return left === 1 ? this.t('tapLast') : this.t('tapsLeft', { n: left });
  });
  protected readonly tapLabel = computed(() => {
    const dragon = this.homeDragon();
    const n = CRACK_TAPS - this.cracks();
    return dragon
      ? this.t('growLabel', { name: this.name(dragon), n })
      : this.t('crackLabel', { n });
  });

  constructor() {
    this.portraits.load();
  }

  protected t(key: HatcheryMessageKey, values: Record<string, string | number> = {}) {
    return hatcheryText(this.i.locale(), key, values);
  }

  protected n(value: number) {
    return this.i.format(value);
  }

  protected name(dragon: Dragon) {
    return this.store.name(dragon);
  }

  protected meet(dragon: Dragon) {
    return this.t('meet', { name: this.name(dragon), element: this.t(dragon.element) });
  }

  protected stageName(dragon: Dragon) {
    return this.t(STAGES[this.store.stage(dragon)]);
  }

  protected isFound(dragon: Dragon) {
    return this.store.hatchery().hatched.includes(dragon.id);
  }

  /** A tap on a ready egg cracks it, or nudges a ready dragon; the last tap hatches or evolves it. */
  protected tap() {
    if (this.view() !== 'home' || !this.store.ready()) return;
    const cracks = this.cracks() + 1;
    if (cracks < CRACK_TAPS) {
      this.cracks.set(cracks);
      return;
    }
    if (this.store.growing()) this.evolve();
    else this.hatch();
  }

  private hatch() {
    const result = this.store.hatch();
    if (!result) return;
    this.cracks.set(0);
    this.isNew.set(result.isNew);
    this.shown.set(result.dragon);
    this.hatches.update((count) => count + 1);
    this.view.set('reveal');
    this.announcement.set(
      `${this.t(result.isNew ? 'newDragon' : 'oldFriend')} ${this.meet(result.dragon)}`,
    );
    this.focusHeading();
  }

  private evolve() {
    const before = this.store.raising();
    const from = before ? this.name(before) : '';
    const result = this.store.evolve();
    if (!result) return;
    this.grewFrom.set(from);
    this.cracks.set(0);
    this.shown.set(result.dragon);
    this.grewTo.set(result.stage);
    this.growths.update((count) => count + 1);
    this.view.set('grew');
    this.announcement.set(`${this.t('grewUp')} ${this.grewText()}`);
    this.focusHeading();
  }

  /** What the dragon evolved into, and who is next once it reaches its final form. */
  protected grewText() {
    const dragon = this.shown();
    if (!dragon) return '';
    const grew = this.t('evolved', { old: this.grewFrom(), name: this.name(dragon) });
    const next = this.store.raising();
    return this.grewTo() >= GRAND && next
      ? `${grew} ${this.t('nextRaise', { name: this.name(next) })}`
      : grew;
  }

  /** Let the panel render the dragon, then take focus to its name. */
  private focusHeading() {
    setTimeout(() => this.heading()?.nativeElement.focus(), 0);
  }

  protected show(dragon: Dragon) {
    if (!this.isFound(dragon)) return;
    this.shown.set(dragon);
    this.view.set('dragon');
    this.cracks.set(0);
    this.cheers.update((count) => count + 1);
    // The nest may be scrolled away while picking from the book; bring it back into view.
    const stage = this.stage()?.nativeElement;
    const calm = stage?.ownerDocument.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)');
    stage?.scrollIntoView?.({ behavior: calm?.matches ? 'auto' : 'smooth', block: 'nearest' });
  }

  protected favorite(dragon: Dragon) {
    this.store.choose(dragon.id);
    this.cheers.update((count) => count + 1);
    this.announcement.set(this.t('isFavorite', { name: this.name(dragon) }));
  }

  protected raise(dragon: Dragon) {
    this.store.raise(dragon.id);
    this.cheers.update((count) => count + 1);
    this.announcement.set(this.t('isRaising', { name: this.name(dragon) }));
  }

  protected backHome() {
    this.view.set('home');
    this.shown.set(null);
    this.cracks.set(0);
  }
}
