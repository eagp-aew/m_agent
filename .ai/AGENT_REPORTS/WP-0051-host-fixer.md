# WP0051 host bounded repair — verified author checks, independent review pending

## task_id
WP-0051-local-chat-integration

## agent_role
fixer

## status
PASS — current third bounded repair passes 60 focused tests, syntax/typecheck/whitespace. See the appended current repair report and current hashes; earlier attempts and hashes remain historical evidence. Independent verification remains mandatory; no segment or full-WP acceptance claimed.

## one_sentence_result
Reader-invalid projections now remain unknown, and completion requires a bounded clean close handshake that continues validating late channel frames before durable settlement.

## files_read
- `AGENTS.md`, `.ai/MASTER_CONTRACT.md`, `.ai/WORK_PACKAGES/WP-0051-local-chat-integration.yaml`, `.ai/AGENT_REPORTS/WP-0051-host-verifier.md`, `.ai/AGENT_REPORTS/WP-0051-host-implementer.md`.
- `.agents/skills/direction-guide/SKILL.md` and its required tool-policy, verification-gate, failure-signatures and context-profiles references; relevant `.ai/TEST_MATRIX.md` search. Prior unchanged instructions/store reading reused.
- `personal-co/server/local-chat-channel.mjs`, `personal-co/server/local-chat-operations.mjs`, `personal-co/tests/local-chat-channel.test.mjs`, `personal-co/tests/local-chat-operations.test.mjs`.
- Directly relevant `personal-co/server/authenticated-app-server.mjs`, `personal-co/server/managed-read-session.mjs`, `personal-co/server/conversation-reader.mjs`; previously read unchanged `personal-co/server/chat-operation-store.mjs`.
- Second-attempt source diagnosis read only installed WebSocket close/receiver excerpts in `personal-co/server/node_modules/ws/lib/websocket.js` and `personal-co/server/node_modules/ws/lib/receiver.js`, explicitly requested by master; no dependency edits or native bundle reads.

## files_changed
- `personal-co/server/local-chat-channel.mjs`
- `personal-co/server/local-chat-operations.mjs`
- `personal-co/tests/local-chat-channel.test.mjs`
- `personal-co/tests/local-chat-operations.test.mjs`
- `.ai/AGENT_REPORTS/WP-0051-host-fixer.md`

## commands_run
- read_only, packet-scoped `sed`, `wc`, `rg`, `shasum -a 256`: inspected source/contracts and verified all four starting hashes against author evidence. Initial combined output was partially truncated; missing contract/verifier portions were read in the next bounded call.
- workspace_write, standing-authorized exact reservations: `apply_patch` added regression tests first, then one product repair and this report. No other product or memory writes.
- controlled validation/workspace_write, explicitly authorized fresh synthetic private fixtures and local WebSocket peers: `node --test personal-co/tests/local-chat-channel.test.mjs personal-co/tests/local-chat-operations.test.mjs`, twice. First expected regression FAIL, second repair FAIL as detailed below. Fixtures retained; no native/model/provider launch or manual deletion.
- read_only `git diff --check`: PASS. New four product/test paths remain pre-existing untracked author files; this check alone does not audit their content delta.
- Not run: related 81-test command, syntax and typecheck. Targeted repair failed and packet allows only one bounded repair cycle; stopped instead of representing broader validation as acceptance.
- Historical not-run note above applies only to the first attempt. Master subsequently authorized a changed second bounded approach in the same four files, with no scope expansion. `apply_patch` added seal/timeout tests before implementation, then a bounded graceful close barrier.
- Second regression-first controlled validation: `node --test --test-reporter=dot personal-co/tests/local-chat-channel.test.mjs personal-co/tests/local-chat-operations.test.mjs` — FAIL as expected: three missing seal contract tests, two timing-sensitive existing post-response cases and composed unanswered-close case failed. Existing synchronous health alone was demonstrably insufficient; no weakened expectations.
- Final controlled validation: `node --test personal-co/tests/local-chat-channel.test.mjs personal-co/tests/local-chat-operations.test.mjs` — 55 PASS, zero failures/skips.
- Final related controlled validation: `WP0045_RUN_NATIVE=0 WP0047_RUN_NATIVE=0 WP0048_RUN_NATIVE=0 node --test personal-co/tests/authenticated-app-server.test.mjs personal-co/tests/managed-read-session.test.mjs personal-co/tests/runtime-sandbox.test.mjs personal-co/tests/chat-operation-store.test.mjs personal-co/tests/assistant-bootstrap.test.mjs` — 78 PASS, 3 explicitly skipped native tests, zero failures.
- Final read_only validation: `node --check personal-co/server/local-chat-channel.mjs`; `node --check personal-co/server/local-chat-operations.mjs`; `cd personal-co && npm run typecheck`; `git diff --check`; final four-file SHA256 — all PASS. No native/provider/browser/full-suite execution.

