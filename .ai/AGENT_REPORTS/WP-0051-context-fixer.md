# WP0051 C1 cleanup uncertainty repair

## task_id
WP-0051-local-chat-integration

## agent_role
fixer — wp0051-context-fix-1

## status
PASS — scoped fixer checks only; independent verification pending, full WP unaccepted.

## one_sentence_result
A one-line acquisition guard preserves canonical read-handle cleanup uncertainty so the actual managed owner reports unconfirmed cleanup and retains its lease without starting native execution.

## files_read
- Current C1/cleanup repair scope in `.ai/WORK_PACKAGES/WP-0051-local-chat-integration.yaml` and `.ai/AGENT_REPORTS/WP-0051-context-verifier.md`.
- `personal-co/server/assistant-bootstrap.mjs`, `personal-co/tests/assistant-bootstrap.test.mjs`, relevant acquisition/cleanup/lease sections of `personal-co/server/managed-read-session.mjs`.
- Prior unchanged AGENTS/master/direction-guide and required protocol readings reused. The initial packet omitted max_context_notes; no task actions occurred until master supplied 5.

## files_changed
- `personal-co/server/assistant-bootstrap.mjs`
- `personal-co/tests/assistant-bootstrap.test.mjs`
- `.ai/AGENT_REPORTS/WP-0051-context-fixer.md`

## commands_run
- read_only: scoped rg/sed/wc and SHA256 inspections; PASS. Initial combined output was partially truncated; required verifier/test sections were reread in bounded ranges.
- workspace_write, exact reserved files and standing authorization: apply_patch added composed regression and ordinary read-I/O control before applying the one-line source fix, then created this report; PASS.
- controlled validation: `WP0045_RUN_NATIVE=0 WP0047_RUN_NATIVE=0 WP0048_RUN_NATIVE=0 node --test --test-name-pattern='managed acquisition canonical' personal-co/tests/assistant-bootstrap.test.mjs`; expected regression-first FAIL, 1 PASS / 1 FAIL.
- controlled validation: `WP0045_RUN_NATIVE=0 WP0047_RUN_NATIVE=0 WP0048_RUN_NATIVE=0 node --test personal-co/tests/assistant-bootstrap.test.mjs personal-co/tests/managed-read-session.test.mjs`; final 38 PASS / 2 deliberately skipped native tests, zero failures.
- read_only validation: `node --check personal-co/server/assistant-bootstrap.mjs`, `git diff --check`, SHA256 of both changed product paths; PASS.
- Fresh controlled fixtures retained; diagnostic handles explicitly closed in finally. No data deletion, Git mutation, native/provider/browser execution, external network call, dependency installation or child agents.

## tests_run
- Before fix, canonical-close fault reproduced acquisitionCode IO, handleOpen true, terminal phase closed, cleanup.confirmed true, errors empty. The failing assertion was true versus expected false for cleanup confirmation. Fresh fixture external:/private/tmp/personal-co-wp0048-unit-R0jNvG.
- After fix, the same composed test observes CLEANUP_FAILED, handleOpen true before diagnostic cleanup, terminal phase failed, cleanup.confirmed false, LATE_CLEANUP_FAILED and STATE_IN_USE on a second managed owner. Native start count stays zero. Fresh fixture external:/private/tmp/personal-co-wp0048-unit-zJ9S7A.
- Ordinary canonical-read I/O fault closes the underlying handle, retains IO error classification, reports confirmed cleanup with no errors, and permits reacquiring managed ownership. Fresh control fixture external:/private/tmp/personal-co-wp0048-unit-CyPTGQ.
- All existing bootstrap and managed-session tests pass; native opt-ins remain disabled. Other C1 tests are outside this minimal repair validation scope, not represented as freshly rerun.

## evidence
The canonical read helper already sets cleanupProblem and throws CLEANUP_FAILED when handle.close rejects. The acquisition catch released its other resources and remapped that error to IO. The unchanged managed owner only marks acquisition cleanup uncertain when it receives CLEANUP_FAILED. Checking the existing cleanupProblem flag after release preserves uncertainty without skipping release or altering normal I/O behavior.

## risks
Independent verification is still required. This preserves honest uncertainty rather than recovering an unclosed handle or releasing an uncertain managed lease. Same-UID controlled directories and trusted fault seams remain assumptions. No full-WP, UI, native-provider, model-quality or production-deployment claim.

## assumptions
Packet scope is complete after the supplied max_context_notes correction. Existing twelve-file C1 implementation remains intact; only the verified acquisition remapping defect and regression seam were changed. Direction-guide scoped repair discipline and independent review remain in force despite standing authorization.

## recommended_next_action
Independently reverify the two frozen product hashes and the original acquisition-close failure, then let the master decide C1 acceptance and evidence integration.

## child_agent_requests
[]

## child_report_bundle
[]

## root_cause
IMPLEMENTATION_BUG:bootstrap-acquisition-masks-uncertain-read-handle-cleanup — acquisition's sanitized error mapping discarded the existing cleanup uncertainty flag after release succeeded.

## patch_summary
Add `check(!cleanupProblem, 'CLEANUP_FAILED')` immediately after acquisition release and before ordinary error mapping. Add two real managed/bootstrap composed fault cases in the bootstrap test file. No managed source/test or other C1 product changes.

## verifier_evidence_addressed
Yes: regression-first evidence matches the verified false-clean result; repaired composed execution reports unconfirmed cleanup, retains ownership and does not start native work. Independent confirmation remains pending.

## Frozen SHA256

| Product path | Before | After |
|---|---|---|
| `personal-co/server/assistant-bootstrap.mjs` | 2eb93ca8b32c403640fe4a602cf6fc10e26cecc29cb080f390bc447c40fed261 | 08fe956577830ad5d433f53c59bb925cbcbaf07c7ebb92aa436ddb343cf5e913 |
| `personal-co/tests/assistant-bootstrap.test.mjs` | 8da239a9cb66eb567bc3828a5a7e56a9f813d84ec853cc614522a337c891649a | 8e6cc6a708033156cc3deac2bbb7b702e7967529cae030f81bed0bbad71a0fcd |
