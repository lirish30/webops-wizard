# WebOps Wizard Crawler V1 Design

## Goal

Implement a first-class `crawler` connector that performs HTML-first crawling for a property, respects `robots.txt`, seeds from sitemap-discovered URLs, expands through internal links within bounded depth, applies include/exclude rules, extracts core page metadata, captures HTTP status codes, and stores page snapshots including the raw fetched HTML body.

## Scope

This design covers:

- a new `crawler` connector in the worker connector framework
- HTML fetch mode as the only supported fetch path in v1
- sitemap-backed crawl seeding
- `robots.txt` awareness for crawl permission checks
- property-scoped include/exclude rule filtering
- crawl depth limits and page count limits
- canonical URL extraction
- title, meta description, and first H1 extraction
- HTTP status code capture for crawl attempts
- internal link counting and same-property internal link discovery
- raw HTML page snapshot storage
- a storage and fetch abstraction that leaves a clean upgrade path for later JS rendering
- tests for crawl policy, extraction, persistence, and framework integration

This design does not cover:

- JS-rendered crawling
- distributed crawl scheduling across multiple workers
- cross-domain crawling beyond the property domain policy
- canonical-based page identity merging
- duplicate-content clustering
- JavaScript-executed DOM extraction
- screenshot capture or visual diffing
- removal/cleanup of historical snapshots

## Recommended Approach

Implement crawler v1 as a dedicated `crawler` connector that is separate from the existing `sitemap` connector.

- `sitemap` remains the source of discovered URL candidates and sitemap metadata.
- `crawler` becomes the execution layer that turns known URLs into page-level observations.
- The crawler builds an initial queue from sitemap-backed `UrlRecord` rows, then expands through discovered internal links within the configured rules.
- The connector writes extracted page fields back onto `CanonicalPage` and stores a per-day `PageStateSnapshot` that includes the raw HTML body for HTML responses.
- The crawler fetch pipeline is defined behind a `PageFetchEngine` interface so v1 can use HTML fetch mode now and later swap in a rendered fetch engine without redesigning crawl orchestration.

This preserves a clean separation of concerns:

- sitemap answers "what URLs do we know about?"
- crawler answers "what did the page actually return and contain?"

## Architecture

### Connector placement

Add the crawler module under `apps/worker/src/domains/integrations/connectors/crawler/` and register it through the same registry used by other property-bound connectors.

The connector participates in the normal flow in `connector-sync.service.ts` and `runConnectorSync`, so it inherits:

- manual and scheduled sync execution
- `ConnectorSyncRun` history
- issue recording
- freshness and coverage metadata
- property-level health updates

### Module boundaries

Use focused files with single responsibilities:

- `crawler.connector.ts`: connector orchestration and sync result construction
- `crawler.seeding.ts`: seed URL collection from sitemap-backed `UrlRecord` rows and optional explicit seeds
- `crawler.rules.ts`: include/exclude filters, property-domain checks, and crawl depth checks
- `crawler.robots.ts`: `robots.txt` fetching, parsing, and per-run caching
- `crawler.fetch.ts`: fetch engine interface and HTML-mode implementation
- `crawler.extract.ts`: canonical/title/meta/H1/internal-link extraction from HTML
- `crawler.persistence.ts`: `CanonicalPage`, `UrlRecord`, `PageStateSnapshot`, and raw snapshot storage updates

### Fetch engine seam

Define a fetch interface that separates crawl orchestration from the underlying retrieval mechanism.

Recommended contract:

```ts
export interface PageFetchEngine {
  mode: "html";
  fetch(input: {
    url: string;
    userAgent: string;
    timeoutMs: number;
  }): Promise<{
    requestedUrl: string;
    finalUrl: string;
    statusCode: number;
    contentType: string | null;
    html: string | null;
  }>;
}
```

V1 uses `HtmlFetchEngine`, backed by standard HTTP fetch. A future `RenderedFetchEngine` can keep the same output shape while sourcing HTML from a browser context.

## Config Contract

The crawler reads configuration from `integrationConnection.configJson`.

Supported fields:

- `fetchMode?: "html"` default `"html"`
- `maxDepth?: number` default `1`
- `maxPagesPerRun?: number` default `250`
- `fetchTimeoutMs?: number` default `10000`
- `userAgent?: string`
- `seedUrls?: string[]`
- `includeRules?: string[]`
- `excludeRules?: string[]`

Config rules:

- `fetchMode` must be `"html"` in v1. Any other value is a non-retryable validation failure.
- `maxDepth` must be `>= 0`.
- `maxPagesPerRun` must be `> 0`.
- `seedUrls` are optional bootstrap inputs and are merged with sitemap-backed seeds after normalization and dedupe.
- connector-level include/exclude rules override property defaults if both are present. If no connector rules are configured, use property settings when available.

