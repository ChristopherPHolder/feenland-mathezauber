import {
  afterRenderEffect,
  Component,
  computed,
  ElementRef,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { LocaleService } from '../../core/locale';
import { GOOD_EMOJI } from './market-frame';
import { GOODS, GoodId, Item } from './market-levels';
import { capitalise, marketText, MarketMessageKey } from './market-messages';
import { EURO, formatMoney, total, Denomination } from './market-money';

export const SHOPPING_PURSE: readonly Denomination[] = [2000, 1000, 1000, 500, 200, 100, 100, 100];

@Component({
  selector: 'app-market-basket',
  templateUrl: './market-basket.html',
  styleUrl: './market-basket.css',
})
export class MarketBasket {
  readonly checkout = output<readonly Item[]>();
  readonly leave = output();
  private readonly locale = inject(LocaleService).locale;
  private readonly heading = viewChild.required<ElementRef<HTMLElement>>('heading');
  protected readonly budget = total(SHOPPING_PURSE);
  protected readonly goods: readonly Item[] = GOODS.map((good) => ({
    good: good.id,
    price: (good.id === 'apple' ? 2 : good.to) * EURO,
  }));
  protected readonly emoji = GOOD_EMOJI;
  protected readonly selected = signal<readonly GoodId[]>([]);
  readonly items = computed(() => this.goods.filter((item) => this.selected().includes(item.good)));
  protected readonly total = computed(() =>
    this.items().reduce((sum, item) => sum + item.price, 0),
  );
  constructor() {
    afterRenderEffect(() => {
      this.heading().nativeElement.focus();
    });
  }

  protected t(key: MarketMessageKey, values: Record<string, string> = {}) {
    return marketText(this.locale(), key, values);
  }
  protected name(id: GoodId) {
    return this.t(`name${capitalise(id) as Capitalize<GoodId>}`);
  }
  protected money(amount: number) {
    return formatMoney(amount, this.locale());
  }
  protected toggle(id: GoodId) {
    this.selected.update((ids) =>
      ids.includes(id) ? ids.filter((entry) => entry !== id) : [...ids, id],
    );
  }
}
