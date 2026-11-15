/**
 * The coloured box of a loading view. Its colours come from `.is-route-tone[data-tone]` in the
 * global styles, so every shell shares one copy. The box fills the screen below the header, or
 * the whole screen for a focused game, which hides the header.
 */
const box = `
  display: block;
  min-height: calc(100dvh - 92px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
  background: var(--loader-ground);
  color: var(--loader-ink);
`;
const fullScreen = `
  min-height: calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom));
`;

/** For the loader and the blank placeholder: the host is the coloured box. */
export const routeTones = `
  :host { ${box} }
  :host-context(.focused-game) { ${fullScreen} }
`;

/**
 * For a route shell: the coloured box only while it is empty. With `on immediate` and a loading
 * block, Angular renders nothing until the loader is due, and the tinted shell fills that gap.
 */
export const emptyShellTones = `
  :host:empty { ${box} }
  :host-context(.focused-game):empty { ${fullScreen} }
`;
