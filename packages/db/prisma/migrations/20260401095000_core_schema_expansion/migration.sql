-- Ensure required extension for case-insensitive email fields.
CREATE EXTENSION IF NOT EXISTS citext;

-- CreateEnum
CREATE TYPE "WorkspacePlanTier" AS ENUM ('starter', 'growth', 'pro', 'enterprise');

-- CreateEnum
CREATE TYPE "PropertyBusinessModel" AS ENUM ('lead_gen', 'trial', 'hybrid', 'ecommerce_like', 'other');

-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('draft', 'active', 'paused', 'archived');

-- CreateEnum
CREATE TYPE "IntegrationAuthType" AS ENUM ('oauth', 'api_key', 'service_account', 'manual');

-- CreateEnum
CREATE TYPE "DataSourceHealthStatus" AS ENUM ('healthy', 'stale', 'partial', 'error');

-- CreateEnum
CREATE TYPE "DataScopeType" AS ENUM ('property', 'page', 'template', 'metric');

-- CreateEnum
CREATE TYPE "AnnotationScopeType" AS ENUM ('property', 'page', 'template', 'metric', 'report');

-- CreateEnum
CREATE TYPE "AnnotationType" AS ENUM ('tracking_change', 'consent_issue', 'source_conflict', 'caveat', 'outage');

-- CreateEnum
CREATE TYPE "AnnotationSeverity" AS ENUM ('info', 'warning', 'critical');

-- CreateEnum
CREATE TYPE "PageGroupType" AS ENUM ('structural', 'funnel', 'business_line', 'owner', 'priority');

-- CreateEnum
CREATE TYPE "IndexabilityStatus" AS ENUM ('indexable', 'noindex', 'blocked', 'unknown');

-- CreateEnum
CREATE TYPE "PriorityTier" AS ENUM ('p0', 'p1', 'p2', 'p3');

-- CreateEnum
CREATE TYPE "CanonicalPageStatus" AS ENUM ('active', 'retired', 'redirected', 'draft_like');

-- CreateEnum
CREATE TYPE "ConversionType" AS ENUM ('primary', 'secondary', 'assist', 'revenue');

-- CreateEnum
CREATE TYPE "ConversionDefinitionStatus" AS ENUM ('active', 'retired', 'draft');

-- CreateEnum
CREATE TYPE "ReleaseEventType" AS ENUM ('deploy', 'cms_publish', 'campaign_launch', 'tracking_change', 'migration', 'manual');

-- CreateEnum
CREATE TYPE "ReleaseScopeType" AS ENUM ('property', 'page', 'template', 'page_group');

-- CreateEnum
CREATE TYPE "ExperimentStatus" AS ENUM ('planned', 'active', 'paused', 'complete', 'cancelled');

-- CreateEnum
CREATE TYPE "ExperimentScopeType" AS ENUM ('page', 'template', 'page_group');

-- CreateEnum
CREATE TYPE "ExperimentOutcome" AS ENUM ('win', 'loss', 'inconclusive', 'pending');

-- CreateEnum
CREATE TYPE "RecommendationType" AS ENUM ('fix', 'improve', 'test', 'refresh', 'consolidate', 'investigate', 'monitor', 'validate', 'migrate');

-- CreateEnum
CREATE TYPE "RecommendationDomain" AS ENUM ('seo', 'cro', 'content', 'technical', 'analytics_governance', 'trust', 'migration', 'reporting');

-- CreateEnum
CREATE TYPE "RecommendationScopeType" AS ENUM ('page', 'template', 'page_group', 'property');

-- CreateEnum
CREATE TYPE "SeverityLevel" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "EffortSize" AS ENUM ('xs', 's', 'm', 'l', 'xl');

-- CreateEnum
CREATE TYPE "ReversibilityRisk" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('new', 'triaged', 'accepted', 'rejected', 'planned', 'in_progress', 'awaiting_validation', 'validated', 'reopened', 'not_applicable', 'blocked', 'archived');

