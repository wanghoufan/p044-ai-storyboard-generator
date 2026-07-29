# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Locked product decisions

- The selected visual source is the first generated concept: a dark cinematic director console with a left input rail and a right storyboard grid.
- The product language is Simplified Chinese. Use a charcoal base, electric cyan primary state, restrained violet accents, compact film-production density, and high text contrast.
- V1 generates exactly five text storyboards through a same-origin server proxy to Alibaba Cloud Model Studio, then automatically generates one 16:9 landscape image for each storyboard with qwen-image-2.0-pro-2026-06-22.
- Each storyboard card is a single-column reading flow: title and text details first, followed by a full-width 16:9 image and its actions.
- Image results use signed, temporary download tokens and remain current-session only. Never expose the API key to browser code.
- V1 has no authentication, persistence, history, database, or public deployment.
