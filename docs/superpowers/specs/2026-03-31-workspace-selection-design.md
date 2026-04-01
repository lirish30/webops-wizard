# WebOps Wizard Workspace Selection Design

## Goal

Build a workspace selection experience for users with access to multiple workspaces that supports recent workspaces, search, role badges, and last active workspace memory, while guaranteeing that no cross-workspace preview data is exposed through the selector UI or its supporting APIs.

## Scope

This design covers:

- a metadata-only workspace switcher experience in the web app
- backend endpoints for workspace switcher data and active workspace changes
- server-side last-active workspace memory
- search over authorized workspace identity metadata
- role badge display in the selector
- contract and UI constraints that prevent cross-workspace preview leakage

This design does not cover:

- cross-workspace alert counts, report summaries, sync states, or health previews
- pinned or favorite workspaces
- organization-level grouping beyond a flat authorized workspace list
- cross-workspace keyboard command palette behavior outside the selector surface

## Recommended Approach

Use a dedicated selector contract separate from general workspace or dashboard APIs.

- The backend returns only selector-safe metadata for workspaces the user already has membership in.
- The frontend renders only that metadata and never fetches workspace operational data for non-active workspaces.
- Search runs locally or against a selector-specific endpoint over authorized workspace metadata only.
- Last-active memory is stored server-side so ordering is stable across browsers and sessions.

This keeps the selector intentionally narrow and makes the non-leak guarantee enforceable by design rather than by convention.

## Architecture

### Selector boundary

Treat the workspace switcher as an identity-and-context surface, not an analytics surface.

Allowed selector fields:

- workspace id
- workspace name
- workspace slug if needed for routing
- user role in that workspace
- whether the workspace is currently active
- last active timestamp

Disallowed selector fields:

- property names
- alert counts
- report summaries
- sync recency
- integration status
- recommendations counts
- any tenant-specific metrics, activity streams, or business previews

The selector response contract should be defined in a dedicated DTO/type so richer workspace APIs cannot accidentally bleed into it.

### Domain ownership

- `workspaces` owns workspace selector summaries and last-active ordering rules
- `auth` owns the active workspace in session context
- `web` consumes selector-safe metadata and never infers hidden data from other APIs

### Data source

The selector should be driven from canonical membership data plus a lightweight last-visited record. It must not join to product-domain tables for display enhancements.

## Data Model

Extend the workspace/membership model only as far as needed to support recency and active selection memory.

### Membership-based recency

Preferred approach:

- add `lastActiveAt` to `WorkspaceMembership`

This keeps recent workspace memory tied directly to the user-workspace relationship and avoids inventing a separate preference table too early.

Rules:

- update `lastActiveAt` when a user switches into a workspace
- optionally update it on meaningful authenticated activity within the active workspace if needed later
- sort recents using `lastActiveAt` descending

### Session active workspace

The active workspace remains session-level state.

- auth/session payload stores the active workspace id
- workspace switch updates that session state after verifying membership
- selector summaries mark the current workspace using trusted server session context

### Search data

Search should operate only over:

- workspace name
- workspace slug

Role labels may be displayed, but they should not be required as search terms in the first pass.

## Backend Flows

### Workspace selector summary

Add an authenticated endpoint such as:

`GET /workspaces/switcher`

Response shape per workspace:

- `id`
- `name`
- `slug`
- `role`
- `isActive`
- `lastActiveAt`

Response-level behavior:

- include only workspaces where the caller has active membership
- order with recent workspaces first
- optionally include a `recentWorkspaces` subset plus a full list if that helps the UI, but both collections must contain only selector-safe metadata

### Workspace switching

Add an authenticated endpoint such as:

`POST /workspaces/switch`

Request:

- target workspace id

Behavior:

- verify the caller has active membership in the target workspace
- update active workspace in session context
- update that membership’s `lastActiveAt`
- return updated selector/session summary

### Search

Preferred first pass:

- fetch the authorized selector list once
- perform search client-side over selector-safe metadata

This avoids incremental search endpoints and reduces the chance of accidental data expansion.

