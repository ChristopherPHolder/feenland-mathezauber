import { Component, inject, input } from '@angular/core';
import { LocaleService } from '../../core/locale';
import { CrocodileArt } from './crocodile-art';
import { crocodileText, CrocodileMessageKey } from './crocodile-messages';
import { comparisonStage } from './comparison';
import { Hat, hats } from './crocodile-score';
/** Kiki’s hat collection: one hat per level, earned with two stars. */
@Component({
  selector: 'app-hat-wardrobe',
  imports: [CrocodileArt],
  template: `<section class="wardrobe" aria-labelledby="hats-title">
    <h3 id="hats-title">{{ t('hats') }}</h3>
    <ul class="hat-list">
      @for (entry of hats; track entry.id) {
        <li class="hat-slot" [class.owned]="owns(entry)" [class.new]="fresh()?.id === entry.id">
          <span class="hat-art">
            <app-crocodile kind="hat" [hat]="entry.id" />
            @if (!owns(entry)) {
              <span class="hat-level">{{ t('hatLevel', { n: position(entry.stage) }) }}</span>
            }
          </span>
          <span class="hat-name" aria-hidden="true">{{ t(entry.name) }}</span>
          <span class="sr-only">{{ label(entry) }}</span>
        </li>
      }
    </ul>
    <p class="hats-help">{{ t('hatsHelp') }}</p>
  </section>`,
  styles: `
    .wardrobe {
      margin-top: 28px;
      padding-top: 20px;
      border-top: 2px dashed #cfe1d4;
      text-align: center;
    }
    h3 {
      font-size: 20px;
      margin: 0 0 12px;
    }
    .hat-list {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 8px;
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .hat-slot {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 8px 4px;
      border-radius: 14px;
      background: #fff;
    }
    .hat-art {
      position: relative;
      display: block;
      width: 56px;
    }
    /* A hat still to win is a soft silhouette with the level that wins it, not a padlock. */
    .hat-slot:not(.owned) {
      background: #f4f1e8;
    }
    .hat-slot:not(.owned) app-crocodile {
      filter: brightness(0);
      opacity: 0.16;
    }
    .owned {
      box-shadow: inset 0 0 0 2px #f2d27a;
    }
    .hat-level {
      position: absolute;
      left: 50%;
      bottom: -4px;
      translate: -50% 0;
      padding: 1px 6px;
      border-radius: 999px;
      background: #fff;
      color: var(--muted);
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;
    }
    .hat-slot.new {
      background: #ffe3ee;
      box-shadow: 0 0 0 3px #e0457b;
    }
    .hat-name {
      font-size: 12px;
      line-height: 1.2;
      color: var(--muted);
    }
    .owned .hat-name {
      color: var(--ink);
    }
    .hats-help {
      font-size: 14px;
      color: var(--muted);
      margin: 12px auto 0;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
      border: 0;
    }
    @media (max-width: 640px) {
      .hat-list {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }
    }
    /* A phone on its side: the seven hats in one row, names left out (each has a label). */
    @media (orientation: landscape) and (max-height: 500px) {
      .wardrobe {
        margin-top: 6px;
        padding-top: 4px;
      }
      h3 {
        font-size: 15px;
        margin-bottom: 4px;
      }
      .hat-list {
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: 4px;
      }
      .hat-slot {
        padding: 6px 2px;
      }
      .hat-art {
        width: 34px;
      }
      .hat-name,
      .hats-help {
        display: none;
      }
    }
  `,
})
export class HatWardrobe {
  readonly owned = input.required<readonly Hat[]>();
  readonly fresh = input<Hat | null>(null);
  protected readonly hats = hats;
  private readonly i = inject(LocaleService);
  protected t(key: CrocodileMessageKey, values: Record<string, string | number> = {}) {
    return crocodileText(this.i.locale(), key, values);
  }
  protected owns(hat: Hat) {
    return this.owned().includes(hat);
  }
  /** Hats belong to level ids; the child sees the level's place in the list. */
  protected position(stage: number) {
    return comparisonStage(`crocodile-${stage}`)?.position ?? stage;
  }
  protected label(hat: Hat) {
    return this.t(this.owns(hat) ? 'hatOwned' : 'hatLocked', {
      hat: this.t(hat.name),
      n: this.position(hat.stage),
    });
  }
}
