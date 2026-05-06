# Master Modules

The master agent operates through seven explicit control modules. These modules are control boundaries, not subagents. They define which decisions stay in the root thread, when delegation is allowed, and what evidence must exist before work is accepted.

## 1. Intake Controller

- Purpose: Convert the user's request and repository instructions into a clear work request.
- Inputs: User request, `AGENTS.md`, active skill instructions, current date, environment constraints, approval gates.
- Outputs: Normalized request, initial objective, explicit constraints, approval needs, first-pass risk notes.
- Decisions it owns: Whether the request is actionable, whether clarification is required, whether the request triggers approval gates, and whether the work belongs in this repository.
- What it must not do: It must not design the implementation, delegate work, modify files, or silently ignore user constraints.
- Failure conditions: The request conflicts with repository rules, required approval is missing, user intent is ambiguous in a risky way, or the request targets forbidden source areas.

## 2. Scope Controller

- Purpose: Bound the work package so changes stay small, reviewable, and aligned with the scaffold.
- Inputs: Normalized request, task queue, project state, approval gates, known risky areas.
- Outputs: Selected or new work package, allowed files, forbidden files, acceptance criteria, rollback plan.
- Decisions it owns: Work package boundaries, whether the task is narrow enough to proceed, whether files are in scope, and whether the task should be split.
- What it must not do: It must not expand scope opportunistically, change public APIs, delete files, add dependencies, or approve broad refactors.
- Failure conditions: Scope cannot be bounded, allowed and forbidden files overlap, acceptance criteria are missing, or a human approval gate is triggered without approval.

## 3. Context Controller

- Purpose: Gather only the context needed to execute or delegate the bounded work.
- Inputs: Work package, required `.ai/` memory, relevant repo files, previous decisions, test matrix.
- Outputs: Context brief, files read, open assumptions, validation targets, missing-context risks.
- Decisions it owns: Which files must be read, whether explorer mapping is needed, what context should be passed to subagents, and what can be omitted.
- What it must not do: It must not flood the root thread with raw logs, rely on stale assumptions, or ask subagents to rediscover context already known.
- Failure conditions: Required memory cannot be read, necessary context is unavailable, assumptions would make implementation unsafe, or the context brief is too broad to delegate.

## 4. Routing Controller

- Purpose: Decide whether the master handles the work directly or delegates bounded tasks to specialized agents.
- Inputs: Work package, context brief, write scope, complexity, approval status, available agent roles.
- Outputs: Routing decision, agent assignments when used, disjoint write scopes, required report format.
- Decisions it owns: Whether to use explorer, implementer, verifier, fixer, integrator, or security-reviewer roles; whether parallel work is allowed; and when to stop delegating.
- What it must not do: It must not delegate unbounded work, assign overlapping write scopes, delegate before scope and context are complete, or bypass approval gates.
- Failure conditions: No safe routing exists, write scopes conflict, the next needed action is too coupled to delegate, or prior fix attempts have hit the stop limit.

## 5. Verification Controller

- Purpose: Prove that acceptance criteria are satisfied and classify any failures before fixes begin.
- Inputs: Implementation result, acceptance criteria, validation commands, diff scope, verifier report when available.
- Outputs: Verification status, evidence, failure classification, fix recommendation, residual test gaps.
- Decisions it owns: Which validations are sufficient, whether failures are environmental or implementation-related, whether a verifier result is PASS, PARTIAL, BLOCKED, or FAIL, and whether fixer work is allowed.
- What it must not do: It must not accept unverified behavior changes, hand-wave failed checks, assign fixes before classification, or broaden validation beyond the task without reason.
- Failure conditions: Required checks fail, evidence is missing, failures are unclassified, acceptance criteria are unmet, or repeated identical failures occur.

## 6. Integration Controller

- Purpose: Prepare verified work for acceptance while preserving repository cleanliness and user changes.
- Inputs: Verified diff, git status, changed-file list, integration log, approval gates.
- Outputs: Integrated change summary, files changed, validation evidence, risks, next action.
- Decisions it owns: Whether the diff is scoped, whether unrelated changes must be left alone, whether integration is blocked, and what should be reported.
- What it must not do: It must not revert user changes, rewrite unrelated files, hide dirty worktree state, or merge work that failed verification.
- Failure conditions: Diff includes out-of-scope files, user changes conflict with the task, verification evidence is insufficient, or integration would require forbidden operations.

## 7. Memory Controller

- Purpose: Keep durable project memory current after accepted work.
- Inputs: Accepted work summary, validation evidence, decisions, risks, task queue, project state.
- Outputs: Updated `.ai/PROJECT_STATE.md`, `.ai/TASK_QUEUE.yaml`, `.ai/DECISIONS.md` when needed, and risk or integration notes when needed.
- Decisions it owns: What memory must be updated, what decisions are durable, what risks remain open, and what next work should be queued.
- What it must not do: It must not turn transient logs into durable state, overwrite unrelated memory edits, mark incomplete work as accepted, or leave the queue inconsistent.
- Failure conditions: Memory updates are missing, task status conflicts with evidence, durable decisions are unrecorded, or remaining risks are not captured.
