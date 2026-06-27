# Security Notes

Hogyoku handles private documents, so the operational defaults are intentionally
conservative.

## Secrets

- Real values live in `.env`, deployment secret managers, or ignored tfvars.
- `.env.example` is safe to commit and guarded by tests.
- Rotate any database, Redis, object-storage, or model keys exposed in chat,
  review comments, screenshots, or logs.
- Use distinct credentials per environment.

## Application Controls

- Passwords use Node's `scrypt` with per-password random salts.
- Sessions are opaque tokens; only salted token hashes are stored.
- Cookies are HTTP-only and become secure in production.
- Requests are origin-checked for mutating methods.
- Uploads enforce type and size limits.
- Retrieved answers can be withheld when claim verification fails.

## Infrastructure Controls

- Terraform creates a private S3 bucket with public access blocked,
  versioning enabled, and server-side encryption.
- ECS task roles are scoped to the document bucket.
- Runtime secrets are injected from Secrets Manager.
- CloudWatch log groups have finite retention.
- Ansible hardening disables password SSH and root SSH login, enables UFW,
  installs Fail2ban, and enables unattended upgrades.

## Deployment Checklist

1. Rotate every credential that was ever pasted outside a secret manager.
2. Generate a fresh `SESSION_SECRET`.
3. Run `npm run verify` and the offline Python guardrails.
4. Run `terraform plan` or `./scripts/deploy.sh`, depending on target.
5. Confirm `/api/health` is reachable.
6. Upload a small test document and confirm ingestion, retrieval, citations,
   and verification.

## Offline Scanners

The Python guardrail toolkit is standard-library only and does not call any AI
provider:

- `security_scan`: scans source files for committed credentials and risky
  deployment settings.
- `citation_audit`: checks whether cited answer claims overlap with cited
  evidence.
- `chunk_audit`: reports chunk length and duplicate risks.
- `rag_lint`: checks that unsupported answers clearly refuse or caveat.
- `security_report`: summarizes security controls present in the repository.
