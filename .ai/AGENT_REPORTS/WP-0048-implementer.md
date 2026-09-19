# WP-0048 implementer report

task_id: WP-0048-assistant-bootstrap

agent_role: implementer

status: PARTIAL

one_sentence_result: Implemented fixed one-shot native creation, durable marker-bound bootstrap/reopen and roots-only managed initialization; controlled validation passes, independent review/native evidence pending.

files_read:

- AGENTS.md (provided instructions); .ai/MASTER_CONTRACT.md; .ai/WORK_PACKAGES/WP-0048-assistant-bootstrap.yaml; .agents/skills/direction-guide/SKILL.md; .agents/skills/direction-guide/references/tool-policy.md.
- personal-co/server/assistant-bootstrap.mjs; personal-co/server/authenticated-app-server.mjs; personal-co/server/managed-read-session.mjs; personal-co/server/canonical-memory-store.mjs; personal-co/server/runtime-sandbox.mjs.
- personal-co/tests/assistant-bootstrap.test.mjs; personal-co/tests/authenticated-app-server.test.mjs; personal-co/tests/managed-read-session.test.mjs; scoped personal-co/tests/canonical-memory-store.test.mjs.
- personal-co/src/domain/app-server-memory-codec.mjs; personal-co/src/domain/memory.mjs; personal-co/src/domain/policy.mjs.
- Hash-only transitive inputs: personal-co/server/runtime-process.mjs; personal-co/server/conversation-reader.mjs; personal-co/server/package.json; personal-co/server/package-lock.json; scripts/probe_runtime_confinement.mjs.
- Untrusted-reference data only: /private/tmp/personal-co-wp0041.qRnOrc/node_modules/@letta-ai/letta-code/letta.js scoped creation ranges 136895–136915, 138095–138127, 144208–144240 and 223728–223750. No prior runtime state or credentials read.

files_changed:

- personal-co/server/assistant-bootstrap.mjs — new preparation/intent/canonical initialization and reopen module.
- personal-co/tests/assistant-bootstrap.test.mjs — new real-filesystem controlled tests and guarded native bootstrap/reopen test.
- personal-co/server/authenticated-app-server.mjs — named fixed createAssistantAgent operation; generic request remains six-read-only.
- personal-co/tests/authenticated-app-server.test.mjs — fixed creation, limits, ambiguity and source-digest coverage.
- personal-co/server/managed-read-session.mjs — initializeManagedReadSession roots-only entrypoint sharing existing owner/lifecycle; preparation cleanup uncertainty and late settlement handling.
- personal-co/tests/managed-read-session.test.mjs — preparation/lifecycle/real-filesystem initialization tests and transitive digest coverage.
- .ai/AGENT_REPORTS/WP-0048-implementer.md — this report.

commands_run:

- read_only: scoped cat/sed/rg reads listed above; scoped git diff --stat; SHA256 calculation over the 16 reviewFiles listed below. No Git mutation.
- workspace_write: apply_patch on the six reserved files and this report; standing scoped authorization applies. Controlled tests create/retain fresh private synthetic fixtures and remove only exact owned ephemeral lock/temp files through existing scoped code.
- verification: commands below. No install, provider calls, production changes, browser/UI work, historical native probe replay or actual upstream sandbox/runtime launch.

tests_run:

- Reproduction first: `WP0045_RUN_NATIVE=0 WP0047_RUN_NATIVE=0 WP0048_RUN_NATIVE=0 node --test --test-name-pattern='rejected canonical acquisition' personal-co/tests/assistant-bootstrap.test.mjs` — FAIL before guard, 1 test; preparation.close incorrectly resolved despite a retained canonical lock (Missing expected rejection).
- Same targeted command after guard — PASS, 1 test; retained lock remains, sanitized close rejects CLEANUP_FAILED.
- Final related command: `WP0045_RUN_NATIVE=0 WP0047_RUN_NATIVE=0 WP0048_RUN_NATIVE=0 node --test personal-co/tests/assistant-bootstrap.test.mjs personal-co/tests/managed-read-session.test.mjs personal-co/tests/authenticated-app-server.test.mjs personal-co/tests/conversation-reader.test.mjs personal-co/tests/canonical-memory-store.test.mjs` — 84 tests, 81 PASS, 3 native SKIP, 0 failures, including the rerun after the native-test-only dependency-root override/refreeze.
- Native-test name-pattern run with all RUN_NATIVE flags 0 after the override — 1 SKIP, no launch. Only WP0048 test accepts WP0048_DEPENDENCY_ROOT; unchanged sandbox validates root and exact pin.
- `cd personal-co && npm run typecheck` — PASS. npm printed an update notice; no update performed.
- `git diff --check` — PASS.
- Earlier author runs before the final guard: bootstrap/auth/manager 45 PASS/3 SKIP; related suite 80 PASS/3 SKIP; typecheck/whitespace PASS. Final results supersede them.
- Protocol/preaccept validation, independent security review and native execution remain master/verifier work, not claimed here.

