# Subagent Report

## task_id

`<task_id>`

## agent_role

`explorer | implementer | verifier | fixer | integrator | security-reviewer`

## status

`PASS | PARTIAL | BLOCKED | FAIL`

## one_sentence_result

`<one sentence summary of the result>`

## files_read

- `<path>` - `<why it was read>`

Use `None` if no files were read.

## files_changed

- `<path>` - `<summary of change>`

Use `None` if no files were changed.

## commands_run

- `<command>` - `<result>`

Use `None` if no commands were run.

## tests_run

- `<test or validation command>` - `<PASS | FAIL | NOT_RUN>` - `<evidence or reason>`

Use `None` if no tests were run.

## evidence

- `<specific evidence supporting the status>`

## risks

- `<remaining risk or None>`

## assumptions

- `<assumption or None>`

## recommended_next_action

`<next action for the master>`

## child_agent_requests

Use `None` unless the reporting agent is an implementer whose context packet permits master-approved child-agent requests.

Each requested child agent must include:

- `request_id`
- `trigger`: `missing_context | independent_subshard | pre_return_verification | security_signal | validation_bottleneck`
- `requested_role`: `explorer | verifier | security-reviewer | implementer`
- `objective`
- `why_needed`
- `proposed_context_packet`
- `proposed_allowed_files`
- `proposed_reserved_files`
- `validation_commands`
- `risk_class`
- `approval_gates`
- `fallback_if_denied`
- `expected_report_use`

## child_report_bundle

Use `None` unless the reporting implementer received approved child-agent reports.

When present, include each approved child `request_id`, child `agent_run_id`, child role, status, files read, files changed, validation evidence, scope check, and how the parent used the report.

## Optional Role-Specific Sections

Role-specific sections may be appended after the required common report fields. They must not replace or rename the common fields above.

Suggested optional sections:

## explorer_recommendations

Useful for explorer when recommending allowed files, forbidden files, validation commands, or follow-up context.

## root_cause

Required for fixer when diagnosing a verifier failure.

## security_findings

Required for security-reviewer when security issues are found or explicitly absent.

## acceptance_criteria_check

Useful for verifier and integrator.

## integration_notes

Useful for integrator.

## failure_classification

Useful for verifier and fixer when reporting failure evidence.

## recursive_delegation_notes

Useful for implementers and integrators when child-agent requests or reports were involved.
