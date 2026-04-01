# WebOps Wizard Auth Foundation Design

## Goal

Implement a production-grade authentication foundation for WebOps Wizard that supports email/password sign-in, placeholder Google and Microsoft SSO, JWT access and refresh tokens over secure `HttpOnly` cookies, password reset, invited-user acceptance, and session-aware frontend routing. The design must leave clean seams for future SAML SSO, SCIM provisioning, and real outbound email delivery.

## Scope

This design covers:

- backend auth module structure in `apps/api`
- frontend auth flows in `apps/web`
- Prisma schema changes for users, sessions, invites, reset tokens, and provider configuration
- secure cookie-based browser sessions
- password reset request and completion flows without email delivery
- invited-user acceptance flow for workspace onboarding
- placeholder Google and Microsoft provider flows
- contracts and abstractions that allow future SAML and SCIM expansion

This design does not cover:

- real Google OAuth implementation
- real Microsoft OAuth implementation
- SAML identity provider implementation
- SCIM provisioning endpoints
- outbound transactional email provider integration
- admin UX for full identity-provider configuration management

## Recommended Approach

Use a backend-owned session model.

- The API issues short-lived JWT access tokens and longer-lived rotating refresh tokens.
- Both tokens are delivered through `HttpOnly` cookies rather than exposed to browser JavaScript.
- The web app reads authenticated state from a dedicated session endpoint and server-side redirects rather than storing bearer tokens in local storage or React state.
- Prisma persists hashed refresh tokens, password reset tokens, workspace invite tokens, and provider metadata so revocation and audit rules live server-side.
- Google and Microsoft are represented as configured provider types now, but their routes intentionally terminate in placeholder responses until real OAuth is wired in.

This gives the current browser experience strong defaults while preserving a clean path to future enterprise identity features.

## Architecture

### API auth module

Create a real `auth` domain in `apps/api/src/domains/auth` with four internal layers:

- `presentation`: Nest controllers, DTO schemas, cookie helpers, guards, and request decorators
- `application`: use-case services such as `signIn`, `signUp`, `refreshSession`, `requestPasswordReset`, `resetPassword`, `createInvite`, `acceptInvite`, and `getSession`
- `domain`: auth-centric types, token policies, provider enums, and security rules
- `infrastructure`: Prisma repositories, password hashing adapter, JWT signer/verifier, token generator, and clock helpers

The auth domain must be self-contained. Other domains should consume authenticated user identity and workspace membership through exported interfaces instead of reaching into auth internals.

### Session model

Use two-token browser sessions:

- Access token: short TTL, signed JWT, used by API guards after cookie extraction
- Refresh token: longer TTL, opaque random token or JWT-backed identifier, stored hashed in the database and rotated every refresh

The API sets cookies on successful sign-in, sign-up completion, invite acceptance, password reset completion, and refresh. Logout revokes the active session and clears both cookies.

Session validation for the web app should be done through `GET /auth/session`, which returns the authenticated user, session metadata, and workspace memberships if the access token is valid or refresh succeeds.

### Extensibility for SSO, SAML, and SCIM

Do not hard-code authentication logic around the current three providers. Instead:

- model identity providers explicitly with a provider type enum such as `local`, `google_oauth`, `microsoft_oauth`, `saml`
- keep external identity linkage separate from `User`
- define a provider service interface so OAuth placeholder routes and future SAML entry points can share a stable controller boundary
- keep user lifecycle and session issuance in core auth services, not in provider-specific handlers
- reserve a separate provisioning seam for future SCIM work, likely under an `identity-directory` or `provisioning` module that can create, suspend, and map users without rewriting sign-in logic

This structure avoids conflating local credentials, federated identity, and directory provisioning.

## Data Model

Extend `packages/db/prisma/schema.prisma` with dedicated auth records.

### User updates

Keep `User` as the canonical principal but reduce overloaded fields.

- retain `email`, `passwordHash`, `fullName`, and `status`
- stop using a single `authProvider` field as the primary source of truth for future multi-provider accounts
- allow invited users to exist before password creation

### New models

Add:

- `AuthSession`
  - one row per active or revoked refresh session
  - stores user id, hashed refresh token, expiry, rotation metadata, user agent, ip address, revoked timestamp, and reuse detection timestamps
