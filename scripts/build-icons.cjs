// Renders the app icons in public/icons from the logo artwork in public/logo.svg.
// Run with playwright available (as for the verify scripts): node scripts/build-icons.cjs
//
// - icon-<n>.png: the rounded logo tile on transparent corners, for `purpose: any`.
// - icon-maskable-<n>.png: a full-bleed square with the artwork inside the central 80% safe
//   zone, so Android's circle, squircle or teardrop masks never crop the wand or star.
// - apple-touch-icon.png: an opaque full-bleed square. iOS rounds the corners itself and
//   paints transparent pixels black, so this one must have none.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const logo = fs.readFileSync(path.join(root, 'public/logo.svg'), 'utf8');
const tile = logo.match(/<rect[^>]*fill="([^"]+)"/)[1];
// Everything inside the logo except its rounded background tile.
const artwork = logo
  .replace(/^[\s\S]*?<svg[^>]*>/, '')
  .replace(/<\/svg>\s*$/, '')
  .replace(/<rect[^>]*\/>/, '');

const rounded = () => logo;
const square = (scale) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" fill="none">
  <rect width="80" height="80" fill="${tile}"/>
  <g transform="translate(40 40) scale(${scale}) translate(-40 -40)">${artwork}</g>
</svg>`;

const icons = [
  ...[72, 96, 128, 144, 152, 192, 384, 512].map((size) => ({
    file: `icon-${size}x${size}.png`,
    size,
    svg: rounded(),
  })),
  // The artwork reaches 32% of the width from the centre at this scale: inside the 40% circle.
  ...[192, 512].map((size) => ({
    file: `icon-maskable-${size}x${size}.png`,
    size,
    svg: square(0.78),
  })),
  { file: 'apple-touch-icon.png', size: 180, svg: square(0.9) },
];

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    for (const { file, size, svg } of icons) {
      await page.setViewportSize({ width: size, height: size });
      await page.setContent(
        `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
      );
      await page.screenshot({
        path: path.join(root, 'public/icons', file),
        omitBackground: true,
        clip: { x: 0, y: 0, width: size, height: size },
      });
      console.log('wrote', file);
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
