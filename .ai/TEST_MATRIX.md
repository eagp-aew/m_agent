# Test Matrix

This repository is a Codex multi-agent direction-system scaffold, not an application with a package manager or runtime test suite. Use deterministic scaffold and documentation checks until a dedicated validator is introduced.

## Default validation order

1. Targeted test for changed behavior.
2. Related package/module tests.
3. Typecheck.
4. Lint.
5. Build.
6. Full suite only when necessary.

## Commands

| Area | Command | When to run | Notes |
|---|---|---|---|
| Scaffold presence | `test -f .agents/skills/direction-guide/SKILL.md && test -f .codex/config.toml && test -f AGENTS.md` | Any scaffold change | Confirms core entrypoints exist. |
| Agent definitions | `test -f .codex/agents/explorer.toml && test -f .codex/agents/implementer.toml && test -f .codex/agents/verifier.toml && test -f .codex/agents/fixer.toml && test -f .codex/agents/integrator.toml && test -f .codex/agents/security-reviewer.toml` | Changes under `.codex/agents/` | Confirms the MVP role set exists. |
| Skill metadata | `python3 scripts/validate_protocol.py` | Changes to `direction-guide` | Confirms `SKILL.md` frontmatter is parseable and includes `name` and `description`. |
| Protocol validator | `python3 scripts/validate_protocol.py` | Protocol scaffold, role-agent, config, or memory changes | Preferred repeatable check for master-agent protocol consistency. |
| Historical work-package exception accounting | `python3 scripts/validate_protocol.py` | Metrics, task queue, or validator changes that affect work-package coverage | Confirms accepted work has `work_package_path` except the four enumerated pre-enforcement tasks linked to historical fallback verification. |
| Ledger DONE closure | `python3 scripts/validate_protocol.py` | Before marking a work package ledger state `DONE` | Fails if DONE retains active agent runs, active parallel batch, file reservations, worktree assignments, nonzero write-agent count, or null per-work-package metrics. |
| Protocol gate | `python3 scripts/protocol_gate.py audit` | Before accepting protocol scaffold changes | Runs the validator through the gate command surface. |
| Pre-accept gate | `python3 scripts/protocol_gate.py pre-accept <task_id> --report <report_path>` | Before marking implementation-capable work accepted | Confirms validator, work-package status, and verifier report evidence are acceptable. |
| Negative validator tests | `python3 -m unittest tests/test_validate_protocol.py` | Validator or protocol-gate changes | Exercises malformed metadata, unreplayable report paths, fake secret detection, and report-gate failure behavior. |
| Runtime export bundle | `python3 scripts/validate_protocol.py` | README, INSTALLATION, `.ai/TEST_MATRIX.md`, or export/adoption guidance changes | Confirms the repeatable validator still covers required runtime entrypoints, role definitions, the `direction-guide` skill, and `.ai` runtime memory/control files. |
| Tool policy alignment | `python3 scripts/validate_protocol.py` | Changes to command, trust-boundary, or report-audit policy | Confirms the canonical tool policy, packet schema, report template, and direction guide stay aligned. |
| Schema and context profile alignment | `python3 scripts/validate_protocol.py` | Changes to work-package metadata, fallback verification, execution budgets, structured errors, supersession, or context profile guidance | Confirms canonical protocol docs stay aligned until deeper schema checks are added. |
| Placeholder scan | `rg -n "TODO|Replace this section|YYYY-MM-DD|TBD" .ai AGENTS.md .codex .agents/skills/direction-guide -g '!.ai/TEST_MATRIX.md'` | Before accepting memory/scaffold changes | Remaining placeholders must be intentional or queued. |
| Scope check | `git status --short` | Before final review | Ensure only intended scaffold/memory files changed. |

## Context Packet and Report Alignment Check

Purpose: Ensure context packet requirements, role-agent instructions, report template, and Direction Guide protocol remain aligned.

Files checked:

- `.agents/skills/direction-guide/SKILL.md`
- `.agents/skills/direction-guide/references/context-packet-schema.md`
- `.agents/skills/direction-guide/references/agent-report-template.md`
- `.agents/skills/direction-guide/references/tool-policy.md`
- `.codex/agents/explorer.toml`
- `.codex/agents/implementer.toml`
- `.codex/agents/verifier.toml`
- `.codex/agents/fixer.toml`
- `.codex/agents/integrator.toml`
- `.codex/agents/security-reviewer.toml`

Checks:

