#!/usr/bin/env python3
"""Analyze chunk size, overlap, and duplication quality for RAG corpora."""

from __future__ import annotations

import argparse
import json
import statistics
from pathlib import Path

from hogyoku_guardrails.common import Finding, load_jsonl, print_findings


def load_chunks(path: Path) -> list[dict[str, object]]:
    return load_jsonl(path)


def audit_chunks(path: Path, min_chars: int, max_chars: int) -> tuple[list[Finding], dict[str, float]]:
    chunks = load_chunks(path)
    findings: list[Finding] = []
    lengths = [len(str(chunk.get("content", ""))) for chunk in chunks]
    hashes: dict[str, int] = {}
    for index, chunk in enumerate(chunks, start=1):
        content = str(chunk.get("content", ""))
        if len(content) < min_chars:
            findings.append(
                Finding("medium", "SHORT_CHUNK", f"Chunk has {len(content)} chars.", str(path), index)
            )
        if len(content) > max_chars:
            findings.append(
                Finding("medium", "LONG_CHUNK", f"Chunk has {len(content)} chars.", str(path), index)
            )
        content_hash = str(chunk.get("content_hash") or hash(content))
        hashes[content_hash] = hashes.get(content_hash, 0) + 1
    duplicate_count = sum(count - 1 for count in hashes.values() if count > 1)
    if duplicate_count:
        findings.append(
            Finding("high", "DUPLICATE_CHUNKS", f"{duplicate_count} duplicate chunks detected.", str(path))
        )
    metrics = {
        "chunks": float(len(chunks)),
        "min_chars": float(min(lengths or [0])),
        "max_chars": float(max(lengths or [0])),
        "mean_chars": float(statistics.fmean(lengths or [0])),
        "duplicates": float(duplicate_count),
    }
    return findings, metrics


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("chunks", type=Path)
    parser.add_argument("--min-chars", type=int, default=160)
    parser.add_argument("--max-chars", type=int, default=1_800)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    findings, metrics = audit_chunks(args.chunks, args.min_chars, args.max_chars)
    if args.json:
        print(json.dumps({"metrics": metrics, "findings": [item.as_dict() for item in findings]}, indent=2))
        return 1 if any(item.severity == "high" for item in findings) else 0
    print("Chunk metrics:")
    for key, value in metrics.items():
        print(f"  {key}: {value:.1f}")
    return print_findings(findings)


if __name__ == "__main__":
    raise SystemExit(main())
