# Codex Multi-Agent Direction Guide Starter Kit

This starter kit turns the multi-agent direction-guide idea into a concrete Codex workflow. It is designed for a semi-automatic software-building system where a master thread decomposes work, spawns bounded subagents, receives compressed reports, routes failures, and keeps durable project memory in the repository.

The design goal is not to create an uncontrolled swarm. The design goal is to create a disciplined software-delivery protocol inside Codex:

```text
Codex app project
  └── Master milestone thread
        ├── direction-guide skill
        ├── durable .ai project memory
        ├── custom subagent definitions
        ├── work packages
        ├── verification gates
        └── Git / review / worktree flow
```

## What is included

```text
AGENTS.md                                      # Repo-level Codex operating rules
START_HERE.md                                  # First actions to bootstrap the system
00-system-overview.md                          # Architecture and design logic
01-codex-app-integration.md                    # How to use this inside Codex app
02-operating-model.md                          # Master state machine and control loop
03-agent-role-design.md                        # Agent roles, permissions, and boundaries
04-context-and-memory.md                       # Durable memory and context compression
05-failure-routing.md                          # Failure taxonomy and retry routing
06-human-gates-and-stop-rules.md               # Human approval points and hard stops
07-mvp-build-plan.md                           # Minimal build sequence
08-prompt-library.md                           # Copy/paste prompts for Codex
09-review-and-integration.md                   # Review, PR, and integration discipline
10-sources-and-research-notes.md               # Source notes and implementation assumptions

.ai/                                           # Durable project memory templates
.agents/skills/direction-guide/SKILL.md        # Repo-scoped Codex skill
.codex-markdown/                               # Markdown copies of config/agent TOML snippets
```

## Important note about this zip

This package is intentionally markdown-first. The `.codex-markdown/` files contain copyable TOML snippets for actual Codex config files. Once you are ready, ask Codex to materialize those snippets into real files under `.codex/`.

The only files you should treat as directly repo-ready on day one are:

```text
AGENTS.md
.agents/skills/direction-guide/SKILL.md
.ai/**/*.md
```

## Core principle

Use agents for bounded work, not for vague ownership.

```text
Bad:
"Subagent, fix the project."

Good:
"Verifier, inspect WP-0007 against these acceptance criteria and return PASS/FAIL with evidence. Do not edit files."
```

## Recommended first test

Do not test this system on a mission-critical refactor. Test it on a small, reversible change:

```text
- add one missing unit test
- update one API response field
- fix one well-scoped bug
- document one existing command
- improve one internal utility
```

A successful first run means:

```text
- master thread stays clean
- one work package is created
- implementation is scoped
- verifier checks the result
- failure handling is explicit if needed
- .ai project memory is updated
- final diff is reviewable
```
