import { describe, expect, it } from "vitest";

import type { UpdateMembershipRoleDto } from "./workspaces.dto";

describe("Workspaces DTO", () => {
  it("supports membership role payload shape", () => {
    const payload = { role: "manager" } as UpdateMembershipRoleDto;
    expect(payload.role).toBe("manager");
  });
});
