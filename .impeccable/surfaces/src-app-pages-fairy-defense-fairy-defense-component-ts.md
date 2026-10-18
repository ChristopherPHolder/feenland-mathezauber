# Fairy Tower Defense — twenty-wave castle adventure

Mode: Experience. Ordinary extension of the established Feenland visual world, using the user-approved storybook castle-defense direction for ages 6–8. Primary target: `src/app/pages/fairy-defense/fairy-defense.component.ts`.

## Direction contract

Preserve the incumbent Fredoka type, ink text, cream reading surfaces, pink primary controls, and fairy identity: copper-red wavy hair, green leaf dress, translucent veined wings and golden star wand. The generated forest, castle, characters, butterfly and jewel strip extend that illustration language. New green and purple monsters and a crowned shield boss belong to the same painted world, with generation provenance beside the assets. Forest greens, gold path and jewel hues are local scene materials; they introduce no global identity or token change.

The battlefield provides the emotional setting. Keep the active numbered monster readable against lush scenery, with waiting monsters visually secondary. Boss shields make remaining layers visible; a boss transforms after its last layer. Present instructions and counting support on a calm cream dock beneath the scene. Jewel spells retain visible numerals and quantities so color is supplemental. The spell set expands from five choices to 0–10 from wave 11; zero must remain an explicit choice. Use shared pink primary actions and an obvious pause control.

Wide screens use a contained landscape stage with guidance and counting support side by side. Portrait phones use an edge-to-edge scene, stacked dock and touch-sized spells that accommodate the expanded set. Intro and outcome panels can increase stage height rather than clip instructions. Short landscape views allow vertical scrolling. Respect reduced motion and keep text, keyboard controls, visible focus and audio fallback usable independently of animation and speech.

## Product boundary

Twenty waves unlock sequentially; completed waves remain available for replay on the wave path. Waves 1–4 always show the ten-frame. Later waves provide requested help and automatic counting support after a mistake, with shorter independent prompts from wave 13. Shield bosses appear at waves 5, 10, 15 and 20. Thinking time is unlimited; every third incorrect spell costs a heart. Losing all hearts offers retry of the current wave, while completing a wave restores hearts and saves at that boundary. Mid-wave exits restart that wave without losing earlier completed waves.

Real level completion occurs only after all twenty waves. The first four teaching waves do not affect stars. Finish for one star; independently answer at least 43 of the remaining 64 assessed encounters for two, or all 64 for three. Requested and automatic help both affect independence. Two or three stars mark mastery; replay retains each wave’s best independent score, and existing earned progress never decreases. The final celebration enters the existing completion flow. Decorative star-wand effects remain distinct from earned stars.

Pause contains music, effects, speech, language and wave-path controls. Campaign results use `feenland.castle-campaign.v1`; existing `feenland.playtest.*` audio/tutorial preferences remain for compatibility. The original playtest checkpoint grants no campaign progress. See `docs/fairy-castle-campaign.md` for implemented rules, saving, star thresholds, verification and artwork provenance.

## Evidence and scope

Checked the campaign guide, `PRODUCT.md`, the existing Home brief, `DESIGN.md`, root styles, game templates and battle rules. Confirmed the expanded spell template, boss shield treatment, wave-path entry and new generated asset/sidecar files. Earlier visual inspection established consistency between `public/images/feenland.webp`, the generated fairy and forest: character traits, painted lighting, pink-roof castle and lush landscape remain coherent. This documentation pass adds no browser layout, image-quality or accessibility test claim.

Existing global documentation still describes preview-only availability, language selection only in Settings, reuse of the single Home image and restrained static completion. Those statements predate this approved gameplay extension; the local exceptions are recorded here without rewriting the global visual system. PRODUCT.md’s earlier paragraphs also retain the initial simple-artwork and Settings-only language language outside this pass’s current-delivery scope. Keep future refinements inside this surface unless a global change is explicitly approved.
