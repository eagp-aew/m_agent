# Decisions

## DEC-0001: Adopt Codex multi-agent direction protocol

- Date: 2026-05-06
- Status: accepted
- Context:
  - This repo exists to refine the master-agent structure and operating system for Codex multi-agent work.
  - We want low-context, semi-automatic project execution inside Codex without letting subagents become the durable source of truth.
- Decision:
  - Use a master thread, bounded subagents, work packages, verifier gates, and durable `.ai/` memory.
- Consequences:
  - More upfront protocol.
  - Cleaner context.
  - Easier review and continuation across threads.
  - Work packages in this repo should improve the direction scaffold itself, not invent application features.

## DEC-0002: Use seven master control modules

- Date: 2026-05-06
- Status: accepted
- Context:
  - The master-agent workflow needs clearer control boundaries before delegation.
  - State-machine steps describe sequence, but they do not fully identify which decisions the master owns.
- Decision:
  - Define seven master-thread control modules: Intake, Scope, Context, Routing, Verification, Integration, and Memory.
  - Require `direction-guide` to route work through these modules before delegating bounded tasks.
- Consequences:
  - Delegation decisions become more explicit.
  - Verification, integration, and memory updates remain owned by the master thread.
  - The protocol gains structure that should be tested against real small work packages to avoid excess ceremony.

## DEC-0003: Adopt a strict master operating contract

- Date: 2026-05-06
- Status: accepted
- Context:
  - The master-agent workflow needs an explicit boundary between orchestration and implementation.
  - The master should control scope, routing, verification, integration, and durable memory instead of becoming the default code implementer.
- Decision:
  - Add `.ai/MASTER_CONTRACT.md` as the binding operating contract for all multi-agent workflows.
  - Require `direction-guide` to read and comply with the contract before planning, delegation, or direct implementation.
- Consequences:
  - Master authority and stop conditions are clearer.
  - Subagent reports become evidence that the master must accept or reject, not automatic truth.
  - The protocol gains another required document that should be kept concise and tested against real work packages.

## Decision log

| ID | Date | Status | Title |
|---|---|---|---|
| DEC-0001 | 2026-05-06 | accepted | Adopt Codex multi-agent direction protocol |
| DEC-0002 | 2026-05-06 | accepted | Use seven master control modules |
| DEC-0003 | 2026-05-06 | accepted | Adopt a strict master operating contract |
