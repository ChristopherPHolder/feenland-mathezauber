/* Run with NODE_PATH pointing at a temporary install of playwright and @axe-core/playwright.
   See docs/fairy-wave-one-playtest.md. No tracking or remote data is used. */
const { chromium } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const base = process.env.FAIRY_BASE_URL || 'http://127.0.0.1:4300';
const captureDir = path.resolve('.impeccable/review');
(async () => {
  await fs.mkdir(captureDir, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1366, height: 1000 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const checks = [];
    async function audit(name) {
      const { violations } = await new AxeBuilder({ page }).analyze();
      assert.deepEqual(
        violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
        [],
        name,
      );
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
        `${name}: overflow`,
      );
      assert.equal(
        await page
          .locator('img')
          .evaluateAll((images) => images.some((img) => img.complete && img.naturalWidth === 0)),
        false,
        `${name}: broken image`,
      );
      checks.push(name);
    }
    async function ready() {
      await page.waitForFunction(() => {
        const bar = document.querySelector('.spell-bar');
        return bar && !bar.matches(':disabled');
      });
    }
    async function cast(value) {
      await page.getByRole('button', { name: `Cast spell ${value}`, exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.spell-bar')?.matches(':disabled'));
    }
    await page.goto(base + '/adventure/defend-fairy-castle');
    const originalProgress = JSON.stringify({
      version: 1,
      mastered: ['retired-level'],
      chapters: ['retired-chapter'],
      explored: [],
      stars: { 'retired-level': 3 },
    });
    await page.evaluate((progress) => {
      localStorage.clear();
      localStorage.setItem('feenland.locale', 'en');
      localStorage.setItem('feenland.progress', progress);
    }, originalProgress);
    await page.reload();
    await audit('intro');
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await ready();
    await page
      .locator('img')
      .evaluateAll((images) =>
        Promise.all(images.map((image) => image.decode().catch(() => undefined))),
      );
    for (const [name, width, height] of [
      ['desktop', 1366, 1000],
      ['tablet', 820, 1180],
      ['mobile', 393, 852],
      ['small', 320, 700],
      ['landscape', 568, 320],
    ]) {
      await page.setViewportSize({ width, height });
      await audit(name);
      if (['desktop', 'tablet', 'mobile'].includes(name))
        await page.screenshot({ path: path.join(captureDir, name + '.png'), fullPage: true });
    }
    await page.setViewportSize({ width: 393, height: 852 });
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await audit('pause dialog');
    // Verify every language on the same paused game without throwing away its state.
    for (const locale of ['de', 'es', 'fr', 'en']) {
      await page.locator('select').selectOption(locale);
      await audit('pause ' + locale);
      assert.equal(await page.locator('html').getAttribute('lang'), locale);
    }
    // Native dialog must contain focus and Escape must restore its trigger.
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      assert.equal(
        await page.evaluate(
          () =>
            document.activeElement === document.body || !!document.activeElement.closest('dialog'),
        ),
        true,
      );
    }
    await page.keyboard.press('Escape');
    await ready();
    assert.equal(
      await page
        .getByRole('button', { name: 'Pause', exact: true })
        .evaluate((e) => e === document.activeElement),
      true,
    );
    // Pause during a pending cast; the encounter cannot resolve in the background.
    await cast(1);
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.waitForTimeout(700);
    assert.equal((await page.locator('.number-badge').textContent()).trim(), '9');
    await page.getByRole('button', { name: 'Keep playing', exact: true }).click();
    await ready();
    assert.equal((await page.locator('.number-badge').textContent()).trim(), '8');
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.getByRole('button', { name: 'Restart this wave', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.number-badge')?.textContent.trim() === '9');
    await ready();
    assert.equal((await page.locator('.number-badge').textContent()).trim(), '9');
    await cast(1);
    await ready();
    await cast(2);
    await page.getByRole('heading', { name: 'Wave 1 complete!', exact: true }).waitFor();
    await audit('wave complete');
    await page.screenshot({ path: path.join(captureDir, 'complete.png'), fullPage: true });
    assert.equal(
      await page.evaluate(() => localStorage.getItem('feenland.progress')),
      originalProgress,
    );
    assert.equal(await page.evaluate(() => sessionStorage.getItem('feenland.result')), null);
    await page.getByRole('button', { name: 'Play again', exact: true }).click();
    for (let mistake = 1; mistake <= 9; mistake++) {
      await cast(5);
      if (mistake < 9) await ready();
      else await page.getByRole('heading', { name: 'Let’s try again', exact: true }).waitFor();
      if (mistake === 3) {
        assert.ok(await page.getByRole('img', { name: '2 hearts remaining out of three' }).count());
        await audit('one heart lost');
      }
    }
    await audit('setback');
    await page.screenshot({ path: path.join(captureDir, 'setback.png'), fullPage: true });
    await page.getByRole('button', { name: 'Try this wave again', exact: true }).click();
    await ready();
    assert.equal((await page.locator('.number-badge').textContent()).trim(), '9');
    assert.ok(await page.getByRole('img', { name: '3 hearts remaining out of three' }).count());
    // Reload resets a partially played wave and preserves tutorial state.
    await cast(1);
    await ready();
    await page.reload();
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await ready();
    assert.equal((await page.locator('.number-badge').textContent()).trim(), '9');
    assert.ok(
      (await page.locator('.instruction').textContent()).includes(
        'Count the empty spaces to make ten.',
      ),
    );
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.getByText('Music', { exact: true }).locator('..').locator('input').uncheck();
    await page.getByText('Fairy voice', { exact: true }).locator('..').locator('input').uncheck();
    await page.reload();
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    assert.equal(
      await page.getByText('Music', { exact: true }).locator('..').locator('input').isChecked(),
      false,
    );
    assert.equal(
      await page
        .getByText('Fairy voice', { exact: true })
        .locator('..')
        .locator('input')
        .isChecked(),
      false,
    );
    await page
      .getByRole('dialog')
      .getByRole('link', { name: 'Back to chapter', exact: true })
      .click();
    await page.getByRole('heading', { name: 'Friends of Ten', exact: true }).waitFor();
    await page.getByRole('link', { name: 'Play Wave 1', exact: true }).click();
    await page.getByRole('button', { name: 'Play', exact: true }).waitFor();
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify(
        {
          passed: checks,
          flow: 'success → replay → nine mistakes → loss → retry → refresh → saved preferences → chapter → playtest',
          pageErrors: errors,
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
