# WebOps Wizard Sitemap Ingestion Design

## Goal

Implement sitemap ingestion as a first-class connector that discovers sitemap sources, fetches sitemap XML, walks sitemap indexes and child sitemaps, extracts URLs plus sitemap metadata when available, deduplicates them, and persists placeholder page records that are immediately usable by downstream page intelligence and metrics ingestion.

## Scope

This design covers:

- a new `sitemap` connector in the worker connector framework
- sitemap URL discovery from explicit config, `/sitemap.xml`, and `robots.txt`
- recursive parsing of sitemap indexes and direct urlset documents
- URL normalization and deduplication before persistence
- placeholder `CanonicalPage` creation
- `UrlRecord` upserts with raw sitemap metadata preserved
- connector run reporting, partial-failure handling, and health tracking
- tests for discovery, parsing, dedupe, persistence, and failure behavior

This design does not cover:

- full page identity resolution beyond placeholder canonical pages
- cleanup of URLs that disappear from later sitemap syncs
- crawling page HTML content
- cross-property URL reconciliation
- non-XML sitemap formats beyond `robots.txt` discovery pointers

## Recommended Approach

Implement sitemap ingestion as a normal connector module within the existing worker sync framework.

- The connector is property-bound, like GA4 and GSC.
- It uses the existing sync runner, persistence, health, and issue reporting paths.
- It discovers one or more sitemap entrypoints, fetches XML, recursively traverses child sitemaps, and accumulates unique URL entries.
- It persists unresolved URLs by creating placeholder `CanonicalPage` rows immediately, then upserting `UrlRecord` rows tied to those placeholders.
- It leaves removals untouched. Sync is additive and refreshes existing observations rather than acting as a reconciliation pass.

This fits the current worker architecture and keeps GA4/GSC page matching functional without adding a separate staging model.

## Architecture

### Connector placement

Add a new connector module under `apps/worker/src/domains/integrations/connectors/sitemap/` and register it through the same registry used by GA4 and GSC.

The connector participates in the normal flow in `connector-sync.service.ts` and `runConnectorSync`, so it inherits:

- scheduled and manual sync execution
- `ConnectorSyncRun` history
- issue recording
- freshness and coverage metadata
- property-level health updates

### Config contract

The sitemap connector reads configuration from `integrationConnection.configJson`.

Supported fields:

- `sitemapUrl?: string`
- `connectorSchedule?: { everyMinutes: number }`
- `fetchTimeoutMs?: number`
- `maxSitemapsPerRun?: number`
- `maxUrlsPerRun?: number`

The connector must work with no configured sitemap URL by using auto-discovery.

### Discovery flow

Discovery order:

1. configured `sitemapUrl`, if present
2. `https://<property.primaryDomain>/sitemap.xml`
3. `https://<property.primaryDomain>/robots.txt` and any `Sitemap:` directives found there

Rules:

- Normalize and deduplicate discovered sitemap document URLs before fetch.
- If the configured sitemap URL is present, treat it as the highest-priority candidate but still allow fallback discovery if it fails.
- If no candidate produces at least one usable sitemap document, the sync fails.

### Fetch and parse flow

The connector fetches sitemap documents over HTTP(S) with redirect support, timeout enforcement, and response-size limits.

Each successfully fetched document is parsed as XML and classified as one of:

- sitemap index
- urlset
- invalid/unsupported sitemap document

For sitemap indexes, the connector enqueues child sitemap URLs for traversal.
For urlsets, the connector extracts entries from `<url>` nodes.

Traversal rules:

- breadth-first traversal
- keep a visited sitemap URL set to prevent loops
- stop after `maxSitemapsPerRun`
- stop after `maxUrlsPerRun`
- record child sitemap fetch/parse failures as issues
- return `partial_failed` when some child sitemaps fail but at least one sitemap produced persisted URLs

### URL extraction

For each `<url>` entry, extract:

- `loc` as the raw URL
- `lastmod` when present
- `changefreq` when present
- `priority` when present
- source sitemap document URL

Entries missing `loc`, containing invalid URLs, or outside the property domain policy should be skipped and recorded as issues or counters rather than aborting the run.

### Normalization and deduplication

Normalize URLs using the same property-scoped key logic already used by GA4 and GSC page matching:

- parse as a URL
- lowercase hostname
- trim trailing slashes from pathname
- ignore query string and fragment for the normalized key

Deduplicate at two levels:

- duplicate sitemap document URLs during traversal
- duplicate page URLs before persistence

When multiple sitemap entries resolve to the same normalized URL key, keep one persistence record and merge metadata conservatively:

