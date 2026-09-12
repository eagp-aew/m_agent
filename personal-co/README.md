# Personal Co

Personal Co is an original Expo Web foundation for a single, durable thinking partner backed by Letta. It keeps the application intentionally narrow: one tagged agent, six fixed memory blocks, explicit epistemic states, archive-first imports, and evidence-gated learning claims.

## Product surfaces

The primary navigation is **对话 / 今天 / 记忆** on desktop and narrow screens; **设置** is a secondary header action. Chat contains the Learning and Reflection detail links. Memory contains Core Memory, Memory Changes, Archive, and Import. Existing detailed forms remain available, including English technical labels.

Chat starters only fill an empty editable draft and never send it. The draft survives navigation and failed sends during this page session; it is cleared only after a successful complete message workflow. Delivery errors distinguish an unattempted send, an unknown delivery, and a returned message with failed memory follow-up. No automatic resend occurs: an unknown result requires checking refreshed history before the user chooses to resend. Drafts are not persisted across page reloads.

Chat and Today show this session's current Agent-bound pending memory decisions with their full before/after values, invoking the same existing Apply/Cancel handlers and exact-base checks. Today currently provides links to goals, review, and chat; it does **not** provide persistent tasks, scheduled notifications, or background reminders. Offline and empty states make this limitation explicit. The first empty chat is onboarding guidance, not synthetic conversation history.

- **Chat** — converse with the one agent tagged `personal-co-v1`.
- **Learning** — run the six-stage diagnose, explain, verify, archive, and review flow while keeping assistant coaching separate from user-verified evidence.
- **Reflection** — explicitly create a five-section weekly review with explanatory cross-domain connections, falsifiable hypotheses, and confirmation-only core proposals.
- **Core Memory** — correct or clear the four writable blocks, inspect persisted Personal Co metadata, and keep `PERSONA` and `MEMORY_POLICY` read-only.
- **Memory Changes** — review session changes, apply or cancel stable proposals (also available in Chat and Today), and preview exact-term forget operations before confirmation.
- **Archive** — search structured durable passages and confirm deletion of one exact passage.
- **Import** — preview pasted lines with normalized type, source, date, and epistemic provenance.
- **Settings** — configure the Letta connection, privacy scopes, language, and portable snapshot export/restore.

The adapter never performs cross-provider fallback. Before listing or creating an Agent, it fetches both Letta model inventories and requires the trimmed configured generation and embedding handles to exactly equal non-empty registered `handle` fields. Display names, model names, partial matches, case variants, blank entries, and substitutions do not count; an inventory error or unavailable handle fails closed before any Agent lifecycle mutation. Initial creation sets `enable_sleeptime: false` and duplicate tagged Agents are rejected. Reconnecting to an existing tagged Agent is read-only with respect to configuration: a model, embedding, or sleeptime mismatch is rejected instead of silently updating it.

Settings keeps draft values separate from the active connection. The explicit model-switch action closes an adapter-instance write barrier before its first wait and drains token-scoped leases held across each already-started message/reconciliation, forget, import, or restore workflow; workflows started after the latch fail closed. It then validates the target generation model and locked embedding, captures all six Blocks (including their limits) plus the full Archive, updates only the generation model on the same Agent ID, and reads everything back before committing the draft. Full Archive pages must provide a unique advancing cursor, so ambiguous pagination aborts before the forward update instead of accepting a partial snapshot. Any failure after the forward update is attempted triggers a same-ID original-model rollback and fresh verification. If rollback cannot be proven, that adapter instance remains write-locked and requires operator inspection; embedding migration, Agent replacement, deletion, and automatic fallback are never attempted. The documented presets are DeepSeek V4 Pro for routine use and GPT-5.6 Terra as a manual quality switch; availability still depends on the exact handles registered by your Letta server.

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

The deterministic tests verify the installed Letta SDK inventory contract, exact-handle policy, application-instance write barrier, same-ID switch payload, memory invariants, learning evidence gates, Archive-before-Block ordering, coaching reconciliation, partial learning persistence, explicit weekly-review creation, cross-domain connection bounds, falsifiable hypotheses, Archive-only review completion, exact Archive read-back, exact-base pending proposals, and rollback/lock behavior. They do not prove live T-01 connection, T-03 conversation, T-04 model switching, T-05 memory governance, T-06 learning persistence, or T-10 privacy reconciliation against a disposable Letta deployment. They also do not prove PostgreSQL snapshot or recovery. Those checks still require registered live models, disposable server credentials, and an operator-run database backup/recovery exercise.

