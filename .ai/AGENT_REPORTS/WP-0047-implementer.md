# WP-0047 implementer report

task_id: WP-0047-managed-read-session

agent_role: implementer

status: PARTIAL

one_sentence_result: Implemented the owned managed read lifecycle and backward-compatible process-helper extraction; controlled evidence passes, while independent review and actual native cleanup evidence remain pending.

files_read:

- AGENTS.md; .ai/MASTER_CONTRACT.md; .agents/skills/direction-guide/SKILL.md and applicable packet/tool instructions; .ai/WORK_PACKAGES/WP-0047-managed-read-session.yaml.
- personal-co/server/runtime-sandbox.mjs; personal-co/server/authenticated-app-server.mjs; personal-co/server/conversation-reader.mjs; personal-co/server/runtime-process.mjs; personal-co/server/managed-read-session.mjs.
- scripts/probe_runtime_confinement.mjs; tests/test_runtime_confinement_probe.mjs; personal-co/tests/authenticated-app-server.test.mjs; personal-co/tests/conversation-reader.test.mjs; personal-co/tests/managed-read-session.test.mjs.
- Scoped package/lock bytes and Git diff evidence for freezing. No old runtime state, credentials or broad upstream source read for this work.

files_changed:

- personal-co/server/runtime-process.mjs (new): extracted bounded owned-process/endpoint/listener helpers; passive sanitized failure notification; no-PID cleanup requires actual reaping.
- personal-co/server/managed-read-session.mjs (new): captured trusted configuration, exact stateRoot module lease, startup/auth/visible-Agent preflight, opaque reader handle, synchronous delivery invalidation and bounded terminal cleanup.
- personal-co/tests/managed-read-session.test.mjs (new): controlled lifecycle tests, real loopback authentication/reader composition with controlled process, guarded opt-in native missing-Agent cleanup test.
- personal-co/server/authenticated-app-server.mjs: passive client.closed promise retaining confirmed/unconfirmed boolean.
- personal-co/tests/authenticated-app-server.test.mjs: passive true/false/late-close coverage; reviewed-source helper inclusion.
- scripts/probe_runtime_confinement.mjs: backward-compatible helper imports/reexports and extracted-helper digest coverage.
- .ai/AGENT_REPORTS/WP-0047-implementer.md: this report only.

commands_run:

- Scoped read-only sed/rg inspection of the files listed above; apply_patch for reserved files; scoped Git diff/stat and SHA256 calculation.
- `WP0045_RUN_NATIVE=0 WP0047_RUN_NATIVE=0 node --test personal-co/tests/managed-read-session.test.mjs personal-co/tests/authenticated-app-server.test.mjs personal-co/tests/conversation-reader.test.mjs tests/test_runtime_confinement_probe.mjs` (twice: initial 63 pass/2 skip; final 64 pass/2 skip).
- `cd personal-co && npm run typecheck` — PASS.
- `git diff --check` — PASS (including after final product edits).
- No upstream sandbox/runtime execution, dependency installation, Git mutation or batch deletion.

tests_run:

- Final combined run: 66 tests, 64 PASS, 2 native SKIP, 0 failures, approximately 1147 ms.
- Coverage: readiness and narrow immutable interface; config capture; duplicate/released/retained leases; invalid launch/auth/identity; timeout/bad endpoint/process error; no usable PID; passive post-ready process exit/error/log overflow/endpoint mismatch; idle socket closure; lifetime versus per-read abort; pending delivery suppression; immediate close/abort readiness rejection observer; late factory/connect disposal; bounded unresolved startup and auth/process/listener cleanup uncertainty; helper compatibility; real loopback ws authenticated read and observed listener refusal.
- Auth false cleanup deadline observed at approximately 1005 ms; subsequent late close cannot change settled false. Manager 100 ms controlled cleanup budget asserted to settle within 1 second and retain the uncertain lease.
- Existing reader and confinement helper controlled tests pass. Existing mock fixture directories are retained; no real data used.

evidence:

- The immediate handle exposes only ready, terminal, status, listConversations, listMessages and idempotent close; no raw client, process, launch spec, logs or credential.
- ready resolves undefined after authenticated pinned info and exactly one native-visible tagged expected Agent; it rejects a static error on startup termination and has an internal rejection observer. terminal resolves the separate sanitized cleanup result; callers must inspect cleanup.confirmed.
- Default startup deadline is 25 seconds; terminal cleanup budget is 7 seconds. Late continuations cannot publish readiness or spawn after termination; unresolved cleanup retains the lease. Process reaping, group absence and known endpoint refusal must be confirmed.
- Exact frozen SHA256 values, in the native review digest order:

