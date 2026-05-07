# Context Packet Schema

Every subagent spawn must include a context packet. The packet is the master thread's bounded handoff contract: it tells the subagent what to do, what context is authoritative, what it may inspect, what it must avoid, how to validate, when to stop, and how to report back.

The packet should be concise enough to fit in the delegation prompt without forcing the subagent to rediscover project state. Prefer paths and short summaries over pasted file contents.

## Required Schema

```yaml
context_packet:
  task_id: ""
  agent_role: "explorer | implementer | verifier | fixer | integrator | security-reviewer"
  objective: ""
  source_of_truth:
    - ""
  must_read:
    - ""
  may_read:
    - ""
  do_not_read:
    - ""
  allowed_files:
    - ""
  forbidden_files:
    - ""
  acceptance_criteria:
    - ""
  validation_commands:
    - ""
  output_schema:
    required_fields:
      - task_id
      - agent_role
      - status
      - one_sentence_result
      - files_read
      - files_changed
      - commands_run
      - tests_run
      - evidence
      - risks
      - assumptions
      - recommended_next_action
      - child_agent_requests
      - child_report_bundle
    status_values:
      - PASS
      - PARTIAL
      - BLOCKED
      - FAIL
    report_template: ".agents/skills/direction-guide/references/agent-report-template.md"
  stop_conditions:
    - ""
  max_context_notes: 5
```

## Optional Parallel Fields

Include these fields only when a guarded parallel implementation batch, shard, fixer, verifier, or integrator needs them. They do not change the required common packet fields above.

```yaml
  shard_id: null
  worktree_id: null
  reserved_files: []
  parallel_batch_id: null
```

## Optional Recursive Delegation Fields

Include these fields for implementer packets that may request child agents and for every approved child-agent packet. They do not change the required common packet fields above.

```yaml
  agent_run_id: null
  parent_agent_run_id: null
  delegation_depth: 1
  max_child_depth: 0
  can_request_child_agents: false
  allowed_child_roles: []
  child_spawn_mode: "none | master_approved_request"
  child_agent_budget: 0
  child_context_budget: 0
  child_runtime_budget: null
  child_write_policy: "none | read_only | exact_subset_of_parent_reserved_files"
  child_report_bundle_required: false
```

## Field Rules

- `task_id`: Work package or task identifier. Must match the active work package when one exists.
- `agent_role`: The assigned role. Use one role per packet.
- `objective`: One bounded outcome written as an action, not a broad project goal.
- `shard_id`: Optional. Required only for implementer or fixer packets that belong to a guarded parallel implementation shard.
- `worktree_id`: Optional. Required only for write-capable packets that belong to a guarded parallel implementation batch.
- `reserved_files`: Optional. Exact file paths reserved for a parallel shard. When present, this list must match or be a subset of `allowed_files` and must not overlap another active shard.
- `parallel_batch_id`: Optional. Identifies the guarded parallel implementation batch for shard, verifier, fixer, or integrator packets.
- `agent_run_id`: Optional. Required for packets that participate in recursive delegation tracking.
- `parent_agent_run_id`: Optional. Required for child-agent packets; it must identify the parent implementer run that requested the child.
- `delegation_depth`: Optional. Required for recursive delegation. Master-spawned subagents use depth `1`; approved child agents use depth `2`.
- `max_child_depth`: Optional. Required for recursive delegation. Parent implementers that may request children use `1`; every child agent must use `0`.
- `can_request_child_agents`: Optional. Required for recursive delegation. Only implementers may receive `true`, and only when the master has authorized request-based child delegation.
- `allowed_child_roles`: Optional. Roles the implementer may request as children. For v1, allowed values are `explorer`, `verifier`, `security-reviewer`, and `implementer`.
- `child_spawn_mode`: Optional. Must be `master_approved_request` when child requests are allowed and `none` otherwise.
- `child_agent_budget`: Optional. Maximum number of child-agent requests the parent may submit for the work package.
- `child_context_budget`: Optional. Maximum number of extra context notes each requested child packet may include.
- `child_runtime_budget`: Optional. Maximum runtime or wait budget the master grants for approved child agents.
- `child_write_policy`: Optional. Must be `none` or `read_only` for read-only child roles. Child implementers must use `exact_subset_of_parent_reserved_files`.
- `child_report_bundle_required`: Optional. When true, the parent implementer must include accepted child report summaries in its final report.
- `source_of_truth`: Authoritative files, diffs, reports, user instructions, or work package paths the subagent should treat as controlling when context conflicts.
- `must_read`: Read-scope field. Files, directories, references, or durable project-memory files the agent must inspect before acting.
- `may_read`: Read-scope field. Files, directories, references, or durable project-memory files the agent may inspect if needed.
- `do_not_read`: Read-scope field. Files, directories, references, secrets, generated artifacts, or other materials the agent must not open, inspect, summarize, quote, or derive information from.
- `allowed_files`: Write-scope field. Files or paths the agent may create, edit, delete, rename, or otherwise modify. For read-only roles, this must be an empty list or explicitly say `none`.
- `forbidden_files`: Write-scope field. Files or paths the agent must not create, edit, delete, rename, or otherwise modify. This should include approval-gated areas when relevant.
- `acceptance_criteria`: Concrete checks the subagent's work or report must satisfy.
- `validation_commands`: Commands the subagent should run or recommend. Use `NOT_RUN` with a reason when a command cannot be run.
- `output_schema`: Required report shape. It must be compatible with the direction-guide agent report template.
- `stop_conditions`: Conditions that require the subagent to stop and report `BLOCKED` instead of guessing or expanding scope.
- `max_context_notes`: Maximum number of extra context notes the master may include outside the structured fields. Use a small integer; default to `5`.

