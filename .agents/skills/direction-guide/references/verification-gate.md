# Verification Gate

The verification gate is a hard acceptance gate for every work package. The master may not mark a work package `ACCEPTED` unless one of these is true:

1. Verifier returns `PASS` with evidence.
2. Master-direct fallback verification records `PASS` with the same required evidence shape.
3. Verifier or fallback verification returns `PARTIAL` and the master records accepted limitations.
4. Human explicitly overrides verifier or fallback verification failure.

Verifier reports and runtime fallback verification must provide evidence that includes:

- acceptance criteria mapping
- files inspected
- commands/tests run or reason not run
- regression risks
- scope violation check
- forbidden files check
- recommendation: `PASS`, `PARTIAL`, or `FAIL`

The evidence must be durable for every work package that reaches `ACCEPTED`, `VERIFIED`, or `DONE`. Record the verifier report or master-direct fallback verification record under `.ai/AGENT_REPORTS/`, then link that file from `verifier_report_path` in `.ai/TASK_QUEUE.yaml`. Fallback verification is allowed when no verifier subagent ran, but it must use the same evidence fields and score schema as a verifier report.

## Verifier Score Schema

Every verifier report or fallback verification record must include this score schema:

- `acceptance_criteria_checked`
- `tests_or_reason_present`
- `forbidden_files_checked`
- `risks_recorded`
- `recommendation`

Each score field should be explicit enough for the master to determine whether the report supports `PASS`, `PARTIAL`, or `FAIL`. Missing evidence means the master must reject the verifier result or classify the work package as blocked until evidence is supplied.
