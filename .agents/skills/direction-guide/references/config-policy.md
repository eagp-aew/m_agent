# Config Policy

This policy defines conservative Codex configuration guidance for the direction-guide multi-agent workflow while the workflow is still stabilizing.

## Recommended Defaults

| Setting | Recommendation | Reason |
|---|---|---|
| `.codex/config.toml` `agents.max_depth` | Use `max_depth = 2` only for bounded child-agent request flows. | Allows implementers to request narrow child help while preventing unbounded recursive delegation. |
| `.codex/config.toml` `agents.max_threads` | Start around `5`. | Allows useful read-only scouting and verification without creating too much coordination load. |
| Workflow `max_parallel_write_agents` | Use `max_parallel_write_agents = 3` as a ceiling, with one writer as the default unless the guarded parallel gate passes. | Allows controlled parallel implementation while preserving exact file ownership, worktree isolation, and master integration control. |
| Parallel read-only agents | Allow when useful and scoped. | Compatible read-only explorers or verifiers can improve coverage without write conflicts. |
| Approval gates | Require approval for risky actions. | Human approval is required before dependency, public API, auth, payment, permissions, migrations, secrets, production config, deletion, destructive command, or broad refactor changes. |
| Sandbox posture | Keep sandbox settings conservative. | Prefer read-only sandboxes for explorers, verifiers, and security reviewers; use workspace-write only for bounded implementer, fixer, or explicitly authorized integration work. |

## Change Rules

- Do not increase `agents.max_depth` above `2` under the current workflow baseline. Recursive delegation is allowed only through master-approved implementer child-agent requests with explicit routing rules, verification evidence, and human approval when approval-gated work is implicated.
- Do not increase `agents.max_threads` unless observed work requires more read-only concurrency and the master can still review all outputs.
- Do not weaken approval policy or sandbox mode to make validation easier.
- Do not run parallel write-capable agents unless the guarded parallel gate passes: isolated worktrees, exact disjoint file reservations, shard validation, and ledger tracking.
- The effective write-agent count is computed per task as `min(max_parallel_write_agents, number of independent exact-file shards, available agent capacity)`.
- Fall back to one writer when exact file ownership, isolated worktrees, or safe integration cannot be proven.
- Child-agent requests must be approved by the master before spawning. The implementer may propose child agents, but the master remains the Routing Controller and owns final verification, integration, and memory updates.
- Child agents receive `max_child_depth = 0` and must not spawn or request grandchildren.
- Keep risky actions escalated through the master contract and repository approval gates.

## Current Baseline

The current conservative baseline is:

- `.codex/config.toml` `sandbox_mode = "workspace-write"`
- `.codex/config.toml` `approval_policy = "on-request"`
- `.codex/config.toml` `agents.max_threads = 5`
- `.codex/config.toml` `agents.max_depth = 2`
- `.ai/MASTER_LEDGER.yaml` `max_parallel_write_agents = 3`
- `.ai/MASTER_LEDGER.yaml` `max_parallel_read_agents = 2`

These values should remain stable unless a later work package records evidence that a different setting is safer. The write-agent value is a ceiling, not an instruction to parallelize every implementation, and depth 2 is a request-and-approval mechanism rather than permission for autonomous recursion.
