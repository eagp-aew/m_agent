# WP-0051 C2 HTTP/client/UI implementation

## task_id
WP-0051-local-chat-integration

## agent_role
implementer — wp0051-c2-ui-author

## status
PASS for author offline implementation/validation scope. Independent verification, desktop/narrow browser evidence and separately reviewed native/provider proof remain pending. Not full WP acceptance or live-provider readiness.

## one_sentence_result
The existing local assistant now connects retained create/send/context/recovery UI to fixed authenticated HTTP routes and the actual managed receipt/reader owner, with bounded metadata-only provider admission and no uncertain-write replay.

## files_read
- `AGENTS.md`, `.ai/MASTER_CONTRACT.md`, `.ai/WORK_PACKAGES/WP-0051-local-chat-integration.yaml`, `.ai/AGENT_REPORTS/WP-0051-explorer.md`.
- `.agents/skills/direction-guide/SKILL.md`, `.agents/skills/direction-guide/references/tool-policy.md`, `.agents/skills/direction-guide/references/agent-role-policy.md`, `.agents/skills/direction-guide/references/context-profiles.md`; unchanged earlier applicable instruction readings reused.
- All eighteen scoped product/test/document paths below; the new CLI test did not previously exist.
- Direct contracts: `personal-co/server/chat-operation-store.mjs`, `personal-co/server/local-chat-context.mjs`, `personal-co/package.json`; accepted B/C1 source context reused. No native bundle, private user/provider state, credential file content, unrelated project or network source was read.

## files_changed
Exactly these eighteen scoped product/test/document paths, plus this report:

