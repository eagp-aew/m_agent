# Test Matrix

This repository is a Codex multi-agent direction-system scaffold, not an application with a package manager or runtime test suite. Use deterministic scaffold and documentation checks until a dedicated validator is introduced.

## Default validation order

1. Targeted test for changed behavior.
2. Related package/module tests.
3. Typecheck.
4. Lint.
5. Build.
6. Full suite only when necessary.

## Commands

| Area | Command | When to run | Notes |
|---|---|---|---|
| Scaffold presence | `test -f .agents/skills/direction-guide/SKILL.md && test -f .codex/config.toml && test -f AGENTS.md` | Any scaffold change | Confirms core entrypoints exist. |
| Agent definitions | `test -f .codex/agents/explorer.toml && test -f .codex/agents/implementer.toml && test -f .codex/agents/verifier.toml && test -f .codex/agents/fixer.toml && test -f .codex/agents/integrator.toml && test -f .codex/agents/security-reviewer.toml` | Changes under `.codex/agents/` | Confirms the MVP role set exists. |
| Skill metadata | `sed -n '1,12p' .agents/skills/direction-guide/SKILL.md` | Changes to `direction-guide` | Confirm YAML frontmatter includes `name` and `description`. |
| Placeholder scan | `rg -n "TODO|Replace this section|YYYY-MM-DD|TBD" .ai AGENTS.md .codex .agents/skills/direction-guide -g '!.ai/TEST_MATRIX.md'` | Before accepting memory/scaffold changes | Remaining placeholders must be intentional or queued. |
| Scope check | `git status --short` | Before final review | Ensure only intended scaffold/memory files changed. |

## Known flaky tests

| Test | Symptom | Handling |
|---|---|---|
|  |  |  |

## Environment notes

- Required runtime: none for current scaffold validation.
- Package manager: none detected in this repo.
- Setup command: none required beyond cloning/opening the repository in Codex.
- Local services required: none.
- Test database required: no.
- Primary validation style: shell file checks, text scans with `rg`, and manual review of Markdown/TOML/YAML consistency.
