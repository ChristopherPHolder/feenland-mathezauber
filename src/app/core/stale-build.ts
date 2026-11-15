import { DOCUMENT } from '@angular/common';
import { ErrorHandler, inject, Injectable } from '@angular/core';

/**
 * A tab that stays open across a deploy still runs the old build, and the old build's lazy chunks
 * are gone from the server: every missing file comes back as `index.html`, so the import fails.
 * The tap on "All games" (or any page) then commits the route but the page never appears, or,
 * for a lazy route, the tap does nothing at all. The fix is to load that page afresh, which
 * picks up the new build. A short guard per URL keeps a page that really cannot load (a broken
 * deploy) from reloading forever.
 */
const RELOAD_KEY = 'feenland.stale-build-reload';
const RELOAD_GUARD_MS = 30_000;
/** Angular's code for a `@defer` block whose dependencies failed to load. */
const DEFER_LOAD_FAILED = -750;

/** The messages browsers give a dynamic `import()` that could not fetch or run its module. */
const MISSING_MODULE =
  /dynamically imported module|Importing a module script failed|Failed to load module script|is not a valid JavaScript MIME type/i;

/** True for a failed lazy load: a `@defer` block's chunk or a lazy route's chunk. */
export function isMissingChunk(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if ((error as { code?: unknown }).code === DEFER_LOAD_FAILED) return true;
  return /NG0750/.test(error.message) || MISSING_MODULE.test(error.message);
}

/**
 * Loads `url` (default: the current page) straight from the server. Returns false, and leaves
 * the page alone, when offline, when storage is blocked, or when this tab already reloaded the
 * same URL a moment ago.
 */
export function reloadFresh(document: Document, now: number, url?: string): boolean {
  const view = document.defaultView;
  if (!view || view.navigator.onLine === false) return false;
  const target = new URL(url ?? view.location.href, view.location.href).href;
  try {
    const last = JSON.parse(view.sessionStorage.getItem(RELOAD_KEY) ?? 'null') as {
      url?: string;
      at?: number;
    } | null;
    if (last?.url === target && typeof last.at === 'number' && now - last.at < RELOAD_GUARD_MS)
      return false;
    view.sessionStorage.setItem(RELOAD_KEY, JSON.stringify({ url: target, at: now }));
  } catch {
    // Without storage there is no loop guard, so never reload automatically.
    return false;
  }
  // `assign` to the page's own URL only jumps to its anchor; a reload fetches it again.
  if (target === view.location.href) view.location.reload();
  else view.location.assign(target);
  return true;
}

/** Reloads the page when a `@defer` block's chunk is missing; every other error is logged as usual. */
@Injectable()
export class StaleBuildErrorHandler extends ErrorHandler {
  private readonly document = inject(DOCUMENT);
  override handleError(error: unknown) {
    if (isMissingChunk(error) && reloadFresh(this.document, Date.now())) return;
    super.handleError(error);
  }
}
