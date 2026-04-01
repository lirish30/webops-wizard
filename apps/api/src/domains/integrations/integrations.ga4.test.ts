import { describe, expect, it } from "vitest";

import {
  completeGa4OAuthSchema,
  requestGa4BackfillSchema,
  selectGa4PropertySchema,
  startGa4OAuthSchema
} from "./integrations.dto";
import { IntegrationsService } from "./integrations.service";

describe("GA4 integration DTOs", () => {
  it("parses GA4 OAuth start requests", () => {
    const parsed = startGa4OAuthSchema.parse({
      redirectUri: "https://app.example.com/integrations/ga4/callback"
    });

    expect(parsed.redirectUri).toContain("callback");
  });

  it("rejects backfill requests where end date is before start date", () => {
    expect(() =>
      requestGa4BackfillSchema.parse({
        startDate: "2026-03-31",
        endDate: "2026-03-01"
      })
    ).toThrowError(/endDate/);
  });

  it("requires a provider property id when selecting a GA4 property", () => {
    expect(() =>
      selectGa4PropertySchema.parse({
        displayName: "Primary property"
      })
    ).toThrowError(/propertyId/);
  });

  it("parses OAuth completion payloads", () => {
    const parsed = completeGa4OAuthSchema.parse({
      code: "placeholder-code",
      state: "ga4-state",
      redirectUri: "https://app.example.com/integrations/ga4/callback"
    });

    expect(parsed.code).toBe("placeholder-code");
  });
});

describe("GA4 integration service helpers", () => {
  it("merges OAuth and property selection metadata into config", () => {
    const service = new IntegrationsService();

    const updated = service.mergeGa4Config(
      {
        oauth: {
          status: "pending",
          state: "ga4-state"
        }
      },
      {
        oauth: {
          status: "connected"
        },
        selectedProperty: {
          propertyId: "properties/1001",
          displayName: "Primary property"
        }
      }
    );

    expect((updated.oauth as Record<string, unknown> | undefined)?.status).toBe(
      "connected"
    );
    expect(
      (updated.selectedProperty as Record<string, unknown> | undefined)?.propertyId
    ).toBe("properties/1001");
  });
});
