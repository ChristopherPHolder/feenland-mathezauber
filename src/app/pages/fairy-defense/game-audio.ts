import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { Locale } from '../../core/messages';
import { PlaytestStore } from './playtest-store';
/** Component-scoped so leaving the game always releases audio and speech. */
@Injectable()
export class GameAudio {
  private readonly window = inject(DOCUMENT).defaultView;
  private readonly settings = inject(PlaytestStore);
  private context?: AudioContext;
  private musicTimer?: ReturnType<typeof setInterval>;
  private started = false;
  private paused = false;
  private disposed = false;
  private note = 0;
  private locale: Locale = 'en';
  readonly canSpeak = signal(false);
  private readonly voicesChanged = () => this.updateVoice(this.locale);
  constructor() {
    this.window?.speechSynthesis?.addEventListener('voiceschanged', this.voicesChanged);
    inject(DestroyRef).onDestroy(() => {
      this.disposed = true;
      this.stop();
      this.window?.speechSynthesis?.removeEventListener('voiceschanged', this.voicesChanged);
      void this.context?.close().catch(() => undefined);
    });
  }
  updateVoice(locale: Locale) {
    this.locale = locale;
    this.canSpeak.set(!!this.voice());
  }
  private voice() {
    return this.window?.speechSynthesis
      ?.getVoices()
      .find((voice) => voice.lang.toLowerCase().split('-')[0] === this.locale);
  }
  start() {
    this.started = true;
    this.paused = false;
    try {
      this.context ??= new AudioContext();
      void this.context
        .resume()
        .then(() => {
          if (!this.disposed && !this.paused) this.sync();
        })
        .catch(() => undefined);
    } catch {
      /* Text and visuals remain fully playable without Web Audio. */
    }
    this.sync();
  }
  sync() {
    if (!this.settings.audio().speech) this.window?.speechSynthesis?.cancel();
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = undefined;
    if (!this.started || this.paused || this.disposed || !this.settings.audio().music) return;
    const melody = [523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 783.99, 1046.5];
    this.musicTimer = setInterval(
      () => this.tone(melody[this.note++ % melody.length], 0.8, 0.018),
      950,
    );
  }
  speak(text: string, whilePaused = false) {
    const voice = this.voice();
    if (!this.started || (this.paused && !whilePaused) || !this.settings.audio().speech || !voice)
      return;
    const synth = this.window?.speechSynthesis;
    synth?.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = 0.88;
    utterance.onerror = (event) => {
      // Starting another line or pausing deliberately cancels the previous line.
      if (event.error !== 'interrupted' && event.error !== 'canceled') this.canSpeak.set(false);
    };
    synth?.speak(utterance);
  }
  effect(kind: 'cast' | 'correct' | 'wrong' | 'damage' | 'complete') {
    if (!this.started || this.paused || !this.settings.audio().effects) return;
    const notes = {
      cast: [660, 880],
      correct: [660, 880, 1100],
      wrong: [330, 294],
      damage: [262, 220],
      complete: [523, 659, 784, 1047],
    }[kind];
    notes.forEach((frequency, index) => this.tone(frequency, 0.28, 0.06, index * 0.12));
  }
  private tone(frequency: number, duration: number, volume: number, delay = 0) {
    const context = this.context;
    if (!context || context.state !== 'running') return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const time = context.currentTime + delay;
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(time);
    oscillator.stop(time + duration);
  }
  pause() {
    this.paused = true;
    this.stop();
    void this.context?.suspend().catch(() => undefined);
  }
  private stop() {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = undefined;
    this.window?.speechSynthesis?.cancel();
  }
}
