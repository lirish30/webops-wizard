# ADR 0003: NestJS For The Backend Modular Monolith

## Context

The backend must support many product domains, server-side RBAC, background-job coordination, typed configuration, long-term maintainability, and eventual service extraction. The product overview recommended NestJS or a lighter Node framework, with a preference for clear service boundaries.

## Decision

Use NestJS with TypeScript as the backend framework for `apps/api`, paired with the Fastify platform adapter.

## Consequences

Positive:

- Module-oriented structure maps well to domain boundaries.
- Dependency injection and lifecycle hooks fit the product’s integration-heavy backend.
- Good support for validation, testing, and long-lived service code.
- Fastify adapter keeps the runtime efficient enough for the early platform.

Negative:

- More framework ceremony than a minimal Fastify or Express service.
- Developers need discipline to avoid over-abstracting simple logic behind framework constructs.
- Some framework-specific patterns can make later extraction more opinionated.

## Alternatives Considered

### Raw Fastify

Rejected because it would reduce framework overhead but would require more custom structure and conventions to keep the modular monolith disciplined.

### Express

Rejected because it provides less architectural guidance and weaker defaults for a backend expected to grow across many domains.

## Follow-Up Work

- Add per-domain application, domain, infrastructure, and presentation layers.
- Introduce shared error handling, request context, and tenant-scoping guards.
- Add module boundary tests or lint rules to prevent deep cross-domain imports.
