import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { IntegrationProvider, Prisma } from "@prisma/client";
import { prisma } from "@webops-wizard/db";

import {
  setupWizardSteps,
  stepPayloadSchemaMap,
  type SavePropertySetupDraftInput,
  type SetupWizardPayloadByStep,
  type SetupWizardStep
} from "./properties.dto";

type SetupDraftData = Partial<SetupWizardPayloadByStep>;

type PropertySetupDraftState = {
  currentStep: SetupWizardStep;
  completedSteps: SetupWizardStep[];
  draftData: SetupDraftData;
  updatedAt: string;
  updatedByUserId: string;
};

type PropertyConfigurationVersion = {
  versionNumber: number;
  createdAt: string;
  createdByUserId: string;
  configuration: SetupDraftData;
};

type PropertySetupState = {
  draft: PropertySetupDraftState;
  versions: PropertyConfigurationVersion[];
};

export type SetupActivationValidationError = {
  field: string;
  code:
    | "missing_step"
    | "invalid_step_payload"
    | "invalid_domain"
    | "missing_analytics_source"
    | "invalid_search_source"
    | "missing_search_source"
    | "missing_conversion_definition"
    | "missing_reporting_recipient"
    | "unconfirmed_review";
  message: string;
};

const setupStateRootKey = "propertySetupWizard";
const firstSetupStep: SetupWizardStep = "workspaceDetails";
const lastSetupStep: SetupWizardStep = "reviewAndActivate";

const fallbackDraftState: PropertySetupDraftState = {
  currentStep: firstSetupStep,
  completedSteps: [],
  draftData: {},
  updatedAt: new Date(0).toISOString(),
  updatedByUserId: "system"
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nextStepFor(currentStep: SetupWizardStep): SetupWizardStep {
  const currentIndex = setupWizardSteps.indexOf(currentStep);
  if (currentIndex < 0 || currentIndex >= setupWizardSteps.length - 1) {
    return lastSetupStep;
  }
  return setupWizardSteps[currentIndex + 1] ?? lastSetupStep;
}

function orderCompletedSteps(steps: Set<SetupWizardStep>): SetupWizardStep[] {
  return setupWizardSteps.filter((step) => steps.has(step));
}

function parseSetupState(trustPolicyJson: Prisma.JsonValue | null): PropertySetupState {
  if (!isRecord(trustPolicyJson)) {
    return { draft: fallbackDraftState, versions: [] };
  }

  const rawRoot = trustPolicyJson[setupStateRootKey];
  if (!isRecord(rawRoot)) {
    return { draft: fallbackDraftState, versions: [] };
  }

  const rawDraft = rawRoot.draft;
  const rawVersions = rawRoot.versions;

  const draft: PropertySetupDraftState =
    isRecord(rawDraft) &&
    typeof rawDraft.currentStep === "string" &&
    setupWizardSteps.includes(rawDraft.currentStep as SetupWizardStep) &&
    Array.isArray(rawDraft.completedSteps) &&
    isRecord(rawDraft.draftData) &&
    typeof rawDraft.updatedAt === "string" &&
    typeof rawDraft.updatedByUserId === "string"
      ? {
          currentStep: rawDraft.currentStep as SetupWizardStep,
          completedSteps: rawDraft.completedSteps.filter((value): value is SetupWizardStep =>
            typeof value === "string" ? setupWizardSteps.includes(value as SetupWizardStep) : false
          ),
          draftData: rawDraft.draftData as SetupDraftData,
          updatedAt: rawDraft.updatedAt,
          updatedByUserId: rawDraft.updatedByUserId
        }
      : fallbackDraftState;

  const versions: PropertyConfigurationVersion[] = [];
  if (Array.isArray(rawVersions)) {
    for (const rawVersion of rawVersions as unknown[]) {
      if (!isRecord(rawVersion) || !isRecord(rawVersion.configuration)) {
        continue;
      }
      if (
        typeof rawVersion.versionNumber !== "number" ||
        typeof rawVersion.createdAt !== "string" ||
        typeof rawVersion.createdByUserId !== "string"
      ) {
        continue;
      }

      versions.push({
        versionNumber: rawVersion.versionNumber,
        createdAt: rawVersion.createdAt,
        createdByUserId: rawVersion.createdByUserId,
        configuration: rawVersion.configuration as SetupDraftData
      });
    }
  }

  return { draft, versions };
}

function mergeSetupStateIntoTrustPolicy(
  trustPolicyJson: Prisma.JsonValue | null,
  state: PropertySetupState
): Prisma.InputJsonValue {
  const trustPolicy = isRecord(trustPolicyJson) ? { ...trustPolicyJson } : {};
  trustPolicy[setupStateRootKey] = state as unknown as Prisma.JsonValue;
  return trustPolicy as Prisma.InputJsonValue;
}

function normalizeUrlKey(urlString: string): string {
  const parsed = new URL(urlString);
  const pathname = parsed.pathname.replace(/\/+$/, "");
  return `${parsed.hostname}${pathname}`.toLowerCase() || parsed.hostname.toLowerCase();
}

function isValidDomainHost(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized.includes("://") || normalized.includes("/") || /\s/.test(normalized)) {
    return false;
  }

  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(normalized);
}

function isValidAbsoluteUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function pushActivationError(
  errors: SetupActivationValidationError[],
  error: SetupActivationValidationError
) {
  if (errors.some((candidate) => candidate.field === error.field && candidate.code === error.code)) {
    return;
  }

  errors.push(error);
}

export function validateSetupDraftForActivation(
  draftData: SetupDraftData
): SetupActivationValidationError[] {
  const errors: SetupActivationValidationError[] = [];

  for (const step of setupWizardSteps) {
    const payload = draftData[step];
    if (!payload) {
      pushActivationError(errors, {
        field: step,
        code: "missing_step",
        message: `Missing setup step: ${step}.`
      });
      continue;
    }

    const parsed = stepPayloadSchemaMap[step].safeParse(payload);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".");
        pushActivationError(errors, {
          field: path.length > 0 ? `${step}.${path}` : step,
          code: "invalid_step_payload",
          message: issue.message
        });
      }
    }
  }

  const domain = draftData.domainAndSitemap?.primaryDomain;
  if (typeof domain !== "string" || !isValidDomainHost(domain)) {
    pushActivationError(errors, {
      field: "domainAndSitemap.primaryDomain",
      code: "invalid_domain",
      message: "Primary domain must be a valid hostname like example.com."
    });
  }

  const ga4 = draftData.ga4Connection;
  if (!ga4 || ga4.status !== "connected") {
    pushActivationError(errors, {
      field: "ga4Connection.status",
      code: "missing_analytics_source",
      message: "Analytics source must be connected before activation."
    });
  } else if (!ga4.measurementId || !ga4.measurementId.trim()) {
    pushActivationError(errors, {
      field: "ga4Connection.measurementId",
      code: "missing_analytics_source",
      message: "Analytics source requires a GA4 measurement ID."
    });
  }

  const gsc = draftData.gscConnection;
  if (!gsc || gsc.status !== "connected") {
    pushActivationError(errors, {
      field: "gscConnection.status",
      code: "missing_search_source",
      message: "Search source must be connected before activation."
    });
  } else if (!gsc.siteUrl || !isValidAbsoluteUrl(gsc.siteUrl)) {
    pushActivationError(errors, {
      field: "gscConnection.siteUrl",
      code: "invalid_search_source",
      message: "Search source requires a valid site URL."
    });
  }

  const conversions = draftData.conversionDefinitions;
  if (!conversions || conversions.definitions.length === 0) {
    pushActivationError(errors, {
      field: "conversionDefinitions.definitions",
      code: "missing_conversion_definition",
      message: "Define at least one conversion before activation."
    });
  }

  const recipients = draftData.reportingRecipientsAndAlertSettings?.reportingRecipients ?? [];
  if (recipients.length === 0) {
    pushActivationError(errors, {
      field: "reportingRecipientsAndAlertSettings.reportingRecipients",
      code: "missing_reporting_recipient",
      message: "At least one reporting recipient is required."
    });
  }

  if (draftData.reviewAndActivate && !draftData.reviewAndActivate.confirmedByUser) {
    pushActivationError(errors, {
      field: "reviewAndActivate.confirmedByUser",
      code: "unconfirmed_review",
      message: "Review step must be confirmed by the user before activation."
    });
  }

  return errors;
}

