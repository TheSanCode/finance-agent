# Architecture Overview

## Goals

- Establish a secure finance-agent baseline with strict boundaries.
- Separate pure financial logic from side effects.
- Prepare deployment to Cloud Run with CI quality gates.

## Architecture Style

- Clean Architecture: domain and application layers are dependency-free from infra and delivery.
- Domain-driven design: domain package owns financial language and deterministic models.
- Functional Core / Imperative Shell: pure calculations in domain; IO orchestration in application, infrastructure, and API.

## Layer Responsibilities

- packages/domain: deterministic financial models and calculations.
- packages/application: use cases and ports, including mandatory human-approval flow before writes.
- packages/infrastructure: Firebase Auth and Firestore adapters that implement application ports.
- packages/agent: orchestrator and controlled tool registry for LLM access.
- packages/shared: validated runtime configuration.
- apps/api: HTTP surface and health endpoints.

## Vertical Slice: GetCreditCardSummary

- Read-only use case in application layer through repository port.
- Ownership boundary enforced by querying account by `accountId` plus authenticated `ownerUserId`.
- Deterministic utilization computed in domain using integer basis points.
- API logs operation outcome without financial amounts.
- Genkit/Gemini is not part of any financial calculation path.

## Vertical Slice: Statement Import Preview And Approval

- Upload endpoint validates auth, ownership, file type, and file size.
- Statement extraction is behind application `StatementExtractor` port.
- Transactions are normalized into domain objects with integer minor units.
- Duplicate detection uses deterministic stable fingerprints.
- Totals are validated when provided by statement source.
- Preview is persisted as `PENDING_APPROVAL`; final transactions are persisted only on explicit approval.
- Approval requires idempotency key and writes audit trail events.
- Genkit/Gemini is not used in calculations, duplicate detection, date parsing, or money conversion.

## Agent Safety Model

- The orchestrator can call only pre-registered tools.
- Tools are validated with Zod.
- LLMs never receive direct Firestore clients.
- Write operations are routed through application use cases that enforce approval.

## Data Safety

- Amounts are represented in minor units with bigint for deterministic math.
- Currency mismatches throw immediately.

## Deployment

- API runs on Cloud Run as a stateless container.
- Firebase services are accessed through managed credentials.
