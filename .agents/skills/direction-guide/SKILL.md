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
- `.ai/MASTER_MODULES.md`

## Master control modules

The master thread must operate through the seven control modules defined in `.ai/MASTER_MODULES.md`:

1. Intake Controller
2. Scope Controller
3. Context Controller
4. Routing Controller
5. Verification Controller
6. Integration Controller
7. Memory Controller

Before delegating work, the master must complete Intake, Scope, Context, and Routing. It must also define how Verification, Integration, and Memory will be satisfied for the work package. Do not delegate directly from a user request, a raw state-machine step, or an informal plan.

The modules own control decisions; subagents only perform bounded assigned work. The master must keep module outputs concise and durable when they affect the work package, project memory, or future routing.

## State machine

For each work package:

1. INTAKE: Intake Controller normalizes the request and approval constraints.
2. PLAN: Scope Controller bounds the work package and acceptance criteria.
3. SCOUT: Context Controller gathers only the context needed.
4. PACKAGE: Scope Controller records allowed files, forbidden files, validation, and rollback.
5. ROUTE: Routing Controller decides master-direct work or bounded delegation.
6. IMPLEMENT: The master or assigned implementer performs only the packaged work.
7. VERIFY: Verification Controller checks acceptance criteria and evidence.
8. FIX_OR_ACCEPT: Verification Controller classifies failures before any fixer assignment.
9. INTEGRATE: Integration Controller confirms scope, dirty worktree safety, and readiness.
10. UPDATE_MEMORY: Memory Controller updates durable `.ai/` state after accepted work.
11. NEXT_PACKAGE: Scope Controller recommends the next bounded package when useful.

## Delegation rules

Use subagents only when the Routing Controller has a bounded work package and the relevant module outputs are available.

- Use explorer agents for read-only codebase mapping.
- Use implementer agents only for explicit work packages.
- Use verifier agents after every implementation.
- Use fixer agents only after a verifier provides concrete failure evidence.
- Use integrator agents only after implementation and verification are complete.

Do not run parallel write-heavy subagents unless their `allowed_files` are disjoint.

Delegation prompts must include the active work package, allowed files, forbidden files, acceptance criteria, validation expectations, and required report format. The master remains responsible for final verification, integration, and memory updates.

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
