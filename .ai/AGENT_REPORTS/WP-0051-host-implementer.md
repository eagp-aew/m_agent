# WP0051 host chat implementation — segment B

## task_id
WP-0051-local-chat-integration

## agent_role
implementer — wp0051_host

## status
PASS — scoped author implementation/controlled validation only; independent verification and whole-WP acceptance remain with master.

## one_sentence_result
The existing managed-session owner now consumes durable chat receipts through fresh authenticated bounded named channels, with retained create/send/readback, conservative recovery, and process shutdown on uncertainty; default read-only entrypoints remain unchanged.

## files_read
- `AGENTS.md`; `.ai/MASTER_CONTRACT.md`; `.ai/WORK_PACKAGES/WP-0051-local-chat-integration.yaml`; relevant `.ai/TEST_MATRIX.md` row.
- `.agents/skills/direction-guide/SKILL.md`; `.agents/skills/direction-guide/references/agent-role-policy.md`; `.agents/skills/direction-guide/references/tool-policy.md`; `.agents/skills/direction-guide/references/context-profiles.md`.
- `.ai/AGENT_REPORTS/WP-0051-explorer.md`; accepted source/evidence sections of `.ai/AGENT_REPORTS/WP-0050-verifier.md`.
- `personal-co/server/authenticated-app-server.mjs`; `personal-co/server/managed-read-session.mjs`; `personal-co/server/runtime-sandbox.mjs`; `personal-co/server/chat-operation-store.mjs`; `personal-co/server/conversation-reader.mjs`; `personal-co/server/probe-local-chat-turn.mjs`; `personal-co/server/assistant-bootstrap.mjs`; `personal-co/src/domain/policy.mjs`.
- `personal-co/tests/authenticated-app-server.test.mjs`; `personal-co/tests/managed-read-session.test.mjs`; `personal-co/tests/runtime-sandbox.test.mjs`; `personal-co/tests/assistant-bootstrap.test.mjs`; newly authored channel/operations source and tests listed below.

## files_changed
- `personal-co/server/local-chat-channel.mjs`
- `personal-co/server/local-chat-operations.mjs`
- `personal-co/server/authenticated-app-server.mjs`
- `personal-co/server/managed-read-session.mjs`
- `personal-co/server/runtime-sandbox.mjs`
- `personal-co/server/assistant-bootstrap.mjs`
- `personal-co/tests/local-chat-channel.test.mjs`
- `personal-co/tests/local-chat-operations.test.mjs`
- `personal-co/tests/managed-read-session.test.mjs`
- `personal-co/tests/runtime-sandbox.test.mjs`
- `personal-co/tests/assistant-bootstrap.test.mjs`
- `.ai/AGENT_REPORTS/WP-0051-host-implementer.md`

Bootstrap source/tests were initially forbidden: work paused after finding the reopen conflict, then master explicitly extended these exact two reservations in segment B. No other scope expansion. Existing dirty memory/AGENTS/history and verified receipt-store bytes were preserved. No product edits to HTTP/CLI/UI/probe/canonical/codec/manifests.

## commands_run
- read_only: scoped `cat`, `sed`, `rg`, `wc`, `nl`, `git status --short`, scoped `git diff --stat`, and `shasum -a 256`; within packet and subsequent bootstrap extension; PASS.
- workspace_write: `apply_patch` manual edits only to the twelve paths above; standing project authority plus exact packet/master extension; completed.
- controlled validation/workspace_write: tests below create retained synthetic private fixtures and controlled loopback peers, with real SQLite and existing exact owned bootstrap-lock cleanup. Packet explicitly authorizes controlled peers/fresh fixtures; no native process launch, model/provider call, installation, manual deletion, recursive/batch cleanup, Git mutation, or child agents.
- read_only validation: six changed server `node --check` commands, `cd personal-co && npm run typecheck`, `git diff --check`; PASS.

