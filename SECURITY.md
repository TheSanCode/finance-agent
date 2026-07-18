# Security Policy

## Supported Versions

This repository is in active development. Security fixes are applied to the latest default development branch.

## Reporting a Vulnerability

Please report vulnerabilities privately through your internal security channel or private issue intake process. Do not disclose sensitive details in public issues.

Include:

- Affected component and file path
- Impact and exploitation scenario
- Reproduction steps
- Suggested remediation

## Security Baseline

- No plaintext secrets in source control.
- Runtime credentials are provided by platform identity (for example, Cloud Run service identity).
- Firebase and model API access must remain behind validated boundaries and least privilege.
