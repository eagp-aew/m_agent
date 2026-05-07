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

## Exportable runtime bundle

This repo is the development scaffold for a reusable Codex master-agent runtime. When adopting the runtime in a real project repo, copy the runtime assets, not this scaffold repo's development history.

Runtime assets:

- `AGENTS.md`, `README.md`, and `INSTALLATION.md` as the root entrypoints.
- `.codex/config.toml` and `.codex/agents/*.toml` for Codex runtime settings and role definitions.
- `.agents/skills/direction-guide/` for the local orchestration skill and its protocol references.
- `scripts/validate_protocol.py`, `scripts/protocol_gate.py`, and the validator tests/fixtures needed to keep runtime checks repeatable.
- A target-repo `.ai/` memory seed containing the operating contract, master modules, ledger, mission, project state, task queue, decisions, risks, metrics, integration log, and test matrix, rewritten for the target repo.

Development-only scaffold history:

- This repo's `.ai/WORK_PACKAGES/WP-*.yaml` history.
- This repo's `.ai/AGENT_REPORTS/*.md` verification and implementation reports.
- Accepted-work history, active-work state, and next-work recommendations that describe this scaffold instead of the target repo.

The target repo should start with fresh `.ai/` memory that describes the target product, codebase, validation commands, approval gates, and first work package. Historical scaffold records can remain in this repo; they should not become the target repo's project history.

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

For real-repo adoption, follow `INSTALLATION.md` and validate the copied runtime before assigning application work.
