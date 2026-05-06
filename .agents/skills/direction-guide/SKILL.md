---
name: direction-guide
description: Use for multi-agent Codex project orchestration: planning, work package creation, subagent delegation, verification, fixing, integration, and durable project memory updates.
---

# Direction Guide Protocol

You are operating a semi-automatic multi-agent workflow inside Codex.

## Core principle

Keep the root thread clean. Do not flood it with raw logs, broad exploration, or speculative notes. Use durable files and structured reports.

## Required files

Read these first when present:

- `AGENTS.md`
- `.ai/MISSION.md`
- `.ai/PROJECT_STATE.md`
- `.ai/TASK_QUEUE.yaml`
- `.ai/DECISIONS.md`
- `.ai/TEST_MATRIX.md`
- `.ai/RISK_REGISTER.md`

## State machine

For each work package:

1. INTAKE
2. PLAN
3. SCOUT
4. PACKAGE
5. IMPLEMENT
6. VERIFY
7. FIX_OR_ACCEPT
8. INTEGRATE
9. UPDATE_MEMORY
10. NEXT_PACKAGE

## Delegation rules

Use subagents only when the work is bounded.

- Use explorer agents for read-only codebase mapping.
- Use implementer agents only for explicit work packages.
- Use verifier agents after every implementation.
- Use fixer agents only after a verifier provides concrete failure evidence.
- Use integrator agents only after implementation and verification are complete.

Do not run parallel write-heavy subagents unless their `allowed_files` are disjoint.

## Work package required fields

Every work package must include:

- task_id
- objective
- why
- allowed_files
- forbidden_files
- inputs
- acceptance_criteria
- validation_commands
- rollback_plan
- human_approval_required
- output_required

## Subagent report required fields

Every subagent report must include:

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

## Failure policy

When verification fails, classify before assigning fixes:

- SPEC_AMBIGUITY
- IMPLEMENTATION_BUG
- TEST_EXPECTATION_BUG
- INTEGRATION_CONFLICT
- ENVIRONMENT_FAILURE
- DEPENDENCY_OR_VERSION_MISMATCH
- SECURITY_REGRESSION
- PERFORMANCE_REGRESSION
- FLAKY_TEST
- SCOPE_VIOLATION

After two failed fix attempts, stop and ask for a human decision.

## Human approval gates

Require human approval before:

- changing public APIs;
- adding dependencies;
- modifying auth/security/payment code;
- writing migrations;
- deleting files;
- broad refactors;
- production config changes;
- changing user-visible behavior not covered by the task.

## Completion

A task is complete only when:

- acceptance criteria are satisfied;
- relevant tests/checks pass or failures are documented;
- verifier returns PASS or explicitly scoped PARTIAL;
- project memory is updated;
- remaining risks are recorded.

## Output discipline

Prefer concise structured summaries. Put long logs in files and reference the path.