- `PasswordResetToken`
  - stores user id, hashed token, expiry, consumed timestamp
  - only one active reset token should be usable at a time per user
- `WorkspaceInvite`
  - stores workspace id, email, role, inviter id, hashed token, expiry, accepted timestamp, and linked accepted user id
  - invite acceptance can create a user or attach an existing user with the same normalized email
- `IdentityProvider`
  - stores provider type, display name, enabled status, placeholder config JSON, and future SAML metadata fields
- `ExternalIdentityLink`
  - stores user id, provider id/type, provider subject identifier, email snapshot, and login timestamps

Optional but useful:

- `AuthAuditEvent`
  - stores security-relevant events like sign-in success/failure, password reset requested, invite accepted, refresh reuse detected

### Token storage rules

- Never store raw refresh, reset, or invite tokens in the database.
- Persist only hashed token values.
- Compare hashed forms on lookup.
- Mark one-time tokens as consumed immediately after successful use.

## Backend Flows

### Sign up

`POST /auth/sign-up`

- accepts name, email, and password
- normalizes email
- hashes password
- creates active user
- creates a starter auth session
- returns sanitized user/session payload and sets cookies

If the email matches an outstanding invite, sign-up should be rejected in favor of invite acceptance so workspace role assignment stays explicit.

### Sign in

`POST /auth/sign-in`

- accepts email and password
- verifies the password against local credentials
- rejects invited users who have not accepted their invite
- creates and persists a new auth session
- sets access and refresh cookies

Responses must not reveal whether the email exists beyond what is required for valid credential failure behavior.

### Sign out

`POST /auth/sign-out`

- revokes the current refresh session if present
- clears auth cookies
- always returns success

### Refresh

`POST /auth/refresh`

- reads refresh cookie
- validates token against persisted hashed record
- detects reuse or revoked tokens
- rotates to a new refresh token and access token pair
- revokes the old session token record
- sets fresh cookies

If reuse is detected, revoke the entire session chain for that user and force re-authentication.

### Session introspection

`GET /auth/session`

- reads the access cookie
- if valid, returns session payload
- if expired but refresh is valid, rotates and returns renewed session payload
- if unauthenticated, returns 401 without leaking extra state

The payload should include:

- user id, email, full name, status
- active workspace memberships and roles
- current auth methods available for the account

### Forgot password

`POST /auth/password/forgot`

- accepts email
- always returns a generic success payload
- if the user exists and is eligible for local auth, creates a one-time reset token
- returns a placeholder reset link payload in non-production or for internal admin/testing use only

Because email delivery is out of scope, the first implementation may expose the generated link in the JSON response for development and tests, guarded by environment rules if needed.

### Reset password

`POST /auth/password/reset`

- accepts raw reset token and new password
- validates token expiry and one-time status
- updates password hash
- consumes reset token
- revokes all existing sessions for the user
- creates a fresh session and sets cookies

### Create invite

`POST /auth/invites`

- authenticated route for workspace owners/admins
- accepts workspace id, invitee email, and role
- creates or replaces outstanding invite for that email/workspace combination
- returns invite metadata and placeholder acceptance link

This route exists even if the UI only uses a minimal invite trigger initially, because the acceptance flow depends on a durable invite object.

### Accept invite

`POST /auth/invites/accept`

- accepts invite token, full name, and password if a new local account is needed
- validates invite token and email match rules
- either:
  - links to an existing user with the same normalized email, or
  - creates a new invited user and upgrades it to active with a password
- creates the workspace membership from the invite role
- consumes invite
- starts a session and sets cookies

If the invite targets an existing federated user in the future, acceptance should still complete without requiring local password creation.

### Provider placeholders

Expose provider endpoints like:

- `GET /auth/providers`
- `POST /auth/providers/google/start`
- `POST /auth/providers/microsoft/start`

For now these should return structured placeholder responses such as `not_configured` or `coming_soon`, driven by provider records rather than hard-coded button text. This keeps the frontend contract stable when real OAuth arrives.

## Frontend Flows

### Route structure

Add public auth routes under `apps/web/src/app` such as:

