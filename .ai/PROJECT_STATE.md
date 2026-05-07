# Project State

## Mission

This repository is a Codex multi-agent direction-system scaffold, used to refine the master-agent structure and operating protocol. It is not an application repository with product features; its durable assets are Markdown guidance, Codex agent definitions, the `direction-guide` skill, and `.ai/` project memory templates. The project goal is to make the master thread, work-package flow, subagent roles, verification gates, and memory updates practical, conservative, and repeatable inside Codex. Real work packages should improve this direction system itself unless the scaffold is copied into another software project.

## Current milestone

- Milestone: Bootstrap Codex multi-agent direction workflow
- Owner: Human + Codex master thread
- Status: YELLOW
- Active work package: none (latest accepted: WP-0017-direction-guide-skill-metadata)

## Important constraints

- This repository is scaffold/documentation for the agent system; do not invent application-code tasks here.
- Do not add dependencies without approval.
- Do not edit auth/security/payment/migrations/production config without approval if this scaffold is later copied into an application repo.
- Do not delete files without explicit human approval.
- Keep changes scoped to Codex guidance, agent definitions, project memory, and validation docs unless a work package explicitly says otherwise.

## Current architecture summary

The repo is organized around Codex-native orchestration:

- Root Markdown files are intentionally lean after approved pruning: `README.md`, `INSTALLATION.md`, and `AGENTS.md` provide entrypoint and setup guidance, while detailed protocol rules live in `.agents/skills/direction-guide/` and `.ai/`.
- `AGENTS.md` defines repository-level operating rules and approval gates.
- `.codex/config.toml` sets conservative Codex defaults, while `.codex/agents/*.toml` defines the explorer, implementer, verifier, fixer, integrator, and security-reviewer roles.
- `.agents/skills/direction-guide/SKILL.md` is the local skill that drives multi-agent orchestration, with supporting references under `.agents/skills/direction-guide/references/`.
- `.ai/` is the durable memory layer for mission, state, queue, decisions, test matrix, risks, integration log, work packages, and agent/automation report locations.
- `.ai/MASTER_MODULES.md` defines the seven master-thread control modules used to move from intake through memory updates before and after delegation.
- `.ai/MASTER_CONTRACT.md` defines the strict operating contract that all multi-agent workflows must satisfy, including master permissions, stop conditions, approval gates, report acceptance rules, and context pollution controls.
- `.ai/MASTER_LEDGER.yaml` records live execution state for the master workflow, including the active milestone, current work package, state-machine state, active agent runs, open decisions, failure tracking, quality metrics, and concurrency limits.
- `.agents/skills/direction-guide/references/context-packet-schema.md` defines the required context packet every subagent spawn must receive.
- `.agents/skills/direction-guide/references/routing-matrix.md` defines the master routing matrix for agent roles, Codex mode selection, and parallelism limits.
- `.agents/skills/direction-guide/references/verification-gate.md` defines the hard verifier evidence gate required before work packages can be marked `ACCEPTED`.
- `.agents/skills/direction-guide/references/config-policy.md`, the routing matrix, and `.ai/MASTER_LEDGER.yaml` agree on the current concurrency baseline: `agents.max_depth = 2` for master-approved implementer child-agent requests, `max_parallel_write_agents = 3` as a ceiling, one writer by default, and parallel implementers only through isolated worktrees with exact disjoint file reservations.
- `.codex/agents/*.toml` role instructions enforce the context packet contract and shared report shape.
- `scripts/validate_protocol.py` is the no-dependency read-only validator for the master-agent protocol scaffold.

## Known risky areas

- Risk: The workflow may become too ceremonial before proving value.
  - Mitigation: Use compact one-line module outputs for small master-only tasks while preserving module order and ownership.
- Risk: Codex may treat this scaffold repo like an application repo and propose irrelevant feature work.
  - Mitigation: Keep `.ai/` memory explicit that work packages should refine the master-agent direction system itself.
- Risk: Module handoffs and delegation prompts may drift as the seven-module flow is exercised.
  - Mitigation: Keep ownership, Routing Controller readiness, the routing matrix, and delegation checklist requirements explicit in `direction-guide`.
- Risk: Documentation-only validation and dirty `.ai/` memory can make acceptance evidence ambiguous.
  - Mitigation: Use deterministic scaffold checks and distinguish pre-existing dirty state from current-task changes during integration.
- Risk: The master could accept work without concrete verifier evidence.
  - Mitigation: Enforce the verification gate and require accepted limitations or explicit human override for non-PASS outcomes.
- Risk: Routing, metrics, and role policy can drift across separate protocol files.
  - Mitigation: Run `python3 scripts/validate_protocol.py` and keep durable routing decisions in `.ai/DECISIONS.md`.
- Risk: Parallel implementer batches may create integration conflicts if shard boundaries are too loose.
  - Mitigation: Require isolated worktrees, exact file reservations, dynamic write-agent caps, shard verification, combined integration review, and `parallel_write_conflicts = 0`.
- Risk: Recursive child-agent requests may hide scope expansion or turn implementers into uncontrolled routers.
  - Mitigation: Limit recursion to depth 2, require master approval for every child request, deny scope expansion, require child report bundles, and track recursive delegation violations.
