# WP0044 independent pre-execution review (master transcription)
Latest gate: fix2 scoped pre-execution PASS, as recorded at end. All earlier findings are historical; whole WP not yet accepted.
## task_id
WP-0044-runtime-confinement
## agent_role
security-reviewer wp0044_security
## status
PASS
## one_sentence_result
Fix1 independently resolves startup/PATH readiness without expanding grants; frozen sources approved only for bounded synthetic execution, not whole-WP acceptance.
## files_read
AGENTS.md; .ai/MASTER_CONTRACT.md; .agents/skills/direction-guide/SKILL.md; .agents/skills/direction-guide/references/tool-policy.md; .agents/skills/direction-guide/references/verification-gate.md; .ai/WORK_PACKAGES/WP-0044-runtime-confinement.yaml; .ai/AGENT_REPORTS/WP-0044-implementer.md; .ai/AGENT_REPORTS/WP-0041-runtime.md; personal-co/server/runtime-sandbox.mjs; personal-co/tests/runtime-sandbox.test.mjs; scripts/probe_runtime_confinement.mjs; tests/test_runtime_confinement_probe.mjs. Imports loaded permitted canonical store/codec/memory. external: /private/tmp/personal-co-wp0041.qRnOrc/runtime.sb and scoped pinned CLI startup source.
## files_changed
No repository/existing runtime files; authorized tests retained nine fresh synthetic fixtures and individual owned lock/temp cleanup.
## commands_run
Authorized read_only scoped pwd/wc/sed/nl/rg/Git/hash. Controlled node tests and ephemeral EventEmitter mock startup reproduction; no actual process/socket/sandbox.
## tests_run
node --test personal-co/tests/runtime-sandbox.test.mjs tests/test_runtime_confinement_probe.mjs:17/17 PASS. Independent genuine-log reproduction returned invalid_child_output; mocked cleanup reaped:true/groupGone:true.
## evidence
Four hashes match author freeze, combineda863e58d121a1b1b4720adcbfbfbd51a6198d6734fea694ad773bb0bb8b33862; installed CLI00e243ec4d963dec0e5130556e25916c478671507e7dc27e7513a9187703e1df. Static separate roots/read-only dependencies/state writes/protected denial/clean env/no outbound observed; not actual OS enforcement.
## risks
AC4 not run. Native unauthenticated loopback and host-controlled transitive install are synthetic-only boundaries. Digest uses unframed two-file concatenation and does not cover imports or authenticate review; individual source hashes provide separate evidence.
## assumptions
Host-controlled install/no hostile same-uid replacement; trusted test seams; master owns fixes/reports/execution.
## recommended_next_action
Run approved fixed synthetic probe once, retain evidence and obtain independent final verification. Historical initial FAIL below is resolved by fix1.
## child_agent_requests
None.
## child_report_bundle
None.
## security_findings
- MEDIUM IMPLEMENTATION_BUG: startOwned.endpoint in scripts/probe_runtime_confinement.mjs expects /ws in Listening line. Pinned external CLI422484-422490 sets url to base ws://127.0.0.1:port;445119-445120 prints Listening base and separate WebSocket control URL. Genuine two-line mock returns invalid_child_output. Positive unit test wrongly used /ws in Listening. No bypass observed.
- LOW static readiness gap: personal-co/server/runtime-sandbox.mjs PATH omits /Library/Developer/CommandLineTools/usr/bin even though that Git tree is explicitly readable and /usr/bin/git is not. No live Git failure reproduced; restore intended narrow lookup and re-review.
## acceptance_criteria_mapping
AC1 static/tests support boundary. AC2 intended profile supported, PATH unresolved. AC3 FAIL startup reproduction. AC4 NOT_RUN pre-execution gate. AC5 tests miss genuine output, security approval withheld. AC6 final evidence/closure pending.
## files_inspected
Listed sources/instructions only; no existing runtime state or unrelated histories.
## validation_or_reason_not_run
Actual execution prohibited and stopped at concrete readiness defect. Controlled17 tests and independent mock only.
## regression_risks
Preserve complete-line handling, exact loopback/path checks, duplicates/output bounds and owned cleanup while correcting parser.
## scope_violation_check
None observed.
## forbidden_files_check
No forbidden reads/writes, live execution, install/providers/children or batch deletion.
## verifier_score
- acceptance_criteria_checked: true
- tests_or_reason_present: true
- forbidden_files_checked: true
- risks_recorded: true
- recommendation: PASS

