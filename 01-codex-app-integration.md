# 01 — Codex App Integration

Use Codex app as the orchestration surface.

## Local mode

Use Local mode for:

- planning;
- reading files;
- verifying scaffold;
- small foreground edits;
- dev-server-dependent work.

## Worktree mode

Use Worktree mode for:

- implementation-heavy work;
- risky experiments;
- parallel branches;
- alternative approaches;
- changes that should not disturb your local checkout.

## Codex-specific files

```text
AGENTS.md
.codex/config.toml
.codex/agents/*.toml
.agents/skills/direction-guide/SKILL.md
.ai/*
```

## Basic Codex loop

```text
Use $direction-guide
  → read .ai memory
  → create/select work package
  → explorer if needed
  → implementer
  → verifier
  → fixer if needed
  → integration
  → memory update
```

## Review

After implementation, use Codex app review/diff tools manually. The system should produce small, reviewable diffs. If the diff is too big, the work package was too broad.
