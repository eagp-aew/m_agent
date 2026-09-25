# WP0051 D native safety scout

- task_id: WP-0051-local-chat-integration
- agent_role: security-reviewer
- status: PASS (planning only; no execution clearance)
- one_sentence_result: One new test can exercise the actual HTTP/client/native/provider/receipt/reopen path in two native boots without changing the accepted standalone probe.
- files_read: WP0051; provider-security report; local-read-host and local-chat-turn-probe tests; probe-local-chat-turn, runtime-sandbox, local-read-host, managed-read-session, runtime-process, assistant-bootstrap, canonical-memory-store, local-chat-channel, local-chat-operations and local-read-client sources under personal-co.
- files_changed: None by reviewer; master transcribes this concise final evidence.
- commands_run: 11 bounded read_only rg/sed/nl inspections; key truncated ranges reread. No network, execution, Git mutation, installation or deletion.
- tests_run: NOT_RUN; read-only planning packet.
- evidence: Actual reviewer /root/wp0051_provider returned final PASS. Bootstrap resolve closes canonical writer at assistant-bootstrap.mjs:225 while retaining separate bootstrap lease. Idle trusted fixture can seed only CURRENT_CONTEXT, then close writer before actual preview. Existing host makeSession seam can call real initializeManagedReadSession, wrapping start only to capture and pass launch spec unchanged to startOwned. Old probe provider hardcodes WP0050 paths/full context and old localhost grant, so reuse patterns rather than its journey.
- risks: Numeric IP profile/provider-deny/no-mods native compatibility unproven. No-context current system does not imply history/cache erasure. Same-UID cooperative trust unchanged. Synthetic model does not prove learning quality.
- assumptions: C2 scoped offline/browser evidence remains valid; author cannot execute native before independent freeze review.
- recommended_next_action: Sole test author, offline provider/control checks, independent frozen safety review, master-owned native run, independent result corroboration.
- child_agent_requests: []
- child_report_bundle: []

## Accepted scope recommendations

1. Fresh synthetic private roots; two real host boots. Actual client creates and sends selected-context message, waits for completed receipt, reads exact user/reply history; reopen same Agent/conversation, repeat UUIDs without inference, send new UUID with no selected marker in current system. Record canonical hash after idle seed and require unchanged thereafter. Providers auth.json must be absent by metadata only.
2. Exact loopback Host/routes/model, no credentials/tools/forwarding, explicit header allowlist. At most32 requests,4 connections,16 requests/socket,4096 header bytes,262144 body bytes,64 messages,2s body/request deadlines,8192 response bytes; one normal inference per arm and two total. Default non-native refusal cases cover malformed/oversized/wrong authority/model/tools/unarmed/repeated requests.
3. Current managed profile byte hash captured unchanged. One finite policy child via real startOwned.output/stop, identical profile/env/cwd; allowed discovery must succeed, proven-live decoy must produce EPERM/EACCES, not timeout/refused. No raw launch spec/token logging. Optional synthetic provider/protected read/write negatives require existing targets, not ENOENT.
4. Reviewed digest covers new test, recursive imports, host/CLI/client/UI, manifests/locks and actual compiled index/bundle, with framed paths/lengths and duplicate rejection. Check darwin and two explicit gates before any fixture/listener/native spawn. Total150s, abort130s, receipt25s/100read polls, helper5s. Cleanup late acquisitions and all owned resources; any uncertain cleanup fails, retain fixtures without deletion.

## Security findings

No confirmed product defect requiring advance product edits. Native enablement remains gated by the missing integrated execution evidence and fresh independent frozen review. Canary unchanged without an attempted write is only an invariant, not standalone tool-confinement proof.
# Native generated-settings source map — repair3 handoff

Previous read-only security scout completed its 14-call map; its final status was BLOCKED because implementation/native verification remained outstanding, not because mapping lacked an external input. Main corroborated the guard and private-channel seam; no product or native execution was performed in that mapping. This section records evidence, not a new independent PASS.

Pinned source: `external:/private/tmp/personal-co-wp0048-runtime.o3519u/node_modules/@letta-ai/letta-code/letta.js`, SHA256 00e243ec4d963dec0e5130556e25916c478671507e7dc27e7513a9187703e1df.

- Lines142077–142125 inject provider_type and, when catalog is warm, context_window_limit/max_tokens. Agent create/update/read and conversation defaults merge these (138035–138214,139292–139297); cached conversations can retain cold shapes (139159–139185). Restart rebuilds in-memory model store; first turn refreshes missing models (141313–141335,141370–141416).
- LMStudio metadata/clamp (140722–140742,140899–140955) gives context<=128000 and output=min(32000,context). In-range arbitrary overrides can still change inference behavior (141882–141900), so numeric shape alone is insufficient.
- Fixed list_models force:true (223177–223181,397391–397449) refreshes shared native catalog. Entries expose updateArgs provider_type/context_window/max_output_tokens (225252–225307). Presets can exist without availability (225068–225089), so require exact configured handle also in available_handles. Consistent reasoning variants are fine; conflicting default tuples fail closed. Never forward reasoning/tool fields from updateArgs.
- Minimal repair uses private named catalog reader and an operation-frozen tuple across Agent/conversation/recovery/reset checks. Allow only native cold shapes or exact three-field matching defaults. No persistence normalization, arbitrary RPC, dependencies, provider fallback, or guard relaxation.
- Required test seams: current local-chat-operations fixture always returns empty settings, hiding actual singleton/hot shapes; local-chat-channel peer can supply bounded native catalog responses. Exact four-file scope and validation are in active WP d_fix_3_contract. Actual native execution requires independent renewed frozen clearance.
