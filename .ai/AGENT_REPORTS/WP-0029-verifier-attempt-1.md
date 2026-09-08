# WP-0029 Independent Verifier Attempt 1

- report_type: `VERIFIER_REPORT`
- task_id: `WP-0029-transactional-model-switch`
- agent_role: `verifier`
- status: `FAIL`
- recommendation: `FAIL`
- one_sentence_result: Core adapter tests pass, but the write barrier does not cover already-started multi-step application workflows, Archive pagination can accept an incomplete snapshot, and Settings overflows at 390px.
- recommended_next_action: Assign one bounded fixer over the five WP-0029 product files to add workflow-level mutation leases, fail closed on ambiguous Archive pagination, retain all required Block invariants, repair compact layout width, and add regression coverage before fresh independent verification.

## acceptance_criteria_mapping

1. `PASS` — `ensureAgent` rejects existing model, embedding, or sleeptime mismatches without mutation and retains validated initial creation.
2. `PASS` — Switch preparation requires the exact connected Agent ID, nonblank distinct target, current-model consistency, and locked embedding.
3. `FAIL` — `withPersistentMutation` leases individual SDK calls rather than complete App workflows. Private-message reconciliation, restore, forget, and import can be interrupted between calls. Repeated full-page Archive cursors also terminate silently, so snapshot completeness is unproven.
4. `PASS` — Forward mutation uses the existing Agent ID and `{ model: target, enable_sleeptime: false }`, omits embedding, and performs no create/delete.
5. `FAIL` — Postconditions cover identity, model, embedding, sleeptime, schema, and canonical data, but may compare truncated Archive prefixes; captured Blocks also omit the SDK `limit` field.
6. `PASS` — Any error after a forward attempt triggers same-ID compensation and verification; unverified rollback retains the write lock.
7. `FAIL` — Draft/active state and explicit controls exist, but the 390px Settings scroll container measured 464px content width and clipped the model-switch card/action.
8. `PARTIAL` — Nine switch tests and README cover core behavior and honest live/database boundaries, but omit the three reproduced defects.
9. `PASS` — The diff is limited to the five allowed product files and four master-owned WP memory paths; no forbidden, staged, deleted, dependency, or tracked generated file exists.

## files_read

- `AGENTS.md`
- `.ai/MASTER_CONTRACT.md`
- `.agents/skills/direction-guide/SKILL.md`
- `.agents/skills/direction-guide/references/context-packet-schema.md`
- `.agents/skills/direction-guide/references/verification-gate.md`
- `.agents/skills/direction-guide/references/agent-report-template.md`
- `.ai/WORK_PACKAGES/WP-0029-transactional-model-switch.yaml`
- `.ai/PROJECT_STATE.md`
- `.ai/TASK_QUEUE.yaml`
- `.ai/MASTER_LEDGER.yaml`
- `personal-co/App.tsx`
- `personal-co/src/domain/model-switch.mjs`
- `personal-co/src/services/letta.ts`
- `personal-co/tests/model-switch.test.mjs`
- `personal-co/README.md`
- Relevant permitted domain files, tests, configuration, package metadata, and installed Letta SDK declarations.

## files_inspected

- `personal-co/App.tsx` — UI state binding, persistent multi-step workflows, disabled controls, and compact layout.
- `personal-co/src/services/letta.ts` — every SDK mutation, barrier accounting, pagination, forward verification, and rollback.
- `personal-co/src/domain/model-switch.mjs` — preconditions and canonical invariants.
- `personal-co/tests/model-switch.test.mjs` — deterministic coverage and adverse-path gaps.
- `personal-co/README.md` — guarantees and unproven live/database boundaries.

## files_changed

None.

## commands_run

