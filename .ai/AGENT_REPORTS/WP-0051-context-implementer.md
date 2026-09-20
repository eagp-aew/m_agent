# WP-0051 C1 context implementation

## task_id
WP-0051-local-chat-integration

## agent_role
implementer (wp0051-context-implementer)

## status
PASS — scoped author validation only; independent verification pending. This is not acceptance of the whole WP or browser/native-provider enablement.

## one_sentence_result
The existing managed chat now consumes validated canonical-memory previews and explicit, receipt-bound, one-message context selections, with bounded host-built projection, predispatch freshness checks, protected-policy reset, and fail-closed owner handling.

## files_read
- `AGENTS.md`, `.ai/MASTER_CONTRACT.md`, `.ai/WORK_PACKAGES/WP-0051-local-chat-integration.yaml`, `.agents/skills/direction-guide/SKILL.md` and its applicable role/tool/context references; unchanged earlier instruction readings reused as permitted.
- The twelve product/test paths listed under files_changed, plus `personal-co/server/canonical-memory-store.mjs`, `personal-co/src/domain/app-server-memory-codec.mjs`, `personal-co/src/domain/memory.mjs`, `personal-co/src/domain/policy.mjs`, `personal-co/src/domain/imports.mjs`, `personal-co/src/domain/changes.mjs`, and `personal-co/src/domain/snapshot.mjs` for existing privacy, codec, and metadata conventions.
- Accepted Segment B source and relevant report context were reused; no native bundle, private user state, credentials, network sources, or unrelated history was read for C1.

## files_changed
- `personal-co/server/local-chat-context.mjs` — new bounded preview, selection capture, candidate eligibility, and host-only projection branding.
- `personal-co/server/assistant-bootstrap.mjs` — validated owner-bound current canonical read capability, exact-byte digest, and read draining.
- `personal-co/server/chat-operation-store.mjs` — optional immutable send-context descriptor in existing durable request equality; schema unchanged.
- `personal-co/server/local-chat-channel.mjs` — branded projection admission and protected-policy reset/readback before sealing.
- `personal-co/server/local-chat-operations.mjs` — actual preview/preflight/projection/reset integration and lifecycle handling.
- `personal-co/server/managed-read-session.mjs` — actual bootstrap capability wiring and host-private chat.previewContext.
- `personal-co/tests/local-chat-context.test.mjs` — new helper/selection/privacy/bounds regressions.
- `personal-co/tests/assistant-bootstrap.test.mjs` — canonical integrity, exact bytes, BOM, lifecycle, and cleanup uncertainty regressions.
- `personal-co/tests/chat-operation-store.test.mjs` — context capture, replay equality, reopen, and hostile-object regressions.
- `personal-co/tests/local-chat-channel.test.mjs` — projection authority and ordered reset regressions.
- `personal-co/tests/local-chat-operations.test.mjs` — composed real bootstrap/SQLite/controlled authenticated channel context flows and adverse cases.
- `personal-co/tests/managed-read-session.test.mjs` — exact exposed host chat capability contract.
- `.ai/AGENT_REPORTS/WP-0051-context-implementer.md` — this report only. Other agents' metadata and unrelated dirty files were preserved.

