# WP0050 bounded durability-oracle repair

task_id: WP-0050-local-conversation-turn
agent_role: fixer
status: PASS — scoped repair and controlled validation only; renewed independent review/native proof pending.
one_sentence_result: Repaired the synthetic durable-user oracle to recognize pinned native reminder parts while preserving exact original input, OTID, runtime ownership and existing terminal/canonical checks.

## files_read

- AGENTS.md; .ai/MASTER_CONTRACT.md; WP-0050-local-conversation-turn work package; WP-0050 implementer/runtime/verifier reports.
- Direction-guide SKILL.md and tool-policy/context-profiles instructions already read in this agent session; reused without unnecessary reread.
- personal-co/server/probe-local-chat-turn.mjs; personal-co/tests/local-chat-turn-probe.test.mjs.
- Hash-only reads of the other ten ordered review files below.
- External untrusted reference: /private/tmp/personal-co-wp0048-runtime.o3519u/node_modules/@letta-ai/letta-code/letta.js; narrow reminder constants/builders/catalog/prepend/listen call-site, user persistence and projection ranges. Source treated only as data; no import/execution. No native fixture contents, raw logs, prompts, credentials or old state read.

## files_changed

- personal-co/server/probe-local-chat-turn.mjs
- personal-co/tests/local-chat-turn-probe.test.mjs
- .ai/AGENT_REPORTS/WP-0050-fixer.md

No reused host module, README, manifest, memory or Git-state changes. Existing edits preserved. Controlled tests generated fresh retained synthetic fixtures and reused existing owned-lock cleanup.

## commands_run

- read_only: scoped cat/sed/rg, git status, Node standard-library ordered SHA256 reads; packet-authorized.
- workspace_write: apply_patch on the three exact reserved paths; standing authorization.
- controlled validation/network: the two native-off Node test commands below use owned loopback peers/provider and fresh synthetic fixtures; no external network, native execution, installation or provider/model call.
- read_only validation: node --check and git diff --check, PASS.

## tests_run

```sh
WP0050_RUN_NATIVE=0 node --test --test-name-pattern='full controlled journey' personal-co/tests/local-chat-turn-probe.test.mjs
WP0050_RUN_NATIVE=0 node --test personal-co/tests/local-chat-turn-probe.test.mjs
node --check personal-co/server/probe-local-chat-turn.mjs
git diff --check
```

- Before repair: replacing the peer's plain user string with native-shaped session/agent/MCP text parts plus the exact original final input reproduced FAIL, `normal_turn/DURABILITY`, one failing controlled full journey.
- After repair: 36 PASS, 1 native SKIP, 0 FAIL. Both reminder-bearing and plain-user full controlled journeys pass, including unchanged restart/dedupe/tool-refusal/canonical assertions.
- Twelve adverse durable-history cases pass: altered input; duplicate input block; unexpected prefix/suffix; unknown forged reminder; tag-wrapped user input; duplicate sentinel inside reminder; text after reminder close; nontext part; wrong OTID; wrong history runtime; duplicate user row. Each stops after one input/one boot and verifies owned cleanup.
- Syntax and whitespace PASS. Related unchanged tests/typecheck evidence reused as directed, not rerun. Actual native test NOT RUN.

## evidence

Pinned source413112–413146 emits text reminder parts and appends the unchanged original string as its final text part. Source413473–413489 applies this to the first user input;138424–138441 persists it;137019–137032 preserves textpart boundaries. Fresh listen catalog/builders at412265–412635/412823–412955 establish ordered session-context, agent-info, MCP-none prefixes observed by the independent diagnosis.

The private probe-only matcher permits exact plain USER or a bounded textpart array ending in exact USER. Preceding parts must be separately wrapped, recognized fresh-session reminders in catalog order without repeats/nested tags, duplicate USER or canonical marker. It never strips tags from arbitrary user input. Unknown reminder kinds or unexpected text fail closed. Existing all-row ownership, exact OTID, assistant counts, acceptance/run/terminal correlation, canonical protection, provider-context validation and no-automatic-resend behavior remain unchanged.

