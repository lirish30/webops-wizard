"use client";

import { useMemo, useState } from "react";

import {
  DEFAULT_SETUP_DRAFT,
  STEP_SEQUENCE,
  canActivateSetup,
  computeStepStatus,
  domainVerificationMethods,
  getActivationBlockers,
  getCompletionRatio,
  type DomainVerificationMethod,
  type SetupDraft,
  type SetupStepId,
  validateStep
} from "./setup-wizard.logic";

type SaveState = "idle" | "saved" | "error";

type StepMeta = {
  id: SetupStepId;
  label: string;
  title: string;
  description: string;
  helpTitle: string;
  helpBody: string;
  helpTip: string;
};

const DRAFT_STORAGE_KEY = "webops-wizard:setup-draft:v1";

const stepMetadata: StepMeta[] = [
  {
    id: "workspace",
    label: "Workspace",
    title: "Name your workspace and website",
    description:
      "Set the baseline identity so everyone sees the same property context and recommendations.",
    helpTitle: "Why this matters",
    helpBody:
      "This controls reporting labels, ownership routing, and the default site used by checks.",
    helpTip: "Use the business name your team already uses in weekly updates."
  },
  {
    id: "operations",
    label: "Operations",
    title: "Choose your operating focus",
    description:
      "Pick a primary goal and where weekly summaries should be delivered so actions stay visible.",
    helpTitle: "How to choose",
    helpBody:
      "Start with one main goal. You can expand to more goals later from settings without re-running setup.",
    helpTip: "Use a shared team alias, not a personal email, for continuity."
  },
  {
    id: "integrations",
    label: "Integrations",
    title: "Connect your first data sources",
    description:
      "Select at least one integration so health signals and alerts can be activated safely.",
    helpTitle: "Start small",
    helpBody:
      "Connecting one source is enough to begin. Add the rest after activation if access is still pending.",
    helpTip: "Analytics + Search Console is usually the fastest useful starting point."
  },
  {
    id: "review",
    label: "Review",
    title: "Review summary and activate",
    description:
      "Confirm the setup before activation. The system stays gated until all required checks are complete.",
    helpTitle: "Activation gating",
    helpBody:
      "Activation stays locked until required fields are complete and you confirm the checklist.",
    helpTip: "If blocked, fix the listed items below and try activation again."
  }
];

const industryOptions = [
  "Ecommerce",
  "SaaS",
  "Media",
  "B2B Services",
  "Healthcare",
  "Education"
];

const goalOptions = [
  "Reduce release risk",
  "Improve content quality",
  "Increase conversion performance",
  "Strengthen data trust"
];

const integrationOptions: Array<{
  key: keyof SetupDraft["integrations"];
  label: string;
}> = [
  { key: "analytics", label: "Google Analytics 4" },
  { key: "searchConsole", label: "Google Search Console" },
  { key: "cms", label: "CMS publishing feed" }
];

const domainVerificationMethodLabels: Record<DomainVerificationMethod, string> = {
  dnsTxt: "DNS TXT record",
  htmlFile: "HTML file upload",
  metaTag: "Meta tag"
};

function formatTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(timestamp);
}

function toDraft(value: unknown): SetupDraft {
  if (!value || typeof value !== "object") {
    return DEFAULT_SETUP_DRAFT;
  }

  const incoming = value as Partial<SetupDraft>;
  return {
    ...DEFAULT_SETUP_DRAFT,
    ...incoming,
    domainVerification: {
      ...DEFAULT_SETUP_DRAFT.domainVerification,
      ...(incoming.domainVerification ?? {})
    },
    integrations: {
      ...DEFAULT_SETUP_DRAFT.integrations,
      ...(incoming.integrations ?? {})
    }
  };
}

function getVerificationSeed(websiteUrl: string) {
  if (!websiteUrl) {
    return "example.com";
  }

  try {
    const parsed = new URL(websiteUrl);
    return parsed.hostname || "example.com";
  } catch {
    return "example.com";
  }
}

