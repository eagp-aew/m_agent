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

## Native scout B — PARTIAL source map

Read-only explorer returned PARTIAL after bounded source inspection; no writes, tests, native execution or private-state reads. Initial oversized generic search stopped; master supplied exact ranges and ten further calls. One mistyped rg option was corrected. Prior source pin/evidence reused, not runtime validation.

- Pinned Letta0.32.5 CLI at external:/private/tmp/personal-co-wp0048-runtime.o3519u/node_modules/@letta-ai/letta-code/letta.js: 105608–105759 per-connection subscriptions and sequence; 397960–398003 runtime_start adds rather than replaces scope; 418553–418562 scoped commands subscribe. Fresh one-operation socket avoids stale scope accumulation.
- Native lines419586–419649 install close cleanup;415000–415037 request cancellation/remove queues/unsubscribe;101185–101200 evict only idle scopes. Socket close is not a hard inference-stop receipt; uncertain outcomes stop the owned process and remain unknown.
- Native137097–137141 user projections expose OTID, assistant projections lack run/turn/OTID.138768–138795 missing pagination cursor silently leaves range unbounded. Require exact tail boundary, bounded advancement, unique expected OTID/user/final original textpart, new following assistant rows and correlated terminal under exclusive host writing; timestamps are not causal proof.
- Native144324–144343 conversation model/settings override Agent;144477–144538 system hash controls compilation. Reject unexpected overrides before input. No inference from Agent model alone.
- Root corroboration this continuation:419407 getParsedRuntimeScope requires runtime property, absent from six read commands.422340 default single socket attachment;223569 lifecycle only pong and223579 parsed command list excludes ACK. ACK is not durable acceptance evidence. Broadcast budget still enforced. Source-only evidence does not prove real-provider quality or full event isolation.

Next action: packaged segmentB actual managed-session consumer. Privacy-selected canonical context and browser enablement remain required segmentC; no fullWP acceptance.

## C integration map, current baseline2abf1ab

Independent explorer wp0051-context-ui-scout returned PASS mapping only after five read-only calls; no writes/tests/native/browser. Main corroborated directly affected source. Existing HTTP/client/UI/CLI should be extended, not replaced:

- `personal-co/server/local-read-host.mjs` lines207–225 authenticates fixed status/list/history routes. Add only named submit/operation/pending/recover-create and context-preview routes; keep exact Host/Origin/bearer/cookie rejection. Project safe receipt fields, never raw native terminal/token/root/settings. Status needs chatEnabled and host-observed active operation, because durable UNKNOWN does not itself mean currently processing.
- `personal-co/server/local-chat-operations.mjs` lines184–201 already reserves synchronously before background work. HTTP delivery cancellation must not cancel the durable operation. Status/submit stay outside the single borrowed-reader queue. Uncertain native termination currently closes HTTP: preserve browser draft/UUID, say unknown, reopen via a fresh operator link and inspect pending; never auto-resend.
- `personal-co/src/services/local-read-client.mjs` lines10–18 strip the fragment synchronously and never persist credentials. Controller must retain per-conversation drafts, snapshot UUID/request before send, clear only the exact completed draft, and ignore stale deliveries after switching. Unknown send has no resend button; create recovery only checks existing result. Refresh-safe draft persistence remains a separately required privacy-aware feature, not claimed by page-local state.
- `personal-co/server/conversation-reader.mjs` lines56–77 discard OTID while flattening native reminders; HTTP-only text replacement is too late. Add trusted receipt projection at this boundary with exact Agent/conversation/OTID/original text binding and explicit unmatched/conflicting behavior; never generic tag stripping. Existing non-chat read path remains tested unchanged.
- Host/client4KiB JSON input bound is smaller than store16KiB UTF8 input with escaping; submit-only128KiB envelope supports the current contract. Keep read route bounds and2MiB output cap. UI byte validation cannot rely only on maxLength. Add accessible composer/create/recovery/context controls to `personal-co/src/components/LocalAssistant.tsx`; preserve narrow layout, retained-mode disclosure and no temporary/reminder claims.
- C2 candidate exact product paths: current HTTP/CLI/managed owner/operations/reader/client/LocalAssistant/README and corresponding tests. Existing App entry and dependency manifests need no change. Validate controlled real HTTP/controller, typecheck/export, then desktop/narrow browser journeys; native/model admission independently reviewed before live enablement.

## Main source corroboration: provider admission remains a native gate

No private state/configuration was read. Current pinned source SHA256 rechecked as00e243ec4d963dec0e5130556e25916c478671507e7dc27e7513a9187703e1df at the same external CLI path above. Source-only observations:

- Lines84350–84365 resolve provider records from runtime:stateRoot/providers/auth.json; absent file gives empty records.140570–140655 maps stored API/OAuth credentials into runtime auth.141703–141712 reads stored baseURL before environment;141821–141880 merges resolved auth and can override URL/headers.
- Lines84300–84311 define LM Studio environment/default endpoint and no-key fallback.141272–141285 endpoint selection prefers stored record over LMSTUDIO_BASE_URL.142137–142139 preserves an explicit selected model handle, but141400–141420 can refresh model catalogs if absent; fixed model selection is not proof of zero startup/discovery requests.
- Existing sandbox exact outbound port limits destinations but does not prove that stored credentials are absent or that model selection/traffic matches the user's intent. Before native/browser enablement, bound provider-record admission without reading/exposing secrets and verify actual request endpoint/model/headers plus numeric-port enforcement using fresh synthetic state. Do not repeat WP0050 standalone proof or treat source mapping as runtime evidence.
