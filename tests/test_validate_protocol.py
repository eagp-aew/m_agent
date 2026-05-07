from __future__ import annotations

from pathlib import Path
import subprocess
import sys
import unittest


ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS))

import validate_protocol  # noqa: E402


class ValidateProtocolNegativeTests(unittest.TestCase):
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

    def test_known_verifier_report_passes_gate(self) -> None:
        result = validate_protocol.check_report_gate(
            ".ai/AGENT_REPORTS/WP-0018-verifier.md"
        )

        self.assertTrue(result.ok, result.message)


if __name__ == "__main__":
    unittest.main()
