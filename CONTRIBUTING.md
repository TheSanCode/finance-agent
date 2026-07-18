# Contributing

Thank you for contributing to Finance Agent.

## Development Workflow

1. Create a feature branch from the active integration branch.
2. Install dependencies with npm ci.
3. Run local quality gates before opening a pull request:
   - npm run format:check
   - npm run lint
   - npm run typecheck
   - npm run test
   - npm run build
4. Open a pull request with:
   - Problem statement
   - Scope and non-scope
   - Risk assessment
   - Test evidence

## Architecture Expectations

- Keep domain logic framework-free.
- Keep mutating operations behind application use cases and approval boundaries.
- Do not expose direct Firestore access to agent or prompt-driven layers.
- Validate external inputs with Zod.

## Commit Guidelines

- Keep commits small and coherent.
- Update docs and comments when behavior changes.
- Follow the repository hook guidance in README.
