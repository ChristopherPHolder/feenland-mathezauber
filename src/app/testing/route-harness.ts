import { RouterTestingHarness } from '@angular/router/testing';

/**
 * Every route is a shell whose page loads in a `@defer` block. `whenStable` does not wait for
 * that download (nor for the loader's minimum time), so specs open routes through these
 * helpers, which wait for the page itself.
 */
export async function openRoute(url: string): Promise<RouterTestingHarness> {
  const harness = await RouterTestingHarness.create(url);
  await settle(harness);
  return harness;
}

/** Navigates the harness and waits for the new page to load. */
export async function navigate(harness: RouterTestingHarness, url: string) {
  const result = await harness.navigateByUrl(url);
  await settle(harness);
  return result;
}

/**
 * Waits until no route shell shows its placeholder or loader any more: the page has downloaded
 * and the loader's minimum time has passed.
 */
export async function settle(harness: RouterTestingHarness) {
  const deadline = Date.now() + 5000;
  await harness.fixture.whenStable();
  while (harness.fixture.nativeElement.querySelector('app-route-blank, app-route-loader')) {
    if (Date.now() > deadline) throw new Error('The deferred page did not load in time.');
    await new Promise((resolve) => setTimeout(resolve, 20));
    await harness.fixture.whenStable();
  }
}
