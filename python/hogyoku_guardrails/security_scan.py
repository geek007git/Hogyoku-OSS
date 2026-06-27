#!/usr/bin/env python3
"""Offline secret and deployment-risk scanner for the Hogyoku repository."""

from __future__ import annotations

import argparse
import re
from pathlib import Path

from hogyoku_guardrails.common import Finding, iter_text_files, print_findings


SECRET_PATTERNS = [
    ("AWS_ACCESS_KEY", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("AWS_SECRET_KEY", re.compile(r"(?i)\baws(.{0,20})?(secret|private).{0,20}[:=]\s*['\"]?[A-Za-z0-9/+=]{35,}")),
    ("HOSTED_POSTGRES_URL", re.compile(r"postgres(?:ql)?://[^:\s]+:[^@\s]+@(?!localhost|postgres)[^/\s]+")),
    ("HOSTED_REDIS_URL", re.compile(r"rediss?://[^:\s]+:[^@\s]+@(?!localhost|redis)[^/\s]+")),
    ("GEMINI_KEY", re.compile(r"\bAIza[0-9A-Za-z_-]{30,}\b")),
    ("JWT_LIKE_TOKEN", re.compile(r"\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\b")),
]

RISKY_TEXT = [
    ("PLACEHOLDER_SESSION_SECRET", re.compile(r"SESSION_SECRET=replace", re.I)),
    ("PUBLIC_S3_POLICY", re.compile(r"Principal\s*=\s*['\"]?\*")),
    ("ROOT_SSH_ALLOWED", re.compile(r"PermitRootLogin\s+yes", re.I)),
    ("PASSWORD_SSH_ALLOWED", re.compile(r"PasswordAuthentication\s+yes", re.I)),
]


def scan_repo(root: Path) -> list[Finding]:
    findings: list[Finding] = []
    for path in iter_text_files(root):
        rel_path = str(path.relative_to(root))
        # Example environment files are documentation templates with placeholder
        # connection strings, not real secrets. The canonical `.env.example` and
        # any tiered `.env.*.example` preset (e.g. `.env.pro.example`) are exempt.
        # Real `.env` files are git-ignored and never committed.
        file_name = path.name
        is_env_example = file_name.endswith(".env.example") or (
            file_name.startswith(".env.") and file_name.endswith(".example")
        )
        if is_env_example or "security_scan.py" in rel_path:
            continue
        try:
            lines = path.read_text(encoding="utf-8", errors="ignore").splitlines()
        except OSError:
            continue
        for line_number, line in enumerate(lines, start=1):
            for code, pattern in SECRET_PATTERNS:
                if pattern.search(line):
                    findings.append(
                        Finding(
                            severity="critical",
                            code=code,
                            message="Potential credential committed to source.",
                            path=rel_path,
                            line=line_number,
                        )
                    )
            for code, pattern in RISKY_TEXT:
                if pattern.search(line):
                    findings.append(
                        Finding(
                            severity="medium",
                            code=code,
                            message="Review this deployment security setting.",
                            path=rel_path,
                            line=line_number,
                        )
                    )
    return findings


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--json", action="store_true", help="Emit machine-readable findings")
    args = parser.parse_args()

    findings = scan_repo(args.root.resolve())
    return print_findings(findings, json_output=args.json)


if __name__ == "__main__":
    raise SystemExit(main())
