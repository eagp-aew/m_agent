# WP-0051 D provider-arm repair

## 2026-09-25 guarded catalog consistency repair (current; historical reports below)

- task_id: WP-0051-local-chat-integration
- agent_role: fixer
- status: PASS (scoped offline repair only; independent verification/native clearance pending)
- one_sentence_result: Replaced the single forced discovery snapshot with at most two guarded, awaited forced-then-settled reads, preserving fail-closed admission and immutable defaults.
- files_read: AGENTS.md; .ai/MASTER_CONTRACT.md; active repair fields/checklist in .ai/WORK_PACKAGES/WP-0051-local-chat-integration.yaml; latest diagnosis/design in .ai/AGENT_REPORTS/WP-0051-native-verifier.md; this historical report; direction-guide SKILL and tool-policy/context-profiles references; complete four changed JS files; relevant local-chat-operations, managed-read-session and authenticated-app-server ownership/callers. Pinned untrusted source at runtime:/private/tmp/personal-co-wp0051-runtime.HrHwow/node_modules (scope @letta-ai, package letta-code, letta.js): cache90115–90290, response397390–397420, headless422289–422375/445076–445160, TUI514580–514605 and exact prefetch/initialization callsite search. No private records or native fixtures read.
- files_changed: personal-co/server/local-chat-channel.mjs; personal-co/tests/local-chat-channel.test.mjs; personal-co/tests/local-chat-operations.test.mjs; personal-co/tests/local-chat-integration.test.mjs; this report. Preserved all pre-existing dirty changes; operations production source unchanged.
- commands_run:
  - read_only, packet-approved: scoped rg/sed/cat/wc, git status/diff, SHA256 checks; completed.
  - workspace_write, exact reservation: apply_patch regressions first, channel/observer repair, coverage and report; completed.
  - network_or_escalated, authorized synthetic numeric-loopback tests only, no escalation: `env -u WP0051_RUN_NATIVE -u WP0051_REVIEW_ONLY -u WP0051_RUN_CATALOG_DIAGNOSTIC node --test --test-name-pattern='^(cold catalog|catalog defaults)' personal-co/tests/local-chat-channel.test.mjs`; expected RED.
  - network_or_escalated, same scope: `env -u WP0051_RUN_NATIVE -u WP0051_REVIEW_ONLY -u WP0051_RUN_CATALOG_DIAGNOSTIC node --test personal-co/tests/local-chat-channel.test.mjs personal-co/tests/local-chat-operations.test.mjs personal-co/tests/local-chat-integration.test.mjs`; GREEN.
  - read_only: node --check on all four changed JS files; `npm run typecheck` in personal-co; `git diff --check`; PASS.
  - read_only: `WP0051_REVIEW_ONLY=1 node personal-co/tests/local-chat-integration.test.mjs`, output reduced to hash/count; PASS. No native execution, installation, external network, deletion, Git mutation, or unrelated suite.
- tests_run: RED 3/3 failed before repair (cold read never reached second response; warm controls exposed one-call behavior). GREEN 164 PASS, 0 FAIL, 2 native SKIP, 166 total. Syntax/typecheck/whitespace PASS. Existing receipt/reset/recovery/provider controls preserved; synthetic fixtures retained and owned test resources closed.
- evidence: Cold delayed channel/composed operations succeed only after second response; first malformed/null stops immediately; all original schema cases run at both phases; final unavailable/drift/conflict rejects. Both-phase transport/deadline/abort stops owner without UUID redispatch. Observer enforces two sequential distinct correlations and true/false order, rejects overlap/duplicate/reordered/extra evidence, freezes sanitized phase projections, and preserves exact forwarding and bounds.
  - Channel SHA256: e9262897a5765427d9a75ad793cee73388f5e260e1ae747300a078a5650e12b3.
  - Channel-test: 6027179a57d598372aa21ce593c01843b8cd49112d91a8d5977b59c2ee5e05b2.
  - Operations-test: 74028a0acda0b147adbf43063535ff80335d34ee54697a993b623077091ed666.
  - Integration-test: b387defa112ffcd4e7c24ed368d592f2d3a8e060908019f1c660f6edf71dad69.
  - Framed45 closure: 399bfa58bea20c86bcfaf8f97cae435c8819c0d54b20118b33bf6b170ea1d466; CLI remains pinned00e243ec4d963dec0e5130556e25916c478671507e7dc27e7513a9187703e1df; external lock remains b95503782b1021b14d6d2c65c5b56a0e9ab6766bf9f8aba015131aa9a1abd83a.
