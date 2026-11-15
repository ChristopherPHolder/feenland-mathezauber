import { DOCUMENT } from '@angular/common';
import { inject, Service, signal, computed } from '@angular/core';
import { TOTAL_WAVES, waveSize } from './waves';
export type WaveStars = 1 | 2 | 3;
export interface WaveResult {
  readonly wave: number;
  readonly independent: number;
  /** Best stars for the wave; saves from before wave stars have none. */
  readonly stars?: WaveStars;
}
/**
 * Stars for one finished wave, from the gems in the pouch: every rescue drops one gem and a first
 * try one more, so the gems over the creature count are the first tries. All first tries earn
 * three stars, at least half two, and finishing always earns one.
 */
export function waveStars(creatures: number, gems: number): WaveStars {
  const firstTries = gems - creatures;
  return firstTries >= creatures ? 3 : firstTries * 2 >= creatures ? 2 : 1;
}
export interface Campaign {
  readonly version: 1;
  readonly results: readonly WaveResult[];
}
function isValidResult(item: unknown): item is WaveResult {
  return (
    !!item &&
    typeof item === 'object' &&
    'wave' in item &&
    typeof item.wave === 'number' &&
    Number.isInteger(item.wave) &&
    item.wave >= 1 &&
    item.wave <= TOTAL_WAVES &&
    'independent' in item &&
    typeof item.independent === 'number' &&
    Number.isInteger(item.independent) &&
    item.independent >= 0 &&
    item.independent <= waveSize(item.wave) &&
    (!('stars' in item) ||
      item.stars === undefined ||
      item.stars === 1 ||
      item.stars === 2 ||
      item.stars === 3)
  );
}
export function parseCampaign(value: unknown): Campaign {
  const empty: Campaign = { version: 1, results: [] };
  if (
    !value ||
    typeof value !== 'object' ||
    !('version' in value) ||
    value.version !== 1 ||
    !('results' in value) ||
    !Array.isArray(value.results)
  )
    return empty;
  // Every wave is playable in any order, so keep each valid result once and drop the rest.
  const results = new Map<number, WaveResult>();
  for (const item of value.results as unknown[])
    if (isValidResult(item) && !results.has(item.wave))
      results.set(
        item.wave,
        item.stars
          ? { wave: item.wave, independent: item.independent, stars: item.stars }
          : { wave: item.wave, independent: item.independent },
      );
  return { version: 1, results: [...results.values()].sort((a, b) => a.wave - b.wave) };
}
export function campaignStars(campaign: Campaign): number {
  if (campaign.results.length < TOTAL_WAVES) return 0;
  const assessed = campaign.results.filter((result) => result.wave > 4);
  const total = assessed.reduce((sum, result) => sum + waveSize(result.wave), 0);
  const independent = assessed.reduce((sum, result) => sum + result.independent, 0);
  return independent === total ? 3 : independent / total >= 2 / 3 ? 2 : 1;
}
@Service()
export class CampaignStore {
  private readonly document = inject(DOCUMENT);
  readonly saveFailed = signal(false);
  readonly state = signal<Campaign>(this.restore());
  /** Wave numbers with a saved result, in ascending order. */
  readonly completed = computed(() => this.state().results.map((result) => result.wave));
  /** The first wave without a saved result; wave 1 once everything is done. */
  readonly nextWave = computed(() => {
    const done = new Set(this.completed());
    for (let wave = 1; wave <= TOTAL_WAVES; wave++) if (!done.has(wave)) return wave;
    return 1;
  });
  readonly finished = computed(() => this.state().results.length === TOTAL_WAVES);
  readonly stars = computed(() => campaignStars(this.state()));
  /** Best stars per wave number, for the wave path. */
  readonly waveStars = computed(
    () => new Map(this.state().results.map((result) => [result.wave, result.stars ?? 0])),
  );
  /** Every wave star earned so far, out of sixty. */
  readonly starTotal = computed(() =>
    this.state().results.reduce((sum, result) => sum + (result.stars ?? 0), 0),
  );
  complete(result: WaveResult) {
    if (!isValidResult(result)) return;
    this.state.update((state) => {
      const before = state.results.find((entry) => entry.wave === result.wave);
      const stars = Math.max(before?.stars ?? 0, result.stars ?? 0);
      return {
        version: 1,
        results: [
          ...state.results.filter((entry) => entry.wave !== result.wave),
          {
            wave: result.wave,
            independent: Math.max(before?.independent ?? 0, result.independent),
            ...(stars ? { stars: stars as WaveStars } : {}),
          },
        ].sort((a, b) => a.wave - b.wave),
      };
    });
    try {
      this.document.defaultView?.localStorage.setItem(
        'feenland.castle-campaign.v1',
        JSON.stringify(this.state()),
      );
      this.saveFailed.set(false);
    } catch {
      this.saveFailed.set(true);
    }
  }
  private restore(): Campaign {
    try {
      return parseCampaign(
        JSON.parse(
          this.document.defaultView?.localStorage.getItem('feenland.castle-campaign.v1') ?? 'null',
        ),
      );
    } catch {
      return { version: 1, results: [] };
    }
  }
}
