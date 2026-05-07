# Decisions

## DEC-0001: Adopt Codex multi-agent direction protocol

- Date: 2026-05-06
- Status: accepted
- Context:
  - This repo exists to refine the master-agent structure and operating system for Codex multi-agent work.
  - We want low-context, semi-automatic project execution inside Codex without letting subagents become the durable source of truth.
- Decision:
  - Use a master thread, bounded subagents, work packages, verifier gates, and durable `.ai/` memory.
- Consequences:
  - More upfront protocol.
  - Cleaner context.
  - Easier review and continuation across threads.
  - Work packages in this repo should improve the direction scaffold itself, not invent application features.

## DEC-0002: Use seven master control modules

- Date: 2026-05-06
- Status: accepted
- Context:
  - The master-agent workflow needs clearer control boundaries before delegation.
  - State-machine steps describe sequence, but they do not fully identify which decisions the master owns.
- Decision:
  - Define seven master-thread control modules: Intake, Scope, Context, Routing, Verification, Integration, and Memory.
  - Require `direction-guide` to route work through these modules before delegating bounded tasks.
- Consequences:
  - Delegation decisions become more explicit.
  - Verification, integration, and memory updates remain owned by the master thread.
  - The protocol gains structure that should be tested against real small work packages to avoid excess ceremony.

## DEC-0003: Adopt a strict master operating contract

- Date: 2026-05-06
- Status: accepted
- Context:
  - The master-agent workflow needs an explicit boundary between orchestration and implementation.
  - The master should control scope, routing, verification, integration, and durable memory instead of becoming the default code implementer.
- Decision:
  - Add `.ai/MASTER_CONTRACT.md` as the binding operating contract for all multi-agent workflows.
  - Require `direction-guide` to read and comply with the contract before planning, delegation, or direct implementation.
- Consequences:
  - Master authority and stop conditions are clearer.
  - Subagent reports become evidence that the master must accept or reject, not automatic truth.
  - The protocol gains another required document that should be kept concise and tested against real work packages.

## DEC-0004: Track live execution state in a master ledger

- Date: 2026-05-06
- Status: accepted
- Context:
  - `TASK_QUEUE.yaml` tracks backlog and task status, but it does not provide a single current-state snapshot for the master workflow.
  - The master needs durable visibility into the active milestone, current work package, state-machine state, active agent runs, open decisions, failures, quality metrics, and concurrency limits.
- Decision:
  - Add `.ai/MASTER_LEDGER.yaml` as the live execution-state ledger.
  - Require `direction-guide` workflows to update the ledger when starting, assigning, verifying, fixing, integrating, blocking, or completing a work package.
- Consequences:
  - Continuation across threads should be easier because the current execution state has a single durable source.
  - The ledger must stay lightweight and should not replace `TASK_QUEUE.yaml` as the backlog index.

## DEC-0005: Require context packets for subagent delegation

- Date: 2026-05-06
- Status: accepted
- Context:
  - Delegation prompts already required work-package scope, allowed files, forbidden files, acceptance criteria, validation expectations, and report format.
  - The protocol still needed a reusable handoff schema that makes source of truth, read boundaries, stop conditions, and role-specific context explicit.
- Decision:
  - Add `.agents/skills/direction-guide/references/context-packet-schema.md` as the required packet schema for all direction-guide subagent spawns.
  - Require `direction-guide` to include and validate a complete context packet before spawning explorer, implementer, verifier, fixer, integrator, or security-reviewer roles.
- Consequences:
  - Subagent prompts become more consistent and easier to audit.
  - The master has a clearer checklist for preventing context pollution and scope drift.
  - Packets should be kept compact so the workflow does not become unnecessarily ceremonial.

## DEC-0006: Align role agents and reports with context packets

- Date: 2026-05-06
- Status: accepted
- Context:
  - `direction-guide` required context packets for subagent spawns, but role-agent instruction files and the report template did not yet enforce the same contract.
  - Runtime policy may disallow subagent spawning even when repository protocol recommends a verifier, fixer, integrator, or reviewer role.
