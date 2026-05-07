# Installation

## Option A - Adopt the runtime in an existing repo

Use this option when the real project repository already exists. The goal is to install the reusable runtime assets and initialize fresh project memory for that repo.

Runtime bundle assets to copy:

```text
AGENTS.md
README.md
INSTALLATION.md
.codex/config.toml
.codex/agents/
.agents/skills/direction-guide/
scripts/validate_protocol.py
scripts/protocol_gate.py
tests/test_validate_protocol.py
tests/fixtures/
```

Create target-specific `.ai/` memory instead of copying this scaffold repo's history wholesale. Seed the target repo with runtime memory files for mission, project state, task queue, master contract, master modules, master ledger, decisions, risks, metrics, integration log, and test matrix, then rewrite them for the target repository before assigning work.

Do not carry over development-only scaffold history:

```text
.ai/WORK_PACKAGES/WP-*.yaml
.ai/AGENT_REPORTS/*.md
accepted-work history about this scaffold
active ledger state from this scaffold
next-work recommendations about this scaffold
```

Copy the runtime on a bootstrap branch:

```bash
cd /path/to/your/repo
git status
git checkout -b agent-system/bootstrap
```

From the scaffold checkout, copy the runtime files into the project repo with explicit paths:

```bash
cp AGENTS.md /path/to/your/repo/
cp README.md /path/to/your/repo/
cp INSTALLATION.md /path/to/your/repo/
mkdir -p /path/to/your/repo/.codex
mkdir -p /path/to/your/repo/.agents/skills
mkdir -p /path/to/your/repo/scripts
cp .codex/config.toml /path/to/your/repo/.codex/
cp -R .codex/agents /path/to/your/repo/.codex/
cp -R .agents/skills/direction-guide /path/to/your/repo/.agents/skills/
cp scripts/validate_protocol.py /path/to/your/repo/scripts/
cp scripts/protocol_gate.py /path/to/your/repo/scripts/
cp -R tests /path/to/your/repo/
```

Then create or rewrite `.ai/` memory in the target repo so it describes the target product and validation commands. Do this before committing:

```bash
cd /path/to/your/repo
git status --short
python3 scripts/validate_protocol.py
git diff --check
git add AGENTS.md README.md INSTALLATION.md .codex .agents .ai scripts tests
git commit -m "Add Codex multi-agent direction guide scaffold"
```

## Option B - Start a new empty repo

```bash
mkdir my-codex-agent-system
cd my-codex-agent-system
git init
# copy runtime files here, then initialize target-specific .ai memory
git add .
git commit -m "Add Codex multi-agent direction guide scaffold"
```

For a new empty repo, the same boundary applies: copy runtime assets, then make `.ai/` describe the new repo rather than preserving this scaffold repo's work-package and report history.

## Verify expected files

Run:

```bash
test -f AGENTS.md && echo "repo instructions exist"
test -f .agents/skills/direction-guide/SKILL.md && echo "direction-guide skill exists"
test -f .codex/config.toml && echo "codex config exists"
test -f .codex/agents/explorer.toml && echo "explorer agent exists"
test -f .ai/PROJECT_STATE.md && echo "project state exists"
python3 scripts/validate_protocol.py
git diff --check
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
