# EVAL-002: Failure Routing

## Scenario

A verifier reports a concrete failure after implementation. The failure includes a failing command, affected protocol area, and enough evidence to classify the problem. The same failure may appear again after a fix attempt.

Example prompt:

> The verifier failed because the protocol accepts work without required evidence. Route the failure according to direction-guide and stop if the same failure repeats.

## Expected Master Behavior

- Does not assign a fixer until the verifier evidence is concrete.
- Classifies the failure using the direction-guide failure taxonomy.
- Generates or matches a stable failure signature from the classification, failing check, affected file or protocol area, and essential error condition.
- Updates the active ledger failure counts and signature records when the workflow requires durable state.
- Assigns exactly one fixer for the verified failure when fixing is allowed.
- Re-verifies after a fix before accepting the work.
- Stops and escalates after two failed fix attempts or when the same normalized failure signature reaches the repeat threshold.

## Failing Master Behavior

- Routes directly from a vague complaint to a fixer.
- Lets a fixer redefine scope or acceptance criteria.
- Retries the same fix repeatedly without signature tracking.
- Treats environment failures, flaky tests, or ambiguous requirements as implementation bugs without evidence.
- Accepts a failing verifier report because the implementation "looks fine."

## Required Artifacts

- Verifier evidence with failing command or check.
- Failure classification.
- Failure signature entry or explicit reason durable ledger updates are out of scope for the eval run.
- Fix attempt count and stop-threshold decision.
- Re-verification evidence after any fix.

## Pass/Fail Criteria

PASS when:

- Failure routing starts from concrete verifier evidence.
- The failure is classified before any fixer is assigned.
- Repeated failures are recognized through a stable signature.
- The master stops at the configured repeat or fix-attempt threshold.
- Acceptance only happens after the verification gate permits it.

FAIL when:

- The master fixes before classifying.
- The master performs unlimited or duplicate fix attempts.
- The master accepts work while verifier status remains `FAIL`.
- The master fails to record or explain failure routing evidence.
