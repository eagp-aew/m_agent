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
| Placeholder scan | `rg -n "TODO|Replace this section|YYYY-MM-DD|TBD" .ai AGENTS.md .codex .agents/skills/direction-guide -g '!.ai/TEST_MATRIX.md'` | Before accepting memory/scaffold changes | Remaining placeholders must be intentional or queued. |
| Scope check | `git status --short` | Before final review | Ensure only intended scaffold/memory files changed. |

## Context Packet and Report Alignment Check

Purpose: Ensure context packet requirements, role-agent instructions, report template, and Direction Guide protocol remain aligned.

Files checked:

- `.agents/skills/direction-guide/SKILL.md`
- `.agents/skills/direction-guide/references/context-packet-schema.md`
- `.agents/skills/direction-guide/references/agent-report-template.md`
- `.codex/agents/explorer.toml`
- `.codex/agents/implementer.toml`
- `.codex/agents/verifier.toml`
- `.codex/agents/fixer.toml`
- `.codex/agents/integrator.toml`
- `.codex/agents/security-reviewer.toml`

Checks:

1. Verify `SKILL.md` and `context-packet-schema.md` list the same required context packet fields: `task_id`, `agent_role`, `objective`, `source_of_truth`, `must_read`, `may_read`, `do_not_read`, `allowed_files`, `forbidden_files`, `acceptance_criteria`, `validation_commands`, `output_schema`, `stop_conditions`, and `max_context_notes`.
2. Verify every `.codex/agents/*.toml` file states that `context_packet` is the source of truth.
3. Verify every `.codex/agents/*.toml` file requires `BLOCKED` when required packet fields are missing or packet fields conflict.
4. Verify every `.codex/agents/*.toml` file references all read-scope fields: `must_read`, `may_read`, and `do_not_read`.
5. Verify every `.codex/agents/*.toml` file references all write-scope fields: `allowed_files` and `forbidden_files`.
6. Verify `agent-report-template.md`, `context-packet-schema.md`, and `SKILL.md` list the same required common report fields: `task_id`, `agent_role`, `status`, `one_sentence_result`, `files_read`, `files_changed`, `commands_run`, `tests_run`, `evidence`, `risks`, `assumptions`, and `recommended_next_action`.
7. Verify role-specific report sections appear only as optional extras after the common required fields.
8. Verify Security Reviewer has role-specific packet guidance.
9. Verify runtime fallback behavior is documented in `SKILL.md` and `context-packet-schema.md`.

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
