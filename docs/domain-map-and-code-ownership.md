# WebOps Wizard Domain Map And Code Ownership

## Purpose

This document defines the engineering implementation map for WebOps Wizard. It describes:

- module boundaries
- entity ownership
- allowed cross-module dependencies
- event flows
- anti-corruption rules
- code ownership expectations

The design is optimized for implementation inside the current modular monolith and worker architecture. It is not an org chart. It is a build map.

## Product Promise As Architectural Constraint

The system must preserve three separate concerns:

1. `Trust what changed`
   Deterministic ingestion, normalization, change detection, and trust scoring produce the factual record.

2. `Understand why it matters`
   Deterministic prioritization and evidence packaging explain business impact. AI may summarize, but it does not invent the base interpretation.

3. `Know what to do next`
   Deterministic recommendation logic, workflow state, alerts, and reports convert facts into action.

This means:

- change detection must be separate from trust scoring
- trust scoring must be separate from recommendation generation
- recommendation generation must be separate from AI explanation
- AI outputs must consume validated evidence objects, not raw ungoverned source data

## Architectural Shape

Use `capability domains + shared kernel + explicit orchestration flows`.

### Shared Kernel

These are not product domains. They are cross-cutting engineering primitives:

- identity and auth primitives
- tenant context
- audit context
- time and date abstractions
- domain event contracts
- queue payload contracts
- shared value objects
- infrastructure adapters

The shared kernel must remain small. If product-specific business rules appear here, move them back to a product domain.

### Capability Domains

The main capability domains are:

- `auth`
- `workspaces`
- `properties`
- `integrations`
- `page-intelligence`
- `data-trust`
- `recommendations`
- `reports`
- `alerts`
- `releases`
- `settings`
- `ai-explanations` as a separate capability, even if introduced after MVP

`ai-explanations` is intentionally not merged into recommendations or reports. It is downstream of deterministic systems.

## Top-Level Ownership Model

Each domain owns:

- its aggregate roots
- its write-side business rules
- its persistence mapping
- its internal services
- its emitted domain events

Other domains may consume:

- public query DTOs
- published events
- explicit public interfaces

Other domains may not consume:

- internal repositories
- internal persistence models
- internal service classes
- direct database tables owned by another domain without an approved read model

## Domain Map

## 1. Auth

### Responsibility

Own user identity, authentication methods, sessions, invitation acceptance, and identity provider linkage.

### Owns

- `User`
- `AuthIdentity`
- `Session`
- `InviteAcceptance`

### Does Not Own

- workspace membership
- role assignment semantics
- tenant scoping

Those belong to `workspaces`.

### Public Outputs

- authenticated user identity
- session claims
- identity-linked events

### Allowed Dependencies

- shared kernel only

### Anti-Corruption Rules

- Auth cannot assign workspace roles.
- Auth cannot make authorization decisions on property access.
- Auth exposes identity facts, not business permissions.

## 2. Workspaces

### Responsibility

Own tenant boundaries, workspace lifecycle, membership, role assignment, and workspace-level isolation rules.

### Owns

- `Workspace`
- `WorkspaceMembership`
- `WorkspaceRole`
- `WorkspaceInvitation`
- workspace access policy

### Does Not Own

- property configuration
- billing logic
- integration credentials

### Public Outputs

- tenant context
- role and membership facts
- access-check interfaces

### Allowed Dependencies

- `auth`
- shared kernel

### Anti-Corruption Rules

- No other domain may invent its own role model.
- All tenant access checks resolve through workspace-owned membership rules.
- Workspace IDs are the root of tenant partitioning.

## 3. Properties

### Responsibility

Own website property setup, environment designation, business configuration, conversion definitions, page groups, and source-of-truth settings.

### Owns

- `Property`
- `PropertyProfile`
- `PropertyEnvironment`
- `ConversionDefinition`
- `PageGroup`
- `FunnelStageDefinition`
- source-of-truth policy

### Does Not Own

- integration connection health
- canonical page identity
- trust scores

### Public Outputs

- property activation status
- configured business priorities
- conversion and page-group policies
- source-of-truth settings for downstream consumers

### Allowed Dependencies

- `workspaces`
- shared kernel

### Anti-Corruption Rules

