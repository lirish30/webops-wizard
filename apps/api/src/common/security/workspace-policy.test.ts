import { MembershipRole } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  hasWorkspaceCapability,
  listWorkspaceCapabilities
} from "./workspace-policy";

describe("workspace policy", () => {
  it("grants full access to owner", () => {
    expect(hasWorkspaceCapability(MembershipRole.owner, "workspace.memberships.manage")).toBe(
      true
    );
    expect(hasWorkspaceCapability(MembershipRole.owner, "settings.manage")).toBe(true);
    expect(hasWorkspaceCapability(MembershipRole.owner, "integration.manage")).toBe(true);
  });

  it("keeps external roles read oriented", () => {
    expect(hasWorkspaceCapability(MembershipRole.client_viewer, "reports.read")).toBe(true);
    expect(hasWorkspaceCapability(MembershipRole.client_viewer, "property.read")).toBe(false);
    expect(hasWorkspaceCapability(MembershipRole.external_stakeholder, "settings.read")).toBe(
      false
    );
  });

  it("exposes stable capability lists per role", () => {
    const adminCaps = listWorkspaceCapabilities(MembershipRole.admin);
    const managerCaps = listWorkspaceCapabilities(MembershipRole.manager);
    const viewerCaps = listWorkspaceCapabilities(MembershipRole.viewer);

    expect(adminCaps.length).toBeGreaterThan(managerCaps.length);
    expect(managerCaps).toContain("property.write");
    expect(viewerCaps).not.toContain("property.write");
  });
});

