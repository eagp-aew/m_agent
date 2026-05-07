# Failure Taxonomy

When a verifier, fallback verifier, fixer, or integrator returns `FAIL`, `BLOCKED`, or a defect-driven `PARTIAL`, include a structured error object in the report when a concrete failure exists:

```yaml
error:
  error_id: ERR-<task-id>-001
  error_category: SPEC_AMBIGUITY | IMPLEMENTATION_BUG | TEST_EXPECTATION_BUG | INTEGRATION_CONFLICT | ENVIRONMENT_FAILURE | DEPENDENCY_OR_VERSION_MISMATCH | SECURITY_REGRESSION | PERFORMANCE_REGRESSION | FLAKY_TEST | SCOPE_VIOLATION
  error_code: ""
  retryable: true | false
  side_effect_risk: none | low | medium | high
  idempotency_key: null
  evidence:
    - ""
  recommended_action: ""
```

Use stable `error_code` values and evidence references so repeated failure signatures can match the same problem without relying on noisy logs or shifting line numbers.

## SPEC_AMBIGUITY

The desired behavior is unclear.

Route: human/master decision.

## IMPLEMENTATION_BUG

The work package is clear, but the implementation violates it.

Route: original implementer once, then fresh fixer.

## TEST_EXPECTATION_BUG

The test appears inconsistent with the accepted requirement.

Route: verifier + master review.

## INTEGRATION_CONFLICT

The implementation conflicts with another change, branch, dependency, or interface.

Route: integrator.

## ENVIRONMENT_FAILURE

Validation failed because of setup, tooling, missing dependency installation, path issue, or environment mismatch.

Route: environment/debug task. Do not patch application code first.

## DEPENDENCY_OR_VERSION_MISMATCH

The task needs a package/version change or behaves differently across versions.

Route: human approval if dependency change is required.

## SECURITY_REGRESSION

The change creates or may create an auth, permission, data exposure, secret, or production-safety issue.

Route: security reviewer.

## PERFORMANCE_REGRESSION

The implementation likely worsens latency, memory, query count, bundle size, or runtime cost.

Route: verifier confirms the regression with evidence, then route to a bounded fixer if the failure is concrete. Escalate to the human/master decision path when the performance expectation or acceptable tradeoff is unclear.

## FLAKY_TEST

The failure is not reliably reproducible.

Route: verifier reproduces before code fix.

## SCOPE_VIOLATION

The agent edited forbidden files or expanded beyond the work package.

Route: master rejects, trims, or asks human.

Includes implementers self-authorizing child agents, child agents attempting grandchildren, child implementers touching files outside the approved parent reservation, or any recursive delegation that exceeds the approved depth-2 packet.
