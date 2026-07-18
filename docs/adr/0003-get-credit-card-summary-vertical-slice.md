# ADR 0003: GetCreditCardSummary Vertical Slice

## Status

Accepted

## Context

The first production-quality read path is needed for credit card insights while preserving strict architecture and safety boundaries.

## Decision

Implement `GetCreditCardSummary` as a read-only vertical slice:

- Domain owns deterministic financial calculations using minor units and bigint.
- Application defines repository ports and typed application errors.
- Infrastructure provides Firestore adapter and in-memory test adapter.
- API enforces Firebase-authenticated access and routes only owner-scoped reads.
- External inputs are validated with Zod at request and use-case boundaries.
- Gemini/Genkit is excluded from financial calculations.

## Consequences

- Clear separation of concerns and safer evolution to additional read flows.
- Testability improves through in-memory repository and dependency injection.
- API response avoids floating-point precision issues by returning string minor units and basis points.
