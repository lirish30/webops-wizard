# WebOps Wizard Monorepo Foundation Design

## Goal

Create a production-ready TypeScript monorepo for WebOps Wizard that supports the MVP domains from the PRD while keeping clean boundaries so the modular monolith can later split into services without a rewrite.

## Scope

This design covers the repository foundation only:

- Monorepo structure
- App and package boundaries
- Modular monolith domain layout
- Environment validation
- Linting, formatting, testing
- Local Docker development for Postgres and Redis
- Shared configuration patterns

This design does not implement product features such as authentication flows, connectors, reporting logic, or recommendation logic beyond scaffolding their domains.

## Recommended Approach

Use `pnpm` workspaces with `Turborepo` for orchestration.

Repository structure:

- `apps/web`: Next.js application for the product UI
- `apps/api`: NestJS application using Fastify for the modular monolith API
- `apps/worker`: Node worker process for async jobs
- `packages/ui`: shared UI components and tokens
- `packages/types`: shared contracts, DTOs, and domain-facing types
- `packages/config`: shared TypeScript, ESLint, Prettier, Vitest, and env utilities
- `packages/db`: Prisma schema, generated client, migrations, and database helpers

This keeps runtime responsibilities separate while centralizing shared contracts and infra concerns. It also aligns with the product overview recommendation to start as a modular monolith plus worker services.

## Architecture

### Monorepo

The repo should use a workspace-first structure rather than a service-first structure. Shared packages become the seam lines that future extracted services can continue to consume. Turborepo provides caching and task graph orchestration without forcing a heavier framework.

### API

`apps/api` should be the initial modular monolith. Each domain gets its own module tree with:

- `application`
- `domain`
- `infrastructure`
- `presentation`

Initial domains:

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

Each domain exposes a narrow public module API. Cross-domain access should go through exported interfaces and application services rather than direct deep imports.

### Worker

`apps/worker` owns asynchronous execution concerns:

- connector sync jobs
- crawl jobs
- trust scoring jobs
- recommendation generation jobs
- report generation jobs
- alert evaluation jobs

The worker initially consumes the same shared packages and database layer as the API, but with its own bootstrap, queue registration, and logging.

### Web

`apps/web` should be a Next.js App Router project structured by product surfaces, not by generic component type. Early shell routes should map to the MVP information architecture:

- overview
- pages
- recommendations
- reports
- alerts
- integrations
- settings

The app consumes shared UI and shared types rather than redefining contracts locally.

## Domain Boundary Rules

To preserve service extraction optionality:

- Domain code cannot import from another domain’s internals.
- Shared contracts live in `packages/types`.
- Shared infrastructure utilities live in `packages/config` or `packages/db`.
- Domain events and cross-domain interfaces are declared explicitly.
- Queue payloads use versioned typed contracts.
- Environment parsing is centralized and imported into app bootstraps.

## Tooling

### Language and Build

- TypeScript throughout
- `pnpm` workspaces
- `turbo` for task orchestration

### Web

- Next.js
- React

### API

- NestJS
- Fastify adapter
- Zod for env validation

### Worker

- Node TypeScript runtime
- BullMQ with Redis for queues

### Database

- PostgreSQL
- Prisma in `packages/db`

### Quality

- ESLint
- Prettier
- Vitest
- TypeScript project references

## Environment Validation

Each app should load a typed env schema:

- shared base env for node/runtime
- API-specific env
- web-specific env
- worker-specific env
- database and Redis connection env

Validation should fail fast at startup. Parsed env should be exported as typed objects rather than using raw `process.env` throughout the codebase.

## Local Development

Use Docker Compose for:

- Postgres
- Redis

The repo should include:

- `.env.example`
- `docker-compose.yml`
- scripts for local startup

The local workflow should support:

1. start infrastructure
2. install dependencies
3. generate Prisma client
4. run dev servers in parallel

## Testing Strategy

This foundation needs lightweight but real tests:

- package-level smoke tests for shared types/utilities
- env validation tests
- API bootstrap/module structure smoke test
- worker bootstrap/env smoke test

This gives an initial red/green baseline without pretending feature behavior exists yet.

## Decisions

### Why Turborepo over Nx

Turborepo is enough for workspace orchestration and keeps repo overhead lower. The repo does not yet need Nx-specific code generation or graph policies.

### Why NestJS for API

The API needs explicit domain modules, DI, lifecycle hooks, and long-term maintainability more than minimalism. NestJS supports that well and still allows clean modular monolith boundaries.

### Why Prisma for DB

The product needs a single shared relational model early, plus migration tooling and generated types. Prisma is a pragmatic fit for a TypeScript-first SaaS foundation.

## Deliverables

The scaffold should produce:

- initialized git repository
- workspace root configs
- app skeletons for web, api, worker
- shared packages for ui, types, config, db
- modular domain folder structure
- env schemas and examples
- Docker Compose for Postgres and Redis
- lint, format, test, typecheck, build scripts

## Risks

- Installing framework dependencies requires network access.
- Prisma generation may need a post-install step before typecheck.
- NestJS domain scaffolding can sprawl if boundaries are not enforced from day one.

## Success Criteria

The foundation is acceptable when:

- the monorepo installs cleanly
- `pnpm lint`, `pnpm test`, and `pnpm typecheck` run successfully
- Docker services boot Postgres and Redis locally
- the API, web app, and worker all start with validated envs
- domain folders reflect the PRD modules and do not rely on cross-domain deep imports
