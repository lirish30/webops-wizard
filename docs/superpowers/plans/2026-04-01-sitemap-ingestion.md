# Sitemap Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build sitemap ingestion that auto-discovers sitemap sources, parses sitemap indexes and child sitemaps, deduplicates URLs, and persists placeholder pages plus raw URL records for downstream page resolution.

**Architecture:** Implement sitemap ingestion as a first-class worker connector under the existing sync framework. Keep the connector split into focused discovery, traversal, and persistence units so parsing logic can be tested independently from Prisma writes and sync orchestration.

**Tech Stack:** TypeScript, Vitest, Prisma, worker connector framework

---

### Task 1: Extend schema for sitemap metadata

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/<timestamp>_sitemap_url_metadata/migration.sql`
- Test: `pnpm --filter @webops-wizard/db db:schema:validate`

- [ ] **Step 1: Add the failing schema assertion by updating the Prisma model**

```prisma
model UrlRecord {
  id               String    @id @default(uuid())
  propertyId       String    @map("property_id")
  canonicalPageId  String    @map("canonical_page_id")
  rawUrl           String    @map("raw_url")
  normalizedUrlKey String    @map("normalized_url_key")
  isCurrentAlias   Boolean   @default(true) @map("is_current_alias")
  firstSeenAt      DateTime? @map("first_seen_at") @db.Timestamptz(6)
  lastSeenAt       DateTime? @map("last_seen_at") @db.Timestamptz(6)
  source           String?
  metadataJson     Json?     @map("metadata_json")
}
```

- [ ] **Step 2: Run schema validation to verify the migration is still missing**

Run: `pnpm db:schema:validate`
Expected: schema validates locally, but no migration exists yet for `metadata_json`

- [ ] **Step 3: Add the SQL migration for `url_records.metadata_json`**

```sql
ALTER TABLE "url_records"
ADD COLUMN "metadata_json" JSONB;
```

- [ ] **Step 4: Run schema validation again**

Run: `pnpm db:schema:validate`
Expected: PASS

### Task 2: Add failing sitemap connector framework tests

**Files:**
- Modify: `apps/worker/src/domains/integrations/connector-framework.test.ts`
- Create: `apps/worker/src/domains/integrations/connectors/sitemap/sitemap.connector.test.ts`
- Test: `pnpm --filter @webops-wizard/worker test -- --run apps/worker/src/domains/integrations/connectors/sitemap/sitemap.connector.test.ts apps/worker/src/domains/integrations/connector-framework.test.ts`

- [ ] **Step 1: Write registry and sync behavior tests before implementation**

```ts
it("registers the sitemap connector", () => {
  const registry = createConnectorRegistry([createSitemapConnector()]);

  expect(registry.get("sitemap").provider).toBe("sitemap");
});

