import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-number-hops',
  templateUrl: './number-hops.html',
  styleUrl: './number-hops.css',
  host: { role: 'img', '[attr.aria-label]': 'description()' },
})
export class NumberHops {
  readonly points = input.required<readonly number[]>();
  readonly hops = input.required<readonly number[]>();
  readonly revealed = input(0);
  readonly active = input(-1);
  readonly hideEnd = input(false);
  protected readonly description = computed(() => {
    const legs = this.hops().map((hop, index) => {
      const target =
        this.hideEnd() && index === this.hops().length - 1
          ? 'zur gesuchten Zahl'
          : this.points()[index + 1];
      return `plus ${index < this.revealed() ? hop : 'wie viel'} bis ${target}`;
    });
    return `Start bei ${this.points()[0]}, ${legs.join(', ')}.`;
  });
}
