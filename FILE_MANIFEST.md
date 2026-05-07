# File Manifest

## Root files

- `AGENTS.md` — Codex project instructions.
- `START_HERE.md` — first-run instructions.
- `INSTALLATION.md` — setup and verification steps.
- `README.md` — scaffold overview.
- `FILE_MANIFEST.md` — inventory of scaffold files.
- `.gitignore` — excludes Mac/system clutter and logs.

## Root guide documents

- `00-system-overview.md` — master-agent architecture and state-machine overview.
- `01-codex-app-integration.md` — Codex app local/worktree usage guidance.
- `02-operating-model.md` — daily workflow and thread hygiene.
- `03-agent-role-design.md` — role boundaries for master, explorer, implementer, verifier, fixer, integrator, and security reviewer.
- `04-context-and-memory.md` — durable memory policy and `.ai/` file purposes.
- `05-failure-routing.md` — failure taxonomy, routing, and stop rules.
- `06-human-gates-and-stop-rules.md` — human approval gates and stop conditions.
- `07-mvp-build-plan.md` — first minimal workflow target and success criteria.
- `08-prompt-library.md` — reusable master, explorer, implementation, verification, and fix prompts.
- `09-review-and-integration.md` — review sequence and commit/PR summary formats.
- `10-sources-and-research-notes.md` — source patterns and design rationale.

## Codex config

- `.codex/config.toml` — conservative Codex defaults and agent limits.
- `.codex/agents/explorer.toml` — read-only codebase scout role.
- `.codex/agents/implementer.toml` — scoped implementation role.
- `.codex/agents/verifier.toml` — adversarial verification role.
- `.codex/agents/fixer.toml` — minimal-change fix role for verified failures.
- `.codex/agents/integrator.toml` — integration and memory reconciliation role.
- `.codex/agents/security-reviewer.toml` — read-only security review role.

## Direction-guide skill

- `.agents/skills/direction-guide/SKILL.md` — main multi-agent orchestration protocol.

## Direction-guide references

- `.agents/skills/direction-guide/references/agent-report-template.md` — required subagent/fallback report shape.
- `.agents/skills/direction-guide/references/agent-role-policy.md` — baseline role policy and new-role constraints.
- `.agents/skills/direction-guide/references/config-policy.md` — conservative config, concurrency, and bounded recursion policy.
- `.agents/skills/direction-guide/references/context-packet-schema.md` — required context packet schema for delegation.
- `.agents/skills/direction-guide/references/failure-signatures.md` — repeated-failure signature rules.
- `.agents/skills/direction-guide/references/failure-taxonomy.md` — failure classes and routing guidance.
- `.agents/skills/direction-guide/references/pre-spawn-checklist.md` — gate checklist before spawning a subagent.
- `.agents/skills/direction-guide/references/review-rubric.md` — correctness, scope, tests, security, maintainability, and integration review rubric.
- `.agents/skills/direction-guide/references/routing-matrix.md` — agent, Codex mode, and parallelism routing matrix.
- `.agents/skills/direction-guide/references/thin-master-rule.md` — rule for keeping chat thin and artifacts durable.
- `.agents/skills/direction-guide/references/verification-gate.md` — hard acceptance gate for verifier evidence.
- `.agents/skills/direction-guide/references/work-package-template.yaml` — work package template.

## Durable project memory

- `.ai/MISSION.md` — project purpose and operating intent.
- `.ai/PROJECT_STATE.md` — current milestone, architecture summary, risks, and next work.
- `.ai/TASK_QUEUE.yaml` — work package queue and task status index.
- `.ai/DECISIONS.md` — durable process and architecture decisions.
- `.ai/TEST_MATRIX.md` — scaffold validation commands and alignment checks.
- `.ai/RISK_REGISTER.md` — known workflow, validation, and memory risks.
- `.ai/INTEGRATION_LOG.md` — accepted work history.
- `.ai/MASTER_CONTRACT.md` — binding master operating contract.
- `.ai/MASTER_MODULES.md` — seven master control modules.
- `.ai/MASTER_LEDGER.yaml` — live execution-state ledger.

## Work packages

- `.ai/WORK_PACKAGES/WP-0000-bootstrap.yaml` — scaffold verification package.
- `.ai/WORK_PACKAGES/WP-0004-master-operating-contract.yaml` — master contract package.
- `.ai/WORK_PACKAGES/WP-0005-master-ledger.yaml` — master ledger package.
- `.ai/WORK_PACKAGES/WP-0006-context-packet-schema.yaml` — context packet schema package.
- `.ai/WORK_PACKAGES/WP-0007-context-packet-alignment-hardening.yaml` — context/report alignment hardening package.
- `.ai/WORK_PACKAGES/WP-0009-verification-gate.yaml` — verifier acceptance gate package.
- `.ai/WORK_PACKAGES/WP-0010-master-protocol-consistency.yaml` — master protocol consistency package.
- `.ai/WORK_PACKAGES/WP-0011-lightweight-protocol-validator.yaml` — protocol validator package.
- `.ai/WORK_PACKAGES/WP-0012-guarded-parallel-implementers.yaml` — guarded parallel implementer policy package.
- `.ai/WORK_PACKAGES/WP-0013-depth-2-child-agent-requests.yaml` — bounded depth-2 child-agent request policy package.

## Evaluation scenarios

- `.ai/EVALS/EVAL-001-scope-control.md` — scope-control evaluation scenario.
- `.ai/EVALS/EVAL-002-failure-routing.md` — failure-routing evaluation scenario.
- `.ai/EVALS/EVAL-003-context-minimization.md` — context-minimization evaluation scenario.
- `.ai/EVALS/EVAL-004-verifier-gate.md` — verifier-gate evaluation scenario.
- `.ai/EVALS/EVAL-005-child-agent-requests.md` — child-agent request gate evaluation scenario.

## Report directories

- `.ai/AGENT_REPORTS/README.md` — structured subagent report conventions.
- `.ai/AUTOMATION_REPORTS/README.md` — future recurring audit report conventions.
