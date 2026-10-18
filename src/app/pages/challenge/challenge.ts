import { MathPractice } from './math-practice';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { LocaleService } from '../../core/locale';
import { ProgressService } from '../../core/progress';
import { CompletionService } from '../../core/completion';
import { WORLD_CATALOG, findLevel } from '../../core/catalog';
@Component({
  selector: 'app-challenge',
  imports: [RouterLink, MathPractice],
  template: `<section class="page narrow">
    <h1>{{ i.t(context()?.level?.practice ? 'practicePath' : 'placeholder') }}</h1>
    <div class="panel">
      <h2>{{ i.t(context()?.level?.title ?? 'level') }}</h2>
      @if (context()?.level?.practice; as config) {
        <app-math-practice [config]="config" (completed)="finishPractice()" />
      } @else {
        <p class="lead">{{ i.t('placeholderText') }}</p>
        <p class="demo-note">{{ i.t('demoHelp') }}</p>
        <button class="button primary" (click)="finishDemo()">{{ i.t('demoComplete') }}</button>
      }
      @if (failed()) {
        <p role="alert">{{ i.t('saveReceiptFailed') }}</p>
      }
      @if (context(); as context) {
        <a
          class="button secondary"
          [routerLink]="['/worlds', context.world.id, 'chapters', context.chapter.id]"
          [fragment]="context.level.id"
          >{{ i.t('backChapter') }}</a
        >
      }
      <a class="worlds-link" routerLink="/worlds">{{ i.t('worlds') }}</a>
    </div>
  </section>`,
  styles: `
    .button {
      margin: 20px 0;
      width: 100%;
    }
    .demo-note {
      padding: 16px;
      background: #edf7fb;
      border-radius: 12px;
    }
    .worlds-link {
      display: inline-flex;
      min-height: 44px;
      align-items: center;
    }
  `,
})
export class Challenge {
  protected readonly i = inject(LocaleService);
  private readonly catalog = inject(WORLD_CATALOG);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap);
  private readonly query = toSignal(inject(ActivatedRoute).queryParamMap);
  private readonly p = inject(ProgressService);
  private readonly completion = inject(CompletionService);
  private readonly router = inject(Router);
  protected readonly context = computed(() =>
    findLevel(this.catalog, this.params()?.get('id') ?? null),
  );
  protected readonly failed = signal(false);
  constructor() {
    effect(() => {
      const context = this.context();
      if (context && this.query()?.get('mode') !== 'demo') this.p.explore(context.world.id);
    });
  }
  protected finishPractice() {
    const context = this.context();
    if (!context?.level.practice) return;
    if (
      this.completion.finish({
        levelId: context.level.id,
        source: 'practice',
        completed: true,
        mastered: true,
      })
    ) {
      void this.router.navigate(['/complete', context.level.id]);
    } else this.failed.set(true);
  }
  protected finishDemo() {
    const context = this.context();
    if (!context) return;
    if (
      this.completion.finish({
        levelId: context.level.id,
        source: 'demo',
        completed: true,
        mastered: true,
      })
    ) {
      void this.router.navigate(['/complete', context.level.id]);
    } else this.failed.set(true);
  }
}
