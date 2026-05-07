#!/usr/bin/env python3
"""Validate the Codex master-agent protocol scaffold.

This script is intentionally read-only and dependency-free. It turns the
documented protocol consistency checks into one repeatable command.
"""

from __future__ import annotations

from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parents[1]

BASELINE_AGENTS = {
    "explorer.toml",
    "implementer.toml",
    "verifier.toml",
    "fixer.toml",
    "integrator.toml",
    "security-reviewer.toml",
}

CORE_FILES = [
    "AGENTS.md",
    ".codex/config.toml",
    ".agents/skills/direction-guide/SKILL.md",
    ".agents/skills/direction-guide/references/agent-report-template.md",
    ".agents/skills/direction-guide/references/agent-role-policy.md",
    ".agents/skills/direction-guide/references/config-policy.md",
    ".agents/skills/direction-guide/references/context-packet-schema.md",
    ".agents/skills/direction-guide/references/failure-signatures.md",
    ".agents/skills/direction-guide/references/failure-taxonomy.md",
    ".agents/skills/direction-guide/references/pre-spawn-checklist.md",
    ".agents/skills/direction-guide/references/routing-matrix.md",
    ".agents/skills/direction-guide/references/thin-master-rule.md",
    ".agents/skills/direction-guide/references/verification-gate.md",
    ".ai/MASTER_CONTRACT.md",
    ".ai/MASTER_LEDGER.yaml",
    ".ai/METRICS.md",
    ".ai/PROJECT_STATE.md",
    ".ai/TASK_QUEUE.yaml",
    ".ai/TEST_MATRIX.md",
    ".ai/RISK_REGISTER.md",
    ".ai/EVALS/EVAL-005-child-agent-requests.md",
]

PACKET_FIELDS = [
    "task_id",
    "agent_role",
    "objective",
    "source_of_truth",
    "must_read",
    "may_read",
    "do_not_read",
    "allowed_files",
    "forbidden_files",
    "acceptance_criteria",
    "validation_commands",
    "output_schema",
    "stop_conditions",
    "max_context_notes",
]

REPORT_FIELDS = [
    "task_id",
    "agent_role",
    "status",
    "one_sentence_result",
    "files_read",
    "files_changed",
    "commands_run",
    "tests_run",
    "evidence",
    "risks",
    "assumptions",
    "recommended_next_action",
    "child_agent_requests",
    "child_report_bundle",
]

RECURSIVE_PACKET_FIELDS = [
    "agent_run_id",
    "parent_agent_run_id",
    "delegation_depth",
    "max_child_depth",
    "can_request_child_agents",
    "allowed_child_roles",
    "child_spawn_mode",
    "child_agent_budget",
    "child_context_budget",
    "child_runtime_budget",
    "child_write_policy",
    "child_report_bundle_required",
]

NON_BASELINE_ROLE_PATTERN = re.compile(
    r"Route:\s*.*performance reviewer|agent_role:\s*\".*"
    r"(architect|product-manager|frontend-agent|backend-agent|database-agent|"
    r"refactor-agent|performance-agent|documentation-agent|release-agent)",
    re.IGNORECASE,
)


