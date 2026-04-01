import { PageGroupType, PriorityTier, PropertyBusinessModel, PropertyEnvironment } from "@prisma/client";
import { z } from "zod";

export const setupWizardSteps = [
  "workspaceDetails",
  "propertyBasics",
  "domainAndSitemap",
  "ga4Connection",
  "gscConnection",
  "conversionDefinitions",
  "priorityPagesAndPageGroups",
  "reportingRecipientsAndAlertSettings",
  "reviewAndActivate"
] as const;

export const setupWizardStepSchema = z.enum(setupWizardSteps);

export const workspaceDetailsStepSchema = z.object({
  workspaceName: z.string().min(1).max(120),
  workspaceSlug: z
    .string()
    .min(3)
    .max(64)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  region: z.string().min(2).max(40).optional(),
  timezone: z.string().min(3).max(80).optional()
});

export const propertyBasicsStepSchema = z.object({
  propertyName: z.string().min(1).max(160),
  environment: z.nativeEnum(PropertyEnvironment),
  businessModel: z.nativeEnum(PropertyBusinessModel),
  analyticsSourceOfTruth: z.string().min(1).max(120).optional(),
  conversionSourceOfTruth: z.string().min(1).max(120).optional(),
  crmSourceOfTruth: z.string().min(1).max(120).optional()
});

export const domainAndSitemapStepSchema = z.object({
  primaryDomain: z.string().trim().min(3).max(255),
  sitemapUrl: z.string().url().optional(),
  domainOwnership: z
    .object({
      method: z.enum(["dnsTxt", "htmlFile", "metaTag"]).default("dnsTxt"),
      status: z
        .enum(["notStarted", "instructionsReady", "pending", "verified", "failed"])
        .default("notStarted"),
      dnsTxtRecordName: z.string().max(255).optional(),
      dnsTxtRecordValue: z.string().max(500).optional(),
      htmlFileName: z.string().max(255).optional(),
      htmlFileToken: z.string().max(1000).optional(),
      metaTagName: z.string().max(255).optional(),
      metaTagContent: z.string().max(1000).optional(),
      lastAttemptAt: z.string().datetime().optional(),
      failureReason: z.string().max(2000).optional()
    })
    .default({
      method: "dnsTxt",
      status: "notStarted"
    }),
  sitemapConnectionStatus: z
    .enum(["connected", "warning", "error", "syncing", "disconnected"])
    .default("syncing")
});

export const ga4ConnectionStepSchema = z.object({
  status: z.enum(["connected", "warning", "error", "syncing", "disconnected"]),
  measurementId: z.string().min(4).max(60).optional(),
  propertyExternalId: z.string().min(1).max(120).optional(),
  dataStreamId: z.string().min(1).max(120).optional()
});

export const gscConnectionStepSchema = z.object({
  status: z.enum(["connected", "warning", "error", "syncing", "disconnected"]),
  siteUrl: z.string().url().optional(),
  propertyExternalId: z.string().min(1).max(120).optional()
});

export const conversionDefinitionInputSchema = z.object({
  name: z.string().min(1).max(160),
  conversionType: z.enum(["primary", "secondary", "assist", "revenue"]),
  status: z.enum(["active", "retired", "draft"]).default("active"),
  eventName: z.string().min(1).max(120),
  matchingRulesJson: z.unknown().optional(),
  externalFlowRulesJson: z.unknown().optional(),
  exclusionRulesJson: z.unknown().optional(),
  attributionNotes: z.string().max(5000).optional()
});

export const conversionDefinitionsStepSchema = z.object({
  definitions: z.array(conversionDefinitionInputSchema).max(100)
});

export const pageGroupInputSchema = z.object({
  name: z.string().min(1).max(120),
  groupType: z.nativeEnum(PageGroupType),
  description: z.string().max(2000).optional(),
  pages: z
    .array(
      z.object({
        canonicalUrl: z.string().url(),
        title: z.string().max(500).optional(),
        priorityTier: z.nativeEnum(PriorityTier).default("p2")
      })
    )
    .max(500)
    .default([])
});

