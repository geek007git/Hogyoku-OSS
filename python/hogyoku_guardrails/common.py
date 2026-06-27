from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable


@dataclass(frozen=True)
class Finding:
    severity: str
    code: str
    message: str
    path: str
    line: int | None = None

    def as_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "severity": self.severity,
            "code": self.code,
            "message": self.message,
            "path": self.path,
        }
        if self.line is not None:
            payload["line"] = self.line
        return payload


def iter_text_files(root: Path, skip_dirs: set[str] | None = None) -> Iterable[Path]:
    skip_dirs = skip_dirs or {".git", "node_modules", "dist", ".terraform", "target"}
    for path in root.rglob("*"):
        if any(part in skip_dirs for part in path.parts):
            continue
        if path.is_file() and is_text_like(path):
            yield path


def is_text_like(path: Path) -> bool:
    if path.suffix.lower() in {
        ".ts",
        ".js",
        ".json",
        ".md",
        ".yml",
        ".yaml",
        ".tf",
        ".py",
        ".rs",
        ".toml",
        ".sql",
        ".html",
        ".css",
        ".sh",
        ".nix",
        ".ini",
        ".cfg",
        ".example",
        ".txt",
        ".jsonl",
        ".dockerignore",
        ".gitignore",
        ".gitattributes",
    }:
        return True
    return path.name in {"Dockerfile", "LICENSE"}


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as handle:
        for line_number, raw in enumerate(handle, start=1):
            if not raw.strip():
                continue
            try:
                rows.append(json.loads(raw))
            except json.JSONDecodeError as error:
                raise ValueError(f"{path}:{line_number}: invalid JSONL: {error}") from error
    return rows


def print_findings(findings: list[Finding], json_output: bool = False) -> int:
    if json_output:
        print(json.dumps([finding.as_dict() for finding in findings], indent=2))
    else:
        if not findings:
            print("No findings.")
        for finding in findings:
            location = finding.path if finding.line is None else f"{finding.path}:{finding.line}"
            print(f"[{finding.severity}] {finding.code} {location} - {finding.message}")
    return 1 if any(finding.severity in {"critical", "high"} for finding in findings) else 0