## commands_run
- Read-only scoped inspection: bounded source/test/WP reads, scoped git diff/status, source line lookup, and SHA256 collection — PASS.
- Author refinement reproduction: inline Node compared BOM-prefixed codec input under TextDecoder ignoreBOM false/true; default decoder accepted while canonical-store-compatible decoder rejected. Bootstrap now uses the canonical store's fatal, BOM-preserving decoding; whitespace is the positive exact-byte control and BOM is a negative control. This was an author-stage refinement, not an independent verifier round.
- Targeted tests: `node --test personal-co/tests/local-chat-context.test.mjs personal-co/tests/chat-operation-store.test.mjs` — 25 PASS.
- Targeted tests: `node --test personal-co/tests/local-chat-channel.test.mjs personal-co/tests/local-chat-operations.test.mjs` — 71 PASS.
- Related bootstrap/managed tests — 36 PASS, 2 native SKIP; targeted canonical/BOM regressions also PASS.
- Final required test scope: `WP0045_RUN_NATIVE=0 WP0047_RUN_NATIVE=0 WP0048_RUN_NATIVE=0 node --test personal-co/tests/local-chat-context.test.mjs personal-co/tests/chat-operation-store.test.mjs personal-co/tests/local-chat-channel.test.mjs personal-co/tests/local-chat-operations.test.mjs personal-co/tests/assistant-bootstrap.test.mjs personal-co/tests/managed-read-session.test.mjs` — exit 0; 134 tests, 132 PASS, 2 SKIP, 0 failures.
- Syntax: node --check for all six changed server modules — PASS.
- Typecheck: `cd personal-co && npm run typecheck` — exit 0, PASS.
- Whitespace: `git diff --check` — PASS.
- No native runtime/provider launch, browser/HTTP enablement, dependency installation, schema migration, deletion, child agent, or Git mutation was performed.

## tests_run
The final six-file run covers all original tests in scope plus new context filtering and bounds, descriptor/proxy safety, immutable durable receipt equality and reopen, raw-byte staleness, canonical owner/policy/binding corruption, drain/close behavior, exact projection and original user input, subsequent contextless fixed policy, successful reset ordering, lost/mismatched reset, and cancellation during reset. Controlled peers and fresh synthetic retained fixtures only; native execution explicitly disabled.

## evidence
- C1.1: `personal-co/server/assistant-bootstrap.mjs` lines 164 and 235 validate exact memory identities/policy/binding and expose readMemory only after successful resolve; private bounded reads, owner/intent rechecks, exact-byte SHA256, and close draining are exercised. Integrity failures are not treated as healthy recoverable user validation errors.
- C1.2: `personal-co/server/local-chat-context.mjs` line 98 provides deterministic bounded preview over only writable blocks and eligible Archive paragraphs. Clear existing metadata conventions are supported without forwarding metadata. Excluded, superseded, expired, malformed-expiry, blank, placeholder, and oversized entries cannot be admitted. Unknown/conflicting epistemic labels remain unknown. Query defaults only when absent; explicit null/undefined reject.
- C1.3: `personal-co/server/local-chat-context.mjs` line 26 and `personal-co/server/chat-operation-store.mjs` line 70 capture the exact optional revision/digest/items shape without getters, proxies, sparse arrays, or toJSON execution. It participates in durable equality/reopen with schema 1 unchanged; absent context preserves the old request shape.
- C1.4: `personal-co/server/local-chat-operations.mjs` lines 104–115 reads fresh canonical data before opening a channel or mutating native state. `personal-co/server/local-chat-context.mjs` line 111 validates exact Agent/revision/full-file digest and candidate eligibility with four-item, 8192-byte selected-text, and 16384-byte final-system caps. Stale/invalid selections become known predispatch failures without native mutation; canonical corruption also stops the owner.
- C1.5: `personal-co/server/local-chat-channel.mjs` lines 153 and 162 accepts only host-branded projections and resets/readbacks protected SYSTEM_PROMPT after successful correlated terminal/history proof. `personal-co/server/local-chat-operations.mjs` line 176 performs this before sealing/completion. Composed fixtures verify original input text, unchanged canonical memory, no selected plaintext in receipts, fixed-policy subsequent contextless send, and UNKNOWN plus owner stop on reset loss/mismatch/cancellation.
- C1.6: `personal-co/server/managed-read-session.mjs` lines 223 and 245 wires real preparation.readMemory into real operations and exposes chat.previewContext; `personal-co/server/local-chat-operations.mjs` line 202 implements the actual host method. No HTTP/UI path was added.
- Retained synthetic evidence fixtures include external:/private/tmp/personal-co-wp0051-composed-OhNrv3, external:/private/tmp/personal-co-wp0048-unit-V6p2sM, and external:/private/tmp/personal-co-wp0048-unit-yLP8Ow. No fixture deletion was performed.