- risks: Not a generic multi-client cache fence or provider-liveness guarantee; native compatibility/full journey remains unverified. Provider/time/ownership/native gates unchanged; new bytes require independent review.
- assumptions: Fixed local source and cooperative exclusive managed headless owner. Headless entry directly starts app-server and waits for shutdown; mapped startup loads tools/mod adapter, not TUI. Only prefetch callsites are TUI React effects. Response awaits all discovery work; operations serialize and await defaults before mutation, retain busy through channel close, and route channel failure/timeouts to owner stop. Thus prior catalog work cannot survive into another operation under this boundary; no upstream redesign claimed.
- recommended_next_action: Independent exact-source/closure and adverse verification, then separately reviewed master-owned native journey; no full-WP acceptance yet.
- child_agent_requests: []
- child_report_bundle: []
- root_cause: Independently observed valid selected128000/32000 entry plus empty availability fails the original membership predicate; pinned forced assembly can expose mixed snapshots. Exact live race timing remains unproven.
- patch_summary: Relative to channel baseline96980120, only readModelDefaults changed: bounded two-pass loop, full first validation except membership, full final validation plus tuple equality. Tests/diagnostic observer only elsewhere; historical generated-settings implementation retained.
- failure_classification: DEPENDENCY_OR_VERSION_MISMATCH:D_NATIVE_CATALOG_AVAILABLE_EMPTY_WITH_VALID_SELECTED_ENTRY.
- verifier_evidence_addressed: Yes, offline reproduction now succeeds; invalid first evidence cannot fall back to older cache. Native result still pending.

- task_id: WP-0051-local-chat-integration
- agent_role: fixer
- status: PASS (bounded offline repair only; independent verification and native execution remain pending)
- one_sentence_result: Reserved each synthetic provider arm before awaiting its request body and prevented poisoned, closing, or later-arm state from authorizing pending inference.
- files_read: `AGENTS.md`, `.ai/MASTER_CONTRACT.md`, `.ai/WORK_PACKAGES/WP-0051-local-chat-integration.yaml` D package/repair criteria, `.ai/AGENT_REPORTS/WP-0051-native-implementer.md`, `.ai/AGENT_REPORTS/WP-0051-native-scout.md`, complete `personal-co/tests/local-chat-integration.test.mjs`, `.agents/skills/direction-guide/SKILL.md`, and its tool-policy/verification-gate/failure-signatures references. The authorized review-only command hashed its existing 45-entry closure; no native source dump was inspected. Independent race evidence was supplied by the master's packet.
- files_changed: `personal-co/tests/local-chat-integration.test.mjs`; this report only. No production file changed.
- commands_run:
  - read_only, approved scoped reads: `sed`, `cat`, and scoped WP/report inspection; completed.
  - workspace_write, exact reservation: `apply_patch` added regressions first, then minimally repaired the same test fixture, then wrote this report; completed.
  - network_or_escalated (explicitly authorized numeric-loopback HTTP diagnostics only; no escalation/external network): from `personal-co`, `env -u WP0051_RUN_NATIVE -u WP0051_REVIEW_ONLY node --test tests/local-chat-integration.test.mjs`; first run failed as expected, repaired run passed.
  - read_only: `node --check personal-co/tests/local-chat-integration.test.mjs`; PASS.
  - read_only: from `personal-co`, `WP0051_REVIEW_ONLY=1 node tests/local-chat-integration.test.mjs`; PASS, 45 framed entries, no native execution or fixture creation.
  - read_only: `git diff --check` and `shasum -a 256 personal-co/tests/local-chat-integration.test.mjs`; PASS. No Git mutation.
