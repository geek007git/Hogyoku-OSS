# Hogyoku developer shortcuts.
# Windows users without `make` can run the underlying npm/docker commands
# directly (see each target below or package.json).

.DEFAULT_GOAL := help
.PHONY: help install env infra up down migrate dev worker build test test-integration \
        typecheck verify evaluate guardrails check

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

install: ## Install Node dependencies
	npm install

env: ## Create a local .env from the free-tier preset
	cp .env.free.example .env
	@echo "Set SESSION_SECRET in .env (node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\")"

infra: ## Start Postgres, Redis, and MinIO locally
	docker compose up postgres redis minio minio-init

up: ## Build and run the full stack with Docker Compose
	docker compose up --build

down: ## Stop the Docker Compose stack
	docker compose down

migrate: ## Run database migrations
	npm run db:migrate

dev: ## Run the API in watch mode
	npm run dev

worker: ## Run the ingestion worker in watch mode
	npm run dev:worker

build: ## Compile TypeScript to dist/
	npm run build

test: ## Run the Node test suite
	npm test

test-integration: ## Run DB integration tests (needs RUN_DB_TESTS=1 + pgvector)
	npm run test:integration

typecheck: ## Type-check without emitting
	npm run typecheck

evaluate: ## Run the retrieval evaluation
	npm run evaluate

guardrails: ## Run offline RAG and security guardrails
	npm run guardrails

verify: ## Run the full verification script
	npm run verify

check: typecheck test build ## Run the core CI checks locally
