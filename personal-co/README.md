# Personal Co

Personal Co is an original Expo Web foundation for a single, durable thinking partner backed by Letta. It keeps the application intentionally narrow: one tagged agent, six fixed memory blocks, explicit epistemic states, archive-first imports, and evidence-gated learning claims.

## Product surfaces

- **Chat** — converse with the one agent tagged `personal-co-v1`.
- **Core Memory** — edit `PROFILE`, `CURRENT_CONTEXT`, `GOALS_AND_DECISIONS`, and `LEARNING_MODEL`; inspect read-only `PERSONA` and `MEMORY_POLICY`.
- **Archive** — search durable passages without promoting uncertain material into core memory.
- **Import** — preview pasted lines as `external_import` archive candidates.
- **Settings** — configure the Letta base URL, model handle, embedding handle, and an optional session-only API key.

The adapter never performs cross-provider fallback. Agent creation and configuration updates set `enable_sleeptime: false` and reject duplicate agents carrying the Personal Co tag. The documented presets are DeepSeek V4 Pro for routine use and GPT-5.6 Terra as a manual quality switch; model availability still depends on the handles registered by your Letta server.

## Run locally

Requirements: Node.js 20+ and a reachable Letta server.

```sh
npm install
cp .env.example .env.local
npm run web
```

All values in `.env.example` are public placeholders. Never place a secret in an `EXPO_PUBLIC_*` variable because Expo embeds those values in the browser bundle. If your Letta server needs a key, enter it in Settings; Personal Co holds it only in React state for the current page session.

## Validate

```sh
npm test
npm run typecheck
npm run export:web
```

`npm run export:web` writes the static bundle to `dist/`.

## Memory and import guarantees

The domain policy recognizes `confirmed`, `observed`, `inferred`, `hypothesis`, and `superseded`. Uncertain information is archive-first. Stable profile and goal changes require confirmation, while policy blocks reject edits. Imported text starts as an `external_import` archive candidate and cannot directly mutate stable memory. Learning follows the documented `exposed`, `developing`, `usable`, and `needs_review` states: reading alone stays `exposed`, practice can become `developing`, application or transfer evidence is required for `usable`, and contradictory evidence triggers `needs_review`.

## Architecture reference

The project uses the public Letta TypeScript client and takes architectural inspiration from [`letta-ai/co`](https://github.com/letta-ai/co), pinned during design review at commit `0daccb8f2d69f40bcbc01994f9fb3c2c183f7229`. No source code, visual assets, or implementation text from that unlicensed repository is copied here; this app and its policy/domain implementation are original.
