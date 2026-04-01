# WebOps UI Library Design

Date: 2026-03-31
Scope: `packages/ui` and initial adoption in `apps/web`
Status: Approved for spec writing, pending user review

## Goal

Create an opinionated, reusable component library for the WebOps Wizard product in `packages/ui`. The library should provide fully working interactive primitives and product-specific status patterns needed by the current SaaS shell and near-term operational surfaces.

The design is intentionally product-specific. It is not a headless design system for multiple brands. It should encode the WebOps Wizard visual language, semantics, and interaction rules so product screens can be built quickly and consistently.

## Problem

The current codebase has:

- A minimal `packages/ui` package with only a single inline-styled `Button`.
- A stronger visual language implemented directly inside `apps/web`.
- No shared semantic system for trust, connector status, severity, or approval states.
- No reusable interactive primitives for drawers, modals, tabs, toasts, pagination, or step-based flows.

If feature work continues on the current path, `apps/web` will accumulate ad hoc components and duplicated styles. The component library should become the single product UI foundation before more operational screens are built.

## Desired Outcomes

- `packages/ui` owns the product’s reusable UI primitives and product-pattern components.
- `apps/web` imports UI from `@webops-wizard/ui` instead of relying on local one-off view components.
- All interactive primitives have keyboard-accessible behavior and typed APIs.
- Priority state families have one shared semantic mapping:
  - trust
  - connector health
  - recommendation severity
  - approval status
- The product has one expressive visual system for:
  - trust score
  - confidence score
  - freshness
  - severity
  - actionability
  - blocked status
  - approval state
- The first version is broad enough to support current SaaS shell work, recommendation workflows, connector surfaces, trust reporting, and approval flows.

## Non-Goals

- Building a multi-brand or consumer-grade design system.
- Implementing virtualization, complex data-grid features, drag-and-drop, or charting.
- Building a full documentation site.
- Solving backend data flows, API integration, or server query state.
- Refactoring all existing `apps/web` screens in the same pass.

## Product Direction

The UI library should preserve and formalize the design language already introduced in the app shell:

- Warm light backgrounds and layered translucent surfaces.
- Dark ink and dark navigation surfaces.
- Copper accent for emphasis and focus.
- Compact, operational spacing rather than marketing-style roomy layouts.
- Rounded but structured corners.
- Clear semantic state colors with restrained saturation.

This library should feel like enterprise operations software, not generic dashboard chrome.

## Semantic Visual System

The library should include an expressive but disciplined scoring language. The goal is not to make every status look the same. The goal is to make related concepts feel like part of one system while still encoding their meaning through form, color, and structure.

### Semantic Classes

The seven concepts are split into three visual classes.

#### 1. Scored Gradients

These concepts are measurable and should support numeric or banded display:

- trust score
- confidence score
- freshness
- actionability

They should use richer score-oriented treatments such as:

- ring meters
- segmented bars
- weighted score pills

#### 2. Risk Intensity

This concept represents urgency and should not read as a neutral score:

- severity

It should use sharper visual treatment such as:

- high-contrast lozenges
- edge-accent surfaces
- stronger escalation contrast between low and critical

#### 3. Workflow State

These concepts represent operational gates and process state rather than measurement:

- blocked status
- approval state

They should use state-oriented treatments such as:

- stamped pills
- checkpoint markers
- step-aligned state markers

This split is a core design rule. A trust score must not look like a blocked state. Approval must not look like a freshness band. Shared tokens unify the system, but each semantic class must retain its own structure.

## Semantic Concepts

### Trust Score

Meaning:
- how trustworthy the underlying signal or data source is

Display model:
- accepts numeric score from 0 to 100 or a banded value
- defaults to ring, bar, or weighted pill display

Visual treatment:
- reliability-oriented treatment
- cooler and steadier than severity
- can use warmer caution tones as trust degrades

### Confidence Score

