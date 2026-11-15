import { supportsWebGL } from './three-stage';

/**
 * Downloads Three.js once the first page has settled, whichever page the child opened first.
 * Every game's loading scene and world need it, and it is far bigger than any game's own code:
 * fetched only on the tap, it lost the race and the game replaced the loader before its 3D
 * scene could appear. Skipped where WebGL is missing (nothing would draw) and when the device
 * asks to save data.
 */
export function warmThree(document: Document) {
  const view = document.defaultView;
  if (!view || !supportsWebGL(document)) return;
  const connection = (view.navigator as Navigator & { connection?: { saveData?: boolean } })
    .connection;
  if (connection?.saveData) return;
  // Stage pulls in exactly the parts of Three.js the worlds share; a bare `import('three')`
  // would keep the whole library in that chunk.
  const warm = () => void import('./stage').catch(() => undefined);
  if (typeof view.requestIdleCallback === 'function') view.requestIdleCallback(warm);
  else view.setTimeout(warm, 1500);
}
