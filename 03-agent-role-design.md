# 03 — Agent Role Design

## Minimal agent set

Start with five agents:

```text
1. Master
2. Explorer
3. Implementer
4. Verifier
5. Fixer
```

Add Integrator and Security Reviewer once the core loop works.

## Role table

| Role | Primary job | Edit permission | Should receive |
|---|---|---:|---|
| Master | Decompose, assign, route, integrate | Limited | Project memory, reports, final diffs |
| Explorer | Map codebase and risks | No | Objective, search scope, constraints |
| Implementer | Make scoped change | Yes | Work package, allowed files, tests |
| Verifier | Challenge result | No by default | Objective, acceptance criteria, diff |
| Fixer | Minimal correction | Yes | Failing evidence and allowed files |
| Integrator | Reconcile accepted work | Yes | Accepted reports, diff, memory files |
| Security Reviewer | Check sensitive risks | No by default | Diff, threat model, sensitive files |

## Master

The master owns process, not every detail.

Responsibilities:

```text
- maintain task queue
- decide when to spawn subagents
- write work packages
- collect reports
- classify failures
- route fixes
- enforce human gates
- update project memory
```

Anti-responsibilities:

```text
- raw debugging for every issue
- broad implementation without packaging
- accepting claims without evidence
- letting agents expand scope
```

## Explorer

Use for read-heavy investigation.

Explorer prompt shape:

```text
You are a read-only explorer for WP-xxxx.
Map relevant files, execution paths, tests, dependencies, and risks.
Do not edit files.
Return findings using the agent-report schema.
```

## Implementer

Use only after a work package exists.

Implementer prompt shape:

```text
You are the implementer for WP-xxxx.
Edit only allowed_files.
Do not touch forbidden_files.
Meet acceptance criteria.
Run validation commands when possible.
Return files changed, tests run, and remaining risks.
```

## Verifier

The verifier should be adversarial.

Verifier prompt shape:

```text
You are the verifier for WP-xxxx.
Assume the implementation may be wrong.
Inspect the diff against the acceptance criteria.
Run or recommend validation commands.
Do not fix code.
Return PASS only with evidence.
```

## Fixer

The fixer does not get to redesign the feature.

Fixer prompt shape:

```text
You are the fixer for WP-xxxx.
Fix only the verified failure.
Do not broaden scope.
Preserve the original implementation unless evidence proves it wrong.
Return root cause, patch summary, and validation result.
```

## Integrator

The integrator prepares the result for merge.

Responsibilities:

```text
- confirm memory files are updated
- ensure reports and implementation agree
- summarize final diff
- create PR/commit notes
- identify unresolved risks
```

## Security reviewer

Use when touching:

```text
- auth
- permissions
- payment
- secrets
- tokens
- file upload
- network boundaries
- production config
- dependency upgrades
```

Security reviewer should not be a style reviewer. It should look for actual abuse paths and regression risk.
