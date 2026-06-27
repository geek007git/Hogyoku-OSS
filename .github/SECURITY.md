# Security Policy

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Report privately using **GitHub's "Report a vulnerability"** feature under the
repository's **Security** tab (Security Advisories), or contact the maintainers
through the private channel listed on the repository profile.

When reporting, please include:

- A description of the issue and its potential impact
- Steps to reproduce (proof of concept if possible)
- Affected version, commit, or deployment tier
- Any suggested remediation

We aim to acknowledge reports within a few days and will keep you updated on
remediation progress. Please give us a reasonable window to release a fix before
any public disclosure.

## Scope

This policy covers the Hogyoku application code, infrastructure templates, and
default configuration in this repository. Issues in third-party dependencies
should be reported upstream, though we welcome a heads-up so we can pin or patch.

## Hardening and secure operation

For deployment hardening, secret handling, and the security controls Hogyoku
ships with, see [../docs/SECURITY.md](../docs/SECURITY.md).

## Good practices for operators

- Always set a strong, unique `SESSION_SECRET` (64+ random characters).
- Never commit `.env` or real credentials; use a secret manager in production.
- Run at least one worker separately from the web service.
- Scope storage credentials to the document bucket only.
- Rotate any credential that may have been exposed.
