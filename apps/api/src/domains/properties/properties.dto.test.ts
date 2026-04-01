import { describe, expect, it } from "vitest";

import {
  savePropertySetupDraftSchema,
  setupWizardStepSchema,
  stepPayloadSchemaMap
} from "./properties.dto";

describe("Properties Wizard DTO", () => {
  it("accepts all required setup wizard steps", () => {
    expect(setupWizardStepSchema.options).toEqual([
      "workspaceDetails",
      "propertyBasics",
      "domainAndSitemap",
      "ga4Connection",
      "gscConnection",
      "conversionDefinitions",
      "priorityPagesAndPageGroups",
      "reportingRecipientsAndAlertSettings",
      "reviewAndActivate"
    ]);
  });

  it("validates draft payload by step schema", () => {
    const parsed = savePropertySetupDraftSchema.parse({
      step: "propertyBasics",
      payload: {
        propertyName: "Acme",
        environment: "prod",
        businessModel: "lead_gen"
      }
    });

    expect(parsed.step).toBe("propertyBasics");
  });

  it("rejects invalid payload for step", () => {
    const result = savePropertySetupDraftSchema.safeParse({
      step: "ga4Connection",
      payload: {
        status: "connected"
      }
    });

    expect(result.success).toBe(true);

    const invalid = savePropertySetupDraftSchema.safeParse({
      step: "ga4Connection",
      payload: {
        status: "not-valid"
      }
    });

    expect(invalid.success).toBe(false);
  });

  it("requires valid review confirmation shape", () => {
    const reviewStepSchema = stepPayloadSchemaMap.reviewAndActivate;
    const parsed = reviewStepSchema.parse({ confirmedByUser: true });
    expect(parsed.confirmedByUser).toBe(true);

    const invalid = reviewStepSchema.safeParse({ confirmedByUser: "yes" });
    expect(invalid.success).toBe(false);
  });

  it("supports placeholder domain ownership verification data", () => {
    const domainSchema = stepPayloadSchemaMap.domainAndSitemap;
    const parsed = domainSchema.parse({
      primaryDomain: "example.com",
      domainOwnership: {
        method: "metaTag",
        status: "instructionsReady",
        metaTagName: "webops-domain-verification",
        metaTagContent: "webops-example-meta"
      },
      sitemapConnectionStatus: "syncing"
    });

    expect(parsed.domainOwnership.method).toBe("metaTag");
    expect(parsed.domainOwnership.status).toBe("instructionsReady");
  });
});
