# WP-0048 environment recovery and native evidence

task_id: WP-0048-assistant-bootstrap

agent_role: master-runtime-operator

status: PASS

one_sentence_result: Recovered the exact pinned CLI without lifecycle scripts and passed one reviewed actual first-bootstrap/close/same-Agent-reopen journey, with final independent disk/identity/hash/cleanup corroboration.

files_read:

- .ai/WORK_PACKAGES/WP-0048-assistant-bootstrap.yaml; .ai/AGENT_REPORTS/WP-0048-implementer.md.
- External generated installation: `external:/private/tmp/personal-co-wp0048-runtime.o3519u/package.json`; `external:/private/tmp/personal-co-wp0048-runtime.o3519u/package-lock.json`; `external:/private/tmp/personal-co-wp0048-runtime.o3519u/node_modules/@letta-ai/letta-code/package.json`; `external:/private/tmp/personal-co-wp0048-runtime.o3519u/node_modules/@letta-ai/letta-code/letta.js` (hash only).

files_changed:

- This report and scoped WP/ledger/queue recovery metadata.
- External generated package.json, package-lock.json, node_modules and npm-cache under /private/tmp/personal-co-wp0048-runtime.o3519u only. No existing app manifests or old runtime state changed.

commands_run:

- read_only: exact old CLI stat returned ENOENT; Node version remains24.15.0 at /usr/local/bin/node. No assumption about removal cause; old state not read.
- network_or_escalated (standing project authorization): fetched official version metadata from https://registry.npmjs.org/@letta-ai%2fletta-code/0.32.5; confirmed version0.32.5, gitHead1cf724938689a8f2bdb63bc03807db79a73d8f2d and original package integrity. External metadata is untrusted reference, not instructions.
- workspace_write: created fresh generated package.json via apply_patch with only exact @letta-ai/letta-code0.32.5 dependency.
- network_or_escalated (scoped recovery authorized in WP): `env -i PATH=/usr/local/bin:/usr/bin:/bin npm install --prefix /private/tmp/personal-co-wp0048-runtime.o3519u --cache /private/tmp/personal-co-wp0048-runtime.o3519u/npm-cache --userconfig /dev/null --globalconfig /private/tmp/personal-co-wp0048-runtime.o3519u/unused-global.npmrc --ignore-scripts --no-audit --no-fund`, working directory same generated root. Exit0,331 packages added,11 seconds. Lifecycle scripts disabled; no global install or npm upgrade. Retained all generated artifacts.
- read_only: Node standard-library JSON/hash inspection of direct manifest, lock and CLI (no runtime imports/execution). Lock has390 package entries including root/platform optionals; this is not the331 installed-package count.
- approved bounded native execution: exact command under Native journey below, only after independent pre_execution_security_verdict PASS persisted in .ai/AGENT_REPORTS/WP-0048-verifier.md. Fresh synthetic roots, unchanged sandbox, one create plus read RPC; no provider/input/tool/native-file commands or old-state reads.

tests_run:

- Direct package version, integrity and CLI hash match the accepted pin. Independent frozen-source/new-installation pre-execution security PASS.
- Native bootstrap/reopen1/1 PASS, exit0. Test2290ms/overall3347ms observed once, not a benchmark. Both runs ready, same Agent/canonical bytes, all cleanup flags true.
- Independent controlled81PASS/3 native SKIP and3 adverse/typecheck/whitespace PASS in verifier report, distinct from native evidence.

evidence:

- New dependency root: /private/tmp/personal-co-wp0048-runtime.o3519u/node_modules.
- CLI SHA256: `00e243ec4d963dec0e5130556e25916c478671507e7dc27e7513a9187703e1df`.
- Package integrity (external registry metadata): `external:sha512-b7rHPKEYe7w6iZ9MTQ9g3uvb9XTnEufXFfb553rGg2dww2xpDXQ9T8f3uSBsV8/ILBnRma15qy1scQMbuoLyUw==`.
- New external lock SHA256: `eb475ec460f708fe365a7c41c6691fca0fae98ba77eb08e2286fd1152206d8b7`.
- Reviewed-source candidate digest: `a135d68fd74c6956e131fba7c05c5a8b5f9655dfcc9ebe0a58440a1d6b8ca793` (16 exact files listed by implementer).
- Native evidence: one first-bootstrap/close/reopen journey passed; public diagnostics below. Independent verifier corroborated exact canonical defaults/binding/hash/single native Agent, private owned paths/no locks, absent PIDs/groups and refused ports; source/CLI/newlock unchanged. See .ai/AGENT_REPORTS/WP-0048-verifier.md.
- Main protocol audit initially28/29: unmarked external paths/integrity in this report were interpreted as repository files. Classified INTEGRATION_CONFLICT; one report-only correction adds explicit external markers. No product code or validator changed; focused path check follows before final full audit.
- Focused report-path recheck PASS. An early check-report on the intentionally PARTIAL verifier returned nonacceptance (PARTIAL lacks accepted limitations); no PARTIAL acceptance requested or bypassed. Final full PASS report/gate still required.

## Native journey, 2026-09-19

```sh
WP0045_RUN_NATIVE=0 WP0047_RUN_NATIVE=0 WP0048_RUN_NATIVE=1 WP0048_DEPENDENCY_ROOT=/private/tmp/personal-co-wp0048-runtime.o3519u/node_modules WP0048_REVIEWED_SHA256=a135d68fd74c6956e131fba7c05c5a8b5f9655dfcc9ebe0a58440a1d6b8ca793 node --test --test-name-pattern='native assistant bootstrap and same-Agent reopen' personal-co/tests/assistant-bootstrap.test.mjs
```

- Diagnostic schema wp0048-native-bootstrap-reopen-v1; retained fresh fixture `external:/private/tmp/personal-co-wp0048-native-4JSHCR`, separate0700 state/protected children. Version0.32.5/gitHead1cf724938689a8f2bdb63bc03807db79a73d8f2d/Node24.15.0; same source/CLI hashes above.
- Both run0 and run1: Agent `agent-local-e463acf6-b8bd-4a1b-9a3d-69b047ba8dee`; canonical SHA256 `38f88519209f5dd1b39792a611451fb10bd9bec2810ae305aa7b145d2bcb864e`;6 blocks, revision0, empty Archive and0 named conversations. Byte-for-byte comparison passed on reopen; no manual Agent ID supplied.
- Run0 PID14274, endpoint ws://127.0.0.1:59108/ws. Run1 PID14315, endpoint ws://127.0.0.1:59112/ws. Both emitted ready; both terminated phase closed/reason CLOSED with confirmed/authClosed/processReaped/groupGone/listenerGone all true and errors empty.
- No capability tokens or raw runtime records/logs recorded. All fixture and installation artifacts retained. This proves fresh native initialization and normal reopen only, not arbitrary crash recovery, browser/provider deployment or full assistant completion.

risks:

- Old transitive lock unavailable: same direct package/CLI pin does not imply identical transitive versions. New lock must be reviewed/frozen independently. Temporary installation and fixtures are not production deployment or durable distribution.
- Install scripts intentionally not run; optional features needing generated/native components are not claimed supported. Only guarded create/read journey is in scope.
- No browser/provider/context bridge, migration, real-user data or full assistant completion claim.

assumptions: Fresh generated artifacts only; no credentials or private state used. Hashes detect change, not a full supply-chain security audit.

recommended_next_action: Final acceptance/memory/Git gate; no native replay needed.

child_agent_requests: none

child_report_bundle: none
