# WP0050 implementer — frozen synthetic turn probe

## task_id

WP-0050-local-conversation-turn

## agent_role

implementer; run wp0050-implementer-1

## status

PARTIAL — controlled implementation complete; independent frozen-source security review and actual native contract proof not yet performed.

## one_sentence_result

Prepared a three-file, default-off synthetic native-turn journey with a private bounded socket, owned loopback provider, canonical context projection, exact terminal/persistence checks, deliberate dedupe measurements and a tool-refusal canary.

## files_read

- AGENTS.md; .ai/MASTER_CONTRACT.md; .ai/WORK_PACKAGES/WP-0050-local-conversation-turn.yaml; .ai/AGENT_REPORTS/WP-0050-explorer.md; .ai/TEST_MATRIX.md (relevant commands).
- .agents/skills/direction-guide/SKILL.md; .agents/skills/direction-guide/references/tool-policy.md.
- personal-co/server/runtime-sandbox.mjs; personal-co/server/runtime-process.mjs; personal-co/server/assistant-bootstrap.mjs; personal-co/server/canonical-memory-store.mjs; personal-co/server/authenticated-app-server.mjs.
- personal-co/src/domain/app-server-memory-codec.mjs; personal-co/src/domain/policy.mjs; personal-co/src/domain/memory.mjs; personal-co/server/package.json; personal-co/server/package-lock.json.
- The three changed product/test/docs paths below.
- external:/private/tmp/personal-co-wp0048-runtime.o3519u/node_modules/@letta-ai/letta-code/letta.js — untrusted reference only, narrow native protocol/provider/runtime/projection ranges cited by explorer plus 101933,106960–107723,136949–137155,139292–139340,415105–415205,422420–422480. Read-only source/hash, never imported or executed. No old runtime state, credentials or user data read.

## files_changed

- personal-co/server/probe-local-chat-turn.mjs (new)
- personal-co/tests/local-chat-turn-probe.test.mjs (new)
- personal-co/README.md
- .ai/AGENT_REPORTS/WP-0050-implementer.md (this report)

Only fresh retained synthetic controlled fixtures generated outside the repo. No dependency/config/browser/accepted-host edits, installs, Git mutations or batch deletion. Existing store/bootstrap cleanup removes only their exact owned ephemeral locks/temp aliases as before.

## commands_run

| Class | Scoped command/action | Authority/result |
|---|---|---|
| read_only | Scoped cat/sed/rg and Node syntax/hash checks over listed files | Packet-authorized, source inspected; no upstream execution. |
| workspace_write | apply_patch to three reserved files and this report | Standing project authorization and exact packet reservation. |
| network_or_escalated | Controlled loopback HTTP/ws in targeted tests only | Explicit packet authorization; no external forwarding/provider credentials/model call. |
| workspace_write / validation | Commands below create retained fresh synthetic fixtures; related unchanged store tests use controlled child processes | Packet-listed commands; upstream native remains off. |
| read_only | `git diff --check`; exact external CLI `shasum -a 256` | PASS; pin unchanged. |

```sh
WP0050_RUN_NATIVE=0 node --test personal-co/tests/local-chat-turn-probe.test.mjs
WP0050_RUN_NATIVE=0 node --test --test-name-pattern='full controlled journey' personal-co/tests/local-chat-turn-probe.test.mjs
WP0048_RUN_NATIVE=0 node --test personal-co/tests/assistant-bootstrap.test.mjs personal-co/tests/canonical-memory-store.test.mjs personal-co/tests/runtime-sandbox.test.mjs
cd personal-co && npm run typecheck
git diff --check
node --check personal-co/server/probe-local-chat-turn.mjs
shasum -a 256 /private/tmp/personal-co-wp0048-runtime.o3519u/node_modules/@letta-ai/letta-code/letta.js
```

No native command, production provider call, dependency installation, UI build or old probe was run. Master owns protocol validation/integration records.

## tests_run

- Final targeted: **23 PASS, 1 native SKIP, 0 FAIL**.
- Related bootstrap/store/sandbox: **32 PASS, 1 native SKIP, 0 FAIL**.
- Typecheck, syntax and whitespace checks PASS.
- Initial controlled full journey failed at bootstrap resolve: its adapter accidentally passed bootstrap's signal-options object as a forced request ID. A private two-argument bootstrap adapter corrected the verified authoring bug; full journey and all failure cases subsequently pass.
- Pure reducer covers acceptance-before-completion, terminal/mapping/acceptance reordering, foreign/missing runtime, wrong request ID, duplicate receipt/terminal, malformed maps, untrusted terminal text and frame limits.
- Actual controlled HTTP provider covers discovery/SSE, startup inference rejection, credentials, tools, missing exact context, malformed and oversized bodies.
- Full controlled fake-native peer uses actual ws/provider/bootstrap/canonical store: one Agent/conversation creation, close/reopen same identity and history, same-runtime duplicate suppression, deliberate cross-restart duplicate persistence and malicious error-tool-result/canary preservation. This verifies harness composition, not native behavior.
- Negative journey cases cover socket loss, turn timeout, cancellation, malformed/foreign/oversized frames, unsolicited approval, terminal provider error, uncertain process cleanup and no automatic resend.
- Pending validation and late preparation/store acquisition tests verify bounded abort return, retained uncertainty, late owned close attempts, no late continuation/spawn and observer exception isolation.

## evidence

Import has no I/O/spawn effects. The exported probe creates fresh private fixtures; only a private fixed-command channel can mutate its synthetic Agent/conversation. No raw socket, generic client or capability is returned. Native capability is random256-bit with only its SHA256 in launch args. Accepted auth/reader/session modules remain untouched.