- tests_run:
  - Regression-first: 20 total, 17 PASS, 2 FAIL, 1 native SKIP. With only regressions added, two partial requests using one arm returned `[200,200]`; a pending body completed after another request poisoned the provider returned `[200]`.
  - Final same offline command: 20 total, 19 PASS, 0 FAIL, 1 native SKIP. Concurrent reuse returned `[400,400]`; poisoned pending body returned `[400]`; closing interrupted the pending request with no HTTP success (`[null]`).
  - Pending-arm replacement is rejected; its original request still succeeds. Existing selected/contextless two-sequential-arm SSE test, all 12 refusal cases, admission gates, and late-resource cleanup tests pass.
- evidence:
  - Frozen test SHA-256: `800aa03956fde67592c226eab32507822283df3d368eec1bd531c0cbe07932fe`.
  - Frozen 45-entry framed closure SHA-256: `3922752e08925151a66649929f76a7ae3278c5697d68dbc2d36421e99e79bfc7`.
  - Superseded input test hash: `e400afb94b0cabc55d3e7412be1e474d662ac0bbc93ba08b4b16f79f5e665a5d`; native clearance was never granted for those bytes. Master clarified this historical wording; executable evidence is unchanged.
  - Every diagnostic request is bounded, and owned sockets/listeners are closed by test cleanup. No native process, model, browser, external provider, dependency install, or deletion was invoked.
- risks: D native journey remains NOT_RUN. Offline fixture success is not D1-D6 acceptance or clearance to run native; renewed independent review must bind the new closure.
- assumptions: The single-threaded JavaScript handler has no asynchronous boundary between the post-body health check and inference/SSE response, so the health check covers that synchronous settlement region.
- recommended_next_action: Independently rerun the original concurrent-body reproduction and review the frozen closure; only the master may clear and execute the separately gated native journey.
- child_agent_requests: []
- child_report_bundle: []

## Root cause and exact repair scope

`D_PROVIDER_ARM_CONCURRENT_REUSE`: `arm.used` was checked before the asynchronous body loop but set only after it. Concurrent handlers could both pass and later increment inference; a handler also read mutable global arm values and did not recheck a fault raised while awaiting its body.

The fixture now marks the arm used synchronously, freezes a request-local snapshot, reads all request-specific context/user/reply values from that snapshot, checks healthy/nonclosing state after body receipt, rejects new requests/arms during closing, and permits rearming only after the previous reserved inference completed. There is no new service, dependency, production API, relaxed gate, or native-flow change. Four bounded regression cases cover concurrent reuse, intervening fault, closing, and premature replacement; existing sequential-arm coverage is retained. Product/test bytes are frozen pending independent review.

## Repair 2 — current frozen SBPL syntax repair

The preceding arm-race report and hashes are retained as historical evidence. This section records run `wp0051-d-native-fix-2`; its new framed hash supersedes the earlier execution closure, without changing the integration test.

- task_id: WP-0051-local-chat-integration
- agent_role: fixer
- status: PASS (bounded offline repair only; replacement kernel behavior and full D acceptance remain unverified)
- one_sentence_result: Replaced the independently rejected numeric-host SBPL clause with the packaged exact-port localhost TCP clause while preserving the literal IPv4 provider URL and all other controls.
- files_read: Current D repair/checklist in `.ai/WORK_PACKAGES/WP-0051-local-chat-integration.yaml`, `personal-co/server/runtime-sandbox.mjs` chat derivation, `personal-co/tests/runtime-sandbox.test.mjs` exact expectation, `personal-co/README.md` local operator paragraph, and `.ai/AGENT_REPORTS/WP-0051-native-runtime.md` parser/baseline evidence; reused unchanged repository/master/direction-guide instructions. Review-only command hashed the existing fixed closure, with no native source dump inspected.
- files_changed: `personal-co/server/runtime-sandbox.mjs`, `personal-co/tests/runtime-sandbox.test.mjs`, `personal-co/README.md`, and this report only. Integration-test bytes are unchanged.
- commands_run:
  - read_only, scoped packet authority: `rg`, `cat`, `sed` for the listed evidence/derivation/expectation/operator paragraph; completed.
  - workspace_write, exact reservations: `apply_patch` changed the unit expectation first, then one production line and one README sentence, then appended this report; completed.
  - read_only synthetic unit validation, from `personal-co`: `node --test tests/runtime-sandbox.test.mjs`; regression-first exit 1, final exit 0.
  - read_only, from `personal-co`: `node --check server/runtime-sandbox.mjs`; exit 0.
  - network_or_escalated, expressly authorized default synthetic numeric-loopback controls only (no escalation), from `personal-co`: `env -u WP0051_RUN_NATIVE -u WP0051_REVIEW_ONLY node --test tests/local-chat-integration.test.mjs`; exit 0, native skipped.
  - read_only, from `personal-co`: `WP0051_REVIEW_ONLY=1 node tests/local-chat-integration.test.mjs`; exit 0, 45 framed entries, no native execution.
  - read_only: `git diff --check`, exact three-path `git diff`, and four-path `shasum -a 256`; passed and corroborated the minimal delta. No Git mutation.
