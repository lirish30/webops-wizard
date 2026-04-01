# ADR 0004: PostgreSQL As The Primary Data Store

## Context

WebOps Wizard needs relational modeling for users, workspaces, memberships, properties, integrations, recommendations, alerts, releases, and future audit trails. The PRD also calls for PostgreSQL as the primary relational database, while noting that larger analytics workloads could move to ClickHouse later.

## Decision

Use PostgreSQL as the primary system of record for the platform, with Prisma as the initial schema and client layer.

## Consequences

Positive:

- Strong fit for relational multi-tenant SaaS data.
- Supports transactional workflows for core product state.
- Flexible enough for early JSONB-backed evidence and connector metadata where needed.
- Keeps the MVP architecture simpler than introducing multiple persistence systems immediately.

Negative:

- Heavy analytics and page-query scale may eventually exceed ideal PostgreSQL usage patterns.
- Time-series and aggregate workloads need careful indexing and summarization strategy.
- Prisma may not cover every future Postgres-specific optimization pattern elegantly.

## Alternatives Considered

### PostgreSQL plus ClickHouse from day one

Rejected because it adds operational and modeling complexity before real scale pressure is proven.

### NoSQL primary store

Rejected because the product core is relational and auditable, and tenant-safe joins matter for the MVP.

## Follow-Up Work

- Expand the Prisma schema toward the MVP core entities.
- Add migration strategy and local seed data.
- Define thresholds for when analytics workloads should move to a secondary analytical store.
