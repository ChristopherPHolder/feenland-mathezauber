import { Component, computed, inject } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CompletionService } from '../../core/completion';
import { findLevel, nextLevel, WORLD_CATALOG } from '../../core/catalog';
import { ProgressService } from '../../core/progress';
import { LocaleService } from '../../core/locale';
import { Icon } from '../../shared/icon';
@Component({
  selector: 'app-completion',
  imports: [RouterLink, Icon, NgOptimizedImage],
  templateUrl: './completion.html',
  styleUrl: './completion.css',
})
export class Completion {
  protected readonly i = inject(LocaleService);
  protected readonly result = inject(CompletionService).result;
  private readonly p = inject(ProgressService);
  private readonly catalog = inject(WORLD_CATALOG);
  protected readonly context = computed(() =>
    findLevel(this.catalog, this.result()?.levelId ?? null),
  );
  protected readonly next = computed(() => {
    const result = this.result();
    return result ? nextLevel(this.catalog, this.p.progressFor(result.source)) : undefined;
  });
  protected readonly chapterEarned = computed(() => {
    const context = this.context();
    const result = this.result();
    return (
      !!context &&
      !!result &&
      this.p.progressFor(result.source).chapters.includes(context.chapter.id)
    );
  });
}