- Decision:
  - Require role agents to treat `context_packet` as source of truth, block on missing or conflicting packet fields, obey read/write scope, and return the shared report fields.
  - Document runtime fallback so the master performs role duties directly, records the reason, and does not simulate a subagent report when spawning is unavailable or disallowed.
  - Keep alignment validation text-based for now instead of adding a script.
- Consequences:
  - Delegation prompts and reports should drift less across roles.
  - Read-only packets can forbid all writes without accidentally forbidding all reads.
  - A scriptable validator remains possible future work if text-based checks prove too weak.

## DEC-0007: Require a routing matrix before delegation

- Date: 2026-05-06
- Status: accepted
- Context:
  - The master had role-specific delegation rules, but Codex mode selection and parallelism limits were not captured in one reusable reference.
  - Routing decisions should be explicit before subagents are spawned or worktrees are selected.
- Decision:
  - Add `.agents/skills/direction-guide/references/routing-matrix.md` as the source for master agent routing, Codex mode routing, and parallelism limits.
  - Require `direction-guide` to consult the matrix before delegation and record the selected agent route, Codex mode route, and parallelism constraints.
- Consequences:
  - Routing choices become easier to audit.
  - The matrix reinforces existing limits: one write-capable implementer under the current `max_parallel_write_agents = 1` baseline, no parallel fixers for the same failure, and recursive delegation disabled while `agents.max_depth = 1`.
  - The matrix must stay aligned with role-agent config and the master contract as the workflow evolves.

## DEC-0008: Make verifier evidence a hard acceptance gate

- Date: 2026-05-06
- Status: accepted
- Context:
  - The workflow required verification before completion, but the exact evidence needed to mark a work package `ACCEPTED` was not captured as a reusable gate.
  - Verifier output needed a score schema so the master can audit acceptance criteria, validation evidence, forbidden-file checks, risks, and recommendation consistently.
- Decision:
  - Add `.agents/skills/direction-guide/references/verification-gate.md` as the hard acceptance gate for work packages.
  - Require `direction-guide` to enforce the gate before `ACCEPTED`, including runtime fallback verification when verifier subagents cannot run.
  - Require verifier output to include gate evidence and the score schema: `acceptance_criteria_checked`, `tests_or_reason_present`, `forbidden_files_checked`, `risks_recorded`, and `recommendation`.
- Consequences:
  - The master cannot mark work accepted from vague verification.
  - `PARTIAL` acceptance must include recorded limitations.
  - Human overrides of verifier failure must be explicit.

## DEC-0009: Align strict routing, config, and verifier fallback policy

- Date: 2026-05-06
- Status: superseded in part by DEC-0011 and DEC-0012
- Context:
  - The protocol had drift between config policy, routing matrix, role policy, metrics, and verifier-gate language.
  - Some docs allowed parallel implementers despite `max_parallel_write_agents = 1`, mentioned a non-baseline performance reviewer, or described verifier reports without clearly including master-direct fallback verification.
- Decision:
  - Keep `agents.max_depth = 1` and keep recursive delegation disabled under the current baseline.
  - Keep exactly one write-capable implementer unless a future approved work package changes the workflow-level policy.
  - Use only the baseline roles: explorer, implementer, verifier, fixer, integrator, and security-reviewer.
  - Treat verifier subagent reports and master-direct fallback verification as equivalent acceptance-gate evidence when they use the same required evidence shape.
- Consequences:
  - The master workflow is stricter and easier to audit.
  - Runtime fallback no longer weakens verification, but it also cannot be recorded as if a subagent ran.
  - Future concurrency or recursion changes require an explicit work package and human approval. WP-0012 superseded the one-writer part; WP-0013 superseded the no-recursion part with bounded depth-2 child-agent requests.

## DEC-0010: Add a lightweight protocol validator

- Date: 2026-05-06
- Status: accepted
- Context:
  - The protocol consistency checks were documented as manual shell searches in `.ai/TEST_MATRIX.md`.
  - Repeated manual checks are easy to skip or misread as the scaffold grows.
- Decision:
  - Add `scripts/validate_protocol.py` as a no-dependency Python stdlib validator for the master-agent protocol scaffold.
  - Keep the first version scripted and explicit rather than a deep Markdown/TOML/YAML parser.
  - Make the validator read-only; it reports drift and exits nonzero but does not modify files.
