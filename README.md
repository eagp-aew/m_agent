# Codex Multi-Agent Direction Guide

This is the Codex-ready direction-system scaffold. The root is intentionally lean: durable protocol detail lives under `.agents/skills/direction-guide/` and `.ai/`, while root docs stay limited to setup and repository entrypoints.

It includes the actual hidden directories Codex expects:

```text
.codex/
.agents/
.ai/
```

If you are using macOS Finder, hidden folders starting with `.` may not show up. Press:

```text
Command + Shift + .
```

to toggle hidden files/folders.

## What is included

```text
AGENTS.md
INSTALLATION.md
README.md
.gitignore
scripts/
  validate_protocol.py

.codex/
  config.toml
  agents/
    explorer.toml
    implementer.toml
    verifier.toml
    fixer.toml
    integrator.toml
    security-reviewer.toml

.agents/
  skills/
    direction-guide/
      SKILL.md
      references/
        work-package-template.yaml
        agent-report-template.md
        context-packet-schema.md
        failure-taxonomy.md
        routing-matrix.md
        review-rubric.md

.ai/
  MISSION.md
  PROJECT_STATE.md
  TASK_QUEUE.yaml
  DECISIONS.md
  TEST_MATRIX.md
  RISK_REGISTER.md
  INTEGRATION_LOG.md
  WORK_PACKAGES/
    WP-0000-bootstrap.yaml
  AGENT_REPORTS/
    README.md
  AUTOMATION_REPORTS/
    README.md
```

## Core idea

Use Codex app threads and worktrees for project-level isolation, use Codex subagents for bounded tactical work, and use durable repo files for memory.

Do not build a swarm. Build a controlled software-delivery protocol:

```text
work package → bounded agent → structured report → verifier → classified fix → integration → memory update
```

## First action

Open this repo in Codex app, read `AGENTS.md`, then use `$direction-guide` for multi-step workflow work. For a repeatable scaffold check, run:

```bash
python3 scripts/validate_protocol.py
```