- tests_run:
  - Regression-first exact expectation: 8 PASS, 1 FAIL; only mismatch was old `remote ip` numeric-host clause versus requested `remote tcp` localhost exact-port clause.
  - Final runtime sandbox suite: 9 PASS, 0 FAIL; baseline profile, immutable args/environment/roots, literal IPv4 provider URL, no-mods and provider metadata guards remain covered.
  - Unchanged default integration suite: 19 PASS, 0 FAIL, 1 native SKIP; arm concurrency `[400,400]`, intervening fault `[400]`, closing `[null]`, legitimate sequential arms and all refusal controls pass.
  - Syntax and whitespace: PASS. Native/model/browser/kernel execution: NOT_RUN by fixer, as required.
- evidence:
  - Independent prior profile diagnostic in `.ai/AGENT_REPORTS/WP-0051-native-runtime.md`: chat profile exit 65 with parser message `host must be * or localhost in network address`; unchanged baseline exit 0; owned process/group cleanup confirmed. This is supplied historical evidence, not a new fixer execution.
  - Source SHA-256: `aa5fb03db4488aada8b2bcbc7379ebd2cb8b07eb2cb437ab1d15fa418974fb34`.
  - Unit-test SHA-256: `41119cc2c1d05287211c0a592a216c80ce5b2a938834ea7bd9016fb554877c4c`.
  - README SHA-256: `d30eece201080df55e5f9b992bbe35a4c1bfac531d0483c04106066be25f0502`.
  - Unchanged integration-test SHA-256: `800aa03956fde67592c226eab32507822283df3d368eec1bd531c0cbe07932fe`.
  - Current 45-entry framed closure SHA-256: `d5086580a7bbbf917a99ef5248f9986626fbc8015334d3fa20890e8ed86c9841`.
- risks: Actual replacement SBPL compilation, allowed-port access and decoy-port denial remain pending renewed independent frozen review and separately authorized master-owned native validation. No IPv4-only OS restriction or full native compatibility is claimed.
- assumptions: The packet explicitly selected the exact localhost TCP-port syntax; localhost may cover both loopback families, while the actual provider request URL remains literal IPv4. No wildcard host/port or fallback is introduced.
- recommended_next_action: Independently review the frozen three-file delta and new closure before any further bounded native execution; verify actual allowed/decoy behavior rather than accepting the offline exact-string test as kernel proof.
- child_agent_requests: []
- child_report_bundle: []

### Cause and narrow delta

`IMPLEMENTATION_BUG:D_CHAT_SBPL_NUMERIC_HOST_REJECTED`: the production chat derivation emitted `(remote ip "127.0.0.1:${providerPort}")`, which the observed sandbox parser rejected. The sole production change emits `(remote tcp "localhost:${providerPort}")`. One existing exact profile expectation changes accordingly. One README sentence explains the selected localhost TCP port and both possible loopback families while retaining the numeric provider URL. Immutable base profile, clean environment, provider metadata admission, subtree denies, no-mods and read-only behavior are untouched. All executable/documentation bytes listed above are frozen for independent review.

