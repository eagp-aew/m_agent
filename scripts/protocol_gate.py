#!/usr/bin/env python3
"""No-dependency protocol gate commands for the Codex scaffold."""

from __future__ import annotations

import argparse
from pathlib import Path
import sys

import validate_protocol


ROOT = validate_protocol.ROOT

IMPLEMENTABLE_STATUSES = {"READY", "ASSIGNED", "IMPLEMENTED"}
ACCEPTABLE_STATUSES = {"IMPLEMENTED", "VERIFIED", "INTEGRATED", "ACCEPTED", "DONE"}

WORK_PACKAGE_REQUIRED_MARKERS = [
    "objective:",
    "scope_type:",
    "provenance:",
    "risk_class:",
    "fallback_verification:",
    "execution_budget:",
    "allowed_files:",
    "forbidden_files:",
    "acceptance_criteria:",
    "validation_commands:",
    "human_approval_required:",
]

WORK_PACKAGE_NESTED_MARKERS = {
    "provenance": ["created_at:", "created_by:", "source:", "trust_level:"],
    "fallback_verification": ["allowed:", "reason:"],
    "execution_budget": ["max_steps:", "max_tool_calls:", "trace_path:", "cancellation:"],
    "human_approval_required": ["required:", "reason:"],
}


def task_queue_entry(task_id: str) -> dict[str, str] | None:
    for task in validate_protocol.parse_task_queue():
        if task.get("task_id") == task_id:
            return task
    return None


def default_work_package_path(task_id: str) -> str:
    return f".ai/WORK_PACKAGES/{task_id}.yaml"


def work_package_path(task_id: str) -> Path:
    task = task_queue_entry(task_id)
    path = task.get("work_package_path") if task else ""
    return (ROOT / (path or default_work_package_path(task_id))).resolve()


def work_package_check(task_id: str, allowed_statuses: set[str]) -> list[validate_protocol.CheckResult]:
    path = work_package_path(task_id)
    if not validate_protocol.is_under_root(path):
        return [validate_protocol.CheckResult("work package", False, f"{path} escapes repository")]
    if not path.is_file():
        return [
            validate_protocol.CheckResult(
                "work package",
                False,
                f"{validate_protocol.display_path(path)} does not exist",
            )
        ]

    rel_path = validate_protocol.rel(path)
    fields = validate_protocol.parse_simple_fields(rel_path, {"task_id", "status"})
    text = path.read_text(encoding="utf-8")
    errors = []
    if fields.get("task_id") != task_id:
        errors.append(f"task_id is {fields.get('task_id') or '<missing>'}")
    status = fields.get("status", "")
    if status not in allowed_statuses:
        expected = ", ".join(sorted(allowed_statuses))
        errors.append(f"status is {status or '<missing>'}; expected one of {expected}")
    for marker in WORK_PACKAGE_REQUIRED_MARKERS:
        if marker not in text:
            errors.append(f"missing {marker.rstrip(':')}")
    for section, markers in WORK_PACKAGE_NESTED_MARKERS.items():
        for marker in markers:
            if marker not in text:
                errors.append(f"missing {section}.{marker.rstrip(':')}")

    return [
        validate_protocol.CheckResult(
            "work package",
            not errors,
            f"{rel_path} is present with task_id, status, scope, approval, fallback, budget, risk, acceptance, and validation fields"
            if not errors
            else f"{rel_path} failed work-package gate: " + " | ".join(errors),
        )
    ]


def verifier_report_path(task_id: str, explicit_path: str | None) -> Path:
    if explicit_path:
        path = Path(explicit_path)
        return path if path.is_absolute() else (ROOT / path).resolve()
    task = task_queue_entry(task_id)
    if task and task.get("verifier_report_path"):
        return (ROOT / task["verifier_report_path"]).resolve()
    return (ROOT / f".ai/AGENT_REPORTS/{task_id}-verifier.md").resolve()


def run_gate(results: list[validate_protocol.CheckResult], success: str) -> int:
    printed = validate_protocol.print_results(results)
    failed = [result for result in printed if not result.ok]
    if failed:
        print(f"\n{len(failed)} protocol gate check(s) failed.", file=sys.stderr)
        return 1
    print(f"\n{success}")
    return 0


def audit(_: argparse.Namespace) -> int:
    return run_gate(
        validate_protocol.run_checks(),
        "Protocol audit passed.",
    )


def pre_implement(args: argparse.Namespace) -> int:
    results = validate_protocol.run_checks()
    results.extend(work_package_check(args.task_id, IMPLEMENTABLE_STATUSES))
    return run_gate(results, f"Pre-implement gate passed for {args.task_id}.")


def pre_accept(args: argparse.Namespace) -> int:
    results = validate_protocol.run_checks()
    results.extend(work_package_check(args.task_id, ACCEPTABLE_STATUSES))
    results.append(
        validate_protocol.check_report_gate(
            verifier_report_path(args.task_id, args.report),
            expected_task_id=args.task_id,
        )
    )
    return run_gate(results, f"Pre-accept gate passed for {args.task_id}.")


def check_report(args: argparse.Namespace) -> int:
    return run_gate(
        [validate_protocol.check_report_gate(args.report)],
        f"Report gate passed for {args.report}.",
    )


def parser() -> argparse.ArgumentParser:
    command_parser = argparse.ArgumentParser(
        description="Run read-only protocol gates for the Codex scaffold."
    )
    subparsers = command_parser.add_subparsers(dest="command", required=True)

    audit_parser = subparsers.add_parser("audit", help="run the full protocol validator")
    audit_parser.set_defaults(func=audit)

    pre_implement_parser = subparsers.add_parser(
        "pre-implement",
        help="run validator checks and confirm a work package is implementable",
    )
    pre_implement_parser.add_argument("task_id")
    pre_implement_parser.set_defaults(func=pre_implement)

    pre_accept_parser = subparsers.add_parser(
        "pre-accept",
        help="run validator checks, work-package checks, and verifier report checks",
    )
    pre_accept_parser.add_argument("task_id")
    pre_accept_parser.add_argument("--report", help="override verifier report path")
    pre_accept_parser.set_defaults(func=pre_accept)

    report_parser = subparsers.add_parser(
        "check-report",
        help="check one report for required fields, gate markers, and replayable paths",
    )
    report_parser.add_argument("report")
    report_parser.set_defaults(func=check_report)
    return command_parser


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
