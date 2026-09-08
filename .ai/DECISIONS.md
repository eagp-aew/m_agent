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

## DEC-0013: Prune legacy root guide files

- Date: 2026-05-07
- Status: accepted
- Context:
  - The review found 13 tracked root guide files deleted from the working tree.
  - The human explicitly approved those deletions before Section 1 cleanup began.
  - The remaining scaffold should not continue to direct users toward deleted entrypoints.
- Decision:
  - Treat the deleted root guide files as intentional scaffold pruning.
  - Keep root docs lean around `README.md`, `INSTALLATION.md`, and `AGENTS.md`.
  - Keep durable protocol detail under `.agents/skills/direction-guide/` and `.ai/`.
  - Update `scripts/validate_protocol.py` so the approved pruned files are expected to be absent and active entrypoint docs do not reference them.
- Consequences:
  - The validator now catches stale references to deleted root guides.
  - Future restoration of any pruned root guide should be routed through a new explicit work package.

## DEC-0014: Require durable verification evidence paths

- Date: 2026-05-07
- Status: accepted
- Context:
  - The review found accepted work with `verifier_report_path: null`.
  - The existing verification gate required evidence, but it did not require a durable report path in the task queue.
- Decision:
  - Every queue item with status `ACCEPTED`, `VERIFIED`, or `DONE` must link `verifier_report_path` to a durable verifier report or master-direct fallback verification record under `.ai/AGENT_REPORTS/`.
  - The protocol validator must fail when the path is missing, the report file is missing, or the report lacks required verification-gate evidence markers.
  - Historical accepted tasks may share a backfilled historical fallback verification bundle when the original per-task report did not exist.
- Consequences:
  - Accepted work is easier to replay and audit across threads.
  - Future accepted work should prefer one report file per work package instead of relying on the historical bundle pattern.

## DEC-0015: Validate status consistency across durable memory

- Date: 2026-05-07
- Status: accepted
- Context:
  - The review found status drift between `.ai/TASK_QUEUE.yaml`, `.ai/PROJECT_STATE.md`, `.ai/INTEGRATION_LOG.md`, and work-package files.
  - The queue is the task-status index, but accepted-history artifacts and live ledger status must not contradict it.
- Decision:
  - Add a status consistency check to `scripts/validate_protocol.py`.
  - Require queue entries with work-package paths to agree with the referenced file's `task_id` and finished status.
  - Require finished queue items to appear in project state and integration log.
  - Require project/integration accepted-history entries to use finished queue statuses.
  - Require live ledger current work package status to agree with the queue and with the current state-machine state.
- Consequences:
  - Future memory updates should fail validation when they update only one status surface.
  - Historical WP-0001 and WP-0002 are normalized to `ACCEPTED` because they were already listed as accepted in project state and integration log.

## DEC-0016: Validate direction-guide skill metadata

- Date: 2026-05-07
- Status: accepted
- Context:
  - The review found `.agents/skills/direction-guide/SKILL.md` was invalid even though the existing validator passed.
  - The root cause was YAML frontmatter syntax: the unquoted description contained `orchestration: planning`, and the `: ` sequence is not valid inside an unquoted plain scalar.
  - The previous test matrix only displayed the first lines of `SKILL.md`, so it could not catch parse failures.
- Decision:
  - Quote the `description` metadata value in `SKILL.md`.
  - Add a dependency-free skill metadata check to `scripts/validate_protocol.py`.
  - Treat malformed `direction-guide` metadata as a protocol validation failure.
- Consequences:
  - Future changes to the local skill metadata are covered by the default validator.
  - The validator intentionally checks the simple expected metadata shape rather than becoming a general YAML parser.

## DEC-0017: Make tool policy and trust boundaries validator-enforced

- Date: 2026-05-07
- Status: accepted
- Context:
  - The repository review found that tool-calling safety, prompt-injection boundaries, and evidence replayability were mostly voluntary prose.
  - The protocol already required context packets and verification reports, but it did not validate command policy coverage, trust labels, stale report paths, or obvious tracked secrets.
- Decision:
  - Add `.agents/skills/direction-guide/references/tool-policy.md` as the canonical command and tool-use policy.
  - Require context packets to include `trust_boundary` labels for external inputs, tool outputs, durable memory, instruction priority, and quarantine behavior.
  - Require reports to classify commands and mark non-repo evidence paths explicitly.
  - Extend `scripts/validate_protocol.py` with checks for tool-policy coverage, trust-boundary field coverage, replayable report referenced paths, and lightweight scaffold secret patterns.
