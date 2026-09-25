# WP-0051 Segment D — native integration test author

task_id: WP-0051-local-chat-integration
agent_role: implementer
status: PASS
one_sentence_result: Authored and froze the bounded real host/client/native integration test; offline author validation passed, while native execution remains NOT_RUN and independent verification is pending.

## files_read

- `AGENTS.md`, `.ai/MASTER_CONTRACT.md`, `.agents/skills/direction-guide/SKILL.md` and unchanged implementer references; current `.ai/WORK_PACKAGES/WP-0051-local-chat-integration.yaml` D package/checklist and `.ai/AGENT_REPORTS/WP-0051-native-scout.md`.
- `personal-co/server/local-read-host.mjs`, `personal-co/server/managed-read-session.mjs`, `personal-co/server/runtime-process.mjs`, `personal-co/server/runtime-sandbox.mjs`, `personal-co/server/assistant-bootstrap.mjs`, `personal-co/server/canonical-memory-store.mjs`, `personal-co/server/local-chat-operations.mjs`, `personal-co/server/local-chat-channel.mjs`, `personal-co/server/local-chat-context.mjs`, `personal-co/server/probe-local-chat-turn.mjs` and directly imported contracts. Unchanged earlier source readings were reused where applicable.
- `personal-co/src/services/local-read-client.mjs`, `personal-co/tests/local-read-host.test.mjs`, `personal-co/tests/local-chat-turn-probe.test.mjs`, and the new test. App/import graph, manifests, locks and existing exported bundle were read for frozen closure hashing, not rebuilt.
- Exact pinned CLI/package bytes were streaming-hashed only: `external:/private/tmp/personal-co-wp0048-runtime.o3519u/node_modules/@letta-ai/letta-code/letta.js` and `external:/private/tmp/personal-co-wp0048-runtime.o3519u/node_modules/@letta-ai/letta-code/package.json`. No real private state, credential contents or broad native source dump was read.

## files_changed

- `personal-co/tests/local-chat-integration.test.mjs` — sole executable change; test-only provider, ownership controls, reviewed-closure gate and actual managed native journey.
- `.ai/AGENT_REPORTS/WP-0051-native-implementer.md` — this author report.

## commands_run

- Syntax / reserved test: `cd personal-co && node --check tests/local-chat-integration.test.mjs` — PASS.
- Offline targeted validation: `cd personal-co && env -u WP0051_RUN_NATIVE -u WP0051_REVIEW_ONLY node --test tests/local-chat-integration.test.mjs` — PASS; 16 tests, 15 passed, 1 skipped, 0 failed, 0 cancelled; final duration approximately 165 ms.
- Read-only review closure: `cd personal-co && WP0051_REVIEW_ONLY=1 node tests/local-chat-integration.test.mjs` — PASS; prints framed digest and 45 per-file hash entries, with no test registration, fixtures, listeners or native starts.
- Read-only freeze: `shasum -a 256 personal-co/tests/local-chat-integration.test.mjs` — PASS; hash below.
- Whitespace validation: `git diff --check` — PASS.
- Native/model/browser execution, broad suites, UI export/rebuild, installations, deletion and Git mutation — NOT_RUN.

## tests_run

- Native gate rejection controls and valid pure gate control, without native execution.
- Late resource acquisition disposal; uncertain explicit release rejects, forbids a follow-on acquisition/publication and leaves final cleanup unconfirmed.
- Synthetic provider discovery and two one-shot SSE arms, with selected versus contextless system checks.
- Twelve provider rejection cases: authorization, cookie, unknown header, wrong Host, wrong route, wrong model, tools, malformed JSON, oversized body, unarmed inference, repeated inference and unselected-context leakage.
- Actual native integrated journey — SKIPPED by default, NOT_RUN by author.

## evidence

- Frozen test SHA256: `e400afb94b0cabc55d3e7412be1e474d662ac0bbc93ba08b4b16f79f5e665a5d`.
- Frozen framed review closure SHA256: `39ef6ab7deb7a22ac1e95fa004042bd0cab564dff9c388de9b8e1acaba7c218c`.
- Closure includes the test, actual host/client and local transitive source graph, CLI, App entry graph, manifests/locks, README, existing dist index and its exact single referenced JS asset, plus fixed external CLI/package bytes. It validates regular canonical single-link bounded files and frames path/byte lengths before hashing; shared imports are deduplicated and sorted.
- Pinned CLI SHA256: `00e243ec4d963dec0e5130556e25916c478671507e7dc27e7513a9187703e1df`; native gate additionally requires darwin and Node v24.15.0.
- Existing exported JS SHA256: `e11542efac98f23e02043e3cbabece3b6f23d42bfdc8af2737441016dc4a2500`; no bundle rebuild.
- Default controls confirmed all synthetic listener/socket cleanup through registered cleanup assertions. No native fixture was created. Native cleanup evidence therefore remains NOT_RUN, not inferred from offline controls.

## risks