evidence:

- AC1: fixed Personal Co/SYSTEM_PROMPT, personal-co-v1 plus 128-bit random marker, tools[]/memory_blocks[], correlated validated Agent response; one attempt per client; generic agent_create rejected. No arbitrary model, tools, files, keys or replay. Native-added MemFS tag allowed.
- AC2–AC3: preparation holds private cooperative lock before spawn and checks fresh empty state/protected roots. Authenticated empty tagged inventory precedes exclusive intent creation, file sync and directory sync. Intent existence never authorizes create; exact marker-visible singleton/retrieved Agent required. Unknown/partial intent retained; lost create response can only recover the same marker Agent.
- AC4: unchanged canonical store/codec/default factories create six stable-ID blocks, empty Archive/revision0 and exact runtimeBinding. Reopen verifies binding/identity/policy and preserves committed bytes, Archive, IDs and revision. Canonical memory stays host-side; native MemFS is not canonical. Standalone store root extensions remain trusted-host-owned, not mechanically immutable.
- AC5: old explicit-Agent entrypoint stays non-creating. Roots-only entrypoint shares the same process owner and returns only bounded {agentId} readiness plus existing read/status/terminal/close handles. Preparation acquisition/release failure, canonical close failure and conservative openStore rejection propagate cleanup uncertainty and retain the module lease. Late preparation resolution still attempts close after deadline, never publishes ready or replays creation.
- AC6: controlled cases cover creation/reopen, unrelated state/inventory, duplicates/wrong marker/retrieved ID/changed binding/policy/block IDs, lock contention, path permissions/symlinks/hardlinks/corrupt/oversized intent, cancellation, partial publication, lost response, canonical unknown publication, late cleanup and real-filesystem manager composition. Existing auth/reader/store tests pass.
- AC7: opt-in fresh-root native bootstrap-close-reopen test is prepared only. AC8 independent review/integration remains pending.

Frozen source SHA256, in native review digest concatenation order:

```text
75fdd0258dc1aa00f4893fded944f152d9c351bb7c6eb9717a132fcec241f516  personal-co/server/assistant-bootstrap.mjs
681283cbe4c9de72a1bef2cf7819e9b20e7afe9fd78dbed7e935c5bb7b7f8e15  personal-co/tests/assistant-bootstrap.test.mjs
a857d20bf20e43568062fd57249e78297a12113025edd62499c0c9f498f4ef98  personal-co/server/authenticated-app-server.mjs
a3c0643f4bb88cef96a1930f680d7219834e04f2852f42223f66ec94b605fcbc  personal-co/tests/authenticated-app-server.test.mjs
9902696257317d9b3282914b74d889ddb02bf52af41a39118b71a5ab96798f17  personal-co/server/managed-read-session.mjs
4911ada35b3c0854f23bb4e13caa0e6d6c70ee4ff91e7a8a48b55a8d31165ba5  personal-co/tests/managed-read-session.test.mjs
655cf00dfdedfb4cb542246fb15dc1b687f97af87694b44ffa78a976ba72cd4e  personal-co/server/runtime-process.mjs
4e612e45613a7d545203abf00f67fbde7de6157872ac230cccf6a55c5feba049  personal-co/server/runtime-sandbox.mjs
2559d01b2058f6f3093f6fe09e9ea2918e922e44d3b8d6732364409c6e9ec5ea  personal-co/server/conversation-reader.mjs
50493801badddaf816688e6f3dc8f1161751617f50d19fa5c7d1c8edd22be011  personal-co/server/canonical-memory-store.mjs
8d6a8a301b545c715e03aaaace71c55c02ba85193f330d6bd9a5c7bc271b1c8e  personal-co/src/domain/app-server-memory-codec.mjs
820f9160ca0e54214c8b8adfd9669a609f6bac45ae5984c237c6cb1a5448bc48  personal-co/src/domain/memory.mjs
94bd7e4795a514078ed26e914064fcbddb32a48df898bdd69422c0e34659a827  personal-co/src/domain/policy.mjs
ab35abf7940ec3f5534d838350d5cbff73e724ecd62d6fabcccd9de10a66fa03  personal-co/server/package.json
b4907aef21c4650f01d49c6870b051419a2795f4746ffbd001701bd1b14dfecc  personal-co/server/package-lock.json
53af5a81236275802e0512656252edf6ab6c728ec56325f5bda8634ede16f613  scripts/probe_runtime_confinement.mjs
combined: a135d68fd74c6956e131fba7c05c5a8b5f9655dfcc9ebe0a58440a1d6b8ca793
```