## Memory and import guarantees

The domain policy recognizes `confirmed`, `observed`, `inferred`, `hypothesis`, and `superseded`. Uncertain information is archive-first. Stable profile and goal changes require confirmation, while policy blocks reject edits. Imported text starts as an `external_import` archive candidate and cannot directly mutate stable memory. Learning follows the documented `exposed`, `developing`, `usable`, and `needs_review` states: reading alone stays `exposed`, practice can become `developing`, application or transfer evidence is required for `usable`, and contradiction, retrieval failure, or time decay triggers `needs_review`. Blank or unknown evidence fails closed.

A completed Learning episode requires a topic, source, goal, one to three diagnostic questions, the learner's diagnostic response, a structure-first explanation, a verification mode (`explain`, `compare`, `apply`, or `counterexample`), observable evidence, and evidence detail. It accepts at most three unique retrieval questions. Coaching is sent through the same Agent with a no-memory-write request and is displayed only after attempted writes have been reconciled; coaching never auto-fills evidence. Completion captures the fresh Agent memory within one callback-scoped workflow, revalidates the exact Agent and writable `LEARNING_MODEL` Block, and checks the server-returned Block limit before any write. It then archives a quoted `learning_episode` record before replacing the one managed concept entry in `LEARNING_MODEL`. Archive failure prevents the Block update; if the Archive succeeds but the Block update fails, the evidence remains archived and the UI reports the partial result instead of advancing the learning state.

Reflection has no timer, scheduler, background Agent, or automatic trigger. The weekly review exists only after the user presses its explicit Archive action and contains the five ordered sections: progress, learning-state changes, unfinished threads, possible patterns, and one next-week focus. It can retain one to three unique connections using only `analogy`, `prerequisite`, `causal`, `contradiction`, or `transfer`; every connection records both the shared mechanism and its important boundary plus a concrete future-learning value. Growth hypotheses require attributable dated evidence, a bounded confidence, an alternative explanation, a falsifier, and an exact user-confirmation boolean. Even a user-confirmed hypothesis remains quoted Archive evidence and never becomes a stable personality label automatically.

Optional Reflection coaching requests no memory writes from the same exact Agent and is shown only after reconciliation succeeds with all five headings present. Completion prepares proposals without mutation, writes one normalized `type:episode` Archive passage, refreshes memory, and reports success only for a fresh exact ID/text/tag/timestamp match with the same Agent and unchanged Blocks. It performs no Block write. Only after that proof does the session expose at most one managed `LEARNING_MODEL` connection proposal and any other user-entered core proposals in Memory Changes. Each pending proposal is process-local, factory-backed, and bound to the exact Agent ID, Block ID, and base value; Apply refreshes inside a guarded workflow, cancels a stale proposal without writing, updates once, and verifies exact read-back. The guard and pending queue are browser-process local, so another tab or direct Letta client can still change memory between operations; live disposable-server validation remains required for deployed round-trip behavior.

`PROFILE` and `GOALS_AND_DECISIONS` corrections remain pending until an explicit Apply action in Memory Changes. Clearing any writable block has a destructive confirmation, and exact-term forget requires the displayed `FORGET <term>` phrase before it removes literal references from writable blocks and archive passages. Operation failures are recorded individually; a partial failure is never reported as full success.

Temporary sessions and messages containing a configured do-not-remember term send a no-memory system request. Because an agent can still attempt a write, the app snapshots blocks and archive before the message, restores changed writable blocks, removes newly added archive passages, verifies the result, and surfaces any reconciliation failure. It does not claim that failed rollback calls succeeded.

Portable export is a versioned, secret-filtered JSON snapshot of the same agent ID, six blocks, non-secret settings, and archive records. Restore validates that exact connected agent ID, previews changes, updates only writable blocks, and appends only archive records not already present with `provenance:restore`. It never imports or creates an agent. This portable snapshot is **not** a PostgreSQL dump or full Letta database backup; server-level backup and recovery remain an operator responsibility.

## Architecture reference

The project uses the public Letta TypeScript client and takes architectural inspiration from [`letta-ai/co`](https://github.com/letta-ai/co), pinned during design review at commit `0daccb8f2d69f40bcbc01994f9fb3c2c183f7229`. No source code, visual assets, or implementation text from that unlicensed repository is copied here; this app and its policy/domain implementation are original.