Ordered combined SHA256: **d8bd26b031f60ad1d1948b4f6587ca8e8e0020cb917bcc762b7fbb0749556678**. Raw bytes concatenated in the exact test reviewFiles order; the ten unaffected hashes equal the previously reviewed freeze.

```text
63de6bf4f43a22ba9ab4afbbf4f7f396794c48690635583402ce2c44cdf00e19 personal-co/server/probe-local-chat-turn.mjs
b2d6bced8e8a46e4dd78ccc371cca5072007432c4bc577717bbaef8a4a378519 personal-co/tests/local-chat-turn-probe.test.mjs
625806d9db9419cad84a4243ad07b17c9ede8e83f7630e6f244e68f721ef9225 personal-co/README.md
4e612e45613a7d545203abf00f67fbde7de6157872ac230cccf6a55c5feba049 personal-co/server/runtime-sandbox.mjs
655cf00dfdedfb4cb542246fb15dc1b687f97af87694b44ffa78a976ba72cd4e personal-co/server/runtime-process.mjs
75fdd0258dc1aa00f4893fded944f152d9c351bb7c6eb9717a132fcec241f516 personal-co/server/assistant-bootstrap.mjs
50493801badddaf816688e6f3dc8f1161751617f50d19fa5c7d1c8edd22be011 personal-co/server/canonical-memory-store.mjs
8d6a8a301b545c715e03aaaace71c55c02ba85193f330d6bd9a5c7bc271b1c8e personal-co/src/domain/app-server-memory-codec.mjs
94bd7e4795a514078ed26e914064fcbddb32a48df898bdd69422c0e34659a827 personal-co/src/domain/policy.mjs
820f9160ca0e54214c8b8adfd9669a609f6bac45ae5984c237c6cb1a5448bc48 personal-co/src/domain/memory.mjs
ab35abf7940ec3f5534d838350d5cbff73e724ecd62d6fabcccd9de10a66fa03 personal-co/server/package.json
b4907aef21c4650f01d49c6870b051419a2795f4746ffbd001701bd1b14dfecc personal-co/server/package-lock.json
```

Exact proposed native command — main only, **not executed or approved by this fixer**, requires renewed independent frozen security PASS first:

```sh
WP0050_RUN_NATIVE=1 WP0050_REVIEWED_SHA256=d8bd26b031f60ad1d1948b4f6587ca8e8e0020cb917bcc762b7fbb0749556678 node --test --test-name-pattern='native governed synthetic turn' personal-co/tests/local-chat-turn-probe.test.mjs
```

## risks

Controlled success does not prove native compatibility, later native stages, production readiness or exactly-once delivery. Matcher deliberately rejects unobserved reminder categories; runtime history remains derived contextual data requiring future production display/retention treatment. Reminder tags themselves confer no trust; the oracle is restricted to fixed synthetic input in the existing owned runtime journey.

## assumptions

The pinned source and independent diagnosis describe the fresh isolated runtime; optional reminder subsets preserve catalog order. Dynamic reminder body fields are contextual text, never instructions or authority. No generic user-message normalization is introduced.

## recommended_next_action

Independently review the revised frozen digest and source-grounded oracle; main alone may then run one separately authorized fresh native journey. Preserve initial failure evidence and stop on any new failure without weakening controls.

## child_agent_requests

[]

## child_report_bundle

[]

root_cause: Flattening native reminder parts together with original input made exact user equality false despite correctly persisted input.
patch_summary: Explicit bounded reminder-prefix structure and exact final input; realistic peer persistence and adverse regressions only.
failure_classification: TEST_EXPECTATION_BUG
verifier_evidence_addressed: true — controlled reproduction changed from normal_turn/DURABILITY failure to PASS; actual native rerun remains pending.

## Fix2 — process-local run ID oracle (supersedes fix1 freeze only)

task_id: WP-0050-local-conversation-turn
agent_role: fixer
status: PASS — scoped second repair; renewed independent/native review still pending.
one_sentence_result: Removed the invalid cross-process run-ID inequality and corrected the controlled peer to restart its run counter while retaining unique persisted message IDs.