## tests_run
- Regression-first: 51 tests, 34 PASS / 17 FAIL. Original 30 pass. New real composed F1 tests reproduce all three final-response defects; 10 reader-invalid cases reproduce completion; 4 channel lifecycle contract tests fail before the new health/failure surface exists. Empty/attachment-only controls and two valid-boundary controls pass.
- After repair: 51 tests, 49 PASS / 2 FAIL. Authority-after-final-response now rejects; conflicting terminal and shared-run after final response still complete. All 12 invalid-display cases reject/stop with UNKNOWN; both valid 65536-character boundary cases complete and successfully traverse actual reader projection, including attachment omission. Channel abnormal close/timeout/authority notification and intentional-close controls pass.
- No skipped/native/provider/browser cases were represented as proof. No unhandled rejection reported by the targeted runner.
- Final revised approach: 55/55 focused tests PASS, including late conflicting terminal/shared-run/authority, actual managed process stop with unknown durable receipts and no redispatch, unanswered actual-WS close handshake, simulated clean/late-fault/timeout close handshakes, repeated cleanup, valid boundary/attachment projection through the unchanged reader, and all original 30 cases. Related suite adds 78 PASS/3 native SKIP. Total final executed checks: 133 PASS, 3 explicitly skipped native tests.

## evidence
- First-cycle source adds a persistent non-rejecting abnormal-failure promise and synchronous channel-health assertion, distinguishing normal caller close. Operations observes failure through its existing stop hook, checks health immediately before durable terminal/completion/predispatch settlement, and avoids awaiting owner cleanup from the task being drained.
- New visible-text validation checks the reader's 128-part, 65536-character per-text/aggregate and bounded valid-date contract only on newly observed user/assistant rows. Original final user-text/OTID correlation remains unchanged; valid non-text assistant attachments are omitted, never counted as visible reply text.
- Remaining concrete failure: `channel failure post-read-terminal after final response cannot settle durable completion` and equivalent `post-read-shared-run` both return a completed receipt instead of null/stopped session. Fresh examples retained at external:/private/tmp/personal-co-wp0051-composed-5QKWYm and external:/private/tmp/personal-co-wp0051-composed-ujjG6D. No old fixture contents read.
- Likely race from inspected execution order: actual network frames may arrive after final RPC continuation, while intentional close marks the channel dead immediately and ignores pending inbound messages. A synchronous health check catches already-observed poisoning, not future/late received frames. This is diagnosis, not a verified repaired barrier.
- The two preceding bullets describe preserved first-cycle evidence, not the final result. Master independently corroborated that race and authorized a second approach rather than another health-check-only retry.
- Final repair uses a host-private named `seal()` plus `assertSealed()`. It sends WebSocket close code 1000, retains frame validation until the clean code-1000 close event, and enforces a 1000ms deadline. Abnormal events/close/timeout still resolve the persistent failure signal and force termination; cleanup remains idempotent. No sleep/quiescence guess, extra RPC, or new external API is introduced.
- Existing successful correlated terminal is durably recorded before history readback. Create, send, and create-recovery completion now await the seal, check owner lifetime plus sealed state synchronously, then write completion. A failed seal cannot fabricate completed status, while later ordinary cleanup never rewrites a genuine completed receipt.
- Final actual-WS regression fixture examples: late authority external:/private/tmp/personal-co-wp0051-composed-bYrRyD; late terminal external:/private/tmp/personal-co-wp0051-composed-ruJ5Av; shared run external:/private/tmp/personal-co-wp0051-composed-QBRwEn; unanswered close external:/private/tmp/personal-co-wp0051-composed-wzTLKD. All retained; no old-state reads or repair.