- `personal-co/server/local-read-host.mjs`
- `personal-co/server/local-read-cli.mjs`
- `personal-co/server/managed-read-session.mjs`
- `personal-co/server/local-chat-operations.mjs`
- `personal-co/server/conversation-reader.mjs`
- `personal-co/src/services/local-read-client.mjs`
- `personal-co/src/components/LocalAssistant.tsx`
- `personal-co/README.md`
- `personal-co/tests/local-read-host.test.mjs`
- `personal-co/tests/local-read-client.test.mjs`
- `personal-co/tests/local-read-cli.test.mjs` (new)
- `personal-co/tests/managed-read-session.test.mjs`
- `personal-co/tests/local-chat-operations.test.mjs`
- `personal-co/tests/conversation-reader.test.mjs`
- `personal-co/server/runtime-sandbox.mjs` (master's exact provider-admission scope extension)
- `personal-co/tests/runtime-sandbox.test.mjs` (same extension)
- `personal-co/server/assistant-bootstrap.mjs` (same extension)
- `personal-co/tests/assistant-bootstrap.test.mjs` (same extension)
- `.ai/AGENT_REPORTS/WP-0051-ui-implementer.md`

Normal approved web export regenerated ignored build output under `personal-co/dist`. No App/legacy adapter, receipt schema/store, context/channel/auth source, dependencies or other metadata was edited. Master-owned dirty metadata, AGENTS and unrelated historical files were preserved.

## commands_run
- read_only, approved scoped source/contract inspection: cat/sed/rg, git status/diff, SHA256 collection — PASS.
- workspace_write, approved exact-file implementation: apply_patch only — completed; no deletion, migration, install, child or Git mutation.
- approved controlled validation: initial related run — 124 PASS, 5 FAIL, 3 native SKIP. Failures were expected old-contract assertions: two user-history reminder-length expectations, status DTO fields, missing provider test seam, and sandbox profile/env expectation. Updated scoped tests; no assertion was relaxed to admit native reminders or bypass production guards.
- approved controlled validation: expanded eight-file run — 142 PASS, 0 FAIL, 3 native SKIP, 145 total.
- final controlled validation: `WP0045_RUN_NATIVE=0 WP0046_RUN_NATIVE=0 WP0047_RUN_NATIVE=0 WP0048_RUN_NATIVE=0 WP0049_RUN_NATIVE=0 WP0050_RUN_NATIVE=0 node --test --test-reporter=dot personal-co/tests/local-read-host.test.mjs personal-co/tests/local-read-client.test.mjs personal-co/tests/local-read-cli.test.mjs personal-co/tests/managed-read-session.test.mjs personal-co/tests/local-chat-operations.test.mjs personal-co/tests/conversation-reader.test.mjs personal-co/tests/runtime-sandbox.test.mjs personal-co/tests/assistant-bootstrap.test.mjs` — exit 0, 147 tests: 144 PASS, 3 native SKIP, no failures. Added direct HTTP-to-managed journey and changed-intent ownership regression after the prior 145-test run.
- read_only syntax validation: node --check on the eight changed .mjs product modules — PASS.
- approved build validation: `cd personal-co && npm run typecheck && npm run export:web` — exit 0, PASS; exported one 715 kB web bundle plus index/metadata. Export warnings concerned NO_COLOR/FORCE_COLOR only.
- read_only whitespace validation: `git diff --check` — PASS.
- Not run: browser, native runtime, model/provider, network-source access, broad full suite. Optional new native-journey test authoring was deferred under the master's permission; no new WP0051 native opt-in test exists in this author freeze.

## tests_run
Final eight-file test scope includes original read-only regression coverage plus fixed real HTTP authentication/body/projection cases, real SQLite receipt dedupe, actual client/controller races and recovery, exact reader original-text proof, provider metadata-only rejection, managed cancellation/cleanup, bootstrap ownership draining, and real HTTP/client → managed bootstrap → authenticated controlled WebSocket → receipt/history → same-Agent reopen. All process launches/provider behavior were controlled; fresh synthetic fixtures were retained.

## evidence
`personal-co/tests/local-chat-operations.test.mjs` line 150 runs the complete HTTP/client/managed composition using the existing controlled peer, verifies exact original input display, duplicate UUID no second input, same-Agent reopen and a subsequent new send. Line 204 proves post-ready provider-record pollution stops the owner before any new chat socket. `personal-co/tests/local-read-host.test.mjs` line 79 covers the authenticated named routes through the real durable store and client, including escaped 16 KiB text. `personal-co/tests/local-read-client.test.mjs` line 78 covers a pending old status delivery racing a fresh submission and active-only polling.

Examples of retained synthetic evidence: external:/private/tmp/personal-co-wp0051-composed-Wx1fJH, external:/private/tmp/personal-co-wp0051-composed-QfZeYc, external:/private/tmp/personal-co-wp0049-unit-Bvi1mu, external:/private/tmp/personal-co-wp0048-unit-auyxtZ. These are controlled fixtures, not user state.

## risks
- Independent adversarial/security verification and actual desktop/narrow browser review are still required; typecheck/export are not visual accessibility proof.
- Native numeric-port sandbox enforcement, provider request endpoint/model/headers and native compatibility with provider-subtree denial/mod disabling remain unexecuted. The new CLI flags are not evidence that live native chat is admitted.
- Provider metadata checks and bootstrap locking assume cooperating same-UID writers. They detect observed changes but are not a cross-process atomic snapshot or hostile same-user protection.
- Unsent drafts remain page-local and disappear on refresh. Private pending receipts recover submitted text/title and UUID, not unsent edits; no browser persistence was added.
- Missing original-user proof intentionally hides historical user text in chat mode. Conflicting proof fails the read; an UNKNOWN receipt never becomes completed merely because a message can be projected.
- Derived context reset is not native-cache erasure; abnormal exit may retain sensitive context. Context remains explicitly selected, not automatic retrieval or proof of currentness/truth.
- Polling is read-only and bounded to 180 iterations while host activity is observed. Network interruption stops polling; deliberate status lookup remains available. No timer or reconnect resends mutations.

## assumptions
- Existing independently accepted B/C1 operation reservation, runtime restrictions, context eligibility and durable completion proofs remain authoritative; no schema or channel redesign was needed.
- Fixed host routes are served from trusted exported assets with page-memory-only bearer authority, retainedOnly admission and existing Host/Origin/cookie guards.
- Direction-guide constrained the exact sole-writer scope, source boundaries, controlled validation and independent handoff. The provider extension was explicitly assigned by the master before those four paths were edited.

## recommended_next_action
Independently verify the frozen eighteen paths, then perform master-owned desktop/narrow actual-browser QA against controlled synthetic state. Package and review the integrated native/provider test before enabling any native execution. Master owns metadata integration and commits; author product edits are stopped.

## child_agent_requests
[]

## child_report_bundle
[]

## implementation_notes

### acceptance_criteria_mapping
- C2.1 — `personal-co/server/local-read-host.mjs` lines 41, 64 and 257: exact submit/operation/pending/recover-create/context-preview projections, same authenticated guard, 128 KiB submit only/4 KiB other bodies, safe retained original-text/title receipts without terminal/settings/context plaintext. Synchronous reservation has no HTTP abort signal; response-loss test proves no cancellation/replay. Default chat routes are disabled without trusted operator config.
- C2.2 — `personal-co/server/local-chat-operations.mjs` lines 193 and 203 plus `personal-co/server/conversation-reader.mjs` line 64 and `personal-co/server/managed-read-session.mjs` line 246: actual active-operation ID is separate from durable unknown, exact Agent/conversation/OTID receipt lookup precedes display, completed userMessageId must match, pinned final text must equal original, missing proof is hidden explicitly and conflicting/predispatch-rejected proof fails closed. Default non-chat reader is unchanged; read paths never complete receipts.
- C2.3 — `personal-co/src/services/local-read-client.mjs` lines 163–287: immutable UUID/request captured before dispatch, one mutation in flight, per-conversation versioned drafts, late selection/edit protection, pending original-text recovery, bounded active-only read polling, status-generation guard, explicit create lookup only, optional max-four/8192-byte context selection, no resend after unknown. Controller/client regressions PASS.
- C2.4 — `personal-co/src/components/LocalAssistant.tsx` lines 48, 71 and 120: Chinese retained-only create/composer, operation receipt/status, explicit open-result action, collapsed context preview/checkboxes, draft-lifetime disclosure, and discard confirmation. Actual desktop/narrow browser evidence remains pending, not claimed.
- C2.5 — `personal-co/server/local-read-cli.mjs` line 19 uses exact captureLocalChatConfig with paired explicit port/model. `personal-co/server/runtime-sandbox.mjs` lines 36 and 46 implements metadata-only provider guard, denied provider data/write subtree and LETTA_DISABLE_MODS=1. `personal-co/server/assistant-bootstrap.mjs` line 230 supplies serialized/drained ownership checks; managed lines 192, 230 and 239 check before spawn, ready and every fresh chat connection. Guard failure stops the owner, with zero late spawn/ready/new-connection regressions. Native proof pending.
- C2.6 — final eight-file controlled run, eight syntax checks, typecheck, export and whitespace PASS. Independent verifier/browser/native gates intentionally remain open; no whole-WP or model-quality claim.

### browser_manual_test_hooks
Use the already-exported `personal-co/dist` as the existing host's trusted webRoot with fresh synthetic roots and a controlled makeSession/peer fixture patterned after the direct composed test, never real provider state. The private host launchUrl supplies the capability fragment; do not log/share it. Check desktop and 390 px narrow layouts with accessible labels: 新会话标题（可选）, 创建已保留会话, 消息草稿, 发送并保留, 查询操作状态, 查找已有创建结果（不新建）, 打开已完成会话, 预览可选记忆, 保留草稿，继续连接, 确认断开并清除本页. Exercise late response after switching/editing, UNKNOWN without resend, pending recovery on reopening, context checkbox limits, read-only mode, and keyboard navigation. No separate app/service or persistent browser fixture was created by the author.

### frozen_sha256
| Path | SHA256 |
| --- | --- |
| `personal-co/server/local-read-host.mjs` | 45de09b6ee197df64c7f90d47a750dbd59d6e4b299c2ff17882caa835d8b65c6 |
| `personal-co/server/local-read-cli.mjs` | 8e5bfc7392f3428ee2bc0e82b59ef9fb745dd550cd773d84f4430f95f80e07c8 |
| `personal-co/server/managed-read-session.mjs` | b38a9c26f9b1e9b5dd20ffc372ccfc55b099fa4f03efa6a537ee70bb5414f815 |
| `personal-co/server/local-chat-operations.mjs` | 0ae718e7036782d22013618590b5f6afeddc2775a9188d7c9067bef9abe78779 |
| `personal-co/server/conversation-reader.mjs` | 6a485446dd2c6874efa18ccc0d2257c29a6f559bcd3eade15738b69132ebc264 |
| `personal-co/src/services/local-read-client.mjs` | 6ffacf943995d837774958d1b3e8648c532a2158775bcfae92000e6111fd0de6 |
| `personal-co/src/components/LocalAssistant.tsx` | c1325307b491e0e1c73e0fe00b5a41b0d1f97dc4ecf3aeb970ebabc63af487e7 |
| `personal-co/README.md` | 27906465413a98b6475c0dfa9d7e96e8aa326e69f8a62c343c3ff7a15aa0adc3 |
| `personal-co/tests/local-read-host.test.mjs` | 11a00ce993f75a284c576eeeb02faa42ea35332f7cd35d14caba9f0e39c9d470 |
| `personal-co/tests/local-read-client.test.mjs` | ff3865516610c4539d192a24b3f39fe1ca3b3bdb2efb50f7682515ab120a7fea |
| `personal-co/tests/local-read-cli.test.mjs` | a6321fa90c7818cb5f7688ec13a1392bf256f25c65edaecd11cdf69d032d4d06 |
| `personal-co/tests/managed-read-session.test.mjs` | 2609e4f2dc5948b08d5de2379ae59304afe35eaff896a9bd6077b63f89bb78cc |
| `personal-co/tests/local-chat-operations.test.mjs` | 6c73e2447e99a3ed9c0ef1b931f25f36846b533cc9b18b00138bcb631525c837 |
| `personal-co/tests/conversation-reader.test.mjs` | 082a690f7a3437378110dc574ed98886d04f398c70a8d4e68c8e2d2bb5820621 |
| `personal-co/server/runtime-sandbox.mjs` | 26ba8c4e604810fb1397a9ca471a4ebc2c99cb5b535c210135f20d89fb85a647 |
| `personal-co/tests/runtime-sandbox.test.mjs` | e6daa6f77d75498ecc84112736d303d6c8e1f47f20cda757898116789ed52aa7 |
| `personal-co/server/assistant-bootstrap.mjs` | 4476daf5911cd8b49fcaa7c09676848d4887236f00c38bd0294804c2cdac84a5 |
| `personal-co/tests/assistant-bootstrap.test.mjs` | 6ce6038e93cc7a8801a588115aed1c7bd5819a9cbcdab550fd6cd6b709fe5553 |