1. Verify `SKILL.md` and `context-packet-schema.md` list the same required context packet fields: `task_id`, `agent_role`, `objective`, `source_of_truth`, `trust_boundary`, `must_read`, `may_read`, `do_not_read`, `allowed_files`, `forbidden_files`, `acceptance_criteria`, `validation_commands`, `output_schema`, `stop_conditions`, and `max_context_notes`.
2. Verify every `.codex/agents/*.toml` file states that `context_packet` is the source of truth.
3. Verify every `.codex/agents/*.toml` file requires `BLOCKED` when required packet fields are missing or packet fields conflict.
4. Verify every `.codex/agents/*.toml` file includes `trust_boundary` in the required packet-field validation list.
5. Verify every `.codex/agents/*.toml` file references all read-scope fields: `must_read`, `may_read`, and `do_not_read`.
6. Verify every `.codex/agents/*.toml` file references all write-scope fields: `allowed_files` and `forbidden_files`.
7. Verify context packet trust-boundary coverage includes instruction priority, external inputs, tool outputs, durable memory, and quarantine behavior.
8. Verify `agent-report-template.md`, `context-packet-schema.md`, and `SKILL.md` list the same required common report fields: `task_id`, `agent_role`, `status`, `one_sentence_result`, `files_read`, `files_changed`, `commands_run`, `tests_run`, `evidence`, `risks`, `assumptions`, `recommended_next_action`, `child_agent_requests`, and `child_report_bundle`.
9. Verify `agent-report-template.md` requires command policy classification and referenced evidence paths or explicit external markers.
10. Verify `tool-policy.md` defines command classes, destructive-command handling, network/escalation handling, path boundaries, trust-boundary handling, and report audit expectations.
11. Verify role-specific report sections appear only as optional extras after the common required fields.
12. Verify Security Reviewer has role-specific packet guidance.
13. Verify runtime fallback behavior is documented in `SKILL.md` and `context-packet-schema.md`.
14. Verify schema policy and context profile references are present when work packages, fallback verification, structured errors, or context selection guidance changes.

Expected result: PASS only if all protocol, schema, role-agent, and report-template requirements are aligned.

Optional future validator behavior:

- Load required context packet and report fields from a canonical source.
- Scan every target file for exact field coverage.
- Fail if any role file omits source-of-truth language, `BLOCKED` behavior, read/write scope, Security Reviewer guidance, or runtime fallback language.

## Master Protocol Consistency Check

Purpose: Ensure the master contract, ledger, routing matrix, context packet schema, verification gate, failure signatures, pre-spawn checklist, thin-master rule, metrics, evals, role policy, and config policy agree.

Checks:

1. Verify no non-baseline roles are routed by the protocol: `rg -n "Route: .*performance reviewer|agent_role: \".*(architect|product-manager|frontend-agent|backend-agent|database-agent|refactor-agent|performance-agent|documentation-agent|release-agent)" .agents/skills/direction-guide/references/routing-matrix.md .agents/skills/direction-guide/references/failure-taxonomy.md .agents/skills/direction-guide/SKILL.md .codex/agents`.
2. Verify `max_depth` is bounded at `2`: `rg -n "max_depth = 2" .codex/config.toml`.
3. Verify recursive delegation is master-approved and depth-2 only: `rg -n "Child-Agent Request Gate|master -> implementer -> child agent|max_child_depth" .agents/skills/direction-guide/references/routing-matrix.md .agents/skills/direction-guide/references/config-policy.md .agents/skills/direction-guide/SKILL.md`.
4. Verify guarded parallel implementer policy is consistent: `rg -n "guarded parallel|exact file reservations|isolated worktrees|effective_parallel_write_agents|max_parallel_write_agents = 3|Parallel implementers.*Allowed only" AGENTS.md .agents/skills/direction-guide .ai`.
5. Verify every subagent delegation requires a context packet: `rg -n "Every subagent spawn must include a context packet|Before spawning any subagent|context_packet" .agents/skills/direction-guide .codex/agents`.
6. Verify verifier-equivalent evidence or explicit human override is required for acceptance: `rg -n "fallback verification|verifier-equivalent evidence|explicit human override" AGENTS.md .ai/MASTER_CONTRACT.md .agents/skills/direction-guide`.
7. Verify repeated failure escalation is documented: `rg -n "repeat_stop_threshold|same failure signature appears twice|two failed fix attempts|ESCALATED" .ai/MASTER_LEDGER.yaml .agents/skills/direction-guide .agents/skills/direction-guide/references/failure-signatures.md`.

Expected result: PASS only if the checks support the current guarded parallel baseline and no application source files are modified.

Preferred command: `python3 scripts/validate_protocol.py`.

## Ledger DONE Closure Check

Purpose: Ensure accepted work cannot leave stale active execution state in `.ai/MASTER_LEDGER.yaml` after the ledger reaches `DONE`.

