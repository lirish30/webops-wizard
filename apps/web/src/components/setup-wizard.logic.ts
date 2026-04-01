export type SetupStepId = "workspace" | "operations" | "integrations" | "review";

export type SetupStepStatus = "current" | "complete" | "upcoming";

export const domainVerificationMethods = ["dnsTxt", "htmlFile", "metaTag"] as const;
export type DomainVerificationMethod = (typeof domainVerificationMethods)[number];

export const domainVerificationStatuses = [
  "notStarted",
  "instructionsReady",
  "pending",
  "verified",
  "failed"
] as const;
export type DomainVerificationStatus = (typeof domainVerificationStatuses)[number];

export type DomainVerificationDraft = {
  method: DomainVerificationMethod;
  status: DomainVerificationStatus;
  dnsTxtRecordName: string;
  dnsTxtRecordValue: string;
  htmlFileName: string;
  htmlFileToken: string;
  metaTagName: string;
  metaTagContent: string;
  lastAttemptAt: string | null;
  failureReason: string | null;
};

export type SetupDraft = {
  workspaceName: string;
  websiteUrl: string;
  industry: string;
  domainVerification: DomainVerificationDraft;
  primaryGoal: string;
  weeklySummaryEmail: string;
  includeReleaseDigest: boolean;
  integrations: {
    analytics: boolean;
    searchConsole: boolean;
    cms: boolean;
  };
  activationAcknowledged: boolean;
};

export type SetupValidationErrors = Partial<
  Record<
    | "workspaceName"
    | "websiteUrl"
    | "industry"
    | "primaryGoal"
    | "weeklySummaryEmail"
    | "integrations",
    string
  >
>;

export const STEP_SEQUENCE: SetupStepId[] = [
  "workspace",
  "operations",
  "integrations",
  "review"
];

export const DEFAULT_SETUP_DRAFT: SetupDraft = {
  workspaceName: "",
  websiteUrl: "",
  industry: "",
  domainVerification: {
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
  },
  primaryGoal: "",
  weeklySummaryEmail: "",
  includeReleaseDigest: true,
  integrations: {
    analytics: false,
    searchConsole: false,
    cms: false
  },
  activationAcknowledged: false
};

const simpleEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hasValidUrl(url: string) {
  if (!url.trim()) {
    return false;
  }

  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function getStepRequirements(draft: SetupDraft, step: SetupStepId): SetupValidationErrors {
  if (step === "workspace") {
    return {
      workspaceName: draft.workspaceName.trim() ? "" : "Workspace name is required.",
      websiteUrl: hasValidUrl(draft.websiteUrl)
        ? ""
        : "Provide a valid URL (for example, https://example.com).",
      industry: draft.industry.trim() ? "" : "Choose the industry context."
    };
  }

  if (step === "operations") {
    return {
      primaryGoal: draft.primaryGoal.trim() ? "" : "Select the main operating goal.",
      weeklySummaryEmail: simpleEmailRegex.test(draft.weeklySummaryEmail)
        ? ""
        : "Enter a valid email for weekly summaries."
    };
  }

  if (step === "integrations") {
    const hasIntegration = Object.values(draft.integrations).some(Boolean);

    return {
      integrations: hasIntegration
        ? ""
        : "Select at least one integration to activate monitoring."
    };
  }

  return {};
}

export function validateStep(draft: SetupDraft, step: SetupStepId): SetupValidationErrors {
  const requirements = getStepRequirements(draft, step);
  const validationErrors: SetupValidationErrors = {};

  for (const [field, value] of Object.entries(requirements)) {
    if (value) {
      validationErrors[field as keyof SetupValidationErrors] = value;
    }
  }

  return validationErrors;
}

export function computeStepStatus(draft: SetupDraft, step: SetupStepId): SetupStepStatus {
  if (step === "review") {
    return canActivateSetup(draft) ? "complete" : "upcoming";
  }

  return Object.keys(validateStep(draft, step)).length === 0 ? "complete" : "upcoming";
}

export function getCompletionRatio(draft: SetupDraft) {
  const completeCount = STEP_SEQUENCE.filter((step) => computeStepStatus(draft, step) === "complete")
    .length;

  return completeCount / STEP_SEQUENCE.length;
}

export function getActivationBlockers(draft: SetupDraft) {
  const blockers: string[] = [];
  const workspaceErrors = validateStep(draft, "workspace");
  const operationsErrors = validateStep(draft, "operations");
  const integrationsErrors = validateStep(draft, "integrations");

  if (workspaceErrors.workspaceName || workspaceErrors.websiteUrl) {
    blockers.push("Add your workspace name and primary website.");
  }

  if (workspaceErrors.industry) {
    blockers.push("Choose an industry so recommendations use the right baseline.");
  }

  if (operationsErrors.primaryGoal || operationsErrors.weeklySummaryEmail) {
    blockers.push("Set your primary goal and summary recipient.");
  }

  if (integrationsErrors.integrations) {
    blockers.push("Select at least one integration to activate monitoring.");
  }

  if (!draft.activationAcknowledged) {
    blockers.push("Confirm the review checklist before activating.");
  }

  return blockers;
}

export function canActivateSetup(draft: SetupDraft) {
  return getActivationBlockers(draft).length === 0;
}