## tests_run
1. Regression-first: `WP0048_RUN_NATIVE=0 node --test --test-name-pattern='existing canonical bootstrap admits' personal-co/tests/assistant-bootstrap.test.mjs` — expected FAIL before repair, `EXISTING_DATA` when reopening with real receipts. Fixture retained at external:/private/tmp/personal-co-wp0048-unit-giifqk.
2. Bootstrap targeted repair: `WP0048_RUN_NATIVE=0 node --test --test-name-pattern='receipt|existing canonical bootstrap admits' personal-co/tests/assistant-bootstrap.test.mjs` — 2 PASS; real receipt reopen/dedupe plus permissions, symlink, hardlink, directory, oversized file, orphan journal, WAL/SHM, unknown entry, missing canonical, and metadata-only admission controls.
3. Final chat validation: `node --test personal-co/tests/local-chat-channel.test.mjs personal-co/tests/local-chat-operations.test.mjs` — 30 PASS, zero failures/skips. Real composed fixture example external:/private/tmp/personal-co-wp0051-composed-DNJftF; maximum JSON-escaping case external:/private/tmp/personal-co-wp0051-composed-kHfvgu.
4. Related validation: `WP0045_RUN_NATIVE=0 WP0047_RUN_NATIVE=0 WP0048_RUN_NATIVE=0 node --test personal-co/tests/authenticated-app-server.test.mjs personal-co/tests/managed-read-session.test.mjs personal-co/tests/runtime-sandbox.test.mjs personal-co/tests/chat-operation-store.test.mjs personal-co/tests/assistant-bootstrap.test.mjs` — 78 PASS, 3 explicitly skipped native tests, zero failures. Later refinements touched only the chat channel/operations and their tests; final chat validation covers them. Existing read regressions remain unchanged.
5. `node --check` on each of the six changed server files — PASS; final changed channel/operations rechecked after refinements.
6. `cd personal-co && npm run typecheck` — PASS, rerun after final escaped-text refinement.
7. `git diff --check` — PASS.

Intermediate author runs (57/2, 14, 27, 29) were superseded by the final targeted results. No full-suite/browser/native/provider-quality claim.

## evidence

| Criterion | Implementation and controlled evidence |
| --- | --- |
| B1 | `personal-co/server/runtime-sandbox.mjs` lines 18 and 30 capture exact frozen model/port, reject fallback/URL/credential options, and append only literal IPv4 port grant plus LMSTUDIO environment. `personal-co/server/managed-read-session.mjs` lines 78 and 175 keep config private and opt-in to roots-only initialization. Sandbox and managed tests preserve unchanged default handles. |
| B2 | `personal-co/server/authenticated-app-server.mjs` line 270 owns chat bearer/socket inside the existing two-socket set. `personal-co/server/local-chat-channel.mjs` line 18 implements fresh named methods, pinned info, bounded frames/bytes/RPC/cleanup, same-runtime checks, authority rejection and current-client-only run mapping in either event order. Lines 132, 147, 160 fix policy/model/tools, strict execution, empty skills/external tools, reflection-off readback, and one UUID input. No arbitrary request method or application ACK. |
| B3 | `personal-co/server/managed-read-session.mjs` lines 220 and 243 consume the actual Agent-bound store after bootstrap validation and return only submit/get/listPending/recoverCreate. `personal-co/server/local-chat-operations.mjs` line 155 reserves synchronously before microtask dispatch. Real SQLite checks observe UNKNOWN before input; duplicate/conflict/BUSY/status/reopen never dispatch. Session closes channels/process, drains work, then closes store under lifetime ownership. |
| B4 | `personal-co/server/local-chat-operations.mjs` lines 50, 78, 94, 104, 115 implement exact create readback/unique-tag recovery, pre-input newest-row baseline, durable terminal before persisted proof, bounded overlap pagination, exact Agent/conversation/OTID/final original text and following new assistant rows. Long-history test uses 200 old rows and 45 replies while reading only four 20-row pages. Missing/changed boundary, nonadvancing cursor, duplicate users, foreign history or missing terminal remain UNKNOWN through reopen. No timestamp/text-based causal inference. |
| B5 | `personal-co/server/local-chat-operations.mjs` lines 10, 14, 136 reject inherited/override model settings and unexpected model/privacy before mutation, sanitize public errors and call managed stop on uncertainty. Controlled foreign frames, token echo, authority, unmatched/shared run, timeouts, malformed settings/reflection, cancellation during input/history and terminal failures exercise this path. Successful terminal alone does not complete. Valid 16 KiB text uses a fixed 128 KiB outgoing bound to account for JSON escaping. |
| B6 | `personal-co/tests/local-chat-operations.test.mjs` composes real managed/bootstrap/authenticated WebSocket/SQLite code with a controlled native-shaped peer and owned-process seam. Bootstrap admission extension in `personal-co/server/assistant-bootstrap.mjs` line 126 was regression-first: only existing intent plus existing canonical allows private fixed database/optional journal metadata; fresh-bootstrap empty rule, unknown-entry rejection and actual store schema/Agent validation remain. Independent review is still required. |

Final targeted total: 108 PASS and 3 native SKIP across the two validation groups. All eleven product/test paths frozen below. Receipt store remained exactly the already-verified hashes.