- Consequences:
  - Future accepted work is easier to audit from durable artifacts.
  - External content and tool output are treated as evidence, not instructions.
  - The validator remains lightweight and dependency-free, so deeper semantic enforcement should come from future negative fixtures and protocol-gate work rather than a large framework.

## DEC-0018: Add protocol gates, schema policy, and negative fixtures

- Date: 2026-05-07
- Status: accepted
- Context:
  - The repository review still had open items after tool policy and trust-boundary hardening: pre-accept gates, negative tests, fallback evidence typing, historical supersession, execution budgets, structured errors, README drift, and context profiles.
  - The goal remains infrastructure for long-running Codex project work, not a standalone runtime or a broader agent swarm.
- Decision:
  - Add `scripts/protocol_gate.py` with read-only `audit`, `pre-implement`, `pre-accept`, and `check-report` commands.
  - Add no-dependency negative tests and fixtures under `tests/`.
  - Add schema policy and context profile references under `.agents/skills/direction-guide/references/`.
  - Type historical fallback evidence as `HISTORICAL_ATTESTATION` and add supersession metadata to historical work packages with old max-depth or one-writer assumptions.
  - Keep recursion depth and parallelism ceilings unchanged.
- Consequences:
  - Review closure is now auditable through both durable coverage records and executable checks.
  - Future accepted work can use a pre-accept gate instead of relying only on manual protocol reading.
  - The system is still a Codex scaffold; command execution safety depends on runtime permissions plus the master protocol.

## DEC-0019: Enforce semantic protocol gates

- Date: 2026-05-07
- Status: accepted
- Context:
  - Read-only review found that protocol gates could pass with a verifier report from the wrong task, marker-only failing reports, shallow work packages, and unbackticked missing evidence paths.
  - Role-agent TOMLs also omitted `trust_boundary` from their required packet-field validation list even though the context packet schema required it.
- Decision:
  - Require `pre-accept` report task ids to match the requested work package.
  - Make report gates parse status, recommendation, and verifier score semantics instead of accepting marker words alone.
  - Reject `FAIL` reports, require accepted limitations for `PARTIAL`, and require affirmative score fields for `PASS`.
  - Reuse report-gate semantics for durable verifier evidence paths.
  - Extend path auditing to bare repo-like paths while preserving explicit external/runtime/user/generated/not_applicable markers.
  - Require every baseline role agent to validate `trust_boundary` before acting.
- Consequences:
  - Accepted work is harder to spoof with stale or mismatched evidence.
  - Tests should run subprocess validators with `-B` to avoid tracked bytecode churn.
  - Future protocol-gate changes should add negative fixtures before acceptance.

## DEC-0020: Define an exportable runtime bundle

- Date: 2026-05-07
- Status: accepted
- Context:
  - The user and multiple reviews noted that the repository was still perceived as a scaffold rather than a copyable runtime structure for real project repos.
  - Adoption needed a boundary between reusable master-agent runtime assets and this scaffold repo's development-only `.ai` history.
- Decision:
  - Define the runtime bundle in `README.md`, `INSTALLATION.md`, and `.ai/TEST_MATRIX.md`.
  - Treat root entrypoints, `.codex` config and agents, the `direction-guide` skill, validation scripts, validator tests/fixtures, and rewritten target-repo `.ai` seed memory as the reusable runtime.
  - Treat this repo's historical work packages, agent reports, accepted-work history, active ledger state, and scaffold next-work notes as development-only history that should not be copied wholesale into target repos.
  - Extend `scripts/validate_protocol.py` with export-bundle file and documentation checks.
- Consequences:
  - Real project adoption now has an explicit copy/install flow.
  - The validator can catch missing runtime assets before bootstrap work is accepted.
  - Target repos still need fresh or rewritten `.ai` memory before application work begins.

## DEC-0021: Enforce DONE ledger closure

- Date: 2026-05-07
- Status: accepted
- Context:
  - Post-WP-0021 rescan found that the protocol required clearing active execution state at DONE, but validation only checked status compatibility.
  - A stale DONE ledger could make future agents treat completed agents, reservations, worktrees, or null metrics as still active.
- Decision:
  - Add `check_ledger_done_closure()` to `scripts/validate_protocol.py`.
  - Fail validation when `current_state_machine_state: DONE` retains active agent runs, active parallel batch, file reservations, worktree assignments, nonzero effective write-agent count, or null per-work-package metrics.
  - Add `tests/fixtures/stale_done_ledger.yaml` and unit coverage for the adverse stale DONE case.
- Consequences:
  - Memory closure now has an executable guard instead of relying on prose.
  - The live ledger must use concrete metric values before `DONE`.
  - The check intentionally stays dependency-free and follows the current top-level ledger shape.

