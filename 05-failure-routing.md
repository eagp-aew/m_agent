# 05 — Failure Routing

## Failure taxonomy

- SPEC_AMBIGUITY
- IMPLEMENTATION_BUG
- TEST_EXPECTATION_BUG
- INTEGRATION_CONFLICT
- ENVIRONMENT_FAILURE
- DEPENDENCY_OR_VERSION_MISMATCH
- SECURITY_REGRESSION
- PERFORMANCE_REGRESSION
- FLAKY_TEST
- SCOPE_VIOLATION

## Routing

| Failure | Route |
|---|---|
| SPEC_AMBIGUITY | Human/master decision |
| IMPLEMENTATION_BUG | Original implementer once, then fresh fixer |
| TEST_EXPECTATION_BUG | Verifier + master |
| INTEGRATION_CONFLICT | Integrator |
| ENVIRONMENT_FAILURE | Environment/debug task |
| DEPENDENCY_OR_VERSION_MISMATCH | Human approval if dependency changes |
| SECURITY_REGRESSION | Security reviewer |
| PERFORMANCE_REGRESSION | Performance reviewer/fixer |
| FLAKY_TEST | Verifier reproduces first |
| SCOPE_VIOLATION | Master rejects/trims/escalates |

## Stop rules

Stop when:

- same error repeats;
- two fix attempts fail;
- requirement conflicts appear;
- sensitive files require approval;
- scope becomes much larger than planned.
