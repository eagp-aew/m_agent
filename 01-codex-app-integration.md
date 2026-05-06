# 01 — Codex App Integration

## Codex should be the orchestration surface

The Codex app should be your command center. Use it for:

```text
- master planning threads
- parallel worktree tasks
- review and diff inspection
- Git handoff between Local and Worktree
- recurring automation reports
- project-scoped skills
```

Do not build a separate dashboard at the beginning. The Codex app already gives you enough surface area to test whether the workflow works.

## Recommended thread pattern

```text
Master planning thread
  - mostly read/plan/update-memory
  - creates work packages
  - coordinates milestone direction

Worktree implementation thread
  - handles one work package or one milestone
  - uses subagents tactically
  - produces reviewable diff

Review thread or review mode
  - inspects uncommitted changes
  - applies inline comments
  - prepares PR/commit summary
```

## When to use Local mode

Use Local mode for:

```text
- bootstrapping the direction-guide files
- editing documentation and templates
- inspecting final changes in your normal environment
- running one local app/server instance
```

## When to use Worktree mode

Use Worktree mode for:

```text
- implementation tasks
- risky experiments
- competing design approaches
- background work
- tasks that should not disturb your current checkout
```

## When to use subagents

Use subagents for bounded work inside a thread:

```text
- Explorer maps files and risks.
- Implementer changes a small scope.
- Verifier checks acceptance criteria.
- Fixer repairs a concrete failure.
- Integrator reconciles final state.
```

## Codex app workflow for one package

```text
1. Start new Worktree thread from the target base branch.
2. Run /plan-mode.
3. Invoke $direction-guide.
4. Master reads .ai project memory.
5. Master spawns explorers if needed.
6. Master creates WP-xxxx.
7. Implementer performs scoped edit.
8. Verifier checks evidence.
9. Fixer handles classified failures.
10. Use /review.
11. Commit / push / PR.
12. Update .ai memory.
```

## Practical rule

Use subagents for information and bounded patches. Use worktrees for isolation.

Trying to use subagents as long-lived branches will become messy. Trying to use one giant worktree thread as the master memory will become bloated. Let each part do what it is good at.