class CheckResult:
    def __init__(self, name: str, ok: bool, message: str) -> None:
        self.name = name
        self.ok = ok
        self.message = message


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def read_text(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def file_exists(path: str) -> bool:
    return (ROOT / path).is_file()


def contains(path: str, pattern: str, flags: int = 0) -> bool:
    return re.search(pattern, read_text(path), flags) is not None


def all_contain(paths: list[str], pattern: str, flags: int = 0) -> tuple[bool, list[str]]:
    missing = [path for path in paths if not contains(path, pattern, flags)]
    return not missing, missing


def check_required_files() -> CheckResult:
    missing = [path for path in CORE_FILES if not file_exists(path)]
    return CheckResult(
        "required scaffold files",
        not missing,
        "all required scaffold files exist" if not missing else f"missing: {', '.join(missing)}",
    )


def check_baseline_agents() -> CheckResult:
    agents_dir = ROOT / ".codex/agents"
    actual = {path.name for path in agents_dir.glob("*.toml")}
    missing = sorted(BASELINE_AGENTS - actual)
    extra = sorted(actual - BASELINE_AGENTS)
    if missing or extra:
        details = []
        if missing:
            details.append(f"missing: {', '.join(missing)}")
        if extra:
            details.append(f"extra: {', '.join(extra)}")
        return CheckResult("baseline agent set", False, "; ".join(details))
    return CheckResult("baseline agent set", True, "exactly the six baseline agent TOMLs exist")


def check_max_depth() -> CheckResult:
    config = read_text(".codex/config.toml")
    ok = re.search(r"(?m)^\s*max_depth\s*=\s*2\s*$", config) is not None
    return CheckResult("max_depth", ok, "max_depth is bounded at 2" if ok else "max_depth = 2 not found")


def check_bounded_recursive_delegation() -> CheckResult:
    requirements = [
        (".codex/config.toml", r"max_depth\s*=\s*2"),
        (".agents/skills/direction-guide/references/config-policy.md", r"max_depth = 2"),
        (".agents/skills/direction-guide/references/config-policy.md", r"master-approved implementer child-agent requests"),
        (".agents/skills/direction-guide/references/routing-matrix.md", r"Child-Agent Request Gate"),
        (".agents/skills/direction-guide/references/routing-matrix.md", r"master -> implementer -> child agent"),
        (".agents/skills/direction-guide/references/routing-matrix.md", r"max_child_depth = 0|max_child_depth: 0"),
        (".agents/skills/direction-guide/references/context-packet-schema.md", r"Recursive Delegation Fields"),
        (".agents/skills/direction-guide/references/context-packet-schema.md", r"delegation_depth"),
        (".agents/skills/direction-guide/references/agent-report-template.md", r"child_agent_requests"),
        (".agents/skills/direction-guide/SKILL.md", r"master_approved_request"),
        (".codex/agents/implementer.toml", r"child_agent_requests"),
        (".ai/MASTER_LEDGER.yaml", r"recursive_delegation"),
        (".ai/METRICS.md", r"recursive_delegation_violations"),
        (".ai/TEST_MATRIX.md", r"Child-Agent Request Check"),
        (".ai/EVALS/EVAL-005-child-agent-requests.md", r"denies the unreserved generated-file request"),
    ]
    missing = [path for path, pattern in requirements if not contains(path, pattern, re.IGNORECASE)]
    stale_targets = [
        ".agents/skills/direction-guide/SKILL.md",
        ".agents/skills/direction-guide/references/config-policy.md",
        ".agents/skills/direction-guide/references/routing-matrix.md",
        ".ai/PROJECT_STATE.md",
        ".ai/TEST_MATRIX.md",
    ]
    stale = []
    for path in stale_targets:
        text = read_text(path)
        if re.search(r"Recursive delegation\s*\|\s*Disabled|recursive delegation remains disabled|max_depth remains `?1`?|agents\.max_depth = 1", text, re.IGNORECASE):
            stale.append(path)
    ok = not missing and not stale
    return CheckResult(
        "bounded recursive delegation",
        ok,
        "depth-2 master-approved child-agent request policy is documented and tracked"
        if ok
        else f"bounded recursion drift; missing: {', '.join(missing) or 'none'}; stale disabled policy in: {', '.join(stale) or 'none'}",
    )


def check_guarded_parallel_policy() -> CheckResult:
    requirements = [
        ("AGENTS.md", r"guarded parallel policy"),
        (".agents/skills/direction-guide/SKILL.md", r"effective_parallel_write_agents"),
        (".agents/skills/direction-guide/references/config-policy.md", r"max_parallel_write_agents = 3"),
        (".agents/skills/direction-guide/references/config-policy.md", r"ceiling"),
        (".agents/skills/direction-guide/references/routing-matrix.md", r"Parallel implementers.*Allowed only"),
        (".agents/skills/direction-guide/references/routing-matrix.md", r"unique `shard_id`"),
        (".agents/skills/direction-guide/references/routing-matrix.md", r"isolated worktree"),
        (".agents/skills/direction-guide/references/routing-matrix.md", r"exact allowed file"),
        (".agents/skills/direction-guide/references/routing-matrix.md", r"no globs"),
        (".agents/skills/direction-guide/references/context-packet-schema.md", r"shard_id"),
        (".agents/skills/direction-guide/references/context-packet-schema.md", r"worktree_id"),
        (".agents/skills/direction-guide/references/context-packet-schema.md", r"reserved_files"),
        (".agents/skills/direction-guide/references/context-packet-schema.md", r"parallel_batch_id"),
        (".agents/skills/direction-guide/references/pre-spawn-checklist.md", r"file reservations"),
        (".agents/skills/direction-guide/references/pre-spawn-checklist.md", r"worktree assignments"),
        (".agents/skills/direction-guide/references/pre-spawn-checklist.md", r"effective write-agent count"),
        (".ai/MASTER_LEDGER.yaml", r"max_parallel_write_agents:\s*3"),
        (".ai/MASTER_LEDGER.yaml", r"effective_parallel_write_agents"),
        (".ai/MASTER_LEDGER.yaml", r"parallel_write_conflicts"),
        (".ai/METRICS.md", r"exact_file_reservations_recorded"),
        (".ai/METRICS.md", r"isolated_worktrees_required"),
        (".ai/TEST_MATRIX.md", r"Guarded Parallel Implementer Check"),
    ]
    missing = [path for path, pattern in requirements if not contains(path, pattern, re.IGNORECASE | re.DOTALL)]
    old_policy_targets = [
        "AGENTS.md",
        ".agents/skills/direction-guide/SKILL.md",
        ".agents/skills/direction-guide/references/config-policy.md",
        ".agents/skills/direction-guide/references/routing-matrix.md",
        ".ai/MASTER_LEDGER.yaml",
        ".ai/PROJECT_STATE.md",
        ".ai/TEST_MATRIX.md",
    ]
    stale = []
    for path in old_policy_targets:
        text = read_text(path)
        if re.search(r"Parallel implementers\s*\|\s*Not allowed|max_parallel_write_agents\s*=\s*1|max_parallel_write_agents:\s*1", text, re.IGNORECASE):
            stale.append(path)
    return CheckResult(
        "guarded parallel implementer policy",
        not missing and not stale,
        "guarded parallel policy, exact reservations, worktree isolation, dynamic cap, and conflict tracking are documented"
        if not missing and not stale
        else f"guarded parallel drift; missing: {', '.join(missing) or 'none'}; stale old policy in: {', '.join(stale) or 'none'}",
    )


def check_context_packet_requirement() -> CheckResult:
    paths = [
        ".agents/skills/direction-guide/SKILL.md",
        ".agents/skills/direction-guide/references/context-packet-schema.md",
        ".agents/skills/direction-guide/references/pre-spawn-checklist.md",
    ]
    ok, missing_context = all_contain(paths, r"context packet", re.IGNORECASE)
    agent_paths = [f".codex/agents/{name}" for name in sorted(BASELINE_AGENTS)]
    ok_agents, missing_agents = all_contain(agent_paths, r"context_packet.*source of truth", re.IGNORECASE | re.DOTALL)
    return CheckResult(
        "context packet requirement",
        ok and ok_agents,
        "context packet requirement appears in protocol, checklist, schema, and all agents"
        if ok and ok_agents
        else f"context packet language missing in: {', '.join(missing_context + missing_agents)}",
    )


def check_packet_fields() -> CheckResult:
    targets = [
        ".agents/skills/direction-guide/SKILL.md",
        ".agents/skills/direction-guide/references/context-packet-schema.md",
    ]
    missing = []
    for path in targets:
        text = read_text(path)
        for field in PACKET_FIELDS:
            if field not in text:
                missing.append(f"{path}:{field}")
    return CheckResult(
        "context packet fields",
        not missing,
        "all required context packet fields are named in skill and schema"
        if not missing
        else f"missing field references: {', '.join(missing)}",
    )


def check_recursive_packet_fields() -> CheckResult:
    targets = [
        ".agents/skills/direction-guide/references/context-packet-schema.md",
        ".agents/skills/direction-guide/SKILL.md",
    ]
    missing = []
    for path in targets:
        text = read_text(path)
        for field in RECURSIVE_PACKET_FIELDS:
            if field not in text:
                missing.append(f"{path}:{field}")
    return CheckResult(
        "recursive packet fields",
        not missing,
        "recursive delegation packet fields are named in skill and schema"
        if not missing
        else f"missing recursive field references: {', '.join(missing)}",
    )


def check_report_fields() -> CheckResult:
    targets = [
        ".agents/skills/direction-guide/SKILL.md",
        ".agents/skills/direction-guide/references/context-packet-schema.md",
        ".agents/skills/direction-guide/references/agent-report-template.md",
    ]
    missing = []
    for path in targets:
        text = read_text(path)
        for field in REPORT_FIELDS:
            if field not in text:
                missing.append(f"{path}:{field}")
    return CheckResult(
        "common report fields",
        not missing,
        "all required common report fields are named in skill, schema, and template"
        if not missing
        else f"missing report field references: {', '.join(missing)}",
    )


def check_verifier_gate() -> CheckResult:
    requirements = [
        (".agents/skills/direction-guide/references/verification-gate.md", r"fallback verification"),
        (".agents/skills/direction-guide/references/verification-gate.md", r"Human explicitly overrides"),
        (".agents/skills/direction-guide/SKILL.md", r"verifier-equivalent evidence|fallback verification"),
        (".ai/MASTER_CONTRACT.md", r"verifier-equivalent evidence|fallback verification"),
        (".ai/METRICS.md", r"verifier report or fallback verification evidence"),
    ]
    missing = [path for path, pattern in requirements if not contains(path, pattern, re.IGNORECASE)]
    return CheckResult(
        "verification gate and fallback evidence",
        not missing,
        "verifier/fallback evidence and human override paths are documented"
        if not missing
        else f"verification gate language missing in: {', '.join(missing)}",
    )


def check_repeated_failure_escalation() -> CheckResult:
    requirements = [
        (".ai/MASTER_LEDGER.yaml", r"repeat_stop_threshold:\s*2"),
        (".agents/skills/direction-guide/references/failure-signatures.md", r"same failure signature appears twice"),
        (".agents/skills/direction-guide/references/failure-signatures.md", r"ESCALATED"),
        (".agents/skills/direction-guide/SKILL.md", r"two failed fix attempts"),
        (".agents/skills/direction-guide/SKILL.md", r"same failure signature appears twice"),
    ]
    missing = [path for path, pattern in requirements if not contains(path, pattern, re.IGNORECASE)]
    return CheckResult(
        "repeated failure escalation",
        not missing,
        "repeat threshold and escalation are documented"
        if not missing
        else f"repeated-failure language missing in: {', '.join(missing)}",
    )


def check_no_non_baseline_roles() -> CheckResult:
    targets = [
        ".agents/skills/direction-guide/references/routing-matrix.md",
        ".agents/skills/direction-guide/references/failure-taxonomy.md",
        ".agents/skills/direction-guide/SKILL.md",
    ] + [f".codex/agents/{name}" for name in sorted(BASELINE_AGENTS)]
    matches = []
    for path in targets:
        for line_no, line in enumerate(read_text(path).splitlines(), 1):
            if NON_BASELINE_ROLE_PATTERN.search(line):
                matches.append(f"{path}:{line_no}: {line.strip()}")
    return CheckResult(
        "no non-baseline routed roles",
        not matches,
        "no non-baseline routed roles found"
        if not matches
        else "non-baseline role routing found: " + " | ".join(matches),
    )


def run_checks() -> list[CheckResult]:
    return [
        check_required_files(),
        check_baseline_agents(),
        check_max_depth(),
        check_bounded_recursive_delegation(),
        check_guarded_parallel_policy(),
        check_context_packet_requirement(),
        check_packet_fields(),
        check_recursive_packet_fields(),
        check_report_fields(),
        check_verifier_gate(),
        check_repeated_failure_escalation(),
        check_no_non_baseline_roles(),
    ]


def main() -> int:
    results = run_checks()
    for result in results:
        status = "PASS" if result.ok else "FAIL"
        print(f"{status} {result.name}: {result.message}")
    failed = [result for result in results if not result.ok]
    if failed:
        print(f"\n{len(failed)} protocol validation check(s) failed.", file=sys.stderr)
        return 1
    print(f"\nAll {len(results)} protocol validation checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
