# 08 — Prompt Library

## Master kickoff

```text
Use $direction-guide.

You are the master controller for this milestone.
Read AGENTS.md and .ai project memory.
Do not edit application code yet.
Create or select one work package, then propose the next action.
```

## Explorer fan-out

```text
Spawn read-only explorer subagents and wait for all results.
Each explorer must return relevant files, current behavior, risks, recommended allowed_files, forbidden_files, and validation commands.
No edits.
```

## Implementation

```text
Assign WP-____ to exactly one implementer.
The implementer may edit only allowed_files.
After implementation, write a structured report.
```

## Verification

```text
Spawn one verifier for WP-____.
Verifier must inspect the diff, map acceptance criteria, run/recommend validation, and return PASS/PARTIAL/FAIL with evidence.
Verifier must not edit files.
```

## Fix

```text
Verification failed for WP-____.
Classify the failure first.
If it is a concrete implementation bug, assign one fixer with a minimal failure package.
Stop after two failed fix attempts.
```
