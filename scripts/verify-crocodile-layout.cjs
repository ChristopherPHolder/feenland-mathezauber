const { chromium, webkit } = require('playwright');
const assert = require('node:assert/strict');

// Run against npm start, with Playwright available as for the other verify scripts.
// Geometry catches shifts following input too (CLS excludes recent user input).
const baseUrl = process.env.CROCODILE_BASE_URL || 'http://127.0.0.1:4200';
const selectors = ['.hud', '.snack-bar', '.board', '.sides', '.instruction', '.choices'];
async function geometry(page) {
  return page.evaluate(
    (selectors) =>
      Object.fromEntries(
        selectors.map((selector) => {
          const rect = document.querySelector(selector).getBoundingClientRect();
          return [selector, { x: rect.x, y: rect.y, width: rect.width, height: rect.height }];
        }),
      ),
    selectors,
  );
}
function stable(before, after, context) {
  for (const selector of selectors) {
    for (const axis of ['x', 'y', 'width', 'height']) {
      assert.ok(
        Math.abs(before[selector][axis] - after[selector][axis]) <= 1,
        `${context}: ${selector} ${axis} moved from ${before[selector][axis]} to ${after[selector][axis]}`,
      );
    }
  }
}
(async () => {
  for (const engine of [chromium, webkit]) {
    const browser = await engine.launch(engine === chromium ? { channel: 'chrome' } : {});
    try {
      for (const [width, height] of [
        [768, 1024],
        [1024, 768],
        [820, 1180],
        [1180, 820],
      ]) {
        for (const locale of ['en', 'de', 'es', 'fr']) {
          const page = await browser.newPage({ viewport: { width, height }, hasTouch: true });
          try {
            await page.addInitScript((locale) => {
              localStorage.setItem('feenland.crocodile-coached.v1', '1');
              localStorage.setItem('feenland.locale', locale);
              Math.random = () => 0.42;
            }, locale);
            await page.goto(baseUrl + '/adventure/crocodile-1');
            await page.locator('[data-pace="off"]').click();
            await page.locator('.intro .primary').click();
            await page.evaluate(() => document.fonts.ready);
            await page.waitForTimeout(500);
            await page.clock.install();
            const before = await geometry(page);
            const context = `${engine.name()} ${width}×${height} ${locale}`;
            // A wrong answer adds the illustrated hint; correcting it removes the hint.
            const values = await page.locator('.side-text').allTextContents();
            const correct = +values[0] > +values[1] ? 0 : +values[0] === +values[1] ? 1 : 2;
            await page
              .locator('.choice')
              .nth((correct + 1) % 3)
              .tap();
            await page.clock.fastForward(400);
            stable(before, await geometry(page), context + ' wrong answer');
            assert.equal(await page.locator('app-rule-hint').count(), 1);
            for (let snack = 0; snack < 15; snack++) {
              const values = await page.locator('.side-text').allTextContents();
              const side =
                +values[0] > +values[1] ? 'left' : +values[0] === +values[1] ? null : 'right';
              if (side) await page.locator(`[data-side="${side}"]`).tap();
              else await page.locator('.choice').nth(1).tap();
              await page.clock.fastForward(100);
              assert.equal(
                await page.locator('.board.chomping').count(),
                1,
                context + ` snack ${snack}: ${await page.locator('.instruction').innerText()}`,
              );
              stable(before, await geometry(page), context + ` snack ${snack} feedback`);
              await page.clock.fastForward(1400);
              if (snack < 14) {
                await page.locator('.choice[aria-disabled="false"]').first().waitFor();
                stable(before, await geometry(page), context + ` snack ${snack} advance`);
              }
            }
            await page.locator('.outcome').waitFor({ timeout: 3000 });
            console.log(`Stable: ${context}, wrong answer and all 15 snacks`);
          } finally {
            await page.close();
          }
        }
      }
    } finally {
      await browser.close();
    }
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
