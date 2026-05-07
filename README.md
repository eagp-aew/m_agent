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

## Current scaffold map

The current architecture, accepted work history, risky areas, and next recommended work live in `.ai/PROJECT_STATE.md`. Treat that file as the current manifest instead of maintaining a second full file list in this README.

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
