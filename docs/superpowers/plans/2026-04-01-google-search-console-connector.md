# Google Search Console Connector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Google Search Console connector with OAuth placeholder endpoints, cached site selection, daily page-query ingestion, backfill support, freshness tracking, and partial failure handling.

**Architecture:** Extend the existing integration controller/service pattern used by GA4, add a `gsc` connector module to the worker registry, and persist normalized GSC page/query metrics into the existing relational metric tables plus a small site cache table. Reuse connector sync runs, issues, and freshness metadata rather than introducing a second ingestion framework.

**Tech Stack:** NestJS, Prisma, PostgreSQL, Vitest, existing connector sync framework

---

### Task 1: Add GSC API contract tests and DTO coverage

**Files:**
- Modify: `apps/api/src/domains/integrations/integrations.dto.ts`
- Modify: `apps/api/src/domains/integrations/integrations.controller.test.ts`
- Modify: `apps/api/src/domains/integrations/integrations.service.test.ts`

- [ ] Add failing tests for GSC DTO parsing, controller construction, and service helpers that mirror the GA4 surface.
- [ ] Run the targeted API tests to verify they fail for missing GSC exports and methods.
- [ ] Add minimal GSC DTO schemas and service/controller method signatures.
- [ ] Re-run the targeted API tests to verify the new surface passes.

### Task 2: Add relational schema support for cached GSC sites and stricter query normalization

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/20260401150000_gsc_connector/migration.sql`

- [ ] Add a `SearchConsoleSite` model keyed by integration connection for cached selectable sites.
- [ ] Add a unique index for normalized query rows at `propertyId + canonicalPageId + queryText + date`.
- [ ] Generate the SQL migration reflecting the Prisma schema changes.
- [ ] Verify Prisma schema formatting and migration file contents.

### Task 3: Implement GSC provider contracts and API service/controller logic

**Files:**
- Modify: `packages/integrations/src/index.ts`
- Modify: `apps/api/src/domains/integrations/integrations.dto.ts`
- Modify: `apps/api/src/domains/integrations/integrations.service.ts`
- Modify: `apps/api/src/domains/integrations/integrations.controller.ts`

- [ ] Add failing tests covering GSC OAuth start/complete, site listing, site selection persistence, and backfill config behavior.
- [ ] Extend the placeholder integrations package with GSC OAuth/site/query contract types and a placeholder provider.
- [ ] Implement GSC service methods that store OAuth placeholder state, credentials, cached sites, selected site config, and pending backfills.
- [ ] Implement matching controller endpoints and audit events.
- [ ] Re-run targeted API tests until green.

### Task 4: Implement GSC connector sync and normalized metric persistence

**Files:**
- Create: `apps/worker/src/domains/integrations/connectors/gsc/gsc.connector.ts`
- Create: `apps/worker/src/domains/integrations/connectors/gsc/gsc.connector.test.ts`
- Modify: `apps/worker/src/domains/integrations/sync/connector-sync.service.ts`

- [ ] Add failing worker tests for successful ingestion, backfill windows, unresolved page mappings, freshness calculation, and partial failures.
- [ ] Implement the GSC connector with OAuth refresh behavior, date-window selection, page/query ingestion, and connection config updates.
- [ ] Register the connector in the sync registry and include `gsc` in scheduled sync selection.
- [ ] Re-run worker tests until green.

### Task 5: Verify the integrated slice

**Files:**
- Modify: `apps/api/src/domains/integrations/integrations.controller.test.ts`
- Modify: `apps/api/src/domains/integrations/integrations.service.test.ts`
- Modify: `apps/worker/src/domains/integrations/connectors/gsc/gsc.connector.test.ts`

- [ ] Run focused API and worker test commands covering the touched connector files.
- [ ] Run the broader integrations-related test suite if the focused tests pass.
- [ ] Fix any regressions found in the green run and re-run verification.