## risks
Final controlled regressions address F1/F2, but independent verification is still required before acceptance/delivery. Full UI/context/provider/native validation remains outside this segment. The unchanged trust model assumes host-controlled same-UID roots. Reader-bound validation intentionally does not scan historical content outside the observed new interval. A clean channel-close handshake bounds observed channel evidence, not backend exactly-once execution or real-provider quality. Future reader-contract changes must keep the small local validation aligned.

## assumptions
Packet validated complete; master owns work package/memory and sole fixer owns only four reserved product/test paths. Direction-guide enforced regression-first evidence, the initial one-cycle stop, and preserved failure history before the master authorized a changed second attempt. Controlled peers and process seams are not native safety or real-provider proof.

## recommended_next_action
Independently verify the final frozen four hashes, all B1–B6 constraints and original F1/F2 recipes. Master owns memory, integration and later full-WP work. Do not infer native/provider/UI approval or full-WP acceptance from scoped fixer PASS.

## child_agent_requests
[]

## child_report_bundle
[]

## root_cause
F1 resolves RPCs independently from persistent connection health, and late transport events can arrive after the completion continuation. F2 previously accepted any nonempty text without enforcing the existing reader's display contract.

## verifier_evidence_addressed
Yes, final actual composed controlled-peer regressions reject all three F1 frames and both original F2 invalid projections, plus adjacent date/part/aggregate/reminder cases. First attempt remained incomplete and is preserved as history. No independent acceptance claimed.

## frozen_first_cycle_hashes

| Path | SHA256 |
|---|---|
| `personal-co/server/local-chat-channel.mjs` | 9b9097d890a9d294da5931c6f61c1e8b12ea423b3893873cef33d5c02a35cb01 |
| `personal-co/server/local-chat-operations.mjs` | c9df7d095a668c92c1b785c3bcb221cba97166f36770956ffd6be47db19bf02a |
| `personal-co/tests/local-chat-channel.test.mjs` | f7dc61c9a0e472ad1a842f79baa18e43d71aa92ea4ebefce26ee19c9e96e4b7b |
| `personal-co/tests/local-chat-operations.test.mjs` | a06ae77f52d6ba086fc7080326bc98badfefada44a8a1e8033bd7598fb133331 |

## historical_second_attempt_frozen_hashes

| Path | SHA256 |
|---|---|
| `personal-co/server/local-chat-channel.mjs` | 9d875d9083d5766aee8be1d438bf40ff732d62077c85726277f2d7b6be379275 |
| `personal-co/server/local-chat-operations.mjs` | 4348b9271f03ab3ee60698d0e8bab2f1f08f7b60ecd78c020096a60eefebafed |
| `personal-co/tests/local-chat-channel.test.mjs` | 6fba4849c5878c92320dfde5de0e357d05dc56d9a4bf776da79baf891c2b4995 |
| `personal-co/tests/local-chat-operations.test.mjs` | 5955263c3167d265202c8b2a288c2ed57ea87a7079c956781439acd82413a14f |

No changes to auth, managed lifecycle, bootstrap, sandbox, receipt store, reader, UI, CLI, HTTP or manifests; no installation, manual deletion, Git mutation, native/model/provider launch, private data reads or child agents. All prior unrelated changes preserved.

## Current third bounded repair: common row message type

