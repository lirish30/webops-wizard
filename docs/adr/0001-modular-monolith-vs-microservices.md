# ADR 0001: Modular Monolith Over Early Microservices

## Context

WebOps Wizard needs clear domain boundaries across auth, workspaces, properties, integrations, page intelligence, data trust, recommendations, reports, alerts, releases, and settings. The product scope is broad, but the MVP is still a single product operated by a small engineering team. The platform also needs background jobs, shared contracts, and a path to later service extraction without rewriting the application.

## Decision

Adopt a modular monolith for the API and worker foundation, with explicit domain boundaries inside the monorepo and separate runtime entrypoints for web, api, and worker.

## Consequences

Positive:

- Faster initial delivery because cross-domain workflows stay in one deployable codebase.
- Lower operational complexity for MVP and early production.
- Easier schema evolution while product assumptions are still moving.
- Service extraction remains possible because domains are already isolated in structure and contracts.

Negative:

- Teams must enforce domain boundaries in code review because process isolation is weaker than network isolation.
- The codebase can become tangled if domain seams are ignored.
- Some future service extraction work is deferred rather than eliminated.

## Alternatives Considered

### Early microservices

Rejected because the MVP does not justify the operational overhead of multiple deployables, service contracts, service discovery, distributed tracing, and per-service CI/CD.

### Single unstructured monolith

Rejected because it would be faster only in the very short term and would make later extraction materially harder.

## Follow-Up Work

- Add import-boundary enforcement for domain modules.
- Define domain events and public interfaces per module.
- Identify extraction candidates after real production load appears, starting with integrations and reporting pipelines.
