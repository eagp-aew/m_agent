# 09 — Review and Integration

## Why integration needs its own discipline

Implementation success is not project success. A task is only done when the final diff, tests, reports, and project memory agree.

## Review gate

Before accepting a work package, check:

```text
- Does the diff match the work package?
- Did the agent touch forbidden files?
- Are tests added or updated when behavior changed?
- Did verifier produce evidence?
- Were failures classified before fixes?
- Are risks recorded instead of hidden?
- Is project memory updated?
```

## Suggested review flow in Codex app

```text
1. Use /review after implementation.
2. Inspect changed files.
3. Leave inline comments for suspicious changes.
4. Ask Codex to address only those comments.
5. Run verifier again if code changed.
6. Stage only accepted hunks.
7. Commit with a factual message.
8. Push or open PR.
9. Update .ai/INTEGRATION_LOG.md.
```

## PR summary template

```markdown
## Summary

- 

## Work package

- WP-____

## Verification

- [ ] Tests run:
- [ ] Verifier report:
- [ ] Manual review:

## Risk

- 

## Follow-up

- 
```

## Commit message pattern

```text
<type>: <scoped result>

Implements WP-____.

Verification:
- <command/result>

Risk:
- <known risk or none>
```

Example:

```text
test: add coverage for refresh token expiry

Implements WP-0012.

Verification:
- npm test -- tests/auth/refresh-token.test.ts passed

Risk:
- none known
```

## Integration anti-patterns

```text
- accepting a diff because the agent sounds confident
- modifying tests without explaining behavioral intent
- merging after fixer changes without rerunning verifier
- letting documentation drift from implementation
- skipping project memory updates
- using one giant PR for unrelated work packages
```