task_id: WP-0051-local-chat-integration
agent_role: fixer
status: PASS — scoped fixer validation only; independent acceptance pending.
one_sentence_result: Every bounded history page now enforces the existing reader's message_type string/128-character contract before role filtering; all 60 focused tests pass.
files_read: Current host_repair_3 in `.ai/WORK_PACKAGES/WP-0051-local-chat-integration.yaml`; appended reverify2 in `.ai/AGENT_REPORTS/WP-0051-host-verifier.md`; `personal-co/server/local-chat-operations.mjs`; `personal-co/tests/local-chat-operations.test.mjs`; common envelope contract in `personal-co/server/conversation-reader.mjs`; this report. Unchanged prior AGENTS/master/skill readings reused; channel source/test were hashed only.
files_changed: Only `personal-co/server/local-chat-operations.mjs`, `personal-co/tests/local-chat-operations.test.mjs`, and `.ai/AGENT_REPORTS/WP-0051-host-fixer.md` in this attempt.
commands_run:
- read_only, packet scope: rg/sed/tail/git status/shasum inspected the concrete failure, current source and frozen hashes; PASS.
- workspace_write, standing-authorized exact files: apply_patch added five regression/control cases before one source predicate change and appended this report; PASS.
- controlled validation, fresh retained synthetic WebSocket/SQLite fixtures: `node --test --test-name-pattern='common row message_type' personal-co/tests/local-chat-operations.test.mjs`; expected FAIL before source change, 1 PASS / 4 FAIL.
- controlled validation: `node --test personal-co/tests/local-chat-channel.test.mjs personal-co/tests/local-chat-operations.test.mjs`; final 60 PASS, zero failures/skips.
- read_only validation: `node --check personal-co/server/local-chat-operations.mjs`, `cd personal-co && npm run typecheck`, `git diff --check`, four-file SHA256; PASS. New product files remain untracked author files, so git diff whitespace alone is not claimed as complete product-delta inspection.
tests_run: Null, missing, numeric and 129-character message_type on an otherwise valid owned row between user/reply each completed before repair and now stops the owner, retains UNKNOWN, and denies repeat dispatch from the reopened actual store. A 128-character unknown internal type still completes and is omitted by actual session.listMessages even with null content and invalid date, matching the reader's deliberate internal-row omission. All prior 55 channel/operations cases remain green.
evidence: Independent reverify2 supplied concrete completed/read-failed evidence; new named regressions reproduce it before the single predicate repair. Fresh failing null fixture external:/private/tmp/personal-co-wp0051-composed-VGWnWZ; repaired null fixture external:/private/tmp/personal-co-wp0051-composed-Hef0vc; valid internal-type omission fixture external:/private/tmp/personal-co-wp0051-composed-kZgPIr. No previous fixture was read. Prior two attempts and validation remain preserved above.
risks: Independent verification still required; native/provider/UI/full-WP acceptance is not implied. No historical full-history scan or newly imposed validation of ignored internal date/content. Prior 78 related PASS / 3 native SKIP evidence is explicitly reused, not rerun in this attempt because those products and channel files are unchanged.
assumptions: Packet complete; only independently verified common-row type gap is in scope. Existing reader contract admits any string of length at most 128 before omission; no new message-type enum was invented. Standing authority permits this diagnosed bounded repair without waiving verification.
recommended_next_action: Independently verify current operations/test hashes and the new type-gap recipe while confirming preserved channel hashes and original F1/F2 behavior.
child_agent_requests: []
child_report_bundle: []
root_cause: Operations validated visible user/reply content but omitted the common message_type shape check required for all reader rows, including omitted internal rows.
verifier_evidence_addressed: Yes in regression-first composed tests; independent verification remains pending.

### Exact third-attempt source delta

```diff
-  check(rows.every(row => messageId(row?.id) && row.agent_id === agentId && row.conversation_id === conversationId)
+  check(rows.every(row => messageId(row?.id) && row.agent_id === agentId && row.conversation_id === conversationId
+    && typeof row.message_type === 'string' && row.message_type.length <= 128)
```

Tests add only the five named common-row message_type cases immediately before the existing reader-valid boundary cases. No other existing test or source logic changed in this attempt.

### Current frozen hashes

| Path | SHA256 |
|---|---|
| `personal-co/server/local-chat-operations.mjs` | 3c2db7e1fc6ff775d4223bd2c97fa0760c3dc12ba95e9a9fb2638cfeb6f5bc0e |
| `personal-co/tests/local-chat-operations.test.mjs` | 2f14b4260557a475236a159f50570488b00dbd047e5fd3ef0b4b8981d5f455e9 |
| `personal-co/server/local-chat-channel.mjs` unchanged | 9d875d9083d5766aee8be1d438bf40ff732d62077c85726277f2d7b6be379275 |
| `personal-co/tests/local-chat-channel.test.mjs` unchanged | 6fba4849c5878c92320dfde5de0e357d05dc56d9a4bf776da79baf891c2b4995 |
