# 02 — Operating Model

## Master state machine

Every task should pass through this state machine:

```text
INTAKE
  → PLAN
  → SCOUT
  → PACKAGE
  → IMPLEMENT
  → VERIFY
  → FIX_OR_ACCEPT
  → INTEGRATE
  → UPDATE_MEMORY
  → NEXT_PACKAGE
```

## State definitions

### INTAKE

Clarify the user goal, constraints, risk level, and desired output.

Output:

```text
- one-sentence goal
- risk classification
- initial assumptions
- whether human approval is required before coding
```

### PLAN

Break the goal into one or more candidate work packages.

Output:

```text
- proposed package list
- dependencies between packages
- suggested first package
- validation strategy
```

### SCOUT

Read-only exploration. No code changes.

Output:

```text
- relevant files
- current behavior
- test locations
- hidden dependencies
- risks
- suggested allowed_files / forbidden_files
```

### PACKAGE

Convert findings into a strict work package.

Output:

```text
.ai/WORK_PACKAGES/WP-xxxx.md
```

### IMPLEMENT

One implementer performs the scoped change.

Output:

```text
- changed files
- implementation summary
- tests run
- risks
```

### VERIFY

Independent verifier checks the implementation.

Output:

```text
PASS | PARTIAL | FAIL | BLOCKED
with evidence
```

### FIX_OR_ACCEPT

If verification fails, classify the failure first. Do not blindly patch.

Output:

```text
- accepted result, or
- classified failure package for fixer, or
- human decision request
```

### INTEGRATE

Final merge/reconciliation stage.

Output:

```text
- clean diff
- updated project memory
- PR/commit summary
```

### UPDATE_MEMORY

Update durable repo memory so the next thread does not need old chat context.

Required updates:

```text
.ai/PROJECT_STATE.md
.ai/TASK_QUEUE.md
.ai/DECISIONS.md, if a decision was made
.ai/RISK_REGISTER.md, if risk remains
.ai/INTEGRATION_LOG.md
```

## Master rulebook

```text
1. Do not implement before a package exists.
2. Do not verify your own work if an independent verifier is available.
3. Do not fix before failure classification.
4. Do not run parallel write agents on overlapping files.
5. Do not hide known risk.
6. Do not paste raw logs into the master thread unless essential.
7. Do not proceed after repeated identical failures.
```