- `/sign-in`
- `/sign-up`
- `/forgot-password`
- `/reset-password`
- `/accept-invite`

Keep authenticated product routes under `(app)` and gate them through session-aware layout logic.

### Session-aware rendering

Use a shared auth client module that calls the API with credentials included.

- server components and route handlers can call the session endpoint to decide redirects
- client components submit forms to API-backed actions or fetch helpers
- authenticated app layout redirects unauthenticated users to `/sign-in`
- public auth pages redirect authenticated users into the default app surface

The frontend should never parse or store JWTs directly.

### Sign-in and sign-up UX

- email/password forms with inline validation
- clear handling for invalid credentials, invited-user cases, and generic server failures
- provider buttons for Google and Microsoft that call placeholder endpoints and render “coming soon” or “not configured” states from API responses

### Forgot/reset password UX

- forgot-password page always shows a neutral success state
- development-mode placeholder can reveal the generated reset link for local testing
- reset-password page validates token presence and allows password creation/update

### Invite acceptance UX

- accept-invite page reads token from the URL
- fetches invite status summary if needed
- prompts for name and password when required
- handles already-accepted, expired, and invalid invite states
- completes into an authenticated redirect to the relevant workspace/app surface

## Security Rules

### Cookies

Set cookies with:

- `HttpOnly: true`
- `SameSite: "lax"` by default
- `Secure: true` in production
- explicit path and expiry values

Access and refresh cookies should use different names and TTLs. Cookie configuration belongs in a central auth config object rather than scattered across controllers.

### Password handling

- use a modern password KDF such as `argon2id`
- enforce minimum password strength rules in shared validation
- never log raw passwords or tokens

### CSRF and browser protections

Because auth relies on cookies, authenticated write endpoints need CSRF-aware behavior.

For this phase:

- enforce strict origin and host checks on browser-authenticated auth mutations
- keep `SameSite=lax`
- centralize CORS configuration for the web origin only

If the app later broadens cross-site embedding or third-party POST surfaces, add an explicit CSRF token layer.

### Session abuse protection

- revoke sessions on password reset
- rotate refresh tokens on every refresh
- detect refresh token reuse
- keep security events auditable
- avoid detailed user enumeration in reset and sign-in flows

## Testing Strategy

Implement auth with TDD.

### API tests

- unit tests for password hashing adapter, token generation, cookie config, and provider placeholders
- service tests for sign-in, refresh rotation, invite acceptance, and password reset rules
- integration tests for Nest controllers covering cookies, status codes, and guarded session behavior

### Database tests

- Prisma-backed tests for token persistence, invite replacement, one-time token consumption, and session revocation

### Web tests

- component or route tests for sign-in, sign-up, forgot-password, reset-password, and invite pages
- redirect tests for protected layout behavior
- placeholder provider button tests

## Deliverables

The auth foundation is complete when:

- the API exposes working local-auth, session, invite, and reset endpoints
- Prisma schema supports session persistence and one-time token artifacts
- the web app has working sign-in, sign-up, forgot/reset, and invite acceptance flows
- browser sessions rely on secure `HttpOnly` cookies rather than frontend token storage
- Google and Microsoft buttons exist as backend-driven placeholders
- the design leaves explicit seams for future SAML and SCIM work

## Risks

- The repo currently has only scaffold-level app structure, so auth implementation may need to establish baseline backend and frontend architectural patterns as part of the work.
- Cookie behavior in local development can fail if app/API origins or secure flags are misconfigured.
- Refresh token rotation logic is easy to get subtly wrong without integration coverage.
- Invite acceptance can fail subtly if existing-user matching, duplicate workspace membership checks, and one-time invite consumption are not enforced atomically.

## Success Criteria

This auth foundation is acceptable when:

- email/password sign-up and sign-in work end to end
- authenticated browser sessions survive normal page navigation without exposing tokens to JavaScript
- refresh rotation and logout revoke sessions correctly
- forgot-password and reset-password work end to end without real email delivery
- invited users can accept an invite and land in the product with the correct workspace membership
- Google and Microsoft placeholder flows are visible and contract-stable
- future SAML and SCIM can be added as new provider/provisioning modules without redesigning the core session model
