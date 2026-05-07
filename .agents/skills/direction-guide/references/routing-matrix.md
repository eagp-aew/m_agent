# Routing Matrix

Use this matrix when the master agent decides where work should run and which role, if any, should receive a bounded delegation. The matrix is advisory only inside the master workflow; repository instructions, the master contract, approval gates, work-package scope, and runtime permissions still take precedence.

## Agent Routing Decision Matrix

| Condition | Route | Rule |
|---|---|---|
| scope unclear | `explorer` | Use a read-only explorer to map relevant files, current behavior, risks, and validation targets before implementation planning. |
| implementation clear and bounded | `implementer` | Use one write-capable implementer by default after the work package has objective, allowed files, forbidden files, acceptance criteria, validation commands, and report requirements. |
| implementation shards are independent | parallel `implementer` batch | Use multiple implementers only when the parallel implementation gate passes: each shard has a unique `shard_id`, an isolated worktree, exact allowed files with no globs, disjoint file reservations, shard validation commands, and no approval-gated shared surface unless explicit human approval is recorded. |
| implementer needs bounded child help | child-agent request | Allow the implementer to request a child agent only through the child-agent request gate. The master approves or denies every request before spawn and records the decision in the ledger. |
| implementation complete | `verifier` | Use a verifier to check acceptance criteria, validation evidence, regressions, and risky assumptions before accepting the work. |
| verified failure | `fixer` | Use a fixer only after verifier evidence is concrete and the master has classified the failure. |
| accepted work | `integrator` | Use an integrator after implementation and verification are complete to reconcile scoped changes, evidence, dirty-worktree safety, and memory updates. |
| auth/security/payment risk | `security-reviewer` | Use a security reviewer for authentication, authorization, secrets, payment, data exposure, production config, or comparable security-sensitive risk. |
| ambiguous requirement | Human/master decision | Stop routing and ask for a human or master decision when intent, scope, approval, or acceptance criteria cannot be made safe from available context. |

## Codex Mode Routing Decision Matrix

| Work shape | Codex route | Rule |
|---|---|---|
| Planning only | Local thread | Keep planning and decisions in the local thread. Do not create worktrees for plan-only work. |
| Read-only exploration | Local or Worktree | Use local exploration for small context gathering; use a worktree when isolation helps compare state or keep logs separate. |
| Small safe edit | Local or Worktree | Use local edits when scope is narrow and low-risk; use a worktree when the dirty worktree or review needs isolation. |
| Large implementation | Worktree | Use a worktree for broad, multi-file, or longer-running implementation so review and rollback stay isolated. |
| Risky experiment | Worktree | Use a worktree for uncertain approaches, potentially disruptive validation, or changes likely to be abandoned. |
| Competing approaches | Multiple Worktrees | Use separate worktrees only when approaches are independent and comparison has clear acceptance criteria. |
| Parallel implementation shards | Multiple Worktrees | Required for guarded parallel implementers. Each implementer works in its assigned isolated worktree and may edit only exact reserved files. |
| Final review | Review pane/integration thread | Use the review pane or integration thread to inspect final diffs, evidence, risks, and handoff notes before acceptance. |

## Parallelism And Delegation Limits

| Situation | Parallelism rule |
|---|---|
| Parallel explorers | Allowed when read scopes are compatible and outputs are independently useful. |
| Parallel verifiers | Allowed when verification targets are independent or adversarial review benefits from separate checks. |
| Parallel implementers | Allowed only through the guarded parallel policy. The master computes `effective_parallel_write_agents = min(max_parallel_write_agents, number of independent exact-file shards, available agent capacity)`, defaults to one writer when the gate does not pass, and records reservations, worktrees, and conflicts in the ledger. |
| Parallel fixers for the same failure | Not allowed. Assign one fixer for a verified failure, then re-verify before another fix attempt. |
| Recursive delegation | Allowed only as `master -> implementer -> child agent` with `agents.max_depth = 2`, master-approved child-agent requests, and `max_child_depth = 0` for every child. Grandchild spawning is not allowed. |

## Parallel Implementation Gate

The Routing Controller may spawn a parallel implementer batch only when all conditions are true:

- every shard has a unique `shard_id`;
- every shard has an isolated worktree recorded before spawn;
- every shard lists exact allowed file paths only, with no globs, directories, generated catchalls, or inferred ownership;
- no two shards reserve the same file;
- each shard has shard-specific validation commands or a written reason validation is not shard-local;
- shared generated files, public APIs, dependency manifests, migrations, auth, payment, permissions, secrets, production config, broad refactors, and deletion tasks force single-writer mode unless explicit human approval is recorded;
- the master can verify each shard independently and then run an integration pass over the combined diff.

The Integration Controller must mark `parallel_write_conflicts` when an implementer modifies an unreserved file, two shards touch the same file, or the combined integration cannot apply cleanly.

## Child-Agent Request Gate

The Routing Controller may approve an implementer-requested child agent only when all conditions are true:

- the parent implementer packet sets `can_request_child_agents: true`, `child_spawn_mode: "master_approved_request"`, and `max_child_depth: 1`;
- the request includes `request_id`, trigger, requested role, objective, why the child is needed, proposed context packet, proposed allowed files, validation commands, risk class, approval gates, fallback if denied, and expected report use;
- the child objective is narrower than the parent implementer objective and does not redefine scope, acceptance criteria, approval gates, or durable memory duties;
- the requested role is one of `explorer`, `verifier`, `security-reviewer`, or `implementer`;
- child `explorer`, `verifier`, and `security-reviewer` packets are read-only;
- a child `implementer` may edit only exact file paths that are already reserved to the parent implementer and are not reserved to another active child;
- a child `implementer` must receive an explicit write lease with `write_lease_id`, `leased_files`, `lease_owner_agent_run_id`, and `parent_write_state: paused_for_leased_files` recorded before spawn;
- while a child implementer write lease is active, the parent implementer must not edit `leased_files` until the child report is reviewed and the master records the lease as returned or revoked;
- the effective write-agent count, including the parent when it is writing and any write-capable children, stays within `max_parallel_write_agents`;
- the master can review every child report before accepting the parent implementer report.

The master must deny child-agent requests when they require new files outside the parent reservation, globs, directory ownership, generated shared files, public API changes, dependency manifests, migrations, auth, payment, permissions, secrets, production config, deletion, broad refactors, or unapproved user-visible behavior.

Allowed request triggers are `missing_context`, `independent_subshard`, `pre_return_verification`, `security_signal`, and `validation_bottleneck`. Any other trigger returns to the master as a normal scope or routing decision.

Every approved child packet must set `delegation_depth: 2`, `max_child_depth: 0`, `can_request_child_agents: false`, and `child_spawn_mode: "none"`. Child agents must not spawn or request grandchildren. Child implementer packets must also carry the approved write lease fields, and the Integration Controller must mark a conflict if parent and child both edit a leased file during the lease.
