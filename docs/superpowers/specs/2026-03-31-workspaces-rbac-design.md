# WebOps Wizard Workspaces And RBAC Design

## Goal

Implement a multi-tenant workspace foundation for WebOps Wizard with users, workspaces, memberships, and server-enforced roles. The system must enforce tenant isolation on every protected endpoint and provide a reusable RBAC model that all current and future domains consume consistently.

## Scope

This design covers:

- workspace tenancy ownership in the API
- workspace, membership, and role modeling in Prisma
- automatic personal workspace creation during self-sign-up
- invite-driven membership attachment for additional workspaces
- active workspace context resolution for authenticated requests
- server-side RBAC enforcement on all protected endpoints
- frontend workspace selection and session-aware workspace context
- shared authorization primitives for future domains

This design does not cover:

- billing plan enforcement
- workspace deletion workflows
- organization hierarchies beyond workspaces
- custom role creation
- property-level delegated RBAC beyond workspace-rooted permissions

## Recommended Approach

Use workspace-rooted logical tenancy with centralized authorization.

- `workspaces` owns tenant boundaries, membership facts, role definitions, and access policy semantics.
- `auth` owns user identity and sessions, but not tenant permissions.
- Every protected request resolves an active workspace context server-side before domain logic executes.
- Every tenant-bound query and mutation must include a workspace scope check at the repository or service boundary.
- RBAC is declared through shared policy helpers and guards rather than ad hoc controller logic.

This aligns with ADR 0007 and avoids leaking authorization semantics across domains.

## Architecture

### Domain ownership split

Keep the domain boundary explicit:

- `auth` owns:
  - `User`
  - sign-in and session issuance
  - identity provider linkage
  - invite token acceptance mechanics
- `workspaces` owns:
  - `Workspace`
  - `WorkspaceMembership`
  - workspace roles
  - active workspace access rules
  - tenant context resolution
  - authorization policy interfaces

Invite acceptance may be initiated in `auth`, but membership creation and role assignment must be delegated to `workspaces`.

### Shared kernel primitives

Add a small shared authorization layer for:

- authenticated principal context
- active workspace context
- membership snapshot type
- role-to-capability mapping
- request decorators and guards

This shared layer must expose interfaces and value objects, not domain-specific business logic.

### Request lifecycle

All protected API requests should follow the same sequence:

1. authenticate the caller from the session cookies
2. resolve target workspace from route param, request body, query, or active session workspace
3. load membership for the caller in that workspace
4. reject if no membership exists
5. evaluate required role capability for the endpoint
6. execute tenant-scoped domain logic

Controllers should declare the required access rule. They should not manually fetch membership data or branch on role strings.

## Data Model

The current Prisma schema already includes `User`, `Workspace`, and `WorkspaceMembership`. Tighten those models and add only what is required for durable tenancy behavior.

### User

Keep `User` independent from any single workspace. A user may belong to multiple workspaces through memberships.

### Workspace

`Workspace` remains the tenant root.

- `id` is the tenant partition key
- `slug` is globally unique for routing and lookup
- `ownerUserId` is retained as a convenience invariant, but owner authority still resolves through membership role semantics

Personal workspaces should be first-class workspaces, not a separate entity type. A new self-sign-up creates one default workspace and an `owner` membership in the same transaction.

### WorkspaceMembership

`WorkspaceMembership` is the canonical role record.

Supported roles:

- `owner`
- `admin`
- `manager`
- `analyst`
- `viewer`
- `external_stakeholder`
- `agency_manager`
- `client_viewer`

Rules:

- one membership row per user/workspace pair
- role changes happen by updating the existing membership
- only active memberships count toward authorization

If soft removal is needed, add membership status fields rather than deleting rows blindly so auditability remains possible.

### Session context

The auth/session layer should carry an active workspace identifier in session payloads or session lookup responses, but never treat it as authorization by itself. Authorization always requires a fresh membership check against the database or an equivalent trusted membership read model.

### Tenant-root requirements for other entities

Every tenant-bound model must satisfy one of these rules:

- it stores `workspaceId` directly, or
- it references an entity that can deterministically resolve to exactly one `workspaceId`

Current examples:

- `Property` stores `workspaceId` directly
- `IntegrationConnection` already stores `workspaceId`
- downstream entities like `Recommendation`, `Alert`, and `ReleaseAnnotation` resolve workspace scope through `Property`

Repository and service code must still apply the resolved workspace filter explicitly. Indirect linkage is not enough on its own.

## Role Model

Use capabilities, not scattered role comparisons.

### Base semantics

- `owner`: full control of workspace lifecycle, membership management, and privileged configuration
- `admin`: broad operational control, but cannot take actions reserved to the owner if owner-only behavior is introduced
- `manager`: can manage operational resources and team workflows but not all admin-level settings
- `analyst`: can access analysis-oriented product areas and create/update non-administrative artifacts
- `viewer`: read-only internal access
- `external_stakeholder`: limited read-oriented access for external collaborators
- `agency_manager`: elevated multi-surface access intended for agency operators
- `client_viewer`: constrained client-facing read access

### Capability mapping

Define reusable capabilities such as:

- `workspace.read`
- `workspace.update`
- `workspace.memberships.read`
- `workspace.memberships.manage`
- `workspace.invites.manage`
- `property.read`
- `property.write`
- `integration.manage`
- `reports.read`
- `settings.manage`

Map roles to capabilities in one workspace-owned policy module. Other domains request capabilities, not role names.

### Owner invariants

Protect these invariants:

