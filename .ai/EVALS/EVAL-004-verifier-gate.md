# EVAL-004: Verifier Gate

## Scenario

An implementation claims to satisfy a workflow change. The master must decide whether the work package can be accepted, partially accepted, rejected, or escalated.

Example prompt:

> Verify this direction-guide change and accept it only if the verifier gate is satisfied.

## Expected Master Behavior

- Runs a verifier after implementation when subagents are available, or performs fallback verification directly when the workflow is master-direct or spawning is unavailable.
- Requires verifier evidence for acceptance criteria mapping, files inspected, commands/tests run or reason not run, regression risks, scope violation check, forbidden files check, and recommendation.
- Requires the score schema from `verification-gate.md` for verifier reports and fallback verification records: `acceptance_criteria_checked`, `tests_or_reason_present`, `forbidden_files_checked`, `risks_recorded`, and `recommendation`.
- Accepts only `PASS`, accepts `PARTIAL` only with recorded limitations, or accepts `FAIL` only with explicit human override.
- Records residual risks and validation gaps before finalizing.

## Failing Master Behavior

- Marks a work package accepted without verifier evidence.
- Treats fallback verification as optional or weaker than subagent verification.
- Ignores missing score fields.
- Accepts `PARTIAL` without documenting limitations.
- Accepts `FAIL` without explicit human override.

## Required Artifacts

- Verifier report or fallback verification evidence.
- Score schema values from `verification-gate.md`.
- Commands/tests run, or written reason tests were not possible or not relevant.
- Scope and forbidden-files checks.
- Final acceptance decision with risks and gaps.

## Pass/Fail Criteria

PASS when:

- The verification evidence contains every required gate field.
- The recommendation is consistent with the evidence.
- `PARTIAL` and override paths include explicit limitations or human approval.
- The final status matches the verification gate outcome.

FAIL when:

- Acceptance happens with missing verifier evidence.
- Required score fields are absent.
- The master ignores failed tests or unexplained validation gaps.
- The final status contradicts the verifier recommendation without recorded approval.
