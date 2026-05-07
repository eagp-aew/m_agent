# Agent Reports

Store structured subagent reports and master-direct fallback verification records here.

Naming convention:

```text
WP-0001-explorer.md
WP-0001-implementer.md
WP-0001-verifier.md
WP-0001-fallback-verification.md
WP-0001-fixer.md
```

Do not paste huge logs into reports. Summarize and link to log files if needed.

Every queue item with status `ACCEPTED`, `VERIFIED`, or `DONE` must link `verifier_report_path` to a durable report file. A fallback verification report is valid when no verifier subagent ran, but it must include the same verification-gate evidence fields:

- `acceptance_criteria_mapping`
- `files_inspected`
- `validation_or_reason_not_run`
- `regression_risks`
- `scope_violation_check`
- `forbidden_files_check`
- `recommendation`
- `acceptance_criteria_checked`
- `tests_or_reason_present`
- `forbidden_files_checked`
- `risks_recorded`
