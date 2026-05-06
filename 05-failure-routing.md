# 05 — Failure Routing

## Do not fix before classification

Your original idea was to hand correction work to another subagent whenever there is an error. Improve that rule:

```text
Verification failure
  → classify failure
  → choose route
  → send minimal fix package
  → verify again
```

## Failure taxonomy

| Code | Meaning | Route |
|---|---|---|
| SPEC_AMBIGUITY | Acceptance criteria conflict or are incomplete | Master/human decision |
| IMPLEMENTATION_BUG | Code does not meet clear spec | Original implementer once, then fixer |
| TEST_EXPECTATION_BUG | Test is wrong or outdated | Verifier + master decision |
| INTEGRATION_CONFLICT | Patch conflicts with nearby work | Integrator |
| ENVIRONMENT_FAILURE | Local setup, tool, permission, or dependency issue | Environment/setup task |
| DEPENDENCY_OR_VERSION_MISMATCH | Library/API version mismatch | Explorer/researcher, then master |
| SECURITY_REGRESSION | New abuse path or sensitive regression | Security reviewer |
| PERFORMANCE_REGRESSION | Slower/higher memory behavior | Performance investigation |
| FLAKY_TEST | Non-deterministic failure | Verifier reproduces before fix |
| UNKNOWN_ROOT_CAUSE | Failure exists but cause unclear | Explorer/debugger, no edits first |

## Retry policy

```yaml
retry_policy:
  max_original_implementer_fix_attempts: 1
  max_fresh_fixer_attempts: 2
  max_total_fix_attempts: 3
  stop_if_same_error_repeats: true
  stop_if_requirements_conflict: true
  stop_if_security_sensitive_without_approval: true
```

## Routing rules

### Use the original implementer when

```text
- the failure is a simple miss in their patch
- they likely have local implementation context
- no repeated failure has occurred
```

### Use a fresh fixer when

```text
- the original implementer failed once
- the implementation seems biased toward the wrong approach
- the failure report is precise and reproducible
```

### Use an explorer/debugger when

```text
- root cause is unclear
- stack trace points across multiple modules
- failure might be environmental
- changing code would be premature
```

### Escalate to human when

```text
- spec conflict exists
- sensitive behavior changes
- two fix attempts fail
- error requires product judgment
- fixing would require broad refactor
```

## Failure package template

```yaml
task_id: WP-0000
failure_id: FAIL-0000
failure_type: IMPLEMENTATION_BUG
reported_by: verifier
summary: ""
reproduction_steps:
  - ""
failing_command: ""
expected_behavior: ""
actual_behavior: ""
allowed_files:
  - ""
forbidden_files:
  - ""
max_attempts_remaining: 1
required_output:
  - root_cause
  - files_changed
  - validation_result
  - remaining_risks
```
