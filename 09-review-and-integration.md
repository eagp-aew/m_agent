# 09 — Review and Integration

## Review sequence

1. Verifier returns PASS/PARTIAL/FAIL.
2. Human reviews diff.
3. Codex addresses specific review comments only.
4. Integrator updates memory.
5. Commit/PR.

## Commit summary format

```text
<area>: <short factual change>

- Implemented WP-____
- Tests: <commands/results>
- Risks: <remaining risk or none>
```

## PR summary format

```markdown
## Summary

## Work package

## Validation

## Risks

## Reviewer notes
```
