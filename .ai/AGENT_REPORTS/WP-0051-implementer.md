# WP0051 — segment A receipt store only

task_id: WP-0051-local-chat-integration

agent_role: implementer

status: PARTIAL

one_sentence_result: Segment A is implemented and its 12 targeted tests pass; this is NOT whole-WP acceptance, and independent verification plus existing host/UI integration remain outstanding.

files_read:
- `AGENTS.md`, `.ai/MASTER_CONTRACT.md`, `.ai/WORK_PACKAGES/WP-0051-local-chat-integration.yaml`, `.ai/AGENT_REPORTS/WP-0050-explorer.md`.
- `.agents/skills/direction-guide/SKILL.md` and `.agents/skills/direction-guide/references/tool-policy.md`; bounded packet takes precedence over the skill's master-wide memory reading/routing instructions.
- `personal-co/server/canonical-memory-store.mjs`, `assistant-bootstrap.mjs`; directly related excerpts of `authenticated-app-server.mjs`, `personal-co/tests/local-chat-turn-probe.test.mjs`, and targeted ID search of `personal-co/src/domain/app-server-memory-codec.mjs`.
- The two new scoped source/test files below.

files_changed:
- `personal-co/server/chat-operation-store.mjs`
- `personal-co/tests/chat-operation-store.test.mjs`
- `.ai/AGENT_REPORTS/WP-0051-implementer.md`

commands_run:
- `cat`, targeted `sed`/`rg`/`nl`/`wc`, scoped `git status`/`git diff`: read_only, packet source and exact changed paths, authorized, PASS. No private runtime state or credentials read.
- `apply_patch`: workspace_write, the three exact reserved files only, authorized, PASS. No dependencies, config, canonical/native/browser changes, deletion, commit or push.
- `node --version`: read_only, runtime diagnostic, PASS (`v24.15.0`).
- `node --test personal-co/tests/chat-operation-store.test.mjs`: authorized local validation with retained fresh external:/private/tmp/personal-co-wp0051-* synthetic fixtures and owned Node child processes; PASS on all three runs (12/12), no native runtime, provider, or network. Process race has bounded readiness/exit deadlines and finally terminates only its own still-live child handles.
- `node --check personal-co/server/chat-operation-store.mjs`: read_only validation, PASS.
- `git diff --check`: read_only validation, PASS. New file syntax/test checks separately cover untracked source.

tests_run:
- Targeted suite: 12 PASS, 0 FAIL. Covers create/send completion and reopen, immutable exact duplicates, conflicts, two separate processes racing one reservation, global unknown exclusion, abrupt process exit, lost post-COMMIT fsync acknowledgement, terminal/failure consistency, hostile descriptors/proxies/IDs/byte bounds, permissions/symlinks/hardlinks/sidecars, foreign Agent/schema/version/data, 10,000-record cap, sanitized errors and poisoned handles.
- Syntax check and whitespace check: PASS.
- Not run: broad suites, native/provider/browser execution, and independent verification (master's next gate). Power-loss hardware behavior is not simulated.

evidence:
- `personal-co/server/chat-operation-store.mjs` line1: standard-library-only SQLite implementation; exact schema/version/Agent binding, read-only existing-database inspection before writable settings, extension disabled, trusted schema off, bounded lock waiting, FULL sync and page-size-derived 256 MiB database ceiling.
- `personal-co/server/chat-operation-store.mjs` line29: exact descriptor validation rejects getters/toJSON/proxies before reading values; entity IDs and canonical operation UUIDs; native assistant/reasoning message suffixes accepted (tool IDs excluded).
- `personal-co/server/chat-operation-store.mjs` line161: owned canonical 0700 root and regular single-link owned 0600 fixed database/sidecar checks, transaction handling, no adoption/migration/pruning, poison on unexpected write uncertainty.
- `personal-co/tests/chat-operation-store.test.mjs` line1: executable evidence for all scoped behavior, including genuine process concurrency rather than sequential-handle-only claims.

risks:
- Entire WP0051 remains incomplete: no existing host/browser integration or real-provider quality claim. Segment is not independently verified yet.
- Trusted host must validate bootstrap's exact stateRoot/protectedRoot/Agent binding before opening, correlate terminal evidence, verify persisted roles/content/input/run/conversation, and serialize Agent mutations. Store assertions are not externally callable authority.
- Private directory checks do not defend against an actively malicious same-uid writer. SQLite durability remains bounded by OS/filesystem/hardware guarantees. If a reserve transaction rolls back, no permission was returned; an acknowledged or uncertain committed reservation remains unknown and cannot replay. Exceptions must never trigger dispatch.
- Store intentionally has no pruning/recovery/retry API. Failed and completed IDs never reauthorize; unresolved unknown blocks new work. Test fixtures are retained as required. SQLite itself manages its exact journal lifecycle.

assumptions:
- Existing Node24 built-in SQLite is the runtime baseline; no dependency is added.
- Retained text/title is ordinary conversation data, not temporary/private mode. Error is the existing reducer's boolean error presence, never a raw native payload.
- Parent owns project memory, integration, verification routing and all other files; this writer owns only the exact three files above.

recommended_next_action: Independently verify segment A, then consume its narrow API from the existing governed host/UI. Do not mark whole WP0051 accepted based on these tests.

child_agent_requests: none

child_report_bundle: none

implementation_notes:
- `openChatOperationStore({directory,agentId})` is synchronous; returns frozen methods. Host-only optional `{io}` second argument supports deterministic filesystem fault testing.
- `reserve({operationId,kind:'create',title})` or `reserve({operationId,kind:'send',conversationId,text})` returns `{record,dispatchAllowed}`. Only first successful durable insertion returns true. Record includes frozen `request`, `agentId`, `status`, nullable `terminal`/`completion`/`failure`, plus create `operationTag` or send `clientMessageId` (operation UUID).
- `get(operationId)` returns record or null; `listPending()` returns at most one unknown record. To recover displayed original text for native client_message_id, use get(UUID) and check exact stored conversationId first.
- `recordTerminal({operationId,runId,turnId,stopReason,error:boolean})` persists exact correlated evidence without marking completed.
- `completeCreate({operationId,conversationId,operationTag})` requires exact generated marker. `completeSend({operationId,conversationId,userMessageId,assistantMessageIds})` requires successful recorded end_turn, same conversation, and 1–64 unique host-validated persisted assistant IDs.
- `recordFailure({operationId,source:'predispatch'|'terminal'})` settles only trusted no-dispatch rejection or previously recorded unsuccessful terminal. All settlement repeats require exact evidence; conflicting settlement fails. `close()` is idempotent.
- Bounds: 16 KiB original text, 256-byte title, 114,688-byte serialized record (accounts for escaping), 10,000 records, 256 MiB database and separately bounded sidecars. Maximum page count derives from actual SQLite page size.