- Consequences:
  - Future protocol edits have one preferred consistency command.
  - The validator can grow only when repeated drift justifies more checks.
  - No runtime dependency or package manager is introduced.

## DEC-0011: Adopt guarded parallel implementers

- Date: 2026-05-06
- Status: accepted
- Context:
  - The prior conservative baseline allowed only one write-capable implementer at a time.
  - The master-agent structure needs a safe path for multiple implementers to edit different files without creating merge conflicts or scope drift.
- Decision:
  - Set `max_parallel_write_agents = 3` as a ceiling, not a default.
  - Let the master compute the effective per-task write-agent count from the global ceiling, number of independent exact-file shards, and available agent capacity.
  - Permit parallel implementers only through isolated worktrees, unique shard ids, exact disjoint file reservations, shard validation, independent verification, and combined integration review.
  - Keep `agents.max_depth = 1`, baseline roles only, no dependency changes, no deletion, and no recursive delegation.
- Consequences:
  - Small independent file edits can proceed concurrently when the Routing Controller can prove safe ownership.
  - Ambiguous ownership, globs, generated shared files, public APIs, dependencies, migrations, sensitive areas, deletion, and broad refactors fall back to single-writer mode unless explicitly approved.
  - The ledger, metrics, test matrix, and validator now track effective write-agent count and parallel write conflicts.
  - The no-recursive-delegation part is superseded by DEC-0012, which allows bounded depth-2 child-agent requests with master approval.

## DEC-0012: Enable bounded depth-2 child-agent requests

- Date: 2026-05-06
- Status: accepted
- Context:
  - Guarded parallel implementers allow the master to split independent write shards, but implementers may discover a need for narrower child help mid-task.
  - Free-form recursion would hide scope, approval, and verification failures.
  - The user approved enabling depth 2 with master approval for every implementer child-agent request.
- Decision:
  - Set `.codex/config.toml` `agents.max_depth = 2`.
  - Allow recursion only as `master -> implementer -> child agent`.
  - Require implementers to submit structured `child_agent_requests` and wait for master approval before child spawn.
  - Allow child roles `explorer`, `verifier`, `security-reviewer`, and exact-file-subset `implementer`; do not allow child fixers in v1.
  - Require child packets to set `delegation_depth: 2`, `max_child_depth: 0`, `can_request_child_agents: false`, and `child_spawn_mode: "none"`.
  - Keep final verification, integration, and durable memory updates owned by the master.
- Consequences:
  - Implementers can ask for targeted help when they hit missing context, independent subshards, pre-return verification needs, security signals, or validation bottlenecks.
  - The master remains the Routing Controller and may deny requests that expand scope, touch approval-gated areas, or exceed budgets.
  - The validator, ledger, metrics, and report template now track child requests, approval decisions, report bundles, max observed depth, child scope violations, and recursive delegation violations.

## Decision log

| ID | Date | Status | Title |
|---|---|---|---|
| DEC-0001 | 2026-05-06 | accepted | Adopt Codex multi-agent direction protocol |
| DEC-0002 | 2026-05-06 | accepted | Use seven master control modules |
| DEC-0003 | 2026-05-06 | accepted | Adopt a strict master operating contract |
| DEC-0004 | 2026-05-06 | accepted | Track live execution state in a master ledger |
| DEC-0005 | 2026-05-06 | accepted | Require context packets for subagent delegation |
| DEC-0006 | 2026-05-06 | accepted | Align role agents and reports with context packets |
| DEC-0007 | 2026-05-06 | accepted | Require a routing matrix before delegation |
| DEC-0008 | 2026-05-06 | accepted | Make verifier evidence a hard acceptance gate |
| DEC-0009 | 2026-05-06 | superseded in part | Align strict routing, config, and verifier fallback policy |
| DEC-0010 | 2026-05-06 | accepted | Add a lightweight protocol validator |
| DEC-0011 | 2026-05-06 | accepted | Adopt guarded parallel implementers |
| DEC-0012 | 2026-05-06 | accepted | Enable bounded depth-2 child-agent requests |
