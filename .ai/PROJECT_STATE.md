# Project State

## Mission

This repository is a Codex multi-agent direction-system scaffold, used to refine the master-agent structure and operating protocol. It is not an application repository with product features; its durable assets are Markdown guidance, Codex agent definitions, the `direction-guide` skill, and `.ai/` project memory templates. The project goal is to make the master thread, work-package flow, subagent roles, verification gates, and memory updates practical, conservative, and repeatable inside Codex. Real work packages should improve this direction system itself unless the scaffold is copied into another software project.

## Current milestone

- Milestone: Bootstrap Codex multi-agent direction workflow
- Owner: Human + Codex master thread
- Status: YELLOW
- Active work package: WP-0002-clean-bootstrap-placeholders

## Important constraints

- This repository is scaffold/documentation for the agent system; do not invent application-code tasks here.
- Do not add dependencies without approval.
- Do not edit auth/security/payment/migrations/production config without approval if this scaffold is later copied into an application repo.
- Do not delete files without explicit human approval.
- Keep changes scoped to Codex guidance, agent definitions, project memory, and validation docs unless a work package explicitly says otherwise.

## Current architecture summary

The repo is organized around Codex-native orchestration:

- Root Markdown files explain the system, installation flow, operating model, role design, context/memory policy, failure routing, human gates, MVP build plan, prompts, review/integration, and research notes.
- `AGENTS.md` defines repository-level operating rules and approval gates.
- `.codex/config.toml` sets conservative Codex defaults, while `.codex/agents/*.toml` defines the explorer, implementer, verifier, fixer, integrator, and security-reviewer roles.
- `.agents/skills/direction-guide/SKILL.md` is the local skill that drives multi-agent orchestration, with supporting references under `.agents/skills/direction-guide/references/`.
- `.ai/` is the durable memory layer for mission, state, queue, decisions, test matrix, risks, integration log, work packages, and agent/automation report locations.
- `.ai/MASTER_MODULES.md` defines the seven master-thread control modules used to move from intake through memory updates before and after delegation.

## Known risky areas

- Risk: The workflow may become too ceremonial before proving value.
  - Mitigation: Complete one small work package before adding more roles or automation.
- Risk: Codex may treat this scaffold repo like an application repo and propose irrelevant feature work.
  - Mitigation: Keep `.ai/` memory explicit that work packages should refine the master-agent direction system itself.
- Risk: Validation may be too informal because the repo has no package manager or test framework.
  - Mitigation: Use deterministic file-presence, metadata, placeholder, and git-scope checks until a stronger scaffold validator is introduced.

## Recent accepted changes

| Date | Work package | Summary | Verification |
|---|---|---|---|
| 2026-05-06 | WP-0000-bootstrap | Verified scaffold presence and identified repo-specific memory gaps | Manual scaffold inspection passed with memory follow-up |
| 2026-05-06 | WP-0001-repo-memory-specificity | Made project state, task queue, and test matrix specific to this direction-system repo | Scaffold checks and YAML parse passed |
| 2026-05-06 | WP-0003-master-control-modules | Defined seven explicit master control modules and wired them into `direction-guide` delegation flow | Scaffold checks and Markdown review passed |

## Open questions

- Should the repo add a lightweight scaffold validation script later, or keep validation as documented shell commands?

## Next recommended work

1. Verify and accept WP-0002 after placeholder cleanup.
2. Decide whether the next work package should add a lightweight scaffold validator or continue refining the written protocol.
3. Exercise the seven control modules on the next real work package and tighten the protocol if it proves too ceremonial.
