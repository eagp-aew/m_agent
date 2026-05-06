# 04 — Context and Memory

## Rule

Low context does not mean no memory.

It means:

- put stable facts in files;
- pass subagents only relevant context;
- require structured reports;
- keep logs outside the root thread.

## Memory files

```text
.ai/MISSION.md
.ai/PROJECT_STATE.md
.ai/TASK_QUEUE.yaml
.ai/DECISIONS.md
.ai/TEST_MATRIX.md
.ai/RISK_REGISTER.md
.ai/INTEGRATION_LOG.md
```

## What goes where

| File | Purpose |
|---|---|
| `.ai/MISSION.md` | project purpose and operating intent |
| `.ai/PROJECT_STATE.md` | current milestone/status/blockers |
| `.ai/TASK_QUEUE.yaml` | work package queue |
| `.ai/DECISIONS.md` | durable decisions |
| `.ai/TEST_MATRIX.md` | validation commands |
| `.ai/RISK_REGISTER.md` | known risks |
| `.ai/INTEGRATION_LOG.md` | accepted changes |
