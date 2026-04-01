-- Connector framework tables for credential abstraction, sync runs, and run issues.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ConnectorSyncRunStatus') THEN
    CREATE TYPE "ConnectorSyncRunStatus" AS ENUM (
      'running',
      'success',
      'partial_failed',
      'failed',
      'retriable_failed'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ConnectorSyncRunTrigger') THEN
    CREATE TYPE "ConnectorSyncRunTrigger" AS ENUM (
      'schedule',
      'manual',
      'retry',
      'webhook'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "connector_credentials" (
  "id" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "provider" "IntegrationProvider" NOT NULL,
  "payload_json" JSONB NOT NULL,
  "metadata_json" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "connector_credentials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "connector_credentials_reference_key"
  ON "connector_credentials" ("reference");

CREATE INDEX IF NOT EXISTS "connector_credentials_workspace_id_provider_idx"
  ON "connector_credentials" ("workspace_id", "provider");

CREATE TABLE IF NOT EXISTS "connector_sync_runs" (
  "id" TEXT NOT NULL,
  "integration_connection_id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "property_id" TEXT,
  "provider" "IntegrationProvider" NOT NULL,
  "trigger" "ConnectorSyncRunTrigger" NOT NULL,
  "status" "ConnectorSyncRunStatus" NOT NULL,
  "partial_failure" BOOLEAN NOT NULL DEFAULT false,
  "started_at" TIMESTAMPTZ(6) NOT NULL,
  "finished_at" TIMESTAMPTZ(6),
  "freshness_metadata_json" JSONB,
  "coverage_metadata_json" JSONB,
  "health_metadata_json" JSONB,
  "error_message" TEXT,
  CONSTRAINT "connector_sync_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "connector_sync_runs_integration_connection_id_started_at_idx"
  ON "connector_sync_runs" ("integration_connection_id", "started_at");

CREATE INDEX IF NOT EXISTS "connector_sync_runs_workspace_id_started_at_idx"
  ON "connector_sync_runs" ("workspace_id", "started_at");

CREATE INDEX IF NOT EXISTS "connector_sync_runs_property_id_started_at_idx"
  ON "connector_sync_runs" ("property_id", "started_at");

CREATE TABLE IF NOT EXISTS "connector_sync_run_issues" (
  "id" TEXT NOT NULL,
  "run_id" TEXT NOT NULL,
  "segment" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "retryable" BOOLEAN NOT NULL DEFAULT false,
  "metadata_json" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "connector_sync_run_issues_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "connector_sync_run_issues_run_id_segment_idx"
  ON "connector_sync_run_issues" ("run_id", "segment");

ALTER TABLE "connector_credentials"
  DROP CONSTRAINT IF EXISTS "connector_credentials_workspace_id_fkey",
  ADD CONSTRAINT "connector_credentials_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "connector_sync_runs"
  DROP CONSTRAINT IF EXISTS "connector_sync_runs_integration_connection_id_fkey",
  ADD CONSTRAINT "connector_sync_runs_integration_connection_id_fkey"
  FOREIGN KEY ("integration_connection_id") REFERENCES "integration_connections"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "connector_sync_runs"
  DROP CONSTRAINT IF EXISTS "connector_sync_runs_workspace_id_fkey",
  ADD CONSTRAINT "connector_sync_runs_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "connector_sync_runs"
  DROP CONSTRAINT IF EXISTS "connector_sync_runs_property_id_fkey",
  ADD CONSTRAINT "connector_sync_runs_property_id_fkey"
  FOREIGN KEY ("property_id") REFERENCES "properties"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "connector_sync_run_issues"
  DROP CONSTRAINT IF EXISTS "connector_sync_run_issues_run_id_fkey",
  ADD CONSTRAINT "connector_sync_run_issues_run_id_fkey"
  FOREIGN KEY ("run_id") REFERENCES "connector_sync_runs"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
