# Review Coverage Matrix: WP-0019

Source reviewed: `external:/Users/jie/Downloads/m_agent_repository_review_and_fix_plan.md`

| Finding | Status | Evidence |
|---|---|---|
| F-01 Architecture enforcement | Addressed | `scripts/protocol_gate.py` adds `audit`, `pre-implement`, `pre-accept`, and `check-report`; `scripts/validate_protocol.py` now has 24 checks. |
| F-02 State drift | Addressed | `scripts/validate_protocol.py` keeps status consistency checks across queue, work packages, project state, integration log, and ledger. |
| F-03 Tool calling/security | Addressed | `.agents/skills/direction-guide/references/tool-policy.md` and validator tool-policy checks are in place from WP-0018; WP-0019 gate commands now make this part of pre-accept flow. |
| F-04 Prompt injection | Addressed | `trust_boundary` packet fields from WP-0018 remain validator-enforced; `.agents/skills/direction-guide/references/schema-policy.md` reinforces trust/provenance metadata. |
| F-05 Agent loop budgets | Addressed | `.ai/MASTER_LEDGER.yaml`, `.agents/skills/direction-guide/SKILL.md`, `.agents/skills/direction-guide/references/schema-policy.md`, and `.agents/skills/direction-guide/references/work-package-template.yaml` include execution budget, trace path, and cancellation guidance. |
| F-06 Fallback verification | Addressed | `.agents/skills/direction-guide/references/verification-gate.md` and `.agents/skills/direction-guide/references/schema-policy.md` define `fallback_verification` metadata and high-risk independent-verifier limits. |
| F-07 Negative tests | Addressed | `tests/test_validate_protocol.py` plus fixtures cover malformed skill metadata, unreplayable report paths, fake secret detection, and report gate failure behavior. |
| F-08 Superseded policy | Addressed | WP-0010 and WP-0011 include `historical_policy.superseded_by` and `current_policy_reference` fields. |
| F-09 Report path observability | Addressed | WP-0018 added report referenced-path validation; WP-0019 gate tests include an unreplayable path fixture. |
| F-10 Historical attestation | Addressed | `.ai/AGENT_REPORTS/historical-fallback-verification.md` is marked `HISTORICAL_ATTESTATION` and not valid for new acceptance decisions. |
| F-11 Concurrency risk | Addressed as policy | Current guarded parallel policy remains capped at 3 and default one writer; WP-0019 did not expand recursion or parallelism. |
| F-12 Memory provenance | Addressed | `.agents/skills/direction-guide/references/schema-policy.md` and work-package template include provenance, trust, source, verified_by, and superseded_by fields. |
| F-13 Error handling structure | Addressed | `.agents/skills/direction-guide/references/failure-taxonomy.md` and work-package template include structured error fields with category, code, retryability, side-effect risk, and idempotency key. |
| F-14 README drift | Addressed | `README.md` now points to `.ai/PROJECT_STATE.md` as the current manifest instead of carrying a stale full file list. |
| F-15 Repeated contracts | Partially addressed | `.agents/skills/direction-guide/references/schema-policy.md` centralizes new metadata; existing packet/report field repetition remains validator-covered rather than fully deduplicated. |
| F-16 Secret scan | Addressed | WP-0018 added lightweight scaffold secret scanning; WP-0019 added a fake secret negative fixture. |
| F-17 Context profiles | Addressed | `.agents/skills/direction-guide/references/context-profiles.md` defines `small`, `protocol`, and `full` profiles. |

Residual risk: This repository is still a Codex protocol scaffold, not a hardened standalone runtime. Enforcement is now materially stronger through validator/gate checks and negative tests, but tool execution still ultimately depends on Codex runtime permissions and master discipline.