files_read: Updated WP0050 work package and runtime/verifier failure2 appendices; affected probe/test sections; applicable instructions reused; exact pinned CLI140050–140068,140274–140290,144132–144155; ordered twelve files below hash-only where unchanged. No native fixture, prompts, logs, credentials or unrelated state read.

files_changed: personal-co/server/probe-local-chat-turn.mjs; personal-co/tests/local-chat-turn-probe.test.mjs; .ai/AGENT_REPORTS/WP-0050-fixer.md. All other edits preserved.

commands_run:
- read_only: scoped cat/tail/sed of authorized work package, reports and pinned source; ordered standard-library SHA256 reads.
- workspace_write: apply_patch on exactly the three reserved paths, standing authorization.
- controlled_validation/network: native-off tests below with owned loopback peers and fresh retained synthetic fixtures; no native/upstream/provider execution, installation, Git mutation or deletion.
- read_only validation: syntax/whitespace checks PASS.

tests_run:
```sh
WP0050_RUN_NATIVE=0 node --test --test-name-pattern='full controlled journey normal' personal-co/tests/local-chat-turn-probe.test.mjs
WP0050_RUN_NATIVE=0 node --test personal-co/tests/local-chat-turn-probe.test.mjs
node --check personal-co/server/probe-local-chat-turn.mjs
git diff --check
```

- Before probe repair: per-boot mock run IDs reproduced `cross_restart_measurement/RESTART_TURN`, one expected failing controlled full journey.
- After repair: **39 PASS, 1 native SKIP, 0 FAIL**; syntax and whitespace PASS. Related unchanged validations reused as directed.
- Both full controlled journeys assert first and restarted run IDs equal `local-run-1`, unique persisted message IDs, two exact matching user rows and existing successful cleanup/dedupe/canonical/tool-refusal assertions.
- New reducer regression requires current request acceptance and current client-to-run mapping despite reused run ID; unmatched terminal run cannot complete the input.
- Two adverse restarted journeys remove either the new user or assistant persistence and still fail `RESTART_DEDUPE_CHANGED`, after exactly three deliberate inputs and two owned boots/stops. No automatic resend or lifecycle changes.

evidence: Pinned HeadlessBackend initializes runSeq=0 (140062), startRun increments and derives prefix+sequence (140280–140284), and LocalBackend supplies fixed local-run- prefix (144147). Run IDs therefore do not prove distinct executions across fresh backend processes. Existing new-channel acceptance/request/client/run/terminal correlation and end_turn/no-error checks remain; exact persisted duplicate counts establish the bounded duplicate observation. The source probe change removes only cross-process inequality and documents native ID scope. Controlled peer run counter moved inside startProcess; a separate persistent synthetic message counter preserves row-ID uniqueness.

Revised ordered twelve-file SHA256, raw bytes in unchanged reviewFiles order: **5b0b902e6b54f6be729c9bb73b99f4ee0df474ae17483cc0ec5ce22cba62ec39**.

```text
a7b5e52d6fb2c5ed98d82a7f93cb8889b550b91dd3382e3ae5700f618aa87135 personal-co/server/probe-local-chat-turn.mjs
bd159ab65efcd26c06811c658debc81d989f450142843f5d35eaf231117707e1 personal-co/tests/local-chat-turn-probe.test.mjs
625806d9db9419cad84a4243ad07b17c9ede8e83f7630e6f244e68f721ef9225 personal-co/README.md
4e612e45613a7d545203abf00f67fbde7de6157872ac230cccf6a55c5feba049 personal-co/server/runtime-sandbox.mjs
655cf00dfdedfb4cb542246fb15dc1b687f97af87694b44ffa78a976ba72cd4e personal-co/server/runtime-process.mjs
75fdd0258dc1aa00f4893fded944f152d9c351bb7c6eb9717a132fcec241f516 personal-co/server/assistant-bootstrap.mjs
50493801badddaf816688e6f3dc8f1161751617f50d19fa5c7d1c8edd22be011 personal-co/server/canonical-memory-store.mjs
8d6a8a301b545c715e03aaaace71c55c02ba85193f330d6bd9a5c7bc271b1c8e personal-co/src/domain/app-server-memory-codec.mjs
94bd7e4795a514078ed26e914064fcbddb32a48df898bdd69422c0e34659a827 personal-co/src/domain/policy.mjs
820f9160ca0e54214c8b8adfd9669a609f6bac45ae5984c237c6cb1a5448bc48 personal-co/src/domain/memory.mjs
ab35abf7940ec3f5534d838350d5cbff73e724ecd62d6fabcccd9de10a66fa03 personal-co/server/package.json
b4907aef21c4650f01d49c6870b051419a2795f4746ffbd001701bd1b14dfecc personal-co/server/package-lock.json
```

