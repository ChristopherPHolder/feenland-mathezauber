import { DOCUMENT } from '@angular/common';
import { inject, Service, signal, computed } from '@angular/core';
import { TOTAL_WAVES, waveSize } from './waves';
export interface WaveResult {
  readonly wave: number;
  readonly independent: number;
}
export interface Campaign {
  readonly version: 1;
  readonly results: readonly WaveResult[];
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
  const results: WaveResult[] = [];
  // Accept only a contiguous, valid prefix. Corrupt or future saves never unlock unseen waves.
  for (const item of value.results as unknown[]) {
    if (
      !item ||
      typeof item !== 'object' ||
      !('wave' in item) ||
      item.wave !== results.length + 1 ||
      !('independent' in item) ||
      typeof item.independent !== 'number' ||
      !Number.isInteger(item.independent) ||
      item.independent < 0 ||
      item.independent > waveSize(results.length + 1) ||
      results.length >= TOTAL_WAVES
    )
      break;
    results.push({ wave: results.length + 1, independent: item.independent });
  }
  return { version: 1, results };
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
  readonly unlocked = computed(() => Math.min(TOTAL_WAVES, this.state().results.length + 1));
  readonly finished = computed(() => this.state().results.length === TOTAL_WAVES);
  readonly stars = computed(() => campaignStars(this.state()));
  complete(result: WaveResult) {
    if (
      !Number.isInteger(result.wave) ||
      result.wave < 1 ||
      result.wave > this.unlocked() ||
      !Number.isInteger(result.independent) ||
      result.independent < 0 ||
      result.independent > waveSize(result.wave)
    )
      return;
    this.state.update((state) => ({
      version: 1,
      results: [
        ...state.results.filter((entry) => entry.wave !== result.wave),
        {
          ...result,
          independent: Math.max(
            state.results[result.wave - 1]?.independent ?? 0,
            result.independent,
          ),
        },
      ].sort((a, b) => a.wave - b.wave),
    }));
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
