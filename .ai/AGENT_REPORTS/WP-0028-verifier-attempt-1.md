# WP-0028 Independent Verifier Attempt 1

- report_type: `VERIFIER_REPORT`
- task_id: `WP-0028-model-handle-preflight`
- agent_role: `verifier`
- status: `FAIL`
- recommendation: `FAIL`
- one_sentence_result: The method-local preflight is correct, but the real connection path calls `testConnection()` first and that method performs `agents.list()` before inventory validation.
- recommended_next_action: Assign one bounded fixer to replace the pre-preflight Agent-list probe and add an adapter-level ordering/failure regression test, then run a fresh independent verification.

## acceptance_criteria_mapping

1. `FAIL` — `personal-co/src/services/letta.ts` preflights inside `ensureAgent`, but `personal-co/App.tsx` calls `testConnection()` first and the latter currently invokes `agents.list()`.
2. `PASS` — Generation-model matching uses trimmed configured input and exact, case-sensitive, nonblank inventory `handle` equality only.
3. `PASS` — Embedding matching uses the same exact rule; display/name/blank/missing cases reject.
4. `FAIL` — The actual connection path performs an Agent-list request before inventory validation, and no adapter-level regression catches it.
5. `PASS` — Duplicate tags, six blocks, same-ID update, creation policy, and disabled sleeptime remain intact; the full tests pass.
6. `FAIL` — Pure helper coverage cannot detect the `testConnection()` bypass.
7. `FAIL` — The README's global “before listing” statement is false for the current application path.
8. `PASS` — Product edits are limited to the four allowed files; no dependency, App/config, secret, production, deletion, or tracked generated-output change exists.

## files_read

- `AGENTS.md`
- `.ai/MASTER_CONTRACT.md`
- `.agents/skills/direction-guide/references/verification-gate.md`
- `.ai/WORK_PACKAGES/WP-0028-model-handle-preflight.yaml`
- `.ai/AGENT_REPORTS/WP-0027-v1-completion-audit.md`
- `personal-co/src/domain/agent.mjs`
- `personal-co/src/services/letta.ts`
- `personal-co/tests/agent.test.mjs`
- `personal-co/README.md`
- `personal-co/App.tsx`
- `personal-co/src/config.ts`
- `runtime:personal-co/node_modules/@letta-ai/letta-client/resources/models/models.d.ts`
- `runtime:personal-co/node_modules/@letta-ai/letta-client/resources/models/embeddings.d.ts`

## files_changed

None.

## commands_run

- `cd personal-co && node --test tests/agent.test.mjs` — class: `read_only` — scope: Personal Co tests — approval: `not_required` — PASS, 8/8.
- `cd personal-co && npm test` — class: `read_only` — scope: Personal Co tests — approval: `not_required` — PASS, 25/25.
- `cd personal-co && npm run typecheck` — class: `read_only` — scope: Personal Co typecheck — approval: `not_required` — PASS.
- `python3 -B scripts/validate_protocol.py` — class: `read_only` — scope: protocol — approval: `not_required` — PASS, 29/29.
- `python3 -B scripts/protocol_gate.py audit` — class: `read_only` — scope: protocol — approval: `not_required` — PASS.
- `git diff --check` and scoped Git inspections — class: `read_only` — scope: repository — approval: `not_required` — PASS with four allowed product files and master-owned memory only.
- Web export — class: `workspace_write` — scope: `generated:personal-co/dist/**` — approval: `not_requested` — NOT_RUN by the read-only verifier; it reviewed the master's successful export and confirmed no generated output is tracked.

## tests_run

- Targeted Agent tests — `PASS`, 8/8.
- Full Personal Co tests — `PASS`, 25/25.
- TypeScript typecheck — `PASS`.
- Protocol validator — `PASS`, 29/29.
- Protocol audit and diff check — `PASS`.
- Independent source-order trace — `FAIL` because `testConnection()` reaches `agents.list()` first.

## evidence

- `personal-co/App.tsx` calls `testConnection()` immediately before `ensureAgent()` in the connection path.
- `personal-co/src/services/letta.ts` implements `testConnection()` with `this.client.agents.list({ limit: 1 })`.
- The two inventory calls exist only inside the later `ensureAgent()` call.
- Exact handle matching and sanitized inventory failures otherwise satisfy their method-local contract.

## regression_risks

- Inventory failure currently happens only after an Agent-list request in the user-visible connection flow.
- Pure domain tests can pass if service orchestration bypasses or reorders preflight.
- Live Letta behavior remains unverified.

## scope_violation_check

`PASS` — Only `personal-co/src/domain/agent.mjs`, `personal-co/src/services/letta.ts`, `personal-co/tests/agent.test.mjs`, and `personal-co/README.md` changed for the implementation; `.ai/**` changes are master-owned.

## forbidden_files_check

`PASS` — No dependency, App/config, auth, secret, environment, production configuration, file deletion, or tracked generated-output change exists.

## verifier_score

- acceptance_criteria_checked: 8/8
- tests_or_reason_present: true
- forbidden_files_checked: true
- risks_recorded: true
- recommendation: FAIL

## failure_classification

- classification: `IMPLEMENTATION_BUG`
- signature: `IMPLEMENTATION_BUG:preflight-bypassed-by-testConnection-agent-list`

## reproduction_steps

1. Inspect `personal-co/App.tsx` and observe `testConnection()` before `ensureAgent()`.
2. Inspect `personal-co/src/services/letta.ts` and observe `testConnection()` calls `agents.list()`.
3. Make either inventory request reject; the earlier Agent-list request has already completed.

## risks

- No persistent mutation occurs before preflight, but the explicit Agent-list ordering and documentation contract are violated.

## assumptions

- `agents.list()` is in the work package's explicit Agent lifecycle boundary even though it is read-only.

## child_agent_requests

None.

## child_report_bundle

None.