- Properties define business configuration, not measured outcomes.
- Integrations may read property config but cannot mutate business rules directly.
- Recommendation logic may consume property priorities, but cannot redefine them.

## 4. Integrations

### Responsibility

Own external connection setup, credentials references, connector health, sync schedules, sync state, and source ingestion orchestration.

### Owns

- `IntegrationConnection`
- `ConnectorCredentialRef`
- `ConnectorSyncRun`
- `ConnectorSyncError`
- freshness metadata

### Does Not Own

- normalized page identity
- trust scoring
- recommendation logic
- report narrative

### Public Outputs

- source records
- normalized source payloads
- freshness facts
- connector health facts
- ingestion events

### Allowed Dependencies

- `workspaces`
- `properties`
- shared kernel

### Anti-Corruption Rules

- Integrations may ingest and map external data, but not interpret business meaning.
- Source payloads must be converted into internal contracts before other domains consume them.
- Downstream domains must not directly couple to external provider schemas.

## 5. Page Intelligence

### Responsibility

Own canonical page identity, URL normalization, aliasing, template classification, page snapshots, and page-level historical continuity.

### Owns

- `CanonicalPage`
- `RawUrlRecord`
- `UrlAlias`
- `PageClassification`
- `PageSnapshot`
- `TemplateClassification`
- `PageMetricsProjection`

### Does Not Own

- source connection health
- trust scoring policy
- recommendation prioritization

### Public Outputs

- canonical page graph
- page history timeline
- normalized page-level facts
- changed-page events

### Allowed Dependencies

- `properties`
- `integrations`
- `releases`
- shared kernel

### Anti-Corruption Rules

- Only page-intelligence may resolve raw URLs into canonical pages.
- Other domains may not store competing page identity systems.
- All page-level analytics, releases, and recommendations must reference the canonical page ID.

## 6. Releases

### Responsibility

Own release annotations, manual change markers, and release-to-scope associations.

### Owns

- `ReleaseAnnotation`
- `ReleaseScope`
- release timeline facts

### Does Not Own

- page diffing
- business impact interpretation
- alert suppression policy

### Public Outputs

- release events
- scope associations for pages, groups, templates, or properties

### Allowed Dependencies

- `properties`
- `page-intelligence`
- shared kernel

### Anti-Corruption Rules

- Releases record change context, not causal conclusions.
- A release marker can influence downstream interpretation, but it cannot overwrite measured facts.

## 7. Data Trust

### Responsibility

Own freshness evaluation, coverage checks, comparability windows, measurement issues, trust scoring, and trust caveats.

### Owns

- `TrustAssessment`
- `ComparabilityWindow`
- `MeasurementIssue`
- `SourceHealthAssessment`
- `TrustCaveat`

### Does Not Own

- source ingestion
- page identity
- recommendation lifecycle
- AI explanation text

### Public Outputs

- property trust summaries
- page trust summaries
- metric trust summaries
- recommendation trust eligibility
- trust-blocking events

### Allowed Dependencies

- `integrations`
- `properties`
- `page-intelligence`
- `releases`
- shared kernel

### Anti-Corruption Rules

- Only data-trust can assign trust scores and trust caveats.
- Recommendations and reports may reference trust outcomes, but may not compute private trust logic inline.
- AI modules cannot downgrade or upgrade trust.

## 8. Recommendations

### Responsibility

Own deterministic issue detection, prioritization, recommendation lifecycle, actionability scoring, and validation state.

### Owns

- `Recommendation`
- `RecommendationEvidenceBundle`
- `RecommendationScore`
- `RecommendationStatus`
- `RecommendationValidation`
- `RecommendationBlocker`

### Does Not Own

- page identity
- raw integration payloads
- trust scoring
- AI-authored explanation text

### Public Outputs

- recommendation list and board views
- recommendation regeneration events
- accepted/validated workflow events

### Allowed Dependencies

- `properties`
- `page-intelligence`
- `data-trust`
- `releases`
- shared kernel

### Anti-Corruption Rules

- Deterministic recommendation detection must run before AI explanation.
- Recommendation creation must require a typed evidence bundle.
- If trust is below threshold, recommendation logic must block or caveat output based on data-trust policy.

## 9. Alerts

### Responsibility

Own deterministic alert evaluation, deduplication, alert lifecycle, suppression windows, and delivery eligibility.

### Owns

