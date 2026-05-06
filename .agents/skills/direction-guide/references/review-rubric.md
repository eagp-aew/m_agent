# Review Rubric

## Correctness

- Does the change satisfy every acceptance criterion?
- Are edge cases handled?
- Does existing behavior remain compatible?

## Scope

- Were only allowed files changed?
- Did the implementation avoid unrelated cleanup?
- Is the diff small enough to review?

## Tests

- Were relevant tests added or updated?
- Were commands run?
- Are failures documented?

## Security

- Did the change touch auth, permissions, secrets, payments, user data, or production config?
- Is there input validation where needed?

## Maintainability

- Is the implementation understandable?
- Are names and boundaries clear?
- Is there unnecessary abstraction?

## Integration

- Does project memory match the new state?
- Are risks recorded?
- Is commit/PR summary factual?