## Crawl Flow

### Seed construction

Seed priority:

1. explicit `seedUrls`, if configured
2. existing property `UrlRecord` rows whose `source` is `"sitemap"` or whose metadata provider is `"sitemap"`
3. existing current-alias `UrlRecord` rows for the property as a fallback if no sitemap-backed rows exist

Rules:

- normalize and deduplicate seeds by the existing property-scoped normalized URL key logic
- discard seeds outside the property domain policy
- initialize all accepted seeds at depth `0`

### Queue behavior

Use breadth-first traversal.

Maintain:

- a queue of URLs to crawl with current depth
- a set of visited normalized URL keys
- a map of queued normalized URL keys to their shallowest known depth

Rules:

- if a URL is rediscovered at a deeper depth than already known, ignore it
- if it is rediscovered at a shallower depth before fetch, replace the queued depth
- stop when `maxPagesPerRun` is reached
- do not enqueue links deeper than `maxDepth`

### Robots awareness

For each host encountered:

- fetch `robots.txt` once per run
- parse `Allow` and `Disallow` directives for the configured crawler user agent and `*`
- treat sitemap directives as informational only because seeding already comes from sitemap persistence

Permission behavior:

- if `robots.txt` explicitly disallows the path, skip crawl and record an issue or skipped segment detail
- if `robots.txt` allows the path or provides no applicable rule, proceed
- if `robots.txt` fetch fails for a host, treat that host as not crawlable in v1 and record a retryable failure

This conservative default avoids silently crawling when crawl policy could not be evaluated.

### Per-page crawl behavior

For each queued URL:

1. confirm the URL still passes domain/include/exclude/depth rules
2. confirm the URL is allowed by `robots.txt`
3. fetch the page through the HTML fetch engine
4. record HTTP status code and final URL
5. if the response is HTML, extract page fields and discover internal links
6. persist page-level observations and snapshot data

### Internal link discovery

For HTML responses:

- extract anchor `href` values
- resolve relative links against the final URL
- count only internal links that resolve to the property domain policy
- enqueue internal links only when they:
  - normalize successfully
  - match the property domain policy
  - pass include/exclude rules
  - are within `maxDepth`
  - are allowed by `robots.txt` when later evaluated for fetch

The discovered internal link count stored on the snapshot is the number of valid internal links found on the page after resolution and filtering to the property domain, not merely the raw number of `<a>` tags.

## Extraction Rules

For HTML responses, extract:

- `title`: document `<title>` text
- `metaTitle`: same source as `title` in v1 unless a distinct framework-specific value is later introduced
- `metaDescription`: `<meta name="description">`
- `h1`: first non-empty `<h1>`
- `canonicalTargetUrl`: resolved absolute URL from `<link rel="canonical">`
- `internalLinkCount`: resolved internal links count

Extraction rules:

- trim text values
- collapse repeated whitespace
- preserve `null` when an element is missing
- resolve canonical URLs relative to the final fetched URL
- ignore non-HTTP(S) canonical targets and malformed values

### Status code capture

Capture the final fetch HTTP status code for every attempted crawl, including non-HTML responses and error pages when a response exists.

If the fetch fails before an HTTP response is available:

- do not invent a status code
- record the failure as a retryable or non-retryable issue depending on the error class

### Canonical handling

Crawler v1 extracts and stores canonical targets but does not use them to remap page identity.

Rules:

- update `CanonicalPage.canonicalTargetUrl` when a valid canonical is extracted
- preserve the page’s `normalizedUrlKey` based on the crawled/requested URL identity already established
- later page identity resolution can choose to merge or remap based on canonical signals

## Data Model

### Canonical page updates

Crawler persistence updates the existing `CanonicalPage` row identified by the property-scoped normalized URL key.

Fields refreshed from HTML extraction:

- `canonicalUrl`: prefer the final fetched URL when valid, otherwise preserve the current canonical URL
- `title`
- `metaTitle`
- `metaDescription`
- `h1`
- `canonicalTargetUrl`
- `lastSeenAt`

Placeholder pages discovered by sitemap ingestion continue to be valid inputs. The crawler enriches them rather than creating a parallel page model.

### Page state snapshots

Extend `PageStateSnapshot` to hold crawl snapshot details needed for v1.

Recommended additions:

- `statusCode Int? @map("status_code")`
- `snapshotHtml String? @map("snapshot_html")`
- `fetchMode String? @map("fetch_mode")`
- `requestedUrl String? @map("requested_url")`
- `finalUrl String? @map("final_url")`

Existing useful fields already present:

- `title`
- `metaTitle`
- `metaDescription`
- `h1`
- `contentHash`
- `internalLinkCount`
- `crawlDepth`

Recommended semantics:

