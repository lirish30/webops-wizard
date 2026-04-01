# GitHub Actions And Release Engineering

## Scope

This document defines the initial CI, branch protection, preview deployment, and secrets setup strategy for WebOps Wizard.

The chosen model is:

- GitHub Actions for install, lint, typecheck, unit tests, build, and migration checks
- Vercel-managed preview deployments for `apps/web` only
- API and worker remain non-preview services in the initial setup

## CI Workflow

Workflow file:

- [ci.yml](/Users/loganirish/Documents/GitHub/WebOps%20Wizard/.github/workflows/ci.yml)

### What CI Does

On every pull request and every push to `main`, CI runs:

1. dependency install with a frozen lockfile
2. Prisma client generation
3. Prisma schema and migration readiness checks
4. lint
5. typecheck
6. unit tests
7. production build

### Why This Order

- install and Prisma generation fail fast on dependency or schema issues
- migration checks run before application checks so schema problems are surfaced early
- lint and typecheck catch structural failures before slower build validation
- build remains the final integration gate

## Migration Check Strategy

Current migration check command:

- `pnpm db:migration:check`

This currently validates:

- Prisma schema formatting compliance
- Prisma schema validity

This is intentionally conservative because the repo does not yet have a committed migrations history.

### Follow-Up Recommendation

Once the team starts committing Prisma migrations, expand the migration check to include:

- `prisma migrate status`
- `prisma migrate diff` in CI
- a required rule that schema changes must include a migration directory

## Branch Protection Recommendations

Apply branch protection to `main`.

### Required Settings

- require pull requests before merging
- require at least 1 approving review
- require conversation resolution before merge
- require status checks to pass before merge
- require branches to be up to date before merge
- restrict force pushes
- restrict branch deletion

### Required Status Checks

Use the GitHub Actions job name as the required check:

- `Install, Lint, Typecheck, Test, Build, Migration Check`

If the workflow is later split into multiple jobs, protect on each explicit job instead of the workflow name.

### Recommended Additional Rules

- dismiss stale approvals when new commits are pushed
- require review from code owners after CODEOWNERS is added
- require linear history if the team wants a cleaner release history

## Preview Deployment Strategy

## Chosen Strategy

Use Vercel preview deployments for `apps/web` only.

This is the right initial setup because:

- the web app is the only surface that benefits materially from PR preview review right now
- API and worker previews would add infrastructure complexity before those services have public review value
- Vercel previews integrate cleanly with GitHub pull requests

## Expected Behavior

For every pull request:

- GitHub Actions validates quality gates
- Vercel creates a preview deployment for the web app
- reviewers use the Vercel preview URL to validate UI changes

## Vercel Project Setup

Configure the Vercel project with:

- framework preset: Next.js
- root directory: `apps/web`
- install command: `pnpm install --frozen-lockfile`
- build command: `pnpm build --filter @webops-wizard/web...` or Vercel default for the root directory
- output settings: Vercel default for Next.js

### Recommended Monorepo Settings

- keep the Vercel root directory scoped to `apps/web`
- make sure the repo root `pnpm-lock.yaml` is committed
- configure preview environment variables in Vercel, not in GitHub Actions

## Secrets Setup

## GitHub Secrets

The current CI workflow does not require repository secrets because it uses ephemeral local service containers and non-production placeholder environment values.

This is deliberate. CI should stay as secrets-light as possible.

### Add GitHub Secrets Later Only If Needed

Examples:

- `VERCEL_TOKEN` if a future GitHub Action explicitly drives Vercel deployment
- `VERCEL_ORG_ID` if using Vercel CLI in Actions
- `VERCEL_PROJECT_ID` if using Vercel CLI in Actions
- error tracking upload tokens
- package registry auth tokens

## Vercel Environment Variables

Configure these in Vercel for the web project:

- `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_API_URL`

Use separate values for:

- Production
- Preview
- Development if using Vercel local workflows

### Preview Environment Guidance

For preview deployments:

- `NEXT_PUBLIC_APP_NAME=WebOps Wizard Preview`
- `NEXT_PUBLIC_APP_URL` should be the Vercel preview URL or left to Vercel-provided URL handling as needed
- `NEXT_PUBLIC_API_URL` should point to the chosen shared non-preview API base URL for early-stage testing

Because previews are web-only, the preview frontend will call the shared development or staging API, not a per-PR backend.

## Operational Notes

## API And Worker Deployment

This initial strategy does not set up preview deployments for:

- `apps/api`
- `apps/worker`

Recommended next production path:

- deploy API and worker to a stable staging environment
- point Vercel previews to staging API endpoints
- add protected production environments later

## Failure Modes To Watch

- Vercel preview succeeds but CI fails:
  Merge must still be blocked by required status checks.

- CI succeeds but Vercel preview fails:
  Review the preview separately; this should still block merge if preview validation is part of release policy.

- Prisma schema changes without migrations:
  Current checks catch schema validity, but not migration completeness. Tighten this once migrations start landing.

## Recommended Next Follow-Ups

- add `CODEOWNERS`
- add environment protection rules for production deploys
- expand Prisma migration checks after the first real migration lands
- add a deploy workflow only when API and worker hosting decisions are finalized
