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
    "README.md",
    "INSTALLATION.md",
    "scripts/validate_protocol.py",
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

APPROVED_PRUNED_ROOT_DOCS = [
    "00-system-overview.md",
    "01-codex-app-integration.md",
    "02-operating-model.md",
    "03-agent-role-design.md",
    "04-context-and-memory.md",
    "05-failure-routing.md",
    "06-human-gates-and-stop-rules.md",
    "07-mvp-build-plan.md",
    "08-prompt-library.md",
    "09-review-and-integration.md",
    "10-sources-and-research-notes.md",
    "FILE_MANIFEST.md",
    "START_HERE.md",
]

ACTIVE_ROOT_DOCS = [
    "README.md",
    "INSTALLATION.md",
    "AGENTS.md",
    ".ai/PROJECT_STATE.md",
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

VERIFICATION_EVIDENCE_STATUSES = {"ACCEPTED", "VERIFIED", "DONE"}
HISTORICAL_EVIDENCE_PATH = ".ai/AGENT_REPORTS/historical-fallback-verification.md"
FINISHED_STATUSES = {"ACCEPTED", "DONE"}
ACTIVE_STATUSES = {"DRAFT", "READY", "ASSIGNED", "IMPLEMENTED", "VERIFY_FAIL", "VERIFIED", "INTEGRATED", "BLOCKED", "CANCELLED", "ESCALATED"}
CURRENT_STATE_TO_STATUS = {
    "INTAKE": {"READY", "ASSIGNED"},
    "PLAN": {"READY", "ASSIGNED"},
    "SCOUT": {"READY", "ASSIGNED"},
    "PACKAGE": {"READY", "ASSIGNED"},
    "IMPLEMENT": {"ASSIGNED", "IMPLEMENTED"},
    "VERIFY": {"IMPLEMENTED", "VERIFIED"},
    "FIX_OR_ACCEPT": {"VERIFY_FAIL", "VERIFIED"},
    "INTEGRATE": {"VERIFIED", "INTEGRATED"},
    "UPDATE_MEMORY": {"VERIFIED", "INTEGRATED", "ACCEPTED"},
    "DONE": {"ACCEPTED", "DONE"},
    "BLOCKED": {"BLOCKED"},
    "ESCALATED": {"ESCALATED"},
}

VERIFICATION_REPORT_MARKERS = [
    "acceptance_criteria_mapping",
    "files_inspected",
    "validation_or_reason_not_run",
    "regression_risks",
    "scope_violation_check",
    "forbidden_files_check",
    "recommendation",
    "acceptance_criteria_checked",
    "tests_or_reason_present",
    "forbidden_files_checked",
    "risks_recorded",
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


def clean_scalar(value: str) -> str:
    value = value.strip()
    if value in {"", "null", "None"}:
        return ""
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
        return value[1:-1]
    return value


def parse_task_queue() -> list[dict[str, str]]:
    tasks: list[dict[str, str]] = []
    current: dict[str, str] | None = None
    for line in read_text(".ai/TASK_QUEUE.yaml").splitlines():
        task_match = re.match(r"\s{2}- task_id:\s*(.+?)\s*$", line)
        if task_match:
            if current is not None:
                tasks.append(current)
            current = {"task_id": clean_scalar(task_match.group(1))}
            continue
        if current is None:
            continue
        field_match = re.match(r"\s{4}([a-z_]+):\s*(.*?)\s*$", line)
        if field_match:
            current[field_match.group(1)] = clean_scalar(field_match.group(2))
    if current is not None:
        tasks.append(current)
    return tasks


def parse_simple_fields(path: str, fields: set[str]) -> dict[str, str]:
    values: dict[str, str] = {}
    for line in read_text(path).splitlines():
        match = re.match(rf"^({'|'.join(re.escape(field) for field in fields)}):\s*(.*?)\s*$", line)
        if match:
            values[match.group(1)] = clean_scalar(match.group(2))
    return values


def parse_current_work_package_from_ledger() -> dict[str, str]:
    values: dict[str, str] = {}
    in_current = False
    for line in read_text(".ai/MASTER_LEDGER.yaml").splitlines():
        if re.match(r"^current_work_package:\s*$", line):
            in_current = True
            continue
        if in_current and line and not line.startswith("  "):
            break
        if in_current:
            match = re.match(r"\s{2}([a-z_]+):\s*(.*?)\s*$", line)
            if match:
                values[match.group(1)] = clean_scalar(match.group(2))
    state_match = re.search(r"(?m)^current_state_machine_state:\s*(.*?)\s*$", read_text(".ai/MASTER_LEDGER.yaml"))
    if state_match:
        values["current_state_machine_state"] = clean_scalar(state_match.group(1))
    return values


def extract_table_task_ids(path: str) -> set[str]:
    task_ids: set[str] = set()
    for line in read_text(path).splitlines():
        if not line.startswith("|"):
            continue
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        for cell in cells:
            if re.fullmatch(r"WP-\d{4}[-a-z0-9]*", cell):
                task_ids.add(cell)
    return task_ids


def parse_skill_frontmatter(path: str) -> tuple[dict[str, str], list[str]]:
    text = read_text(path)
    errors = []
    match = re.match(r"\A---\n(.*?)\n---\n", text, re.DOTALL)
    if not match:
        return {}, ["missing opening YAML frontmatter block"]

    metadata: dict[str, str] = {}
    for line_number, line in enumerate(match.group(1).splitlines(), start=2):
        if not line.strip():
            continue
        field_match = re.match(r"^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*?)\s*$", line)
        if not field_match:
            errors.append(f"line {line_number}: invalid metadata line")
            continue
        key, raw_value = field_match.groups()
        value = clean_scalar(raw_value)
        is_quoted = (
            len(raw_value) >= 2
            and raw_value[0] == raw_value[-1]
            and raw_value[0] in {'"', "'"}
        )
        if ": " in raw_value and not is_quoted:
            errors.append(f"line {line_number}: quote metadata values containing ': '")
        if key in metadata:
            errors.append(f"line {line_number}: duplicate metadata key {key}")
        metadata[key] = value
    return metadata, errors


def check_required_files() -> CheckResult:
    missing = [path for path in CORE_FILES if not file_exists(path)]
    return CheckResult(
        "required scaffold files",
        not missing,
        "all required scaffold files exist" if not missing else f"missing: {', '.join(missing)}",
    )


def check_direction_guide_skill_metadata() -> CheckResult:
    metadata, errors = parse_skill_frontmatter(".agents/skills/direction-guide/SKILL.md")
    required = {"name", "description"}
    missing = sorted(field for field in required if not metadata.get(field))
    if missing:
        errors.append("missing required metadata: " + ", ".join(missing))
    if metadata.get("name") != "direction-guide":
        errors.append(f"name is {metadata.get('name') or '<missing>'}, expected direction-guide")
    ok = not errors
    return CheckResult(
        "direction-guide skill metadata",
        ok,
        "SKILL.md frontmatter is parseable and includes direction-guide name and description"
        if ok
        else "invalid SKILL.md metadata: " + " | ".join(errors),
    )


def check_approved_root_doc_pruning() -> CheckResult:
    present = [path for path in APPROVED_PRUNED_ROOT_DOCS if file_exists(path)]
    referenced = []
    for active_doc in ACTIVE_ROOT_DOCS:
        text = read_text(active_doc)
        for pruned_doc in APPROVED_PRUNED_ROOT_DOCS:
            if pruned_doc in text:
                referenced.append(f"{active_doc}:{pruned_doc}")
    ok = not present and not referenced
    return CheckResult(
        "approved root-doc pruning",
        ok,
        "approved root guide deletions are absent and active docs no longer point to them"
        if ok
        else f"root-doc pruning drift; present: {', '.join(present) or 'none'}; referenced: {', '.join(referenced) or 'none'}",
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


def check_verification_evidence_paths() -> CheckResult:
    missing = []
    incomplete = []
    for task in parse_task_queue():
        if task.get("status") not in VERIFICATION_EVIDENCE_STATUSES:
            continue
        task_id = task.get("task_id", "<unknown>")
        report_path = task.get("verifier_report_path", "")
        if not report_path:
            missing.append(f"{task_id}: verifier_report_path")
            continue
        if not file_exists(report_path):
            missing.append(f"{task_id}: {report_path}")
            continue
        text = read_text(report_path)
        missing_markers = [marker for marker in VERIFICATION_REPORT_MARKERS if marker not in text]
        if task_id not in text:
            missing_markers.append("task_id")
        if missing_markers:
            incomplete.append(f"{task_id}: {report_path} missing {', '.join(missing_markers)}")
    ok = not missing and not incomplete
    return CheckResult(
        "durable verification evidence paths",
        ok,
        "accepted/verified queue items link to durable verification evidence with required gate markers"
        if ok
        else f"verification evidence drift; missing paths: {', '.join(missing) or 'none'}; incomplete reports: {' | '.join(incomplete) or 'none'}",
    )


def check_status_consistency() -> CheckResult:
    tasks = parse_task_queue()
    by_id = {task.get("task_id", ""): task for task in tasks}
    errors = []
    duplicate_ids = sorted({task.get("task_id", "") for task in tasks if [item.get("task_id", "") for item in tasks].count(task.get("task_id", "")) > 1})
    if duplicate_ids:
        errors.append(f"duplicate queue ids: {', '.join(duplicate_ids)}")

    project_accepted = extract_table_task_ids(".ai/PROJECT_STATE.md")
    integration_logged = extract_table_task_ids(".ai/INTEGRATION_LOG.md")

    for task_id, task in by_id.items():
        status = task.get("status", "")
        wp_path = task.get("work_package_path", "")
        if wp_path:
            if not file_exists(wp_path):
                errors.append(f"{task_id}: work_package_path missing {wp_path}")
            else:
                wp_fields = parse_simple_fields(wp_path, {"task_id", "status"})
                if wp_fields.get("task_id") != task_id:
                    errors.append(f"{task_id}: work package task_id is {wp_fields.get('task_id') or '<missing>'}")
                wp_status = wp_fields.get("status")
                if status in VERIFICATION_EVIDENCE_STATUSES and wp_status != status:
                    errors.append(f"{task_id}: queue status {status} != work package status {wp_status or '<missing>'}")
        if status in FINISHED_STATUSES:
            if task_id not in project_accepted:
                errors.append(f"{task_id}: finished in queue but missing from PROJECT_STATE recent accepted changes")
            if task_id not in integration_logged:
                errors.append(f"{task_id}: finished in queue but missing from INTEGRATION_LOG")
        if status not in FINISHED_STATUSES and task_id in project_accepted:
            errors.append(f"{task_id}: PROJECT_STATE lists accepted but queue status is {status}")
        if status not in FINISHED_STATUSES and task_id in integration_logged:
            errors.append(f"{task_id}: INTEGRATION_LOG lists accepted but queue status is {status}")

    for task_id in sorted(project_accepted | integration_logged):
        if task_id and task_id not in by_id:
            errors.append(f"{task_id}: listed in project/integration history but missing from queue")

    ledger = parse_current_work_package_from_ledger()
    current_id = ledger.get("task_id", "")
    current_status = ledger.get("status", "")
    current_state = ledger.get("current_state_machine_state", "")
    if current_id:
        queue_task = by_id.get(current_id)
        if queue_task is None:
            errors.append(f"ledger current work package {current_id} missing from queue")
        else:
            if queue_task.get("status") != current_status:
                errors.append(f"{current_id}: ledger status {current_status} != queue status {queue_task.get('status')}")
            if current_state in CURRENT_STATE_TO_STATUS and current_status not in CURRENT_STATE_TO_STATUS[current_state]:
                allowed = ", ".join(sorted(CURRENT_STATE_TO_STATUS[current_state]))
                errors.append(f"{current_id}: ledger state {current_state} incompatible with status {current_status}; expected one of {allowed}")

    ok = not errors
    return CheckResult(
        "status consistency",
        ok,
        "queue, work package files, project state, integration log, and ledger statuses agree"
        if ok
        else "status drift: " + " | ".join(errors),
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
        check_direction_guide_skill_metadata(),
        check_approved_root_doc_pruning(),
        check_baseline_agents(),
        check_max_depth(),
        check_bounded_recursive_delegation(),
        check_guarded_parallel_policy(),
        check_context_packet_requirement(),
        check_packet_fields(),
        check_recursive_packet_fields(),
        check_report_fields(),
        check_verifier_gate(),
        check_verification_evidence_paths(),
        check_status_consistency(),
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