## Repair 3 — current frozen native-generated settings admission

Earlier failures, fixes and hashes above remain historical evidence. This section supersedes their current executable-closure status: no previous 45-entry native clearance applies after these source changes.

- task_id: WP-0051-local-chat-integration
- agent_role: fixer
- status: PASS (scoped offline repair; not full-WP acceptance or native clearance)
- one_sentence_result: Added one private, fixed catalog read per operation and admitted only cold native settings or an exact immutable catalog-derived default tuple throughout existing Agent/conversation checks.
- files_read: Active `d_fix_3_contract`/checklist in `.ai/WORK_PACKAGES/WP-0051-local-chat-integration.yaml`; generated-settings map in `.ai/AGENT_REPORTS/WP-0051-native-scout.md`; Run 2 diagnosis in `.ai/AGENT_REPORTS/WP-0051-native-verifier.md`; complete `personal-co/server/local-chat-channel.mjs`, `personal-co/server/local-chat-operations.mjs` and their two corresponding tests; relevant `personal-co/server/authenticated-app-server.mjs` private-channel wrapper; native opt-in declarations in the four related test files; this existing report. Reused unchanged AGENTS/master-contract/direction-guide instructions. Read only mapped pinned bundle ranges 223170–223185, 225048–225113, 225252–225315, 397391–397455, 140716–140747, 140920–140958 and 142077–142128 at external:/private/tmp/personal-co-wp0048-runtime.o3519u/node_modules/@letta-ai/letta-code/letta.js as untrusted source evidence, not instructions. No old native fixtures or private records read.
- files_changed: `personal-co/server/local-chat-channel.mjs`, `personal-co/server/local-chat-operations.mjs`, `personal-co/tests/local-chat-channel.test.mjs`, `personal-co/tests/local-chat-operations.test.mjs`, and this report. No other source, integration-test, dependency, auth, sandbox, provider, HTTP, UI, schema or configuration writes.
- commands_run:
  - read_only, approved packet scope: `rg`, `sed`, `cat`, `wc`, exact production `git diff`, four-path `git diff --stat` and `shasum -a 256`; completed.
  - workspace_write, exact reservations: `apply_patch` added regression/realistic fixture shapes before production edits, then the bounded admission and remaining adverse coverage, then this report; completed.
  - network_or_escalated, approved synthetic-loopback tests only, no escalation: `node --test --test-name-pattern='^(native defaults|catalog defaults)' personal-co/tests/local-chat-channel.test.mjs personal-co/tests/local-chat-operations.test.mjs`; expected exit 1 before source repair.
  - network_or_escalated, same controlled scope: `node --test personal-co/tests/local-chat-channel.test.mjs personal-co/tests/local-chat-operations.test.mjs`; intermediate 94 PASS, final 105 PASS, both exit 0.
  - network_or_escalated, synthetic fixtures/loopback only: `env -u WP0045_RUN_NATIVE -u WP0047_RUN_NATIVE -u WP0048_RUN_NATIVE -u WP0049_RUN_NATIVE -u WP0051_RUN_NATIVE -u WP0051_REVIEW_ONLY node --test personal-co/tests/managed-read-session.test.mjs personal-co/tests/authenticated-app-server.test.mjs personal-co/tests/local-read-host.test.mjs personal-co/tests/local-chat-context.test.mjs`; exit 0. Initial related invocation omitted explicit `-u WP0049_RUN_NATIVE` but still skipped all three native cases; repeated with every discovered native gate explicitly unset to match the packet precisely.
  - read_only: `node --check personal-co/server/local-chat-channel.mjs`, `node --check personal-co/server/local-chat-operations.mjs`, `git diff --check`; PASS.
  - read_only, from `personal-co`: `npm run typecheck` (`tsc --noEmit`); exit 0.
