import { describe, expect, it } from "vitest";

import { IntegrationsService } from "./integrations.service";

describe("IntegrationsService", () => {
  it("constructs", () => {
    const service = new IntegrationsService();
    expect(service).toBeInstanceOf(IntegrationsService);
  });

  it("merges GSC config patches without discarding sibling keys", () => {
    const service = new IntegrationsService();

    const next = service.mergeConnectorConfig(
      {
        oauth: { status: "connected" },
        selectedSite: { siteUrl: "sc-domain:example.com" }
      },
      {
        pendingBackfill: {
          startDate: "2026-03-01",
          endDate: "2026-03-07"
        }
      }
    );

    expect(next).toMatchObject({
      oauth: { status: "connected" },
      selectedSite: { siteUrl: "sc-domain:example.com" },
      pendingBackfill: {
        startDate: "2026-03-01",
        endDate: "2026-03-07"
      }
    });
  });
});