- `snapshotDate` remains the uniqueness boundary for v1, one snapshot per canonical page per day
- `contentHash` is computed from the fetched HTML body when HTML exists
- `fetchMode` stores `"html"` in v1 so rendered snapshots can coexist later without ambiguous provenance
- `snapshotHtml` stores the raw fetched HTML body for HTML responses

### Raw HTML storage seam

Even though v1 stores raw HTML in the database, persist it through an adapter boundary.

Recommended contract:

```ts
export interface SnapshotBodyStore {
  save(input: {
    canonicalPageId: string;
    snapshotDate: Date;
    html: string;
  }): Promise<{
    html: string;
  }>;
}
```

V1 implementation:

- `DatabaseSnapshotBodyStore` returns the HTML body for direct insertion into `PageStateSnapshot.snapshotHtml`

Future implementation:

- `ObjectStorageSnapshotBodyStore` can store bodies externally and evolve the schema to hold a pointer instead of inline HTML, without changing crawler orchestration

### URL record updates

Crawler does not replace sitemap provenance. It may upsert `UrlRecord` rows for newly discovered internal links when they do not already exist.

Rules:

- preserve existing sitemap metadata when a row already exists
- for crawler-discovered links with no existing row, create a `UrlRecord` tied to the same canonical page with `source = "crawler"`
- preserve `firstSeenAt`, update `lastSeenAt`
- do not mark aliases inactive in v1

## Persistence Semantics

For each successfully fetched HTML page:

- ensure a `CanonicalPage` exists for the normalized URL key
- update extracted page fields on `CanonicalPage`
- upsert a same-day `PageStateSnapshot`
- compute and persist `contentHash`
- persist `snapshotHtml`

For non-HTML responses with an HTTP status:

- ensure a `CanonicalPage` exists
- upsert a same-day snapshot with:
  - `statusCode`
  - `fetchMode`
  - `requestedUrl`
  - `finalUrl`
  - `crawlDepth`
- do not store `snapshotHtml`
- do not overwrite extracted content fields with empty values

For fetch failures with no response:

- record a failed segment or issue
- do not create a misleading snapshot row unless the system later adds explicit crawl-attempt logging

## Run Semantics

### Segments

Return segments that reflect crawl work:

- `seed`
- `robots:<host>`
- `fetch:<url>`
- `persist`

Each segment should report success or failure. Page-level `fetch:<url>` failures are allowed without failing the entire run if some pages were crawled successfully.

### Run status

- `success`: at least one page crawled and no material page or host failures occurred
- `partial_failed`: at least one page snapshot persisted, but one or more robots checks, fetches, or persists failed
- `failed`: no crawlable pages were successfully persisted

### Freshness and coverage

Freshness:

- `checkedAt` = sync completion time
- `latestDataAt` = sync completion time when at least one page snapshot is written, otherwise `null`

Coverage:

- `expectedSegments` = seed step + robots hosts attempted + page fetches attempted + persist step
- `succeededSegments` = successful segments count
- `ratio` = succeeded / expected
- `missingSegments` = failed seed, host, fetch, or persist segment identifiers

## Error Handling

Treat these as non-retryable validation failures:

- missing property binding
- property not found
- unsupported `fetchMode`
- malformed seed URLs in connector config
- invalid numeric limits

Treat these as retryable execution failures where appropriate:

- `robots.txt` fetch timeout or transient upstream failure
- page fetch timeout
- transient 5xx upstream failures
- temporary DNS or transport failures

Malformed HTML or missing extraction targets should not fail the crawl if the fetch itself succeeded.

## Testing Strategy

Follow TDD for implementation.

Required coverage:

- registers and runs the `crawler` connector through the existing framework
- seeds from sitemap-backed URLs before generic URL records
- respects include and exclude rules
- enforces max depth and max pages per run
- fetches and caches `robots.txt` per host
- skips pages disallowed by robots
- records partial failure when some pages or hosts fail but some snapshots persist
- captures HTTP status code and final URL
- extracts title, meta description, first H1, and canonical target
- counts valid internal links and enqueues shallow children
- stores raw fetched HTML in the snapshot
- computes stable content hash from HTML
- avoids overwriting existing content fields with nulls on non-HTML responses
- leaves a fetch engine seam that can support rendered mode later

## Extension Path For JS Rendering

Crawler v1 must keep the rendered-mode upgrade localized to the fetch layer.

Required seams:

- fetch engine interface returns normalized fetch output independent of retrieval method
- extraction consumes HTML and metadata, not transport-specific response objects
- persistence records `fetchMode`
- snapshot body storage is abstracted from crawl orchestration

Planned v2 shape:

- support `fetchMode: "rendered"`
- use a browser engine to wait for page stabilization and capture rendered HTML
- optionally add screenshot capture and extra DOM-derived fields
- preserve the same seed/rules/queue/persistence framework
