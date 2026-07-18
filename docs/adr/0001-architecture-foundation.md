# ADR 0001: Establish Finance Agent Foundation

## Status

Accepted

## Context

The repository needs an initial enterprise-ready baseline that supports secure AI-assisted finance workflows without implementing full business features yet.

## Decision

Adopt a TypeScript Node.js monorepo with layered packages:

- Domain, Application, Infrastructure, Agent, Shared, API app.
- Zod for schema validation.
- Vitest for tests.
- ESLint and Prettier for quality.
- CI workflow for lint, type-check, and test gates.

## Consequences

- Faster onboarding with clear architectural boundaries.
- Better safety posture by disallowing direct DB access from the LLM.
- Slightly higher early setup complexity, offset by long-term maintainability.
