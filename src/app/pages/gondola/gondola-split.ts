import { Component, computed, ElementRef, input, model, output, viewChild } from '@angular/core';

/**
 * The waiting group as one row of bunnies with a split handle between them. The handle is a
 * native range input laid over the row, so it snaps between bunnies (never through one) while
 * dragged, jumps where the row is tapped, and keeps the platform's keyboard and screen reader
 * support. Single bunnies can't be picked up: the only move is the split, so counting one by
 * one gets the child nowhere.
 *
 * It emits `gesture` once per finished drag, tap or key step (the one-move bonus counts them)
 * and `confirm` for Enter on the handle.
 */
@Component({
  selector: 'app-gondola-split',
  template: `
    <div
      class="row"
      [class.is-down]="kind() === 'sub'"
      [style.--n]="group()"
      [style.--split]="split()"
    >
      <span class="first-band" aria-hidden="true"></span>
      <span class="tokens" aria-hidden="true">
        @for (slot of slots(); track slot) {
          <span class="token" [class.is-first]="slot < split()">
            <svg viewBox="0 0 40 56">
              <path class="ear" d="M11 22 8 3c0-3 6-3 7 0l3 18zM29 22l3-19c1-3 7-3 7 0l-4 19z" />
              <path
                class="ear-in"
                d="M12 19 10 5c0-1 3-1 3 0l2 14zM28 19l2-14c0-1 3-1 3 0l-2 14z"
              />
              <ellipse class="fur" cx="20" cy="43" rx="13" ry="12" />
              <circle class="fur" cx="20" cy="27" r="10" />
              <path class="scarf" [style.fill]="scarf(slot)" d="M11 34q9 5 18 0v4q-9 5-18 0z" />
              <circle class="eye" cx="16.5" cy="26" r="1.6" />
              <circle class="eye" cx="23.5" cy="26" r="1.6" />
              <path class="nose" d="M18.6 29.5h2.8L20 31.2z" />
              @if (slot === vip()) {
                <path class="crown" d="M11 15l3 4 3-6 3 6 3-6 3 6 3-4-1 7H12z" />
              }
            </svg>
          </span>
        }
      </span>
      <input
        #handle
        type="range"
        class="handle"
        min="0"
        step="1"
        [max]="group()"
        [value]="split()"
        [disabled]="disabled()"
        [attr.aria-label]="label()"
        [attr.aria-valuetext]="valueText()"
        (input)="slide($event)"
        (change)="gesture.emit()"
        (keydown.enter)="confirm.emit()"
      />
    </div>
  `,
  styleUrl: './gondola-split.css',
})
export class GondolaSplit {
  /** Bunnies in the group being split. */
  readonly group = input.required<number>();
  readonly kind = input<'add' | 'sub'>('add');
  /** How many go first: the handle stands after this many bunnies. */
  readonly split = model(0);
  /** Which bunny wears the VIP crown, or -1. */
  readonly vip = input(-1);
  readonly disabled = input(false);
  readonly label = input.required<string>();
  readonly valueText = input.required<string>();
  readonly gesture = output<void>();
  readonly confirm = output<void>();

  protected readonly slots = computed(() => Array.from({ length: this.group() }, (_, i) => i));
  private readonly handle = viewChild.required<ElementRef<HTMLInputElement>>('handle');

  private static readonly SCARVES = ['#e0457b', '#3d8fe0', '#3fa65a', '#e89a1c', '#8a5cc7'];
  protected scarf(slot: number) {
    return GondolaSplit.SCARVES[slot % GondolaSplit.SCARVES.length];
  }

  focus() {
    this.handle().nativeElement.focus({ preventScroll: true });
  }

  protected slide(event: Event) {
    this.split.set(Number((event.target as HTMLInputElement).value));
  }
}

/**
 * The split diagram (a Japanese "cherry"): the number on top, two leaves below with its parts.
 * Empty leaves show a question mark until the split is made.
 */
@Component({
  selector: 'app-gondola-cherry',
  template: `<svg viewBox="0 0 120 92" aria-hidden="true">
      <path class="stem" d="M60 34 30 62M60 34l30 28" />
      <circle class="whole" cx="60" cy="22" r="20" />
      <text x="60" y="23">{{ whole() }}</text>
      <circle class="leaf" [class.is-set]="first() !== null" cx="30" cy="70" r="19" />
      <text x="30" y="71">{{ first() ?? '?' }}</text>
      <circle class="leaf" [class.is-set]="first() !== null" cx="90" cy="70" r="19" />
      <text x="90" y="71">{{ first() === null ? '?' : whole() - first()! }}</text>
    </svg>
    <span class="sr-only">{{ label() }}</span>`,
  styles: `
    :host {
      display: block;
      width: 100%;
      max-width: 150px;
      position: relative;
    }
    svg {
      display: block;
      width: 100%;
      overflow: visible;
    }
    .stem {
      stroke: #6a8a4a;
      stroke-width: 4;
      stroke-linecap: round;
    }
    .whole {
      fill: var(--gold);
      stroke: var(--gold-deep);
      stroke-width: 3;
    }
    .leaf {
      fill: var(--paper);
      stroke: #9bb3cc;
      stroke-width: 3;
      stroke-dasharray: 6 5;
    }
    .leaf.is-set {
      fill: #ffe3ee;
      stroke: var(--pink);
      stroke-dasharray: none;
    }
    text {
      font: 600 22px var(--font-sans);
      fill: var(--ink);
      text-anchor: middle;
      dominant-baseline: middle;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  `,
})
export class GondolaCherry {
  readonly whole = input.required<number>();
  /** The first part, or null before the split. */
  readonly first = input<number | null>(null);
  readonly label = input('');
}
