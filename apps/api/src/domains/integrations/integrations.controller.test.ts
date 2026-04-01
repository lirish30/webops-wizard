import { describe, expect, it, vi } from "vitest";

import { IntegrationsController } from "./integrations.controller";

describe("IntegrationsController", () => {
  it("constructs", () => {
    const controller = new IntegrationsController(
      {} as never,
      {} as never,
      {} as never
    );
    expect(controller).toBeInstanceOf(IntegrationsController);
  });

  it("delegates GSC status lookup to the integrations service", async () => {
    const integrationsService = {
      getGscStatus: vi.fn().mockResolvedValue({ provider: "gsc", auth: { status: "pending" } })
    };
    const controller = new IntegrationsController(
      integrationsService as never,
      {} as never,
      {} as never
    );

    const result = await controller.getGscStatus("integration_1", {
      workspaceId: "workspace_1",
      userId: "user_1"
    } as never);

    expect(integrationsService.getGscStatus).toHaveBeenCalledWith(
      "workspace_1",
      "integration_1"
    );
    expect(result).toEqual({
      workspaceId: "workspace_1",
      gsc: { provider: "gsc", auth: { status: "pending" } }
    });
  });
});
