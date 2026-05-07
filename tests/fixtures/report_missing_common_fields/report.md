# Verification Report: Incomplete Common Report Fixture

## task_id

`WP-TEST-incomplete-common-report`

## agent_role

`verifier`

## status

`PASS`

## one_sentence_result

This fixture has verifier evidence markers but omits part of the common report schema.

## files_read

- `tests/test_validate_protocol.py` - stable replayable path for fixture validation.

## files_changed

None

## tests_run

- `python3 -m unittest tests/test_validate_protocol.py` - `PASS` - fixture command shape only.

## evidence

- acceptance_criteria_mapping: PASS - all required marker words are present.
- files_inspected: `tests/test_validate_protocol.py`
- validation_or_reason_not_run: PASS - fixture command shape only.
- regression_risks: None; fixture only.
- scope_violation_check: PASS - fixture only.
- forbidden_files_check: PASS - fixture only.
- recommendation: `PASS`
- acceptance_criteria_checked: `true`
- tests_or_reason_present: `true`
- forbidden_files_checked: `true`
- risks_recorded: `true`

## risks

None; this is a negative fixture.

## assumptions

None

## recommended_next_action

Reject this report because it omits required common report sections.
