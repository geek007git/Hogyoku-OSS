#!/usr/bin/env python3
"""Generate a lightweight repository security posture report."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


CHECKS = {
    "env_is_ignored": lambda root: ".env" in (root / ".gitignore").read_text(encoding="utf-8"),
    "has_security_docs": lambda root: (root / "docs" / "SECURITY.md").exists(),
    "has_terraform": lambda root: (root / "infra" / "terraform" / "main.tf").exists(),
    "has_ansible_hardening": lambda root: (root / "ansible" / "playbooks" / "harden.yml").exists(),
    "has_ci": lambda root: (root / ".github" / "workflows" / "ci.yml").exists(),
    "has_secret_test": lambda root: (root / "tests" / "env-safety.test.ts").exists(),
    "has_csp": lambda root: "contentSecurityPolicy"
    in (root / "src" / "app.ts").read_text(encoding="utf-8"),
}


def build_report(root: Path) -> dict[str, object]:
    results = {}
    for name, check in CHECKS.items():
        try:
            results[name] = bool(check(root))
        except OSError:
            results[name] = False
    score = round(sum(results.values()) / len(results) * 100)
    return {
        "score": score,
        "checks": results,
        "summary": "pass" if score == 100 else "review",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path.cwd())
    args = parser.parse_args()
    report = build_report(args.root.resolve())
    print(json.dumps(report, indent=2))
    return 0 if report["score"] >= 85 else 1


if __name__ == "__main__":
    raise SystemExit(main())
