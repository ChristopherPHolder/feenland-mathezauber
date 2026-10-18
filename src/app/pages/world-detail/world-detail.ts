import { Component, computed, effect, inject } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { WORLD_CATALOG, levelState, worldState } from '../../core/catalog';
import { LocaleService } from '../../core/locale';
import { ProgressService } from '../../core/progress';
import { Icon } from '../../shared/icon';

/** Map destination; the complete chapter path is tracked separately in issue #5. */
@Component({
  selector: 'app-world-detail',
  imports: [RouterLink, Icon, NgOptimizedImage],
  template: `<section class="page narrow">
    <a class="back-link" routerLink="/worlds"><app-icon kind="back" />{{ i.t('backWorlds') }}</a>
    @if (world(); as world) {
      <h1>{{ i.t(world.title) }}</h1>
      <img ngSrc="/images/feenland.webp" width="1536" height="1024" alt="" />
      <p class="lead">{{ i.t(world.description) }}</p>
      @if (caughtUp()) {
        <p>{{ i.t('worldCaught') }}</p>
      }
      <p>{{ i.t('worldDetailNotice') }}</p>
      @if (next(); as level) {
        <p>{{ i.t('previewNotice') }}</p>
        <a class="button primary" [routerLink]="['/adventure', level.id]"
          >{{ i.t('previewAdventure') }}<app-icon kind="arrow"
        /></a>
      }
    }
  </section>`,
  styles: `
    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      min-height: 44px;
      margin-bottom: 24px;
    }
    img {
      width: 100%;
      height: auto;
      border-radius: 16px;
    }
    .button {
      margin-top: 24px;
    }
  `,
})
export class WorldDetail {
  protected readonly i = inject(LocaleService);
  private readonly p = inject(ProgressService);
  private readonly catalog = inject(WORLD_CATALOG);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap);
  protected readonly world = computed(() =>
    this.catalog.find((world) => world.id === this.params()?.get('id')),
  );
  protected readonly caughtUp = computed(() => {
    const world = this.world();
    return world ? worldState(world, this.p.progress()) === 'completed' : false;
  });
  protected readonly next = computed(() => {
    const levels = this.world()?.chapters.flatMap((chapter) => chapter.levels) ?? [];
    return (
      levels.find((level) => levelState(level, this.p.progress()) === 'available') ??
      levels.find((level) => levelState(level, this.p.progress()) === 'completed')
    );
  });
  constructor() {
    effect(() => {
      const world = this.world();
      if (world) this.p.explore(world.id);
    });
  }
}
