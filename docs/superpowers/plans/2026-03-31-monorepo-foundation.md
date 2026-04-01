# Monorepo Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the initial production-ready WebOps Wizard monorepo foundation with web, api, worker, shared packages, modular domain scaffolding, local infra, and quality tooling.

**Architecture:** Use a `pnpm` + `turbo` monorepo with Next.js for the web app, NestJS/Fastify for the API modular monolith, and a BullMQ-oriented Node worker. Shared concerns live in `packages/*`, and domain seams are modeled explicitly so later service extraction does not require contract rewrites.

**Tech Stack:** TypeScript, pnpm workspaces, Turborepo, Next.js, NestJS, Fastify, Prisma, PostgreSQL, Redis, BullMQ, Zod, Vitest, ESLint, Prettier, Docker Compose

---

### Task 1: Root Workspace Scaffold

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.editorconfig`
- Create: `.env.example`
- Create: `README.md`

- [ ] Define root workspace metadata, shared scripts, workspace globs, and Turbo tasks.
- [ ] Add root TypeScript defaults and ignore rules.
- [ ] Document setup and dev commands in the README.

### Task 2: Shared Config Packages

**Files:**
- Create: `packages/config/package.json`
- Create: `packages/config/tsconfig/base.json`
- Create: `packages/config/eslint/base.cjs`
- Create: `packages/config/prettier/base.cjs`
- Create: `packages/config/vitest/base.ts`
- Create: `packages/config/src/env.ts`
- Create: `packages/config/src/index.ts`

- [ ] Add reusable config entrypoints for TypeScript, ESLint, Prettier, Vitest, and env helpers.
- [ ] Export a small env helper used by apps for validated startup.

### Task 3: Shared Domain Packages

**Files:**
- Create: `packages/types/package.json`
- Create: `packages/types/tsconfig.json`
- Create: `packages/types/src/index.ts`
- Create: `packages/types/src/domain.ts`
- Create: `packages/types/src/contracts.ts`
- Create: `packages/ui/package.json`
- Create: `packages/ui/tsconfig.json`
- Create: `packages/ui/src/index.ts`
- Create: `packages/ui/src/button.tsx`

- [ ] Create a shared types package with workspace, property, integration, and recommendation contract stubs.
- [ ] Create a small UI package with one reusable component to prove package linking for the web app.

### Task 4: Database Package

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/prisma/schema.prisma`
- Create: `packages/db/src/client.ts`
- Create: `packages/db/src/index.ts`

- [ ] Add Prisma schema and client wrapper for Postgres.
- [ ] Include only foundational entities needed to prove the package shape and PRD alignment.

### Task 5: API Modular Monolith Scaffold

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/src/main.ts`
- Create: `apps/api/src/app.module.ts`
- Create: `apps/api/src/config/env.ts`
- Create: `apps/api/src/common/health.controller.ts`
- Create: `apps/api/src/domains/<domain>/**`

- [ ] Create the NestJS/Fastify application bootstrap with env validation.
- [ ] Add a root app module and health endpoint.
- [ ] Scaffold the initial domain module folders for each required product domain.

### Task 6: Worker Scaffold

**Files:**
- Create: `apps/worker/package.json`
- Create: `apps/worker/tsconfig.json`
- Create: `apps/worker/src/main.ts`
- Create: `apps/worker/src/config/env.ts`
- Create: `apps/worker/src/queues/index.ts`
- Create: `apps/worker/src/jobs/index.ts`
- Create: `apps/worker/src/domains/<domain>/**`

- [ ] Add worker bootstrap with validated env.
- [ ] Add queue and job registration stubs that match the PRD async pipelines.

### Task 7: Web App Scaffold

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/app/(app)/**`
- Create: `apps/web/src/lib/env.ts`

- [ ] Create the Next.js app shell with env validation and package consumption.
- [ ] Add placeholder routes for key MVP surfaces.

### Task 8: Quality Tooling and Tests

**Files:**
- Create: `eslint.config.mjs`
- Create: `.prettierrc.cjs`
- Create: `vitest.workspace.ts`
- Create: `packages/config/src/env.test.ts`
- Create: `packages/types/src/contracts.test.ts`
- Create: `apps/api/src/app.module.test.ts`
- Create: `apps/worker/src/main.test.ts`

- [ ] Add linting and formatting configuration wired to root scripts.
- [ ] Add lightweight tests for env parsing and app bootstrap smoke coverage.

### Task 9: Local Infrastructure

**Files:**
- Create: `docker-compose.yml`
- Create: `infra/postgres/init.sql`

- [ ] Add Docker Compose services for Postgres and Redis.
- [ ] Match env names to the app config.

### Task 10: Install, Generate, Verify

**Files:**
- Modify: `package.json`
- Modify: any package manifests required by install feedback

- [ ] Install dependencies.
- [ ] Generate Prisma client.
- [ ] Run `pnpm lint`.
- [ ] Run `pnpm test`.
- [ ] Run `pnpm typecheck`.
- [ ] Fix any scaffold errors until all three succeed.
