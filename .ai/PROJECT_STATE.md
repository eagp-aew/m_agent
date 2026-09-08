# Project State

## Mission

This repository develops Personal Co, a local-first personal assistant backed by one persistent self-hosted Letta agent. The application lives under `personal-co/`; the existing Codex direction runtime remains the delivery and durable-memory layer for planning, verification, and project history.

## Current milestone

- Milestone: Personal Co V1 foundation
- Owner: Human + Codex master thread
- Status: YELLOW
- Active work package: WP-0028-model-handle-preflight (ACCEPTED); latest accepted: WP-0028-model-handle-preflight

## Important constraints

- Preserve exactly one `personal-co-v1` tagged Letta agent across sessions and manual model changes.
- Keep the V1 memory schema fixed to four writable user blocks plus two read-only policy blocks; do not add dynamic block categories.
- Keep uncertain information in archive and require confirmation for stable profile/goals or external writes.
- Do not add automatic cross-provider fallback in V1.
- Do not add dependencies without approval.
- Do not edit auth/security/payment/migrations/production config without approval.
- Do not delete files without explicit human approval.
- Keep changes scoped to an approved work package and preserve the Codex protocol assets.

## Current architecture summary

The repo combines the Personal Co application with Codex-native orchestration:

- `personal-co/App.tsx` provides responsive Expo Web surfaces for Chat, Core Memory, Memory Changes, Archive, Import, and Settings.
- `personal-co/src/services/letta.ts` owns typed Letta client access, health-only connection probing, exact registered generation/embedding handle preflight before Agent operations, exact tagged-agent reuse, memory-schema validation, messaging, archival search and deletion, exact-term forget, temporary-session reconciliation, and same-ID configuration updates.
- `personal-co/src/domain/` contains testable memory, epistemic, import, learning-state, single-agent, change-governance, privacy, and portable-snapshot rules.
- `personal-co/src/config.ts` keeps the Letta URL, model handles, and embedding handle configurable; model switching is manual and has no automatic provider fallback.
- `personal-co/tests/` covers fixed memory blocks, protected writes, archive-first imports, learning evidence, duplicate-agent rejection, exact-handle matching, real adapter ordering and fail-closed inventory errors, existing-schema validation, same-ID updates, agent-bound proposals, exact forget, temporary privacy, import provenance, and secret-free same-agent snapshot restore.
- The accepted WP-0027 audit maps 41 V1 requirements to 12 PROVEN, 14 PARTIAL, 12 MISSING, and 3 LIVE_BLOCKED outcomes; it selects exact model/embedding handle preflight as the smallest next application package without treating local types or mocks as live-server evidence.

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
- `scripts/validate_protocol.py` is the no-dependency read-only validator for the master-agent protocol scaffold, including semantic report-gate checks for task-id matching, verifier outcomes, replayable evidence paths, and role-agent packet trust-boundary alignment.

## Known risky areas

- Risk: The workflow may become too ceremonial before proving value.
  - Mitigation: Use compact one-line module outputs for small master-only tasks while preserving module order and ownership.
- Risk: A typed adapter can still differ from a live Letta deployment or its registered handles.
  - Mitigation: WP-0028 now fails closed on exact registered handle checks before Agent operations; run the next milestone against the user's self-hosted Letta server before calling the full V1 complete.
- Risk: Live Letta behavior for governance metadata, paginated passage deletion, and temporary-session reconciliation may differ from the typed adapter and deterministic tests.
  - Mitigation: WP-0026 now fails closed across connection changes and independently passed all application-layer criteria; exercise the accepted flows against the user's server before full V1 acceptance.
- Risk: Module handoffs and delegation prompts may drift as the seven-module flow is exercised.
  - Mitigation: Keep ownership, Routing Controller readiness, the routing matrix, and delegation checklist requirements explicit in `direction-guide`.