## DEC-0022: Require child implementer write leases

- Date: 2026-05-07
- Status: accepted
- Context:
  - Child implementers could edit exact subsets of parent reservations, but the protocol did not say who owned the write lease while the child was active.
  - Without explicit lease ownership, a parent and child could both modify the same reserved file during a child run.
- Decision:
  - Require child implementer packets to include `write_lease_id`, `leased_files`, `lease_owner_agent_run_id`, and `parent_write_state: paused_for_leased_files`.
  - Require the master to record the write lease before spawning a child implementer.
  - Require the parent implementer to pause writes to leased files until the child report is reviewed and the master records the lease as returned or revoked.
  - Add validator and unit-test coverage for the required lease-policy markers.
- Consequences:
  - Child implementer write ownership is explicit and auditable.
  - Parent/child concurrent edits to leased files become protocol conflicts rather than convention failures.
  - The validator remains lightweight and marker-based.

## DEC-0023: Account for historical work-package exceptions

- Date: 2026-05-07
- Status: accepted
- Context:
  - Four accepted scaffold-history tasks predated durable work-package enforcement and still have `work_package_path: null`.
  - The metrics target said 100% work-package coverage without making those exceptions explicit, which could overstate compliance.
- Decision:
  - Treat `WP-0001-repo-memory-specificity`, `WP-0002-clean-bootstrap-placeholders`, `WP-0003-master-control-modules`, and `WP-0008-routing-matrix` as the only historical pre-enforcement work-package exceptions.
  - Require those exceptions to keep `work_package_path: null` and link to `.ai/AGENT_REPORTS/historical-fallback-verification.md`.
  - Require every other accepted or DONE task to have an explicit `work_package_path`.
  - Add validator and unit-test coverage for this accounting.
- Consequences:
  - The 100% work-package metric now applies cleanly to post-enforcement accepted work.
  - Future accepted work cannot silently omit a work package.
  - Historical exceptions remain auditable instead of pretending the old evidence shape existed.

## DEC-0024: Adopt the Personal Co V1 foundation architecture

- Date: 2026-09-04
- Status: accepted
- Context:
  - The supplied product and technical design requires a desktop-first Expo Web client backed by one persistent self-hosted Letta agent.
  - The design fixes the V1 memory model, epistemic states, import safeguards, manual model switching, and learning-state rules.
  - The referenced `letta-ai/co` repository has no declared license at the reviewed commit, so direct source, asset, or text reuse would create avoidable licensing risk.
- Decision:
  - Build an original implementation under `personal-co/` and use `letta-ai/co` only as an architectural reference pinned to commit `0daccb8f2d69f40bcbc01994f9fb3c2c183f7229`.
  - Reuse exactly one agent tagged `personal-co-v1`; fail closed on duplicates or a nonconforming existing six-block memory schema.
  - Keep exactly four writable user blocks and two read-only policy blocks, route uncertainty to archive, and require confirmation for stable memory and external writes.
  - Keep model and embedding handles configurable, use the document's DeepSeek, GPT-5.6 Terra, and Ollama values as deployment handles, and provide no automatic cross-provider fallback.
  - Treat WP-0025 as a verified foundation milestone; live Letta interoperability, Memory Changes, forget/export, and backup/restore remain follow-up work before full V1 completion.
- Consequences:
  - The repository is now an application project that retains the Codex direction runtime for controlled delivery.
  - Tests cover the highest-risk pure contracts, including duplicate-agent rejection, exact existing memory schema, and same-ID updates.
  - Deployment success still depends on a reachable Letta server with the configured handles registered.

## DEC-0025: Bind persistent-memory actions to one connected agent context

- Date: 2026-09-05
- Status: accepted
- Context:
  - The design requires one persistent Letta agent and explicit user control over durable memory changes.
  - A pending stable-memory proposal must never cross a connection transition and apply to a different agent, even if it is created during the asynchronous reconnect window.
  - Export, restore, forget, archive deletion, and temporary-session reconciliation need honest same-agent behavior without claiming server-level backup guarantees.
- Decision:
  - Treat `connection.status === connected`, a present client, and an exact current agent ID as one indivisible authorization context for every persistent-memory action.
  - Store the immutable agent ID on each pending stable-memory proposal, reject unbound proposals, cancel proposals at every connection boundary, and revalidate the binding immediately before Apply.
  - Keep PERSONA and MEMORY_POLICY unwritable; require explicit confirmation for stable edits, clear, forget, passage deletion, and restore.
  - Export only secret-filtered portable application data and restore only to the exact connected agent without creating or switching agents.
  - Treat temporary-session rollback as best-effort reconciliation that reports irrecoverable live-backend changes rather than claiming success.