- Actual pinned native SDK request compatibility, numeric sandbox grant/decoy denial, two-boot persistence and real process/listener cleanup remain unproven until the independently reviewed master-only run.
- The strict provider rejects unexpected headers, tool settings, extra inference or protocol drift; a native failure must be classified rather than loosening limits or blindly retrying.
- Context assertions concern selected evidence and current system projection, not erasure of historical derived caches. Same-UID cooperating writers and the existing bootstrap owner remain assumptions.
- Fixture roots are retained intentionally; no cleanup deletes files. Timeout or uncertain owned-resource disposal makes the test fail and blocks the next boot.

## assumptions

- Accepted Segment B/C product source at HEAD f713896 is unchanged and owns production policy, authorization and limits.
- Main owns independent review and any subsequent native execution. Author PASS covers test implementation/offline checks only, not D acceptance or the whole work package.

## recommended_next_action

Independently review the frozen test and full printed closure, including security and late-cleanup behavior. Recompute with the review-only command above; any changed digest invalidates this freeze. Only after acceptance may the master use the following bounded command from `personal-co` (NOT_RUN by author):

```sh
WP0051_RUN_NATIVE=1 WP0051_REVIEWED_SHA256=39ef6ab7deb7a22ac1e95fa004042bd0cab564dff9c388de9b8e1acaba7c218c node --test tests/local-chat-integration.test.mjs
```

child_agent_requests: []
child_report_bundle: []

## implementation_notes

### D1–D6 mapping

- D1: Native branch calls actual startLocalReadHost, createLocalReadClient, initializeManagedReadSession and startOwned with the unmodified captured immutable launch spec. Fresh private roots and deterministic SSE provider; actual authenticated HTTP create, preview, contextual send, completed receipt and exact original-user/persisted-assistant history checks.
- D2: Requires idle before trusted CURRENT_CONTEXT-only seed; seeds distinct selected/unselected paragraphs and selects exactly one. Unselected marker is prohibited throughout provider request; selected marker is prohibited in user rows and second turn's current system. Records canonical hash/canary invariants and provider auth metadata absence, validates provider directory metadata if present. After confirmed close, second boot compares Agent, both receipts and first history before any new send; duplicate UUID submissions cannot add inference. Second contextless send verifies retained exact history.
- D3: No forwarding; exact route/Host/model/header allowlists, empty tools/functions, one inference per explicit arm and two total. Fixed bounds: 32 requests, 4 concurrent connections, 16 requests/socket, 4096-byte headers, 262144-byte bodies, 64 messages, 2-second request/body deadline and 8192-byte responses. Provider faults poison further admission and abort the native journey; evidence omits raw headers/bodies.
- D4: Captures actual profile/env/cwd without modifying native launch. One finite helper uses that identical profile/env/cwd, proves allowed numeric provider reachability and requires decoy EPERM/EACCES; parent first proves decoy live. Exactly one decoy request AND one accepted connection excludes helper admission masked by response denial. Profile is hashed, never logged.
- D5: Default test command runs only controlled synthetic fixtures. Native flag, darwin and reviewed exact closure gate precede all native fixtures/listeners; native-mode registration excludes default fixture tests. Review-only mode performs reads/hashes only. Node and fixed runtime pins are enforced.
- D6: Native test timeout 150 seconds, internal abort 130 seconds, two real boot maximum, one helper maximum, two inference maximum, receipt observation 25 seconds/100 polls and helper output deadline 5 seconds. Ownership tracks late acquisitions and bounded disposal, aborts on uncertainty and requires confirmed explicit release before second boot. Sanitized output includes spawned PID/runtime port, process and terminal cleanup fields, host close confirmations, resource cleanup, operation/history/profile hashes and counts; no bearer/spec/context logs.

Author-stage refinements before freeze added selection-isolation, immediate reopen persistence, provider-directory metadata, decoy connection accounting and fail-closed explicit disposal checks. These were not independent-verifier failure rounds. No production edits were made.

## Catalog observation diagnostic — later bounded author run

task_id: WP-0051-local-chat-integration
agent_role: implementer
status: PASS
one_sentence_result: Added a separately gated, observation-only native catalog/Agent diagnostic to the existing integration test, with 25 offline controls passing; native execution remains NOT_RUN by this author.

files_read: Current diagnostic package/checklist in `.ai/WORK_PACKAGES/WP-0051-local-chat-integration.yaml`; Run 3 diagnosis in `.ai/AGENT_REPORTS/WP-0051-native-verifier.md`; current `personal-co/tests/local-chat-integration.test.mjs`; actual makeAuth/start/cleanup seams in `personal-co/server/managed-read-session.mjs`; constructor/connectChat and WS options in `personal-co/server/authenticated-app-server.mjs`; readModelDefaults/readAgent in `personal-co/server/local-chat-channel.mjs`; `personal-co/server/package.json`; own prior report; unchanged repository/skill instructions reused and direction-guide reread. Existing review closure files were read/hash-checked only. No old native fixtures, private states or native bundle source was inspected.

