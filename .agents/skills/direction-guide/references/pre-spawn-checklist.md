# Pre-Spawn Checklist

Before spawning any subagent, the master must complete this checklist and keep the answers concise. The checklist is a routing gate, not a substitute for the context packet. If any answer is missing, unsafe, or contradictory, do not spawn the subagent.

## Required Answers

- What exact task is being delegated?
- Why is a subagent needed?
- Which routing rule applies?
- What is the smallest sufficient context packet?
- What files may the agent touch?
- What files are forbidden?
- What output schema is required?
- What is the stop condition?
- How will success be verified?
- Does this require human approval?
- If this is a parallel implementer batch, what is the `parallel_batch_id`, per-shard `shard_id`, isolated worktree, exact file reservation, and effective write-agent count?
- If this is an implementer-requested child agent, what is the `request_id`, trigger, parent run id, approved child role, approved depth, child budget, child write policy, and fallback if denied?

## Completion Rules

- The delegated task must map to one active work package and one agent role.
- The reason for delegation must identify why master-direct work is insufficient or why the role adds necessary review, isolation, parallel read-only mapping, verification, fixing, integration, or security coverage.
- The routing rule must come from `.agents/skills/direction-guide/references/routing-matrix.md`.
- The smallest sufficient context packet must follow `.agents/skills/direction-guide/references/context-packet-schema.md` and include only the source-of-truth files, read scope, write scope, acceptance criteria, validation commands, output schema, and stop conditions needed for the assignment.
- Allowed files and forbidden files must be explicit. Read-only roles must have no write scope.
- The output schema must be the required subagent report schema or a stricter role-specific schema that includes all common required fields.
- Stop conditions must include scope expansion, missing required context, conflicting instructions, forbidden-file pressure, approval-gate pressure, and validation blockers.
- Success verification must identify the acceptance criteria and commands, evidence review, verifier route, or master fallback verification that will be used before acceptance.
- Human approval must be recorded before spawning if the assignment touches approval-gated work, expands scope, deletes files, changes dependencies, modifies sensitive areas, or changes user-visible behavior outside the work package.
- Parallel implementer batches must pass the routing matrix's parallel implementation gate before any shard is spawned.
- Parallel implementer shard scopes must use exact file paths only. If the master needs globs, directory ownership, generated files, shared public interfaces, dependency manifests, migrations, sensitive areas, deletion, or broad refactors, route the work as single-writer unless explicit human approval permits a narrower exception.
- The master must record file reservations, worktree assignments, `effective_parallel_write_agents`, and `parallel_batch_id` in the ledger before spawning parallel implementers.
- Implementer-requested child agents must pass the routing matrix's child-agent request gate before spawn.
- The master must approve or deny every child-agent request and record the decision in the ledger before any child is spawned.
- Approved child-agent packets must set `delegation_depth: 2`, `max_child_depth: 0`, `can_request_child_agents: false`, and `child_spawn_mode: "none"`.
- Child implementer write scopes must be exact subsets of the parent implementer's reserved files and must not overlap sibling child reservations.
- If a child request would expand scope, change acceptance criteria, alter approval gates, require deletion, add dependencies, touch sensitive areas, or create grandchild delegation, deny the request and route the issue back to the master.