export function SetupWizard() {
  const firstStep = stepMetadata[0];
  if (!firstStep) {
    throw new Error("Setup wizard requires at least one step.");
  }

  const [draft, setDraft] = useState<SetupDraft>(() => {
    if (typeof window === "undefined") {
      return DEFAULT_SETUP_DRAFT;
    }

    try {
      const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) {
        return DEFAULT_SETUP_DRAFT;
      }

      const parsed = JSON.parse(raw) as { draft?: unknown };
      return toDraft(parsed.draft);
    } catch {
      return DEFAULT_SETUP_DRAFT;
    }
  });
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [showValidation, setShowValidation] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    try {
      const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as { savedAt?: number };
      return typeof parsed.savedAt === "number" ? parsed.savedAt : null;
    } catch {
      return null;
    }
  });
  const [isActivated, setIsActivated] = useState(false);

  const currentStep = stepMetadata[currentStepIndex] ?? firstStep;
  const completionRatio = getCompletionRatio(draft);
  const completionPercent = Math.round(completionRatio * 100);
  const currentStepErrors = validateStep(draft, currentStep.id);
  const activationBlockers = getActivationBlockers(draft);
  const activationAllowed = canActivateSetup(draft);
  const verificationSeed = getVerificationSeed(draft.websiteUrl);

  const stepStatusMap = useMemo(() => {
    return STEP_SEQUENCE.reduce<Record<SetupStepId, "current" | "complete" | "upcoming">>(
      (accumulator, stepId, index) => {
        if (index === currentStepIndex) {
          accumulator[stepId] = "current";
          return accumulator;
        }

        accumulator[stepId] = computeStepStatus(draft, stepId);
        return accumulator;
      },
      {
        workspace: "upcoming",
        operations: "upcoming",
        integrations: "upcoming",
        review: "upcoming"
      }
    );
  }, [currentStepIndex, draft]);

  function updateDraft(patch: Partial<SetupDraft>) {
    const nextDraft = { ...draft, ...patch };
    setDraft(nextDraft);
    setSaveState("idle");
  }

  function updateIntegration(key: keyof SetupDraft["integrations"], value: boolean) {
    const nextDraft: SetupDraft = {
      ...draft,
      integrations: {
        ...draft.integrations,
        [key]: value
      }
    };
    setDraft(nextDraft);
    setSaveState("idle");
  }

  function updateDomainVerification(
    patch: Partial<SetupDraft["domainVerification"]>
  ) {
    updateDraft({
      domainVerification: {
        ...draft.domainVerification,
        ...patch
      }
    });
  }

  function hydrateVerificationTemplate(method: DomainVerificationMethod) {
    const baseToken = verificationSeed.replace(/[^a-z0-9.-]/gi, "-").toLowerCase();

    if (method === "dnsTxt") {
      updateDomainVerification({
        method,
        status: "instructionsReady",
        dnsTxtRecordName: `_webops.${verificationSeed}`,
        dnsTxtRecordValue: `webops-verify=${baseToken}`,
        lastAttemptAt: null,
        failureReason: null
      });
      return;
    }

    if (method === "htmlFile") {
      updateDomainVerification({
        method,
        status: "instructionsReady",
        htmlFileName: `webops-verify-${baseToken}.html`,
        htmlFileToken: `webops-${baseToken}-token`,
        lastAttemptAt: null,
        failureReason: null
      });
      return;
    }

    updateDomainVerification({
      method,
      status: "instructionsReady",
      metaTagName: "webops-domain-verification",
      metaTagContent: `webops-${baseToken}-meta`,
      lastAttemptAt: null,
      failureReason: null
    });
  }

  function handleNextStep() {
    const nextErrors = validateStep(draft, currentStep.id);
    setShowValidation(true);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setShowValidation(false);
    setCurrentStepIndex((current) => Math.min(current + 1, stepMetadata.length - 1));
  }

  function handlePreviousStep() {
    setCurrentStepIndex((current) => Math.max(current - 1, 0));
    setShowValidation(false);
  }

  function jumpToStep(index: number) {
    if (index <= currentStepIndex) {
      setCurrentStepIndex(index);
      setShowValidation(false);
    }
  }

  function saveDraft() {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const savedAt = Date.now();
      window.localStorage.setItem(
        DRAFT_STORAGE_KEY,
        JSON.stringify({
          draft,
          savedAt
        })
      );
      setLastSavedAt(savedAt);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  function activateSetup() {
    if (!activationAllowed) {
      return;
    }

    setIsActivated(true);
  }

  return (
    <section className="surface-panel setup-wizard" aria-label="Setup wizard">
      <header className="setup-wizard__header">
        <div>
          <p className="eyebrow">Setup Wizard</p>
          <h1>Guided setup for your first workspace</h1>
          <p className="setup-wizard__intro">
            Complete these steps to activate WebOps monitoring with guardrails for non-
            engineering teams.
          </p>
        </div>
        <div className="setup-wizard__header-actions">
          <button type="button" className="button button--secondary" onClick={saveDraft}>
            Save draft
          </button>
          <p className="setup-wizard__save-status" aria-live="polite">
            {saveState === "saved" && lastSavedAt
              ? `Draft saved ${formatTimestamp(lastSavedAt)}`
              : null}
            {saveState === "error" ? "Could not save draft. Try again." : null}
            {saveState === "idle" && lastSavedAt
              ? `Last saved ${formatTimestamp(lastSavedAt)}`
              : null}
          </p>
        </div>
      </header>

      <div className="setup-progress" aria-label="Setup progress">
        <div className="setup-progress__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={completionPercent}>
          <span style={{ width: `${completionPercent}%` }} />
        </div>
        <strong>{completionPercent}% complete</strong>
      </div>

      <ol className="setup-stepper" aria-label="Wizard steps">
        {stepMetadata.map((step, index) => {
          const status = stepStatusMap[step.id];

          return (
            <li key={step.id}>
              <button
                type="button"
                className={`setup-stepper__item setup-stepper__item--${status}`}
                onClick={() => jumpToStep(index)}
                disabled={index > currentStepIndex}
                aria-current={status === "current" ? "step" : undefined}
              >
                <span className="setup-stepper__index">{index + 1}</span>
                <span className="setup-stepper__copy">
                  <strong>{step.label}</strong>
                  <small>{status === "complete" ? "Complete" : status === "current" ? "In progress" : "Upcoming"}</small>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="setup-wizard__body">
        <div className="setup-wizard__content">
          <div className="setup-wizard__step-head">
            <h2>{currentStep.title}</h2>
            <p>{currentStep.description}</p>
          </div>

          {currentStep.id === "workspace" ? (
            <div className="setup-form-grid">
              <label className="setup-field">
                <span>Workspace name</span>
                <input
                  type="text"
                  value={draft.workspaceName}
                  onChange={(event) => updateDraft({ workspaceName: event.target.value })}
                  onBlur={() => setShowValidation(true)}
                  placeholder="Growth Operations"
                />
                {showValidation && currentStepErrors.workspaceName ? (
                  <small className="setup-field__error">{currentStepErrors.workspaceName}</small>
                ) : null}
              </label>

              <label className="setup-field">
                <span>Primary website URL</span>
                <input
                  type="url"
                  value={draft.websiteUrl}
                  onChange={(event) => updateDraft({ websiteUrl: event.target.value })}
                  onBlur={() => setShowValidation(true)}
                  placeholder="https://example.com"
                />
                {showValidation && currentStepErrors.websiteUrl ? (
                  <small className="setup-field__error">{currentStepErrors.websiteUrl}</small>
                ) : null}
              </label>

              <label className="setup-field">
                <span>Industry</span>
                <select
                  value={draft.industry}
                  onChange={(event) => updateDraft({ industry: event.target.value })}
                  onBlur={() => setShowValidation(true)}
                >
                  <option value="">Select industry</option>
                  {industryOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                {showValidation && currentStepErrors.industry ? (
                  <small className="setup-field__error">{currentStepErrors.industry}</small>
                ) : null}
              </label>

              <section className="setup-domain-verification">
                <header className="setup-domain-verification__head">
                  <h3>Domain ownership verification</h3>
                  <span>Placeholder for upcoming activation checks</span>
                </header>
                <p>
                  Choose the future verification method now so this setup can transition to
                  automated ownership checks in a later phase.
                </p>

                <fieldset className="setup-domain-verification__methods">
                  <legend>Verification method</legend>
                  {domainVerificationMethods.map((method) => (
                    <label className="setup-checkbox" key={method}>
                      <input
                        type="radio"
                        name="domainVerificationMethod"
                        checked={draft.domainVerification.method === method}
                        onChange={() => hydrateVerificationTemplate(method)}
                      />
                      <span>{domainVerificationMethodLabels[method]}</span>
                    </label>
                  ))}
                </fieldset>

                <div className="setup-domain-verification__details">
                  {draft.domainVerification.method === "dnsTxt" ? (
                    <>
                      <label className="setup-field">
                        <span>TXT record name</span>
                        <input
                          type="text"
                          value={draft.domainVerification.dnsTxtRecordName}
                          onChange={(event) =>
                            updateDomainVerification({ dnsTxtRecordName: event.target.value })
                          }
                          placeholder={`_webops.${verificationSeed}`}
                        />
                      </label>
                      <label className="setup-field">
                        <span>TXT record value</span>
                        <input
                          type="text"
                          value={draft.domainVerification.dnsTxtRecordValue}
                          onChange={(event) =>
                            updateDomainVerification({ dnsTxtRecordValue: event.target.value })
                          }
                          placeholder={`webops-verify=${verificationSeed}`}
                        />
                      </label>
                    </>
                  ) : null}

                  {draft.domainVerification.method === "htmlFile" ? (
                    <>
                      <label className="setup-field">
                        <span>HTML file name</span>
                        <input
                          type="text"
                          value={draft.domainVerification.htmlFileName}
                          onChange={(event) =>
                            updateDomainVerification({ htmlFileName: event.target.value })
                          }
                          placeholder={`webops-verify-${verificationSeed}.html`}
                        />
                      </label>
                      <label className="setup-field">
                        <span>File token content</span>
                        <input
                          type="text"
                          value={draft.domainVerification.htmlFileToken}
                          onChange={(event) =>
                            updateDomainVerification({ htmlFileToken: event.target.value })
                          }
                          placeholder={`webops-${verificationSeed}-token`}
                        />
                      </label>
                    </>
                  ) : null}

                  {draft.domainVerification.method === "metaTag" ? (
                    <>
                      <label className="setup-field">
                        <span>Meta tag name</span>
                        <input
                          type="text"
                          value={draft.domainVerification.metaTagName}
                          onChange={(event) =>
                            updateDomainVerification({ metaTagName: event.target.value })
                          }
                          placeholder="webops-domain-verification"
                        />
                      </label>
                      <label className="setup-field">
                        <span>Meta tag content</span>
                        <input
                          type="text"
                          value={draft.domainVerification.metaTagContent}
                          onChange={(event) =>
                            updateDomainVerification({ metaTagContent: event.target.value })
                          }
                          placeholder={`webops-${verificationSeed}-meta`}
                        />
                      </label>
                    </>
                  ) : null}
                </div>

                <div className="setup-domain-verification__actions">
                  <button type="button" className="button button--secondary" disabled>
                    Start verification (Coming soon)
                  </button>
                  <button type="button" className="button button--secondary" disabled>
                    Check status (Coming soon)
                  </button>
                </div>
              </section>
            </div>
          ) : null}

          {currentStep.id === "operations" ? (
            <div className="setup-form-grid">
              <label className="setup-field">
                <span>Primary operating goal</span>
                <select
                  value={draft.primaryGoal}
                  onChange={(event) => updateDraft({ primaryGoal: event.target.value })}
                  onBlur={() => setShowValidation(true)}
                >
                  <option value="">Select goal</option>
                  {goalOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                {showValidation && currentStepErrors.primaryGoal ? (
                  <small className="setup-field__error">{currentStepErrors.primaryGoal}</small>
                ) : null}
              </label>

              <label className="setup-field">
                <span>Weekly summary recipient</span>
                <input
                  type="email"
                  value={draft.weeklySummaryEmail}
                  onChange={(event) => updateDraft({ weeklySummaryEmail: event.target.value })}
                  onBlur={() => setShowValidation(true)}
                  placeholder="ops-team@company.com"
                />
                {showValidation && currentStepErrors.weeklySummaryEmail ? (
                  <small className="setup-field__error">
                    {currentStepErrors.weeklySummaryEmail}
                  </small>
                ) : null}
              </label>

              <label className="setup-checkbox">
                <input
                  type="checkbox"
                  checked={draft.includeReleaseDigest}
                  onChange={(event) => updateDraft({ includeReleaseDigest: event.target.checked })}
                />
                <span>Include release digest snapshots in weekly summaries</span>
              </label>
            </div>
          ) : null}

          {currentStep.id === "integrations" ? (
            <div className="setup-form-grid">
              <fieldset className="setup-integrations" aria-describedby="integration-help">
                <legend>Select integrations</legend>
                {integrationOptions.map((option) => (
                  <label className="setup-checkbox" key={option.key}>
                    <input
                      type="checkbox"
                      checked={draft.integrations[option.key]}
                      onChange={(event) => {
                        updateIntegration(option.key, event.target.checked);
                        setShowValidation(true);
                      }}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </fieldset>

              <p id="integration-help" className="setup-integrations__hint">
                Start with one source now. Additional integrations can be connected from
                Settings later.
              </p>

              {showValidation && currentStepErrors.integrations ? (
                <small className="setup-field__error">{currentStepErrors.integrations}</small>
              ) : null}
            </div>
          ) : null}

          {currentStep.id === "review" ? (
            <div className="setup-review">
              <div className="setup-review__panel">
                <h3>Configuration summary</h3>
                <dl>
                  <div>
                    <dt>Workspace</dt>
                    <dd>{draft.workspaceName || "Not set"}</dd>
                  </div>
                  <div>
                    <dt>Website</dt>
                    <dd>{draft.websiteUrl || "Not set"}</dd>
                  </div>
                  <div>
                    <dt>Industry</dt>
                    <dd>{draft.industry || "Not set"}</dd>
                  </div>
                  <div>
                    <dt>Domain verification</dt>
                    <dd>
                      {domainVerificationMethodLabels[draft.domainVerification.method]} (
                      {draft.domainVerification.status})
                    </dd>
                  </div>
                  <div>
                    <dt>Primary goal</dt>
                    <dd>{draft.primaryGoal || "Not set"}</dd>
                  </div>
                  <div>
                    <dt>Weekly summary</dt>
                    <dd>{draft.weeklySummaryEmail || "Not set"}</dd>
                  </div>
                  <div>
                    <dt>Integrations</dt>
                    <dd>
                      {Object.entries(draft.integrations)
                        .filter(([, value]) => value)
                        .map(([key]) =>
                          integrationOptions.find((option) => option.key === key)?.label
                        )
                        .filter((label): label is string => Boolean(label))
                        .join(", ") || "None selected"}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="setup-review__panel">
                <h3>Activation checks</h3>
                {activationBlockers.length > 0 ? (
                  <ul>
                    {activationBlockers.map((blocker) => (
                      <li key={blocker}>{blocker}</li>
                    ))}
                  </ul>
                ) : (
                  <p>All required checks are complete. This workspace is ready to activate.</p>
                )}

                <label className="setup-checkbox">
                  <input
                    type="checkbox"
                    checked={draft.activationAcknowledged}
                    onChange={(event) =>
                      updateDraft({ activationAcknowledged: event.target.checked })
                    }
                  />
                  <span>I confirm this setup is ready for team activation.</span>
                </label>
              </div>

              {isActivated ? (
                <p className="setup-review__activated" role="status">
                  Workspace activated. Monitoring and reporting are now live.
                </p>
              ) : null}
            </div>
          ) : null}

          <footer className="setup-wizard__footer">
            <button
              type="button"
              className="button button--secondary"
              onClick={handlePreviousStep}
              disabled={currentStepIndex === 0}
            >
              Back
            </button>

            {currentStep.id !== "review" ? (
              <button type="button" className="button button--primary" onClick={handleNextStep}>
                Continue
              </button>
            ) : (
              <button
                type="button"
                className="button button--primary"
                onClick={activateSetup}
                disabled={!activationAllowed}
              >
                Activate workspace
              </button>
            )}
          </footer>
        </div>

        <aside className="setup-help surface-panel" aria-label="Contextual help">
          <p className="eyebrow">Contextual Help</p>
          <h3>{currentStep.helpTitle}</h3>
          <p>{currentStep.helpBody}</p>
          <p className="setup-help__tip">Tip: {currentStep.helpTip}</p>
        </aside>
      </div>
    </section>
  );
}
