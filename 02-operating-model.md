# 02 — Operating Model

## Daily operation

1. Open Codex app.
2. Select the repo.
3. Start a thread or worktree.
4. Invoke `$direction-guide`.
5. Let the master read `.ai/` memory.
6. Work one package at a time.
7. Verify before accepting.
8. Review diff manually.
9. Commit or PR.

## Thread hygiene

The root thread should contain:

- decisions;
- structured reports;
- next actions;
- concise evidence.

The root thread should not contain:

- huge raw logs;
- entire files;
- speculative rambling;
- repeated failed patch attempts.

## When to start a new thread

Start a new thread when:

- the existing thread is bloated;
- you are changing milestone;
- implementation needs isolation;
- you are starting an alternative approach.

Before archiving an old thread, ask Codex to update `.ai/PROJECT_STATE.md`.