## Scope Separation

- `forbidden_files` limits writes only; it does not prohibit reading unless the same file or path is also listed in `do_not_read`.
- `do_not_read` limits reading only; it does not imply write permission or write prohibition unless the same file or path is also reflected in `allowed_files` or `forbidden_files`.
- A file may be readable while still forbidden to modify.
- A packet with `forbidden_files: ["**/*"]` is valid for read-only roles when the objective does not require file changes.
- A packet is conflicting if the objective requires writes but `allowed_files` is empty, set to `none`, or fully negated by `forbidden_files`.
- In guarded parallel implementation packets, `allowed_files` and `reserved_files` must be exact paths only; globs, directory ownership, and inferred file ownership are not allowed.
- In guarded parallel implementation packets, `worktree_id` is required for write-capable roles and must identify the isolated worktree assigned by the master.
- Recursive child-agent requests never expand the parent implementer's allowed files, acceptance criteria, approval gates, or durable memory duties.
- Child-agent packets must set `delegation_depth: 2`, `max_child_depth: 0`, `can_request_child_agents: false`, and `child_spawn_mode: "none"`.
- Child implementer `allowed_files` and `reserved_files` must be exact file paths that are subsets of the parent implementer's `reserved_files`.
- Child explorers, verifiers, and security reviewers are read-only and must use `allowed_files: ["none"]` or an empty list.

## Packet Validation

Before spawning a subagent, the master must verify:

- all required fields are present;
- `allowed_files` and `forbidden_files` do not overlap;
- approval-gated files are included in `forbidden_files` unless explicit human approval is recorded;
- read-only roles have no write scope;
- `must_read`, `may_read`, and `do_not_read` are consistent with the role's purpose;
- `acceptance_criteria` and `validation_commands` are specific enough for the subagent to produce evidence;
- `stop_conditions` include scope expansion, missing required context, conflicting instructions, forbidden-file pressure, and validation blockers;
- context notes do not exceed `max_context_notes`.
- when optional parallel fields are present, `shard_id`, `worktree_id`, `reserved_files`, and `parallel_batch_id` are consistent with the active work package and master ledger;
- parallel shard `reserved_files` do not overlap with any other active shard.
- when optional recursive delegation fields are present, `delegation_depth` is no greater than `2`, child packets have `max_child_depth: 0`, and only implementer packets may set `can_request_child_agents: true`;
- child-agent request packets do not expand the parent implementer's file reservations, acceptance criteria, approval gates, or validation scope.

Before acting, every role agent must confirm the context packet includes `task_id`, `agent_role`, `objective`, `source_of_truth`, `must_read`, `may_read`, `do_not_read`, `allowed_files`, `forbidden_files`, `acceptance_criteria`, `validation_commands`, `output_schema`, `stop_conditions`, and `max_context_notes`. If any required field is missing, empty where a value is required, or contradictory with another field, the agent must stop and return `BLOCKED`.

## Role-Specific Guidance

### Explorer

Give explorers broad read-only context so they can map files, ownership boundaries, execution paths, risks, and validation targets. Use broad `may_read` entries when scope is unclear, but keep `allowed_files` as `none`. Explorer output should identify relevant files and recommended next context, not make changes.

### Implementer

Give implementers narrow task context. Their `must_read`, `allowed_files`, acceptance criteria, and validation commands should be tightly scoped to the active work package. Implementers must not modify files outside `allowed_files`, update durable memory, or redefine the objective.

For guarded parallel implementation, each implementer packet must include `shard_id`, `worktree_id`, `reserved_files`, and `parallel_batch_id`. The implementer must work only in the assigned isolated worktree, modify only exact reserved files, and return `BLOCKED` if the task requires an unreserved file, a shared generated file, a public API change, dependency or migration changes, auth/payment/permissions/secrets/production-config changes, deletion, or broad refactor work not explicitly approved in the packet.