Superseded pre-environment-recovery digest: `969ff34a489ac3191be46d040e2cfd1ee2505c3c4393fdf0d4fa8ee4dd2fd24c`. Only the native test's explicit dependency-root override changed during refreeze; production pin/path validation is unchanged.

risks:

- Independent security/native evidence pending; controlled tests do not prove actual upstream creation/reopen/confinement.
- Experimental private /private/tmp macOS roots only. Runtime lease is module-local; bootstrap lock is cooperative, not hostile-same-uid protection or cross-process runtime ownership. Host controls paths; marker is correlation, not authentication. Visible inventory excludes hidden Agents.
- Intent is immutable/no-clobber but interrupted publication may retain corrupt/partial data; pending intent with no matching Agent requires explicit recovery, never automatic replacement. Startup-created state without intent is nonempty and cannot be adopted on retry. Stale locks/data are not stolen or deleted.
- Canonical ceiling is 1 MiB and intent ceiling 4096 bytes; oversized files fail closed and remain untouched. Local sync semantics only. All openStore acquisition rejections conservatively retain cleanup uncertainty, including cases where the store may actually have cleaned its lock.
- Startup budget 25 seconds and terminal cleanup budget 7 seconds bound reporting, not necessarily completion of unresolved OS filesystem I/O. Late settled work attempts owned cleanup; failed lease remains retained and there is no automatic recovery/restart.
- No browser/provider/send/context bridge/privacy retention/production deployment/full-assistant completion claim. Standalone canonical-store root extensions are host-owned and must not be treated as an authorization guarantee.

assumptions:

- Trusted host supplies canonical owned directories; test seams are not browser/model inputs. All created data is synthetic and fixtures are retained.
- Main's 2026-09-19 environment check found the old default CLI under `/private/tmp/personal-co-wp0041.qRnOrc/node_modules` missing (ENOENT); no native invocation is possible there. Main must resolve a freshly recovered canonical dependency root using the explicit WP0048_DEPENDENCY_ROOT override. Packet pin remains Letta Code 0.32.5, CLI SHA256 `00e243ec4d963dec0e5130556e25916c478671507e7dc27e7513a9187703e1df`, gitHead `1cf724938689a8f2bdb63bc03807db79a73d8f2d`, Node `/usr/local/bin/node` 24.15.0. Implementer made no install/pin changes or old-state read.
- Digest is change detection/operator attestation only, not authentication or proof that independent review occurred. Product bytes are frozen as of this report; subsequent edits require refreeze/review.

recommended_next_action:

Independent frozen-source security review and main's pinned artifact recovery first. After PASS only, master resolves the explicit canonical-root placeholder below and may run from repository root:

```sh
WP0045_RUN_NATIVE=0 WP0047_RUN_NATIVE=0 WP0048_RUN_NATIVE=1 WP0048_DEPENDENCY_ROOT='<MAIN_RESOLVED_CANONICAL_PINNED_NODE_MODULES_ROOT>' WP0048_REVIEWED_SHA256=a135d68fd74c6956e131fba7c05c5a8b5f9655dfcc9ebe0a58440a1d6b8ca793 node --test --test-name-pattern='native assistant bootstrap and same-Agent reopen' personal-co/tests/assistant-bootstrap.test.mjs
```

This prepares fresh private `/private/tmp/personal-co-wp0048-native-*` roots, uses the default manager and pinned install, creates at most one synthetic Agent then closes/reopens, verifies same identity and exact canonical bytes/six blocks/revision0/empty named history, and requires both owned cleanups. Public diagnostics only; no provider/input/tool/native-file commands. Retain fixtures; independently corroborate disk/identity/hash/process/listener evidence without replay, then master handles protocol/memory/Git integration.

child_agent_requests: none

child_report_bundle: none