@Injectable()
export class PropertiesService {
  async listProperties(workspaceId: string) {
    return prisma.property.findMany({
      where: { workspaceId },
      orderBy: [{ createdAt: "desc" }]
    });
  }

  async getSetupDraft(input: { workspaceId: string; propertyId: string }) {
    const property = await prisma.property.findFirst({
      where: {
        id: input.propertyId,
        workspaceId: input.workspaceId
      },
      include: {
        settings: true
      }
    });

    if (!property) {
      throw new NotFoundException("Property not found in workspace.");
    }

    const propertySetting = property.settings[0] ?? null;
    const state = parseSetupState(propertySetting?.trustPolicyJson ?? null);

    return {
      workspaceId: input.workspaceId,
      propertyId: property.id,
      propertyStatus: property.status,
      setupVersion: property.setupVersion,
      draft: state.draft,
      versions: state.versions
    };
  }

  async saveSetupDraft(input: {
    workspaceId: string;
    userId: string;
    payload: SavePropertySetupDraftInput;
  }) {
    const step = input.payload.step;

    let property = input.payload.propertyId
      ? await prisma.property.findFirst({
          where: {
            id: input.payload.propertyId,
            workspaceId: input.workspaceId
          },
          include: { settings: true }
        })
      : null;

    if (!property) {
      if (input.payload.propertyId) {
        throw new NotFoundException("Property not found in workspace.");
      }

      const seedName = "Untitled Property";
      const seedDomain = `draft-${Date.now()}.local`;

      property = await prisma.property.create({
        data: {
          workspaceId: input.workspaceId,
          name: seedName,
          primaryDomain: seedDomain,
          status: "draft",
          settings: {
            create: {}
          }
        },
        include: { settings: true }
      });
    }

    const propertySetting = property.settings[0] ?? null;
    const currentState = parseSetupState(propertySetting?.trustPolicyJson ?? null);
    const completedSet = new Set<SetupWizardStep>(currentState.draft.completedSteps);
    completedSet.add(step);

    const updatedDraftData: SetupDraftData = { ...currentState.draft.draftData };
    const propertyPatch: Parameters<typeof prisma.property.update>[0]["data"] = {};

    if (step === "workspaceDetails") {
      updatedDraftData.workspaceDetails = stepPayloadSchemaMap.workspaceDetails.parse(
        input.payload.payload
      );
    } else if (step === "propertyBasics") {
      const parsed = stepPayloadSchemaMap.propertyBasics.parse(input.payload.payload);
      updatedDraftData.propertyBasics = parsed;
      propertyPatch.name = parsed.propertyName;
      propertyPatch.environment = parsed.environment;
      propertyPatch.businessModel = parsed.businessModel;
      propertyPatch.analyticsSourceOfTruth = parsed.analyticsSourceOfTruth ?? null;
      propertyPatch.conversionSourceOfTruth = parsed.conversionSourceOfTruth ?? null;
      propertyPatch.crmSourceOfTruth = parsed.crmSourceOfTruth ?? null;
    } else if (step === "domainAndSitemap") {
      const parsed = stepPayloadSchemaMap.domainAndSitemap.parse(input.payload.payload);
      updatedDraftData.domainAndSitemap = parsed;
      propertyPatch.primaryDomain = parsed.primaryDomain.toLowerCase();
    } else if (step === "ga4Connection") {
      updatedDraftData.ga4Connection = stepPayloadSchemaMap.ga4Connection.parse(
        input.payload.payload
      );
    } else if (step === "gscConnection") {
      updatedDraftData.gscConnection = stepPayloadSchemaMap.gscConnection.parse(
        input.payload.payload
      );
    } else if (step === "conversionDefinitions") {
      updatedDraftData.conversionDefinitions = stepPayloadSchemaMap.conversionDefinitions.parse(
        input.payload.payload
      );
    } else if (step === "priorityPagesAndPageGroups") {
      updatedDraftData.priorityPagesAndPageGroups =
        stepPayloadSchemaMap.priorityPagesAndPageGroups.parse(input.payload.payload);
    } else if (step === "reportingRecipientsAndAlertSettings") {
      updatedDraftData.reportingRecipientsAndAlertSettings =
        stepPayloadSchemaMap.reportingRecipientsAndAlertSettings.parse(input.payload.payload);
    } else {
      updatedDraftData.reviewAndActivate = stepPayloadSchemaMap.reviewAndActivate.parse(
        input.payload.payload
      );
    }

    const updatedDraft: PropertySetupDraftState = {
      currentStep: input.payload.currentStep ?? nextStepFor(step),
      completedSteps: orderCompletedSteps(completedSet),
      draftData: updatedDraftData,
      updatedAt: new Date().toISOString(),
      updatedByUserId: input.userId
    };

    const nextState: PropertySetupState = {
      draft: updatedDraft,
      versions: currentState.versions
    };

    try {
      await prisma.$transaction(async (tx) => {
        if (Object.keys(propertyPatch).length > 0) {
          await tx.property.update({
            where: { id: property.id },
            data: propertyPatch
          });
        }

        await tx.propertySetting.upsert({
          where: { propertyId: property.id },
          create: {
            propertyId: property.id,
            trustPolicyJson: mergeSetupStateIntoTrustPolicy(
              propertySetting?.trustPolicyJson ?? null,
              nextState
            )
          },
          update: {
            trustPolicyJson: mergeSetupStateIntoTrustPolicy(
              propertySetting?.trustPolicyJson ?? null,
              nextState
            )
          }
        });
      });
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : "Unable to save setup draft."
      );
    }