- `Alert`
- `AlertRule`
- `AlertDeliveryDecision`
- `AlertDedupWindow`
- `AlertSuppressionWindow`

### Does Not Own

- recommendation prioritization
- report generation
- connector health source records

### Public Outputs

- in-app alert records
- delivery requests
- acknowledged or resolved alert events

### Allowed Dependencies

- `properties`
- `page-intelligence`
- `data-trust`
- `releases`
- `settings`
- shared kernel

### Anti-Corruption Rules

- Alerts must be deterministic and evidence-backed.
- AI may summarize alert context later, but may not be the primary detector.

## 10. Reports

### Responsibility

Own report definitions, report runs, report snapshots, report approval, and delivery state.

### Owns

- `ReportDefinition`
- `ReportRun`
- `ReportSnapshot`
- `ReportApproval`
- `ReportDelivery`

### Does Not Own

- recommendation generation
- trust scoring
- tenant membership

### Public Outputs

- generated report artifacts
- report approval events
- report delivery events

### Allowed Dependencies

- `properties`
- `page-intelligence`
- `data-trust`
- `recommendations`
- `releases`
- `settings`
- `ai-explanations`
- shared kernel

### Anti-Corruption Rules

- Reports assemble facts from owning domains; they do not recreate underlying business logic.
- A report narrative must distinguish evidence from generated explanation.
- Reports may consume AI summaries only after evidence bundles are frozen.

## 11. Settings

### Responsibility

Own user-configurable operating rules that shape product behavior but are not the core state of other domains.

### Owns

- `AlertSettings`
- `ReportAudiencePreset`
- `NotificationPreferences`
- `AISettings`
- `TrustPolicyOverrides` within approved bounds

### Does Not Own

- raw workspace membership
- recommendation entities
- report entities

### Public Outputs

- rule and threshold configuration for downstream domains

### Allowed Dependencies

- `workspaces`
- `properties`
- shared kernel

### Anti-Corruption Rules

- Settings may tune thresholds, not overwrite historical facts.
- Settings cannot become a dumping ground for state owned by another domain.

## 12. AI Explanations

### Responsibility

Own prompt orchestration, output validation, evidence-bound explanation generation, and editable explanatory drafts.

### Owns

- `ExplanationRequest`
- `ExplanationResult`
- `ExplanationEvidenceMap`
- `ExplanationValidationState`

### Does Not Own

- issue detection
- trust scoring
- recommendation prioritization
- final human approval decisions

### Public Outputs

- validated explanation drafts for recommendations, reports, and anomaly summaries

### Allowed Dependencies

- `data-trust`
- `recommendations`
- `reports`
- `page-intelligence`
- `releases`
- shared kernel

### Anti-Corruption Rules

- AI only consumes structured evidence bundles.
- AI cannot access raw unvalidated connector payloads.
- AI cannot create a recommendation without an upstream deterministic recommendation entity.
- AI cannot change trust scores, priority scores, or status transitions.

## Dependency Rules

## Allowed Dependency Direction

Preferred dependency direction:

`auth -> workspaces -> properties -> integrations/page-intelligence/releases -> data-trust -> recommendations/alerts -> reports -> ai-explanations`

This is not a pure chain, but it shows the intended downstream flow of interpretation.

### Specific Allowed Dependencies

- `workspaces` may depend on `auth`
- `properties` may depend on `workspaces`
- `integrations` may depend on `properties`
- `page-intelligence` may depend on `properties`, `integrations`, `releases`
- `data-trust` may depend on `integrations`, `properties`, `page-intelligence`, `releases`
- `recommendations` may depend on `properties`, `page-intelligence`, `data-trust`, `releases`
- `alerts` may depend on `properties`, `page-intelligence`, `data-trust`, `releases`, `settings`
- `reports` may depend on `properties`, `page-intelligence`, `data-trust`, `recommendations`, `releases`, `settings`, `ai-explanations`
- `ai-explanations` may depend on read models from upstream deterministic domains only

### Forbidden Dependency Patterns

- `auth` depending on `workspaces`
- `integrations` depending on `recommendations`
- `page-intelligence` depending on `data-trust`
- `data-trust` depending on `recommendations`
- `recommendations` depending on `ai-explanations`
- `ai-explanations` calling back into recommendation scoring
- `reports` reaching into internal repository code of other modules

