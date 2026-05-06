# 10 — Sources and Research Notes

This starter kit is based on patterns from Codex documentation and known multi-agent orchestration structures.

## OpenAI Codex references

- Codex app: https://developers.openai.com/codex/app
- Codex app features: https://developers.openai.com/codex/app/features
- Codex app worktrees: https://developers.openai.com/codex/app/worktrees
- Codex app commands: https://developers.openai.com/codex/app/commands
- Codex app automations: https://developers.openai.com/codex/app/automations
- Codex subagents: https://developers.openai.com/codex/subagents
- Codex skills: https://developers.openai.com/codex/skills
- AGENTS.md instructions: https://developers.openai.com/codex/guides/agents-md
- Config reference: https://developers.openai.com/codex/config-reference
- Hooks: https://developers.openai.com/codex/hooks
- Best practices: https://developers.openai.com/codex/learn/best-practices

## Design patterns borrowed

```text
- supervisor/worker agent orchestration
- agents-as-tools rather than uncontrolled handoffs
- durable markdown memory
- bounded work packages
- adversarial verification
- failure classification before fixing
- worktree-based implementation isolation
- human gates for high-risk changes
```

## Assumptions

This guide assumes:

```text
- you are using a Git repository
- Codex app can access the project directory
- you are comfortable reviewing diffs before committing
- you want semi-automation, not fully autonomous merging
- you are willing to maintain .ai project memory files
```

## What may need adjustment

```text
- test commands in .ai/TEST_MATRIX.md
- model settings in .codex/config.toml
- sandbox/approval settings
- agent roles for your stack
- approval gates for your risk tolerance
- whether security/performance reviewers are needed
```
