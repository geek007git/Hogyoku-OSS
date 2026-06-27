#!/usr/bin/env python3
"""Lint RAG answer records for unsupported-answer behavior."""

from __future__ import annotations

import argparse
import re
from pathlib import Path

from hogyoku_guardrails.common import Finding, load_jsonl, print_findings


UNCERTAINTY_TERMS = re.compile(r"\b(not enough|insufficient|cannot find|not supported|unclear)\b", re.I)


def lint_answers(path: Path) -> list[Finding]:
    findings: list[Finding] = []
    for line_number, row in enumerate(load_jsonl(path), start=1):
        answer = str(row.get("answer", ""))
        citations = row.get("citations", [])
        verification = row.get("verification", {})
        supported = bool(verification.get("supported", False))
        score = float(verification.get("score", 0))
        if supported and score < 70:
            findings.append(
                Finding("high", "SUPPORTED_LOW_SCORE", "Supported answer has verification score below 70.", str(path), line_number)
            )
        if not supported and not UNCERTAINTY_TERMS.search(answer):
            findings.append(
                Finding("high", "UNSUPPORTED_NO_REFUSAL", "Unsupported answer does not clearly refuse or caveat.", str(path), line_number)
            )
        if supported and not citations:
            findings.append(
                Finding("high", "SUPPORTED_NO_CITATIONS", "Supported answer has no citations.", str(path), line_number)
            )
        if len(answer) > 5_000:
            findings.append(
                Finding("medium", "ANSWER_TOO_LONG", "Answer may exceed reviewable citation context.", str(path), line_number)
            )
    return findings


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("answers", type=Path)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    return print_findings(lint_answers(args.answers), json_output=args.json)


if __name__ == "__main__":
    raise SystemExit(main())
