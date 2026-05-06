# Installation

## Option A — Copy into an existing repo

Unzip this scaffold, then copy all contents into the root of your project repo.

Important: include hidden directories:

```text
.codex
.agents
.ai
```

On macOS Finder, press `Command + Shift + .` to show hidden files.

Then run:

```bash
cd /path/to/your/repo
ls -la
git status
git checkout -b agent-system/bootstrap
git add .
git commit -m "Add Codex multi-agent direction guide scaffold"
```

## Option B — Start a new empty repo

```bash
mkdir my-codex-agent-system
cd my-codex-agent-system
git init
# copy scaffold files here
git add .
git commit -m "Add Codex multi-agent direction guide scaffold"
```

## Verify expected files

Run:

```bash
test -f .agents/skills/direction-guide/SKILL.md && echo "direction-guide skill exists"
test -f .codex/config.toml && echo "codex config exists"
test -f .codex/agents/explorer.toml && echo "explorer agent exists"
test -f .ai/PROJECT_STATE.md && echo "project state exists"
```

## If Codex cannot find `$direction-guide`

Check:

```bash
ls -la .agents/skills/direction-guide
cat .agents/skills/direction-guide/SKILL.md | head -20
```

The file should start with YAML frontmatter:

```markdown
---
name: direction-guide
description: ...
---
```
