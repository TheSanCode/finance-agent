# ADR 0004: Statement Import Preview With Explicit Approval

## Status

Accepted

## Context

Finance Agent needs a safe and deterministic statement import flow that supports user review before transaction persistence.

## Decision

Implement a two-step workflow:

- `CreateStatementImportPreview`: validate upload, extract rows through `StatementExtractor`, normalize rows, detect duplicates, validate totals when available, and persist preview with `PENDING_APPROVAL`.
- `ApproveStatementImport`: require idempotency key, import approved eligible rows, update state to `IMPORTED`, and write audit trail.

Architecture constraints:

- Domain remains framework-independent.
- Application layer owns approval rules and ports.
- Infrastructure provides CSV extractor and Firestore/in-memory adapters.
- API enforces authenticated ownership checks.
- LLM/agent layer does not directly access Firestore.
- Gemini is not used for arithmetic, duplicate detection, date parsing, or monetary conversion.

## Consequences

- Stronger operational safety with explicit approval boundary.
- Deterministic import behavior and reproducible duplicate detection.
- Better resilience via idempotent approval.
- Slightly higher implementation complexity due to preview state and audit requirements.
