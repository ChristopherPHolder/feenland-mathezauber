# Fun Math

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Children practicing math, with the primary unicorn garden designed for seven-year-olds. The intended audience is international; the product is not limited to German-speaking users.

## Product Purpose

Help children understand and practice math through play, guided examples, untimed exercises, and retry-friendly feedback.

## Operating Context

A responsive, installable web app with offline support after its production assets have been cached. Children can practice without a timer or penalties for retries.

## Capabilities and Constraints

- Existing stack: Angular with TypeScript, hosted on Cloudflare Workers with static assets.
- The landing page at `/` offers three freely selectable levels: Little berry bites (up to 10), Big berry bites (up to 20), and Number bridge (up to 30). No completion gates or saved progress are required.
- Luna’s enchanted garden opens at `/games/garden/little` or `/games/garden/big`, initialized to the selected difficulty: children combine or take away berries, choose an answer, serve a unicorn a treat, and earn a friendship sticker.
- A visit contains five untimed treats. Recipe sizes practice addition and subtraction up to 10 or up to 20, with optional counting help and browser-dependent read-aloud. Garden copy is English.
- The existing German number-bridge game remains available at `/games/number-bridge`, linked from the landing page as Level 3 and from the garden footer. It practices missing numbers in addition and subtraction up to 30, using hops via the next ten, and progresses from guided examples to independent practice with optional help.
- Current English garden and German number-bridge copy are implementation facts, not a language restriction for future work.
- Supported languages, translation priorities, and language selection remain open decisions. Do not claim that multilingual support is already implemented.
- Session progress is temporary; the current app has no backend, analytics, or user data storage.

## Brand Commitments

The product name is Fun Math. Preserve encouraging, retry-friendly feedback suitable for children.

## Evidence on Hand

- `README.md`: current features, workflows, offline behavior, and hosting.
- `src/app/pages/playground/`: the landing page and level picker.
- `src/app/pages/home/`: the unicorn garden and treat arithmetic.
- `src/app/shared/`: berry counters, SVG motifs, and friendship album.
- `src/app/games/number-bridge/`: the preserved German math game and exercise logic.
- `AGENTS.md`: implementation and accessibility requirements.

## Product Principles

- Teach with guided examples before independent practice.
- Let children work at their own pace and retry without penalties.
- Design for an international audience and accommodate localization.
- Preserve offline practice and accessible interaction.

## Accessibility & Inclusion

Meet WCAG AA requirements, including keyboard access, focus management, color contrast, and appropriate ARIA. Pass AXE checks. Allow for translated text and different text lengths in future interfaces.
