-- Schema hardening for tenant safety, lifecycle consistency, and query performance.

-- Archive conventions.
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMPTZ(6);
ALTER TABLE "recommendations" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMPTZ(6);

ALTER TABLE "properties"
  DROP CONSTRAINT IF EXISTS "properties_archived_status_ck",
  ADD CONSTRAINT "properties_archived_status_ck"
  CHECK (
    "status" = 'archived'::"PropertyStatus"
    OR "archived_at" IS NULL
  );

ALTER TABLE "recommendations"
  DROP CONSTRAINT IF EXISTS "recommendations_archived_status_ck",
  ADD CONSTRAINT "recommendations_archived_status_ck"
  CHECK (
    "status" = 'archived'::"RecommendationStatus"
    OR "archived_at" IS NULL
  );

-- Token/session uniqueness and active-path indexes.
CREATE UNIQUE INDEX IF NOT EXISTS "auth_sessions_refresh_token_hash_key"
  ON "auth_sessions"("refresh_token_hash");

CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_tokens_token_hash_key"
  ON "password_reset_tokens"("token_hash");

CREATE UNIQUE INDEX IF NOT EXISTS "workspace_invites_token_hash_key"
  ON "workspace_invites"("token_hash");

CREATE INDEX IF NOT EXISTS "auth_sessions_user_id_revoked_at_expires_at_idx"
  ON "auth_sessions"("user_id", "revoked_at", "expires_at");

CREATE INDEX IF NOT EXISTS "password_reset_tokens_user_id_consumed_at_expires_at_idx"
  ON "password_reset_tokens"("user_id", "consumed_at", "expires_at");

CREATE INDEX IF NOT EXISTS "workspace_invites_workspace_id_accepted_at_expires_at_idx"
  ON "workspace_invites"("workspace_id", "accepted_at", "expires_at");

CREATE INDEX IF NOT EXISTS "auth_sessions_active_lookup_idx"
  ON "auth_sessions"("user_id", "expires_at")
  WHERE "revoked_at" IS NULL;

CREATE INDEX IF NOT EXISTS "password_reset_tokens_active_lookup_idx"
  ON "password_reset_tokens"("user_id", "expires_at")
  WHERE "consumed_at" IS NULL;

CREATE INDEX IF NOT EXISTS "workspace_invites_pending_lookup_idx"
  ON "workspace_invites"("workspace_id", "expires_at")
  WHERE "accepted_at" IS NULL;

-- Core uniqueness and planner improvements.
CREATE UNIQUE INDEX IF NOT EXISTS "properties_workspace_id_primary_domain_key"
  ON "properties"("workspace_id", "primary_domain");

CREATE UNIQUE INDEX IF NOT EXISTS "integration_connections_workspace_id_property_id_provider_key"
  ON "integration_connections"("workspace_id", "property_id", "provider");

CREATE INDEX IF NOT EXISTS "url_records_property_id_canonical_page_id_idx"
  ON "url_records"("property_id", "canonical_page_id");

CREATE INDEX IF NOT EXISTS "recommendations_property_id_status_due_date_idx"
  ON "recommendations"("property_id", "status", "due_date");

CREATE INDEX IF NOT EXISTS "alerts_property_id_status_triggered_at_idx"
  ON "alerts"("property_id", "status", "triggered_at");

CREATE INDEX IF NOT EXISTS "audit_logs_workspace_id_request_id_idx"
  ON "audit_logs"("workspace_id", "request_id");

-- Keep alert dedupe keys unique while an alert remains actionable.
CREATE UNIQUE INDEX IF NOT EXISTS "alerts_property_open_dedupe_key_key"
  ON "alerts"("property_id", "dedupe_key")
  WHERE "dedupe_key" IS NOT NULL
    AND "status" IN ('open'::"AlertStatus", 'acknowledged'::"AlertStatus");

-- Tenant consistency constraints for property-scoped child rows.
CREATE UNIQUE INDEX IF NOT EXISTS "canonical_pages_property_id_id_key"
  ON "canonical_pages"("property_id", "id");

