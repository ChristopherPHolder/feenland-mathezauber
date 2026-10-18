import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LocaleService } from '../../core/locale';
import { worlds, World } from '../../core/catalog';
import { Icon } from '../../shared/icon';
@Component({
  selector: 'app-worlds',
  imports: [RouterLink, Icon],
  template: `<section class="page">
    <h1>{{ i.t('worlds') }}</h1>
    <p class="lead">{{ i.t('mapIntro') }}</p>
    <div class="world-grid">
      @for (world of worlds; track world.id) {
        <article class="world">
          <app-icon [kind]="world.chapters.length ? 'book' : 'lock'" />
          <h2>{{ i.t(world.title) }}</h2>
          <p>{{ i.t('soon') }}</p>
          @if (world.chapters.length) {
            <a
              class="button secondary"
              [routerLink]="['/adventure', world.chapters[0].levels[0].id]"
              >{{ i.t('explore') }}<app-icon kind="arrow"
            /></a>
          } @else {
            <button class="button secondary" (click)="preview(world)">
              {{ i.t('soon') }}<app-icon kind="arrow" />
            </button>
          }
        </article>
      }
    </div>
    <dialog #dialog aria-labelledby="preview-title" (close)="restoreFocus()">
      <h2 id="preview-title">{{ selected() ? i.t(selected()!.title) : '' }}</h2>
      <p>{{ i.t('preview') }}</p>
      <button class="button primary" (click)="dialog.close()">{{ i.t('close') }}</button>
    </dialog>
  </section>`,
})
export class Worlds {
  protected readonly i = inject(LocaleService);
  protected readonly worlds = worlds;
  protected readonly selected = signal<World | null>(null);
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');
  private opener: HTMLElement | null = null;
  protected preview(world: World) {
    this.opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.selected.set(world);
    this.dialog()?.nativeElement.showModal();
  }
  protected restoreFocus() {
    this.opener?.focus();
  }
}