## risks
- Segment B is host-private and is NOT user-facing chat delivery or full-WP completion. Segment C must implement explicit relevant/current canonical-context admission before browser/HTTP/CLI enablement. Only fixed protected SYSTEM_PROMPT is sent now; writable canonical values are not copied or claimed synchronized.
- Native execution/security review and actual literal IPv4 Seatbelt grant behavior remain unverified for these new bytes. No real LM Studio/model quality, credential-free deployment, or non-temporary production-root claim. Master source corroboration notes native provider resolution can consult retained provider configuration before environment; outbound confinement does not itself attest credential absence. Production admission requires that review, without inspecting user secrets here.
- Send baseline is intentionally process-local, not added to the verified store schema. After restart, unknown sends stay unknown even when terminal/history is visible; no fabricated completion or resend.
- Readback bounds are 20 rows/page, at most 50 pages; interval exhaustion/absence remains unknown. Create recovery examines one bounded inventory and requires fewer than 100 results plus exactly one operation tag; it does not guess past a full page.
- Existing cooperative disk lock and same-UID host-controlled roots remain assumptions, not isolation from a hostile same-UID writer. Local terminal/receipt evidence is not backend exactly-once support.
- Unknown operations retain the mutation barrier. This implementation does not add manual data repair, deletion, migration or a user-facing resolution workflow.

## assumptions
- Explicit operator model is an exact LM Studio handle on the supplied literal-loopback port; no silent model/provider fallback is permitted.
- One managed owner retains the existing bootstrap lease throughout runtime lifetime. Controlled seams are trusted tests, never browser/model options.
- Accepted pinned-native evidence is source support, not execution proof. Master corroborated fresh model settings and projected empty tools; actual safety also requires the fixed runtime/input allowlists and process lifecycle.

## recommended_next_action
Freeze these paths for the independent segment-B verifier/security review. Master owns acceptance, memory/integration and next segment C. Do not enable browser chat, run native/provider work or accept the entire WP from this author report.

## child_agent_requests
[]

## child_report_bundle
[]

## implementation_notes
The direction-guide skill enforced exact reservations, the bootstrap scope pause, command classification and durable evidence. No child agents were requested. No dependency was added; existing SQLite and WebSocket facilities are reused.

### Frozen SHA256

| File | SHA256 |
| --- | --- |
| `personal-co/server/local-chat-channel.mjs` | 53a0b1aee3ecf41b06539c846e7ade211354fada2239e8a49cda68474184b8a1 |
| `personal-co/server/local-chat-operations.mjs` | 6546ef97b3a0e950ff370be39af3bffca3b941a40212ffb84e252ef1da7aafe4 |
| `personal-co/server/authenticated-app-server.mjs` | 6b1e9130eb9acd1b2751c58c98821bde14e4687257be775eabd625ae18df6c17 |
| `personal-co/server/managed-read-session.mjs` | e274e7d80e465cf772e05e416dad18816b468440eb076d77dc34128530a341d9 |
| `personal-co/server/runtime-sandbox.mjs` | 090bfeb5c803c8c16238308749ecd50760a7b3f97f831ab842eb47a44bab2421 |
| `personal-co/server/assistant-bootstrap.mjs` | 67ed0e7e560023c40f76587fe7affc1c4b43d346b454749f2a65cf4a691d7b88 |
| `personal-co/tests/local-chat-channel.test.mjs` | 6cd81152d7f8fb811ea8b678afd2ce0be3413f12a1b6a5f77e88d6b05f50eb32 |
| `personal-co/tests/local-chat-operations.test.mjs` | 1d1ea1ac611be881cc5066ef54824b93bf1fa44593341aaf0d1552c6513bfebf |
| `personal-co/tests/managed-read-session.test.mjs` | e89badccaad89c5d3e7dde723a120fdfc838ebe387930b91658bb06ba22f9530 |
| `personal-co/tests/runtime-sandbox.test.mjs` | ffa3588081c5d766b5cdbaa01a1a2640a25b4f2116535973c8bd89e19da071f4 |
| `personal-co/tests/assistant-bootstrap.test.mjs` | 29bc60243eb25c53b2037f91bbab44bf8f795dc3e653f5eb343c417a45f7e4f4 |
| `personal-co/server/chat-operation-store.mjs` (unchanged) | d173daf6d2fb79a8f7888fde21c2c465c59ef21d9a39180228feaad1d3448d47 |
| `personal-co/tests/chat-operation-store.test.mjs` (unchanged) | 516f8beef4813f311b693c792977addcd70a079d68a6398654df0221c740fdcd |