it("returns partial failure when one child sitemap fails but others persist", async () => {
  // build fake fetcher + in-memory store
  // expect runConnectorSync(...).status toBe("partial_failed")
});
```

- [ ] **Step 2: Run the targeted tests to verify they fail for missing connector code**

Run: `pnpm --filter @webops-wizard/worker test -- --run apps/worker/src/domains/integrations/connectors/sitemap/sitemap.connector.test.ts apps/worker/src/domains/integrations/connector-framework.test.ts`
Expected: FAIL with missing `createSitemapConnector` module or unresolved provider registration

- [ ] **Step 3: Implement only the minimal connector export and registration**

```ts
export function createSitemapConnector(): ConnectorModule {
  return {
    provider: "sitemap",
    oauth: {
      async refreshAccessToken() {
        throw new Error("Sitemap connector does not use OAuth");
      }
    },
    async sync() {
      return {
        fetchedAt: new Date(),
        latestDataAt: null,
        segments: []
      };
    }
  };
}
```

- [ ] **Step 4: Run the targeted tests again**

Run: `pnpm --filter @webops-wizard/worker test -- --run apps/worker/src/domains/integrations/connectors/sitemap/sitemap.connector.test.ts apps/worker/src/domains/integrations/connector-framework.test.ts`
Expected: some tests still fail, but module resolution and registry wiring now work

### Task 3: Build discovery and traversal with TDD

**Files:**
- Create: `apps/worker/src/domains/integrations/connectors/sitemap/sitemap.discovery.ts`
- Create: `apps/worker/src/domains/integrations/connectors/sitemap/sitemap.parser.ts`
- Create: `apps/worker/src/domains/integrations/connectors/sitemap/sitemap.traversal.ts`
- Modify: `apps/worker/src/domains/integrations/connectors/sitemap/sitemap.connector.test.ts`
- Test: `pnpm --filter @webops-wizard/worker test -- --run apps/worker/src/domains/integrations/connectors/sitemap/sitemap.connector.test.ts`

- [ ] **Step 1: Add failing tests for discovery precedence and robots fallback**

```ts
it("tries configured sitemap, then /sitemap.xml, then robots.txt", async () => {
  expect(fetchLog).toEqual([
    "https://example.com/custom.xml",
    "https://example.com/sitemap.xml",
    "https://example.com/robots.txt"
  ]);
});
```

- [ ] **Step 2: Run the sitemap connector test file to verify red state**

Run: `pnpm --filter @webops-wizard/worker test -- --run apps/worker/src/domains/integrations/connectors/sitemap/sitemap.connector.test.ts`
Expected: FAIL on discovery/traversal assertions

- [ ] **Step 3: Implement discovery and XML classification helpers**

```ts
export async function discoverSitemapCandidates(input: {
  primaryDomain: string;
  configuredSitemapUrl?: string | null;
  fetchText: (url: string) => Promise<string>;
}): Promise<string[]> {
  // configured URL
  // /sitemap.xml
  // robots.txt Sitemap: lines
}
```

- [ ] **Step 4: Add failing recursion and dedupe tests**

```ts
it("walks sitemap indexes, deduplicates children, and prevents loops", async () => {
  expect(result.urls.map((entry) => entry.rawUrl)).toEqual([
    "https://example.com/",
    "https://example.com/pricing"
  ]);
});
```

- [ ] **Step 5: Run the sitemap connector tests to verify the new failures**

Run: `pnpm --filter @webops-wizard/worker test -- --run apps/worker/src/domains/integrations/connectors/sitemap/sitemap.connector.test.ts`
Expected: FAIL on traversal assertions

- [ ] **Step 6: Implement traversal, XML parsing, URL extraction, and metadata merge**

```ts
export interface DiscoveredSitemapUrl {
  rawUrl: string;
  normalizedUrlKey: string;
  discoveredFrom: string[];
  lastmod: string | null;
  changefreq: string | null;
  priority: number | null;
}
```

- [ ] **Step 7: Run the sitemap connector tests again**

Run: `pnpm --filter @webops-wizard/worker test -- --run apps/worker/src/domains/integrations/connectors/sitemap/sitemap.connector.test.ts`
Expected: PASS for discovery, recursion, and dedupe tests

### Task 4: Persist placeholder pages and URL records

**Files:**
- Create: `apps/worker/src/domains/integrations/connectors/sitemap/sitemap.persistence.ts`
- Modify: `apps/worker/src/domains/integrations/connectors/sitemap/sitemap.connector.ts`
- Modify: `apps/worker/src/domains/integrations/connectors/sitemap/sitemap.connector.test.ts`
- Test: `pnpm --filter @webops-wizard/worker test -- --run apps/worker/src/domains/integrations/connectors/sitemap/sitemap.connector.test.ts`

- [ ] **Step 1: Add failing persistence tests for placeholder page creation and `firstSeenAt` preservation**

```ts
it("creates placeholder canonical pages and upserts sitemap url records", async () => {
  expect(store.savedPages[0]).toMatchObject({
    canonicalUrl: "https://example.com/pricing",
    normalizedUrlKey: "example.com/pricing"
  });
});
```

- [ ] **Step 2: Run the sitemap connector tests to verify red state**

Run: `pnpm --filter @webops-wizard/worker test -- --run apps/worker/src/domains/integrations/connectors/sitemap/sitemap.connector.test.ts`
Expected: FAIL on persistence assertions

- [ ] **Step 3: Implement a persistence store interface plus Prisma-backed upsert logic**

```ts
export interface SitemapPersistenceStore {
  ingest(input: {
    propertyId: string;
    discoveredAt: Date;
    urls: DiscoveredSitemapUrl[];
  }): Promise<{ recordsSynced: number }>;
}
```

- [ ] **Step 4: Run the sitemap connector tests again**

Run: `pnpm --filter @webops-wizard/worker test -- --run apps/worker/src/domains/integrations/connectors/sitemap/sitemap.connector.test.ts`
Expected: PASS for placeholder creation, upsert, and metadata persistence tests

### Task 5: Finalize connector integration and schedule coverage

**Files:**
- Modify: `apps/worker/src/domains/integrations/connectors/connector.types.ts`
- Modify: `apps/worker/src/domains/integrations/connectors/connector.registry.ts`
- Modify: `apps/worker/src/domains/integrations/sync/connector-sync.service.ts`
- Modify: `apps/worker/src/domains/integrations/connector-framework.test.ts`
- Test: `pnpm --filter @webops-wizard/worker test -- --run apps/worker/src/domains/integrations/connector-framework.test.ts`

- [ ] **Step 1: Add failing scheduler/framework tests covering sitemap support**

```ts
it("allows scheduled sitemap syncs", async () => {
  expect(jobs[0]?.payload.integrationConnectionId).toBe("ic_sitemap");
});
```

- [ ] **Step 2: Run the framework test file to verify it fails**

Run: `pnpm --filter @webops-wizard/worker test -- --run apps/worker/src/domains/integrations/connector-framework.test.ts`
Expected: FAIL on missing sitemap scheduling or registration behavior

- [ ] **Step 3: Implement the framework wiring**

```ts
const registry = createConnectorRegistry([
  createGa4Connector(),
  createGscConnector(),
  createSitemapConnector()
]);
```

- [ ] **Step 4: Run the framework test file again**

Run: `pnpm --filter @webops-wizard/worker test -- --run apps/worker/src/domains/integrations/connector-framework.test.ts`
Expected: PASS

### Task 6: Run focused verification and repo-level checks

**Files:**
- Modify: `apps/worker/src/domains/integrations/connectors/sitemap/*`
- Modify: `apps/worker/src/domains/integrations/connector-framework.test.ts`
- Modify: `packages/db/prisma/schema.prisma`
- Test: `pnpm --filter @webops-wizard/worker test -- --run apps/worker/src/domains/integrations/connectors/sitemap/sitemap.connector.test.ts apps/worker/src/domains/integrations/connector-framework.test.ts`

- [ ] **Step 1: Run focused worker tests**

Run: `pnpm --filter @webops-wizard/worker test -- --run apps/worker/src/domains/integrations/connectors/sitemap/sitemap.connector.test.ts apps/worker/src/domains/integrations/connector-framework.test.ts`
Expected: PASS

- [ ] **Step 2: Run worker typecheck**

Run: `pnpm --filter @webops-wizard/worker typecheck`
Expected: PASS

- [ ] **Step 3: Run Prisma schema validation**

Run: `pnpm db:schema:validate`
Expected: PASS