## Fix1 independent re-review (supersedes initial findings above)
pre_execution_approved: true
whole_work_package_accepted: false

Reviewer wp0044_security reused prior unchanged instructions/profile/pinned source evidence and read .ai/AGENT_REPORTS/WP-0044-fixer.md plus all four fixed source/test files. No repository/existing-runtime writes or actual execution. Combined20/20 Node tests PASS; independent byte-by-byte genuine startup at ports1/50123/65535 with unrelated stderr warning and mocked owned cleanup PASS. Four-file hashes/whitespace/final-newlines verified. Nine controlled synthetic fixture directories retained; no batch deletion.

Fixed SHA256 values: launcher4e612e45613a7d545203abf00f67fbde7de6157872ac230cccf6a55c5feba049; launcher-test132116d8a65bc0b00707ac9ea64f9ff800cfbced5e735d8f394844720beb907a; probe35703690657f7620e1f86f027f97ea813823c9ee32186a617eaadfd17449666f; probe-test03f6738278d99b992dd110390417749e58a76ee99060d2c102bed61def752ef8. Combined2a25906da3786ce5b2d98123644d67b4f22b20cad61e3e4bc05599b10190add2.

AC1 unchanged static/negative boundary supported; AC2 PATH restored without new grants; AC3 genuine complete matching URL pair and cleanup controlled PASS; AC4 actual execution pending; AC5 pre-execution PASS only; AC6 final evidence/closure pending. Both initial findings resolved, no new blocking regression. Risks remain actual kernel enforcement/cleanup unproven, synthetic-only unauthenticated loopback, trusted transitive installation/no hostile same-uid swap, digest not authentication/import coverage. No scope/forbidden-file violation. Approval applies only to these frozen files and the WP's macOS synthetic experiment.

## Fix2 focused independent review
wp0044_security status PASS; pre_execution_approved:true, whole_work_package_accepted:false. Actual attempt1 diagnosis/cleanup evidence remains in .ai/AGENT_REPORTS/WP-0044-runtime.md. Reviewer read updated fixer/probe/test sections and hashed all four files; no repository/existing-runtime writes, live runtime/sandbox/network/child agents. Targeted command `node --test --test-name-pattern='fixed probe mocked success|probe fails closed|tag' tests/test_runtime_confinement_probe.mjs`3/3 PASS covers success,8 existing failure paths,5 malformed tag cases;14 fresh synthetic fixtures retained. In-memory reconstruction confirms only source change since fix1 is exact expected returned tags. Missing/duplicate/unexpected/reordered tags fail before host initialization and mocked cleanup passes; success/ID/name checks unchanged. Launcher/test hashes unchanged. Probeff97750b558a0836492517c9bc03cde731dc9f96e7bf9f4f7bc5aa68843d85a8, test3bc6dd84139f473511d4b7d57b167625a7d6d3fa186b9365275bfba6cf8376eb, combined8d41c8fcae3c5ded4f88740cd10875a90c7d2e417d542bcdf98ab53851b39e46.

AC3 correction and AC5 focused gate PASS; AC1/AC2 unchanged; actual AC4/finalAC6 pending. Prior tag defect resolved; no new blocker/scope/forbidden-file violation. All score checks true, recommendation PASS. Exact tag order pinned to backend; prior synthetic/trust risks unchanged. Main may perform bounded actual experiment using revised digest, then independent final verification. No children requested or reports missing.
