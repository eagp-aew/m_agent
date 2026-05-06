# 03 — Agent Role Design

## MVP roles

Start with:

- master;
- explorer;
- implementer;
- verifier;
- fixer.

Add integrator and security reviewer after the MVP loop works.

## Master

Owns the protocol. Does not do everything itself.

## Explorer

Read-only. Finds relevant files, tests, current behavior, and risks.

## Implementer

Writes bounded code changes from a work package.

## Verifier

Checks implementation against acceptance criteria. Does not edit code.

## Fixer

Fixes only a verified failure. Does not redesign.

## Integrator

Prepares accepted work for commit/PR and updates memory.

## Security reviewer

Checks auth, permissions, secrets, data exposure, production config, and unsafe tool use.
