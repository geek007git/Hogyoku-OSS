#!/usr/bin/env python3
"""Check whether cited answer claims are lexically supported by evidence."""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from pathlib import Path

from hogyoku_guardrails.common import Finding, load_jsonl, print_findings


WORD = re.compile(r"[a-z0-9]{3,}")
STOPWORDS = {
    "the",
    "and",
    "for",
    "with",
    "that",
    "this",
    "from",
    "into",
    "when",
    "where",
    "should",
    "would",
    "could",
}


@dataclass(frozen=True)
class AuditCase:
    answer_id: str
    answer: str
    evidence: dict[str, str]


def tokens(text: str) -> set[str]:
    return {token for token in WORD.findall(text.lower()) if token not in STOPWORDS}


def split_claims(answer: str) -> list[str]:
    return [claim.strip() for claim in re.split(r"(?<=[.!?])\s+", answer) if claim.strip()]


def citation_ids(claim: str) -> list[str]:
    return re.findall(r"\[(\d+)\]", claim)


def load_cases(path: Path) -> list[AuditCase]:
    cases = []
    for row in load_jsonl(path):
        cases.append(
            AuditCase(
                answer_id=str(row.get("answer_id", "unknown")),
                answer=str(row["answer"]),
                evidence={str(key): str(value) for key, value in row["evidence"].items()},
            )
        )
    return cases


def audit_case(case: AuditCase, min_overlap: float) -> list[Finding]:
    findings: list[Finding] = []
    for claim_index, claim in enumerate(split_claims(case.answer), start=1):
        ids = citation_ids(claim)
        if not ids:
            findings.append(
                Finding(
                    severity="high",
                    code="MISSING_CITATION",
                    message=f"Claim {claim_index} has no citation.",
                    path=case.answer_id,
                )
            )
            continue
        claim_tokens = tokens(re.sub(r"\[\d+\]", "", claim))
        cited_text = " ".join(case.evidence.get(citation_id, "") for citation_id in ids)
        if not cited_text:
            findings.append(
                Finding(
                    severity="high",
                    code="UNKNOWN_CITATION",
                    message=f"Claim {claim_index} cites missing evidence ids {ids}.",
                    path=case.answer_id,
                )
            )
            continue
        evidence_tokens = tokens(cited_text)
        overlap = len(claim_tokens.intersection(evidence_tokens)) / max(len(claim_tokens), 1)
        if overlap < min_overlap:
            findings.append(
                Finding(
                    severity="medium",
                    code="LOW_EVIDENCE_OVERLAP",
                    message=f"Claim {claim_index} has {overlap:.2f} token overlap with cited evidence.",
                    path=case.answer_id,
                )
            )
    return findings


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("dataset", type=Path)
    parser.add_argument("--min-overlap", type=float, default=0.35)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    findings: list[Finding] = []
    for case in load_cases(args.dataset):
        findings.extend(audit_case(case, args.min_overlap))
    return print_findings(findings, json_output=args.json)


if __name__ == "__main__":
    raise SystemExit(main())