- tests_run:
  - Regression-first chunk `3c6bc4`: 4 FAIL. Both 128000/32000 and 8192/8192 composed cases rejected the realistic cold local/default singleton Agent and returned failed create; both named reader cases exposed the absent method. Retained regression fixtures: external:/private/tmp/personal-co-wp0051-composed-8hbe1N and external:/private/tmp/personal-co-wp0051-composed-fbpgJK.
  - Final targeted chunk `5eeadb`: 105 PASS, 0 FAIL, 0 SKIP. The two original composed reproductions now complete; existing B/C1 channel, seal, receipt, original-text, reader-bound, long-history, context/reset, no-replay and cleanup regressions remain green.
  - Final related chunk `e03a00`: 56 PASS, 0 FAIL, 3 native SKIP (59 total). No native/model/browser execution, integration opt-in, external network, install, deletion or Git mutation.
  - Syntax, typecheck and whitespace: PASS. Fresh synthetic fixtures retained; tests close their owned sockets, stores and controlled process seams.
- evidence:
  - Channel SHA-256: `96980120fe53b4f67e1dc5e0005e407734a4325868d93d2dacced890450a7f9d`.
  - Operations SHA-256: `b03a836d62fbe9c5f74001311165d795ad371daefcbf6822dd68f3eb7c02d24b`.
  - Channel-test SHA-256: `34b433e1b4e5945190b6269ecb7791e32828389bfea3f59e3e88278e0777ff60`.
  - Operations-test SHA-256: `0c4bb6b177ae0623ea98246482af2cfe977ea9b7c373b63647b2287a57d60566`.
  - Scoped four-file diff: 223 insertions, 20 deletions; production delta is one named catalog reader, a narrow settings predicate, and propagation of its frozen tuple through existing checks. Source/tests frozen before report append.
- risks: Exact native compatibility and end-to-end provider behavior remain unverified after this repair. Catalog absence, more than 512 entries/available handles, missing capacities or disagreement fail closed. No freshness, private-data, model-quality or complete D/WP acceptance claim; the new frozen native closure must be independently reviewed.
- assumptions: The authenticated pinned native JSON catalog is source data, not settings-write authority. Matching reasoning variants may differ in unprojected fields but must agree on provider/context/output. Existing owned-runtime and cooperative same-UID boundaries are unchanged.
- recommended_next_action: Independently review/reproduce the frozen four-file repair, including negative settings, predispatch versus postmutation outcomes and recovery; then build a new reviewed native closure before any separately bounded master-owned native run.
- child_agent_requests: []
- child_report_bundle: []

### Cause, scope and coverage mapping

`IMPLEMENTATION_BUG:D_NATIVE_PROVIDER_DISCRIMINATOR_REJECTED`: the previous empty-settings predicate rejected the pinned runtime's automatically generated `provider_type: lmstudio_openai`; the prior fixture's empty settings hid the mismatch. Warm native state also adds exact context/output defaults, while cached conversations can stay cold.

- Catalog boundary: fixed `list_models` with `force: true`, once before Agent/conversation/recovery checks; entries and available handles each capped at 512, bounded handle strings, exact configured handle required in both. All matching entries must provide `lmstudio_openai`, integer context in 1–128000, and output equal to `min(32000, context)`. Only the three projected native settings fields are frozen; reasoning/tool update arguments never enter a write body. Two valid defaults, consistent variants, one-read enforcement and 16 malformed/missing/conflicting catalog cases are covered.
- Settings admission: only absent/null/empty, exact correct singleton, or exact three-key matching defaults. Two composed suites reject 26 Agent/conversation override cases, including partial/extra/wrong-provider/noninteger and valid-range-but-different limits. Failed UUIDs never trigger another catalog read or dispatch; malformed catalog also stays predispatch failed without mutation.
- Lifecycle: realistic cold local/default Agent, hot preparation, cold conversation, selected send/reset, hot conversation/contextless send and reopen run for both valid tuples. Existing cold recovery plus new hot 8192 recovery complete without another creation; tampered recovery stays unknown.
- Uncertainty: tampering after preparation, creation, final history or context reset leaves UNKNOWN and stops the owner. Catalog drift cannot refresh the operation snapshot to authorize altered settings. No new service, generic RPC, public/browser API, settings normalization/persistence, provider fallback or permission change was introduced.
