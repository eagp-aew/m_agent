# WP0044 implementation (master transcription)
## task_id
WP-0044-runtime-confinement
## agent_role
implementer wp0044_implementer
## status
PARTIAL
## one_sentence_result
Four-file launcher/probe package implemented and unit-tested; independent security review and actual confinement proof pending.
## files_read
AGENTS.md; .ai/MASTER_CONTRACT.md; .agents/skills/direction-guide/SKILL.md; .agents/skills/direction-guide/references/tool-policy.md; .ai/WORK_PACKAGES/WP-0044-runtime-confinement.yaml; .ai/AGENT_REPORTS/WP-0041-runtime.md; personal-co/server/canonical-memory-store.mjs; relevant personal-co/tests/canonical-memory-store.test.mjs; personal-co/src/domain/memory.mjs; personal-co/src/domain/app-server-memory-codec.mjs; personal-co/package.json; scripts/probe_app_server_contract.mjs; four assigned new files. external: approved runtime.sb, installed package manifest and scoped native protocol/CLI handlers under /private/tmp/personal-co-wp0041.qRnOrc.
## files_changed
personal-co/server/runtime-sandbox.mjs104 lines; personal-co/tests/runtime-sandbox.test.mjs102; scripts/probe_runtime_confinement.mjs365; tests/test_runtime_confinement_probe.mjs216. Total787 new lines.
## commands_run
Authorized read_only scoped source/Git/hash reads; workspace_write apply_patch only four reserved files. Controlled tests use new retained synthetic fixtures and individual owned lock/temp cleanup. git diff --check PASS; new-file no-index whitespace checks no findings (difference exit1). Import-safe sourceDigest computed; no actual sandbox/runtime, install, provider or existing state changes.
## tests_run
- node --test personal-co/tests/runtime-sandbox.test.mjs tests/test_runtime_confinement_probe.mjs:17/17 PASS.
- node --test tests/test_runtime_confinement_probe.mjs after cancellation hardening:11/11 PASS.
- cd personal-co && node --test tests/canonical-memory-store.test.mjs:15/15 PASS.
- cd personal-co && npm run typecheck: PASS.
## evidence
Deny-default disjoint private roots, manifest/CLI and exact Node checks; explicit five-key child env. Bounded fixed native requests, expected EPERM/EACCES,14 same-profile syscall checks and exact host-state comparison/revision commit are implemented, not yet actual proof. Mock coverage includes timeouts/malformed/limits/escalation/listener/tamper/cancellation; SIGINT/SIGTERM cleanup added before freeze.

SHA256 launcherbfdfbd5696a97cf71489be04f3b87298fb3fd65be7936f3ddf5d8b2346353b41; launcher-test974552f427f2beeb0a1846ea860dca3f203aecc22605ecd075474c272ee4d623; probedf9e176161786d7b31c92480ef28c621cf3f097dec67e74e7bb739cd6d922266; probe-test6d11c7996e1a5b49c685d3af63dda3a04fe763fe590ec90cb2b480d215ab48bb. Combineda863e58d121a1b1b4720adcbfbfbd51a6198d6734fea694ad773bb0bb8b33862.
## risks
No actual AC4 evidence yet. Trusted transitive install and same-uid path replacement outside threat model. Digest attestation is not auth/review proof. MacOS synthetic-only, native unauthenticated loopback; provider/gateway/lifecycle/retention/migration unresolved.
## assumptions
Host-controlled fixed install; exact Node24.15.0 /usr/local/bin/node. Synthetic directories retained. Master controls security review/live execution/project memory.
## recommended_next_action
Independent pre-execution review; main additionally flagged actual Listening base URL format mismatch and deviation from previously working Git PATH for reviewer reproduction. No live launch until review PASS.
## child_agent_requests
None.
## child_report_bundle
None.
