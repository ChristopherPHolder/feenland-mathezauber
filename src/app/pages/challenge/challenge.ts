import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LocaleService } from '../../core/locale';
import { ProgressService } from '../../core/progress';
import { WORLD_CATALOG, findLevel } from '../../core/catalog';
@Component({
  selector: 'app-challenge',
  imports: [RouterLink],
  template: `<section class="page narrow">
    <h1>{{ i.t('placeholder') }}</h1>
    <div class="panel">
      <h2>{{ i.t(context?.level?.title ?? 'level') }}</h2>
      <p class="lead">{{ i.t('placeholderText') }}</p>
      @if (context) {
        <a
          class="button primary"
          [routerLink]="['/worlds', context.world.id, 'chapters', context.chapter.id]"
          [fragment]="context.level.id"
          >{{ i.t('backChapter') }}</a
        >
      }
      <a class="button secondary" routerLink="/worlds">{{ i.t('worlds') }}</a>
    </div>
  </section>`,
})
export class Challenge {
  protected readonly i = inject(LocaleService);
  protected readonly context = findLevel(
    inject(WORLD_CATALOG),
    inject(ActivatedRoute).snapshot.paramMap.get('id'),
  );
  constructor() {
    const id = inject(ActivatedRoute).snapshot.paramMap.get('id');
    const world = inject(WORLD_CATALOG).find((world) =>
      world.chapters.some((chapter) => chapter.levels.some((level) => level.id === id)),
    );
    if (world) inject(ProgressService).explore(world.id);
  }
}
