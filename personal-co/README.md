# Personal Co

Personal Co is an original Expo Web foundation for a single, durable thinking partner backed by Letta. It keeps the application intentionally narrow: one tagged agent, six fixed memory blocks, explicit epistemic states, archive-first imports, and evidence-gated learning claims.

## Product surfaces

- **Chat** — converse with the one agent tagged `personal-co-v1`.
- **Core Memory** — correct or clear the four writable blocks, inspect persisted Personal Co metadata, and keep `PERSONA` and `MEMORY_POLICY` read-only.
- **Memory Changes** — review session changes, apply or cancel stable proposals, and preview exact-term forget operations before confirmation.
- **Archive** — search structured durable passages and confirm deletion of one exact passage.
- **Import** — preview pasted lines with normalized type, source, date, and epistemic provenance.
- **Settings** — configure the Letta connection, privacy scopes, language, and portable snapshot export/restore.

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

`PROFILE` and `GOALS_AND_DECISIONS` corrections remain pending until an explicit Apply action in Memory Changes. Clearing any writable block has a destructive confirmation, and exact-term forget requires the displayed `FORGET <term>` phrase before it removes literal references from writable blocks and archive passages. Operation failures are recorded individually; a partial failure is never reported as full success.

Temporary sessions and messages containing a configured do-not-remember term send a no-memory system request. Because an agent can still attempt a write, the app snapshots blocks and archive before the message, restores changed writable blocks, removes newly added archive passages, verifies the result, and surfaces any reconciliation failure. It does not claim that failed rollback calls succeeded.

Portable export is a versioned, secret-filtered JSON snapshot of the same agent ID, six blocks, non-secret settings, and archive records. Restore validates that exact connected agent ID, previews changes, updates only writable blocks, and appends only archive records not already present with `provenance:restore`. It never imports or creates an agent. This portable snapshot is **not** a PostgreSQL dump or full Letta database backup; server-level backup and recovery remain an operator responsibility.

## Architecture reference

The project uses the public Letta TypeScript client and takes architectural inspiration from [`letta-ai/co`](https://github.com/letta-ai/co), pinned during design review at commit `0daccb8f2d69f40bcbc01994f9fb3c2c183f7229`. No source code, visual assets, or implementation text from that unlicensed repository is copied here; this app and its policy/domain implementation are original.
