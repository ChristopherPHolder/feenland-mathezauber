import { ContentStatus } from '../../shared/content-status/content-status';
import { Component, computed, inject, viewChild } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { findChapter, findLevel, Level, levelState, WORLD_CATALOG } from '../../core/catalog';
import { LocaleService } from '../../core/locale';
import { ProgressService } from '../../core/progress';
import { ContentPreview } from '../../shared/content-preview/content-preview';
import { Icon } from '../../shared/icon';
@Component({
  selector: 'app-chapter-detail',
  imports: [ContentStatus, RouterLink, Icon, NgOptimizedImage, ContentPreview],
  templateUrl: './chapter-detail.html',
  styleUrl: './chapter-detail.css',
})
export class ChapterDetail {
  protected readonly i = inject(LocaleService);
  protected readonly p = inject(ProgressService);
  private readonly catalog = inject(WORLD_CATALOG);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap);
  protected readonly context = computed(() =>
    findChapter(
      this.catalog,
      this.params()?.get('worldId') ?? null,
      this.params()?.get('chapterId') ?? null,
    ),
  );
  protected readonly levels = computed(
    () =>
      this.context()?.chapter.levels.map((level) => ({
        level,
        state: levelState(level, this.p.progress()),
      })) ?? [],
  );
  protected readonly next = computed(
    () =>
      (
        this.levels().find((entry) => entry.state === 'available') ??
        this.levels().find(
          (entry) =>
            entry.state === 'completed' && !this.p.progress().mastered.includes(entry.level.id),
        )
      )?.level.id,
  );
  protected readonly caughtUp = computed(
    () => !this.next() && this.levels().some((entry) => entry.state === 'completed'),
  );
  private readonly dialog = viewChild.required(ContentPreview);
  protected preview(level: Level) {
    const state = levelState(level, this.p.progress());
    if (state !== 'locked') return;
    this.dialog().open({
      title: level.title,
      description: level.description,
      requirements: level.prerequisites
        .filter((id) => !this.p.progress().mastered.includes(id))
        .map((id) => ({
          id,
          title: findLevel(this.catalog, id)?.level.title ?? 'unknownRequirement',
        })),
    });
  }
}