    return this.getSetupDraft({ workspaceId: input.workspaceId, propertyId: property.id });
  }

  async activateSetup(input: { workspaceId: string; userId: string; propertyId: string }) {
    const property = await prisma.property.findFirst({
      where: {
        id: input.propertyId,
        workspaceId: input.workspaceId
      },
      include: {
        settings: true
      }
    });

    if (!property) {
      throw new NotFoundException("Property not found in workspace.");
    }

    const propertySetting = property.settings[0] ?? null;
    const currentState = parseSetupState(propertySetting?.trustPolicyJson ?? null);
    const activationErrors = validateSetupDraftForActivation(currentState.draft.draftData);
    if (activationErrors.length > 0) {
      throw new BadRequestException({
        message: "Property setup activation failed validation.",
        errors: activationErrors
      });
    }

    const workspaceDetails = stepPayloadSchemaMap.workspaceDetails.parse(
      currentState.draft.draftData.workspaceDetails
    );
    const propertyBasics = stepPayloadSchemaMap.propertyBasics.parse(
      currentState.draft.draftData.propertyBasics
    );
    const domainAndSitemap = stepPayloadSchemaMap.domainAndSitemap.parse(
      currentState.draft.draftData.domainAndSitemap
    );
    const ga4Connection = stepPayloadSchemaMap.ga4Connection.parse(
      currentState.draft.draftData.ga4Connection
    );
    const gscConnection = stepPayloadSchemaMap.gscConnection.parse(
      currentState.draft.draftData.gscConnection
    );
    const conversionDefinitions = stepPayloadSchemaMap.conversionDefinitions.parse(
      currentState.draft.draftData.conversionDefinitions
    );
    const priorityPagesAndGroups = stepPayloadSchemaMap.priorityPagesAndPageGroups.parse(
      currentState.draft.draftData.priorityPagesAndPageGroups
    );
    const reportingAndAlerts = stepPayloadSchemaMap.reportingRecipientsAndAlertSettings.parse(
      currentState.draft.draftData.reportingRecipientsAndAlertSettings
    );

    const versionNumber = property.setupVersion + 1;
    const timestamp = new Date();

    try {
      await prisma.$transaction(async (tx) => {
        await tx.workspace.update({
          where: { id: input.workspaceId },
          data: {
            name: workspaceDetails.workspaceName,
            ...(workspaceDetails.workspaceSlug ? { slug: workspaceDetails.workspaceSlug } : {}),
            ...(workspaceDetails.region ? { region: workspaceDetails.region } : {})
          }
        });

        await tx.property.update({
          where: { id: property.id },
          data: {
            name: propertyBasics.propertyName,
            environment: propertyBasics.environment,
            businessModel: propertyBasics.businessModel,
            analyticsSourceOfTruth: propertyBasics.analyticsSourceOfTruth ?? null,
            conversionSourceOfTruth: propertyBasics.conversionSourceOfTruth ?? null,
            crmSourceOfTruth: propertyBasics.crmSourceOfTruth ?? null,
            primaryDomain: domainAndSitemap.primaryDomain.toLowerCase(),
            status: "active",
            setupVersion: versionNumber
          }
        });

        const upsertIntegration = async (integrationInput: {
          provider: IntegrationProvider;
          status: "connected" | "warning" | "error" | "syncing" | "disconnected";
          authType: "oauth" | "manual";
          config: Record<string, unknown>;
        }) => {
          const existing = await tx.integrationConnection.findFirst({
            where: {
              workspaceId: input.workspaceId,
              propertyId: property.id,
              provider: integrationInput.provider
            }
          });

          if (existing) {
            await tx.integrationConnection.update({
              where: { id: existing.id },
              data: {
                status: integrationInput.status,
                authType: integrationInput.authType,
                configJson: integrationInput.config as Prisma.InputJsonValue
              }
            });
            return;
          }

          await tx.integrationConnection.create({
            data: {
              workspaceId: input.workspaceId,
              propertyId: property.id,
              provider: integrationInput.provider,
              status: integrationInput.status,
              authType: integrationInput.authType,
              configJson: integrationInput.config as Prisma.InputJsonValue,
              createdByUserId: input.userId
            }
          });
        };

        await upsertIntegration({
          provider: "sitemap",
          status: domainAndSitemap.sitemapConnectionStatus,
          authType: "manual",
          config: {
            primaryDomain: domainAndSitemap.primaryDomain,
            sitemapUrl: domainAndSitemap.sitemapUrl ?? null
          }
        });

        await upsertIntegration({
          provider: "ga4",
          status: ga4Connection.status,
          authType: "oauth",
          config: {
            measurementId: ga4Connection.measurementId ?? null,
            propertyExternalId: ga4Connection.propertyExternalId ?? null,
            dataStreamId: ga4Connection.dataStreamId ?? null
          }
        });

        await upsertIntegration({
          provider: "gsc",
          status: gscConnection.status,
          authType: "oauth",
          config: {
            siteUrl: gscConnection.siteUrl ?? null,
            propertyExternalId: gscConnection.propertyExternalId ?? null
          }
        });

        await tx.conversionDefinition.deleteMany({
          where: { propertyId: property.id }
        });

        for (const definition of conversionDefinitions.definitions) {
          const createdDefinition = await tx.conversionDefinition.create({
            data: {
              propertyId: property.id,
              name: definition.name,
              conversionType: definition.conversionType,
              status: definition.status
            }
          });

          const createdVersion = await tx.conversionDefinitionVersion.create({
            data: {
              conversionDefinitionId: createdDefinition.id,
              versionNumber: 1,
              eventName: definition.eventName,
              ...(definition.matchingRulesJson !== undefined
                ? {
                    matchingRulesJson:
                      definition.matchingRulesJson as Prisma.InputJsonValue
                  }
                : {}),
              ...(definition.externalFlowRulesJson !== undefined
                ? {
                    externalFlowRulesJson:
                      definition.externalFlowRulesJson as Prisma.InputJsonValue
                  }
                : {}),
              ...(definition.exclusionRulesJson !== undefined
                ? {
                    exclusionRulesJson:
                      definition.exclusionRulesJson as Prisma.InputJsonValue
                  }
                : {}),
              attributionNotes: definition.attributionNotes ?? null,
              effectiveFrom: timestamp,
              createdByUserId: input.userId
            }
          });

          await tx.conversionDefinition.update({
            where: { id: createdDefinition.id },
            data: {
              currentVersionId: createdVersion.id
            }
          });
        }

        await tx.canonicalPage.deleteMany({
          where: { propertyId: property.id }
        });
        await tx.pageGroup.deleteMany({
          where: { propertyId: property.id }
        });

        for (const pageGroup of priorityPagesAndGroups.pageGroups) {
          const createdGroup = await tx.pageGroup.create({
            data: {
              propertyId: property.id,
              name: pageGroup.name,
              groupType: pageGroup.groupType,
              description: pageGroup.description ?? null
            }
          });

          for (const page of pageGroup.pages) {
            await tx.canonicalPage.create({
              data: {
                propertyId: property.id,
                pageGroupId: createdGroup.id,
                canonicalUrl: page.canonicalUrl,
                normalizedUrlKey: normalizeUrlKey(page.canonicalUrl),
                title: page.title ?? null,
                priorityTier: page.priorityTier
              }
            });
          }
        }

        for (const page of priorityPagesAndGroups.ungroupedPriorityPages) {
          await tx.canonicalPage.create({
            data: {
              propertyId: property.id,
              canonicalUrl: page.canonicalUrl,
              normalizedUrlKey: normalizeUrlKey(page.canonicalUrl),
              title: page.title ?? null,
              priorityTier: page.priorityTier
            }
          });
        }

        const nextVersions = [
          ...currentState.versions,
          {
            versionNumber,
            createdAt: timestamp.toISOString(),
            createdByUserId: input.userId,
            configuration: currentState.draft.draftData
          }
        ];

        const activatedState: PropertySetupState = {
          draft: {
            ...currentState.draft,
            currentStep: "reviewAndActivate",
            completedSteps: [...setupWizardSteps],
            updatedAt: timestamp.toISOString(),
            updatedByUserId: input.userId
          },
          versions: nextVersions
        };

        await tx.propertySetting.upsert({
          where: { propertyId: property.id },
          create: {
            propertyId: property.id,
            reportSettingsJson: {
              recipients: reportingAndAlerts.reportingRecipients
            } as Prisma.InputJsonValue,
            alertSettingsJson: reportingAndAlerts.alerts as Prisma.InputJsonValue,
            trustPolicyJson: mergeSetupStateIntoTrustPolicy(
              propertySetting?.trustPolicyJson ?? null,
              activatedState
            )
          },
          update: {
            reportSettingsJson: {
              recipients: reportingAndAlerts.reportingRecipients
            } as Prisma.InputJsonValue,
            alertSettingsJson: reportingAndAlerts.alerts as Prisma.InputJsonValue,
            trustPolicyJson: mergeSetupStateIntoTrustPolicy(
              propertySetting?.trustPolicyJson ?? null,
              activatedState
            )
          }
        });
      });
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : "Unable to activate property setup."
      );
    }

    return this.getSetupDraft({ workspaceId: input.workspaceId, propertyId: property.id });
  }

  async listConfigurationVersions(input: { workspaceId: string; propertyId: string }) {
    const draft = await this.getSetupDraft(input);
    return {
      workspaceId: input.workspaceId,
      propertyId: input.propertyId,
      setupVersion: draft.setupVersion,
      versions: [...draft.versions].sort((a, b) => b.versionNumber - a.versionNumber)
    };
  }
}
