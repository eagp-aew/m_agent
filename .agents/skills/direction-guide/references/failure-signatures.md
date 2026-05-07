# Failure Signatures

Failure signatures let the master detect repeated verifier failures instead of treating the same failure as a new issue.

## Definition

A failure signature is a concise, stable identifier for one verifier-reported failure, scoped to a single work package.

The signature should represent the failure's durable shape:

- failure classification
- failing check, command, or verifier criterion
- affected file, protocol area, or subsystem
- essential error condition

Do not include volatile details such as timestamps, temporary paths, run ids, random ports, full raw logs, or changing line numbers unless the line itself is the failing condition.

## How to generate a signature

After verifier `FAIL`, normalize the failure before assigning any fixer:

1. Classify the failure using the direction-guide failure classes.
2. Identify the smallest stable failing check or criterion.
3. Identify the affected file, protocol area, or subsystem.
4. Summarize the essential error condition in lowercase kebab-case.
5. Join the classification and normalized condition with a colon.

Preferred format:

```text
CLASSIFICATION:area-or-check-essential-condition
```

Example:

```text
IMPLEMENTATION_BUG:direction-guide-missing-failure-signature-record-before-fixer
```

## Where to record signatures

Record failure signatures in `.ai/MASTER_LEDGER.yaml` under `failure_signatures`.

The ledger section should include:

- `repeat_stop_threshold`: set to `2`
- `entries`: list of observed signatures

Each entry should include:

- `work_package_id`
- `classification`
- `signature`
- `seen_count`
- `first_seen_at`
- `last_seen_at`
- `evidence`

Example:

```yaml
failure_signatures:
  repeat_stop_threshold: 2
  entries:
    - work_package_id: WP-0010-failure-signatures
      classification: IMPLEMENTATION_BUG
      signature: IMPLEMENTATION_BUG:direction-guide-missing-failure-signature-record-before-fixer
      seen_count: 1
      first_seen_at: 2026-05-06
      last_seen_at: 2026-05-06
      evidence: "Verifier reported SKILL.md assigns fixer before recording failure signature."
```

## When to increment `seen_count`

Increment `seen_count` when the same normalized signature appears again for the same work package.

This applies even when:

- the failure follows a different fix attempt
- the verifier reports different raw log details
- the line number changes but the underlying failure condition is the same
- the same failure is found by a different command or verifier pass

Do not increment `seen_count` for a similar failure in a different work package. Create or update a separate entry scoped to that work package.

## When to stop and escalate

If the same failure signature appears twice for the same work package, stop patching and escalate.

When `seen_count` reaches `repeat_stop_threshold`:

- set `current_state_machine_state` to `ESCALATED`
- stop assigning fixers for that work package
- stop making additional patches for that failure
- record the blocking condition in the ledger
- ask for human direction

The repeated-signature stop rule is independent of `max_fix_attempts`. Either stop condition is sufficient to halt patching and escalate.