Meaning:
- how confident the system is in a recommendation, finding, or conclusion

Display model:
- accepts numeric score from 0 to 100 or a banded value
- defaults to ring, bar, or weighted pill display

Visual treatment:
- analytical and measured
- more restrained than trust
- should feel computed rather than risk-heavy

### Freshness

Meaning:
- how current a signal, dataset, page reading, or system output is

Display model:
- accepts either age-derived buckets or explicit freshness bands
- defaults to compact pill or segmented freshness bar

Visual treatment:
- freshness should visually decay over time
- not only color, but density or fill should communicate staleness

### Severity

Meaning:
- how urgent or harmful a recommendation, alert, or issue is

Display model:
- categorical only

Visual treatment:
- sharper, more compressed emphasis than score components
- must feel urgent and directional

### Actionability

Meaning:
- how ready something is for immediate user action

Display model:
- accepts numeric score or explicit band
- defaults to pill or segmented bar

Visual treatment:
- forward-leaning and task-oriented
- should feel like readiness, not reliability

### Blocked Status

Meaning:
- whether work or workflow progression is currently blocked

Display model:
- binary with optional reason text

Visual treatment:
- hard-stop visual language
- must read as gating state immediately

### Approval State

Meaning:
- where an item sits in the review and approval lifecycle

Display model:
- categorical workflow state

Visual treatment:
- process-oriented rather than score-oriented
- should pair naturally with timeline and stepper patterns

## Semantic Token Model

The semantic layer should be implemented through reusable tokens and recipe maps in `packages/ui`.

### Shared Token Fields

Each semantic recipe should define:

- foreground color
- background color
- border color
- accent color
- icon or dot treatment
- ring or bar fill treatment
- emphasis level

### Band Sets

The first version should standardize the following band sets.

#### Score Bands

Used by trust score and confidence score:

- `excellent`
- `strong`
- `moderate`
- `weak`
- `critical`

#### Freshness Bands

Used by freshness:

- `live`
- `recent`
- `aging`
- `stale`

#### Severity Bands

Used by severity:

- `info`
- `low`
- `medium`
- `high`
- `critical`

#### Actionability Bands

Used by actionability:

- `ready`
- `qualified`
- `partial`
- `blocked`

#### Approval States

Used by approval state:

- `draft`
- `in_review`
- `approved`
- `rejected`
- `blocked`

#### Blocked States

Used by blocked status:

- `clear`
- `blocked`

## Mapping Rules

The system should be deterministic. Product teams should not choose arbitrary colors or reinterpret meanings in feature code.

### Trust Score Mapping

- accepts numeric scores from 0 to 100
- maps to the shared five-band score scale
- may use slightly warmer caution tones than confidence

### Confidence Score Mapping

- accepts numeric scores from 0 to 100
- maps to the shared five-band score scale
- remains more neutral than trust at the same band

### Freshness Mapping

- accepts explicit band or derived age bucket
- should degrade through visual fill and color, not color alone

### Severity Mapping

- categorical only
- UI code should not infer severity styling from raw numeric score fragments

### Actionability Mapping

- accepts score or explicit band
- should always answer whether an operator can act now

### Blocked Mapping

- binary state with optional reason text

### Approval Mapping

- categorical workflow state only

## Component Model For Semantic Concepts

The semantic system should expose shared indicator primitives plus domain-specific wrappers.

### Shared Indicator Components

- `ScoreIndicator`
- `SeverityIndicator`
- `StatePill`

### ScoreIndicator

Used for:

- trust score
- confidence score
- freshness
- actionability

Supported modes:

- `pill`
- `bar`
- `ring`
- `compact`

### SeverityIndicator

Used for:

- severity

Supported modes:

- `pill`
- `badge`
- `compact`

### StatePill

Used for:

- blocked status
- approval state

Supported modes:

- `pill`
- `stamped`
- `compact`

### Domain Wrappers

These components should wrap the shared indicators and constrain allowed values:

