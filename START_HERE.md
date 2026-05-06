# Start Here

This scaffold is meant to live inside the root of the repo you want Codex to work on.

## Step 1 — Verify hidden folders exist

From Terminal, run:

```bash
ls -la
```

You should see:

```text
.codex
.agents
.ai
AGENTS.md
START_HERE.md
```

If you are checking in Finder, press:

```text
Command + Shift + .
```

to show hidden dotfolders.

## Step 2 — Commit the scaffold

Run:

```bash
git checkout -b agent-system/bootstrap
git add .
git commit -m "Add Codex multi-agent direction guide scaffold"
```

If the branch already exists:

```bash
git checkout agent-system/bootstrap
git add .
git commit -m "Add Codex multi-agent direction guide scaffold"
```

If there is nothing to commit, run:

```bash
git status
```

and inspect whether the files are already tracked.

## Step 3 — Open Codex app

Open this repo in Codex app.

Start with Local mode for verification, or Worktree mode if you want the first real test isolated.

## Step 4 — First Codex prompt

Paste this into Codex:

```text
Use $direction-guide.

We are bootstrapping the Codex multi-agent direction system in this repository.

First, inspect only:
- AGENTS.md
- .codex/
- .agents/skills/direction-guide/
- .ai/

Do not modify application code.

Tasks:
1. Verify that the scaffold is internally consistent.
2. Check that .agents/skills/direction-guide/SKILL.md exists and has usable metadata.
3. Check that custom agent files exist under .codex/agents/.
4. Check that .ai/PROJECT_STATE.md, .ai/TASK_QUEUE.yaml, and .ai/TEST_MATRIX.md are specific enough for this repo.
5. Propose one small first real work package.
6. Do not implement it until I approve.

Return:
- scaffold issues found
- suggested fixes
- proposed first work package
- whether human approval is required
```

## Step 5 — First real task

Your first task should be tiny.

Good first tasks:

- add one missing test;
- document one command;
- fix one deterministic lint issue;
- add one safe validation rule;
- update one small README section.

Bad first tasks:

- rewrite architecture;
- change auth;
- add dependencies;
- write migrations;
- broad refactors;
- parallel implementation across many files.
