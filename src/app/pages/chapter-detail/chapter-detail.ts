import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { findChapter, WORLD_CATALOG } from '../../core/catalog';
import { LocaleService } from '../../core/locale';
@Component({
  selector: 'app-chapter-detail',
  imports: [RouterLink],
  template: `<section class="page narrow">
    @if (context(); as context) {
      <a
        class="button secondary"
        [routerLink]="['/worlds', context.world.id]"
        [fragment]="context.chapter.id"
        >{{ i.t('backWorld') }}</a
      >
      <h1>{{ i.t(context.chapter.title ?? 'chapterTitle') }}</h1>
      <p>{{ i.t(context.chapter.description ?? 'missingPreview') }}</p>
      <p>{{ i.t('chapterPreview') }}</p>
      @if (context.chapter.levels[0]; as level) {
        <a class="button primary" [routerLink]="['/adventure', level.id]">{{
          i.t('previewAdventure')
        }}</a>
      }
    }
  </section>`,
})
export class ChapterDetail {
  protected readonly i = inject(LocaleService);
  private readonly catalog = inject(WORLD_CATALOG);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap);
  protected readonly context = computed(() =>
    findChapter(
      this.catalog,
      this.params()?.get('worldId') ?? null,
      this.params()?.get('chapterId') ?? null,
    ),
  );
}