- `TrustScore`
- `ConfidenceScore`
- `FreshnessIndicator`
- `ActionabilityIndicator`
- `SeverityBadge`
- `BlockedState`
- `ApprovalState`

The wrappers should encode labels and allowed values, but styling must still flow through the shared semantic recipe layer.

## Layout And Usage Rules

To keep the system consistent, display modes should follow environment rules.

### Tables

- default to compact indicators
- prioritize scan speed over decoration

### Cards

- default to pill or ring indicators
- allow score plus supporting context

### Detail Panels And Drawers

- allow ring or bar indicators
- pair with explanation text and reason states

### Timelines And Steppers

- use workflow-state treatments for approval and blocked concepts
- do not render approval as a score

### Shell And List Status

- use `StatePill` or compact score indicators
- do not introduce app-local status styling

## Architecture

The library should be structured in four layers.

### 1. Tokens and Semantic Recipes

Shared design tokens and state recipes that define:

- colors
- typography
- spacing
- radii
- shadows
- focus rings
- motion durations
- z-indexes
- semantic status tones

These tokens should live in `packages/ui` and be exported through a shared stylesheet entry plus typed status recipe utilities.

### 2. Base Primitives

Reusable building blocks with working behavior:

- `Button`
- `Card`
- `Badge`
- `StatusPill`
- `Tabs`
- `Drawer`
- `Modal`
- `ToastProvider` and `useToast`
- `Pagination`
- `Stepper`
- `Skeleton`
- `Table`
- `FilterBar`

These components should have consistent styling and accessibility behavior, but stay bounded to product needs rather than becoming abstract composition engines.

### 3. Product Patterns

Higher-level components built on the primitives:

- `TrustBadge`
- `TrustScore`
- `ConfidenceScore`
- `FreshnessIndicator`
- `ConnectorStatusBadge`
- `SeverityBadge`
- `ApprovalBadge`
- `ActionabilityIndicator`
- `BlockedState`
- `KpiCard`
- `TimelineItem`
- `ScoreIndicator`

These components encode product semantics and should be preferred over free-form primitive combinations when the domain meaning is already known.

`TrustBadge` remains available for categorical trust posture where a binary or banded badge is enough. `TrustScore` is the expressive scored variant for numeric trust displays.

### 4. Runtime Helpers

Small shared helpers for component behavior:

- focus trap support for modal and drawer
- escape key handling
- portal mounting
- body scroll lock
- controlled and uncontrolled state helpers
- toast dismissal timing

The runtime layer should remain lightweight and local to the UI package.

## Package Structure

Target structure:

```text
packages/ui/src/
  styles/
    tokens.css
    recipes.css
    index.css
  lib/
    status-recipes.ts
    controllable-state.ts
    dismissible-layer.ts
  components/
    button.tsx
    card.tsx
    badge.tsx
    status-pill.tsx
    severity-indicator.tsx
    state-pill.tsx
    tabs.tsx
    drawer.tsx
    modal.tsx
    toast.tsx
    pagination.tsx
    stepper.tsx
    skeleton.tsx
    table.tsx
    filter-bar.tsx
    trust-badge.tsx
    trust-score.tsx
    confidence-score.tsx
    freshness-indicator.tsx
    connector-status-badge.tsx
    severity-badge.tsx
    approval-badge.tsx
    actionability-indicator.tsx
    blocked-state.tsx
    kpi-card.tsx
    timeline-item.tsx
    score-indicator.tsx
  index.ts
```

Exact filenames can vary, but the package should separate generic primitives from product patterns.

## Component Set

### Button

Purpose:
- primary action surface used across cards, drawers, modals, and shell actions

Required behavior:
- button and link-style rendering support
- primary, secondary, ghost, and danger variants
- disabled and loading states

### Card

Purpose:
- base surface container for metrics, data panels, and shell content

