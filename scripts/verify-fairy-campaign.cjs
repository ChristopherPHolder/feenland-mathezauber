// Real Chrome journey with a controllable browser clock. See the campaign guide.
const { chromium } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const base = process.env.FAIRY_BASE_URL || 'http://127.0.0.1:4301';
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1366, height: 1000 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(base + '/adventure/defend-fairy-castle');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('feenland.locale', 'en');
    });
    await page.reload();
    await page.clock.install();
    const checks = [];
    await fs.mkdir('.impeccable/review/campaign', { recursive: true });
    const audit = async (name) => {
      const r = await new AxeBuilder({ page }).analyze();
      assert.deepEqual(
        r.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
        [],
        name,
      );
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
        name + ' overflow',
      );
      checks.push(name);
    };
    const capture = async (name) => {
      await page
        .locator('img')
        .evaluateAll((es) => Promise.all(es.map((e) => e.decode().catch(() => {}))));
      assert.equal(
        await page
          .locator('img')
          .evaluateAll((es) => es.some((e) => e.complete && !e.naturalWidth)),
        false,
        'broken images',
      );
      await page.screenshot({
        path: path.resolve('.impeccable/review/campaign/' + name + '.png'),
        fullPage: true,
      });
    };
    const ready = async () => {
      await page.waitForFunction(() => {
        const e = document.querySelector('.spell-bar');
        return e && !e.matches(':disabled');
      });
    };
    const answer = async (value) => {
      await page.getByRole('button', { name: 'Cast spell ' + value, exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.spell-bar')?.matches(':disabled'));
      await page.clock.runFor(2800);
    };
    await audit('intro');
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await ready();
    for (let wave = 1; wave <= 20; wave++) {
      await ready();
      if ([1, 5, 11, 20].includes(wave)) {
        for (const [name, width, height] of [
          ['desktop', 1366, 1000],
          ['tablet', 820, 1180],
          ['mobile', 393, 852],
          ['small', 320, 700],
        ]) {
          await page.setViewportSize({ width, height });
          await audit('wave ' + wave + ' ' + name);
          if (['mobile', 'desktop'].includes(name)) await capture('wave-' + wave + '-' + name);
        }
        await page.setViewportSize({ width: 1366, height: 1000 });
      }
      if (wave === 5) {
        // A broken layer remains broken after losing a heart.
        let energy = Number(await page.locator('.number-badge').textContent());
        await answer(10 - energy);
        await ready();
        assert.equal(await page.locator('.shield-layers .broken').count(), 1);
        energy = Number(await page.locator('.number-badge').textContent());
        for (let i = 0; i < 3; i++) {
          await answer(energy === 9 ? 2 : 1);
          await ready();
        }
        assert.equal(await page.locator('.shield-layers .broken').count(), 1);
        assert.ok(await page.getByRole('img', { name: '2 hearts remaining out of three' }).count());
        assert.equal(await page.locator('.ten-frame').count(), 1);
        await audit('boss after damage');
        // Retry resets all layers; completed waves survive.
        for (let i = 0; i < 6; i++) {
          await answer(energy === 9 ? 2 : 1);
          if (i < 5) await ready();
        }
        await page.getByRole('heading', { name: 'Let’s try again', exact: true }).waitFor();
        await audit('boss setback');
        await page.getByRole('button', { name: 'Try this wave again', exact: true }).click();
        await ready();
        assert.equal(await page.locator('.shield-layers .broken').count(), 0);
        assert.equal(
          await page.evaluate(
            () => JSON.parse(localStorage.getItem('feenland.castle-campaign.v1')).results.length,
          ),
          4,
        );
      }
      if (wave === 11) {
        assert.equal(await page.locator('.spell').count(), 11);
        assert.equal(await page.locator('.ten-frame').count(), 0);
      }
      // Every step is solved by reading the visible number, including zero and ten.
      let encounters = 0;
      while (await page.locator('.spell-bar').count()) {
        await ready();
        const energy = Number(await page.locator('.number-badge').textContent());
        await answer(10 - energy);
        encounters++;
        assert.ok(encounters <= 5);
      }
      await page
        .getByRole('heading', { name: 'Wave ' + wave + ' complete!', exact: true })
        .waitFor();
      const saved = await page.evaluate(() =>
        JSON.parse(localStorage.getItem('feenland.castle-campaign.v1')),
      );
      assert.equal(saved.results.length, wave);
      if (wave < 20)
        assert.equal(await page.evaluate(() => localStorage.getItem('feenland.progress')), null);
      if (wave === 10) {
        // Returning after a saved boundary resumes the next wave with all hearts.
        await page.reload();
        await page.getByRole('button', { name: 'Continue · Wave 11', exact: true }).waitFor();
        await page.getByRole('button', { name: 'Continue · Wave 11', exact: true }).click();
        await ready();
        continue;
      }
      if (wave < 20) {
        await page.getByRole('button', { name: 'Next wave', exact: true }).click();
        await page.waitForFunction(
          (n) => document.querySelector('.wave')?.textContent.includes('Wave ' + n + ' of 20'),
          wave + 1,
        );
      }
    }
    await page.getByRole('button', { name: 'See your celebration', exact: true }).click();
    await page.getByRole('heading', { name: 'Castle saved!', exact: true }).waitFor();
    await audit('castle saved');
    await capture('castle-saved');
    const progress = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('feenland.progress')),
    );
    assert.equal(progress.stars['defend-fairy-castle'], 3);
    assert.ok(progress.mastered.includes('defend-fairy-castle'));
    await page.getByRole('link', { name: 'Play again', exact: true }).click();
    await page.getByRole('button', { name: 'Play again', exact: true }).waitFor();
    await page.getByText('Choose a wave', { exact: false }).first().click();
    assert.equal(await page.locator('.wave-path button:disabled').count(), 0);
    await audit('all waves unlocked');
    // Audit all languages on the expanded spell bar using a completed campaign replay.
    await page.getByRole('button', { name: 'Wave 11 · completed', exact: true }).click();
    await ready();
    for (const locale of ['de', 'es', 'fr', 'en']) {
      await page.getByRole('button', { name: /^(Pause|Pausa)$/ }).click();
      await page.locator('select').selectOption(locale);
      await audit('pause ' + locale);
      await page.keyboard.press('Escape');
      await ready();
      await page.setViewportSize({ width: 393, height: 852 });
      await audit('eleven spells ' + locale);
      await page.setViewportSize({ width: 1366, height: 1000 });
    }
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify(
        { checks, waves: 20, stars: progress.stars['defend-fairy-castle'], errors },
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
