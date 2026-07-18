# Agent Safety and Tool Governance

## Guardrails

- Controlled tool registry allows only explicit tools.
- Unknown tool calls are rejected.
- Tool inputs are parsed and validated with Zod.

## Write-Path Controls

- All write actions require human approval through ApprovalPort.
- Persistence adapters are inaccessible from prompt-driven flows directly.
- Approval metadata is returned and can be audited.

## Prompt-Execution Separation

- Prompt interpretation and tool execution are separate concerns.
- Business rules remain in application/domain layers.
- Infrastructure adapters are not exposed to model context as callable primitives.
