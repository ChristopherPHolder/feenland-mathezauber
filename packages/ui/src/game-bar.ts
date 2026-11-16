import { Component, input } from '@angular/core';

/**
 * The bar above a game: a way out on the left, the game's title in the middle and its actions
 * on the right. It only lays them out; the caller projects the way out (`[uiGameBarBack]`) and
 * the actions (everything else).
 *
 * The way out should be a link or button styled with the `ui-pill` class, so it matches the
 * actions. Put its text in a `.ui-pill-label` span: on a phone the label is hidden visually
 * and the pill turns round, but screen readers still hear it.
 */
@Component({
  selector: 'ui-game-bar',
  template: `<ng-content select="[uiGameBarBack]" />
    <div class="titles">
      <h1 [id]="titleId()">{{ title() }}</h1>
      @if (detail()) {
        <p>{{ detail() }}</p>
      }
    </div>
    <div class="actions"><ng-content /></div>`,
  styles: `
    :host {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: 12px;
    }
    .titles {
      min-width: 0;
      text-align: center;
    }
    h1 {
      font-size: clamp(22px, 3vw, 30px);
      line-height: 1.15;
      margin: 0;
    }
    p {
      margin: 4px 0 0;
      color: var(--muted);
      font-size: 15px;
      line-height: 1.4;
    }
    .actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    @media (max-width: 540px) {
      h1 {
        font-size: 20px;
      }
      p {
        font-size: 13px;
      }
    }
  `,
})
export class GameBar {
  readonly title = input.required<string>();
  readonly detail = input('');
  /** The id the surrounding game section labels itself by. */
  readonly titleId = input('game-title');
}
