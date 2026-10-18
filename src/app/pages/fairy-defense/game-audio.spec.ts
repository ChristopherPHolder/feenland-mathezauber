import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { GameAudio } from './game-audio';
import { PlaytestStore } from './playtest-store';
class Utterance {
  constructor(readonly text: string) {}
  voice: unknown;
  lang = '';
  rate = 1;
  onerror?: (event: { error: string }) => void;
}
describe('optional fairy speech', () => {
  const speak = vi.fn();
  const cancel = vi.fn();
  const addEventListener = vi.fn();
  const removeEventListener = vi.fn();
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('SpeechSynthesisUtterance', Utterance);
    vi.stubGlobal('speechSynthesis', {
      speak,
      cancel,
      addEventListener,
      removeEventListener,
      getVoices: () => [{ lang: 'en-GB' }, { lang: 'de-AT' }, { lang: 'es-ES' }, { lang: 'fr-FR' }],
    });
    TestBed.configureTestingModule({ providers: [GameAudio] });
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });
  it('waits for Play and uses only a matching game-language voice', () => {
    TestBed.inject(PlaytestStore).toggle('speech');
    const audio = TestBed.inject(GameAudio);
    for (const [locale, lang] of [
      ['en', 'en-GB'],
      ['de', 'de-AT'],
      ['es', 'es-ES'],
      ['fr', 'fr-FR'],
    ] as const) {
      audio.updateVoice(locale);
      expect(audio.canSpeak()).toBe(true);
      if (locale === 'en') {
        audio.speak('Before Play');
        expect(speak).not.toHaveBeenCalled();
        audio.start();
      }
      audio.speak('Matching visible text');
      expect(speak.mock.lastCall?.[0]).toMatchObject({ lang, text: 'Matching visible text' });
    }
  });
  it('defaults speech off after Play and releases speech listeners on route exit', () => {
    const audio = TestBed.inject(GameAudio);
    audio.updateVoice('en');
    audio.start();
    expect(TestBed.inject(PlaytestStore).audio().speech).toBe(false);
    audio.sync();
    audio.speak('Quiet');
    expect(speak).not.toHaveBeenCalled();
    TestBed.resetTestingModule();
    expect(cancel).toHaveBeenCalled();
    expect(removeEventListener).toHaveBeenCalledWith('voiceschanged', expect.any(Function));
  });
  it('allows explicitly requested voice replay while the battle remains paused', () => {
    TestBed.inject(PlaytestStore).toggle('speech');
    const audio = TestBed.inject(GameAudio);
    audio.updateVoice('en');
    audio.start();
    audio.pause();
    audio.speak('Automatic feedback');
    expect(speak).not.toHaveBeenCalled();
    audio.speak('Requested explanation', true);
    expect(speak.mock.lastCall?.[0]).toMatchObject({ text: 'Requested explanation' });
  });
  it('keeps text-only play possible with no suitable voice and after a speech failure', () => {
    TestBed.inject(PlaytestStore).toggle('speech');
    const audio = TestBed.inject(GameAudio);
    audio.updateVoice('en');
    audio.start();
    audio.speak('Hello');
    speak.mock.lastCall?.[0].onerror({ error: 'interrupted' });
    expect(audio.canSpeak()).toBe(true);
    speak.mock.lastCall?.[0].onerror({ error: 'synthesis-failed' });
    expect(audio.canSpeak()).toBe(false);
    vi.stubGlobal('speechSynthesis', { getVoices: () => [], cancel, removeEventListener });
    audio.updateVoice('fr');
    expect(audio.canSpeak()).toBe(false);
    const count = speak.mock.calls.length;
    audio.speak('Bonjour');
    expect(speak).toHaveBeenCalledTimes(count);
  });
});
