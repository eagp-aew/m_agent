# Start Here: Build the Work System in Codex

This is the practical bootstrap path. Follow this order.

## 1. Unzip into a repository root

Unzip this package into the root of the project where you want the agent system to live.

Expected result:

```text
repo/
  AGENTS.md
  START_HERE.md
  .ai/
  .agents/skills/direction-guide/SKILL.md
  .codex-markdown/
```

Commit the starter kit before asking Codex to modify it.

```bash
git checkout -b agent-system/bootstrap
git add AGENTS.md START_HERE.md *.md .ai .agents .codex-markdown
git commit -m "Add Codex multi-agent direction guide starter kit"
```

## 2. Open the repo in Codex app

Use Local mode for this first bootstrap because the first task is just creating project instructions and config. Use Worktree mode later for implementation tasks.

In the Codex app thread, enable plan mode:

```text
/plan-mode
```

Then paste this prompt:

```text
Use $direction-guide.

Bootstrap this repository for the multi-agent direction-guide workflow.

Read:
- AGENTS.md
- START_HERE.md
- README.md
- .agents/skills/direction-guide/SKILL.md
- .codex-markdown/**/*.md
- .ai/**/*.md

Do not modify application code.

Tasks:
1. Create real Codex config files from the TOML snippets in .codex-markdown/:
   - .codex/config.toml
   - .codex/agents/explorer.toml
   - .codex/agents/implementer.toml
   - .codex/agents/verifier.toml
   - .codex/agents/fixer.toml
   - .codex/agents/integrator.toml
   - .codex/agents/security-reviewer.toml
2. Check that the direction-guide skill exists at .agents/skills/direction-guide/SKILL.md.
3. Normalize .ai project memory templates for this repository.
4. Do not change source code.
5. Return a concise report listing created files and any manual steps I still need to do.
```

## 3. Commit the bootstrap output

Review the changes Codex created. You should see real `.toml` files under `.codex/`.

Then commit:

```bash
git add .codex .ai .agents AGENTS.md
git commit -m "Materialize Codex multi-agent workflow config"
```

## 4. Start your first live work package

Create a new Codex app thread in Worktree mode for the first real coding task. Use a small, low-risk target.

Paste:

```text
Use $direction-guide.

You are the master controller for the first live test of this workflow.

Goal:
Choose one small, safe, reversible improvement in this repository and complete it using the direction-guide protocol.

Rules:
- Start in plan mode.
- Do not edit application code until after exploration and work-package creation.
- Spawn read-only explorer subagents if needed.
- Create exactly one work package under .ai/WORK_PACKAGES/.
- Assign exactly one implementer.
- Assign exactly one verifier after implementation.
- If verification fails, classify the failure before assigning a fixer.
- Keep the root thread clean.
- Update .ai/PROJECT_STATE.md, .ai/TASK_QUEUE.md, and .ai/INTEGRATION_LOG.md at the end.
```

## 5. Decide what “success” looks like

Your first success metric is not autonomy. It is control.

The first run succeeds when:

```text
- the master creates a clear work package
- implementation touches a small file set
- verifier returns evidence, not vibes
- failures are routed deliberately
- project memory is updated
- you can review the diff without confusion
```

## 6. Brutally honest warning

Do not start by asking this system to build a whole app. Start by asking it to complete one clean work package. The architecture becomes valuable only after the handoffs become boring and repeatable.