Exact proposed command — **main only after renewed independent frozen security PASS; not executed by fixer**:
```sh
WP0050_RUN_NATIVE=1 WP0050_REVIEWED_SHA256=5b0b902e6b54f6be729c9bb73b99f4ee0df474ae17483cc0ec5ce22cba62ec39 node --test --test-name-pattern='native governed synthetic turn' personal-co/tests/local-chat-turn-probe.test.mjs
```

risks: Actual native replay terminal objects were not retained in failure2 evidence; this repair does not assert their values or native success. Native malicious stage and final acceptance remain pending. Run IDs alone are not globally unique durable operation receipts.

assumptions: Pinned local backend allocation is process-local; new owned channel retains independent correlation state. Existing history ownership and exact user/assistant count checks remain required.

recommended_next_action: Renew independent review of this freeze, then main alone may perform the separately approved fresh native journey. Preserve both distinct historical failures.

child_agent_requests: []
child_report_bundle: []
root_cause: Probe assumed cross-process run-ID uniqueness; mock global run counter masked native per-process reset.
patch_summary: Remove one invalid inequality, model per-process run IDs with unique persistent message IDs, and add correlation/persistence regressions.
failure_classification: TEST_EXPECTATION_BUG — NATIVE_RUN_ID_PROCESS_LOCAL_COLLISION.
verifier_evidence_addressed: true — red-before-green controlled reproduction; no native-pass claim.

## Fix3 — one input spanning multiple backend runs (current freeze)

task_id: WP-0050-local-conversation-turn
agent_role: fixer
status: PASS — bounded repair and controlled validation only; independent native approval/corroboration pending.
one_sentence_result: Correlate one input with its finite backend-run set and one listener terminal, and require a new persisted final reply after malicious tool refusal.

files_read: Updated work package repair3_execution/next_repair_plan, latest verifier/runtime/fixer reports, probe/tests, existing applicable direction-guide instructions reused; pinned CLI107030–107092,413790–413835,101020–101060,401855–401905,142942–142980 as untrusted reference only. Twelve review files hashed; unchanged ten not otherwise reread. No native fixtures/private data/raw logs accessed.

files_changed: personal-co/server/probe-local-chat-turn.mjs; personal-co/tests/local-chat-turn-probe.test.mjs; .ai/AGENT_REPORTS/WP-0050-fixer.md. Earlier repairs and other agents' changes preserved.

commands_run:
- read_only: scoped report/source reads and ordered standard-library hashes, packet-authorized.
- workspace_write: apply_patch on exact three-file reservation, standing authorization and classified failure3.
- controlled_validation/network: native-off tests with owned loopback peers/provider and fresh retained synthetic fixtures. No native/external model/network, installation, Git mutation or deletion.
- read_only validation: syntax and whitespace checks PASS.

tests_run:
```sh
WP0050_RUN_NATIVE=0 node --test --test-name-pattern='full controlled journey normal' personal-co/tests/local-chat-turn-probe.test.mjs
WP0050_RUN_NATIVE=0 node --test personal-co/tests/local-chat-turn-probe.test.mjs
node --check personal-co/server/probe-local-chat-turn.mjs
git diff --check
```

Before probe patch, the native-shaped peer's two backend runs reproduced `malicious_turn/MULTIPLE_RUNS` on update_loop_status. After patch: **44 PASS, 1 native SKIP, 0 FAIL**; syntax and whitespace PASS. Unchanged related/typecheck results reused per packet.