Checks:

1. Verify `active_agent_runs`, `file_reservations`, and `worktree_assignments` are empty when `current_state_machine_state` is `DONE`.
2. Verify `active_parallel_batch` is empty and `effective_parallel_write_agents` is `0` when `current_state_machine_state` is `DONE`.
3. Verify `quality_metrics.per_work_package_checks` contains no `null` metric values when `current_state_machine_state` is `DONE`.
4. Run `python3 -m unittest tests/test_validate_protocol.py` to confirm the adverse stale DONE ledger fixture fails the closure check.

Expected result: PASS only if DONE ledger state has no stale active execution artifacts or null per-work-package metrics.

## Historical Work-Package Exception Check

Purpose: Prevent the 100% work-package-before-implementation metric from overclaiming historical coverage.

Checks:

1. Verify every accepted or DONE task has `work_package_path` unless it is one of the enumerated pre-enforcement exceptions: `WP-0001-repo-memory-specificity`, `WP-0002-clean-bootstrap-placeholders`, `WP-0003-master-control-modules`, or `WP-0008-routing-matrix`.
2. Verify each historical exception keeps `work_package_path: null`.
3. Verify each historical exception links `verifier_report_path` to `.ai/AGENT_REPORTS/historical-fallback-verification.md`.
4. Run `python3 -m unittest tests/test_validate_protocol.py` to confirm an unregistered accepted task with missing `work_package_path` fails and the current queue passes.

Expected result: PASS only if historical exceptions are explicit and future accepted work cannot omit a work-package path.

## Runtime Export Bundle Check

Purpose: Ensure a real project repo can adopt the reusable runtime without inheriting this scaffold repo's development-only memory.

Runtime bundle contents:

- Root entrypoints: `AGENTS.md`, `README.md`, and `INSTALLATION.md`.
- Codex runtime config and roles: `.codex/config.toml` and `.codex/agents/*.toml`.
- Local orchestration skill: `.agents/skills/direction-guide/SKILL.md` and its `references/` files.
- Repeatable validation assets: `scripts/validate_protocol.py`, `scripts/protocol_gate.py`, and validator tests/fixtures.
- Target-specific `.ai/` runtime memory/control seed: mission, project state, task queue, master contract, master modules, master ledger, decisions, risks, metrics, integration log, and test matrix.

Development-only scaffold history that must not be treated as target-repo runtime state:

- Historical scaffold work packages under `.ai/WORK_PACKAGES/WP-*.yaml`.
- Historical scaffold implementation or verifier reports under `.ai/AGENT_REPORTS/*.md`.
- Accepted-work tables, active ledger state, risks, or next-work recommendations that describe this scaffold rather than the target repo.

Checks:

1. Run `python3 scripts/validate_protocol.py` and confirm the validator passes after export guidance changes.
2. Confirm `INSTALLATION.md` tells adopters to copy runtime assets explicitly instead of copying the whole scaffold history.
3. Confirm `README.md` defines the runtime bundle boundary and separates runtime assets from scaffold development history.
4. Confirm target-repo adoption instructions require fresh or rewritten `.ai/` memory before committing the bootstrap branch.

Expected result: PASS only if runtime files are present, target-repo adoption is documented, and scaffold work-package/report history is not described as something adopters must carry forward.

## Tool Policy and Trust Boundary Check

Purpose: Ensure tool-use rules and prompt-injection boundaries are explicit, auditable, and linked from the core protocol surfaces.

Checks:

1. Verify `.agents/skills/direction-guide/references/tool-policy.md` exists.
2. Verify the tool policy defines these command classes: `read_only`, `workspace_write`, `network_or_escalated`, `destructive`, and `approval_gated`.
3. Verify destructive-command handling forbids recursive or batch deletion and requires explicit approval for narrow destructive actions.
4. Verify network/escalation handling requires approval and treats external tool output as evidence rather than instruction.
5. Verify path-boundary handling references read scope, write scope, reserved files, forbidden files, and worktree boundaries.
6. Verify context packets require `trust_boundary` fields for instruction priority, external inputs, tool outputs, durable memory, and quarantine rules.
7. Verify report templates require command policy classification and referenced evidence paths or explicit external markers.
8. Verify `SKILL.md` points future agents to the canonical tool policy before tool-sensitive delegation, verification, or integration.

Expected result: PASS only if the command policy and trust-boundary language are present in the canonical reference and required protocol surfaces.

## Schema Policy and Context Profile Check

Purpose: Ensure protocol metadata for provenance, fallback verification, execution control, structured errors, supersession, and context sizing stays explicit and auditable.

Checks:

