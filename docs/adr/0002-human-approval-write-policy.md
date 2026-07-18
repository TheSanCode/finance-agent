# ADR 0002: Mandatory Human Approval for Write Operations

## Status

Accepted

## Context

Financial systems require accountability and control over mutating operations.

## Decision

All mutating operations are gated through application-layer use cases that call ApprovalPort before persistence.

## Consequences

- Stronger operational control and auditability.
- Additional latency due to human-in-the-loop flow.
- Infrastructure writes become impossible to trigger directly from LLM tooling.
