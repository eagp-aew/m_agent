# Implementer Report: WP-0018 docs-policy

## task_id

`WP-0018-protocol-enforcement-hardening`

## agent_role

`implementer`

## status

`PARTIAL`

## one_sentence_result

Added the docs-policy surfaces for canonical tool policy, trust boundaries, and report audit expectations; assigned validation initially failed on historical report path issues outside the shard's allowed files.

## files_read

- `.ai/WORK_PACKAGES/WP-0018-protocol-enforcement-hardening.yaml` - work package scope.
- `.agents/skills/direction-guide/SKILL.md` - protocol entrypoint.
- `.agents/skills/direction-guide/references/context-packet-schema.md` - schema target.
- `.agents/skills/direction-guide/references/agent-report-template.md` - report target.
- `.agents/skills/direction-guide/references/config-policy.md` - approval/sandbox baseline.
- `.agents/skills/direction-guide/references/routing-matrix.md` - routing limits.
- `.ai/TEST_MATRIX.md` - validation matrix target.
- `external:/Users/jie/Downloads/m_agent_repository_review_and_fix_plan.md` - untrusted reference input.

## files_changed

- `.agents/skills/direction-guide/SKILL.md` - added tool-policy reference, trust-boundary requirement, and report audit guidance.
- `.agents/skills/direction-guide/references/context-packet-schema.md` - added required `trust_boundary` schema and field rules.
- `.agents/skills/direction-guide/references/agent-report-template.md` - added command classification and referenced evidence path expectations.
- `.agents/skills/direction-guide/references/tool-policy.md` - created canonical tool policy.
- `.ai/TEST_MATRIX.md` - added tool policy/trust boundary checks.

## commands_run

- `sed -n` and `rg` - `class: read_only` - docs and untrusted reference scope - `approval: not_required` - PASS.
- `git diff` and `git status --short --untracked-files=all` - `class: read_only` - repository scope - `approval: not_required` - PASS.
- `apply_patch` - `class: workspace_write` - reserved files only - `approval: not_required` - PASS.
- `python3 scripts/validate_protocol.py` - `class: read_only` - protocol validator - `approval: not_required` - FAIL before master report-path cleanup.

## tests_run

- `python3 scripts/validate_protocol.py` - `FAIL` - tool policy, trust boundary, packet fields, and report fields passed; failure was historical report path replayability outside this shard.

## evidence

- Validator output included PASS for `tool policy reference`, `trust boundary fields`, `context packet fields`, and `common report fields`.
- Failure was isolated to `.ai/AGENT_REPORTS/WP-0015-fallback-verification.md` and `.ai/AGENT_REPORTS/WP-0017-fallback-verification.md`, which the shard was forbidden to edit.
- Scoped diff contained only reserved documentation and test-matrix files.

## risks

- Historical report paths required master-owned cleanup before acceptance.

## assumptions

- Validator and durable memory/report files outside this shard belong to the validator shard or master integration.

## recommended_next_action

Master should integrate this docs shard with validator enforcement and resolve historical report path failures before accepting WP-0018.

## child_agent_requests

None

## child_report_bundle

None
