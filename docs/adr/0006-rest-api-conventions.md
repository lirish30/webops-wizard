# ADR 0006: REST API Conventions For External And Internal App Access

## Context

The PRD and product overview define resource-oriented endpoints across auth, workspaces, properties, integrations, pages, recommendations, reports, alerts, and releases. The system needs predictable APIs for the frontend, background jobs, and future clients, while keeping contracts explicit and easy to version.

## Decision

Adopt REST-style API conventions for the primary application interface, using resource-oriented paths, standard HTTP verbs, explicit tenant scoping, and typed request and response contracts.

## Consequences

Positive:

- Aligns directly with the endpoint model already described in the PRD.
- Easier to reason about for frontend and backend teams during MVP delivery.
- Good fit for strong server-side authorization and audit logging.
- Keeps external and internal app contracts straightforward before more specialized APIs are needed.

Negative:

- Some aggregate or highly nested workflows may feel less elegant than GraphQL.
- Care is required to avoid endpoint sprawl as product domains expand.
- Read-heavy dashboard experiences may eventually need optimized backend-for-frontend endpoints or query layers.

## Alternatives Considered

### GraphQL

Rejected for the initial foundation because it adds schema and resolver complexity before the domain model has stabilized.

### RPC-style internal API only

Rejected because the product already benefits from resource-oriented endpoints and predictable HTTP semantics.

## Follow-Up Work

- Write API conventions for naming, pagination, filtering, and error responses.
- Add versioning guidance for externally exposed endpoints.
- Define a standard envelope for success, validation errors, and audit metadata where appropriate.
