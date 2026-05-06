# 04 — Context and Memory

## Principle

Low context does not mean no memory. It means compressed, durable, relevant memory.

The repo should remember the project. The master thread should remember only what is needed for the current decision.

## Durable memory files

```text
.ai/MISSION.md              # why this project exists
.ai/PROJECT_STATE.md        # current phase and latest state
.ai/TASK_QUEUE.md           # pending / active / blocked / done
.ai/DECISIONS.md            # decisions and rationale
.ai/TEST_MATRIX.md          # validation commands
.ai/RISK_REGISTER.md        # unresolved risks
.ai/INTEGRATION_LOG.md      # accepted changes and merge notes
.ai/WORK_PACKAGES/          # task contracts
.ai/AGENT_REPORTS/          # compressed reports
```

## Context diet by role

### Master gets

```text
- mission
- current project state
- task queue
- relevant decisions
- active work package
- compressed reports
```

### Explorer gets

```text
- objective
- search boundaries
- read-only rule
- output schema
```

### Implementer gets

```text
- work package
- allowed files
- forbidden files
- acceptance criteria
- validation commands
```

### Verifier gets

```text
- original objective
- acceptance criteria
- implementation report
- diff
- validation commands
```

### Fixer gets

```text
- verified failure
- reproduction steps
- allowed files
- original implementation summary
- max fix attempt count
```

## What not to include in master context

```text
- raw logs longer than a few lines
- full command outputs
- irrelevant file dumps
- every subagent's exploration path
- unaccepted alternative plans
```

Put large evidence into files and summarize it.

## Compression rule

Each subagent report should answer:

```text
What changed?
What evidence proves it?
What is risky?
What should happen next?
```

If a report does not answer those four questions, it is not ready for the master.

## Memory update rule

At the end of accepted work, update:

```text
- PROJECT_STATE.md: what is true now
- TASK_QUEUE.md: status movement
- DECISIONS.md: only if a decision was made
- RISK_REGISTER.md: only if risk exists
- INTEGRATION_LOG.md: what was accepted
```

This is the mechanism that allows future Codex threads to start with low context.
