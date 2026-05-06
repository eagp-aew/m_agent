# 08 — Prompt Library

Use these prompts in Codex app.

## Master kickoff prompt

```text
Use $direction-guide.

You are the master controller for this project milestone.

First read:
- AGENTS.md
- .ai/MISSION.md
- .ai/PROJECT_STATE.md
- .ai/TASK_QUEUE.md
- .ai/DECISIONS.md
- .ai/TEST_MATRIX.md
- .ai/RISK_REGISTER.md

Operate in plan-first mode. Do not edit application code yet.

Your job:
1. Summarize the current project state in 10 bullets or fewer.
2. Identify the next highest-leverage milestone.
3. Spawn read-only explorer subagents if codebase mapping is needed.
4. Wait for all explorer results.
5. Create or update one work package in .ai/WORK_PACKAGES/.
6. Ask for approval before implementation if the work touches public API, auth, database migrations, dependencies, production config, or broad refactors.
7. Once approved or clearly safe, assign exactly one implementer.
8. After implementation, assign a verifier.
9. If verification fails, classify the failure before assigning a fixer.
10. Update .ai/PROJECT_STATE.md, .ai/TASK_QUEUE.md, and .ai/DECISIONS.md after accepted work.

Keep the root thread clean. No raw logs unless essential.
```

## Parallel explorer prompt

```text
Use $direction-guide.

Spawn three read-only explorer subagents and wait for all results.

Explorer A:
Map the API/routes/entry-points relevant to WP-____.

Explorer B:
Map the data/model/storage flow relevant to WP-____.

Explorer C:
Map existing tests, fixtures, mocks, and validation commands relevant to WP-____.

All explorers must return:
- relevant files
- current behavior
- hidden dependencies
- risk points
- recommended allowed_files for implementation
- recommended validation commands

Do not edit files.
```

## Work package creation prompt

```text
Create a work package for the selected task.

Required:
- task_id
- objective
- why
- allowed_files
- forbidden_files
- acceptance_criteria
- validation_commands
- rollback_plan
- human_approval_required
- output_required

Save it under .ai/WORK_PACKAGES/WP-____.md.
Do not edit application code.
```

## Implementer assignment prompt

```text
Spawn one implementer for WP-____.

The implementer must:
- read .ai/WORK_PACKAGES/WP-____.md
- edit only allowed_files
- avoid forbidden_files
- satisfy acceptance criteria
- run validation commands when possible
- return the standard agent report

Do not spawn parallel write agents.
```

## Verifier assignment prompt

```text
Spawn one verifier for WP-____.

The verifier must:
- inspect the diff
- compare the result against acceptance criteria
- run or recommend validation commands
- check missing tests and regressions
- return PASS, PARTIAL, FAIL, or BLOCKED with evidence

The verifier must not edit files.
```

## Failure classification prompt

```text
The verifier reported a failure for WP-____.

Classify it before assigning a fix.
Use one of:
- SPEC_AMBIGUITY
- IMPLEMENTATION_BUG
- TEST_EXPECTATION_BUG
- INTEGRATION_CONFLICT
- ENVIRONMENT_FAILURE
- DEPENDENCY_OR_VERSION_MISMATCH
- SECURITY_REGRESSION
- PERFORMANCE_REGRESSION
- FLAKY_TEST
- UNKNOWN_ROOT_CAUSE

Return:
- failure type
- evidence
- route
- whether human approval is needed
- minimal fix package if safe
```

## Fixer assignment prompt

```text
Spawn one fixer for WP-____ / FAIL-____.

The fixer must:
- fix only the verified failure
- not broaden scope
- not touch forbidden files
- preserve the original implementation unless evidence proves it wrong
- run the smallest relevant validation
- return root cause, files changed, validation result, and remaining risks
```

## Integration prompt

```text
Use $direction-guide.

Run integration for WP-____.

Check:
- work package exists
- implementer report exists
- verifier report exists
- acceptance criteria are satisfied or partial status is justified
- .ai/PROJECT_STATE.md is updated
- .ai/TASK_QUEUE.md is updated
- .ai/RISK_REGISTER.md is updated if risk remains
- .ai/INTEGRATION_LOG.md records the accepted result

Return a PR-ready summary and any remaining risk.
```

## Daily audit automation prompt

```text
Use $direction-guide.

Read:
- .ai/TASK_QUEUE.md
- .ai/PROJECT_STATE.md
- .ai/RISK_REGISTER.md
- .ai/INTEGRATION_LOG.md

Do not modify application code.

Create .ai/AUTOMATION_REPORTS/YYYY-MM-DD-task-audit.md with:
1. stale tasks
2. blocked tasks
3. risky open work
4. missing verifier reports
5. next three recommended work packages

If nothing important exists, report no findings.
```
