#!/usr/bin/env python3
"""Score retrieval output using recall@k and mean reciprocal rank."""

from __future__ import annotations

import argparse
import json
import statistics
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


@dataclass(frozen=True)
class EvaluationCase:
    question: str
    relevant_ids: frozenset[str]
    retrieved_ids: tuple[str, ...]


def load_cases(path: Path) -> list[EvaluationCase]:
    cases: list[EvaluationCase] = []
    with path.open("r", encoding="utf-8") as handle:
        for line_number, raw_line in enumerate(handle, start=1):
            if not raw_line.strip():
                continue
            try:
                row = json.loads(raw_line)
                cases.append(
                    EvaluationCase(
                        question=str(row["question"]),
                        relevant_ids=frozenset(map(str, row["relevant_ids"])),
                        retrieved_ids=tuple(map(str, row["retrieved_ids"])),
                    )
                )
            except (KeyError, TypeError, json.JSONDecodeError) as error:
                raise ValueError(f"Invalid JSONL at line {line_number}: {error}") from error
    if not cases:
        raise ValueError("Evaluation dataset is empty")
    return cases


def recall_at_k(case: EvaluationCase, k: int) -> float:
    if not case.relevant_ids:
        return 1.0
    found = case.relevant_ids.intersection(case.retrieved_ids[:k])
    return len(found) / len(case.relevant_ids)


def reciprocal_rank(case: EvaluationCase) -> float:
    for rank, chunk_id in enumerate(case.retrieved_ids, start=1):
        if chunk_id in case.relevant_ids:
            return 1.0 / rank
    return 0.0


def mean(values: Iterable[float]) -> float:
    return statistics.fmean(values)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("dataset", type=Path, help="JSONL retrieval results")
    parser.add_argument(
        "--k",
        type=int,
        nargs="+",
        default=[1, 3, 5, 10],
        help="Recall cutoffs",
    )
    args = parser.parse_args()

    try:
        cases = load_cases(args.dataset)
    except (OSError, ValueError) as error:
        print(error, file=sys.stderr)
        return 1

    print(f"Dataset: {args.dataset}")
    print(f"Questions: {len(cases)}")
    for k in sorted(set(args.k)):
        if k < 1:
            print("Recall cutoffs must be positive.", file=sys.stderr)
            return 1
        score = mean(recall_at_k(case, k) for case in cases)
        print(f"Recall@{k}: {score:.3f}")
    print(f"MRR: {mean(reciprocal_rank(case) for case in cases):.3f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
