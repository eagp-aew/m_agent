# WP-0025 Verifier Report — Attempt 1

- task_id: `WP-0025-personal-co-foundation`
- agent_role: `verifier`
- status: `FAIL`
- verifier_report: `VERIFIER_REPORT`
- recommendation: `FAIL`

## Result

All prescribed commands passed, but two SDK-contract findings block acceptance.

## Acceptance findings

1. **FAIL — single-agent invariant.** `personal-co/src/services/letta.ts` queried agents by tag without requesting the `agent.tags` relationship. Letta client 1.3.3 documents that relationships are excluded by default, so client-side tag filtering could discard the real match and create another agent.
2. **FAIL — exact existing memory schema.** The existing-agent path did not validate that the tagged agent still had exactly the four writable user blocks and two read-only policy blocks.
3. **PASS — remaining criteria.** The five UI surfaces, policy safeguards, archive-first import, evidence-gated learning, placeholder-only configuration, build validation, and architectural attribution passed inspection.

## Validation evidence

- `cd personal-co && npm test` — PASS, 5/5.
- `cd personal-co && npm run typecheck` — PASS.
- `cd personal-co && EXPO_NO_TELEMETRY=1 npm run export:web` — PASS.
- `python3 -B scripts/validate_protocol.py` — PASS, 29/29.
- `python3 -B scripts/protocol_gate.py audit` — PASS.
- `git diff --check` — PASS.
- `git status --short --untracked-files=all` — PASS for the WP scope.

## Required fix

Request `agent.tags` and `agent.blocks` explicitly, reject duplicate tagged agents, validate the exact existing block schema and policy read-only flags, cover zero/one/duplicate and same-ID update behavior with regression tests, and correct the README field name.

## Residual risk

No live Letta server was supplied, so live interoperability remains unverified.
