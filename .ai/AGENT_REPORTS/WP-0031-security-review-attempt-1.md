# SECURITY_REVIEW_REPORT

- task_id: WP-0031-reflection-weekly-review
- agent_role: security-reviewer
- status: FAIL
- recommendation: Assign a bounded security fixer, then rerun independent verification.
- one_sentence_result: Core authorization and read-back protections fail closed, but credential and reserved-marker sanitization has reproducible normalization bypasses that permit sensitive or marker-shaped text into prompts, Archive records, tags, and pending Block proposals.

## Threat boundary

User-entered reflection text, assistant replies, Archive responses, Block metadata, tags, and workflow callbacks were treated as untrusted. No secret stores, environment secret files, network services, or unrelated code were inspected.

## Findings by severity

### HIGH — Composite credential identifiers bypass storage protection

`SECRET_SHAPED_TEXT` requires a word boundary immediately before credential keywords. Common compound identifiers therefore bypass it.

Evidence:

- `OPENAI_API_KEY=synthetic-value` was accepted in progress and hypothesis evidence and appeared verbatim in serialized Archive text.
- The same synthetic value was accepted as provenance and produced a provenance tag.
- `access_token=synthetic-value` was accepted as an Archive source tag.
- A PROFILE proposal containing the compound credential was staged and authorized.
- Direct, Unicode-fullwidth, and whitespace-separated credential variants were rejected correctly.

### MEDIUM — Reserved-marker detection is case- and spacing-sensitive

Lowercase and whitespace-shifted variants of the managed connection marker survived serialization and could be staged as a core proposal. The exact uppercase marker was rejected.

### MEDIUM — Metadata secret-key sanitizer lacks Unicode normalization

`buildPersonalCoMetadata` removes ordinary credential keys, but a synthetic fullwidth credential key remained in nested metadata and would be preserved during an approved Block update.

## Criteria mapping

- Credential exclusion across source/provenance/evidence/proposals/tags: FAIL
- Reserved managed-marker rejection: FAIL
- Metadata obvious-secret-key sanitization: FAIL
- Quoted serialization/non-executable framing: PASS
- Review and pending-change factory provenance/clone rejection: PASS
- Exact Agent, Block ID, base value, permission, and limit checks: PASS
- Stale/over-limit proposal rejection before writes: PASS
- Coaching reconciliation and reply discard on failure: PASS
- Archive ID/text/tag/time and unchanged-Block verification: PASS
- No new shell/browser/scheduler/external-tool surface: PASS
- No actual high-entropy secret material found in scoped diff/reports: PASS

## Adversarial results

- Targeted deterministic suite: PASS, 28/28
- Composite credential probes: FAIL open
- Case/spacing marker probes: FAIL open
- Unicode metadata-key probe: FAIL open
- Direct credential, exact marker, cloned object, stale proposal, false read-back, Agent drift, read-only and over-limit checks: PASS closed

## Files read

- `AGENTS.md`
- `.ai/MASTER_CONTRACT.md`
- `.ai/WORK_PACKAGES/WP-0031-reflection-weekly-review.yaml`
- `.ai/AGENT_REPORTS/WP-0031-verifier-attempt-2.md`
- `.ai/AGENT_REPORTS/WP-0031-fixer.md`
- `personal-co/App.tsx`
- `personal-co/src/domain/reflection.mjs`
- `personal-co/src/domain/changes.mjs`
- `personal-co/src/domain/imports.mjs`
- `personal-co/src/services/letta.ts`
- `personal-co/tests/reflection-workflow.test.mjs`
- `personal-co/tests/governance.test.mjs`
- Supplied DOCX §§8.3–8.5 and §11

## Files changed

None.

## Commands run

- Read-only source, Git, and DOCX inspections.
- In-memory Node adversarial probes.

## Tests run

- `node --test tests/reflection-workflow.test.mjs tests/governance.test.mjs` — PASS, 28/28.
- `git diff --check` — PASS.

## Evidence

The post-fix Archive comparison includes Block value, limit, both read-only forms, and canonical metadata. Apply refreshes the exact destination and rejects duplicate, missing, stale, read-only, invalid-limit, and over-limit Blocks before writing.

## Risks

Credential and marker variants remain blocking. Prompt-injection behavior still depends on model instruction compliance, though memory reconciliation and reply separation constrain persistence.

## Assumptions

- Synthetic credential strings represent structure only and contain no real secret.
- Letta metadata is JSON-compatible.
- Lowercase or spaced reserved markers are not executable today but remain forbidden persistent-memory shapes.

## Recommended next action

Normalize and case-fold credential identifiers, reserved markers, and metadata keys before validation; add regressions for compound identifiers, Unicode key variants, and marker case/spacing variants; then perform fresh independent verification.

## Child agent requests

None.

## Child report bundle

None.

## Security findings

- 1 high-severity finding.
- 2 medium-severity findings.