1. Verify `.agents/skills/direction-guide/references/schema-policy.md` exists.
2. Verify `.agents/skills/direction-guide/references/context-profiles.md` exists.
3. Verify `SKILL.md` points to both files before protocol, fallback, schema, or context-selection work.
4. Verify `work-package-template.yaml` includes provenance, `fallback_verification`, `execution_budget`, context profile, and structured error fields.
5. Verify `verification-gate.md` distinguishes `VERIFIER_REPORT`, `MASTER_FALLBACK_VERIFICATION`, and `HISTORICAL_ATTESTATION`.
6. Verify high-risk fallback limitations are documented.
7. Verify `failure-taxonomy.md` documents `error_category`, `error_code` or equivalent structured error fields through the canonical error object.
8. Verify historical work packages with superseded max-depth, no-recursion, or one-writer claims include `historical_policy.superseded_by` and `current_policy_reference`.

Expected result: PASS only if new protocol metadata has one canonical reference and historical policy claims point to current accepted decisions.

## Guarded Parallel Implementer Check

Purpose: Ensure parallel write-capable agents are permitted only through isolated worktrees, exact disjoint file reservations, dynamic per-task caps, and integration conflict tracking.

Checks:

1. Verify guarded parallel implementers still respect `max_parallel_write_agents = 3` even when bounded recursive delegation is enabled.
2. Verify `max_parallel_write_agents = 3` is documented as a ceiling, not a default instruction to parallelize.
3. Verify the routing matrix requires isolated worktrees, unique `shard_id`, exact allowed files with no globs, disjoint reservations, and independent shard validation.
4. Verify the context packet schema documents optional `shard_id`, `worktree_id`, `reserved_files`, and `parallel_batch_id` fields without adding them to the required common fields.
5. Verify the pre-spawn checklist requires ledger-recorded reservations, worktree assignments, and effective write-agent count before spawning parallel implementers.
6. Verify metrics and ledger track `effective_parallel_write_agents` and `parallel_write_conflicts`.
7. Verify old "parallel implementers not allowed" language is gone or replaced with the guarded policy.

## Child-Agent Request Check

Purpose: Ensure implementer-requested child agents are permitted only through master approval, depth-2 recursion, complete child context packets, report bundles, and ledger tracking.

Checks:

1. Verify `agents.max_depth = 2` is present in `.codex/config.toml`.
2. Verify the routing matrix documents the Child-Agent Request Gate and `master -> implementer -> child agent` as the only recursive shape.
3. Verify child packets require `delegation_depth: 2`, `max_child_depth: 0`, `can_request_child_agents: false`, and `child_spawn_mode: "none"`.
4. Verify implementer instructions require `child_agent_requests` and forbid self-authorized child spawning.
5. Verify the report template includes `child_agent_requests` and `child_report_bundle`.
6. Verify ledger and metrics track approved and denied requests, max observed depth, missing child reports, child scope violations, and recursive delegation violations.
7. Verify child fixers remain disallowed and verified failures still route through the master failure policy.
8. Verify `.ai/EVALS/EVAL-005-child-agent-requests.md` covers an approved read-only child, an approved exact-file child implementer, and a denied out-of-scope child request.
9. Verify child implementer write leases require `write_lease_id`, `leased_files`, `lease_owner_agent_run_id`, and `parent_write_state: paused_for_leased_files`.
10. Verify parent implementers must pause writes to `leased_files` until the master records the child write lease as returned or revoked.

## Child Write Lease Check

Purpose: Prevent parent and child implementers from concurrently editing the same parent-reserved files.

Preferred command: `python3 scripts/validate_protocol.py`.

Checks:

1. Verify the routing matrix requires a child implementer write lease before spawn.
2. Verify the context packet schema defines `write_lease_id`, `leased_files`, `lease_owner_agent_run_id`, and `parent_write_state`.
3. Verify the pre-spawn checklist requires lease id, leased files, parent write state, and lease return or revocation.
4. Verify implementer role instructions require parents to pause writes to leased files while the child lease is active.
5. Verify metrics and ledger fields can record active child write leases and lease closure state.

Expected result: PASS only if child implementer write ownership is explicit and parent/child concurrent edits to leased files are treated as conflicts.

## Known flaky tests

| Test | Symptom | Handling |
|---|---|---|
|  |  |  |

## Environment notes

- Required runtime: none for current scaffold validation.
- Package manager: none detected in this repo.
- Setup command: none required beyond cloning/opening the repository in Codex.
- Local services required: none.
- Test database required: no.
- Primary validation style: shell file checks, text scans with `rg`, and manual review of Markdown/TOML/YAML consistency.
