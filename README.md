# Codex Multi-Agent Direction Guide — Complete Scaffold

This is the corrected, Codex-ready scaffold.

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
START_HERE.md
INSTALLATION.md
FILE_MANIFEST.md
.gitignore

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
        failure-taxonomy.md
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

Read `START_HERE.md`, then open this repo in Codex app and paste the prompt from that file.
