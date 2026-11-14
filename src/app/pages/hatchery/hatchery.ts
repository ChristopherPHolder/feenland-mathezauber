import { Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LocaleService } from '../../core/locale';
import { Icon } from '../../shared/icon';
import { DragonPortraits } from './dragon-portraits';
import { DAY_DRAGONS, Dragon, STARLIGHT_DRAGONS, starlightAwake } from './dragons';
import { EggIcon } from './egg-icon';
import { HatcheryStore } from './hatchery-store';
import { HatcheryMessageKey, hatcheryText } from './hatchery-messages';
import type { NestFrame } from './hatchery-world';
import { NestScene } from './nest-scene';

/** Taps that crack a ready egg open. */
export const CRACK_TAPS = 3;

/**
 * The hatchery: the egg in its nest, warmed by every right answer in every game. A ready egg
 * cracks open after a few taps, and the dragon book keeps every dragon found.
 */
@Component({
  selector: 'app-hatchery',
  imports: [NgTemplateOutlet, RouterLink, Icon, EggIcon, NestScene],
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
  /** What the nest shows: the egg, a dragon that just hatched, or one picked from the book. */
  protected readonly view = signal<'egg' | 'reveal' | 'dragon'>('egg');
  protected readonly shown = signal<Dragon | null>(null);
  protected readonly isNew = signal(true);
  protected readonly cracks = signal(0);
  private readonly hatches = signal(0);
  protected readonly cheers = signal(0);
  protected readonly announcement = signal('');
  private readonly heading = viewChild<ElementRef<HTMLElement>>('dragonHeading');
  private readonly stage = viewChild<ElementRef<HTMLElement>>('stage');

  protected readonly awake = computed(() => starlightAwake(this.store.hatchery()));
  protected readonly found = computed(() => this.store.hatchery().hatched.length);
  protected readonly warmth = computed(() => this.store.hatchery().warmth / this.store.needed());
  protected readonly frame = computed<NestFrame>(() => ({
    view: this.view() === 'egg' ? 'egg' : 'dragon',
    egg: this.store.egg(),
    warmth: this.warmth(),
    ready: this.store.ready(),
    cracks: this.cracks(),
    dragon: this.shown(),
    hatches: this.hatches(),
  }));
  protected readonly tapHint = computed(() => {
    const left = CRACK_TAPS - this.cracks();
    return this.cracks() === 0
      ? this.t('tapEgg')
      : left === 1
        ? this.t('tapLast')
        : this.t('tapsLeft', { n: left });
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

  protected isFound(dragon: Dragon) {
    return this.store.hatchery().hatched.includes(dragon.id);
  }

  /** A tap on a ready egg cracks it; the last tap hatches it. */
  protected tap() {
    if (this.view() !== 'egg' || !this.store.ready()) return;
    const cracks = this.cracks() + 1;
    if (cracks < CRACK_TAPS) {
      this.cracks.set(cracks);
      return;
    }
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
    // Let the panel render the new dragon, then take focus to its name.
    setTimeout(() => this.heading()?.nativeElement.focus(), 0);
  }

  protected show(dragon: Dragon) {
    if (!this.isFound(dragon)) return;
    this.shown.set(dragon);
    this.view.set('dragon');
    this.cheers.update((count) => count + 1);
    // The nest may be scrolled away while picking from the book; bring it back into view.
    const stage = this.stage()?.nativeElement;
    const calm = stage?.ownerDocument.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)');
    stage?.scrollIntoView?.({ behavior: calm?.matches ? 'auto' : 'smooth', block: 'nearest' });
  }

  protected favorite(dragon: Dragon) {
    this.store.choose(dragon.id);
    this.cheers.update((count) => count + 1);
  }

  protected backToEgg() {
    this.view.set('egg');
    this.shown.set(null);
    this.cracks.set(0);
  }
}