- Risk: Documentation-only validation and dirty `.ai/` memory can make acceptance evidence ambiguous.
  - Mitigation: Use deterministic scaffold checks and distinguish pre-existing dirty state from current-task changes during integration.
- Risk: Historical accepted tasks without work packages can make work-package coverage metrics overclaim.
  - Mitigation: Metrics and validator now enumerate the four pre-enforcement exceptions and require all future accepted work to have `work_package_path`.
- Risk: The master could accept work without concrete verifier evidence.
  - Mitigation: Enforce the verification gate and require accepted limitations or explicit human override for non-PASS outcomes.
- Risk: Routing, metrics, and role policy can drift across separate protocol files.
  - Mitigation: Run `python3 scripts/validate_protocol.py` and keep durable routing decisions in `.ai/DECISIONS.md`.
- Risk: Parallel implementer batches may create integration conflicts if shard boundaries are too loose.
  - Mitigation: Require isolated worktrees, exact file reservations, dynamic write-agent caps, shard verification, combined integration review, and `parallel_write_conflicts = 0`.
- Risk: Recursive child-agent requests may hide scope expansion or turn implementers into uncontrolled routers.
  - Mitigation: Limit recursion to depth 2, require master approval for every child request, deny scope expansion, require child report bundles, track recursive delegation violations, and require child implementer write leases with parent pause state before child writes.
- Risk: Approved root-doc pruning can leave stale references in setup docs or validation if the slimmer scaffold shape is not checked.
  - Mitigation: Keep `README.md` aligned with the lean root layout and make `scripts/validate_protocol.py` check that approved pruned root docs remain absent from active entrypoint docs.
- Risk: Accepted work can become non-replayable if verifier or fallback verification evidence stays only in chat or memory summaries.
  - Mitigation: Require `verifier_report_path` for accepted, verified, or done queue items and validate that the linked report contains verification-gate evidence markers.
- Risk: Project memory can contradict itself when queue status, work-package status, project state, integration log, and live ledger are updated independently.
  - Mitigation: Validate status consistency across those artifacts in `scripts/validate_protocol.py`.
- Risk: DONE ledger state can retain stale active agent runs, reservations, worktree assignments, write-agent counts, or null metrics after accepted work.
  - Mitigation: `scripts/validate_protocol.py` now validates DONE ledger closure and `tests/fixtures/stale_done_ledger.yaml` covers the adverse case.
- Risk: Skill metadata can look correct in a visual scan while still failing YAML parsing.
  - Mitigation: Quote metadata values containing `: ` and make `scripts/validate_protocol.py` validate `direction-guide` skill metadata.
- Risk: Tool-use and prompt-injection safety can remain voluntary if command policy, trust boundaries, and evidence paths are only described in prose.
  - Mitigation: Keep `.agents/skills/direction-guide/references/tool-policy.md` canonical and make `scripts/validate_protocol.py` check tool-policy coverage, trust-boundary fields, report referenced paths, and lightweight scaffold secret patterns.
- Risk: Review findings can appear addressed while remaining prose-only or untested.
  - Mitigation: Use `scripts/protocol_gate.py`, negative fixtures in `tests/`, schema/context validator checks, and `.ai/AGENT_REPORTS/WP-0019-review-coverage.md` to keep review closure auditable.
