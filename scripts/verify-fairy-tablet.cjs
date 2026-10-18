const { chromium } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(
      (process.env.FAIRY_BASE_URL || 'http://127.0.0.1:4301') + '/adventure/defend-fairy-castle',
    );
    await fs.mkdir('.impeccable/review/tablet-fit', { recursive: true });
    const results = [];
    for (const wave of [1, 11, 20]) {
      await page.evaluate((n) => {
        localStorage.setItem('feenland.locale', 'en');
        localStorage.setItem(
          'feenland.castle-campaign.v1',
          JSON.stringify({
            version: 1,
            results: Array.from({ length: n - 1 }, (_, i) => ({ wave: i + 1, independent: 0 })),
          }),
        );
      }, wave);
      await page.reload();
      await page
        .getByRole('button', { name: wave === 1 ? 'Play' : 'Continue · Wave ' + wave, exact: true })
        .click();
      for (const [width, height] of [
        [768, 1024],
        [1024, 768],
        [820, 1180],
        [1180, 820],
        [600, 960],
        [960, 600],
        [1024, 600],
        [1024, 550],
      ]) {
        await page.setViewportSize({ width, height });
        if (wave >= 11 && !(await page.locator('.ten-frame').count())) {
          await page.getByRole('button', { name: 'Counting help', exact: true }).click();
        }
        await page
          .locator('img')
          .evaluateAll((es) => Promise.all(es.map((e) => e.decode().catch(() => {}))));
        const bounds = await page.evaluate(() => ({
          scroll: document.documentElement.scrollHeight,
          viewport: innerHeight,
          width: document.documentElement.scrollWidth,
          last: document.querySelector('.spell-bar').getBoundingClientRect().bottom,
          scene: document.querySelector('.battlefield').getBoundingClientRect().height,
        }));
        assert.ok(bounds.scroll <= height + 1, JSON.stringify({ wave, width, height, bounds }));
        assert.ok(bounds.last <= height, JSON.stringify({ wave, width, height, bounds }));
        assert.ok(bounds.width <= width);
        assert.ok(bounds.scene >= 170);
        const axe = await new AxeBuilder({ page }).analyze();
        assert.deepEqual(
          axe.violations.map((v) => v.id),
          [],
        );
        results.push({
          wave,
          width,
          height,
          scene: Math.round(bounds.scene),
          scroll: bounds.scroll,
        });
        if (
          [
            [768, 1024],
            [1024, 768],
            [1024, 550],
          ].some(([w, h]) => w === width && h === height)
        )
          await page.screenshot({
            path: `.impeccable/review/tablet-fit/wave-${wave}-${width}x${height}.png`,
            fullPage: true,
          });
      }
    }
    console.log(JSON.stringify(results));
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