For recursive delegation, an implementer may request child agents only when its packet sets `can_request_child_agents: true`, `child_spawn_mode: "master_approved_request"`, and `max_child_depth: 1`. The implementer must submit structured `child_agent_requests` to the master and wait for approval before any child is spawned. The implementer must return `BLOCKED` when needed child help is denied and no safe fallback exists.

### Verifier

Give verifiers the original objective, active work package, relevant diff or changed-file list, acceptance criteria, and validation commands. Verifiers should inspect whether the implementation satisfies the criteria, run or review validation evidence, classify gaps, and return PASS, scoped PARTIAL, BLOCKED, or FAIL.

Child verifiers are read-only pre-return checks for a bounded parent implementer result. They do not replace the master-owned verification gate.

### Fixer

Give fixers concrete failure evidence, affected files, failure classification, and minimal patch constraints. Fixers should change only the smallest necessary file set, preserve the accepted parts of the prior implementation, and stop after the packet's stop conditions or the repository fix-attempt limit is reached.

For guarded parallel implementation failures, fixer packets must be scoped to the failed shard's exact reserved files unless the master classifies the failure as `INTEGRATION_CONFLICT` and records a new bounded integration-fix scope.

### Integrator

Give integrators final subagent reports, the verified diff, changed-file list, validation evidence, and memory files. Integrators should reconcile scope, confirm evidence, prepare concise final reporting, and identify required `.ai/` memory updates. They should not accept unverified work or rewrite unrelated files.

For guarded parallel implementation, integrators must wait for all shard reports, confirm each shard was independently verified, inspect the combined diff, detect unreserved file edits or overlapping shard edits, and mark integration as `FAIL` or `BLOCKED` when the batch cannot be combined cleanly.

For recursive delegation, integrators must confirm every approved child request has a corresponding child report, every child report stayed within the approved child packet, and no child attempted to spawn or request grandchildren.

### Security Reviewer

Give security reviewers a security objective, sensitive files, flows, or behaviors under review, allowed read scope, prohibited read scope, write prohibition, expected security checks, and required `security_findings` output. Security reviewers are read-only. A security reviewer must return `BLOCKED` if asked to modify files; any approved security-sensitive change must be routed through a bounded implementer or fixer packet after human approval.

## Delegation Prompt Skeleton

```text
You are the {agent_role} for task {task_id}.

Use the following context_packet as the source of truth:

<context_packet>
{context_packet}
</context_packet>

Active work package:

<work_package>
{work_package}
</work_package>

Instructions:

- Treat `context_packet` as the source of truth.
- Obey `must_read`, `may_read`, `do_not_read`, `allowed_files`, and `forbidden_files`.
- Stop with `BLOCKED` if required packet fields are missing, empty where required, or conflicting.
- Do not exceed the assigned scope.
- Run only the listed validation commands unless the packet explicitly permits additional checks.
- Return the required report shape exactly.
- Put role-specific extras after the common required fields.

Required report:

- task_id
- agent_role
- status: PASS | PARTIAL | BLOCKED | FAIL
- one_sentence_result
- files_read
- files_changed
- commands_run
- tests_run
- evidence
- risks
- assumptions
- recommended_next_action
- child_agent_requests
- child_report_bundle
```

## Runtime Fallback

When subagent spawning is unavailable or disallowed by the current runtime, the master must not simulate a subagent report as if one ran. Instead, the master performs the role duties directly, records the fallback reason, and reports the evidence gathered.

## Minimal Packet Example

```yaml
context_packet:
  task_id: "WP-0000-example"
  agent_role: "verifier"
  objective: "Verify that the documentation change satisfies the packet schema acceptance criteria."
  source_of_truth:
    - ".ai/WORK_PACKAGES/WP-0000-example.yaml"
    - "User request in root thread"
  must_read:
    - ".agents/skills/direction-guide/SKILL.md"
    - ".agents/skills/direction-guide/references/context-packet-schema.md"
  may_read:
    - ".ai/TEST_MATRIX.md"
  do_not_read:
    - "application source directories"
  allowed_files:
    - "none"
  forbidden_files:
    - "**/*"
  acceptance_criteria:
    - "All required schema fields are documented."
    - "Role-specific guidance is present for the assigned role."
  validation_commands:
    - "rg -n \"context packet|task_id|agent_role\" .agents/skills/direction-guide"
  output_schema:
    report_template: ".agents/skills/direction-guide/references/agent-report-template.md"
    required_fields:
      - task_id
      - agent_role
      - status
      - one_sentence_result
      - files_read
      - files_changed
      - commands_run
      - tests_run
      - evidence
      - risks
      - assumptions
      - recommended_next_action
      - child_agent_requests
      - child_report_bundle
    status_values:
      - PASS
      - PARTIAL
      - BLOCKED
      - FAIL
  stop_conditions:
    - "Required context is missing."
    - "The diff includes forbidden files."
    - "Validation cannot be run or assessed."
  max_context_notes: 3
```
