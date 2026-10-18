import { gameText, GameMessageKey } from '../fairy-defense/game-messages';
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
  protected readonly castle = computed(() => this.result()?.levelId === 'defend-fairy-castle');
  protected readonly starSlots = [1, 2, 3];
  protected g(key: GameMessageKey, values: Record<string, number> = {}) {
    return gameText(this.i.locale(), key, values);
  }
  protected readonly next = computed(() => {
    const result = this.result();
    const context = this.context();
    if (context?.level.practice && result) {
      const following = context.chapter.levels.filter(
        (level) => (level.practice?.stage ?? 0) > context.level.practice!.stage,
      );
      return following.find(
        (level) => !this.p.progressFor(result.source).mastered.includes(level.id),
      );
    }
    const catalog =
      result?.source === 'demo'
        ? this.catalog.map((world) => ({
            ...world,
            chapters: world.chapters.map((chapter) => ({
              ...chapter,
              levels: chapter.levels.filter((level) => level.format === 'challenge-preview'),
            })),
          }))
        : this.catalog;
    return result ? nextLevel(catalog, this.p.progressFor(result.source)) : undefined;
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
