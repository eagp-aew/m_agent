# WP0051 C2 provider admission source review

task_id: WP-0051-local-chat-integration
agent_role: security-reviewer
status: BLOCKED
one_sentence_result: Minimal credential/mod admission is source-mapped; live chat enablement still requires implementation and fresh integrated verification, not a global development blocker.
files_read: AGENTS/contract/currentWP, explorer provider evidence; runtime-sandbox, managed-read-session, authenticated-app-server, assistant-bootstrap and directly related tests; exact pinned native ranges below.
files_changed: None by reviewer. Main persisted actual wp0051-c2-provider-scout return and six-call addendum.
commands_run: 20 initial plus6 addendum read-only bounded sed/rg/hash commands; no runtime, network or private state. Main separately corroborated auth store, mod registry/listener/disable source.
tests_run: None; source review only, native execution prohibited.
evidence: Saved auth/baseURL overrides env; absent auth file is an in-memory empty provider set. Fixed clean LETTA_DISABLE_MODS=1 returns a disabled listener adapter before loading sources and clears registered providers. Detailed source below.
risks: MEDIUM live-enable blocker until metadata gate/profile/env changes and independent native proof. Metadata checks are not atomic against hostile same-UID writers; model quality and non-temporary deployment unproven.
assumptions: Trusted pinned native/dependencies, fresh dedicated host-owned state with same-bootstrap reopen provenance; no arbitrary provider/env/mod RPC.
recommended_next_action: Same sole C2 writer implements exact provider metadata/ownership checks, chat-only subtree denial and no-mods env; independent frozen review then new integrated HTTP/native/synthetic-provider journey.
child_agent_requests: []
child_report_bundle: []

## Source and minimal gate

Pinned public bundle: external:/private/tmp/personal-co-wp0048-runtime.o3519u/node_modules/@letta-ai/letta-code/letta.js

SHA256:00e243ec4d963dec0e5130556e25916c478671507e7dc27e7513a9187703e1df; independently rechecked twice, main previously corroborated. No actual provider file or credential was read.

- Native84350-84365 reads runtime:stateRoot/providers/auth.json; absence returns empty in-memory providers.141272-141285 stored baseURL/key supersedes env. Current sandbox grants whole stateRoot read/write; exact network port alone is not a credential-absence proof.
- Capture/recheck canonical owned0700 root identity. runtime:stateRoot/providers may be absent or canonical owned0700 directory. auth.json lstat must return ENOENT: any object, dangling symlink, empty file or error rejects without open/parse/delete. Check root/parent identity before and after. Dedicated state only, no imported native state.
- Guard after bootstrap ownership acquisition before spawn, before ready and every fresh chat connection; guard failure stops owner, never retries. Add narrow serialized bootstrap ownership assertion for contextless operations rather than reading all memory. Chat-only Seatbelt deny provider subtree data-read/write; metadata may remain. Native compatibility still must be tested.
- Native140690-140715 omits discovery Authorization for not-needed;140763-140775 local provider sets Authorization:null;140940-140955 LMStudio discovery tries /api/v0/models then /v1/models. Explicit model may still cause discovery; headers/endpoint/model need observed proof.
- Registered provider precedence141440-141510 initially remained unmapped. Main/reviewer closed the relevant listener route:96182-96202 recognizes LETTA_DISABLE_MODS='1';396620-396642 createModAdapter returns disabled adapter before source discovery/engine.396876-396961 global/Agent listener both route there.225464-225506 disabled adapter clears permissions/tools/provider registry and reloads nothing;225427-225463 disabled registry/engine empty. Agent pre-adapter MemFS sync remains, so no MemFS-off claim.

## Required implementation/validation boundary

Exact added source/test reservations: `personal-co/server/runtime-sandbox.mjs`, `personal-co/tests/runtime-sandbox.test.mjs`, `personal-co/server/managed-read-session.mjs`, `personal-co/tests/managed-read-session.test.mjs`, `personal-co/server/assistant-bootstrap.mjs`, `personal-co/tests/assistant-bootstrap.test.mjs`. No authentication token, generic RPC, dependency or native bundle edits.

Offline tests: no-auth pass; all auth objects/IO errors rejected without data reads; symlink/owner/mode/inode changes rejected; before-spawn failure zero starts; post-ready pollution zero new connections and owner stopped; cancellation cannot late-publish; default read mode unchanged and inherited env cannot override fixed no-mods value.

Fresh integrated proof after frozen independent review: actual managed HTTP create/send, deterministic loopback provider capture of discovery/completion path/model/full headers, exact receipt/projected history; close/reopen sameAgent and send; provider metadata invariant, exact numeric-port enforcement/decoy no requests, owned cleanup. Synthetic input/output only, retained fixtures. Do not replay WP0050 standalone or label synthetic output model-quality proof. This source review alone is not acceptance.

security_findings: MEDIUM saved provider-record admission gap; no observed leak. Addendum found no provider-registration bypass in inspected disabled listener route. Runtime compatibility/headers remain unverified.
severity: MEDIUM