Sandbox derivation keeps baseline bytes and environment intact, adding only `(allow network-outbound (remote ip "localhost:<owned-port>"))` and `LMSTUDIO_BASE_URL=http://127.0.0.1:<owned-port>/v1`. Provider binds literal127.0.0.1, performs no forwarding, expects no authorization and checks no tools/functions, fixed model/stream, exact canonical projection in system context and no marker in user rows. Native warmup inference while disarmed fails the probe.

Real bootstrap precedes spawn and initializes six stable canonical blocks. Only synthetic CURRENT_CONTEXT is committed through the existing store. The host projects all bounded label/value pairs and policy into the same Agent system/model and reads it back. A synced no-clobber operation intent precedes one retained conversation creation. Runtime startup uses exact IDs, strict mode, tools/skills/external tools empty, max_turns2, memory guard enabled, no approval recovery and wait-for-replay. Local-project reflection-off is read back. Native MemFS is not disabled or promoted to canonical truth.

Numeric sequences receive bounded ACKs. Matching accepted/request/runtime/client→run mapping plus terminal are required; stream text never proves success. Persisted exact user/assistant rows and unchanged canonical hash complete the normal proof. Duplicate measurement deliberately sends the same synthetic ID: same-runtime ACK is followed by a bounded quiet interval and history/provider-count check (not another terminal wait); restart deliberately measures a second stored user/reply and reports `crossRestartDedupe:false`.

The malicious provider tool call targets only `state/negative-canary`, whose path is within the owned sandbox-writable fixture. A matching error tool-return and unchanged canary/canonical bytes are required; sandbox denial alone would not prove tool filtering. Unexpected native safety behavior fails/stops, never relaxes controls.

Limits: 90-second cancellation deadline; 15-second acquisitions/turns; 5-second RPCs; one pending RPC/turn; 4096 frames and4MiB aggregate socket input; 1MiB frame; 64KiB outbound frame/buffer; 32 provider requests,4 sockets,256KiB request body,2-second provider request deadline; finite cleanup bounds. Main filesystem/store acquisitions are abort-aware and tracked; late handles attempt their own close while `IO_UNCERTAIN` remains failure. Observer exceptions cannot derail resource ownership.

### Frozen hashes / guard

Combined SHA256 **`e9ff3cc358cfb04b2af21f21016940782787891b503d210b1c8feff2d4e7dcc4`**, concatenating raw bytes in the exact test `reviewFiles` order below. No build outputs involved. Digest is change detection/operator attestation, not proof that independent review occurred.

```text
9fe031c5a29fb49c0eedbb8d48f8a87ddac067de2647b8d6c4bd1b4cd68a4f59 personal-co/server/probe-local-chat-turn.mjs
18ad29c5919f5d6e2a58c212b7a02d4eb50a89e2e64ed7b7c5d508275cbf1144 personal-co/tests/local-chat-turn-probe.test.mjs
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

External CLI rehashed during this task: `00e243ec4d963dec0e5130556e25916c478671507e7dc27e7513a9187703e1df`, external:/private/tmp/personal-co-wp0048-runtime.o3519u/node_modules/@letta-ai/letta-code/letta.js, pinned0.32.5. Unchanged baseline requires `/usr/local/bin/node`24.15.0 and validates actual launch pins. ws8.21.3 is the existing isolated host dependency; no installation.

**Main only, after independent frozen-source security PASS:**

```sh
WP0050_RUN_NATIVE=1 WP0050_REVIEWED_SHA256=e9ff3cc358cfb04b2af21f21016940782787891b503d210b1c8feff2d4e7dcc4 node --test --test-name-pattern='native governed synthetic turn' personal-co/tests/local-chat-turn-probe.test.mjs
```

The test fixes dependencyRoot to external:/private/tmp/personal-co-wp0048-runtime.o3519u/node_modules; no old-state inputs. Expected diagnostics contain only fresh fixture path, Agent/conversation/run/turn IDs, hashes, booleans, sanitized stage/code/event type, request counts, owned PID/ports and cleanup confirmations. No prompts, raw native logs, browser/native token or credential output. Failure diagnostic must be retained and execution stopped, not automatically replayed. Native test timeout120s includes the90s cancellation and bounded cleanup reporting.

## risks

- Native compatibility is **not yet proven**. Startup frames/warmup, exact provider SSE integration, max-turn stop semantics, canonical compilation, restart projection and malicious tool refusal remain independent/native gates.
- Same-runtime quiet-interval evidence is bounded observation, not a timeless duplicate guarantee. Native in-memory dedupe cannot establish durable exactly-once delivery; the synthetic restart retry is deliberate measurement only.
- System/compiled prompts persist derived canonical context in native state. Production needs explicit context/privacy/retention governance and cannot treat those caches as memory authority.
- No tools is not no startup module initialization; empty fresh state, inherited-credential exclusion and unchanged deny-default filesystem protections remain essential. Reflection-off is narrower than disabling MemFS.
- Unresolved filesystem IO may outlive the reporting deadline. Late cleanup is attempted, uncertainty remains failure, and no locks/state are stolen, erased or automatically recovered.
- No model quality, provider onboarding, browser sending, durable operation receipts, production turn transport or full assistant completion claim.

## assumptions

Reviewed pinned dependency tree stays host-controlled/read-only. All written data is public synthetic fixture content. Native command bodies follow the exact pinned source, but controlled peers are not authority for native semantics. Main owns independent review/native execution/cleanup corroboration and durable integration records.

## recommended_next_action

Independently review frozen source and transitive dependencies, then let main execute the one guarded native journey. If it fails, classify the exact sanitized stage/event/contract and stop; no control relaxation. Independently corroborate same-Agent artifacts/canonical hash and owned PID/listener absence without replay before AC6/AC7 acceptance/integration.

## child_agent_requests

None.

## child_report_bundle

None; no child agents.