- Risk: Approved root-doc pruning can leave stale references in setup docs or validation if the slimmer scaffold shape is not checked.
  - Mitigation: Keep `README.md` aligned with the lean root layout and make `scripts/validate_protocol.py` check that approved pruned root docs remain absent from active entrypoint docs.
- Risk: Accepted work can become non-replayable if verifier or fallback verification evidence stays only in chat or memory summaries.
  - Mitigation: Require `verifier_report_path` for accepted, verified, or done queue items and validate that the linked report contains verification-gate evidence markers.
- Risk: Project memory can contradict itself when queue status, work-package status, project state, integration log, and live ledger are updated independently.
  - Mitigation: Validate status consistency across those artifacts in `scripts/validate_protocol.py`.
- Risk: Skill metadata can look correct in a visual scan while still failing YAML parsing.
  - Mitigation: Quote metadata values containing `: ` and make `scripts/validate_protocol.py` validate `direction-guide` skill metadata.

## Recent accepted changes

| Date | Work package | Summary | Verification |
|---|---|---|---|
| 2026-05-06 | WP-0000-bootstrap | Verified scaffold presence and identified repo-specific memory gaps | Manual scaffold inspection passed with memory follow-up |
| 2026-05-06 | WP-0001-repo-memory-specificity | Made project state, task queue, and test matrix specific to this direction-system repo | Scaffold checks and YAML parse passed |
| 2026-05-06 | WP-0002-clean-bootstrap-placeholders | Removed remaining bootstrap placeholders from durable memory | Scaffold checks, placeholder scan, and YAML parse passed |
| 2026-05-06 | WP-0003-master-control-modules | Defined seven explicit master control modules and wired them into `direction-guide` delegation flow | Scaffold checks and Markdown review passed |
| 2026-05-06 | WP-0004-master-operating-contract | Added a strict master operating contract and required `direction-guide` workflows to comply with it | Scaffold checks and Markdown review passed |
| 2026-05-06 | WP-0005-master-ledger | Added live master execution ledger and required `direction-guide` workflows to update it at key control points | Scaffold checks and Markdown review passed |
| 2026-05-06 | WP-0006-context-packet-schema | Added a required context packet schema for every direction-guide subagent spawn | Scaffold checks and Markdown review passed |
| 2026-05-06 | WP-0007-context-packet-alignment-hardening | Aligned role-agent instructions, report template, runtime fallback, and validation checks with the context packet contract | Scaffold and alignment checks passed |
| 2026-05-06 | WP-0008-routing-matrix | Added a routing matrix for master agent role selection, Codex mode selection, and parallelism limits | Routing matrix checks passed |
| 2026-05-06 | WP-0009-verification-gate | Added a hard acceptance gate requiring verifier PASS evidence, scoped PARTIAL acceptance, or explicit human override | Verification gate checks passed |
| 2026-05-06 | WP-0010-master-protocol-consistency | Aligned contract, routing, config, metrics, evals, role policy, failure routing, and verifier fallback language across the master-agent protocol | Consistency, scaffold, YAML, and scope checks passed |
| 2026-05-06 | WP-0011-lightweight-protocol-validator | Added a no-dependency Python validator for repeatable master-agent protocol consistency checks | Validator, scaffold, YAML, diff, placeholder, and scope checks passed |
| 2026-05-06 | WP-0012-guarded-parallel-implementers | Replaced the one-writer baseline with a guarded parallel implementer policy using isolated worktrees, exact file reservations, dynamic caps, and conflict tracking | Validator, scaffold, placeholder, diff, YAML, and scope checks passed |
| 2026-05-06 | WP-0013-depth-2-child-agent-requests | Enabled bounded depth-2 child-agent requests from implementers with master approval, child packet limits, child report bundles, and recursion metrics | Validator, scaffold, recursive policy scan, child-request eval, diff, YAML, and scope checks passed |
| 2026-05-07 | WP-0014-root-doc-pruning-alignment | Aligned the scaffold with human-approved root guide file pruning | Validator, YAML parse, and diff check passed |
| 2026-05-07 | WP-0015-durable-verification-evidence | Added durable verifier/fallback evidence path enforcement and backfilled historical verification evidence | Validator, YAML parse, and diff check passed |
| 2026-05-07 | WP-0016-status-consistency-validation | Added validator coverage for status consistency across queue, work-package files, project state, integration log, and live ledger | Protocol validator, YAML parse, and diff check passed |
| 2026-05-07 | WP-0017-direction-guide-skill-metadata | Fixed invalid `direction-guide` skill metadata and added validator coverage for skill frontmatter | Ruby YAML frontmatter parse, protocol validator, and diff check passed |

## Open questions

- None.

## Next recommended work

1. Exercise guarded parallel implementation on a small documentation-only work package with two exact-file shards before using it on application code.
2. Exercise one read-only child explorer request and one denied child request in manual eval scenarios before allowing child implementers on application code.
3. Keep `scripts/validate_protocol.py` aligned with any future routing, recursion, or concurrency policy refinements.
