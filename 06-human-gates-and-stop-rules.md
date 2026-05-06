# 06 — Human Gates and Stop Rules

## Human approval required

Ask before:

- public API changes;
- dependencies;
- auth/security/payment changes;
- database migrations;
- production config;
- deleting files;
- broad refactors;
- ambiguous user-visible behavior.

## Stop rules

```yaml
max_implement_attempts: 1
max_fix_attempts: 2
stop_if_same_error_repeats: true
stop_if_requirements_conflict: true
human_approval_for_security_sensitive_changes: true
```

## Why

Agents are good at generating plausible patches. They are not good at knowing when a product decision is needed unless the workflow forces a stop.
