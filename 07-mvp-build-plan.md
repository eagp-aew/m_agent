# 07 — MVP Build Plan

## Build the smallest useful version

Do not begin with a dozen agents, hooks, dashboards, automations, and recursive trees. Build the minimum loop first.

## MVP components

```text
1. AGENTS.md
2. direction-guide skill
3. .ai memory files
4. explorer agent
5. implementer agent
6. verifier agent
7. fixer agent
8. master kickoff prompt
```

## Phase 1 — Bootstrap files

Goal:

```text
Create the repo-local operating system.
```

Tasks:

```text
- commit this starter kit
- materialize .codex/config.toml
- materialize .codex/agents/*.toml
- check that $direction-guide appears in Codex skill selector
- initialize .ai/PROJECT_STATE.md for your actual project
```

Success:

```text
Codex can read AGENTS.md and use $direction-guide.
```

## Phase 2 — First safe task

Goal:

```text
Run one full work package loop.
```

Pick one:

```text
- add one missing test
- update docs for one command
- fix one deterministic bug
- add one non-breaking utility
```

Success:

```text
- explorer report exists if needed
- work package exists
- implementation completed
- verifier passed or produced useful failure
- memory updated
```

## Phase 3 — Add review/integration discipline

Goal:

```text
Make accepted changes PR-ready.
```

Add:

```text
- integrator agent
- integration log
- PR summary template
- review rubric
```

Success:

```text
Every accepted package can be reviewed without reading the whole thread.
```

## Phase 4 — Add safety automation

Only after the manual loop works, add hooks or automations.

Good first automations:

```text
- stale task audit
- missing verifier report audit
- risk register audit
- test matrix drift audit
```

Bad first automations:

```text
- automatic merges
- autonomous dependency upgrades
- broad refactors
- recursive task generation
```

## The first serious metric

Measure this:

```text
How many accepted changes can be understood from only:
- the work package
- the agent reports
- the final diff
- the integration log
```

If the answer is “not many,” your handoff format is still too weak.
