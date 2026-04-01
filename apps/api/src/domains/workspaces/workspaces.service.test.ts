import { describe, expect, it } from "vitest";

import { WorkspacesService } from "./workspaces.service";

describe("WorkspacesService", () => {
  it("constructs", () => {
    const service = new WorkspacesService();
    expect(service).toBeInstanceOf(WorkspacesService);
  });
});
