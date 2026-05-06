# 00 — System Overview

This project creates a semi-automatic multi-agent workflow inside Codex.

## Architecture

```text
Human owner
  ↓
Codex app project
  ↓
Master thread / milestone thread
  ├─ reads AGENTS.md and .ai memory
  ├─ uses direction-guide skill
  ├─ creates work packages
  ├─ spawns temporary subagents
  ├─ reviews verifier/fixer reports
  ├─ integrates accepted changes
  └─ updates durable project memory
```

## Key idea

Subagents are not the memory. The repo is the memory.

The master should not carry the whole project in its chat context. It should update `.ai/` files and give subagents narrow work packages.

## Roles

- Master: direction and control.
- Explorer: read-only mapping.
- Implementer: scoped edits.
- Verifier: adversarial review.
- Fixer: minimal patch for verified failure.
- Integrator: final reconciliation.
- Security reviewer: sensitive-change audit.

## State machine

```text
INTAKE
  → PLAN
  → SCOUT
  → PACKAGE
  → IMPLEMENT
  → VERIFY
  → FIX_OR_ACCEPT
  → INTEGRATE
  → UPDATE_MEMORY
  → NEXT_PACKAGE
```