If server-side search is added later, it must remain bound to the same metadata-only DTO and membership filters.

## Frontend Experience

### App shell integration

Replace the static workspace button in the app shell with a real selector trigger.

The trigger should show:

- current workspace name
- current role badge or concise role label

Opening the selector should reveal:

- search input
- recent workspaces section when applicable
- full workspace list

### Search behavior

- search filters only the already-authorized selector list
- matching is based on workspace name and slug
- no network fetches are triggered by hover, focus, or type-ahead in the first pass

### Role badges

Display a badge or pill for the caller’s role in each listed workspace.

Role badges are presentational metadata only. They must not imply that the selector itself can perform privileged actions.

### Recent workspaces

Show a recent section above the full list when the user has multiple workspaces with `lastActiveAt` values.

Rules:

- current workspace may appear in recents
- recent ordering is based on server-provided `lastActiveAt`
- if no recents exist yet, fall back to alphabetical listing

### Switching behavior

Switching must be explicit.

- clicking or selecting a workspace sends the switch request
- after success, session and route state revalidate
- tenant-bound data for the new workspace is loaded only after the switch completes

The UI must not preload dashboard or surface-specific data for other workspaces to make switching “feel faster.”

## Non-Leak Guarantee

This is the central requirement.

### API contract guarantee

The selector API must never include:

- counts
- summaries
- preview snippets
- product object names
- health indicators
- timestamps derived from product activity other than selector-owned `lastActiveAt`

If a future product request needs richer cross-workspace browsing, it must use a new explicitly reviewed API rather than extending the selector response.

### Frontend guarantee

The selector UI must never:

- prefetch non-active workspace dashboards
- show hover cards with workspace-specific business data
- render cached previews from previously visited workspaces inside the selector
- derive counts or labels by reading global cached product queries from another workspace

The selector should operate from its own isolated metadata source.

### Cache isolation

If the frontend uses request caching or client query state later, cache keys must include `workspaceId` for tenant-bound data. The selector’s metadata cache must remain separate from workspace-dashboard caches so previous active workspace data cannot bleed into the switcher.

### Server-side enforcement

The selector endpoint must source its response from:

- memberships
- workspace identity fields
- active session workspace id
- membership-level `lastActiveAt`

Nothing else.

This hard boundary should be enforced in the service layer and covered by tests.

## Accessibility And UX

- search input should receive focus when the selector opens
- keyboard navigation should allow moving through the list and confirming a switch
- active workspace should be clearly labeled
- role badges should be readable and not rely on color alone
- empty search results should show a simple “No matching workspaces” state without suggesting unauthorized workspaces exist

## Testing Strategy

### Backend tests

- selector endpoint returns only authorized workspaces
- selector DTO excludes non-approved fields
- switching updates active workspace and `lastActiveAt`
- unauthorized switch attempts are rejected

### Frontend tests

- selector renders current, recent, and full workspace lists correctly
- search filters locally over metadata-only results
- role badges render per workspace
- switch action reloads into the selected workspace context
- no preview panel or preview data renders for non-active workspaces

### Security and regression tests

- ensure selector responses never gain product metrics or preview fields
- ensure cached data from a previous workspace is not rendered inside the selector after switching
- ensure direct API tampering with an unauthorized workspace id does not reveal whether the workspace exists

## Deliverables

The workspace selector is complete when:

- multi-workspace users can open a selector from the app shell
- the selector shows recent workspaces, search, role badges, and the active workspace
- last-active ordering persists across sessions
- switching workspaces updates server session context
- no cross-workspace preview data is exposed in the selector UI or API

## Risks

- UI convenience work can accidentally pressure the selector API to grow beyond safe metadata.
- Cached active-workspace product data can bleed into the selector if cache boundaries are not explicit.
- Search enhancements can become a leak vector if they start querying richer workspace read models.

## Success Criteria

This workspace selection experience is acceptable when:

- users with multiple memberships can quickly locate and switch workspaces
- recent workspaces reflect real server-side usage memory
- role context is visible in the selector
- the selector remains metadata-only
- no cross-workspace operational preview data is shown or fetched
