import { ErrorHandler } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { isMissingChunk, reloadFresh, StaleBuildErrorHandler } from './stale-build';

function fakeDocument(href = 'https://feen.example/adventure/unicorn-race-1', onLine = true) {
  const store = new Map<string, string>();
  const location = { href, reload: vi.fn(), assign: vi.fn() };
  const document = {
    defaultView: {
      navigator: { onLine },
      location,
      sessionStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
      },
    },
  } as unknown as Document;
  return { document, location };
}

describe('Stale build recovery', () => {
  it('knows a missing chunk from any browser and from a failed @defer block', () => {
    const deferFailed = Object.assign(new Error('NG0750'), { code: -750 });
    expect(isMissingChunk(deferFailed)).toBe(true);
    expect(
      isMissingChunk(new Error('Loading dependencies for `@defer` block failed (NG0750)')),
    ).toBe(true);
    expect(
      isMissingChunk(new TypeError('Failed to fetch dynamically imported module: /chunk-A.js')),
    ).toBe(true);
    expect(isMissingChunk(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isMissingChunk(new TypeError('error loading dynamically imported module'))).toBe(true);
    expect(isMissingChunk(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isMissingChunk('NG0750')).toBe(false);
  });

  it('reloads the page once, then leaves it alone if the same page fails again at once', () => {
    const { document, location } = fakeDocument();
    expect(reloadFresh(document, 1_000)).toBe(true);
    expect(location.reload).toHaveBeenCalledTimes(1);
    expect(reloadFresh(document, 5_000)).toBe(false);
    expect(location.reload).toHaveBeenCalledTimes(1);
    // Later on (another deploy) it may recover again.
    expect(reloadFresh(document, 60_000)).toBe(true);
    expect(location.reload).toHaveBeenCalledTimes(2);
  });

  it('opens a lazy route the router could not load straight from the server', () => {
    const { document, location } = fakeDocument();
    expect(reloadFresh(document, 1_000, '/games#unicorn-race-1')).toBe(true);
    expect(location.assign).toHaveBeenCalledWith('https://feen.example/games#unicorn-race-1');
    expect(location.reload).not.toHaveBeenCalled();
  });

  it('never reloads offline', () => {
    const { document, location } = fakeDocument(undefined, false);
    expect(reloadFresh(document, 1_000)).toBe(false);
    expect(location.reload).not.toHaveBeenCalled();
  });

  it('reloads on a failed @defer load and logs every other error as before', () => {
    const { document, location } = fakeDocument();
    TestBed.configureTestingModule({
      providers: [
        { provide: ErrorHandler, useClass: StaleBuildErrorHandler },
        { provide: DOCUMENT, useValue: document },
      ],
    });
    const handler = TestBed.inject(ErrorHandler);
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    handler.handleError(Object.assign(new Error('NG0750'), { code: -750 }));
    expect(location.reload).toHaveBeenCalledTimes(1);
    expect(log).not.toHaveBeenCalled();
    handler.handleError(new Error('something else'));
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
