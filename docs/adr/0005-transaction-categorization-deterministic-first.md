# ADR 0005: Transaction Categorization With Deterministic-First Rules

## Status

Accepted

## Context

Finance Agent needs production-safe transaction categorization that is explainable, deterministic by default, and extensible with optional AI suggestions.

## Decision

Implement a categorization vertical slice with these constraints:

- Deterministic rule engine in domain layer (`evaluateCategorizationRules`) with explicit precedence.
- Rule precedence: user rules before merchant/system rules, then rule specificity and priority.
- Existing user-confirmed category is never auto-overwritten.
- Optional AI suggestion is isolated behind `CategorySuggestionProvider` and treated as advisory only.
- Deterministic-first invariant is enforced in the suggestion use case itself: Gemini is never called until deterministic evaluation returns no match.
- Correction flow can learn a user merchant rule for future deterministic matching.
- Categorization endpoints require idempotency keys and repeated requests with the same key produce equivalent responses with no additional business side effects.
- All categorization writes produce audit records.
- API logs do not include raw `transactionId`; only correlation IDs and opaque hashed references are emitted.

API surface:

- `POST /v1/transactions/:transactionId/categorize`
- `POST /v1/transactions/:transactionId/category-suggestion`
- `POST /v1/transactions/:transactionId/category-confirmation`
- `POST /v1/statement-imports/:importId/categorize`

Architecture constraints:

- Domain is framework-independent and pure.
- Application owns orchestration and ownership checks through ports.
- Infrastructure provides Firestore/in-memory repositories and Gemini suggestion adapter.
- Gemini is never used for deterministic rule matching or write-side finalization.

## Consequences

- Higher explainability and reproducibility for categorization outcomes.
- Safer integration of AI by keeping suggestions optional and non-authoritative.
- Better personalization through user-correction rule learning.
- Added operational complexity from extra repositories and endpoints.
