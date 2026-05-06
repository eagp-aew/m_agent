# AGENTS.md

## Repository operating rules

- Use the direction-guide skill for multi-step project work.
- Keep changes scoped to the active work package.
- Do not add dependencies without approval.
- Do not modify auth, payment, migrations, secrets, or production config without approval.
- Every behavior change needs tests or a written reason tests are not possible.
- Every implementation task must be independently verified.
- After accepted work, update `.ai/PROJECT_STATE.md` and `.ai/TASK_QUEUE.yaml`.
- Record durable product/architecture decisions in `.ai/DECISIONS.md`.
- Keep the root thread clean; do not paste raw logs unless essential.

## Multi-agent protocol

For complex work:

1. Read `.ai/` project memory.
2. Create or select one work package.
3. Use explorer agents for read-only mapping if scope is unclear.
4. Assign exactly one implementer unless write scopes are disjoint.
5. Assign a verifier after implementation.
6. Classify failures before assigning a fixer.
7. Stop after two failed fix attempts or repeated identical errors.

## Validation

Use the commands in `.ai/TEST_MATRIX.md`.

Preferred validation order:

1. Small targeted test.
2. Related package/module test.
3. Typecheck/lint.
4. Broader test suite when appropriate.

## Human approval gates

Ask for human approval before:

- changing public APIs;
- adding dependencies;
- modifying auth, payment, permissions, or secrets handling;
- writing database migrations;
- deleting files;
- broad refactors;
- changing production config;
- changing user-visible behavior not covered by the work package.

## Review standard

A task is done only when:

- acceptance criteria are satisfied;
- relevant validation passed or failures are explained;
- verifier returns PASS or scoped PARTIAL;
- `.ai/` memory is updated;
- remaining risks are recorded.

## Communication style

Return concise summaries with:

- what changed;
- files changed;
- tests run;
- evidence;
- risks;
- next action.

Avoid long narrative unless specifically requested.
