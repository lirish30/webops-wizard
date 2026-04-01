# WebOps Wizard

Production-oriented TypeScript monorepo foundation for the WebOps Wizard SaaS platform.

## Apps

- `apps/web`: Next.js web application
- `apps/api`: NestJS + Fastify modular monolith API
- `apps/worker`: BullMQ-oriented background worker

## Packages

- `packages/ui`: shared UI primitives
- `packages/types`: shared domain types and contracts
- `packages/config`: shared env and tooling helpers
- `packages/db`: Prisma schema and client

## Domains

The API and worker are organized around these initial product domains:

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

## Local setup

1. Copy `.env.example` to `.env`.
2. Start Postgres and Redis with `pnpm docker:up`.
3. Install dependencies with `pnpm install`.
4. Generate the Prisma client with `pnpm db:generate`.
5. Run all apps with `pnpm dev`.

## Quality commands

- `pnpm lint`
- `pnpm test`
- `pnpm typecheck`
- `pnpm build`
