# DevOps Guide

Hogyoku supports three deployment paths so the project can grow without being
locked to one platform.

## Local Compose

Use Docker Compose for local development and small private deployments.

```bash
./scripts/bootstrap.sh
./scripts/deploy.sh
```

The Compose topology includes the API, worker, PostgreSQL with `pgvector`,
Redis, MinIO, and an optional Rust document-processing container profile:

```bash
docker compose --profile tools run --rm docproc
```

## Terraform

`infra/terraform` provisions the AWS primitives for a managed container
deployment:

- Private encrypted S3 document bucket
- ECR repositories for API/worker and Rust docproc images
- ECS cluster, API service, and worker service
- CloudWatch log groups
- Secrets Manager entries for database, Redis, Gemini, and session secrets
- Task roles with scoped document-bucket access

Start with:

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform plan
```

Do not commit `terraform.tfvars` or state files. Store production secrets in a
secret manager and rotate anything exposed during review.

## Ansible

`ansible` is for VPS or bare-metal deployments where Compose is still the
runtime.

```bash
cd ansible
ansible-galaxy collection install -r requirements.yml
ansible-playbook -i inventory.ini playbooks/harden.yml
ansible-playbook -i inventory.ini playbooks/deploy-compose.yml
```

The hardening playbook disables password SSH login, blocks root SSH login,
enables UFW, installs Fail2ban, and turns on unattended upgrades.

## Nix

Use Nix for a reproducible developer toolchain:

```bash
nix develop
```

The dev shell includes Node 22, Rust, Terraform, Ansible, Python, ShellCheck,
Docker client, Git, curl, and jq.

## CI

GitHub Actions validates:

- TypeScript type checks, tests, build, and npm audit
- Bash script syntax
- Python retrieval evaluation
- Python offline RAG and security guardrails
- Docker Compose config
- Rust formatting and tests
- Terraform formatting, init, and validation
- Ansible syntax checks and linting
- Nix flake checks

## Offline Python Guardrails

The `python/hogyoku_guardrails` toolkit costs zero model credits. It only reads
local files and JSONL fixtures:

```bash
PYTHONPATH=python python -m hogyoku_guardrails.security_scan --root .
PYTHONPATH=python python -m hogyoku_guardrails.citation_audit evaluations/answers.example.jsonl
PYTHONPATH=python python -m hogyoku_guardrails.chunk_audit evaluations/chunks.example.jsonl
PYTHONPATH=python python -m hogyoku_guardrails.rag_lint evaluations/rag_answers.example.jsonl
PYTHONPATH=python python -m hogyoku_guardrails.security_report --root .
```

Use these before committing dataset changes, prompt changes, or infrastructure
changes. They check for leaked secrets, unsupported cited claims, weak chunk
shape, unsafe answer behavior, and missing security controls.