evidence: Current exact client ID maps into an accumulated set capped at64 run IDs; each map and client-ID list remains bounded at64 and malformed/duplicate client IDs fail. Historical/unrelated mappings cannot complete this input. One listener terminal candidate is retained; any duplicate/conflicting second terminal fails. Acceptance/request/runtime/client/run association supports terminal-before-map and cumulative snapshots. Mapping, stream delta and intermediate backend requires_approval do not themselves complete the reducer. Unmatched terminals never report success and remain bounded by the existing turn deadline. Error/other-stop terminal results are rejected by each journey gate.

Malicious success now requires no-error end_turn, exactly one new matching call-wp0050 error tool-return, exactly one new exact synthetic assistant reply after that refusal with total reply count incremented, and unchanged canary/canonical bytes. Existing normal/restart identity, OTID, reply counts and lifecycle controls remain. The controlled peer models two actual provider responses/backend run IDs for one malicious input, cumulative historical mappings, intermediate streamed backend stop, persisted refusal/follow-up reply and only one final listener terminal. Full controlled inference count is4; host input count stays4 (normal, deliberate same-runtime duplicate, deliberate restart measurement, malicious).

Regressions cover both terminal/map orders, unrelated/stale/unmatched mappings, conflicting/duplicate terminals, malformed lists/maps and accumulated run overflow; existing foreign/runtime/current-input tests remain. Missing final reply, error terminal and premature terminal each fail the malicious journey with exactly four host inputs and successful owned cleanup.

Current ordered twelve-file raw-byte SHA256: **e93ea22e192e631ba17b0809b03e66cb3dc874292a3a0d0d2f21990b8c31f9df**. Order is unchanged from fix2's twelve-entry list and test reviewFiles. Entries1–2 now are:
```text
63cbed8d18ae126721c884ca039bace654210adc52d2d01ee09b2ed735270504 personal-co/server/probe-local-chat-turn.mjs
bc1a6689b744f8ad41a6a4459cf61dd5d8b3eb651951fa10b1e4b05cb7b1604d personal-co/tests/local-chat-turn-probe.test.mjs
```
Entries3–12 individually rehashed equal the exact fix2 hashes above (README, sandbox, process, bootstrap, store, codec, policy, memory, server package.json, package-lock.json). No other execution inputs changed.

Exact proposed native command — **main only after renewed independent frozen security PASS; not executed/approved by this fixer**:
```sh
WP0050_RUN_NATIVE=1 WP0050_REVIEWED_SHA256=e93ea22e192e631ba17b0809b03e66cb3dc874292a3a0d0d2f21990b8c31f9df node --test --test-name-pattern='native governed synthetic turn' personal-co/tests/local-chat-turn-probe.test.mjs
```

risks: Actual native final listener terminal and full journey success remain unproven. A mapped listener terminal is authoritative only within the owned protocol channel; run names/map insertion order are not completion evidence. max_turns2 remains configured but is not treated as a provider-call bound: pinned local usage omits step_count. Effective bounds remain the existing two malicious provider responses, request/socket/frame budgets and deadlines. No host resend does not promise engine-wide exactly-once behavior or production tool safety.

assumptions: The verified pinned contract allows multiple backend runs under one input/listener lease, emitting one final listener terminal carrying a mapped run ID. Retained history query is ascending, so the newly persisted exact reply must follow its new refusal. New-channel isolation and earlier exact synthetic-input recognition remain.

recommended_next_action: Independently review current freeze and changed lifecycle assertions, then main may run one newly approved native journey and obtain final independent artifact/cleanup corroboration. Preserve all three distinct failure records.
child_agent_requests: []
child_report_bundle: []
root_cause: Reducer enforced one backend run per input while native tool refusal continues the same listener lease through another backend run; peer omitted this continuation and final persisted reply.
patch_summary: Finite current-client run set plus one listener terminal; explicit malicious terminal/new-refusal/new-reply gates; realistic multi-run peer and bounded adversarial regressions.
failure_classification: IMPLEMENTATION_BUG — INPUT_CORRELATION_ASSUMES_SINGLE_BACKEND_RUN.
verifier_evidence_addressed: true — exact red-before-green controlled multi-run reproduction; no native-pass or production completion claim.
