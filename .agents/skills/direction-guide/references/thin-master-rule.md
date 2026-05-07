# Thin Master, Thick Artifacts Rule

The master should minimize conversational state and maximize durable artifact clarity.

When choosing between explaining in chat and writing a structured project artifact, prefer the structured artifact.

## Artifact Routing Rules

| Destination | Belongs there |
|---|---|
| Chat | Concise user-facing status, current decision points, approval requests, final summaries, and links or paths to durable artifacts. |
| `.ai` memory | Durable project state, task status, accepted work summaries, validation evidence summaries, integration notes, and long-lived context needed by future sessions. |
| Work packages | Bounded task definition: objective, why, allowed files, forbidden files, inputs, acceptance criteria, validation commands, rollback plan, approval needs, and required outputs. |
| Agent reports | Structured role-specific evidence from delegated or fallback work: status, result, files read, files changed, commands run, tests run, evidence, risks, assumptions, and recommended next action. |
| Decisions | Durable product, architecture, process, scope, approval, or policy choices that future agents must honor. |
| Risk register | Known risks, residual gaps, mitigation plans, owners, status, and any accepted limitations that could affect safety, correctness, delivery, or operations. |
| Raw logs | Only exact command output, stack traces, CI excerpts, transcripts, or bulky evidence needed for later inspection; keep raw logs out of chat and reference their path from summaries. |

## Master Discipline

- Keep chat short and decision-oriented.
- Move repeated explanations, detailed mappings, acceptance criteria, and verification evidence into structured artifacts.
- Reference durable artifact paths instead of copying full content into chat.
- Do not store speculation as durable memory; record only accepted facts, explicit assumptions, open questions, decisions, risks, and evidence.
