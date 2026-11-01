// Compiles design/tokens.json into src/tokens.css: the custom properties every stylesheet
// reads, the font stack, and the @font-face rules for the self-hosted Fredoka files.
// Run `npm run tokens` after editing design/tokens.json; the spec in src/design-tokens.spec.ts
// fails when the generated file is stale.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tokensPath = resolve(root, 'design/tokens.json');
const outputPath = resolve(root, 'src/tokens.css');

export function compileTokens(tokens) {
  const firstTheme = tokens.color.themes[0].id;
  const value = (token) =>
    typeof token.value === 'string' ? token.value : token.value[firstTheme];
  const lines = [
    `/* ${tokens.name} — generated from design/tokens.json by npm run tokens. Do not edit. */`,
  ];
  for (const font of tokens.type.fonts) {
    lines.push(
      '@font-face {',
      `  font-family: ${font.family};`,
      `  src: url('/${font.file}') format('truetype');`,
      `  font-weight: ${font.weight};`,
      `  font-style: ${font.style ?? 'normal'};`,
      '  font-display: swap;',
      '}',
    );
  }
  lines.push(':root {');
  for (const [key, stack] of Object.entries(tokens.type.families)) {
    lines.push(`  --font-${key}: ${stack};`);
  }
  for (const family of ['color', 'spacing', 'radius', 'shadow']) {
    lines.push(`  /* ${family} */`);
    for (const token of tokens[family].tokens) {
      lines.push(`  --${token.name}: ${value(token)};`);
    }
  }
  lines.push('}');
  return lines.join('\n') + '\n';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const tokens = JSON.parse(readFileSync(tokensPath, 'utf8'));
  writeFileSync(outputPath, compileTokens(tokens));
  console.log(`Wrote ${outputPath}`);
}
