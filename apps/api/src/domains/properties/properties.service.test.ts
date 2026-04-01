import { describe, expect, it } from "vitest";

import { PropertiesService, validateSetupDraftForActivation } from "./properties.service";

describe("PropertiesService", () => {
  it("constructs", () => {
    const service = new PropertiesService();
    expect(service).toBeInstanceOf(PropertiesService);
  });

  it("fails activation validation when required steps are missing", () => {
    const errors = validateSetupDraftForActivation({
      workspaceDetails: {
        workspaceName: "Acme"
      } as never
    });

    expect(errors.some((error) => error.field === "propertyBasics")).toBe(true);
    expect(errors.some((error) => error.field === "reviewAndActivate")).toBe(true);
  });

  it("passes activation validation for complete draft", () => {
    const errors = validateSetupDraftForActivation({
      workspaceDetails: {
        workspaceName: "Acme Workspace",
        workspaceSlug: "acme-workspace",
        region: "us"
      },
      propertyBasics: {
        propertyName: "Acme Site",
        environment: "prod",
        businessModel: "lead_gen"
      },
      domainAndSitemap: {
        primaryDomain: "example.com",
        sitemapUrl: "https://example.com/sitemap.xml",
        domainOwnership: {
          method: "dnsTxt",
          status: "notStarted"
        },
        sitemapConnectionStatus: "connected"
      },
      ga4Connection: {
        status: "connected",
        measurementId: "G-123456"
      },
      gscConnection: {
        status: "connected",
        siteUrl: "https://example.com"
      },
      conversionDefinitions: {
        definitions: [
          {
            name: "Lead",
            conversionType: "primary",
            status: "active",
            eventName: "generate_lead"
          }
        ]
      },
      priorityPagesAndPageGroups: {
        pageGroups: [],
        ungroupedPriorityPages: []
      },
      reportingRecipientsAndAlertSettings: {
        reportingRecipients: ["ops@example.com"],
        alerts: {
          enabled: true,
          notifyEmails: ["ops@example.com"],
          minimumSeverity: "warning"
        }
      },
      reviewAndActivate: {
        confirmedByUser: true
      }
    });

    expect(errors).toHaveLength(0);
  });

  it("returns precise activation errors for required readiness rules", () => {
    const errors = validateSetupDraftForActivation({
      workspaceDetails: {
        workspaceName: "Acme Workspace",
        workspaceSlug: "acme-workspace",
        region: "us"
      },
      propertyBasics: {
        propertyName: "Acme Site",
        environment: "prod",
        businessModel: "lead_gen"
      },
      domainAndSitemap: {
        primaryDomain: "not a domain",
        domainOwnership: {
          method: "dnsTxt",
          status: "notStarted"
        },
        sitemapConnectionStatus: "connected"
      },
      ga4Connection: {
        status: "disconnected"
      },
      gscConnection: {
        status: "connected",
        siteUrl: "notaurl"
      } as never,
      conversionDefinitions: {
        definitions: []
      },
      priorityPagesAndPageGroups: {
        pageGroups: [],
        ungroupedPriorityPages: []
      },
      reportingRecipientsAndAlertSettings: {
        reportingRecipients: ["ops@example.com"],
        alerts: {
          enabled: true,
          notifyEmails: ["ops@example.com"],
          minimumSeverity: "warning"
        }
      },
      reviewAndActivate: {
        confirmedByUser: true
      }
    });

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "domainAndSitemap.primaryDomain",
          code: "invalid_domain"
        }),
        expect.objectContaining({
          field: "ga4Connection.status",
          code: "missing_analytics_source"
        }),
        expect.objectContaining({
          field: "gscConnection.siteUrl",
          code: "invalid_search_source"
        }),
        expect.objectContaining({
          field: "conversionDefinitions.definitions",
          code: "missing_conversion_definition"
        })
      ])
    );
  });
});
