# WP0051 integration map

task_id: WP-0051-local-chat-integration
agent_role: explorer
status: PASS
one_sentence_result: Existing local UI/host can be extended; durable receipts must precede writes, and native context/reminder handling requires explicit integration rather than copying the probe.
files_read: AGENTS.md; .ai/MASTER_CONTRACT.md; .ai/WORK_PACKAGES/WP-0051-local-chat-integration.yaml; personal-co/PRODUCT_ROADMAP.md; .ai/AGENT_REPORTS/WP-0050-explorer.md; .ai/AGENT_REPORTS/WP-0050-verifier.md; directly referenced source/tests below.
files_changed: None by explorer; master persisted the independent report.
commands_run: Nine read_only sed/rg inspections of scoped source/tests; no network/runtime/private-state access. Two guessed filenames absent, corrected to actual paths.
tests_run: NOT_RUN; read-only mapping, not implementation verification.
evidence:

| Seam | Evidence and required integration |
|---|---|
| Existing UI | personal-co/src/components/LocalAssistant.tsx:19 and personal-co/src/services/local-read-client.mjs:84 own list/history/latest-result guards; extend with composer/create/recovery, no replacement UI. |
| Browser authority | local-read-client.mjs:10/39 and personal-co/server/local-read-host.mjs:207 strip launch fragment, use page-memory bearer and exact Host/Origin. Preserve fixed routes and no raw RPC. |
| HTTP lifetime | local-read-host.mjs:125/193/220 serializes reads with10s delivery cancellation. Mutation reservation/status must be separate from delivery timeout; disconnect must not imply cancellation/no side effect. |
| Native owner | personal-co/server/managed-read-session.mjs:67/169/224 owns bootstrap/auth/process/reader cleanup. Extend this owner, not another independent runtime. |
| Transport | personal-co/server/authenticated-app-server.mjs:72/169/251 rejects writes except fixed bootstrap and limits unsolicited messages; chat streams need bounded private channel methods. |
| Native contract | personal-co/server/probe-local-chat-turn.mjs:107/138/198/325 proves bounded input-to-multiple-run-to-one-terminal correlation, strict no-tools/skills and reflection-off. Probe is not production service. |
| Create/send identity | Probe:350–365 and accepted WP0050 evidence establish creation tag, send OTID and lack of cross-restart native dedupe. Protected host receipts before dispatch are required. |
| User text | personal-co/server/conversation-reader.mjs:56–77 concatenates native reminder parts. Use exact receipt/OTID/ownership to display original text; never indiscriminately strip user-authored tags. |
| Canonical context | Probe:344–349 forwards all blocks. Production needs relevant and current admission; freeform writable blocks do not provide a reliable structural supersession contract. |
| Provider/root | personal-co/server/runtime-sandbox.mjs:29–111 denies outbound, permits experimental private/tmp roots only. Explicit loopback LM Studio model plus exact-port grant is feasible first provider, not full deployment/hosted-provider completion. |

risks: Unknown operations must retain mutation barrier until reconciled; missing create tag or terminal does not prove no write. Current reader finite row budget is unsuitable for indefinite receipt polling. Retained recovery text adds sensitive business state. Native system/compiled prompt caches retain derived context; filtering new projection cannot erase old history. Provider quality/non-temporary deployment still unverified.
assumptions: Same pinned native source as accepted WP0050, retained chats only, canonical bootstrap owns exact Agent/root binding; no temporary-mode or full-product claim.
recommended_next_action: Implement receipt segment inside open WP0051; then package channel/operations/host/UI changes and context/provider policy. Independently verify segments and actual integrated path before acceptance.
child_agent_requests: none
child_report_bundle: none

## Storage and consumers

Root confirmed node:sqlite DatabaseSync under Node24.15.0, SQLite3.51.3 using an in-memory database, then reserved personal-co/server/chat-operation-store.mjs and personal-co/tests/chat-operation-store.test.mjs. No new dependency/service. Root chose one durable UNKNOWN reservation before dispatch, conservatively covering the reserve-to-send crash window without a second marker. Exact repeated payload returns receipt without dispatch permission; conflicting reuse rejects. Persist terminal before final history proof; terminal absent remains unknown. No exactly-once backend claim.

Managed session will own store; governed operations reserve/settle it; HTTP projects bounded receipt state; browser retains/query IDs and fetches pending records after reconnect; history uses exact retained original user text. Initial segment remains incomplete WP work, not accepted chat delivery.

Candidate later product paths (not yet write-authorized): existing local-read-host/cli, managed-read-session, authenticated-app-server, runtime-sandbox, conversation-reader, local-read-client and LocalAssistant; new bounded local-chat-channel and local-chat-operations. Relevant-context admission may require one focused domain module. Bootstrap/canonical store/codec, legacy adapter, manifests and synthetic probe remain unchanged unless a concrete need is separately scoped.

Validation plan: store transactions/reopen/concurrent handles/schema/private paths/uncertainty first; then channel/operations and affected read regressions, typecheck/export, actual browser desktop/narrow and independently reviewed integrated native journey. Reuse WP0050 evidence instead of replaying its standalone probe. No synthetic-provider evidence promoted to real-model quality.
