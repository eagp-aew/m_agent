# Failure Taxonomy

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
