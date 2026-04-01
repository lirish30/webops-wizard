import { describe, expect, it } from "vitest";

import { WorkspacesController } from "./workspaces.controller";

describe("WorkspacesController", () => {
  it("constructs with dependencies", () => {
    const controller = new WorkspacesController({} as never, {} as never);
    expect(controller).toBeInstanceOf(WorkspacesController);
  });
});
