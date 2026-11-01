import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Guards the design tokens: design/tokens.json is the source, src/tokens.css is generated from
 * it, and every stylesheet reads tokens through var() instead of repeating their values.
 */
const root = resolve(__dirname, '..');

interface Token {
  readonly name: string;
  readonly value: string | Record<string, string>;
}
interface Tokens {
  readonly color: {
    readonly themes: readonly { readonly id: string }[];
    readonly tokens: readonly Token[];
  };
  readonly spacing: { readonly tokens: readonly Token[] };
  readonly radius: { readonly tokens: readonly Token[] };
  readonly shadow: { readonly tokens: readonly Token[] };
  readonly type: {
    readonly fonts: readonly {
      readonly family: string;
      readonly file: string;
      readonly weight: string;
    }[];
    readonly families: Readonly<Record<string, string>>;
  };
}

const tokens: Tokens = JSON.parse(readFileSync(join(root, 'design/tokens.json'), 'utf8'));
const generated = readFileSync(join(root, 'src/tokens.css'), 'utf8');
const firstTheme = tokens.color.themes[0].id;
const valueOf = (token: Token) =>
  typeof token.value === 'string' ? token.value : token.value[firstTheme];
const allTokens = [
  ...tokens.color.tokens,
  ...tokens.spacing.tokens,
  ...tokens.radius.tokens,
  ...tokens.shadow.tokens,
];

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) sourceFiles(path, out);
    else if (
      /\.(css|ts|html)$/.test(entry) &&
      !entry.endsWith('.spec.ts') &&
      entry !== 'tokens.css'
    )
      out.push(path);
  }
  return out;
}
const sources = sourceFiles(join(root, 'src')).map((path) => ({
  path: path.slice(root.length + 1),
  text: readFileSync(path, 'utf8'),
}));

describe('design tokens', () => {
  it('names every token once', () => {
    const names = allTokens.map((token) => token.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^[a-z0-9][a-z0-9-]*$/);
  });

  it('generates src/tokens.css from design/tokens.json', () => {
    expect(
      generated.startsWith('/* Feenland Mathezauber — generated from design/tokens.json'),
    ).toBe(true);
    for (const token of allTokens) {
      expect(generated).toContain(`  --${token.name}: ${valueOf(token)};`);
    }
    for (const [key, stack] of Object.entries(tokens.type.families)) {
      expect(generated).toContain(`  --font-${key}: ${stack};`);
    }
    for (const font of tokens.type.fonts) {
      expect(generated).toContain(`src: url('/${font.file}') format('truetype');`);
      expect(generated).toContain(`font-weight: ${font.weight};`);
    }
  });

  it('only reads custom properties that exist', () => {
    const known = new Set([
      ...allTokens.map((token) => token.name),
      ...Object.keys(tokens.type.families).map((key) => `font-${key}`),
    ]);
    // Properties a component declares itself, in CSS (`--toward:`) or a host or template
    // binding (`[style.--i]`, `[style.--flight.ms]`). A var() with its own fallback needs neither.
    const declared = new Set(
      sources.flatMap(({ text }) =>
        [...text.matchAll(/(?<!var\()--([a-z0-9-]+)(?=\s*[:\]=]|\.[a-z]+\])/gi)].map(
          (match) => match[1],
        ),
      ),
    );
    for (const { path, text } of sources) {
      for (const match of text.matchAll(/var\(--([a-z0-9-]+)\s*\)/gi)) {
        const name = match[1];
        if (!known.has(name) && !declared.has(name)) {
          throw new Error(`${path} reads var(--${name}), which no token or local property defines`);
        }
      }
    }
  });

  it('keeps token colours out of the stylesheets', () => {
    const colours = new Set(tokens.color.tokens.map((token) => valueOf(token).toLowerCase()));
    for (const { path, text } of sources) {
      if (!path.endsWith('.css') && !path.startsWith('src/app/shared/')) continue;
      for (const match of text.matchAll(/#[0-9a-f]{6}(?![0-9a-f])/gi)) {
        if (colours.has(match[0].toLowerCase())) {
          throw new Error(`${path} repeats token colour ${match[0]}; use its var() instead`);
        }
      }
    }
  });
});