## Entity Ownership Boundaries

## Ownership Table

| Entity / Concept | Owning Module | Notes |
| --- | --- | --- |
| User | auth | Identity only |
| Workspace | workspaces | Tenant root |
| WorkspaceMembership | workspaces | Role and access |
| Property | properties | Website business configuration |
| ConversionDefinition | properties | Source-of-truth business mapping |
| IntegrationConnection | integrations | Connector lifecycle |
| ConnectorSyncRun | integrations | Sync execution facts |
| CanonicalPage | page-intelligence | Single page identity owner |
| RawUrlRecord | page-intelligence | Input URL record |
| ReleaseAnnotation | releases | Change context marker |
| TrustAssessment | data-trust | Trust owner only |
| Recommendation | recommendations | Action owner only |
| Alert | alerts | Notification owner only |
| ReportRun | reports | Report lifecycle owner |
| AI explanation draft | ai-explanations | Explanation only |

## Read Model Strategy

When one module needs a shaped view of another module’s state:

- prefer a public query service or published read model
- do not reuse internal ORM models
- do not join directly across domain repositories in application services unless the read model layer explicitly allows it

For example:

- `recommendations` may consume a `PagePerformanceSnapshot` read model from `page-intelligence`
- `reports` may consume a `RecommendationSummaryReadModel` from `recommendations`
- `ai-explanations` may consume an `ExplanationEvidenceBundle` from `recommendations` or `reports`

## Event Flows

## Core Product Flow

### Flow A: Trust What Changed

1. `integrations` ingests source data
2. `integrations` publishes `SourceSyncCompleted`
3. `page-intelligence` normalizes URLs and updates page projections
4. `page-intelligence` publishes `CanonicalPageChanged` or `PageMetricsUpdated`
5. `releases` contributes matching release context
6. `data-trust` evaluates freshness, coverage, conflicts, and comparability
7. `data-trust` publishes `TrustAssessmentUpdated`

Result:

- The system has a deterministic statement of what changed.
- The system has a deterministic statement of whether that change is trustworthy.

### Flow B: Understand Why It Matters

1. `recommendations` consumes page and trust read models
2. deterministic rules evaluate issue types, impact, severity, effort, and actionability
3. `recommendations` creates or updates recommendation entities and evidence bundles
4. `recommendations` publishes `RecommendationGenerated`
5. `ai-explanations` may consume the evidence bundle and produce a validated rationale draft

Result:

- Business importance is grounded in deterministic scoring first.
- AI can summarize evidence, but not replace the scoring model.

### Flow C: Know What To Do Next

1. `recommendations` exposes prioritized actions
2. `alerts` evaluates whether changes warrant immediate notification
3. `reports` assembles weekly or audience-specific summaries
4. `ai-explanations` can draft narrative sections for reports using frozen evidence bundles
5. users accept, assign, validate, or report on the action

Result:

- The system moves from trustworthy change detection to operational action.

## Domain Event Catalog

Initial event vocabulary:

- `UserAuthenticated`
- `WorkspaceMembershipChanged`
- `PropertyActivated`
- `IntegrationConnected`
- `SourceSyncCompleted`
- `SourceSyncFailed`
- `CanonicalPageResolved`
- `PageMetricsUpdated`
- `PageClassificationChanged`
- `ReleaseAnnotated`
- `TrustAssessmentUpdated`
- `TrustAssessmentBlocked`
- `RecommendationGenerated`
- `RecommendationStatusChanged`
- `RecommendationValidated`
- `AlertTriggered`
- `AlertAcknowledged`
- `ReportRequested`
- `ReportApproved`
- `ReportDelivered`
- `ExplanationRequested`
- `ExplanationValidated`
- `ExplanationRejected`

## Orchestration Boundaries

The following flows should be orchestrated, not embedded inside one domain:

- integration completion -> page update -> trust re-evaluation
- page update + trust update -> recommendation regeneration
- recommendation generation -> explanation draft request
- report request -> evidence freeze -> explanation draft -> approval

These orchestration flows belong in:

- worker jobs
- application-level coordinators
- event handlers

They do not belong in entity methods or raw repositories.

## Code Ownership Structure

## Package And App Ownership

### `apps/api`

Owns:

- write-side application services
- domain modules
- command handling
- public API controllers
- tenant enforcement at request boundaries

