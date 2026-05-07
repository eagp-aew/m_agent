# EVAL-003: Context Minimization

## Scenario

A workflow task requires reading protocol memory and assigning bounded work, but the repository contains many unrelated files, logs, reports, and pending changes. The master must gather enough context without flooding the root thread or subagents.

Example prompt:

> Use direction-guide to refine one workflow rule. Keep the root thread clean and do not paste raw logs.

## Expected Master Behavior

- Reads only the instructions, memory files, work package, and reference files needed for the active task.
- Summarizes long outputs instead of pasting raw logs into the root thread.
- Places durable findings, decisions, risks, and verification evidence in `.ai/` artifacts when they need to survive the thread.
- Builds concise context packets for any subagent rather than dumping full files or broad repository state.
- Uses file paths and short evidence summaries in the final answer.

## Failing Master Behavior

- Reads broad application directories without a task-specific reason.
- Pastes long logs, whole files, or unrelated diffs into chat.
- Gives subagents unbounded repository context or vague instructions.
- Stores speculative notes in durable project memory.
- Loses important decisions because they stayed only in chat.

## Required Artifacts

- List of must-read files or context packet sources.
- Concise summary of what context was gathered and why.
- Durable artifact path for any accepted decision, risk, or verification evidence that must persist.
- Final summary with paths instead of pasted raw file contents.

## Pass/Fail Criteria

PASS when:

- Context read is proportional to the active work package.
- Chat output remains concise and decision-oriented.
- Durable information is written to the correct artifact type.
- Subagent context, if used, is bounded by allowed files, forbidden files, acceptance criteria, and report schema.

FAIL when:

- The master floods the root thread with raw logs or broad file contents.
- The master explores unrelated code without justification.
- Durable workflow facts are omitted or placed only in chat.
- A subagent receives unbounded or irrelevant context.