export const priorityPagesAndPageGroupsStepSchema = z.object({
  pageGroups: z.array(pageGroupInputSchema).max(100),
  ungroupedPriorityPages: z
    .array(
      z.object({
        canonicalUrl: z.string().url(),
        title: z.string().max(500).optional(),
        priorityTier: z.nativeEnum(PriorityTier).default("p2")
      })
    )
    .max(500)
    .default([])
});

export const reportingRecipientsAndAlertSettingsStepSchema = z.object({
  reportingRecipients: z.array(z.string().email()).max(100),
  alerts: z.object({
    enabled: z.boolean().default(true),
    notifyEmails: z.array(z.string().email()).max(100).default([]),
    minimumSeverity: z.enum(["info", "warning", "critical"]).default("warning"),
    quietHours: z
      .object({
        startHour: z.number().int().min(0).max(23),
        endHour: z.number().int().min(0).max(23),
        timezone: z.string().min(3).max(80)
      })
      .optional()
  })
});

export const reviewAndActivateStepSchema = z.object({
  confirmedByUser: z.boolean(),
  notes: z.string().max(5000).optional()
});

export const stepPayloadSchemaMap = {
  workspaceDetails: workspaceDetailsStepSchema,
  propertyBasics: propertyBasicsStepSchema,
  domainAndSitemap: domainAndSitemapStepSchema,
  ga4Connection: ga4ConnectionStepSchema,
  gscConnection: gscConnectionStepSchema,
  conversionDefinitions: conversionDefinitionsStepSchema,
  priorityPagesAndPageGroups: priorityPagesAndPageGroupsStepSchema,
  reportingRecipientsAndAlertSettings: reportingRecipientsAndAlertSettingsStepSchema,
  reviewAndActivate: reviewAndActivateStepSchema
} as const;

const setupDraftBaseSchema = z.object({
  propertyId: z.string().uuid().optional(),
  step: setupWizardStepSchema,
  payload: z.unknown(),
  currentStep: setupWizardStepSchema.optional()
});

export const savePropertySetupDraftSchema = setupDraftBaseSchema.superRefine((value, context) => {
  const schema = stepPayloadSchemaMap[value.step];
  const parsed = schema.safeParse(value.payload);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["payload", ...issue.path],
        message: issue.message
      });
    }
  }
});

export type SetupWizardStep = z.infer<typeof setupWizardStepSchema>;
export type WorkspaceDetailsStepInput = z.infer<typeof workspaceDetailsStepSchema>;
export type PropertyBasicsStepInput = z.infer<typeof propertyBasicsStepSchema>;
export type DomainAndSitemapStepInput = z.infer<typeof domainAndSitemapStepSchema>;
export type Ga4ConnectionStepInput = z.infer<typeof ga4ConnectionStepSchema>;
export type GscConnectionStepInput = z.infer<typeof gscConnectionStepSchema>;
export type ConversionDefinitionsStepInput = z.infer<typeof conversionDefinitionsStepSchema>;
export type PriorityPagesAndPageGroupsStepInput = z.infer<
  typeof priorityPagesAndPageGroupsStepSchema
>;
export type ReportingRecipientsAndAlertSettingsStepInput = z.infer<
  typeof reportingRecipientsAndAlertSettingsStepSchema
>;
export type ReviewAndActivateStepInput = z.infer<typeof reviewAndActivateStepSchema>;
export type SavePropertySetupDraftInput = z.infer<typeof savePropertySetupDraftSchema>;

export type SetupWizardPayloadByStep = {
  workspaceDetails: WorkspaceDetailsStepInput;
  propertyBasics: PropertyBasicsStepInput;
  domainAndSitemap: DomainAndSitemapStepInput;
  ga4Connection: Ga4ConnectionStepInput;
  gscConnection: GscConnectionStepInput;
  conversionDefinitions: ConversionDefinitionsStepInput;
  priorityPagesAndPageGroups: PriorityPagesAndPageGroupsStepInput;
  reportingRecipientsAndAlertSettings: ReportingRecipientsAndAlertSettingsStepInput;
  reviewAndActivate: ReviewAndActivateStepInput;
};
