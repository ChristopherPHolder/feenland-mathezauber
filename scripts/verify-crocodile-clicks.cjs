const { chromium } = require('playwright');
const assert = require('node:assert/strict');

// Real pointer events catch moving hit targets that HTMLElement.click() cannot reproduce.
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      for (let choice = 0; choice < 3; choice++) {
        for (const edge of ['bottom', 'left']) {
          await page.goto(
            (process.env.CROCODILE_BASE_URL || 'http://127.0.0.1:4200') +
              '/adventure/crocodile-1',
          );
          await page.locator('.intro .primary').click();
          const button = page.locator('.choice').nth(choice);
          await button.scrollIntoViewIfNeeded();
          await page.mouse.move(0, 0);
          await page.waitForTimeout(250);
          const box = await button.boundingBox();
          assert.ok(box);
          const before = await page.locator('.instruction').innerText();
          await page.mouse.move(
            edge === 'left' ? box.x + 2 : box.x + box.width / 2,
            edge === 'bottom' ? box.y + box.height - 2 : box.y + box.height / 2,
          );
          await page.waitForTimeout(200);
          await page.mouse.down();
          await page.waitForTimeout(200);
          await page.mouse.up();
          await page.waitForTimeout(50);
          assert.notEqual(
            await page.locator('.instruction').innerText(),
            before,
            `Ignored ${edge} click: viewport ${width}, choice ${choice}`,
          );
        }
      }
    }
    console.log('All 12 crocodile edge clicks responded.');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
