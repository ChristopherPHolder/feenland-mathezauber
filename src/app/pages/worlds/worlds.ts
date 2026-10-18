import { ContentStatus } from '../../shared/content-status/content-status';
import { DOCUMENT, NgOptimizedImage } from '@angular/common';
import { Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LocaleService } from '../../core/locale';
import { WORLD_CATALOG, World, worldRequirements, worldState } from '../../core/catalog';
import { ProgressService } from '../../core/progress';
import { Icon } from '../../shared/icon';
@Component({
  selector: 'app-worlds',
  imports: [ContentStatus, RouterLink, Icon, NgOptimizedImage],
  templateUrl: './worlds.html',
  styleUrl: './worlds.css',
})
export class Worlds {
  protected readonly i = inject(LocaleService);
  private readonly p = inject(ProgressService);
  private readonly document = inject(DOCUMENT);
  private readonly catalog = inject(WORLD_CATALOG);
  protected readonly destinations = computed(() =>
    this.catalog.map((world) => ({
      world,
      state: worldState(world, this.p.progress()),
    })),
  );
  protected readonly selected = signal<World | null>(null);
  protected readonly selectedState = computed(() => {
    const world = this.selected();
    return world ? worldState(world, this.p.progress()) : 'soon';
  });
  protected readonly requirements = computed(() => {
    const world = this.selected();
    const levels = this.catalog.flatMap((w) => w.chapters).flatMap((c) => c.levels);
    return world
      ? worldRequirements(world, this.p.progress()).map(({ level, prerequisites }) => ({
          level,
          prerequisites: prerequisites.map((id) => ({
            id,
            title: levels.find((item) => item.id === id)?.title ?? ('unknownRequirement' as const),
          })),
        }))
      : [];
  });
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');
  private opener: HTMLElement | null = null;
  protected preview(world: World) {
    const active = this.document.activeElement;
    this.opener = active instanceof HTMLElement ? active : null;
    this.selected.set(world);
    this.dialog()?.nativeElement.showModal();
  }
  protected restoreFocus() {
    this.opener?.focus();
  }
}
