#!/usr/bin/env python3
"""Run all offline Hogyoku Python guardrails."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "python"))

from hogyoku_guardrails import (  # noqa: E402
    chunk_audit,
    citation_audit,
    rag_lint,
    security_report,
    security_scan,
)


def main() -> int:
    checks = [
        lambda: security_scan.print_findings(security_scan.scan_repo(ROOT)),
        lambda: citation_audit.print_findings(
            [
                finding
                for case in citation_audit.load_cases(ROOT / "evaluations/answers.example.jsonl")
                for finding in citation_audit.audit_case(case, min_overlap=0.35)
            ]
        ),
        lambda: chunk_audit.print_findings(
            chunk_audit.audit_chunks(
                ROOT / "evaluations/chunks.example.jsonl",
                min_chars=80,
                max_chars=1_800,
            )[0]
        ),
        lambda: rag_lint.print_findings(
            rag_lint.lint_answers(ROOT / "evaluations/rag_answers.example.jsonl")
        ),
        lambda: 0
        if security_report.build_report(ROOT)["score"] >= 85
        else 1,
    ]
    status = 0
    for check in checks:
        status = max(status, check())
    return status


if __name__ == "__main__":
    raise SystemExit(main())