CREATE UNIQUE INDEX IF NOT EXISTS "properties_workspace_id_id_key"
  ON "properties"("workspace_id", "id");

ALTER TABLE "url_records"
  DROP CONSTRAINT IF EXISTS "url_records_property_canonical_page_tenant_fkey",
  ADD CONSTRAINT "url_records_property_canonical_page_tenant_fkey"
  FOREIGN KEY ("property_id", "canonical_page_id")
  REFERENCES "canonical_pages"("property_id", "id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "page_metric_daily"
  DROP CONSTRAINT IF EXISTS "page_metric_daily_property_canonical_page_tenant_fkey",
  ADD CONSTRAINT "page_metric_daily_property_canonical_page_tenant_fkey"
  FOREIGN KEY ("property_id", "canonical_page_id")
  REFERENCES "canonical_pages"("property_id", "id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "integration_connections"
  DROP CONSTRAINT IF EXISTS "integration_connections_workspace_property_tenant_fkey",
  ADD CONSTRAINT "integration_connections_workspace_property_tenant_fkey"
  FOREIGN KEY ("workspace_id", "property_id")
  REFERENCES "properties"("workspace_id", "id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

-- Bind active workspace to a real workspace.
ALTER TABLE "auth_sessions"
  DROP CONSTRAINT IF EXISTS "auth_sessions_active_workspace_id_fkey",
  ADD CONSTRAINT "auth_sessions_active_workspace_id_fkey"
  FOREIGN KEY ("active_workspace_id")
  REFERENCES "workspaces"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- Align FK delete actions with schema lifecycle behavior.
ALTER TABLE "workspace_memberships" DROP CONSTRAINT IF EXISTS "workspace_memberships_workspace_id_fkey";
ALTER TABLE "workspace_memberships" ADD CONSTRAINT "workspace_memberships_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workspace_memberships" DROP CONSTRAINT IF EXISTS "workspace_memberships_user_id_fkey";
ALTER TABLE "workspace_memberships" ADD CONSTRAINT "workspace_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "auth_sessions" DROP CONSTRAINT IF EXISTS "auth_sessions_user_id_fkey";
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "password_reset_tokens" DROP CONSTRAINT IF EXISTS "password_reset_tokens_user_id_fkey";
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workspace_invites" DROP CONSTRAINT IF EXISTS "workspace_invites_workspace_id_fkey";
ALTER TABLE "workspace_invites" ADD CONSTRAINT "workspace_invites_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "external_identity_links" DROP CONSTRAINT IF EXISTS "external_identity_links_user_id_fkey";
ALTER TABLE "external_identity_links" ADD CONSTRAINT "external_identity_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "external_identity_links" DROP CONSTRAINT IF EXISTS "external_identity_links_provider_id_fkey";
ALTER TABLE "external_identity_links" ADD CONSTRAINT "external_identity_links_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "identity_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "property_settings" DROP CONSTRAINT IF EXISTS "property_settings_property_id_fkey";
ALTER TABLE "property_settings" ADD CONSTRAINT "property_settings_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "integration_connections" DROP CONSTRAINT IF EXISTS "integration_connections_workspace_id_fkey";
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "data_source_health" DROP CONSTRAINT IF EXISTS "data_source_health_property_id_fkey";
ALTER TABLE "data_source_health" ADD CONSTRAINT "data_source_health_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "data_source_health" DROP CONSTRAINT IF EXISTS "data_source_health_integration_connection_id_fkey";
ALTER TABLE "data_source_health" ADD CONSTRAINT "data_source_health_integration_connection_id_fkey" FOREIGN KEY ("integration_connection_id") REFERENCES "integration_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "comparability_windows" DROP CONSTRAINT IF EXISTS "comparability_windows_property_id_fkey";
ALTER TABLE "comparability_windows" ADD CONSTRAINT "comparability_windows_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "measurement_annotations" DROP CONSTRAINT IF EXISTS "measurement_annotations_property_id_fkey";
ALTER TABLE "measurement_annotations" ADD CONSTRAINT "measurement_annotations_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "page_groups" DROP CONSTRAINT IF EXISTS "page_groups_property_id_fkey";
ALTER TABLE "page_groups" ADD CONSTRAINT "page_groups_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "templates" DROP CONSTRAINT IF EXISTS "templates_property_id_fkey";
ALTER TABLE "templates" ADD CONSTRAINT "templates_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "canonical_pages" DROP CONSTRAINT IF EXISTS "canonical_pages_property_id_fkey";
ALTER TABLE "canonical_pages" ADD CONSTRAINT "canonical_pages_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "url_records" DROP CONSTRAINT IF EXISTS "url_records_property_id_fkey";
ALTER TABLE "url_records" ADD CONSTRAINT "url_records_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "url_records" DROP CONSTRAINT IF EXISTS "url_records_canonical_page_id_fkey";
ALTER TABLE "url_records" ADD CONSTRAINT "url_records_canonical_page_id_fkey" FOREIGN KEY ("canonical_page_id") REFERENCES "canonical_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "localization_variants" DROP CONSTRAINT IF EXISTS "localization_variants_canonical_page_id_fkey";
ALTER TABLE "localization_variants" ADD CONSTRAINT "localization_variants_canonical_page_id_fkey" FOREIGN KEY ("canonical_page_id") REFERENCES "canonical_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "localization_variants" DROP CONSTRAINT IF EXISTS "localization_variants_url_record_id_fkey";
ALTER TABLE "localization_variants" ADD CONSTRAINT "localization_variants_url_record_id_fkey" FOREIGN KEY ("url_record_id") REFERENCES "url_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "page_state_snapshots" DROP CONSTRAINT IF EXISTS "page_state_snapshots_canonical_page_id_fkey";
ALTER TABLE "page_state_snapshots" ADD CONSTRAINT "page_state_snapshots_canonical_page_id_fkey" FOREIGN KEY ("canonical_page_id") REFERENCES "canonical_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "page_metric_daily" DROP CONSTRAINT IF EXISTS "page_metric_daily_property_id_fkey";
ALTER TABLE "page_metric_daily" ADD CONSTRAINT "page_metric_daily_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "page_metric_daily" DROP CONSTRAINT IF EXISTS "page_metric_daily_canonical_page_id_fkey";
ALTER TABLE "page_metric_daily" ADD CONSTRAINT "page_metric_daily_canonical_page_id_fkey" FOREIGN KEY ("canonical_page_id") REFERENCES "canonical_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "query_metric_daily" DROP CONSTRAINT IF EXISTS "query_metric_daily_property_id_fkey";
ALTER TABLE "query_metric_daily" ADD CONSTRAINT "query_metric_daily_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "conversion_definitions" DROP CONSTRAINT IF EXISTS "conversion_definitions_property_id_fkey";
ALTER TABLE "conversion_definitions" ADD CONSTRAINT "conversion_definitions_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "conversion_definition_versions" DROP CONSTRAINT IF EXISTS "conversion_definition_versions_conversion_definition_id_fkey";
ALTER TABLE "conversion_definition_versions" ADD CONSTRAINT "conversion_definition_versions_conversion_definition_id_fkey" FOREIGN KEY ("conversion_definition_id") REFERENCES "conversion_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "release_events" DROP CONSTRAINT IF EXISTS "release_events_property_id_fkey";
ALTER TABLE "release_events" ADD CONSTRAINT "release_events_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "experiments" DROP CONSTRAINT IF EXISTS "experiments_property_id_fkey";
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recommendations" DROP CONSTRAINT IF EXISTS "recommendations_property_id_fkey";
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reports" DROP CONSTRAINT IF EXISTS "reports_property_id_fkey";
ALTER TABLE "reports" ADD CONSTRAINT "reports_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "alerts" DROP CONSTRAINT IF EXISTS "alerts_property_id_fkey";
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "audit_logs" DROP CONSTRAINT IF EXISTS "audit_logs_workspace_id_fkey";
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
