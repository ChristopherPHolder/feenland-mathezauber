import { ContentStatus } from '../../shared/content-status/content-status';
import { Component, computed, effect, inject, viewChild } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { WORLD_CATALOG, Chapter, chapterState, findLevel, worldState } from '../../core/catalog';
import { LocaleService } from '../../core/locale';
import { ProgressService } from '../../core/progress';
import { Icon } from '../../shared/icon';
import { ContentPreview } from '../../shared/content-preview/content-preview';
@Component({
  selector: 'app-world-detail',
  imports: [ContentStatus, RouterLink, Icon, NgOptimizedImage, ContentPreview],
  templateUrl: './world-detail.html',
  styleUrl: './world-detail.css',
})
export class WorldDetail {
  protected readonly i = inject(LocaleService);
  protected readonly p = inject(ProgressService);
  private readonly catalog = inject(WORLD_CATALOG);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap);
  protected readonly world = computed(() =>
    this.catalog.find((world) => world.id === this.params()?.get('id')),
  );
  protected readonly caughtUp = computed(() => {
    const world = this.world();
    return world ? worldState(world, this.p.progress()) === 'completed' : false;
  });
  protected readonly chapters = computed(
    () =>
      this.world()?.chapters.map((chapter) => ({
        chapter,
        state: chapterState(chapter, this.p.progress()),
        earned: this.p.progress().chapters.includes(chapter.id),
      })) ?? [],
  );
  private readonly dialog = viewChild.required(ContentPreview);
  constructor() {
    effect(() => {
      const world = this.world();
      if (world) this.p.explore(world.id);
    });
  }
  protected preview(chapter: Chapter) {
    const state = chapterState(chapter, this.p.progress());
    if (state !== 'locked') return;
    // One accessible entry level opens the chapter; independent branches are alternatives.
    const entry = chapter.levels[0];
    const requirements = [
      ...new Set(
        entry?.prerequisites.filter((id) => !this.p.progress().mastered.includes(id)) ?? [],
      ),
    ];
    this.dialog().open({
      title: chapter.title,
      description: chapter.description,
      requirements: requirements.map((id) => ({
        id,
        title: findLevel(this.catalog, id)?.level.title ?? 'unknownRequirement',
      })),
    });
  }
}
