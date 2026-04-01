import { describe, expect, it } from "vitest";

import {
  DEFAULT_SETUP_DRAFT,
  STEP_SEQUENCE,
  canActivateSetup,
  computeStepStatus,
  domainVerificationMethods,
  getActivationBlockers,
  getCompletionRatio,
  validateStep
} from "./setup-wizard.logic";

describe("setup wizard logic", () => {
  it("validates required fields for each step", () => {
    const stepOneErrors = validateStep(DEFAULT_SETUP_DRAFT, "workspace");
    expect(stepOneErrors.workspaceName).toBeTruthy();
    expect(stepOneErrors.websiteUrl).toBeTruthy();
    expect(stepOneErrors.industry).toBeTruthy();

    const stepTwoErrors = validateStep(DEFAULT_SETUP_DRAFT, "operations");
    expect(stepTwoErrors.primaryGoal).toBeTruthy();
    expect(stepTwoErrors.weeklySummaryEmail).toBeTruthy();

    const stepThreeErrors = validateStep(DEFAULT_SETUP_DRAFT, "integrations");
    expect(stepThreeErrors.integrations).toBeTruthy();
  });

  it("marks steps complete when requirements are met", () => {
    const completedDraft = {
      ...DEFAULT_SETUP_DRAFT,
      workspaceName: "Acme Growth",
      websiteUrl: "https://acme.com",
      industry: "Ecommerce",
      primaryGoal: "Reduce release risk",
      weeklySummaryEmail: "ops@acme.com",
      integrations: {
        analytics: true,
        searchConsole: false,
        cms: false
      },
      activationAcknowledged: true
    };

    expect(computeStepStatus(completedDraft, "workspace")).toBe("complete");
    expect(computeStepStatus(completedDraft, "operations")).toBe("complete");
    expect(computeStepStatus(completedDraft, "integrations")).toBe("complete");
    expect(computeStepStatus(completedDraft, "review")).toBe("complete");
    expect(getCompletionRatio(completedDraft)).toBe(1);
  });

  it("blocks activation with actionable reasons", () => {
    const blockers = getActivationBlockers(DEFAULT_SETUP_DRAFT);
    expect(blockers).toContain("Add your workspace name and primary website.");
    expect(blockers).toContain("Select at least one integration to activate monitoring.");
    expect(blockers).toContain("Confirm the review checklist before activating.");
    expect(canActivateSetup(DEFAULT_SETUP_DRAFT)).toBe(false);
  });

  it("defines a stable step sequence", () => {
    expect(STEP_SEQUENCE).toEqual(["workspace", "operations", "integrations", "review"]);
  });

  it("includes a future-ready domain ownership verification draft model", () => {
    expect(domainVerificationMethods).toEqual(["dnsTxt", "htmlFile", "metaTag"]);
    expect(DEFAULT_SETUP_DRAFT.domainVerification).toEqual({
      method: "dnsTxt",
      status: "notStarted",
      dnsTxtRecordName: "",
      dnsTxtRecordValue: "",
      htmlFileName: "",
      htmlFileToken: "",
      metaTagName: "webops-domain-verification",
      metaTagContent: "",
      lastAttemptAt: null,
      failureReason: null
    });
  });
});
