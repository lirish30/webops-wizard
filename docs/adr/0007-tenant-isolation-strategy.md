# ADR 0007: Tenant Isolation Through Application Scoping And Data Partitioning

## Context

The PRD makes tenant isolation a platform-level requirement across all data, queries, storage, and exports. WebOps Wizard must support multi-user workspaces, multi-property workspaces, and agency-managed client workspaces without cross-tenant leakage.

## Decision

Use logical tenant isolation with explicit workspace scoping in application code, database schema design, and authorization checks. Every tenant-bound entity must include a workspace root or a property that resolves to a workspace, and all protected reads and writes must enforce tenant scope server-side.

## Consequences

Positive:

- Simpler operational model than separate databases per tenant at MVP stage.
- Works well with a shared PostgreSQL primary store.
- Supports agency and multi-workspace user models without infrastructure duplication.
- Keeps the path open for stronger isolation later if enterprise requirements demand it.

Negative:

- Correctness depends on consistent tenant-scoping discipline across the codebase.
- A missed authorization or query filter can create serious security risk.
- Future enterprise customers may require stronger isolation options than shared-schema logical partitioning.

## Alternatives Considered

### Database per tenant

Rejected because it adds provisioning, migration, reporting, and operational overhead too early for the expected customer profile.

### Schema per tenant

Rejected because it increases operational complexity and makes cross-tenant platform operations harder without enough MVP benefit.

## Follow-Up Work

- Add shared tenant context middleware or guards in the API.
- Model tenant roots explicitly in the database and contract types.
- Add authorization tests that verify cross-workspace access is rejected.