- preserve the discovered raw URL from the first valid entry
- use the most recent `lastmod` if multiple values are present
- keep `changefreq` and `priority` when present from any valid entry
- preserve all producing sitemap document URLs in metadata

## Data Model

### UrlRecord metadata

Add `metadataJson Json?` to `UrlRecord` in `packages/db/prisma/schema.prisma`.

`source` remains a simple provenance label such as `"sitemap"`.
`metadataJson` stores sitemap-specific raw metadata without overloading canonical page fields.

Recommended metadata shape:

```json
{
  "provider": "sitemap",
  "discoveredFrom": [
    "https://example.com/sitemap.xml",
    "https://example.com/post-sitemap.xml"
  ],
  "lastmod": "2026-03-31T00:00:00.000Z",
  "changefreq": "weekly",
  "priority": 0.8
}
```

### Placeholder canonical pages

Sitemap ingestion creates placeholder `CanonicalPage` rows when no page exists for a normalized URL key.

Creation rules:

- `canonicalUrl` = the discovered raw URL
- `normalizedUrlKey` = normalized property-scoped key
- `firstSeenAt` = sync timestamp
- `lastSeenAt` = sync timestamp
- optional descriptive fields remain null
- status and indexability use existing defaults

These placeholders are intentionally minimal so later page identity resolution can refine or merge them without losing the original sitemap observation.

### UrlRecord upsert rules

Upsert `UrlRecord` by `(propertyId, normalizedUrlKey)`.

On create:

- set `canonicalPageId` to the existing or newly created canonical page
- set `rawUrl` to the discovered raw URL
- set `isCurrentAlias` to `true`
- set `firstSeenAt` and `lastSeenAt` to the current sync timestamp
- set `source` to `"sitemap"`
- set `metadataJson` to the extracted sitemap metadata payload

On update:

- preserve `firstSeenAt`
- update `lastSeenAt` to the current sync timestamp
- keep `canonicalPageId` aligned with the resolved placeholder or existing page
- refresh `rawUrl` if the stored value is empty or malformed, otherwise preserve the existing raw alias
- overwrite `source` with `"sitemap"`
- merge and replace `metadataJson` with the current best-known sitemap metadata

The connector does not mark old sitemap rows inactive when URLs disappear from later runs.

## Sync Semantics

### Segments

Return connector segments that reflect the actual work:

- `discovery`
- `fetch`
- `parse`
- `persist`

Each segment should report success or failure and include record counts where useful.

### Run status

- `success`: discovery, parsing, and persistence complete with no material issues
- `partial_failed`: at least one sitemap document or URL batch persisted, but one or more child documents failed
- `failed`: no usable sitemap data could be discovered, fetched, or persisted

### Freshness and coverage

Freshness metadata should use the sync completion time as `checkedAt` and the newest extracted `lastmod` value, if any, as `latestDataAt`.

Coverage metadata should reflect sitemap processing work:

- `expectedSegments`: number of sitemap documents attempted plus persistence
- `succeededSegments`: number of successful segments
- `ratio`: succeeded / expected
- `missingSegments`: failed discovery/fetch/parse sub-areas when applicable

## Error Handling

Treat these as non-retryable validation failures:

- missing property binding
- property not found
- malformed configured sitemap URL

Treat these as retryable execution failures where appropriate:

- transient HTTP failures
- request timeouts
- temporary upstream availability issues

Malformed individual child sitemaps or malformed individual `<url>` entries should not fail the entire run if other sitemap data was successfully processed.

## Testing Strategy

Follow TDD for the implementation.

Required test coverage:

- registers and runs the `sitemap` connector through the existing framework
- discovers sitemap candidates in the correct precedence order
- falls back from configured URL to `/sitemap.xml` and `robots.txt` when necessary
- parses direct urlset documents
- parses sitemap indexes and recursively processes child sitemaps
- prevents loops with repeated child sitemap references
- extracts `loc`, `lastmod`, `changefreq`, and `priority`
- deduplicates repeated page URLs across child sitemaps
- creates placeholder canonical pages when none exist
- upserts existing `UrlRecord` rows while preserving `firstSeenAt`
- persists `metadataJson` on `UrlRecord`
- returns `partial_failed` when one child sitemap fails but others succeed
- returns `failed` when no usable sitemap source succeeds

## Implementation Notes

Code should stay split into focused units instead of one large connector file.

Recommended internal modules:

- discovery helper
- XML parser and node extraction helper
- traversal coordinator
- persistence store
- connector entrypoint

This keeps fetch/parsing logic independently testable from Prisma persistence and sync orchestration.