files_changed: `personal-co/tests/local-chat-integration.test.mjs` and this report only. Production modules, provider implementation, previous 19 offline controls and nativeJourney body were not modified; test dispatch now selects one native mode exclusively.

commands_run:

- Read-only bounded source inspection with rg/sed/cat — PASS, within packet.
- Syntax: `node --check personal-co/tests/local-chat-integration.test.mjs` — PASS.
- Offline targeted test: `env -u WP0051_RUN_NATIVE -u WP0051_REVIEW_ONLY -u WP0051_RUN_CATALOG_DIAGNOSTIC node --test personal-co/tests/local-chat-integration.test.mjs` — final PASS, 27 tests / 25 passed / 2 skipped / 0 failed, approximately 180 ms.
- Read-only whitespace/hash: `git diff --check` and `shasum -a 256 personal-co/tests/local-chat-integration.test.mjs` — PASS.
- Read-only reviewed closure: `WP0051_REVIEW_ONLY=1 node personal-co/tests/local-chat-integration.test.mjs` — PASS, 45 entries; output was reduced in memory to digest/count/test hash, with no artifact write.
- Native diagnostic/full journey, model, browser, external network, dependency installation, deletion, Git mutation and broad suites — NOT_RUN.

tests_run: Preserved all 19 existing offline controls; added six tests for mutually exclusive gated dispatch; private numeric/boolean catalog and Agent projection; 1 MiB/512-item/depth/record/key bounds; null/missing/malformed catalog predicate retention; exact WS constructor/send argument forwarding with matching request/phase isolation and duplicate rejection; active-phase malformed/oversized/binary frame rejection. Synthetic rejection assertions exclude secret values and arbitrary key names from projections. Both native modes skipped.

evidence:

- Frozen test SHA256: `bac04673704e66bb7ec365a06fb550155b5243eb68a88ef306ce7b97ec870053` (54,795 bytes).
- Frozen 45-entry review closure SHA256: `82d847c08aa23d6536a429cd1661c24c1a343d54724879728bc192b8b538a401`.
- Diagnostic flag requires existing native flag, darwin and exact review digest before fixture/listener creation. Full journey and diagnostic never execute together. Review-only command is unchanged and read-only.
- One actual initializeManagedReadSession boot, unchanged real start/sandbox/provider guard and existing installed ws resolved from server package. makeAuth preserves all passed options, replacing only the trusted WS implementation with a subclass forwarding exact constructor/send arguments. Capability/endpoint remain closures; no generic RPC surface is used.
- Provider is never armed: zero inference required and every POST rejected by existing provider. Only one fixed connectChat, readModelDefaults and readAgent sequence is used after readiness. A PREDISPATCH admission result is recorded separately from observed catalog projection, permitting the subsequent healthy Agent read.
- Projection emits only field validity/presence, bounded counts, selected availability, selected provider equality, known numeric-or-null defaults, extra-key counts, Agent identity/model equality and allowlisted result codes. Missing/null arrays and invalid handles remain diagnosable without revealing their strings. Raw frames, system prompts, arbitrary error strings and unknown key names are not persisted or printed.
- Active catalog observation is correlated to the actual outgoing list_models request ID; only the explicit phase is observed. Frames are bounded at 1 MiB, arrays at 512, tree depth at 16, records at 4096 and total keys/elements at 16384. Existing 5-second RPC and provider limits remain unchanged.
- Native diagnostic has 50-second internal abort / 70-second test timeout and existing bounded late-acquisition ownership cleanup. Sanitized output retains lifecycle PID/port/cleanup evidence. Actual native cleanup is NOT_RUN; default controls confirmed synthetic resource cleanup only.

risks: This is diagnostic instrumentation, not a fix or proof of Run 3's cause. Catalog/Agent results and native cleanup remain unobserved until independent review and a master-only run. A channel/Agent-read failure is explicitly coded rather than relabelled as admission success. The bounded whole-frame parser may reject unexpectedly large/deep responses instead of disclosing them. No production admission predicate or refresh flag was changed.

assumptions: Current dirty product source and prior native evidence belong to the master and are preserved. The installed server ws dependency is the actual production dependency; no dependency is added. Earlier report hashes/commands above are historical evidence, superseded only for this later diagnostic freeze by the hashes in this section.

recommended_next_action: Independently review the exact frozen test and recompute the closure with the read-only command above. Only after that review may the master run this diagnostic command from repository root (NOT_RUN by author):

```sh
WP0051_RUN_NATIVE=1 WP0051_RUN_CATALOG_DIAGNOSTIC=1 WP0051_REVIEWED_SHA256=82d847c08aa23d6536a429cd1661c24c1a343d54724879728bc192b8b538a401 node --test personal-co/tests/local-chat-integration.test.mjs
```

child_agent_requests: []
child_report_bundle: []

implementation_notes: Author PASS is scoped to offline implementation/validation, not independent acceptance or whole-WP completion. The direction-guide workflow kept the write reservation to the existing test/report and leaves native execution and acceptance to the master after independent review. No child agents.
