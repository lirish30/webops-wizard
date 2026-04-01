# WebOps Wizard Audit Log Framework Design

## Goal

Implement a shared audit log framework that records member invites, removals, role changes, integration changes, report sends, AI generation events, approval actions, and settings changes through a standard event schema, request-context middleware hooks, and a tenant-scoped query API.

## Scope

This design covers:

- standard audit event schema and persistence model
- shared audit framework placement in the backend architecture
- request-context middleware for actor, workspace, and request metadata
- explicit audit emitters/hooks from domain application services
- query API for listing and filtering audit events
- tenant isolation and RBAC for audit log reads

This design does not cover:

- logging arbitrary HTTP requests as audit events
- prompt or generated-content snapshots for AI events
- a full user-facing audit timeline UI
- export pipelines or long-term archival policies
- background stream processing for audit ingestion

## Recommended Approach

Use a centralized audit framework with explicit event emission.

- request middleware captures context such as actor, request id, active workspace, and origin
- application services emit audit events intentionally when governed actions succeed
- a shared audit writer persists a canonical event record
- a dedicated query API returns normalized, tenant-scoped audit history

This avoids lossy inference from raw requests and keeps audit records aligned with real business actions.

## Architecture

### Placement

Audit logging belongs in the shared kernel as a cross-cutting primitive, not as a sub-feature of one product domain.

The framework should provide:

- audit event types and schema definitions
- request-scoped audit context
- audit write interface
- audit persistence adapter
- audit query service

Domains remain responsible for deciding when a meaningful audit event occurred. The shared framework is responsible for normalizing and persisting it.

### Ownership split

- shared audit framework owns:
  - event schema
  - context propagation
  - storage
  - querying
- capability domains own:
  - event emission decisions
  - domain-specific target resource typing
  - before/after change extraction for their own actions

### Event emission model

Use explicit application-layer emission, not controller-only logging and not database-trigger inference.

Examples:

- workspaces emits member invite, member removal, and role-change events
- integrations emits integration-change events
- reports emits report-send events
- AI-related service emits AI generation events
- approvals workflow emits approval action events
- settings emits settings-change events

An audit event should only be recorded once the associated action has succeeded or reached its terminal outcome.

## Standard Event Schema

Define one canonical audit event contract.

### Required fields

- `id`: unique audit event id
- `occurredAt`: timestamp of the audited action
- `workspaceId`: tenant root for the event
- `actorUserId`: acting user id when available
- `actorType`: such as `user` or `system`
- `category`: high-level grouping such as `membership`, `integration`, `report`, `ai_generation`, `approval`, `settings`
- `eventType`: concrete action name
- `targetType`: resource type affected by the action
- `targetId`: resource identifier affected by the action when applicable
- `status`: such as `succeeded`, `failed`, `rejected`
- `requestId`: request correlation id when available

### Optional but important fields

- `membershipId`: when the target is a membership action
- `propertyId`: when the target action is property-bound
- `ipAddress`
- `userAgent`
- `reason`: normalized reason or note when the action carries one
- `metadataJson`: structured event-specific metadata constrained to audit-safe fields
- `beforeJson`: normalized pre-change field snapshot when relevant
- `afterJson`: normalized post-change field snapshot when relevant

### Schema rules

- keep the top-level schema stable and small
- put domain-specific details in structured metadata fields
- do not store raw secrets, tokens, prompts, generated content, or unrelated payload dumps
- use consistent enum values for categories, event types, target types, and statuses

## Event Catalog

Record only the requested event families in the first pass.

### Membership events

- `membership.invite_created`
- `membership.removed`
- `membership.role_changed`

Expected target types:

- `workspace_membership`
- `workspace_invite`

### Integration events

- `integration.created`
- `integration.updated`
- `integration.disconnected`

Expected target type:

- `integration_connection`

### Report events

- `report.sent`

Expected target type:

- `report`

### AI generation events

- `ai_generation.started`
- `ai_generation.completed`
- `ai_generation.failed`

Expected target type:

- `ai_job`
- or another stable internal AI generation resource id

These events should include model identifier, feature surface, and job or output reference ids as metadata if useful, but not prompt text or generated content snapshots.

### Approval events

- `approval.approved`
- `approval.rejected`

Expected target type:

- `approval_request`
- or the governed entity type if approvals are embedded in another domain model

### Settings events

- `settings.updated`

Expected target type:

- `workspace_settings`
- or a more specific settings resource type when needed

## Data Model

Add a dedicated audit event table in Prisma, for example `AuditEvent`.

Suggested fields:

