# AGENTS.md

## Repository operating rules

- Use the `direction-guide` skill for multi-step project work.
- Keep changes scoped to the active work package.
- Do not add dependencies without explicit approval.
- Do not modify auth, payment, migrations, secrets, or production config without explicit approval.
- Every behavior change needs tests, or a written reason tests are not possible.
- After accepted work, update `.ai/PROJECT_STATE.md`, `.ai/TASK_QUEUE.md`, and `.ai/INTEGRATION_LOG.md`.
- If a durable architectural/product decision is made, update `.ai/DECISIONS.md`.
- If risk remains, update `.ai/RISK_REGISTER.md`.

## Multi-agent workflow

For substantial tasks, use this flow:

```text
PLAN → SCOUT → PACKAGE → IMPLEMENT → VERIFY → FIX_OR_ACCEPT → INTEGRATE → UPDATE_MEMORY
```

Do not implement before a work package exists.

## Subagent rules

- Use explorer agents for read-only mapping.
- Use implementer agents only after allowed files, forbidden files, acceptance criteria, and validation commands are defined.
- Use verifier agents after every implementation.
- Use fixer agents only after a verifier provides concrete failure evidence.
- Do not run parallel write agents on overlapping files.
- Do not let subagents expand scope without returning to the master.

## Validation

Use commands from `.ai/TEST_MATRIX.md`. For changed packages, run the smallest relevant test first, then broader checks before final review.

If a command cannot run, report:

```text
- command attempted
- reason it could not run
- substitute evidence, if any
- risk left unresolved
```

## Review expectations

Focus review on:

```text
- correctness
- regressions
- security
- missing tests
- API/contract breaks
- migration risk
- performance risk
- scope breach
```

Avoid style-only changes unless they reduce real confusion or prevent a bug.

## Done means

A work package is done only when:

```text
- acceptance criteria are satisfied or partial status is explicitly accepted
- verifier produced evidence
- tests/checks passed or unresolved failures are documented
- project memory is updated
- final diff is reviewable
```
