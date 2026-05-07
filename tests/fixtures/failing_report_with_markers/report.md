# Verification Report: Failing Report With Markers Fixture

## task_id

`WP-TEST-failing-report-with-markers`

## agent_role

`verifier`

## status

`FAIL`

## one_sentence_result

This fixture includes every marker word but semantically recommends rejection.

## files_read

- `tests/test_validate_protocol.py` - stable replayable path for fixture validation.

## files_changed

None

## commands_run

- `python3 -m unittest tests/test_validate_protocol.py` - `class: read_only` - fixture command shape - `approval: not_required` - FAIL.

## tests_run

- `python3 -m unittest tests/test_validate_protocol.py` - `FAIL` - fixture command shape only.

## evidence

- acceptance_criteria_mapping: FAIL - the report is intentionally failing despite including marker words.
- files_inspected: `tests/test_validate_protocol.py`
- validation_or_reason_not_run: FAIL - fixture command shape only.
- regression_risks: Present; fixture only.
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

Reject this report because its status and recommendation are failing.

## child_agent_requests

None

## child_report_bundle

None
