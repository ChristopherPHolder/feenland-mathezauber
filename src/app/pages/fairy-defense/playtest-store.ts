import { DOCUMENT } from '@angular/common';
import { inject, Service, signal } from '@angular/core';
export interface AudioSettings {
  readonly music: boolean;
  readonly effects: boolean;
  readonly speech: boolean;
}
const defaults: AudioSettings = { music: true, effects: true, speech: true };
/** Deliberately separate from earned Progress and completion receipts. */
@Service()
export class PlaytestStore {
  private readonly document = inject(DOCUMENT);
  readonly saveFailed = signal(false);
  readonly audio = signal<AudioSettings>(this.loadAudio());
  read(key: string): string | null {
    try {
      return this.document.defaultView?.localStorage.getItem('feenland.playtest.' + key) ?? null;
    } catch {
      this.saveFailed.set(true);
      return null;
    }
  }
  write(key: string, value: string) {
    try {
      this.document.defaultView?.localStorage.setItem('feenland.playtest.' + key, value);
    } catch {
      this.saveFailed.set(true);
    }
  }
  toggle(key: keyof AudioSettings) {
    this.audio.update((settings) => ({ ...settings, [key]: !settings[key] }));
    this.write('audio', JSON.stringify(this.audio()));
  }
  private loadAudio(): AudioSettings {
    try {
      const value: unknown = JSON.parse(
        this.document.defaultView?.localStorage.getItem('feenland.playtest.audio') ?? 'null',
      );
      if (!value || typeof value !== 'object') return defaults;
      return Object.fromEntries(
        Object.entries(defaults).map(([key, fallback]) => [
          key,
          key in value && typeof value[key as keyof typeof value] === 'boolean'
            ? value[key as keyof typeof value]
            : fallback,
        ]),
      ) as unknown as AudioSettings;
    } catch {
      return defaults;
    }
  }
}
