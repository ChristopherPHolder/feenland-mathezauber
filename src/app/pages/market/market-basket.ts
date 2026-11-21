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
import { GOODS, GoodId } from './market-levels';
import { capitalise, marketText, MarketMessageKey } from './market-messages';
import { EURO, formatMoney } from './market-money';

type BasketStep = 'choose' | 'total' | 'left' | 'receipt';

@Component({
  selector: 'app-market-basket',
  templateUrl: './market-basket.html',
  styleUrl: './market-basket.css',
})
export class MarketBasket {
  readonly leave = output();
  private readonly locale = inject(LocaleService).locale;
  private readonly heading = viewChild.required<ElementRef<HTMLElement>>('heading');
  protected readonly budget = 50 * EURO;
  protected readonly goods = GOODS.map((good) => ({
    id: good.id,
    price: (good.id === 'apple' ? 2 : good.to) * EURO,
  }));
  protected readonly emoji = GOOD_EMOJI;
  protected readonly step = signal<BasketStep>('choose');
  protected readonly selected = signal<readonly GoodId[]>([]);
  protected readonly items = computed(() =>
    this.goods.filter((item) => this.selected().includes(item.id)),
  );
  protected readonly total = computed(() =>
    this.items().reduce((sum, item) => sum + item.price, 0),
  );
  protected readonly addition = computed(() =>
    this.items()
      .map((item) => this.money(item.price))
      .join(' + '),
  );
  protected readonly error = signal(false);

  constructor() {
    afterRenderEffect(() => {
      this.step();
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
  protected go(step: BasketStep) {
    this.error.set(false);
    this.step.set(step);
  }
  protected check(event: SubmitEvent, input: HTMLInputElement) {
    event.preventDefault();
    const expected = this.step() === 'total' ? this.total() : this.budget - this.total();
    if (!/^\d{1,2}$/.test(input.value) || Number(input.value) * EURO !== expected) {
      this.error.set(true);
      input.select();
      return;
    }
    input.value = '';
    this.go(this.step() === 'total' ? 'left' : 'receipt');
  }
}