## risks
- Independent verification is still required. Native/provider behavior and real model instruction adherence were not exercised; browser/UI admission remains disabled pending later work.
- Reset verifies the current Agent system field, not erasure of native caches/history. Abnormal exit can retain derived context in native state; no cache-erasure guarantee is claimed.
- A same-UID cooperating canonical writer and the bootstrapped session owner are assumed. The fresh read and later native dispatch are not one cross-system atomic transaction.
- Explicit per-message selection is not automatic retrieval, automatic supersession, or proof that baseline freeform statements are current. Epistemic labels remain evidence labels, not promoted authority.
- Eligibility intentionally recognizes only bounded existing metadata/tag conventions. Unrecognized root extensions or metadata are not forwarded; malformed recognized expiry fields fail closed.

## assumptions
- Existing authenticated-channel capability ownership, single-operation reservation, bootstrap lock, receipt lifecycle, strict runtime/input settings, and independent Segment B fixes remain the foundation.
- A contextless send intentionally prepares the fixed protected policy before input, clearing a prior derived system field; successful contextual sends reset that field before completion.
- The direction-guide skill governed exact scope, scoped validation, report evidence, and independent handoff; no extra orchestration or product scope was introduced.

## recommended_next_action
Run independent C1 verification against the frozen twelve paths below. Keep all HTTP/UI/native-provider enablement closed until its separately packaged admission work passes. Main owns metadata integration and any accepted commits.

## child_agent_requests
[]

## child_report_bundle
[]

## implementation_notes
Frozen SHA256 values (product edits stopped after this validation):

| Path | SHA256 |
| --- | --- |
| `personal-co/server/local-chat-context.mjs` | abb1e6726edbcb8d749408532fc93d3581320b0c9eb366e03e252e5371d35665 |
| `personal-co/tests/local-chat-context.test.mjs` | 0dd8c2b60c08acb1f0bb5ae48af7e5c5e4a07fabbdebae0d9ce23c00aab36822 |
| `personal-co/server/assistant-bootstrap.mjs` | 2eb93ca8b32c403640fe4a602cf6fc10e26cecc29cb080f390bc447c40fed261 |
| `personal-co/tests/assistant-bootstrap.test.mjs` | 8da239a9cb66eb567bc3828a5a7e56a9f813d84ec853cc614522a337c891649a |
| `personal-co/server/chat-operation-store.mjs` | 75f2508276b2e234500f4508d8f4e3137ec4feca98014db95810c373c183a3a9 |
| `personal-co/tests/chat-operation-store.test.mjs` | 7fac4148259cf5f85c4c2b2d418e169ea7e56244e24d66519b305f8a6d4784d1 |
| `personal-co/server/local-chat-channel.mjs` | 1f86c60026c0233db79e6c546e96a0a7c6da029f071fb4cd18b6f6952ca6066e |
| `personal-co/tests/local-chat-channel.test.mjs` | c6eba0c72b77cf67cec01e819d58ada009e9791d28c754997ca692a1104149aa |
| `personal-co/server/local-chat-operations.mjs` | c857edbde8265ed92dd5df9f5924279ddb4d0f147bfa79bde5e5e6fd0f8db3ab |
| `personal-co/tests/local-chat-operations.test.mjs` | acb1cb707d5782afd1a2394bba2c73b6e1edfe431139d450511c3e96e6a4de1f |
| `personal-co/server/managed-read-session.mjs` | 88684c230c4ec2514d2cdcc7349fad8ad74ed6a0a41f4e3a51206355d55e147c |
| `personal-co/tests/managed-read-session.test.mjs` | bc79af0d7ecbc8d8137f20ee223cbcb7bf4618b62100e7634f3417c61a6bd82e |
