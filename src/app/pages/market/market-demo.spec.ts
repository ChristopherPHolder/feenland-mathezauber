import { describe, expect, it } from 'vite-plus/test';
import { FILM_NUMBERS, filmClash, filmFor } from './market-demo';

describe('market demo film', () => {
  it('picks a film for every skill', () => {
    expect(filmFor('coinByCoin')).toBe('pay');
    expect(filmFor('spree')).toBe('enough');
    expect(filmFor('left')).toBe('left');
    expect(filmFor('list')).toBe('total');
  });

  it('switches to the other numbers when the turn on screen uses the usual ones', () => {
    expect(filmClash('pay', [500])).toBe(true);
    expect(filmClash('pay', [700])).toBe(false);
    expect(filmClash('total', [300, 400, 700])).toBe(true);
    // The other set never clashes with the usual one.
    expect(FILM_NUMBERS.pay[1].price).not.toBe(FILM_NUMBERS.pay[0].price);
    expect(FILM_NUMBERS.total[1].a + FILM_NUMBERS.total[1].b).toBe(7);
  });
});
