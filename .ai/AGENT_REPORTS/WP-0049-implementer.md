# WP-0049 implementer

## task_id

WP-0049-local-browser-reader

## agent_role

implementer

## status

PARTIAL — controlled implementation complete and master reports final browser corroboration; independent review and guarded actual-native evidence remain with master/verifier.

## one_sentence_result

Added an opt-in Chinese browser read surface over a bounded authenticated loopback host, preserving explicit retained-only admission and the existing managed runtime lifecycle without enabling sends or providers.

## files_read

- AGENTS.md
- .ai/MASTER_CONTRACT.md
- .agents/skills/direction-guide/SKILL.md and .agents/skills/direction-guide/references/tool-policy.md (previous applicable context reused)
- .ai/WORK_PACKAGES/WP-0049-local-browser-reader.yaml
- .ai/DECISIONS.md (DEC0045)
- .ai/TEST_MATRIX.md (relevant validation)
- All twelve product/test/document paths in files_changed below.
- personal-co/server/assistant-bootstrap.mjs
- personal-co/server/authenticated-app-server.mjs
- personal-co/server/runtime-process.mjs
- personal-co/server/runtime-sandbox.mjs
- personal-co/server/canonical-memory-store.mjs
- personal-co/src/domain/app-server-memory-codec.mjs
- personal-co/src/domain/memory.mjs
- personal-co/src/domain/policy.mjs
- personal-co/server/package.json
- personal-co/server/package-lock.json
- personal-co/package.json
- personal-co/package-lock.json
- personal-co/index.ts
- personal-co/tsconfig.json
- personal-co/dist/index.html and its one compiled JS asset (listed below).

## files_changed

- personal-co/server/local-read-host.mjs (new)
- personal-co/server/local-read-cli.mjs (new)
- personal-co/server/conversation-reader.mjs
- personal-co/server/managed-read-session.mjs
- personal-co/tests/local-read-host.test.mjs (new)
- personal-co/tests/conversation-reader.test.mjs
- personal-co/tests/managed-read-session.test.mjs
- personal-co/src/services/local-read-client.mjs (new)
- personal-co/src/components/LocalAssistant.tsx (new)
- personal-co/tests/local-read-client.test.mjs (new)
- personal-co/App.tsx
- personal-co/README.md
- .ai/AGENT_REPORTS/WP-0049-implementer.md (this report only)

Generated ignored Expo dist and retained fresh synthetic test fixtures; no dependency, native install, old-state or unrelated product edits. No Git mutations or deletion.

## commands_run

```sh
WP0045_RUN_NATIVE=0 WP0047_RUN_NATIVE=0 WP0048_RUN_NATIVE=0 WP0049_RUN_NATIVE=0 node --test personal-co/tests/local-read-host.test.mjs personal-co/tests/local-read-client.test.mjs personal-co/tests/conversation-reader.test.mjs personal-co/tests/managed-read-session.test.mjs
WP0045_RUN_NATIVE=0 WP0047_RUN_NATIVE=0 WP0048_RUN_NATIVE=0 WP0049_RUN_NATIVE=0 node --test personal-co/tests/authenticated-app-server.test.mjs personal-co/tests/assistant-bootstrap.test.mjs personal-co/tests/canonical-memory-store.test.mjs
cd personal-co && npm run typecheck
cd personal-co && EXPO_NO_TELEMETRY=1 npm run export:web
git diff --check
WP0049_RUN_NATIVE=0 node --test --test-name-pattern='rapid history selection' personal-co/tests/local-read-host.test.mjs
WP0049_RUN_NATIVE=0 node --test --test-name-pattern='rapid history selection|pending' personal-co/tests/local-read-host.test.mjs
```

Also scoped sed/rg/diff inspection, narrower host regression selections during authoring, and read-only Node SHA256 computation over the exact reviewFiles array plus exported index/JS. No native opt-in command was executed. Full legacy npm test not repeated: App change is a small explicit-mode wrapper; legacy component body remains unchanged, controlled opt-out, typecheck/export and master legacy browser QA cover this boundary.

## tests_run

- Final targeted suite: **52 PASS, 2 native SKIP, 0 FAIL** (54 total).
- Related auth/bootstrap/store suite: **46 PASS, 2 native SKIP, 0 FAIL** (48 total); unchanged dependencies since that run.
- Typecheck PASS; Expo export PASS (286 modules); final diff whitespace PASS.
- Actual HTTP tests exercise capability/Origin/Host/duplicate headers/CORS denial, fixed schema and byte limits, projected responses, static links/traversal/private rejection, per-read disconnect, request deadlines, passive termination, uncertain cleanup and late startup binding.
- Reader/manager tests cover strict retainedOnly boolean capture/default compatibility, unmarked/temporary/excluded admission, pre/post history privacy, empty filtered continuation and existing cursor/identity/lifecycle contracts.
- Browser client tests cover synchronous fragment removal, memory-only credential/disconnect, legacy opt-out, bounded response validation, stale search/selection, abort suppression, one-time start and uncertain continuation without replay.
- Master browser QA found rapid switching while an old real-reader delivery remained busy. Controlled HTTP + real-reader regression reproduced **429 instead of 200 before correction**. The bounded serialized delivery correction passes; canceled queued work never dispatches and a hung active operation cannot grow active work. After freeze, master reported final-host-hash browser corroboration: delayed04→05 shows only latest05 with no stale04/error, and slow-search→new-search passes. This is attributed master evidence; its browser report owns the complete desktop/390px results.
- Earlier author HTTP regressions exposed keep-alive reset on denied requests and a deadline-race leaving read cancellation unsignalled; corrected via explicit error-response connection close and unconditional catch-path delivery abort. Final tests pass.