Required behavior:
- header, body, and footer slots
- optional accent treatment
- compact and standard density modes

### Badge

Purpose:
- small, inline semantic label

Required behavior:
- generic tone-driven badge primitive
- size variants
- optional icon slot

### StatusPill

Purpose:
- operational state chip for shell and list-level status display

Required behavior:
- more prominent than a badge
- inline icon or dot marker
- semantic tone support from shared recipes

### Tabs

Purpose:
- switch views inside a shared panel

Required behavior:
- keyboard navigation with arrow keys
- active tab indicator
- controlled and uncontrolled modes
- proper tablist, tab, and tabpanel semantics

### Drawer

Purpose:
- side panel for focused workflows and detail views

Required behavior:
- overlay
- focus trap
- escape to close
- click outside to close
- body scroll lock
- left and right placement

### Modal

Purpose:
- interruptive confirmation and short-form workflows

Required behavior:
- overlay
- focus trap
- escape to close
- dismiss and confirm affordances
- title, body, and footer slots

### ToastProvider and useToast

Purpose:
- transient feedback for user actions

Required behavior:
- app-level provider
- imperative `push` style API
- success, info, warning, and error variants
- auto-dismiss with optional persistent mode
- dismiss button

### Pagination

Purpose:
- navigate paginated tables and collections

Required behavior:
- previous and next controls
- page number buttons
- compact mode for narrow layouts
- controlled and uncontrolled modes

### Stepper

Purpose:
- represent multi-step workflows such as approvals and connector setup

Required behavior:
- horizontal and vertical layouts
- complete/current/upcoming states
- optional click navigation

### Skeleton

Purpose:
- loading placeholders for cards, lists, and tables

Required behavior:
- block, text, avatar, and row shapes
- subtle shimmer
- no layout shift relative to final component size

### Table

Purpose:
- display operational records such as pages, connectors, alerts, or recommendations

Required behavior:
- typed columns
- custom cell renderers
- row click or row actions support
- empty state slot
- loading state support

Explicit non-goals for first version:
- sorting
- column resizing
- virtualization
- pinned columns

### FilterBar

Purpose:
- common filtering pattern for list surfaces

Required behavior:
- chip/toggle filter items
- select-like filter triggers
- active count
- clear all action

## Product-Specific Patterns

### TrustBadge

Allowed values:
- `trusted`
- `watch`
- `unverified`
- `drift`

Purpose:
- represent categorical trust posture when a full numeric score is not required

### ConnectorStatusBadge

Allowed values:
- `connected`
- `syncing`
- `degraded`
- `attention`
- `disconnected`

Purpose:
- represent integration health and current sync posture

### SeverityBadge

Allowed values:
- `critical`
- `high`
- `medium`
- `low`
- `info`

Purpose:
- represent recommendation or alert severity

### ApprovalBadge

Allowed values:
- `draft`
- `in_review`
- `approved`
- `rejected`
- `blocked`

Purpose:
- represent release and workflow approval states

### KpiCard

Purpose:
- display metrics, delta, trend tone, and support context

Required behavior:
- title
- primary value
- delta/tone
- footnote or metadata
- optional action slot

### TimelineItem

Purpose:
- render release, approval, or operational events in a timeline

Required behavior:
- timestamp
- title
- description
- actor or source
- marker tone from semantic recipes

### ScoreIndicator

Purpose:
- show numeric or banded scores like trust, readiness, or quality

Required behavior:
- compact, bar, and ring-style modes
- semantic threshold mapping
- accessible textual label

## Semantic State System

The design should centralize tone mapping rather than letting each component invent its own colors.

There should be one internal recipe system that maps:

- trust states
- connector states
- severity states
- approval states
- generic neutral/success/warning/danger states

Every badge-like or pill-like component should consume these shared recipes. Domain wrappers such as `TrustBadge` and `SeverityBadge` should only constrain allowed values and labels, not duplicate styling logic.

This prevents drift and keeps state meaning consistent across the product.

