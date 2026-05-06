# 06 — Human Gates and Stop Rules

## Why semi-auto is better than fully auto

A fully autonomous agent can move quickly in the wrong direction. A semi-auto direction system should move quickly only when the blast radius is small.

## Human approval required before

```text
- public API changes
- database migrations
- auth/security/permissions changes
- payment or billing logic
- production config changes
- dependency additions or major upgrades
- deleting files or data
- broad refactors
- changing user-visible behavior not covered by acceptance criteria
- altering tests to make them pass without explaining why
```

## Human approval request format

```yaml
approval_request:
  task_id: WP-0000
  decision_needed: ""
  why_human_needed: ""
  options:
    - option: A
      tradeoff: ""
    - option: B
      tradeoff: ""
  recommendation: ""
  risk_if_wrong: ""
  files_likely_affected:
    - ""
```

## Stop rules

Stop and escalate when:

```text
- the same error repeats after two fix attempts
- requirements conflict
- verifier cannot reproduce a reported failure
- tests require external credentials unavailable to Codex
- implementation requires touching forbidden files
- the diff grows beyond the work package scope
- security-sensitive code is affected without explicit approval
```

## Scope breach rule

If an agent discovers that the work requires files outside `allowed_files`, it must stop and report:

```yaml
scope_breach:
  task_id: WP-0000
  needed_file: ""
  reason: ""
  risk_of_not_touching: ""
  recommended_next_action: "expand scope | split task | ask human"
```

## Merge gate

A task is not accepted until:

```text
- work package exists
- implementation report exists
- verifier report exists
- acceptance criteria are satisfied or documented as partial
- project memory is updated
- unresolved risks are recorded
```