-- CreateEnum
CREATE TYPE "ApprovalState" AS ENUM ('none', 'pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "RecommendationVerificationState" AS ENUM ('not_started', 'pending', 'passed', 'failed');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('weekly', 'seo_monthly', 'cro_monthly', 'content_refresh', 'technical', 'leadership', 'custom');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('draft', 'pending_approval', 'approved', 'sent', 'failed');

-- CreateEnum
CREATE TYPE "ReportGeneratedBy" AS ENUM ('system', 'user', 'ai_assisted');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('traffic_anomaly', 'conversion_anomaly', 'ranking_drop', 'indexing_issue', 'page_speed_regression', 'tracking_failure', 'content_change', 'crawl_spike', 'release_regression');

-- CreateEnum
CREATE TYPE "AlertScopeType" AS ENUM ('property', 'page', 'template', 'page_group');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('info', 'warning', 'critical');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('open', 'acknowledged', 'resolved', 'suppressed');

-- AlterEnum
BEGIN;
CREATE TYPE "PropertyEnvironment_new" AS ENUM ('prod', 'stage', 'sandbox');
ALTER TABLE "Property" ALTER COLUMN "environment" DROP DEFAULT;
ALTER TABLE "properties" ALTER COLUMN "environment" TYPE "PropertyEnvironment_new" USING ("environment"::text::"PropertyEnvironment_new");
ALTER TYPE "PropertyEnvironment" RENAME TO "PropertyEnvironment_old";
ALTER TYPE "PropertyEnvironment_new" RENAME TO "PropertyEnvironment";
DROP TYPE "PropertyEnvironment_old";
COMMIT;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "IntegrationProvider" ADD VALUE 'wordpress';
ALTER TYPE "IntegrationProvider" ADD VALUE 'hubspot';
ALTER TYPE "IntegrationProvider" ADD VALUE 'other';

-- AlterEnum
ALTER TYPE "IntegrationStatus" ADD VALUE 'disconnected';

-- DropForeignKey
ALTER TABLE "Workspace" DROP CONSTRAINT "Workspace_ownerUserId_fkey";

-- DropForeignKey
ALTER TABLE "WorkspaceMembership" DROP CONSTRAINT "WorkspaceMembership_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "WorkspaceMembership" DROP CONSTRAINT "WorkspaceMembership_userId_fkey";

-- DropForeignKey
ALTER TABLE "AuthSession" DROP CONSTRAINT "AuthSession_userId_fkey";

-- DropForeignKey
ALTER TABLE "PasswordResetToken" DROP CONSTRAINT "PasswordResetToken_userId_fkey";

-- DropForeignKey
ALTER TABLE "WorkspaceInvite" DROP CONSTRAINT "WorkspaceInvite_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "WorkspaceInvite" DROP CONSTRAINT "WorkspaceInvite_inviterUserId_fkey";

-- DropForeignKey
ALTER TABLE "WorkspaceInvite" DROP CONSTRAINT "WorkspaceInvite_acceptedUserId_fkey";

-- DropForeignKey
ALTER TABLE "ExternalIdentityLink" DROP CONSTRAINT "ExternalIdentityLink_userId_fkey";

-- DropForeignKey
ALTER TABLE "ExternalIdentityLink" DROP CONSTRAINT "ExternalIdentityLink_providerId_fkey";

-- DropForeignKey
ALTER TABLE "Property" DROP CONSTRAINT "Property_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "IntegrationConnection" DROP CONSTRAINT "IntegrationConnection_propertyId_fkey";

-- DropForeignKey
ALTER TABLE "Recommendation" DROP CONSTRAINT "Recommendation_propertyId_fkey";

-- DropForeignKey
ALTER TABLE "Alert" DROP CONSTRAINT "Alert_propertyId_fkey";

-- DropForeignKey
ALTER TABLE "ReleaseAnnotation" DROP CONSTRAINT "ReleaseAnnotation_propertyId_fkey";

-- DropForeignKey
ALTER TABLE "AuditLogEvent" DROP CONSTRAINT "AuditLogEvent_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "AuditLogEvent" DROP CONSTRAINT "AuditLogEvent_actorUserId_fkey";

-- DropTable
DROP TABLE "User";

-- DropTable
DROP TABLE "Workspace";

-- DropTable
DROP TABLE "WorkspaceMembership";

-- DropTable
DROP TABLE "AuthSession";

-- DropTable
DROP TABLE "PasswordResetToken";

-- DropTable
DROP TABLE "WorkspaceInvite";

-- DropTable
DROP TABLE "IdentityProvider";

-- DropTable
DROP TABLE "ExternalIdentityLink";

-- DropTable
DROP TABLE "Property";

-- DropTable
DROP TABLE "IntegrationConnection";

-- DropTable
DROP TABLE "Recommendation";

-- DropTable
DROP TABLE "Alert";

-- DropTable
DROP TABLE "ReleaseAnnotation";

-- DropTable
DROP TABLE "AuditLogEvent";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" CITEXT NOT NULL,
    "password_hash" TEXT,
    "full_name" TEXT NOT NULL,
    "auth_provider" "AuthProvider" NOT NULL DEFAULT 'local',
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "plan_tier" "WorkspacePlanTier" NOT NULL DEFAULT 'starter',
    "region" TEXT NOT NULL DEFAULT 'us',
    "status" "WorkspaceStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_memberships" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "scope_json" JSONB,
    "last_active_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "workspace_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "active_workspace_id" TEXT,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "last_used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_invites" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "email" CITEXT NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "inviter_user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "accepted_at" TIMESTAMPTZ(6),
    "accepted_user_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "workspace_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity_providers" (
    "id" TEXT NOT NULL,
    "type" "IdentityProviderType" NOT NULL,
    "display_name" TEXT NOT NULL,
    "status" "IdentityProviderStatus" NOT NULL DEFAULT 'coming_soon',
    "config_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "identity_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_identity_links" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "provider_subject" TEXT NOT NULL,
    "email_snapshot" CITEXT NOT NULL,
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "external_identity_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "primary_domain" TEXT NOT NULL,
    "environment" "PropertyEnvironment" NOT NULL DEFAULT 'prod',
    "business_model" "PropertyBusinessModel" NOT NULL DEFAULT 'other',
    "analytics_source_of_truth" TEXT,
    "conversion_source_of_truth" TEXT,
    "crm_source_of_truth" TEXT,
    "status" "PropertyStatus" NOT NULL DEFAULT 'draft',
    "setup_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_settings" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "include_rules_json" JSONB,
    "exclude_rules_json" JSONB,
    "taxonomy_settings_json" JSONB,
    "benchmark_settings_json" JSONB,
    "alert_settings_json" JSONB,
    "report_settings_json" JSONB,
    "trust_policy_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "property_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_connections" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "property_id" TEXT,
    "provider" "IntegrationProvider" NOT NULL,
    "auth_type" "IntegrationAuthType" NOT NULL DEFAULT 'oauth',
    "status" "IntegrationStatus" NOT NULL DEFAULT 'syncing',
    "credential_ref" TEXT,
    "config_json" JSONB,
    "last_synced_at" TIMESTAMPTZ(6),
    "last_success_at" TIMESTAMPTZ(6),
    "last_error_at" TIMESTAMPTZ(6),
    "last_error_message" TEXT,
    "freshness_sla_minutes" INTEGER,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "integration_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_source_health" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "integration_connection_id" TEXT NOT NULL,
    "source_name" TEXT NOT NULL,
    "health_status" "DataSourceHealthStatus" NOT NULL DEFAULT 'healthy',
    "freshness_score" DECIMAL(6,3),
    "coverage_score" DECIMAL(6,3),
    "reliability_score" DECIMAL(6,3),
    "issue_count" INTEGER NOT NULL DEFAULT 0,
    "measured_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "data_source_health_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comparability_windows" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "scope_type" "DataScopeType" NOT NULL,
    "scope_id" TEXT,
    "reason_code" TEXT NOT NULL,
    "notes" TEXT,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comparability_windows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "measurement_annotations" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "scope_type" "AnnotationScopeType" NOT NULL,
    "scope_id" TEXT,
    "annotation_type" "AnnotationType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "AnnotationSeverity" NOT NULL,
    "active_from" TIMESTAMPTZ(6) NOT NULL,
    "active_to" TIMESTAMPTZ(6),
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "measurement_annotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_groups" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "group_type" "PageGroupType" NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "page_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "templates" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "template_family" TEXT,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canonical_pages" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "canonical_url" TEXT NOT NULL,
    "normalized_url_key" TEXT NOT NULL,
    "title" TEXT,
    "meta_title" TEXT,
    "meta_description" TEXT,
    "h1" TEXT,
    "template_id" TEXT,
    "page_group_id" TEXT,
    "page_archetype" TEXT,
    "content_type" TEXT,
    "funnel_stage" TEXT,
    "owner_team" TEXT,
    "owner_user_id" TEXT,
    "language_code" TEXT,
    "region_code" TEXT,
    "indexability_status" "IndexabilityStatus" NOT NULL DEFAULT 'indexable',
    "canonical_target_url" TEXT,
    "redirect_target_url" TEXT,
    "priority_tier" "PriorityTier" NOT NULL DEFAULT 'p2',
    "status" "CanonicalPageStatus" NOT NULL DEFAULT 'active',
    "first_seen_at" TIMESTAMPTZ(6),
    "last_seen_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "canonical_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "url_records" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "canonical_page_id" TEXT NOT NULL,
    "raw_url" TEXT NOT NULL,
    "normalized_url_key" TEXT NOT NULL,
    "is_current_alias" BOOLEAN NOT NULL DEFAULT true,
    "first_seen_at" TIMESTAMPTZ(6),
    "last_seen_at" TIMESTAMPTZ(6),
    "source" TEXT,

    CONSTRAINT "url_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "localization_variants" (
    "id" TEXT NOT NULL,
    "canonical_page_id" TEXT NOT NULL,
    "locale_code" TEXT NOT NULL,
    "region_code" TEXT,
    "url_record_id" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "localization_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_state_snapshots" (
    "id" TEXT NOT NULL,
    "canonical_page_id" TEXT NOT NULL,
    "snapshot_date" DATE NOT NULL,
    "title" TEXT,
    "meta_title" TEXT,
    "meta_description" TEXT,
    "h1" TEXT,
    "template_id" TEXT,
    "content_hash" TEXT,
    "indexability_status" TEXT,
    "internal_link_count" INTEGER,
    "crawl_depth" INTEGER,
    "word_count" INTEGER,
    "schema_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_state_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_metric_daily" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "canonical_page_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "sessions" DECIMAL(18,4),
    "users" DECIMAL(18,4),
    "entrances" DECIMAL(18,4),
    "engagement_rate" DECIMAL(10,6),
    "avg_engagement_seconds" DECIMAL(18,4),
    "cta_clicks" DECIMAL(18,4),
    "form_starts" DECIMAL(18,4),
    "form_completions" DECIMAL(18,4),
    "conversion_count" DECIMAL(18,4),
    "conversion_rate" DECIMAL(10,6),
    "assisted_conversion_value" DECIMAL(18,4),
    "revenue_influence" DECIMAL(18,4),
    "organic_clicks" DECIMAL(18,4),
    "organic_impressions" DECIMAL(18,4),
    "avg_position" DECIMAL(10,4),
    "ctr" DECIMAL(10,6),
    "page_speed_score" DECIMAL(10,4),
    "cwv_lcp" DECIMAL(10,4),
    "cwv_cls" DECIMAL(10,6),
    "cwv_inp" DECIMAL(10,4),
    "trust_score" DECIMAL(10,6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_metric_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "query_metric_daily" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "canonical_page_id" TEXT,
    "query_text" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "clicks" DECIMAL(18,4),
    "impressions" DECIMAL(18,4),
    "ctr" DECIMAL(10,6),
    "avg_position" DECIMAL(10,4),
    "country_code" TEXT,
    "device_type" TEXT,

    CONSTRAINT "query_metric_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversion_definitions" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "conversion_type" "ConversionType" NOT NULL,
    "status" "ConversionDefinitionStatus" NOT NULL DEFAULT 'draft',
    "current_version_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "conversion_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversion_definition_versions" (
    "id" TEXT NOT NULL,
    "conversion_definition_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "event_name" TEXT NOT NULL,
    "matching_rules_json" JSONB,
    "external_flow_rules_json" JSONB,
    "exclusion_rules_json" JSONB,
    "attribution_notes" TEXT,
    "effective_from" TIMESTAMPTZ(6) NOT NULL,
    "effective_to" TIMESTAMPTZ(6),
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversion_definition_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "release_events" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "event_type" "ReleaseEventType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "related_scope_type" "ReleaseScopeType",
    "related_scope_id" TEXT,
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "ended_at" TIMESTAMPTZ(6),
    "source" TEXT,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "release_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experiments" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ExperimentStatus" NOT NULL,
    "related_scope_type" "ExperimentScopeType" NOT NULL,
    "related_scope_id" TEXT NOT NULL,
    "hypothesis" TEXT,
    "variant_notes" TEXT,
    "owner_user_id" TEXT,
    "started_at" TIMESTAMPTZ(6),
    "ended_at" TIMESTAMPTZ(6),
    "outcome" "ExperimentOutcome" NOT NULL DEFAULT 'pending',
    "learnings" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "experiments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendations" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "recommendation_type" "RecommendationType" NOT NULL DEFAULT 'investigate',
    "domain" "RecommendationDomain" NOT NULL DEFAULT 'technical',
    "category" TEXT,
    "related_scope_type" "RecommendationScopeType" NOT NULL DEFAULT 'property',
    "related_scope_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "why_it_matters" TEXT,
    "suggested_action" TEXT,
    "evidence_json" JSONB,
    "source_evidence_json" JSONB,
    "impact_score" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "actionability_score" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "trust_score" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "confidence_score" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "severity" "SeverityLevel" NOT NULL DEFAULT 'medium',
    "estimated_effort" "EffortSize",
    "expected_time_to_impact_days" INTEGER,
    "reversibility_risk" "ReversibilityRisk",
    "dependency_flags_json" JSONB,
    "status" "RecommendationStatus" NOT NULL DEFAULT 'new',
    "owner_team" TEXT,
    "owner_user_id" TEXT,
    "due_date" DATE,
    "linked_ticket_ref" TEXT,
    "approval_state" "ApprovalState" NOT NULL DEFAULT 'none',
    "implementation_verification_state" "RecommendationVerificationState" NOT NULL DEFAULT 'not_started',
    "generated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "report_type" "ReportType" NOT NULL,
    "title" TEXT NOT NULL,
    "date_range_start" DATE NOT NULL,
    "date_range_end" DATE NOT NULL,
    "audience_preset" TEXT,
    "summary_markdown" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'draft',
    "generated_by" "ReportGeneratedBy" NOT NULL DEFAULT 'system',
    "generated_by_user_id" TEXT,
    "approved_by_user_id" TEXT,
    "sent_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "alert_type" "AlertType" NOT NULL DEFAULT 'traffic_anomaly',
    "type" TEXT,
    "related_scope_type" "AlertScopeType",
    "related_scope_id" TEXT,
    "severity" "AlertSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "body" TEXT,
    "evidence_json" JSONB,
    "confidence_score" DECIMAL(10,6),
    "dedupe_key" TEXT,
    "status" "AlertStatus" NOT NULL DEFAULT 'open',
    "triggered_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(6),

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "property_id" TEXT,
    "actor_user_id" TEXT,
    "actor_type" "AuditActorType" NOT NULL DEFAULT 'user',
    "action_type" TEXT,
    "category" "AuditEventCategory",
    "event_type" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" TEXT,
    "metadata_json" JSONB,
    "request_id" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_slug_key" ON "workspaces"("slug");

-- CreateIndex
CREATE INDEX "workspaces_owner_user_id_idx" ON "workspaces"("owner_user_id");

-- CreateIndex
CREATE INDEX "workspace_memberships_user_id_idx" ON "workspace_memberships"("user_id");

-- CreateIndex
CREATE INDEX "workspace_memberships_workspace_id_role_idx" ON "workspace_memberships"("workspace_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_memberships_workspace_id_user_id_key" ON "workspace_memberships"("workspace_id", "user_id");

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions"("user_id");

-- CreateIndex
CREATE INDEX "auth_sessions_expires_at_idx" ON "auth_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

-- CreateIndex
CREATE INDEX "password_reset_tokens_expires_at_idx" ON "password_reset_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "workspace_invites_workspace_id_email_idx" ON "workspace_invites"("workspace_id", "email");

-- CreateIndex
CREATE INDEX "workspace_invites_expires_at_idx" ON "workspace_invites"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "identity_providers_type_key" ON "identity_providers"("type");

-- CreateIndex
CREATE INDEX "external_identity_links_user_id_idx" ON "external_identity_links"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "external_identity_links_provider_id_provider_subject_key" ON "external_identity_links"("provider_id", "provider_subject");

-- CreateIndex
CREATE INDEX "properties_workspace_id_idx" ON "properties"("workspace_id");

-- CreateIndex
CREATE INDEX "properties_workspace_id_status_idx" ON "properties"("workspace_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "property_settings_property_id_key" ON "property_settings"("property_id");

-- CreateIndex
CREATE INDEX "integration_connections_workspace_id_idx" ON "integration_connections"("workspace_id");

-- CreateIndex
CREATE INDEX "integration_connections_property_id_idx" ON "integration_connections"("property_id");

-- CreateIndex
CREATE INDEX "integration_connections_status_idx" ON "integration_connections"("status");

-- CreateIndex
CREATE INDEX "integration_connections_property_id_provider_idx" ON "integration_connections"("property_id", "provider");

-- CreateIndex
CREATE INDEX "data_source_health_property_id_measured_at_idx" ON "data_source_health"("property_id", "measured_at");

-- CreateIndex
CREATE INDEX "data_source_health_integration_connection_id_measured_at_idx" ON "data_source_health"("integration_connection_id", "measured_at");

-- CreateIndex
CREATE INDEX "comparability_windows_property_id_start_date_end_date_idx" ON "comparability_windows"("property_id", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "comparability_windows_property_id_scope_type_scope_id_idx" ON "comparability_windows"("property_id", "scope_type", "scope_id");

-- CreateIndex
CREATE INDEX "measurement_annotations_property_id_active_from_active_to_idx" ON "measurement_annotations"("property_id", "active_from", "active_to");

-- CreateIndex
CREATE INDEX "measurement_annotations_property_id_scope_type_scope_id_idx" ON "measurement_annotations"("property_id", "scope_type", "scope_id");

-- CreateIndex
CREATE INDEX "page_groups_property_id_group_type_idx" ON "page_groups"("property_id", "group_type");

-- CreateIndex
CREATE UNIQUE INDEX "page_groups_property_id_name_key" ON "page_groups"("property_id", "name");

-- CreateIndex
CREATE INDEX "templates_property_id_active_idx" ON "templates"("property_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "templates_property_id_name_key" ON "templates"("property_id", "name");

-- CreateIndex
CREATE INDEX "canonical_pages_property_id_template_id_idx" ON "canonical_pages"("property_id", "template_id");

-- CreateIndex
CREATE INDEX "canonical_pages_property_id_page_group_id_idx" ON "canonical_pages"("property_id", "page_group_id");

-- CreateIndex
CREATE INDEX "canonical_pages_property_id_status_idx" ON "canonical_pages"("property_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "canonical_pages_property_id_normalized_url_key_key" ON "canonical_pages"("property_id", "normalized_url_key");

-- CreateIndex
CREATE INDEX "url_records_canonical_page_id_idx" ON "url_records"("canonical_page_id");

-- CreateIndex
CREATE INDEX "url_records_property_id_is_current_alias_idx" ON "url_records"("property_id", "is_current_alias");

-- CreateIndex
CREATE UNIQUE INDEX "url_records_property_id_normalized_url_key_key" ON "url_records"("property_id", "normalized_url_key");

-- CreateIndex
CREATE INDEX "localization_variants_url_record_id_idx" ON "localization_variants"("url_record_id");

-- CreateIndex
CREATE UNIQUE INDEX "localization_variants_canonical_page_id_locale_code_region__key" ON "localization_variants"("canonical_page_id", "locale_code", "region_code");

-- CreateIndex
CREATE INDEX "page_state_snapshots_snapshot_date_idx" ON "page_state_snapshots"("snapshot_date");

-- CreateIndex
CREATE UNIQUE INDEX "page_state_snapshots_canonical_page_id_snapshot_date_key" ON "page_state_snapshots"("canonical_page_id", "snapshot_date");

-- CreateIndex
CREATE INDEX "page_metric_daily_property_id_date_idx" ON "page_metric_daily"("property_id", "date");

-- CreateIndex
CREATE INDEX "page_metric_daily_canonical_page_id_date_idx" ON "page_metric_daily"("canonical_page_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "page_metric_daily_property_id_canonical_page_id_date_key" ON "page_metric_daily"("property_id", "canonical_page_id", "date");

-- CreateIndex
CREATE INDEX "query_metric_daily_property_id_date_idx" ON "query_metric_daily"("property_id", "date");

-- CreateIndex
CREATE INDEX "query_metric_daily_canonical_page_id_date_idx" ON "query_metric_daily"("canonical_page_id", "date");

-- CreateIndex
CREATE INDEX "query_metric_daily_property_id_query_text_date_idx" ON "query_metric_daily"("property_id", "query_text", "date");

-- CreateIndex
CREATE UNIQUE INDEX "conversion_definitions_current_version_id_key" ON "conversion_definitions"("current_version_id");

-- CreateIndex
CREATE INDEX "conversion_definitions_property_id_status_idx" ON "conversion_definitions"("property_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "conversion_definitions_property_id_name_key" ON "conversion_definitions"("property_id", "name");

-- CreateIndex
CREATE INDEX "conversion_definition_versions_effective_from_effective_to_idx" ON "conversion_definition_versions"("effective_from", "effective_to");

-- CreateIndex
CREATE UNIQUE INDEX "conversion_definition_versions_conversion_definition_id_ver_key" ON "conversion_definition_versions"("conversion_definition_id", "version_number");

-- CreateIndex
CREATE INDEX "release_events_property_id_started_at_idx" ON "release_events"("property_id", "started_at");

-- CreateIndex
CREATE INDEX "release_events_property_id_related_scope_type_related_scope_idx" ON "release_events"("property_id", "related_scope_type", "related_scope_id");

-- CreateIndex
CREATE INDEX "experiments_property_id_status_idx" ON "experiments"("property_id", "status");

-- CreateIndex
CREATE INDEX "experiments_property_id_related_scope_type_related_scope_id_idx" ON "experiments"("property_id", "related_scope_type", "related_scope_id");

-- CreateIndex
CREATE INDEX "recommendations_property_id_status_idx" ON "recommendations"("property_id", "status");

-- CreateIndex
CREATE INDEX "recommendations_property_id_severity_idx" ON "recommendations"("property_id", "severity");

-- CreateIndex
CREATE INDEX "recommendations_property_id_domain_idx" ON "recommendations"("property_id", "domain");

-- CreateIndex
CREATE INDEX "recommendations_property_id_related_scope_type_related_scop_idx" ON "recommendations"("property_id", "related_scope_type", "related_scope_id");

-- CreateIndex
CREATE INDEX "reports_property_id_status_idx" ON "reports"("property_id", "status");

-- CreateIndex
CREATE INDEX "reports_property_id_report_type_idx" ON "reports"("property_id", "report_type");

-- CreateIndex
CREATE INDEX "reports_sent_at_idx" ON "reports"("sent_at");

-- CreateIndex
CREATE INDEX "alerts_property_id_status_idx" ON "alerts"("property_id", "status");

-- CreateIndex
CREATE INDEX "alerts_property_id_severity_idx" ON "alerts"("property_id", "severity");

-- CreateIndex
CREATE INDEX "alerts_property_id_triggered_at_idx" ON "alerts"("property_id", "triggered_at");

-- CreateIndex
CREATE INDEX "alerts_property_id_dedupe_key_idx" ON "alerts"("property_id", "dedupe_key");

-- CreateIndex
CREATE INDEX "audit_logs_workspace_id_occurred_at_idx" ON "audit_logs"("workspace_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_logs_workspace_id_category_idx" ON "audit_logs"("workspace_id", "category");

-- CreateIndex
CREATE INDEX "audit_logs_workspace_id_event_type_idx" ON "audit_logs"("workspace_id", "event_type");

-- CreateIndex
CREATE INDEX "audit_logs_workspace_id_target_type_target_id_idx" ON "audit_logs"("workspace_id", "target_type", "target_id");

-- CreateIndex
CREATE INDEX "audit_logs_workspace_id_actor_user_id_idx" ON "audit_logs"("workspace_id", "actor_user_id");

-- CreateIndex
CREATE INDEX "audit_logs_property_id_occurred_at_idx" ON "audit_logs"("property_id", "occurred_at");

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_memberships" ADD CONSTRAINT "workspace_memberships_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_memberships" ADD CONSTRAINT "workspace_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_invites" ADD CONSTRAINT "workspace_invites_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_invites" ADD CONSTRAINT "workspace_invites_inviter_user_id_fkey" FOREIGN KEY ("inviter_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_invites" ADD CONSTRAINT "workspace_invites_accepted_user_id_fkey" FOREIGN KEY ("accepted_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_identity_links" ADD CONSTRAINT "external_identity_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_identity_links" ADD CONSTRAINT "external_identity_links_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "identity_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_settings" ADD CONSTRAINT "property_settings_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_source_health" ADD CONSTRAINT "data_source_health_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_source_health" ADD CONSTRAINT "data_source_health_integration_connection_id_fkey" FOREIGN KEY ("integration_connection_id") REFERENCES "integration_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparability_windows" ADD CONSTRAINT "comparability_windows_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparability_windows" ADD CONSTRAINT "comparability_windows_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "measurement_annotations" ADD CONSTRAINT "measurement_annotations_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "measurement_annotations" ADD CONSTRAINT "measurement_annotations_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_groups" ADD CONSTRAINT "page_groups_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "templates" ADD CONSTRAINT "templates_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical_pages" ADD CONSTRAINT "canonical_pages_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical_pages" ADD CONSTRAINT "canonical_pages_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical_pages" ADD CONSTRAINT "canonical_pages_page_group_id_fkey" FOREIGN KEY ("page_group_id") REFERENCES "page_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical_pages" ADD CONSTRAINT "canonical_pages_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "url_records" ADD CONSTRAINT "url_records_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "url_records" ADD CONSTRAINT "url_records_canonical_page_id_fkey" FOREIGN KEY ("canonical_page_id") REFERENCES "canonical_pages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "localization_variants" ADD CONSTRAINT "localization_variants_canonical_page_id_fkey" FOREIGN KEY ("canonical_page_id") REFERENCES "canonical_pages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "localization_variants" ADD CONSTRAINT "localization_variants_url_record_id_fkey" FOREIGN KEY ("url_record_id") REFERENCES "url_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_state_snapshots" ADD CONSTRAINT "page_state_snapshots_canonical_page_id_fkey" FOREIGN KEY ("canonical_page_id") REFERENCES "canonical_pages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_state_snapshots" ADD CONSTRAINT "page_state_snapshots_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_metric_daily" ADD CONSTRAINT "page_metric_daily_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_metric_daily" ADD CONSTRAINT "page_metric_daily_canonical_page_id_fkey" FOREIGN KEY ("canonical_page_id") REFERENCES "canonical_pages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "query_metric_daily" ADD CONSTRAINT "query_metric_daily_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "query_metric_daily" ADD CONSTRAINT "query_metric_daily_canonical_page_id_fkey" FOREIGN KEY ("canonical_page_id") REFERENCES "canonical_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversion_definitions" ADD CONSTRAINT "conversion_definitions_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversion_definitions" ADD CONSTRAINT "conversion_definitions_current_version_id_fkey" FOREIGN KEY ("current_version_id") REFERENCES "conversion_definition_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversion_definition_versions" ADD CONSTRAINT "conversion_definition_versions_conversion_definition_id_fkey" FOREIGN KEY ("conversion_definition_id") REFERENCES "conversion_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversion_definition_versions" ADD CONSTRAINT "conversion_definition_versions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release_events" ADD CONSTRAINT "release_events_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release_events" ADD CONSTRAINT "release_events_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_generated_by_user_id_fkey" FOREIGN KEY ("generated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