- Risk: The scaffold can be copied into a real repo with development-only memory or without a clear runtime bundle boundary.
  - Mitigation: README, INSTALLATION, TEST_MATRIX, and the protocol validator now define and check the exportable runtime bundle boundary.

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
| 2026-05-07 | WP-0018-protocol-enforcement-hardening | Added canonical tool policy, required trust-boundary packet fields, report-path audit rules, and validator checks for tool policy, report path replayability, and lightweight scaffold secret patterns | Protocol validator, validator py_compile, and diff check passed |
| 2026-05-07 | WP-0019-review-plan-closure | Closed remaining review findings with protocol gates, negative tests, schema/context policy, historical supersession metadata, fallback evidence typing, execution budgets, structured errors, README cleanup, and a F-01 through F-17 coverage matrix | Protocol validator, protocol gate, negative unittest, py_compile, JSON validator output, and diff check passed |
| 2026-05-07 | WP-0020-protocol-gate-semantic-hardening | Hardened protocol gate semantics for task-id matched verifier reports, PASS/PARTIAL/FAIL report outcomes, shallow work-package gates, durable evidence checks, bare path auditing, role-agent trust boundaries, and bytecode-free validation hygiene | Negative unittest, protocol validator, protocol gate audit, adverse pre-accept, known-good report gate, py_compile, diff check, and independent verifier PASS |
| 2026-05-07 | WP-0021-runtime-export-bundle | Defined the exportable runtime bundle boundary, separated scaffold development history from target-repo memory, documented adoption into real repos, and added validator/test coverage for required export files | Unit tests, protocol validator, protocol gate audit, diff check, and independent verifier PASS |
| 2026-05-07 | WP-0022-ledger-done-closure-validation | Added DONE ledger closure validation so accepted work cannot leave stale active runs, reservations, worktrees, active batch, write-agent count, or null per-work-package metrics | Unit tests, protocol validator, protocol gate audit, diff check, and independent verifier PASS |
| 2026-05-07 | WP-0023-child-write-lease-policy | Added child implementer write-lease policy so parent and child implementers cannot concurrently edit the same leased files | Unit tests, protocol validator, protocol gate audit, diff check, and independent verifier PASS |
| 2026-05-07 | WP-0024-historical-exception-metrics | Made historical work-package exceptions explicit so post-enforcement coverage metrics cannot overclaim | Unit tests, protocol validator, protocol gate audit, diff check, and independent verifier PASS |
| 2026-09-04 | WP-0025-personal-co-foundation | Added an original Expo Web Personal Co foundation with persistent tagged-agent reuse, fixed memory policy, safe imports, learning-state rules, manual model switching, and five product surfaces | 9/9 tests, typecheck, Web export, 29/29 protocol checks, browser smoke QA, pre-accept gate, and independent verifier PASS |
| 2026-09-05 | WP-0026-memory-governance-portability | Added six-surface memory governance, agent-bound confirmation gates, exact forget and archive deletion, privacy controls, import provenance, and secret-free same-agent export/restore | 21/21 tests, typecheck, Web export, 29/29 protocol checks, reconnect regression, browser reconnect QA, and independent verifier PASS |
| 2026-09-07 | WP-0027-v1-completion-audit | Audited all 41 V1 requirements and T-01 through T-12, separated application evidence from live Letta/database claims, and selected exact model-handle preflight as the next slice | Independent verifier PASS for 7/7 criteria, 21/21 tests, typecheck, 29/29 protocol checks, report gate, pre-accept gate, and diff check |
| 2026-09-07 | WP-0028-model-handle-preflight | Added health-only probing plus exact generation/embedding inventory preflight before Agent operations, sanitized fail-closed errors, no fallback, and real adapter ordering regressions | Independent verifier PASS for 8/8 criteria, targeted 10/10 and full 27/27 tests, typecheck, Web export, 29/29 protocol checks, adversarial adapter checks, report gate, and pre-accept gate |

## Open questions

- None. OD-0027 was resolved on 2026-09-07 when the human explicitly authorized one third repair limited to the two report-format fields, followed by gate replay and continued development.

## Next recommended work

1. Connect the accepted application flows to the user's self-hosted Letta deployment with registered handles and run live create/reuse/message/archive/forget/restore/model-switch checks.
2. Package transactional same-Agent model switching with snapshot, paused writes, embedding lock, fixed regressions, and rollback before calling model switching complete.
3. Continue the remaining design-document V1 gaps identified by WP-0027 after the live integration boundary is proven.
4. Evaluate OpenClaw only as an optional channel/Gateway layer after Letta remains the verified single-agent memory source of truth; do not replace the accepted governance model without a separate architecture work package and approval.
