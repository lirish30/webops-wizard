# ADR 0002: Next.js As The Frontend Framework

## Context

The product needs a production-grade web application with authenticated app surfaces, route-based information architecture, server-side rendering where useful, strong TypeScript support, and a clear path to scalable UI development. The product overview explicitly recommended React with Next.js for the frontend.

## Decision

Use Next.js with React and TypeScript for the `apps/web` frontend application.

## Consequences

Positive:

- Strong support for route-based application structure and future SSR or static rendering needs.
- Mature React ecosystem and good team hiring surface.
- Good fit for SaaS app shells, authenticated surfaces, and future marketing pages if needed.
- Straightforward integration with shared UI and shared type packages in the monorepo.

Negative:

- Framework conventions influence project structure and build behavior.
- Next build and lint behavior can be opinionated inside a monorepo.
- Some client/server boundary decisions require discipline to avoid accidental coupling.

## Alternatives Considered

### Plain React with Vite

Rejected because it would require more manual infrastructure for routing, rendering strategy, and production conventions without delivering enough benefit for this product.

### Remix

Rejected because the team direction and product overview were already aligned to Next.js, and the monorepo foundation benefits from the broader ecosystem and hiring familiarity.

## Follow-Up Work

- Establish frontend route groups and feature folders for MVP surfaces.
- Add shared design tokens and stronger UI primitives in `packages/ui`.
- Decide which product surfaces should remain static, dynamic, or server-rendered.