## evidence

The host returns only `{origin, agentId, launchUrl, terminal, close}`. It creates one managed initialization, always sets retainedOnly true, and exposes exactly status/conversations/messages POST reads. Browser and upstream capabilities are separate. Request errors never carry raw errors/paths. Limits are four concurrent HTTP deliveries, one active read plus at most three queued, 32 sockets, 4KiB body, 2MiB JSON response, 8MiB static asset and 10-second request/cleanup reporting deadlines. No automatic read/cursor replay.

Trusted browser-fixture seam: `await startLocalReadHost({dependencyRoot,stateRoot,protectedRoot,webRoot}, {signal}, {makeSession, capability, observe, requestMs, listen})`. A fixture may inject a public synthetic 64-hex capability and fake managed session (`ready`, `terminal`, `status`, `listConversations`, `listMessages`, `close`). Production defaults generate a private random browser capability and use unchanged managed bootstrap. `observe` receives only managed public lifecycle evidence; listen is a controlled late-binding test seam. Never persist an actual launch link or native credential.

Frozen **combined SHA256**: `25f16d36e6c245d96385945a7762591a7ed8c6c243ce69176faf35c10081cdc6`. Computation is raw file bytes concatenated in the following order, exactly matching native test reviewFiles, then compiled index and its sole sorted script. This is change detection/operator attestation, not authentication or proof of review.

```text
2b64c649fbd157020f638be4d91fc47b931b625f578681c56a1d441249aeed58 personal-co/server/local-read-host.mjs
6fc55886f94f65dfa846e29e1e26d54349b73edc58c9854fbd6d32f991d97557 personal-co/server/local-read-cli.mjs
c18601ef40e98cc69e0337d2523a7b0372b45ca2926e85c4eeb45e7c5a62933c personal-co/tests/local-read-host.test.mjs
2a3b1f09bdfb6fe24fc050a3e35cc3e511736c02d81fde73b4d68353cc615210 personal-co/server/conversation-reader.mjs
b7c96c4160f5b277ed37e25fc1ef85ab00fd749c087019891cba493ebe00cd93 personal-co/tests/conversation-reader.test.mjs
a2fc9bbd98ff81460a9277c0f2c901e3224a6b7d2015b61b25017bebee6d6cb7 personal-co/server/managed-read-session.mjs
9ed6a204ae73b5f14ae948bbc426a7b116df2e5ccaaf96657949305650aaa4c6 personal-co/tests/managed-read-session.test.mjs
ddd60f8ec52f804227f4eed254c7cde2b991b2d17a3431ba1992c2f268409d08 personal-co/src/services/local-read-client.mjs
f89af174064df4a7ab0316acd08d13bc55b2665f0a9712509b0e616ad1176be2 personal-co/src/components/LocalAssistant.tsx
c5366315c8c7ddc32b2da5453392c51a79b50714a88d779487ecc48288e5dc50 personal-co/tests/local-read-client.test.mjs
81f158179e9397cb3253b438ba27664224ebf27ebdbacb7a6819cab894123e91 personal-co/App.tsx
18e43af9c91865c90f961d64b76b04e7f77d3ce249a8fa8b5d5beb6ab1e07c01 personal-co/README.md
75fdd0258dc1aa00f4893fded944f152d9c351bb7c6eb9717a132fcec241f516 personal-co/server/assistant-bootstrap.mjs
a857d20bf20e43568062fd57249e78297a12113025edd62499c0c9f498f4ef98 personal-co/server/authenticated-app-server.mjs
655cf00dfdedfb4cb542246fb15dc1b687f97af87694b44ffa78a976ba72cd4e personal-co/server/runtime-process.mjs
4e612e45613a7d545203abf00f67fbde7de6157872ac230cccf6a55c5feba049 personal-co/server/runtime-sandbox.mjs
50493801badddaf816688e6f3dc8f1161751617f50d19fa5c7d1c8edd22be011 personal-co/server/canonical-memory-store.mjs
8d6a8a301b545c715e03aaaace71c55c02ba85193f330d6bd9a5c7bc271b1c8e personal-co/src/domain/app-server-memory-codec.mjs
820f9160ca0e54214c8b8adfd9669a609f6bac45ae5984c237c6cb1a5448bc48 personal-co/src/domain/memory.mjs
94bd7e4795a514078ed26e914064fcbddb32a48df898bdd69422c0e34659a827 personal-co/src/domain/policy.mjs
ab35abf7940ec3f5534d838350d5cbff73e724ecd62d6fabcccd9de10a66fa03 personal-co/server/package.json
b4907aef21c4650f01d49c6870b051419a2795f4746ffbd001701bd1b14dfecc personal-co/server/package-lock.json
556ad077636a87dafaa52893ba562766860e95e5772f22fc99ce97b79cb26ebe personal-co/package.json
ab584beec884c6a446d4d915a6771e69fbdf3e21ad59317804486c8a10345f49 personal-co/package-lock.json
9feb78c747e7c526cb3ab8f57210053654d966ba71aa24328088c3ebcc5ff76f personal-co/index.ts
f8cf65e2926673d070fe41d3b2c1664384e03bdf901e899365acbc3f47da0fe4 personal-co/tsconfig.json
63aa3ba3ac661a4c25a798caeedc69b6c1b5e0d4bf41b5225b4b83024bb3d565 personal-co/dist/index.html
868e8171fe0cbc6888614ab22815d1db691bcc459c3485ec80a03be3a89ed0db personal-co/dist/_expo/static/js/web/index-7e684b7634c521644df45d7cf6afeb11.js
```

