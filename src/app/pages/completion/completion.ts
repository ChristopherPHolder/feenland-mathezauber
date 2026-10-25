import { gameText, GameMessageKey } from '../fairy-defense/game-messages';
import { Component, computed, inject } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CompletionService } from '../../core/completion';
import { findLevel, levelState, nextLevel, WORLD_CATALOG } from '../../core/catalog';
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
      return following.find((level) => !this.p.progress().mastered.includes(level.id));
    }
    if (context?.level.format === 'crocodile' && result) {
      const progress = this.p.progress();
      const following = context.chapter.levels
        .slice(context.chapter.levels.indexOf(context.level) + 1)
        .find(
          (level) =>
            !progress.mastered.includes(level.id) && levelState(level, progress) === 'available',
        );
      if (following) return following;
    }
    return result ? nextLevel(this.catalog, this.p.progress()) : undefined;
  });
  protected readonly chapterEarned = computed(() => {
    const context = this.context();
    const result = this.result();
    return !!context && !!result && this.p.progress().chapters.includes(context.chapter.id);
  });
}
