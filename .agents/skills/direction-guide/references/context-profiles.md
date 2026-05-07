# Context Profiles

Use context profiles to keep packets proportional to task risk. The profile controls how much durable memory and protocol context the master includes before delegation or master-direct work. It does not relax source-of-truth, trust-boundary, allowed-file, forbidden-file, verification, or reporting requirements.

## Profile Selection

### small

Use `small` for narrow edits or read-only checks that do not change protocol behavior, user-facing behavior, validation scripts, security-sensitive guidance, concurrency, recursion, or durable memory status.

Required context:

- `AGENTS.md`
- active work package or direct user request
- files being edited or inspected
- relevant validation command from `.ai/TEST_MATRIX.md`

Do not include broad `.ai/` history unless the task depends on accepted memory.

### protocol

Use `protocol` for changes to direction-guide instructions, context packets, report shape, validation policy, work-package templates, role routing, tool policy, verification gates, fallback verification, failure handling, execution budgets, or historical supersession metadata.

Required context:

- `AGENTS.md`
- active work package
- `.ai/PROJECT_STATE.md`
- `.ai/TASK_QUEUE.yaml`
- `.ai/TEST_MATRIX.md`
- `.agents/skills/direction-guide/SKILL.md`
- directly affected references under `.agents/skills/direction-guide/references/`
- relevant accepted decisions or historical work packages when the task touches supersession or current-policy references

Use this profile by default for protocol scaffold work.

### full

Use `full` only when the master is planning a milestone, integrating multiple shards, resolving state drift, performing final memory closure, or auditing cross-file consistency across queue, ledger, work packages, reports, decisions, risks, project state, and integration history.

Required context:

- all `protocol` profile context
- `.ai/MASTER_CONTRACT.md`
- `.ai/MASTER_LEDGER.yaml`
- `.ai/DECISIONS.md`
- `.ai/RISK_REGISTER.md`
- `.ai/INTEGRATION_LOG.md`
- relevant `.ai/AGENT_REPORTS/`
- relevant `.ai/WORK_PACKAGES/`

The master should summarize full-profile findings into durable artifacts instead of carrying raw history in chat.

## Packet Field

Work packages and context packets may record:

```yaml
context_profile: small | protocol | full
context_profile_reason: ""
```

When omitted, choose the smallest profile that satisfies the work package and validation plan. If the task touches protocol, validation, tool policy, fallback verification, concurrency, recursion, or durable memory status, choose at least `protocol`.
