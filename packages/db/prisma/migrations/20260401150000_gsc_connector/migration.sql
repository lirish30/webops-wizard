CREATE TABLE IF NOT EXISTS "search_console_sites" (
  "id" TEXT NOT NULL,
  "integration_connection_id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "site_url" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "permission_level" TEXT,
  "selected" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "search_console_sites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "search_console_sites_integration_connection_id_site_url_key"
  ON "search_console_sites" ("integration_connection_id", "site_url");

CREATE INDEX IF NOT EXISTS "search_console_sites_workspace_id_integration_connection_id_idx"
  ON "search_console_sites" ("workspace_id", "integration_connection_id");

CREATE INDEX IF NOT EXISTS "search_console_sites_integration_connection_id_selected_idx"
  ON "search_console_sites" ("integration_connection_id", "selected");

ALTER TABLE "search_console_sites"
  DROP CONSTRAINT IF EXISTS "search_console_sites_integration_connection_id_fkey",
  ADD CONSTRAINT "search_console_sites_integration_connection_id_fkey"
  FOREIGN KEY ("integration_connection_id") REFERENCES "integration_connections"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "search_console_sites"
  DROP CONSTRAINT IF EXISTS "search_console_sites_workspace_id_fkey",
  ADD CONSTRAINT "search_console_sites_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

DELETE FROM "query_metric_daily"
WHERE "canonical_page_id" IS NULL;

ALTER TABLE "query_metric_daily"
  ALTER COLUMN "canonical_page_id" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "query_metric_daily_property_id_canonical_page_id_query_text_date_key"
  ON "query_metric_daily" ("property_id", "canonical_page_id", "query_text", "date");
