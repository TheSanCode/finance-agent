# Finance Agent

Enterprise-grade project foundation for an AI-assisted finance platform using TypeScript, Node.js, Genkit, Gemini Developer API, Firebase Authentication, Firestore, and Cloud Run.

This repository currently provides architecture, safety boundaries, configuration, quality gates, and basic executable scaffolding. It intentionally does not include full business functionality yet.

## Technology Stack

- TypeScript + Node.js (ESM)
- Genkit + Gemini Developer API
- Firebase Authentication + Firestore
- Zod for schema validation
- Vitest for testing
- ESLint + Prettier
- GitHub Actions CI
- Cloud Run container deployment baseline

## Architecture Principles

- Clean Architecture
- Domain-driven design
- Functional Core / Imperative Shell
- Controlled tool registry for agent tool execution
- Deterministic financial calculations (minor units with bigint)
- Human approval before write operations
- No direct database access from the LLM

## Monorepo Structure

- apps/api: HTTP API entry point and health endpoint
- packages/domain: deterministic domain models and calculations
- packages/application: use cases and ports
- packages/infrastructure: Firebase Auth and Firestore adapters
- packages/agent: orchestrator and controlled tool registry
- packages/shared: environment/config handling
- docs/architecture: system and guardrail documentation
- docs/adr: architecture decision records
- tests: project-level tests
- .github/workflows: CI pipelines

## Getting Started

1. Install dependencies

   npm install

2. Run quality checks

   npm run format
   npm run lint
   npm run typecheck
   npm run test

3. Run API locally

   npm run dev

Health endpoint:

GET /health

## Cloud Run Baseline

- Containerized Node.js API with PORT support.
- Designed for stateless deployment.
- Firebase credentials are expected via workload identity or service account bindings.

## Commit Hook: Comment Sync Check

This repository includes a pre-commit hook that inspects staged changes and blocks a commit when code changed but no comment updates were staged in the same file.

Enable hooks for this repository:

git config core.hooksPath .githooks

Temporary bypass:

PowerShell:

$env:SKIP_COMMENT_CHECK=1
git commit -m "your message"
Remove-Item Env:SKIP_COMMENT_CHECK
