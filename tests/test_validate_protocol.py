from __future__ import annotations

from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS))

import validate_protocol  # noqa: E402
import protocol_gate  # noqa: E402


class ValidateProtocolNegativeTests(unittest.TestCase):
    def test_export_runtime_bundle_reports_missing_required_file(self) -> None:
        missing_path = "scripts/protocol_gate.py"
        synthetic_existing_paths = [
            path
            for path in validate_protocol.EXPORT_RUNTIME_BUNDLE_FILES
            if path != missing_path
        ]

        result = validate_protocol.check_required_export_runtime_bundle_files(
            synthetic_existing_paths
        )

        self.assertFalse(result.ok)
        self.assertIn("missing export runtime bundle files", result.message)
        self.assertIn(missing_path, result.message)

    def test_malformed_skill_metadata_fixture_fails(self) -> None:
        result = validate_protocol.check_skill_metadata(
            "tests/fixtures/bad_skill_metadata/SKILL.md",
            "bad-skill-metadata",
        )

        self.assertFalse(result.ok)
        self.assertIn("invalid", result.message)
        self.assertIn("duplicate metadata key", result.message)
        self.assertIn("missing required metadata: description", result.message)

    def test_report_with_unreplayable_path_fails_gate(self) -> None:
        result = validate_protocol.check_report_gate(
            "tests/fixtures/report_missing_paths/report.md"
        )

        self.assertFalse(result.ok)
        self.assertIn("unreplayable report paths", result.message)
        self.assertIn("does not exist", result.message)

    def test_secret_scan_fixture_reports_label_without_value(self) -> None:
        fixture = ROOT / "tests/fixtures/secrets/scaffold_secret.txt"
        result = validate_protocol.check_lightweight_secret_scan([fixture])

        self.assertFalse(result.ok)
        self.assertIn("assigned secret", result.message)
        self.assertNotIn("FAKE_FAKE_FAKE_FAKE_FAKE_TOKEN_12345", result.message)

    def test_protocol_gate_check_report_fails_for_bad_fixture(self) -> None:
        completed = subprocess.run(
            [
                sys.executable,
                "-B",
                "scripts/protocol_gate.py",
                "check-report",
                "tests/fixtures/report_missing_paths/report.md",
            ],
            cwd=ROOT,
            check=False,
            capture_output=True,
            text=True,
        )

        self.assertNotEqual(completed.returncode, 0)
        self.assertIn("FAIL report gate", completed.stdout)
        self.assertIn("protocol gate check(s) failed", completed.stderr)

    def test_protocol_gate_pre_accept_rejects_wrong_task_report(self) -> None:
        completed = subprocess.run(
            [
                sys.executable,
                "-B",
                "scripts/protocol_gate.py",
                "pre-accept",
                "WP-0019-review-plan-closure",
                "--report",
                "tests/fixtures/wrong_task_report/report.md",
            ],
            cwd=ROOT,
            check=False,
            capture_output=True,
            text=True,
        )

        output = completed.stdout + completed.stderr
        self.assertNotEqual(completed.returncode, 0)
        self.assertIn("task_id", output)
        self.assertIn("WP-0019-review-plan-closure", output)

    def test_report_gate_rejects_failing_report_even_with_markers(self) -> None:
        result = validate_protocol.check_report_gate(
            "tests/fixtures/failing_report_with_markers/report.md"
        )

        self.assertFalse(result.ok)
        self.assertIn("FAIL", result.message)
        self.assertIn("recommendation", result.message)

    def test_work_package_gate_rejects_shallow_fixture(self) -> None:
        fixture = ROOT / "tests/fixtures/shallow_work_package.yaml"
        with patch.object(protocol_gate, "work_package_path", return_value=fixture):
            results = protocol_gate.work_package_check(
                "WP-TEST-shallow-work-package",
                protocol_gate.IMPLEMENTABLE_STATUSES,
            )

        self.assertEqual(1, len(results))
        self.assertFalse(results[0].ok)
        self.assertIn("fallback_verification", results[0].message)
        self.assertIn("execution_budget", results[0].message)

    def test_stale_done_ledger_fixture_fails_done_closure(self) -> None:
        fixture = ROOT / "tests/fixtures/stale_done_ledger.yaml"

        result = validate_protocol.check_ledger_done_closure(
            fixture.read_text(encoding="utf-8")
        )

        self.assertFalse(result.ok)
        self.assertIn("active_agent_runs", result.message)
        self.assertIn("active_parallel_batch", result.message)
        self.assertIn("file_reservations", result.message)
        self.assertIn("worktree_assignments", result.message)
        self.assertIn("effective_parallel_write_agents", result.message)
        self.assertIn("null per-work-package metrics", result.message)

    def test_current_ledger_done_closure_check_passes(self) -> None:
        result = validate_protocol.check_ledger_done_closure()

        self.assertTrue(result.ok, result.message)

    def test_child_write_lease_policy_check_detects_missing_marker(self) -> None:
        documents = {
            path: "write_lease_id leased_files lease_owner_agent_run_id parent_write_state paused_for_leased_files returned or revoked child_write_leases Child Write Lease Check parent pause leased_files"
            for path, _pattern in validate_protocol.CHILD_WRITE_LEASE_REQUIREMENTS
        }
        documents[".codex/agents/implementer.toml"] = documents[
            ".codex/agents/implementer.toml"
        ].replace("write_lease_id", "")

        result = validate_protocol.check_child_write_lease_policy(documents)

        self.assertFalse(result.ok)
        self.assertIn("child write lease policy drift", result.message)
        self.assertIn(".codex/agents/implementer.toml", result.message)

    def test_child_write_lease_policy_check_passes_current_docs(self) -> None:
        result = validate_protocol.check_child_write_lease_policy()

        self.assertTrue(result.ok, result.message)

    def test_work_package_path_coverage_rejects_unregistered_missing_path(self) -> None:
        result = validate_protocol.check_work_package_path_coverage(
            [
                {
                    "task_id": "WP-9999-unregistered-missing-work-package",
                    "status": "ACCEPTED",
                    "work_package_path": "",
                    "verifier_report_path": validate_protocol.HISTORICAL_EVIDENCE_PATH,
                }
            ]
        )

        self.assertFalse(result.ok)
        self.assertIn("WP-9999-unregistered-missing-work-package", result.message)
        self.assertIn("without registered historical exception", result.message)

    def test_historical_work_package_exception_requires_historical_report(self) -> None:
        result = validate_protocol.check_work_package_path_coverage(
            [
                {
                    "task_id": "WP-0001-repo-memory-specificity",
                    "status": "ACCEPTED",
                    "work_package_path": "",
                    "verifier_report_path": ".ai/AGENT_REPORTS/WP-0019-verifier.md",
                },
                {
                    "task_id": "WP-0002-clean-bootstrap-placeholders",
                    "status": "ACCEPTED",
                    "work_package_path": "",
                    "verifier_report_path": validate_protocol.HISTORICAL_EVIDENCE_PATH,
                },
                {
                    "task_id": "WP-0003-master-control-modules",
                    "status": "ACCEPTED",
                    "work_package_path": "",
                    "verifier_report_path": validate_protocol.HISTORICAL_EVIDENCE_PATH,
                },
                {
                    "task_id": "WP-0008-routing-matrix",
                    "status": "ACCEPTED",
                    "work_package_path": "",
                    "verifier_report_path": validate_protocol.HISTORICAL_EVIDENCE_PATH,
                },
            ]
        )

        self.assertFalse(result.ok)
        self.assertIn("WP-0001-repo-memory-specificity", result.message)
        self.assertIn(validate_protocol.HISTORICAL_EVIDENCE_PATH, result.message)

    def test_current_work_package_path_coverage_check_passes(self) -> None:
        result = validate_protocol.check_work_package_path_coverage()

        self.assertTrue(result.ok, result.message)

    def test_report_gate_rejects_bare_missing_repo_path(self) -> None:
        result = validate_protocol.check_report_gate(
            "tests/fixtures/report_bare_missing_path/report.md"
        )

        self.assertFalse(result.ok)
        self.assertIn("does-not-exist.md", result.message)
        self.assertIn("does not exist", result.message)

    def test_report_path_candidates_ignore_spaced_external_markers(self) -> None:
        candidates = validate_protocol.extract_report_path_candidates(
            "external: docs/missing.md\n"
            "runtime: logs/missing.txt\n"
            "user: notes/missing.md\n"
            "generated: artifacts/missing.json\n"
            "not_applicable: nowhere/missing.yaml\n"
            "plain/missing.md\n"
        )

        self.assertEqual(["plain/missing.md"], candidates)

    def test_report_gate_rejects_missing_common_report_fields(self) -> None:
        result = validate_protocol.check_report_gate(
            "tests/fixtures/report_missing_common_fields/report.md"
        )

        self.assertFalse(result.ok)
        self.assertIn("missing report fields", result.message)
        self.assertIn("commands_run", result.message)
        self.assertIn("child_agent_requests", result.message)

    def test_known_verifier_report_passes_gate(self) -> None:
        result = validate_protocol.check_report_gate(
            ".ai/AGENT_REPORTS/WP-0018-verifier.md"
        )

        self.assertTrue(result.ok, result.message)

    def test_protocol_gate_pre_accept_passes_for_known_good_verifier_report(self) -> None:
        completed = subprocess.run(
            [
                sys.executable,
                "-B",
                "scripts/protocol_gate.py",
                "pre-accept",
                "WP-0019-review-plan-closure",
                "--report",
                ".ai/AGENT_REPORTS/WP-0019-verifier.md",
            ],
            cwd=ROOT,
            check=False,
            capture_output=True,
            text=True,
        )

        self.assertEqual(0, completed.returncode, completed.stdout + completed.stderr)
        self.assertIn(
            "Pre-accept gate passed for WP-0019-review-plan-closure",
            completed.stdout,
        )


if __name__ == "__main__":
    unittest.main()