## Accessibility Requirements

All interactive primitives must support keyboard and assistive technology usage.

Required accessibility rules:

- visible focus treatment on all interactive elements
- tabs support arrow-key navigation and correct ARIA roles
- modals and drawers trap focus while open
- escape closes modal, drawer, and dismissible toast when appropriate
- overlays do not block screen reader understanding of dialog structure
- buttons and controls expose disabled and loading states clearly
- tables remain readable with semantic table markup
- skeletons are decorative and do not interfere with announced content

## State Management Model

Interactive primitives should support both controlled and uncontrolled usage.

Examples:

- `Tabs` accepts `value` and `onValueChange`, or internal default state
- `Drawer` and `Modal` accept `open` and `onOpenChange`, or internal state
- `Pagination` accepts explicit page state, or internal current page

This keeps components usable in simple view code today while allowing state orchestration later.

## Styling Strategy

`packages/ui` should own the library’s shared stylesheet.

Requirements:

- tokens and recipes live in package-managed CSS
- component class names are scoped and predictable
- `apps/web` imports the UI package stylesheet at the root
- current shell colors and surface treatments are migrated into package-level tokens over time

The first rollout does not need to migrate every existing shell class immediately, but new library components must not depend on `apps/web` local CSS definitions to render correctly.

## Adoption Strategy

Adopt in phases rather than refactoring the whole app at once.

### Phase 1

Build foundation and state system in `packages/ui`:

- tokens
- recipes
- `Button`
- `Card`
- `Badge`
- `StatusPill`
- `Skeleton`

### Phase 2

Build interactive primitives:

- `Tabs`
- `Drawer`
- `Modal`
- `ToastProvider`
- `Pagination`
- `Stepper`
- `Table`
- `FilterBar`

### Phase 3

Build product patterns:

- `TrustBadge`
- `TrustScore`
- `ConfidenceScore`
- `FreshnessIndicator`
- `ConnectorStatusBadge`
- `SeverityBadge`
- `ApprovalBadge`
- `ActionabilityIndicator`
- `BlockedState`
- `KpiCard`
- `TimelineItem`
- `ScoreIndicator`

### Phase 4

Initial app adoption in `apps/web`:

- migrate page-level buttons and badges to library components
- replace local empty-state metric cards with `KpiCard` where useful
- introduce a visual showcase route for manual verification
- migrate shell status pills to package components

## Verification Strategy

The implementation plan should require tests before component code for behaviors that can regress.

Expected verification:

- unit tests for status mappings and rendering variants
- interaction tests for tabs, modal, drawer, toast, and pagination behavior
- package typecheck and lint
- web app build after integrating the package stylesheet and adopted components
- visual smoke validation through a library showcase surface in `apps/web`

## Risks

### Risk: package and app styles diverge

Mitigation:
- move tokens and semantic recipes into `packages/ui` early
- avoid adding new app-local styles for patterns already targeted by the library

### Risk: interactive primitives become too abstract

Mitigation:
- keep APIs shaped around product needs
- avoid premature composition systems or low-level slot engines beyond clear use cases

### Risk: accessibility regressions in modal and drawer behavior

Mitigation:
- test focus trapping, dismissal behavior, and keyboard navigation directly

### Risk: too much migration in one pass

Mitigation:
- phase adoption and keep shell migration incremental

## Open Decisions Resolved In This Spec

- The library is product-specific for WebOps Wizard now, not headless and multi-brand.
- Interactive pieces are fully working primitives, not presentational shells.
- Priority states to optimize first are trust, connector status, recommendation severity, and approval status.
- The shared library lives in `packages/ui` and is consumed by `apps/web`.

## Implementation Boundary

This spec covers the library foundation and its first adoption path. It does not include:

- advanced data-grid features
- charts
- analytics querying
- backend integration
- documentation site generation

Those can be layered later once the shared UI foundation is stable.
