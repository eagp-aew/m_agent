# Master-Agent Metrics

This file defines the quality metrics the master records for each work package and the system-level targets used to evaluate the direction-guide workflow.

## Per-Work-Package Checks

Record these checks in `.ai/MASTER_LEDGER.yaml` under `quality_metrics` when a work package starts, at verification, and after accepted work.

| Metric | Type | Target | When to record |
|---|---|---|---|
| `work_package_existed_before_implementation` | boolean | `true` | Before `IMPLEMENT` |
| `implementer_stayed_within_allowed_files` | boolean | `true` | During `VERIFY` and `INTEGRATE` |
| `verifier_report_exists` | boolean | `true` | During `VERIFY`; means either a verifier subagent report exists or master-direct fallback verification evidence was recorded. |
| `verifier_mapped_acceptance_criteria` | boolean | `true` | During `VERIFY`; means either verifier or fallback verification mapped acceptance criteria. |
| `tests_run_or_not_run_reason_documented` | boolean | `true` | During `VERIFY` |
| `memory_files_updated` | boolean | `true` for accepted work | During `UPDATE_MEMORY` |
| `fix_attempts` | integer | `<= 2` | During `FIX_OR_ACCEPT` and `DONE` |
| `repeated_failure_detected` | boolean | `true` when repeated signatures occur; otherwise `false` | During `FIX_OR_ACCEPT` |
| `human_approval_required` | boolean | Informational | During `INTAKE` and `PACKAGE` |
| `human_approval_obtained` | boolean | `true` when required | Before approval-gated work |
| `exact_file_reservations_recorded` | boolean | `true` for guarded parallel implementation | Before parallel implementer spawn |
| `isolated_worktrees_required` | boolean | `true` for guarded parallel implementation | Before parallel implementer spawn |
| `effective_parallel_write_agents` | integer | `<= max_parallel_write_agents` and equal to the approved per-task cap | During `IMPLEMENT` and `INTEGRATE` |
| `parallel_write_conflicts` | integer | `0` | During `INTEGRATE` and `DONE` |
| `child_agent_requests_require_master_approval` | boolean | `true` when recursive delegation is enabled | Before `IMPLEMENT` |
| `child_agent_requests_approved` | integer | Informational | During `IMPLEMENT` and `INTEGRATE` |
| `child_agent_requests_denied` | integer | Informational | During `IMPLEMENT` and `INTEGRATE` |
| `max_observed_delegation_depth` | integer | `<= 2` | During `IMPLEMENT`, `VERIFY`, and `DONE` |
| `child_reports_missing` | integer | `0` | During `VERIFY` and `INTEGRATE` |
| `child_scope_violations` | integer | `0` | During `VERIFY`, `INTEGRATE`, and `DONE` |
| `recursive_delegation_violations` | integer | `0` | During `VERIFY`, `INTEGRATE`, and `DONE` |
| `diff_size` | object | Small and scoped | During `INTEGRATE` |
| `files_changed` | list | Only allowed files | During `INTEGRATE` and `DONE` |

Use this canonical ledger shape:

```yaml
quality_metrics:
  metrics_reference: ".ai/METRICS.md"
  per_work_package_checks:
    work_package_id: ""
    work_package_existed_before_implementation: null
    implementer_stayed_within_allowed_files: null
    verifier_report_exists: null
    verifier_mapped_acceptance_criteria: null
    tests_run_or_not_run_reason_documented: null
    memory_files_updated: null
    fix_attempts: 0
    repeated_failure_detected: false
    human_approval_required: false
    human_approval_obtained: null
    exact_file_reservations_recorded: null
    isolated_worktrees_required: null
    effective_parallel_write_agents: 1
    parallel_write_conflicts: 0
    child_agent_requests_require_master_approval: null
    child_agent_requests_approved: 0
    child_agent_requests_denied: 0
    max_observed_delegation_depth: 1
    child_reports_missing: 0
    child_scope_violations: 0
    recursive_delegation_violations: 0
    diff_size:
      files: 0
      insertions: 0
      deletions: 0
    files_changed: []
```

Set unknown values to `null` while the work package is still in progress. Replace them with concrete values before `DONE`.

## System-Level Targets

| Target | Required value |
|---|---|
| Tasks with work package before implementation | `100%` |
| Tasks with verifier-equivalent evidence | `100%` |
| Fix attempts per task | `<= 2` |
| Parallel write conflicts | `0` |
| Guarded parallel implementation without exact file reservations | `0` |
| Guarded parallel implementation without isolated worktrees | `0` |
| Recursive delegation without master approval | `0` |
| Recursive delegation beyond depth 2 | `0` |
| Child reports missing after approval | `0` |
| Child scope violations | `0` |
| Unapproved risky changes | `0` |
| Accepted tasks with memory update | `100%` |
| Repeated failure escalation | `100%` |

Use this canonical ledger shape:

```yaml
quality_metrics:
  system_level_targets:
    tasks_with_work_package_before_implementation: "100%"
    tasks_with_verifier_report: "100% verifier report or fallback verification evidence"
    max_fix_attempts_per_task: 2
    parallel_write_conflicts: 0
    parallel_batches_without_exact_file_reservations: 0
    parallel_batches_without_isolated_worktrees: 0
    recursive_delegations_without_master_approval: 0
    recursive_delegations_beyond_depth_2: 0
    approved_child_reports_missing: 0
    child_scope_violations: 0
    unapproved_risky_changes: 0
    accepted_tasks_with_memory_update: "100%"
    repeated_failure_escalation: "100%"
```

## Master Usage

1. `INTAKE`: record whether human approval is required.
2. `PACKAGE`: record whether a work package existed before implementation and whether allowed files are explicit.
3. `IMPLEMENT`: record the implementer route and preserve the allowed-file boundary. For guarded parallel batches, record the `parallel_batch_id`, exact file reservations, isolated worktrees, and effective write-agent count before spawning implementers. For recursive delegation, record child-agent request ids, approval decisions, budgets, max observed depth, and approved child report requirements.
4. `VERIFY`: record verifier report or fallback verification evidence presence, acceptance-criteria mapping, tests or not-run reason, child report presence when required, and scope checks.
5. `FIX_OR_ACCEPT`: record fix attempts and repeated failure detection.
6. `INTEGRATE`: record diff size, changed files, parallel write conflicts, recursive delegation violations, child scope violations, and whether every changed file matched its shard or child reservation.
7. `UPDATE_MEMORY`: record whether memory files were updated for accepted work.
8. `DONE`: ensure all metric fields are concrete and reference this file from the ledger.