- Required `node --test`, `npm test`, TypeScript, protocol, diff, and Git scope commands — class: `read_only` — scope: WP-0029 repository evidence — approval: `not_required` — automated checks passed while adversarial source traces failed three acceptance areas.
- Browser runtime discovery — class: `read_only` — scope: `external:http://127.0.0.1:8087/` — approval: `not_required` — NOT_RUN because the verifier had no browser backend; master-recorded metrics and source were assessed.
- Web export — class: `workspace_write` — scope: `generated:personal-co/dist/**` — approval: `not_requested` — NOT_RUN by verifier; master PASS evidence reviewed.
- Live Letta/PostgreSQL operations — class: `network_or_escalated` — scope: external services — approval: `not_requested` — NOT_RUN by package design.

## tests_run

- `cd personal-co && node --test tests/model-switch.test.mjs` — `PASS`, 9/9.
- `cd personal-co && npm test` — `PASS`, 36/36.
- `cd personal-co && npm run typecheck` — `PASS`.
- `python3 -B scripts/validate_protocol.py` — `PASS`, 29/29.
- `python3 -B scripts/protocol_gate.py audit` — `PASS`.
- `git diff --check` and exact scope/staged/deletion checks — `PASS`.
- Adversarial workflow, pagination, invariant, and responsive review — `FAIL` with the three stable signatures below.

## validation_or_reason_not_run

- Master Web export passed; verifier did not regenerate forbidden output.
- Verifier browser smoke was unavailable, so it classified the master's observed `clientWidth=390` / `scrollWidth=464` result against source.
- Live Letta and PostgreSQL tests were intentionally not run and are not claimed.

## evidence

- `personal-co/App.tsx` begins private reconciliation only after the counted `sendMessage` adapter call releases its mutation lease; restore, forget, and import similarly span multiple individually leased calls.
- `personal-co/src/services/letta.ts` silently breaks when a full Archive page repeats its cursor, returning an accumulated prefix as complete.
- `personal-co/src/services/letta.ts` omits Block `limit` from its snapshot projection, and `personal-co/src/domain/model-switch.mjs` therefore cannot compare it.
- `.ai/MASTER_LEDGER.yaml` records the master browser observation that the 390px scroll container had 464px content width; `personal-co/App.tsx` retains a 430px card basis without compact override.

## regression_risks

- Private-message memory may remain unreconciled when a model switch races the message workflow.
- Restore, forget, or import can be interrupted between writes.
- Unseen Archive pages or Block-limit drift can escape invariant checks.
- Mobile users can receive a clipped model-switch surface.

## scope_violation_check

`PASS` — All implementation and master-memory paths are WP-0029-allowed.

## forbidden_files_check

`PASS` — No forbidden, staged, deleted, dependency, configuration, secret, database, or tracked generated-output change exists.

## verifier_score

- acceptance_criteria_checked: true
- acceptance_score: 9/9
- tests_or_reason_present: true
- forbidden_files_checked: true
- risks_recorded: true
- recommendation: FAIL

## failure_classification

- classification: `IMPLEMENTATION_BUG`
- signature: `IMPLEMENTATION_BUG:model-switch-barrier-does-not-cover-multistep-workflow`
- signature: `IMPLEMENTATION_BUG:archive-pagination-repeat-accepted-as-complete`
- signature: `IMPLEMENTATION_BUG:settings-390px-horizontal-overflow`

## reproduction_steps

1. Begin a private message, request a model switch before the message returns, then allow it to finish; the switch resumes before the caller starts reconciliation and the new reconciliation call is rejected.
2. Return the same full 100-item passage page and last ID for successive `after` requests; snapshot pagination silently stops instead of rejecting incomplete evidence.
3. Render Settings at 390×844; the primary scroll container reports 390px client width and 464px scroll width, clipping the Agent card/action.

## risks

- Live Letta semantics and PostgreSQL snapshot/recovery remain unverified.
- The barrier remains application-instance-only; external clients remain outside this package.

## assumptions

- An application persistent workflow must be atomic relative to switching, not merely each SDK call.
- A snapshot must fail closed if pagination cannot prove exhaustion.

## child_agent_requests

None.

## child_report_bundle

None.