```text
655cf00dfdedfb4cb542246fb15dc1b687f97af87694b44ffa78a976ba72cd4e  personal-co/server/runtime-process.mjs
438038c81bd54ddcbbd1bb6da9a3f839c239a76096861f5d81a0bbdc42d2e4f8  personal-co/server/managed-read-session.mjs
595af7073c2cf8924d1c6e5962cbc3dd479bd79438471df2861ecde77f977638  personal-co/tests/managed-read-session.test.mjs
b7bc683702e8eac0082aa8eba413f8749b080ae39c12279838afc1634ab77029  personal-co/server/authenticated-app-server.mjs
5ddacae824f042c0dcc73d12ecc92dfd0deb183c93100abd2772b82bd2ed4354  personal-co/tests/authenticated-app-server.test.mjs
53af5a81236275802e0512656252edf6ab6c728ec56325f5bda8634ede16f613  scripts/probe_runtime_confinement.mjs
4e612e45613a7d545203abf00f67fbde7de6157872ac230cccf6a55c5feba049  personal-co/server/runtime-sandbox.mjs
2559d01b2058f6f3093f6fe09e9ea2918e922e44d3b8d6732364409c6e9ec5ea  personal-co/server/conversation-reader.mjs
ab35abf7940ec3f5534d838350d5cbff73e724ecd62d6fabcccd9de10a66fa03  personal-co/server/package.json
b4907aef21c4650f01d49c6870b051419a2795f4746ffbd001701bd1b14dfecc  personal-co/server/package-lock.json
combined: 8f707aacae7e153bd7b07589a780a903a7e59ed1bf75a50149f85fc662192c82
```

- Native dependencyRoot remains `/private/tmp/personal-co-wp0041.qRnOrc/node_modules`; packet pin Letta Code 0.32.5, CLI SHA256 `00e243ec4d963dec0e5130556e25916c478671507e7dc27e7513a9187703e1df`, gitHead `1cf724938689a8f2bdb63bc03807db79a73d8f2d`, Node `/usr/local/bin/node` 24.15.0. No installation or pin changes.

risks:

- Independent frozen-source security review and actual native missing-Agent cleanup are not yet run; controlled results are not native confinement proof.
- Lease is exact-root exclusivity in one loaded host module only, not a disk lock or cross-process guarantee. Host owns directories; uncertain cleanup keeps its lease and needs host recovery, with no automatic retry/restart.
- Native uniqueness excludes hidden Agent records. Readiness is not provider availability, Agent bootstrap, full assistant readiness, browser authentication, production safety or memory/privacy retention proof.
- JavaScript cannot guarantee credential memory erasure; native capability permissions remain broader than this host's read-only RPC surface. No privileges or sandbox grants expanded.
- Deadline completion can report failure while a late trusted factory/transport continuation remains unresolved; such completion cannot release its lease or become ready.

assumptions:

- Trusted host owns immutable canonical disposable macOS roots and the configured expected Agent ID; third-argument injections/observer are trusted tests only, never caller/model inputs.
- Existing sandbox/auth/reader contracts and pinned install remain accepted unchanged transitive dependencies, except the explicit passive closed addition and helper extraction.
- The SHA256 guard detects source changes/operator attestation only; it is not authentication or proof that independent review occurred.

recommended_next_action:

Independent verifier reviews these frozen sources first. Only after security PASS, the master may run exactly once from repository root:

```sh
WP0045_RUN_NATIVE=0 WP0047_RUN_NATIVE=1 WP0047_REVIEWED_SHA256=8f707aacae7e153bd7b07589a780a903a7e59ed1bf75a50149f85fc662192c82 node --test --test-name-pattern='native managed missing-Agent cleanup' personal-co/tests/managed-read-session.test.mjs
```

The test creates/retains fresh private `/private/tmp/personal-co-wp0047-*` fixtures, performs authenticated info plus empty tagged-Agent inventory only, expects AGENT_MISMATCH, and requires owned process/group/socket/listener cleanup. It never creates an Agent, invokes provider turns or native file RPCs, or reads prior state. Any source change requires refreezing and review before execution. Master records native evidence and independent final corroboration, then integrates project memory/Git.

child_agent_requests: none

child_report_bundle: none