### `apps/worker`

Owns:

- event handlers
- long-running orchestration
- async recomputation
- retry policies
- dead-letter handling

### `packages/types`

Owns:

- shared contracts
- domain event payload types
- stable DTOs shared across runtime boundaries

Must not own:

- business logic

### `packages/db`

Owns:

- schema definition
- shared database client
- migration artifacts

Must not own:

- business rules
- cross-domain orchestration logic

### `packages/config`

Owns:

- env parsing
- base tooling config
- shared runtime configuration helpers

### `packages/ui`

Owns:

- shared visual primitives
- design tokens
- cross-surface reusable presentation components

Must not own:

- backend-derived business rules

## Directory-Level Ownership Pattern For Domains

Inside each API domain:

- `domain/`
  Owns entities, value objects, policy interfaces, domain services, events

- `application/`
  Owns commands, use cases, orchestrated domain actions, DTO mapping

- `infrastructure/`
  Owns repositories, persistence adapters, external adapters

- `presentation/`
  Owns HTTP endpoints, request validation, response shaping

Implementation rule:

- `presentation` may depend on `application`
- `application` may depend on `domain`
- `infrastructure` may depend on `domain` and `application` interfaces
- `domain` depends on nothing outside shared kernel abstractions

## Anti-Corruption Rules

## Rule 1: External Data Must Be Mapped Before Use

No domain beyond `integrations` may work directly with GA4, GSC, crawler, or third-party provider payloads.

Use:

- connector adapters
- internal normalized contracts
- source snapshots

## Rule 2: Canonical Page Identity Is Single-Owner

All downstream systems must use canonical page IDs from `page-intelligence`.

No duplicate URL normalization logic is allowed in:

- reports
- recommendations
- alerts
- ai-explanations

## Rule 3: Trust Is Single-Owner

Only `data-trust` can decide:

- freshness sufficiency
- comparability break handling
- coverage penalties
- recommendation blocking thresholds

Other domains may consume trust outcomes, not recreate them.

## Rule 4: Deterministic Detection Before AI

AI can:

- summarize
- rewrite for audience
- draft hypotheses within bounded evidence
- explain a recommendation that already exists

AI cannot:

- create source facts
- assign trust
- create first-class recommendations from raw data
- decide final priority without deterministic scoring

## Rule 5: Reports Are Assemblers, Not Logic Owners

Reports can aggregate outputs from other domains, but cannot become the hidden implementation point for trust, recommendation, or alert logic.

## Rule 6: Settings Tune Behavior, They Do Not Own Core State

If a setting starts storing the main lifecycle of another concept, ownership is wrong and the model must be refactored.

## Rule 7: Cross-Domain Writes Require Explicit Use Cases

One domain may not directly mutate another domain’s tables or repositories.

If a cross-domain change is needed:

- publish an event
- call an explicit public application service
- use an orchestrator

## Rule 8: Read Models Are Disposable, Aggregate Ownership Is Not

Read models may duplicate shape for performance. They may not become shadow write models.

## Implementation Guidance

## Initial Module Order

Build in this sequence:

1. `auth`
2. `workspaces`
3. `properties`
4. `integrations`
5. `page-intelligence`
6. `releases`
7. `data-trust`
8. `recommendations`
9. `alerts`
10. `reports`
11. `settings`
12. `ai-explanations`

This order follows dependency direction and preserves the product promise.

## First Read Models To Create

- `PropertyOperatingContext`
- `CanonicalPageSummary`
- `PagePerformanceSnapshot`
- `TrustSummaryReadModel`
- `RecommendationSummaryReadModel`
- `ReportEvidenceBundle`

## First Boundary Enforcement Checks

- forbid deep imports across domains
- require typed domain events for worker-triggered recomputation
- require canonical page ID usage in page-related modules
- require trust summary presence in recommendation generation inputs
- require evidence bundle presence before explanation generation

## Review Checklist

Use this checklist when adding a new module or feature:

- Which domain owns the entity?
- Is this a write model or a read model?
- Are we consuming another domain through a public contract?
- Are we duplicating page identity logic?
- Are we duplicating trust logic?
- Are we letting AI do deterministic work?
- Are we leaking external provider schemas past integrations?

If any answer is unclear, the boundary is not defined tightly enough.