- `id`
- `workspaceId`
- `actorUserId`
- `actorType`
- `category`
- `eventType`
- `targetType`
- `targetId`
- `status`
- `requestId`
- `propertyId`
- `ipAddress`
- `userAgent`
- `reason`
- `metadataJson`
- `beforeJson`
- `afterJson`
- `occurredAt`
- `createdAt`

Index for:

- `workspaceId` + `occurredAt`
- `workspaceId` + `category`
- `workspaceId` + `eventType`
- `workspaceId` + `targetType` + `targetId`
- `workspaceId` + `actorUserId`

The table must be tenant-rooted by `workspaceId` so query isolation is explicit.

## Middleware And Context Hooks

### Request audit context

Add middleware or request-scoped bootstrap logic that captures:

- request id
- authenticated actor id if present
- active workspace id if resolved
- ip address
- user agent
- request origin metadata

This context should be attached to the request lifecycle and made accessible to application services through a small context provider abstraction.

### Why middleware is not the logger

Middleware must not blindly create audit events from every route hit.

Its job is to provide consistent context so application services can emit accurate domain events after the business action is known to have happened.

### System and worker actions

The audit framework should also support non-request actors.

- `actorType = system` for worker-driven or automated actions
- request fields may be null when not applicable

This keeps the framework usable for report sends or AI jobs triggered outside direct UI requests.

## Backend Flows

### Writing an audit event

The standard sequence should be:

1. request context is established
2. domain application service performs the action
3. service builds a typed audit event payload
4. shared audit writer enriches it with context and persists it

Audit writes should happen in the same logical unit of work as the action when practical, especially for membership, settings, and integration changes.

### Before and after snapshots

For change-oriented events like role changes, integration updates, and settings changes:

- `beforeJson` should include only relevant changed fields
- `afterJson` should include only relevant changed fields
- snapshots should be normalized, not full object dumps

### Failure recording

The framework supports `failed` or `rejected` status, but domains should use it deliberately.

Examples:

- approval rejected
- AI generation failed

Do not emit noisy failed audit events for generic validation errors unless the action is governance-significant and intentionally audited.

## Query API

Add a tenant-scoped query endpoint such as:

`GET /audit-events`

### Filters

Support filters for:

- `workspaceId` or implicit active workspace when policy allows
- `category`
- `eventType`
- `actorUserId`
- `targetType`
- `targetId`
- `status`
- date range
- pagination cursor or page/limit

### Response shape

Return normalized audit records using the standard event schema plus pagination metadata.

The API should not expose internal database-only fields or unbounded raw metadata blobs.

### Authorization

Audit log reads must be protected by workspace RBAC.

Recommended default:

- only roles with a dedicated audit-read capability can query audit events

The capability name can be something like `workspace.audit.read`.

## Tenant Isolation And Security

### Isolation rules

- every audit query must be workspace-scoped server-side
- callers must never query events outside their authorized workspace memberships
- target resource filters must still remain within the resolved workspace scope

### Sensitive data rules

Never store in audit events:

- passwords
- access or refresh tokens
- invite tokens
- reset tokens
- API secrets
- full request bodies by default
- AI prompt text
- AI generated content snapshots

### Leakage prevention

If a caller requests `targetId` values from another workspace:

- return no records or a non-disclosing authorization response
- do not reveal whether matching events exist elsewhere

## Testing Strategy

### Schema and writer tests

- event schema validation accepts only approved top-level fields
- audit writer enriches domain events with request context
- sensitive fields are excluded from persistence

### Domain emission tests

- member invite, removal, and role change actions emit correct event types
- integration changes emit correct target and before/after data
- report sends emit report events
- AI generation emits status transitions without content snapshots
- approval actions emit approved/rejected events
- settings changes emit normalized diffs

### Query tests

- filters return only matching events
- pagination is stable
- workspace scoping blocks cross-tenant reads
- unauthorized users cannot query audit history

### Regression tests

- middleware alone does not create phantom audit events
- audit records do not include prompt text or generated content
- event catalogs remain limited to approved audited action types in the first pass

## Deliverables

The audit framework is complete when:

- a canonical audit event schema exists
- request context middleware supplies actor and request metadata
- listed governed actions emit audit events through shared hooks
- audit events persist in a tenant-scoped table
- a filtered query API returns normalized audit records
- tenant isolation and RBAC protect audit log reads

## Risks

- Ad hoc emission can drift if domains bypass the shared writer.
- Overly large metadata payloads can turn the audit log into an unstructured dump.
- Query endpoints can become a leakage surface if tenant scope is not enforced before applying filters.

## Success Criteria

This audit framework is acceptable when:

- the requested event families are recorded consistently
- all events follow the same schema
- request and actor context are attached automatically
- audit queries are filterable and tenant-scoped
- no secrets, prompts, or generated content snapshots are stored in the audit log