Compiled index is 1178 bytes; JS is 701698 bytes. Export metadata is not served. CSP matches observed self-hosted script/inline React Native styles. No UI source changed after export; final queue change is server-only.

Exact proposed command, **master only after independent frozen-source security PASS**:

```sh
WP0045_RUN_NATIVE=0 WP0047_RUN_NATIVE=0 WP0048_RUN_NATIVE=0 WP0049_RUN_NATIVE=1 WP0049_DEPENDENCY_ROOT=/private/tmp/personal-co-wp0048-runtime.o3519u/node_modules WP0049_WEB_ROOT=/Users/jie/Desktop/assistant/personal-co/dist WP0049_REVIEWED_SHA256=25f16d36e6c245d96385945a7762591a7ed8c6c243ce69176faf35c10081cdc6 node --test --test-name-pattern='native local browser host status and empty retained list' personal-co/tests/local-read-host.test.mjs
```

Uses only new retained private `/private/tmp/personal-co-wp0049-native-*` state/protected roots, default actual host/bootstrap, status + empty retained list + wrong browser authorization denial, and confirmed owned cleanup. DependencyRoot is the master-restored pinned Letta Code 0.32.5 install: CLI SHA256 `00e243ec4d963dec0e5130556e25916c478671507e7dc27e7513a9187703e1df`, recovery lock SHA256 `eb475ec460f708fe365a7c41c6691fca0fae98ba77eb08e2286fd1152206d8b7`, Node24.15.0 (packet evidence, not newly executed native proof). No provider/input/tool/file commands or existing-state inspection.

## risks

- AC7/AC8 remain pending independent source/native/browser acceptance; controlled tests are not native or model quality evidence.
- Tags are a trusted-host admission convention, not protection against same-user processes, deletion proof or full temporary-mode implementation. Unknown conversations remain excluded; no tag-writing UI is added.
- Browser disconnect clears page data/capability references but does not stop the operator host or securely erase JavaScript memory. Refresh needs reopening the original private launch link. Link access is bearer authority.
- Canonical owned static roots are trusted deployment inputs; same-user concurrent filesystem mutation is outside the threat boundary. Static files/links and size checks fail closed but are not a hostile same-UID filesystem sandbox.
- Runtime/bootstrap retain previous macOS temporary-root, cooperative module-lock, immutable-intent and bounded cleanup uncertainty limitations. Underlying hung IO may outlive a failed cleanup reporting deadline; no unconfirmed cleanup is called successful.
- Read queues are finite, not guaranteed availability under stalled upstream work. Aborted borrowed RPCs retain the existing reader's bounded pending budget; repeated abandoned reads may fail explicitly. No retries or consumed-cursor replay.
- Sending, provider setup, canonical model context, classification and production deployment remain incomplete. Legacy remote path is retained, not unified by this slice.

## assumptions

Trusted operator supplies reviewed dependency and web roots plus private synthetic state/protected roots; retained tags are assigned by a trusted future host flow. Main owns browser fixture processes, independent review, native dispatch and integration. No new dependencies are required. Existing accepted runtime/source contracts remain unchanged except the scoped retainedOnly option.

## recommended_next_action

Independently review frozen bytes and master's browser evidence, then run the one exact guarded default-host native test after security PASS. Verify owned process/listener absence without replay; main records AC7/AC8/memory and handles scoped integration. Recompute hashes after any product/test/compiled edit.

## child_agent_requests

None.

## child_report_bundle

None; no children spawned.