- a workspace must always have at least one `owner`
- self-sign-up personal workspace creation must always create exactly one owner membership
- owner removal or demotion must be blocked if it would leave the workspace without an owner

## Backend Flows

### Self-sign-up

When a user signs up through the auth flow:

- create the user
- create a default personal workspace
- create an `owner` membership linking the user to that workspace
- set the new workspace as the active workspace in the returned session payload

This must be transactional so the system never creates a standalone user without a tenant root.

### Invite acceptance

When an invited user accepts:

- validate the invite in auth
- delegate membership creation or confirmation to `workspaces`
- attach the user to the invited workspace with the invited role
- if the user already has a personal workspace, preserve it
- optionally switch the active workspace to the invited workspace after acceptance

The system must prevent duplicate memberships for the same user and workspace.

### Workspace switching

Add a workspace context mutation such as `POST /workspaces/switch` or equivalent session update endpoint.

- accepts a target workspace id
- verifies the user has membership
- updates the active workspace in session context
- returns the new session/workspace summary

This is a convenience for UI state and routing. It does not bypass per-request authorization checks.

### Membership management

Add protected workspace membership endpoints such as:

- `GET /workspaces/:workspaceId/memberships`
- `PATCH /workspaces/:workspaceId/memberships/:membershipId`

These routes must be guarded by workspace capability checks, likely `workspace.memberships.read` and `workspace.memberships.manage`.

### Protected endpoint enforcement

Every protected route in every domain must require:

- authenticated principal
- resolved workspace context
- membership existence in that workspace
- capability check appropriate to the endpoint

No domain should expose workspace-bound data with only “user is authenticated” as a gate.

## Authorization Enforcement Model

### Guards and decorators

Add shared Nest primitives such as:

- authentication guard for cookie-backed session identity
- workspace context guard or interceptor
- capability guard
- decorators for `@CurrentUser()`, `@CurrentWorkspace()`, and `@RequireCapability()`

These should compose cleanly so controllers remain declarative.

### Repository and service discipline

Guard-level checks are necessary but not sufficient.

Service and repository methods must accept workspace scope explicitly for tenant-bound operations. Examples:

- `listProperties(workspaceId, actor)`
- `getWorkspaceMembership(workspaceId, userId)`
- `findRecommendationsForWorkspace(workspaceId, filters)`

This prevents accidental unscoped queries from slipping in underneath authorized controllers.

### Cross-workspace rejection

If a user requests a resource tied to another workspace:

- return 404 or 403 according to the endpoint’s leakage policy
- do not reveal whether the target resource exists outside the authorized tenant scope

The default posture should favor non-disclosure for direct object lookups.

## Frontend Flows

### Session and workspace context

The session payload returned to the web app should include:

- current user identity
- list of workspace memberships
- active workspace id
- active workspace role summary

This lets the UI render workspace navigation and route users into the correct tenant context without trusting the frontend to authorize anything.

### Personal workspace onboarding

After self-sign-up:

- redirect the user into the default personal workspace
- show product surfaces within that workspace context immediately

No intermediate “choose or create workspace” step is needed for the first pass.

### Workspace switching UX

Add a workspace switcher in the authenticated app shell once session-aware auth exists.

- switching workspaces updates server session context
- protected page loaders and API calls use the active workspace
- routes that embed `workspaceId` must stay consistent with the selected workspace

### Membership and role-sensitive UI

The UI may hide or disable actions based on session role/capability summaries, but this is only a convenience. Server-side RBAC remains authoritative.

## Tenant Isolation Rules

These rules are non-negotiable:

- every protected read is workspace-scoped server-side
- every protected write validates workspace membership server-side
- every tenant-bound persistence query includes workspace filters or equivalent scoped joins
- no client-provided role or workspace claim is trusted without server verification
- no domain invents its own parallel tenant model

When a resource resolves through a parent entity, the service must verify the full chain belongs to the current workspace before reading or mutating it.

## Testing Strategy

Implement tenancy and RBAC with explicit negative tests.

### API tests

- membership resolution tests
- capability mapping tests
- guard tests for missing membership and insufficient role
- integration tests that verify users cannot access another workspace’s data even when resource ids are known

### Database and service tests

- personal workspace creation is transactional with sign-up
- invite acceptance adds membership without duplicates
- owner invariants are enforced on role changes
- workspace-scoped query helpers do not return cross-tenant rows

### Web tests

- session payload drives workspace switcher state
- post-sign-up lands in the personal workspace
- unauthorized workspace navigation is rejected and redirected appropriately

## Deliverables

The workspace/RBAC foundation is complete when:

- self-sign-up creates a personal workspace and owner membership
- users can belong to multiple workspaces through memberships
- all listed roles exist in the canonical membership model
- protected API endpoints require tenant context plus capability checks
- tenant-bound queries are workspace-scoped server-side
- the web app can render and switch active workspace context from session data

## Risks

- Centralized guards can create a false sense of safety if repositories still allow unscoped access.
- Role names may drift from actual permissions if capability mapping is not kept as the only source of truth.
- Active workspace session context can become stale if membership changes are not reflected on subsequent session loads.
- Existing and future domains can accidentally bypass isolation if workspace scope is not mandatory in service method signatures.

## Success Criteria

This workspace and RBAC foundation is acceptable when:

- users and workspaces are linked through canonical memberships
- new self-sign-ups always have a valid tenant root
- invited users can join additional workspaces without losing prior memberships
- server-side RBAC determines access on every protected endpoint
- cross-workspace reads and writes are rejected reliably
- future domains can plug into shared workspace access policies instead of re-implementing authorization logic
