# Verification Report: Missing Paths Fixture

## task_id

`WP-TEST-missing-paths`

## agent_role

`verifier`

## status

`FAIL`

## one_sentence_result

This fake report is valid enough to reach path validation and then fail.

## files_read

- `tests/fixtures/report_missing_paths/does-not-exist.md` - intentionally missing.

## files_changed

None

## commands_run

- `python3 scripts/protocol_gate.py check-report tests/fixtures/report_missing_paths/report.md` - `class: read_only` - fake fixture - `approval: not_required` - FAIL.

## tests_run

None

## evidence

- acceptance_criteria_mapping: FAIL - fake fixture references an unreplayable path.
- files_inspected: `tests/fixtures/report_missing_paths/does-not-exist.md`
- validation_or_reason_not_run: Not run for fixture.
- regression_risks: None; fixture only.
- scope_violation_check: PASS - fixture only.
- forbidden_files_check: PASS - fixture only.
- recommendation: `FAIL`
- acceptance_criteria_checked: `true`
- tests_or_reason_present: `true`
- forbidden_files_checked: `true`
- risks_recorded: `true`

## risks

None; this is a negative fixture.

## assumptions

None

## recommended_next_action

Keep this fixture failing.

## child_agent_requests

None

## child_report_bundle

None
