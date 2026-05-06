# 00 — System Overview

## The architecture

```text
Human owner
  │
  ▼
Codex app project
  │
  ├── Master milestone thread
  │     ├── reads durable project memory
  │     ├── decomposes work
  │     ├── spawns bounded subagents
  │     ├── collects structured reports
  │     ├── classifies failures
  │     ├── sends minimal fix packages
  │     └── updates project memory
  │
  ├── Worktree implementation threads
  │     ├── isolated branch/checkouts
  │     ├── scoped implementation
  │     ├── verification
  │     └── review/PR path
  │
  └── Durable repo memory
        ├── .ai/PROJECT_STATE.md
        ├── .ai/TASK_QUEUE.md
        ├── .ai/DECISIONS.md
        ├── .ai/TEST_MATRIX.md
        ├── .ai/RISK_REGISTER.md
        ├── .ai/WORK_PACKAGES/
        └── .ai/AGENT_REPORTS/
```

## The core design choice

Your system should not rely on a giant master conversation. It should rely on durable, compressed, repo-local artifacts.

The master thread should know:

```text
- current mission
- current milestone
- active work package
- project constraints
- decisions already made
- unresolved risks
- validation commands
```

It should not know:

```text
- every raw test log
- every exploration dead end
- every subagent scratchpad thought
- every command output
- unrelated implementation history
```

## Three levels of delegation

| Level | Use for | Mechanism |
|---|---|---|
| Master milestone thread | Project direction and task sequencing | Codex app thread |
| Subagents | Bounded exploration, implementation, verification, fixing | Codex subagents/custom agents |
| Worktrees | Larger independent implementation branches | Codex app Worktree mode |

## System slogan

```text
Agents do bounded work.
The master manages contracts.
The repo stores memory.
The verifier earns trust.
The human approves expensive risk.
```

## What this system is good for

```text
- large features split into safe work packages
- reducing context pollution
- creating repeatable implementation/review/fix loops
- keeping project state out of fragile chat history
- parallel exploration without parallel chaos
- forcing verification before integration
```

## What this system is bad for

```text
- fully autonomous app building without human gates
- vague goals with no acceptance criteria
- many agents editing the same files at once
- recursive delegation trees
- large refactors with no integration owner
- fixing bugs before reproducing them
```

## The biggest failure mode

The failure mode is not that the agents are too weak. The failure mode is that the handoffs are too vague.

Bad handoff:

```text
Fix the auth issue.
```

Good handoff:

```text
Task WP-0018.
Fix the failing refresh-token rotation test.
Allowed files: src/auth/tokens.ts, tests/auth/refresh-token.test.ts.
Do not change session storage or login routes.
Acceptance: npm test -- tests/auth/refresh-token.test.ts passes.
Return root cause, changed files, and validation result.
```
