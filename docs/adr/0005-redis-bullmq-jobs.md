# ADR 0005: Redis And BullMQ For Background Jobs

## Context

The platform requires asynchronous workflows for connector sync, crawling, page identity resolution, trust scoring, recommendation generation, report generation, alert evaluation, and cache refresh. These jobs must be retriable, idempotent, and observable. The product overview explicitly called out BullMQ or Temporal, with Redis for queues and caching.

## Decision

Use Redis as the queue and transient job state backend, with BullMQ as the initial background job framework in `apps/worker`.

## Consequences

Positive:

- Fast path to production-ready async job handling for MVP needs.
- Good fit for queue-based worker architecture in a TypeScript monorepo.
- Lower conceptual and operational overhead than Temporal for an early-stage product.
- Easy to separate worker runtime from API runtime.

Negative:

- Long-running workflow orchestration is less expressive than Temporal.
- Job semantics and retry policies need more application discipline.
- Redis becomes another required infrastructure dependency for local and production environments.

## Alternatives Considered

### Temporal

Rejected for now because it is more powerful than current MVP needs and adds substantial platform complexity early.

### Database-backed jobs only

Rejected because it would be slower to operate, less purpose-built for queue semantics, and harder to scale cleanly.

## Follow-Up Work

- Define queue names, payload schemas, retry policies, and dead-letter handling.
- Add job observability metrics and structured worker logs.
- Reassess Temporal if workflow coordination becomes materially more complex.