- Consequences:
  - Cross-agent proposal races fail closed and have a dedicated regression test.
  - Memory governance and portable snapshots remain compatible with the single-agent foundation.
  - Full V1 acceptance still requires live Letta integration evidence and does not equate portable JSON snapshots with database backup.

## DEC-0026: Require exact registered model handles before Agent operations

- Date: 2026-09-07
- Status: accepted
- Context:
  - The design requires generation and embedding handles to come from the self-hosted Letta inventory and forbids automatic cross-provider fallback.
  - Before WP-0028, configured handles could reach tagged-Agent list/create/update flows without exact inventory validation.
  - The application connection path also used an Agent-list request as its initial connectivity probe.
- Decision:
  - Use Letta's health endpoint for the initial connection probe so no Agent lifecycle call precedes model preflight.
  - Fetch both generation and embedding inventories and require exact, case-sensitive equality to a nonblank registered `handle` before any `agents.*` call.
  - Sanitize inventory transport errors, reject unavailable handles without substitution, and reuse the validated normalized values for create/update operations.
  - Preserve the existing tagged Agent ID, six-block policy, disabled sleeptime, and no-fallback behavior.
- Consequences:
  - Misconfigured or unavailable handles fail before any Agent lookup or mutation and have deterministic adapter-level regression coverage.
  - Model availability and lifecycle behavior still require validation against the user's live self-hosted Letta deployment.
  - Transactional model switching, embedding invariance, snapshot/regression gating, and rollback remain separate work.

## DEC-0027: Make model switching an application transaction

- Date: 2026-09-07
- Status: accepted
- Context:
  - The design requires a generation-model change to retain the exact Agent ID, embedding, fixed Blocks, and Archive, with writes paused and rollback available.
  - A reconnect-time configuration update cannot establish a complete snapshot boundary or distinguish a deliberate model switch from configuration drift.
  - Multi-step UI workflows can outlive a single adapter call, so a mutation counter alone cannot provide a safe switch boundary.
- Decision:
  - Reject model or embedding mismatches during ordinary reconnect; only the explicit switch flow may change the generation model.
  - Acquire a callback-scoped application-instance workflow lease, synchronously latch the write barrier, drain active work, validate exact target/current inventories, and capture complete Block and Archive state with fail-closed pagination.
  - Patch only the generation model and disabled-sleeptime flag on the existing Agent ID; never send an embedding change or create, delete, or replace the Agent.
  - Verify fresh Agent identity, embedding, six-block schema, Block limits/content/metadata, and canonical Archive content after the update.
  - On any post-attempt failure, compensate to the original model and verify the rollback; retain the write lock when rollback cannot be proven.
  - Treat this as a local application transaction only. Database snapshots, live provider behavior, and coordination with external clients remain separate deployment concerns.
- Consequences:
  - Deterministic tests now prove local success, barriers, invariant failures, compensation, and fail-closed rollback behavior.
  - Current application workflows must await every operation started through the scoped workflow facade.
  - A live Letta deployment and server/operator-level write pause are still required to validate cross-client and database-level safety.

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
| DEC-0013 | 2026-05-07 | accepted | Prune legacy root guide files |
| DEC-0014 | 2026-05-07 | accepted | Require durable verification evidence paths |
| DEC-0015 | 2026-05-07 | accepted | Validate status consistency across durable memory |
| DEC-0016 | 2026-05-07 | accepted | Validate direction-guide skill metadata |
| DEC-0017 | 2026-05-07 | accepted | Make tool policy and trust boundaries validator-enforced |
| DEC-0018 | 2026-05-07 | accepted | Add protocol gates, schema policy, and negative fixtures |
| DEC-0019 | 2026-05-07 | accepted | Enforce semantic protocol gates |
| DEC-0020 | 2026-05-07 | accepted | Define an exportable runtime bundle |
| DEC-0021 | 2026-05-07 | accepted | Enforce DONE ledger closure |
| DEC-0022 | 2026-05-07 | accepted | Require child implementer write leases |
| DEC-0023 | 2026-05-07 | accepted | Account for historical work-package exceptions |
| DEC-0024 | 2026-09-04 | accepted | Adopt the Personal Co V1 foundation architecture |
| DEC-0025 | 2026-09-05 | accepted | Bind persistent-memory actions to one connected agent context |
| DEC-0026 | 2026-09-07 | accepted | Require exact registered model handles before Agent operations |
| DEC-0027 | 2026-09-07 | accepted | Make model switching an application transaction |
