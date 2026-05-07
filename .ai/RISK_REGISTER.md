# Risk Register

| Risk ID | Severity | Area | Description | Mitigation | Status |
|---|---|---|---|---|---|
| R-0001 | medium | workflow | Agents may expand scope without strict work packages. | Enforce allowed_files, forbidden_files, and verifier gate. | open |
| R-0002 | medium | workflow | The system may become too complex before proving value. | Start with one small task and five MVP roles. | open |
| R-0003 | medium | workflow | The seven-module flow may add ceremony overhead for small master-only documentation tasks. | Use compact one-line module outputs for small master-only tasks while preserving module order and ownership. | open |
| R-0004 | medium | workflow | Boundaries between Scope, Routing, Verification, and Integration may blur during handoff. | Use explicit ownership and handoff cues before moving between those controllers. | open |
| R-0005 | medium | workflow | Delegation prompts may drift and omit required scope or validation details. | Require context packets, shared report fields, role-agent packet enforcement, and alignment checks in every delegation workflow. | open |
| R-0006 | medium | validation | Documentation-only changes may be under-verified because there is no runtime test suite. | Use scaffold checks, skill metadata review, placeholder scans, Markdown review, and YAML parsing when relevant. | open |
| R-0007 | medium | memory | Dirty `.ai/` memory state may make it unclear which changes belong to the active task. | Require Integration Controller summaries to separate pre-existing dirty state from current-task changes. | open |
| R-0008 | medium | validation | Text-based context packet and protocol consistency checks may miss semantic drift between protocol files and role-agent instructions. | Run `python3 scripts/validate_protocol.py` for repeatable scaffold consistency checks; expand it only when drift recurs. | open |
| R-0009 | medium | concurrency | Parallel implementer batches may conflict when file ownership, generated outputs, or integration order are misclassified as independent. | Require isolated worktrees, exact disjoint file reservations, dynamic effective caps, shard verification, combined integration review, and `parallel_write_conflicts = 0` before acceptance. | open |
| R-0010 | medium | recursion | Implementer child-agent requests may hide scope expansion, lose child evidence, or create uncontrolled recursive routing. | Limit recursion to depth 2, require master approval for every child request, require child report bundles, deny scope expansion, and track child scope and recursive delegation violations. | open |
| R-0011 | medium | tool safety | Tool-use policy and prompt-injection boundaries may still be bypassed if future agents ignore prose or reports contain stale/non-replayable evidence. | Keep `tool-policy.md` canonical; require `trust_boundary` fields; validate report referenced paths and lightweight secret patterns in `scripts/validate_protocol.py`; add negative fixtures next. | open |
| R-0012 | medium | validation | Protocol closure can become ceremonial if gates, schemas, or tests are not kept aligned with future changes. | Use `scripts/protocol_gate.py`, `tests/test_validate_protocol.py`, schema/context checks, and review coverage reports before accepting future protocol work. | open |

## Risk severity

- low: nuisance or small delay
- medium: broken feature, wasted work, or confusing state
- high: security, data loss, production outage, irreversible migration, major regression
