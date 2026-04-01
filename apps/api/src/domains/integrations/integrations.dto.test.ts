import { describe, expect, it } from "vitest";

import {
  requestGscBackfillSchema,
  selectGscSiteSchema,
  startGscOAuthSchema,
  updateIntegrationSchema
} from "./integrations.dto";

describe("Integrations DTO", () => {
  it("accepts partial update payload", () => {
    const parsed = updateIntegrationSchema.parse({ status: "connected" });
    expect(parsed.status).toBe("connected");
  });

  it("accepts GSC OAuth start payload", () => {
    const parsed = startGscOAuthSchema.parse({
      redirectUri: "https://app.example.com/callback"
    });

    expect(parsed.redirectUri).toBe("https://app.example.com/callback");
  });

  it("accepts GSC site selection payload", () => {
    const parsed = selectGscSiteSchema.parse({
      siteUrl: "sc-domain:example.com",
      displayName: "Example Domain",
      syncEveryMinutes: 1440,
      freshnessSlaMinutes: 2880,
      lookbackDays: 7
    });

    expect(parsed.siteUrl).toBe("sc-domain:example.com");
    expect(parsed.lookbackDays).toBe(7);
  });

  it("rejects GSC backfill payload when end date precedes start date", () => {
    const result = requestGscBackfillSchema.safeParse({
      startDate: "2026-03-10",
      endDate: "2026-03-09"
    });

    expect(result.success).toBe(false);
  });
});
